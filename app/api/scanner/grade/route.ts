import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { gradeQuestion, detectQuestionType, type QuestionType } from '@/lib/scanner/grading'

// Initialize Vision client
function getVisionClient() {
  const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64
  if (!credentials) {
    throw new Error('GOOGLE_CLOUD_CREDENTIALS environment variable not set')
  }

  const credentialsJson = JSON.parse(Buffer.from(credentials, 'base64').toString())

  return new ImageAnnotatorClient({
    credentials: credentialsJson,
  })
}

interface AnswerKeyItem {
  id: string
  question_number: number
  correct_answer: string
  accepted_variants: string[]
  points: number
  question_type: QuestionType | null
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

        const { sessionId, assignmentId, answerKeyId, studentName, imagePaths } = await req.json()

        if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
          send({ error: 'No images provided' })
          controller.close()
          return
        }

        if (!assignmentId || !answerKeyId) {
          send({ error: 'Assignment and answer key required' })
          controller.close()
          return
        }

        send({ progress: { current: 0, total: 3, message: 'Loading answer key...' } })

        // Load answer key items
        const { data: keyItems, error: keyError } = await supabase
          .from('answer_key_items')
          .select('*')
          .eq('answer_key_id', answerKeyId)
          .order('question_number')

        if (keyError || !keyItems || keyItems.length === 0) {
          send({ error: 'Answer key not found or empty' })
          controller.close()
          return
        }

        send({ progress: { current: 1, total: 3, message: 'Processing images with OCR...' } })

        // Process images with OCR
        const visionClient = getVisionClient()
        let fullOcrText = ''

        for (const imagePath of imagePaths) {
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('scanned-documents')
            .download(imagePath)

          if (downloadError) continue

          const arrayBuffer = await imageData.arrayBuffer()
          const base64Image = Buffer.from(arrayBuffer).toString('base64')

          const [result] = await visionClient.documentTextDetection({
            image: { content: base64Image },
          })

          fullOcrText += (result.fullTextAnnotation?.text || '') + '\n'
        }

        // Extract student answers
        const studentAnswers = extractStudentAnswers(fullOcrText, keyItems.length)

        send({ progress: { current: 2, total: 3, message: 'Grading answers...' } })

        // Create scanned document record
        const { data: doc, error: docError } = await supabase
          .from('scanned_documents')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            assignment_id: assignmentId,
            pages: imagePaths.map((path: string, index: number) => ({
              path,
              page_number: index + 1,
            })),
            ocr_raw: { text: fullOcrText, answers: studentAnswers },
            status: 'completed',
          })
          .select()
          .single()

        if (docError) {
          console.error('Document insert error:', docError)
        }

        // Grade each question
        const questionGrades: Array<{
          question_number: number
          student_answer: string
          correct_answer: string
          points_possible: number
          points_earned: number
          is_correct: boolean
          confidence: number
          needs_review: boolean
        }> = []

        let totalEarned = 0
        let totalPossible = 0

        for (const keyItem of keyItems as AnswerKeyItem[]) {
          const studentAnswer = studentAnswers[keyItem.question_number] || ''
          const questionType = keyItem.question_type || detectQuestionType(keyItem.correct_answer)

          const result = gradeQuestion(
            studentAnswer,
            keyItem.correct_answer,
            questionType,
            {
              pointsPossible: keyItem.points || 1,
              acceptedVariants: Array.isArray(keyItem.accepted_variants) ? keyItem.accepted_variants : [],
            }
          )

          questionGrades.push({
            question_number: keyItem.question_number,
            student_answer: studentAnswer,
            correct_answer: keyItem.correct_answer,
            points_possible: keyItem.points || 1,
            points_earned: result.pointsEarned,
            is_correct: result.isCorrect,
            confidence: result.confidence,
            needs_review: result.needsReview,
          })

          totalEarned += result.pointsEarned
          totalPossible += (keyItem.points || 1)
        }

        const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0

        // Find or create student record
        let studentId: string | null = null
        if (studentName) {
          const nameParts = studentName.trim().split(/\s+/)
          const firstName = nameParts[0] || ''
          const lastName = nameParts.slice(1).join(' ') || firstName

          // Check if student exists
          const { data: existingStudent } = await supabase
            .from('students')
            .select('id')
            .eq('user_id', user.id)
            .eq('first_name', firstName)
            .eq('last_name', lastName)
            .single()

          if (existingStudent) {
            studentId = existingStudent.id
          } else {
            // Create new student
            const { data: newStudent } = await supabase
              .from('students')
              .insert({
                user_id: user.id,
                first_name: firstName,
                last_name: lastName,
              })
              .select()
              .single()

            if (newStudent) {
              studentId = newStudent.id
            }
          }
        }

        // Create grade record
        const { data: grade, error: gradeError } = await supabase
          .from('grades')
          .insert({
            user_id: user.id,
            student_id: studentId,
            assignment_id: assignmentId,
            document_id: doc?.id,
            answer_key_id: answerKeyId,
            total_points: totalPossible,
            earned_points: totalEarned,
            percentage,
            per_question: questionGrades,
            status: 'draft',
          })
          .select()
          .single()

        if (gradeError) {
          console.error('Grade insert error:', gradeError)
          send({ error: 'Failed to save grade' })
          controller.close()
          return
        }

        // Create question grades
        const questionGradesToInsert = questionGrades.map((qg) => ({
          grade_id: grade.id,
          question_number: qg.question_number,
          student_answer: qg.student_answer,
          correct_answer: qg.correct_answer,
          points_possible: qg.points_possible,
          points_earned: qg.points_earned,
          is_correct: qg.is_correct,
          confidence: qg.confidence,
          needs_review: qg.needs_review,
        }))

        await supabase.from('question_grades').insert(questionGradesToInsert)

        send({ progress: { current: 3, total: 3, message: 'Complete!' } })
        send({
          result: {
            gradeId: grade.id,
            score: totalEarned,
            totalPoints: totalPossible,
            percentage,
            needsReview: questionGrades.filter((q) => q.needs_review).length,
          },
        })
      } catch (error) {
        console.error('Grading error:', error)
        send({ error: error instanceof Error ? error.message : 'Grading failed' })
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
 * Extract student answers from OCR text
 */
function extractStudentAnswers(text: string, expectedCount: number): Record<number, string> {
  const answers: Record<number, string> = {}
  const lines = text.split('\n').filter((line) => line.trim())

  console.log('OCR Text for grading:', text.substring(0, 500))
  console.log('Expected count:', expectedCount)

  // Patterns to match question-answer pairs (in order of specificity)
  const patterns = [
    // "1. A" or "1) A" or "1: A" or "1 A" (multiple choice)
    /^(\d+)[.\)\s:\-]*([A-Ea-e])(?:\s|$|[.\)])/i,
    // "1. True" or "1. False" or variations
    /^(\d+)[.\)\s:\-]*(true|false|t|f|yes|no)(?:\s|$)/i,
    // "Q1: A" or "#1 A"
    /^[Qq#]?(\d+)[.\)\s:\-]+([A-Ea-e])(?:\s|$)/i,
    // "1 = A" or "1 - A"
    /^(\d+)\s*[=\-]\s*([A-Ea-e])(?:\s|$)/i,
    // Number followed by circled/marked letter - "1 ⓐ" or "1 (A)"
    /^(\d+)[.\)\s:\-]*\(?([A-Ea-e])\)?(?:\s|$)/i,
    // "1. answer text" (more general - match last)
    /^(\d+)[.\)\s:\-]+(.+)$/,
    // "Q1: answer"
    /^[Qq#](\d+)[.\)\s:\-]+(.+)$/,
  ]

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip very long lines (likely not answer lines)
    if (trimmed.length > 100) continue

    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        const questionNum = parseInt(match[1])
        let answerText = match[2].trim()

        // Normalize single letter answers to uppercase
        if (/^[a-eA-E]$/.test(answerText)) {
          answerText = answerText.toUpperCase()
        }

        if (questionNum > 0 && questionNum <= 200 && answerText) {
          // Don't overwrite if we already have an answer for this question
          if (!answers[questionNum]) {
            answers[questionNum] = answerText
            console.log(`Found answer for Q${questionNum}: "${answerText}" from line: "${trimmed}"`)
          }
        }
        break
      }
    }
  }

  console.log('Initially extracted answers:', Object.keys(answers).length)

  // If we found very few answers, try alternative parsing
  if (Object.keys(answers).length < expectedCount / 2) {
    console.log('Trying alternative parsing...')

    // Look for lines with just a number and letter close together
    const allText = text.replace(/\n/g, ' ')

    // Pattern: number followed soon by a single letter
    const simplePattern = /(\d+)\s*[.\)\:\-]?\s*([A-Ea-e])(?:\s|[.\)\,]|$)/gi
    let simpleMatch
    while ((simpleMatch = simplePattern.exec(allText)) !== null) {
      const questionNum = parseInt(simpleMatch[1])
      const answerText = simpleMatch[2].toUpperCase()

      if (questionNum > 0 && questionNum <= expectedCount && !answers[questionNum]) {
        answers[questionNum] = answerText
        console.log(`Alt parse found Q${questionNum}: "${answerText}"`)
      }
    }
  }

  // Last resort: Look for sequential standalone letters
  if (Object.keys(answers).length < expectedCount / 3) {
    console.log('Trying letter sequence parsing...')

    // Find all standalone letters A-E (likely answers)
    const letterMatches = text.match(/(?:^|[\s\n\r.,;:()])\s*([A-Ea-e])\s*(?:$|[\s\n\r.,;:()])/gm)
    if (letterMatches && letterMatches.length >= expectedCount * 0.5) {
      const cleanLetters = letterMatches.map(m => m.trim().toUpperCase())
      cleanLetters.slice(0, expectedCount).forEach((letter, index) => {
        if (!answers[index + 1] && /^[A-E]$/.test(letter)) {
          answers[index + 1] = letter
          console.log(`Sequential letter Q${index + 1}: "${letter}"`)
        }
      })
    }
  }

  console.log('Final extracted answers:', answers)
  return answers
}
