import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { detectQuestionType } from '@/lib/scanner/grading'

// Initialize Vision client with credentials from environment
function getVisionClient() {
  const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS
  if (!credentials) {
    throw new Error('GOOGLE_CLOUD_CREDENTIALS environment variable not set')
  }

  const credentialsJson = JSON.parse(Buffer.from(credentials, 'base64').toString())

  return new ImageAnnotatorClient({
    credentials: credentialsJson,
  })
}

interface ExtractedAnswer {
  question_number: number
  answer: string
  question_type: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown'
  confidence: number
  bbox?: { x: number; y: number; width: number; height: number }
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          send({ error: 'Unauthorized' })
          controller.close()
          return
        }

        const { imagePaths, sessionId, mode } = await req.json()

        if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
          send({ error: 'No images provided' })
          controller.close()
          return
        }

        send({ progress: { current: 0, total: imagePaths.length, message: 'Starting OCR...' } })

        const visionClient = getVisionClient()
        const allAnswers: ExtractedAnswer[] = []

        let allOcrText = ''

        // Process each image
        for (let i = 0; i < imagePaths.length; i++) {
          send({
            progress: {
              current: i + 1,
              total: imagePaths.length,
              message: `Processing page ${i + 1} of ${imagePaths.length}...`,
            },
          })

          // Get image from Supabase storage
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('scanned-documents')
            .download(imagePaths[i])

          if (downloadError) {
            console.error('Download error:', downloadError)
            send({ progress: { current: i + 1, total: imagePaths.length, message: `Error downloading image: ${downloadError.message}` } })
            continue
          }

          // Convert to base64
          const arrayBuffer = await imageData.arrayBuffer()
          const base64Image = Buffer.from(arrayBuffer).toString('base64')

          // Call Vision API
          const [result] = await visionClient.documentTextDetection({
            image: { content: base64Image },
          })

          const fullText = result.fullTextAnnotation?.text || ''
          allOcrText += fullText + '\n\n'

          // Send OCR preview
          send({ ocrPreview: fullText.substring(0, 500) })

          // Extract answers from OCR text
          const pageAnswers = extractAnswersFromText(fullText, i)
          allAnswers.push(...pageAnswers)
        }

        // Sort by question number
        allAnswers.sort((a, b) => a.question_number - b.question_number)

        // Re-number if there are gaps
        const renumbered = allAnswers.map((answer, index) => ({
          ...answer,
          question_number: index + 1,
        }))

        // Create scanned document record
        const { data: doc, error: docError } = await supabase
          .from('scanned_documents')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            pages: imagePaths.map((path: string, index: number) => ({
              path,
              page_number: index + 1,
            })),
            ocr_raw: { text: allOcrText, answers: renumbered },
            status: 'completed',
          })
          .select()
          .single()

        if (docError) {
          console.error('Document insert error:', docError)
        }

        // Create extracted questions records
        if (doc && renumbered.length > 0) {
          const questionsToInsert = renumbered.map((answer) => ({
            document_id: doc.id,
            user_id: user.id,
            question_number: answer.question_number,
            extracted_text: answer.answer,
            confidence: answer.confidence,
            question_type: answer.question_type,
            region_bbox: answer.bbox || null,
            page_index: 0,
          }))

          await supabase.from('extracted_questions').insert(questionsToInsert)
        }

        send({ answers: renumbered, rawText: allOcrText })
        send({ progress: { current: imagePaths.length, total: imagePaths.length, message: 'Complete!' } })
      } catch (error) {
        console.error('OCR processing error:', error)
        send({ error: error instanceof Error ? error.message : 'Processing failed' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

/**
 * Extract answers from OCR text
 */
function extractAnswersFromText(text: string, pageIndex: number): ExtractedAnswer[] {
  const answers: ExtractedAnswer[] = []
  const lines = text.split('\n').filter((line) => line.trim())

  console.log('OCR Text received:', text)
  console.log('Lines:', lines)

  // Common patterns for question-answer pairs (ordered by specificity)
  const patterns = [
    // "1. A" or "1) A" or "1: A" or "1 - A" (single letter answer)
    { regex: /^(\d+)\s*[.\):\-]\s*([A-Ea-e])\s*$/, type: 'multiple_choice' as const },
    // Just "1 A" or "1A"
    { regex: /^(\d+)\s*([A-Ea-e])\s*$/, type: 'multiple_choice' as const },
    // "1. True" or "1. False" or "1. T" or "1. F"
    { regex: /^(\d+)\s*[.\):\-]?\s*(true|false|t|f|yes|no)\s*$/i, type: 'true_false' as const },
    // "1. 42" or "1) 3.14" (numeric answer)
    { regex: /^(\d+)\s*[.\):\-]\s*(-?\d+\.?\d*)\s*$/, type: 'math' as const },
    // "Q1: answer" or "Q1. answer" or "#1 answer"
    { regex: /^[Qq#]?\s*(\d+)\s*[.\):\-]\s*(.+)$/, type: 'fill_in' as const },
    // "1. answer text" (general catch-all)
    { regex: /^(\d+)\s*[.\):\-]\s+(.+)$/, type: 'fill_in' as const },
    // "1 = A"
    { regex: /^(\d+)\s*=\s*([A-Ea-e])\s*$/, type: 'multiple_choice' as const },
    // Answer key format: "1-A" or "1:A"
    { regex: /^(\d+)\s*[\-:]\s*([A-Ea-e])\s*$/, type: 'multiple_choice' as const },
  ]

  const seenQuestions = new Set<number>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    for (const { regex, type } of patterns) {
      const match = trimmed.match(regex)
      if (match) {
        const questionNum = parseInt(match[1])
        const answerText = match[2].trim()

        if (questionNum > 0 && questionNum <= 200 && answerText && !seenQuestions.has(questionNum)) {
          const questionType = type === 'fill_in' ? detectQuestionType(answerText) : type

          answers.push({
            question_number: questionNum,
            answer: answerText,
            question_type: questionType,
            confidence: 0.85,
          })
          seenQuestions.add(questionNum)
          console.log(`Matched Q${questionNum}: ${answerText} (${questionType})`)
        }
        break
      }
    }
  }

  // If no structured answers found, try alternative extraction methods
  if (answers.length === 0) {
    console.log('No structured answers found, trying alternative methods...')

    // Method 1: Look for circled/marked letters (common in answer keys)
    // Pattern: standalone letters that could be answers
    const letterPattern = /\b([A-Da-d])\b/g
    const allText = text.replace(/\n/g, ' ')

    // Method 2: Look for number-letter pairs anywhere in text
    const pairPattern = /(\d+)\s*[.\):\-]?\s*([A-Ea-e])\b/g
    let pairMatch
    while ((pairMatch = pairPattern.exec(allText)) !== null) {
      const questionNum = parseInt(pairMatch[1])
      const answer = pairMatch[2].toUpperCase()

      if (questionNum > 0 && questionNum <= 50 && !seenQuestions.has(questionNum)) {
        answers.push({
          question_number: questionNum,
          answer: answer,
          question_type: 'multiple_choice',
          confidence: 0.7,
        })
        seenQuestions.add(questionNum)
        console.log(`Alt match Q${questionNum}: ${answer}`)
      }
    }

    // Method 3: If still nothing, look for sequences of letters
    if (answers.length === 0) {
      const sequenceMatch = allText.match(/([A-Da-d][\s,]+){2,}/g)
      if (sequenceMatch) {
        const letters = allText.match(/\b[A-Da-d]\b/g) || []
        letters.slice(0, 50).forEach((letter, index) => {
          if (!seenQuestions.has(index + 1)) {
            answers.push({
              question_number: index + 1,
              answer: letter.toUpperCase(),
              question_type: 'multiple_choice',
              confidence: 0.6,
            })
            console.log(`Sequence match Q${index + 1}: ${letter.toUpperCase()}`)
          }
        })
      }
    }
  }

  console.log(`Total answers extracted: ${answers.length}`)
  return answers
}
