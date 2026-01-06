import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import Anthropic from '@anthropic-ai/sdk'

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

// Initialize Anthropic client
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set')
  }

  return new Anthropic({ apiKey })
}

interface GeneratedAnswer {
  question_number: number
  answer: string
  question_type: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown'
  confidence: number
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

        const { imagePaths, sessionId, assignmentId } = await req.json()

        if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
          send({ error: 'No images provided' })
          controller.close()
          return
        }

        send({ progress: { current: 1, total: 4, message: 'Processing images with OCR...' } })

        // Process images with Vision API to get text
        const visionClient = getVisionClient()
        let fullOcrText = ''
        const imageBase64List: string[] = []

        for (let i = 0; i < imagePaths.length; i++) {
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('scanned-documents')
            .download(imagePaths[i])

          if (downloadError) {
            console.error('Download error:', downloadError)
            continue
          }

          const arrayBuffer = await imageData.arrayBuffer()
          const base64Image = Buffer.from(arrayBuffer).toString('base64')
          imageBase64List.push(base64Image)

          // Run OCR
          const [result] = await visionClient.documentTextDetection({
            image: { content: base64Image },
          })

          fullOcrText += (result.fullTextAnnotation?.text || '') + '\n\n'
        }

        send({ progress: { current: 2, total: 4, message: 'Analyzing test questions...' } })

        // Use Claude to analyze the test and generate answers
        const anthropic = getAnthropicClient()

        send({ progress: { current: 3, total: 4, message: 'AI generating correct answers...' } })

        // Build the message with images and OCR text
        const content: Anthropic.MessageCreateParams['messages'][0]['content'] = []

        // Add images for visual context
        for (const base64 of imageBase64List) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64,
            },
          })
        }

        // Add the prompt
        content.push({
          type: 'text',
          text: `You are an expert teacher assistant. Analyze this test/quiz and generate the correct answers for each question.

OCR Text from the test:
${fullOcrText}

Instructions:
1. Identify each numbered question in the test
2. Determine the correct answer for each question
3. Classify each question type as: multiple_choice, true_false, fill_in, short_answer, or math

For multiple choice questions, provide only the letter (A, B, C, D, or E).
For true/false, answer "True" or "False".
For fill-in-the-blank, provide the correct word or phrase.
For short answer, provide a concise correct answer.
For math, provide the numerical answer.

Respond ONLY with a valid JSON array in this exact format:
[
  {"question_number": 1, "answer": "A", "question_type": "multiple_choice"},
  {"question_number": 2, "answer": "True", "question_type": "true_false"},
  {"question_number": 3, "answer": "42", "question_type": "math"}
]

Important:
- Include ALL questions you can identify
- Be confident in your answers - you are generating an answer key
- If you cannot determine the answer, use your best judgment based on the question content
- Return ONLY the JSON array, no other text`,
        })

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content,
            },
          ],
        })

        // Parse the response
        const responseText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('')

        // Extract JSON from response
        let answers: GeneratedAnswer[] = []
        try {
          // Try to find JSON array in the response
          const jsonMatch = responseText.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            answers = parsed.map((item: { question_number: number; answer: string; question_type?: string }) => ({
              question_number: item.question_number,
              answer: item.answer,
              question_type: item.question_type || 'unknown',
              confidence: 0.9, // AI-generated answers have high confidence
            }))
          }
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError)
          console.log('Raw response:', responseText)
          send({ error: 'Failed to parse AI-generated answers' })
          controller.close()
          return
        }

        if (answers.length === 0) {
          send({ error: 'No questions could be identified in the test image' })
          controller.close()
          return
        }

        // Sort by question number
        answers.sort((a, b) => a.question_number - b.question_number)

        // Store OCR data in scanned document
        const ocrRawData = JSON.parse(JSON.stringify({
          text: fullOcrText,
          ai_generated_answers: answers,
        }))

        const pagesData = JSON.parse(JSON.stringify(
          imagePaths.map((path: string, index: number) => ({
            path,
            page_number: index + 1,
          }))
        ))

        const { error: docError } = await supabase
          .from('scanned_documents')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            assignment_id: assignmentId,
            pages: pagesData,
            ocr_raw: ocrRawData,
            status: 'completed',
          })

        if (docError) {
          console.error('Document insert error:', docError)
        }

        send({ progress: { current: 4, total: 4, message: 'Complete!' } })
        send({ answers })
      } catch (error) {
        console.error('AI generation error:', error)
        send({ error: error instanceof Error ? error.message : 'AI generation failed' })
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
