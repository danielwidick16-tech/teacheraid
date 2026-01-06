import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { gradeQuestion, detectQuestionType, type QuestionType } from '@/lib/scanner/grading'

// Initialize Vision client
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

  // Patterns to match question-answer pairs
  const patterns = [
    // "1. A" or "1) A" or "1: A"
    /^(\d+)[.\):\s]+([A-Ea-e])\s*$/,
    // "1. True" or "1. False"
    /^(\d+)[.\):\s]+(true|false|t|f|yes|no)\s*$/i,
    // "1. answer text"
    /^(\d+)[.\):\s]+(.+)$/,
    // "Q1: answer"
    /^[Qq](\d+)[.\):\s]+(.+)$/,
    // "1 = A" or "1 - A"
    /^(\d+)\s*[=\-]\s*([A-Ea-e])\s*$/,
    // Just "1 A"
    /^(\d+)\s+([A-Ea-e])\s*$/,
  ]

  for (const line of lines) {
    const trimmed = line.trim()

    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        const questionNum = parseInt(match[1])
        const answerText = match[2].trim()

        if (questionNum > 0 && questionNum <= 200 && answerText) {
          answers[questionNum] = answerText
        }
        break
      }
    }
  }

  // If we found very few answers, try alternative parsing
  if (Object.keys(answers).length < expectedCount / 2) {
    // Look for standalone letters that might be answers
    const letterMatches = text.match(/\b[A-Ea-e]\b/g)
    if (letterMatches && letterMatches.length >= expectedCount * 0.5) {
      // Assume sequential answers
      letterMatches.slice(0, expectedCount).forEach((letter, index) => {
        if (!answers[index + 1]) {
          answers[index + 1] = letter.toUpperCase()
        }
      })
    }
  }

  return answers
}
