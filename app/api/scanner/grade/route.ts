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

interface AnswerKeyItem {
  id: string
  question_number: number
  correct_answer: string
  accepted_variants: string[]
  points: number
  question_type: string | null
}

interface ExtractedStudentAnswer {
  question_number: number
  student_answer: string
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

        send({ progress: { current: 0, total: 4, message: 'Loading answer key...' } })

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

        send({ progress: { current: 1, total: 4, message: 'Processing student paper...' } })

        // Download images and convert to base64
        const imageBase64List: string[] = []
        let fullOcrText = ''

        const visionClient = getVisionClient()

        for (const imagePath of imagePaths) {
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('scanned-documents')
            .download(imagePath)

          if (downloadError) continue

          const arrayBuffer = await imageData.arrayBuffer()
          const base64Image = Buffer.from(arrayBuffer).toString('base64')
          imageBase64List.push(base64Image)

          // Also get OCR text for reference
          const [result] = await visionClient.documentTextDetection({
            image: { content: base64Image },
          })
          fullOcrText += (result.fullTextAnnotation?.text || '') + '\n'
        }

        if (imageBase64List.length === 0) {
          send({ error: 'Failed to process images' })
          controller.close()
          return
        }

        send({ progress: { current: 2, total: 4, message: 'AI grading student answers...' } })

        // Build answer key summary for AI
        const answerKeySummary = (keyItems as AnswerKeyItem[]).map(item =>
          `Q${item.question_number}: ${item.correct_answer}${item.accepted_variants?.length ? ` (also accept: ${item.accepted_variants.join(', ')})` : ''}`
        ).join('\n')

        // Use Claude to extract and grade student answers from images
        const anthropic = getAnthropicClient()

        const content: Anthropic.MessageCreateParams['messages'][0]['content'] = []

        // Add images
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

        // Add the grading prompt - DON'T show answer key to avoid confusion
        content.push({
          type: 'text',
          text: `You are analyzing a student's completed test/quiz paper. Your ONLY job is to identify what answer the student selected or wrote for each question.

Look for the student's answers which may appear as:
- A letter circled in RED PEN or pencil (A, B, C, D, E)
- A letter written next to or near the question number
- A filled-in bubble or checkbox
- Handwritten text in a blank space
- An "X" or checkmark next to an answer choice
- Any marking that indicates the student's selection

The test has ${keyItems.length} questions numbered 1 through ${keyItems.length}.

IMPORTANT:
- Look for RED PEN marks - the student uses red pen to mark answers
- Ignore the printed answer choices - only report what the student MARKED/SELECTED
- The student's marking indicates their chosen answer

For each question, report ONLY what the student marked. Respond with JSON:
[
  {"question_number": 1, "student_answer": "B"},
  {"question_number": 2, "student_answer": "A"},
  {"question_number": 3, "student_answer": "C"}
]

Rules:
- Report the letter or text the student marked/wrote
- Use "?" if the student left it blank or you can't determine their answer
- Include all ${keyItems.length} questions
- Return ONLY the JSON array, no explanation`,
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

        // Parse AI response
        const responseText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('')

        let extractedAnswers: Array<{ question_number: number; student_answer: string }> = []
        try {
          const jsonMatch = responseText.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            extractedAnswers = JSON.parse(jsonMatch[0])
          }
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError)
          console.log('Raw response:', responseText)
          send({ error: 'Failed to parse AI results' })
          controller.close()
          return
        }

        console.log('AI extracted answers:', extractedAnswers)

        send({ progress: { current: 3, total: 4, message: 'Comparing to answer key...' } })

        // Build question grades by comparing extracted answers to answer key
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
          const extracted = extractedAnswers.find(a => a.question_number === keyItem.question_number)
          const studentAnswer = extracted?.student_answer?.trim() || '?'

          // Compare student answer to correct answer (case-insensitive)
          const normalizedStudent = studentAnswer.toLowerCase().trim()
          const normalizedCorrect = keyItem.correct_answer.toLowerCase().trim()

          // Check if correct - also check accepted variants
          let isCorrect = normalizedStudent === normalizedCorrect
          if (!isCorrect && Array.isArray(keyItem.accepted_variants)) {
            isCorrect = keyItem.accepted_variants.some(
              v => v.toLowerCase().trim() === normalizedStudent
            )
          }

          // Special handling for true/false
          if (!isCorrect) {
            const trueVariants = ['true', 't', 'yes', 'y']
            const falseVariants = ['false', 'f', 'no', 'n']
            if (trueVariants.includes(normalizedCorrect) && trueVariants.includes(normalizedStudent)) {
              isCorrect = true
            }
            if (falseVariants.includes(normalizedCorrect) && falseVariants.includes(normalizedStudent)) {
              isCorrect = true
            }
          }

          const pointsEarned = isCorrect ? (keyItem.points || 1) : 0
          const needsReview = studentAnswer === '?'

          console.log(`Q${keyItem.question_number}: Student="${studentAnswer}" Correct="${keyItem.correct_answer}" Match=${isCorrect}`)

          questionGrades.push({
            question_number: keyItem.question_number,
            student_answer: studentAnswer,
            correct_answer: keyItem.correct_answer,
            points_possible: keyItem.points || 1,
            points_earned: pointsEarned,
            is_correct: isCorrect,
            confidence: extracted ? 0.9 : 0.5,
            needs_review: needsReview,
          })

          totalEarned += pointsEarned
          totalPossible += (keyItem.points || 1)
        }

        const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0

        // Create scanned document record
        const { data: doc, error: docError } = await supabase
          .from('scanned_documents')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            assignment_id: assignmentId,
            pages: JSON.parse(JSON.stringify(imagePaths.map((path: string, index: number) => ({
              path,
              page_number: index + 1,
            })))),
            ocr_raw: JSON.parse(JSON.stringify({ text: fullOcrText, ai_extracted: extractedAnswers })),
            status: 'completed',
          })
          .select()
          .single()

        if (docError) {
          console.error('Document insert error:', docError)
        }

        // Find or create student record
        let studentId: string | null = null
        if (studentName) {
          const nameParts = studentName.trim().split(/\s+/)
          const firstName = nameParts[0] || ''
          const lastName = nameParts.slice(1).join(' ') || firstName

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
            per_question: JSON.parse(JSON.stringify(questionGrades)),
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

        send({ progress: { current: 4, total: 4, message: 'Complete!' } })
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
