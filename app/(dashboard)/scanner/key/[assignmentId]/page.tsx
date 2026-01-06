'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CameraCapture } from '@/components/scan/camera-capture'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Assignment, AnswerKey } from '@/types/database'

type Step = 'choose' | 'capture' | 'processing' | 'review' | 'manual' | 'generate' | 'generating'

interface ExtractedAnswer {
  question_number: number
  answer: string
  question_type: 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown'
  confidence: number
}

function detectAnswerType(answer: string): ExtractedAnswer['question_type'] {
  const normalized = answer.trim().toLowerCase()

  // Single letter A-E = multiple choice
  if (/^[a-e]$/i.test(normalized)) {
    return 'multiple_choice'
  }

  // True/False variants
  if (['true', 'false', 't', 'f', 'yes', 'no'].includes(normalized)) {
    return 'true_false'
  }

  // Numeric = math
  if (/^-?\d+\.?\d*$/.test(normalized)) {
    return 'math'
  }

  // Short text = fill in
  if (normalized.split(/\s+/).length <= 3) {
    return 'fill_in'
  }

  return 'short_answer'
}

export default function ScanKeyPage() {
  const router = useRouter()
  const params = useParams()
  const assignmentId = params.assignmentId as string

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [existingKey, setExistingKey] = useState<AnswerKey | null>(null)
  const [step, setStep] = useState<Step>('choose')
  const [manualAnswers, setManualAnswers] = useState('')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' })
  const [extractedAnswers, setExtractedAnswers] = useState<ExtractedAnswer[]>([])
  const [rawOcrText, setRawOcrText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAssignment() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: assignmentData } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .eq('user_id', user.id)
        .single()

      if (assignmentData) {
        setAssignment(assignmentData)

        const { data: keyData } = await supabase
          .from('answer_keys')
          .select('*')
          .eq('assignment_id', assignmentId)
          .eq('is_active', true)
          .single()

        if (keyData) {
          setExistingKey(keyData)
        }
      }
    }

    loadAssignment()
  }, [assignmentId])

  const handleCapture = useCallback(async (files: File[]) => {
    setStep('processing')
    setProcessing(true)
    setError(null)
    setProgress({ current: 0, total: files.length, message: 'Uploading images...' })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Please sign in to continue')
      setStep('capture')
      setProcessing(false)
      return
    }

    try {
      // Create scanner session
      const { data: session, error: sessionError } = await supabase
        .from('scanner_sessions')
        .insert({
          user_id: user.id,
          mode: 'key',
          assignment_id: assignmentId,
          status: 'active',
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Upload images
      const imagePaths: string[] = []
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length, message: `Uploading page ${i + 1}...` })

        const file = files[i]
        const path = `${user.id}/keys/${session.id}/${Date.now()}-${i}.jpg`

        const { error: uploadError } = await supabase.storage
          .from('scanned-documents')
          .upload(path, file)

        if (uploadError) throw uploadError
        imagePaths.push(path)
      }

      // Process with OCR
      setProgress({ current: 0, total: files.length, message: 'Processing with OCR...' })

      const response = await fetch('/api/scanner/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePaths,
          sessionId: session.id,
          mode: 'key',
        }),
      })

      if (!response.ok) {
        throw new Error('OCR processing failed')
      }

      // Handle SSE stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let answers: ExtractedAnswer[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.progress) {
                  setProgress({
                    current: data.progress.current,
                    total: data.progress.total,
                    message: data.progress.message,
                  })
                } else if (data.answers) {
                  answers = data.answers
                  if (data.rawText) {
                    setRawOcrText(data.rawText)
                  }
                } else if (data.error) {
                  throw new Error(data.error)
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Update session status
      await supabase
        .from('scanner_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id)

      setExtractedAnswers(answers)
      setStep('review')
    } catch (err) {
      console.error('Processing error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('capture')
    } finally {
      setProcessing(false)
    }
  }, [assignmentId])

  const handleGenerateCapture = useCallback(async (files: File[]) => {
    setStep('generating')
    setProcessing(true)
    setError(null)
    setProgress({ current: 0, total: 3, message: 'Uploading test images...' })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Please sign in to continue')
      setStep('generate')
      setProcessing(false)
      return
    }

    try {
      // Create scanner session
      const { data: session, error: sessionError } = await supabase
        .from('scanner_sessions')
        .insert({
          user_id: user.id,
          mode: 'key',
          assignment_id: assignmentId,
          status: 'active',
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Upload images
      const imagePaths: string[] = []
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: 1, total: 3, message: `Uploading page ${i + 1} of ${files.length}...` })

        const file = files[i]
        const path = `${user.id}/keys/${session.id}/${Date.now()}-${i}.jpg`

        const { error: uploadError } = await supabase.storage
          .from('scanned-documents')
          .upload(path, file)

        if (uploadError) throw uploadError
        imagePaths.push(path)
      }

      setProgress({ current: 2, total: 3, message: 'AI analyzing test questions...' })

      // Call AI generation API
      const response = await fetch('/api/scanner/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePaths,
          sessionId: session.id,
          assignmentId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'AI generation failed')
      }

      // Handle SSE stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let answers: ExtractedAnswer[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.progress) {
                  setProgress({
                    current: data.progress.current,
                    total: data.progress.total,
                    message: data.progress.message,
                  })
                } else if (data.answers) {
                  answers = data.answers
                } else if (data.error) {
                  setError(data.error)
                  setStep('generate')
                  return
                }
              } catch (e) {
                // Skip invalid JSON (not an error from the server)
              }
            }
          }
        }
      }

      // Update session status
      await supabase
        .from('scanner_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id)

      setExtractedAnswers(answers)
      setStep('review')
    } catch (err) {
      console.error('AI generation error:', err)
      setError(err instanceof Error ? err.message : 'AI generation failed')
      setStep('generate')
    } finally {
      setProcessing(false)
    }
  }, [assignmentId])

  const handleSaveKey = async (answers: ExtractedAnswer[]) => {
    setProcessing(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Deactivate existing keys
      await supabase
        .from('answer_keys')
        .update({ is_active: false })
        .eq('assignment_id', assignmentId)

      // Calculate total points
      const totalPoints = answers.reduce((sum, a) => sum + 1, 0)

      // Create new answer key
      const { data: key, error: keyError } = await supabase
        .from('answer_keys')
        .insert({
          user_id: user.id,
          assignment_id: assignmentId,
          title: `${assignment?.title} - Answer Key`,
          source_type: 'teacher',
          total_points: totalPoints,
          is_active: true,
        })
        .select()
        .single()

      if (keyError) throw keyError

      // Create answer key items
      const items = answers.map((a) => ({
        answer_key_id: key.id,
        question_number: a.question_number,
        correct_answer: a.answer,
        question_type: a.question_type,
        points: 1,
        accepted_variants: [],
      }))

      const { error: itemsError } = await supabase
        .from('answer_key_items')
        .insert(items)

      if (itemsError) throw itemsError

      router.push(`/scanner/key/${assignmentId}/review?keyId=${key.id}`)
    } catch (err) {
      console.error('Save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save answer key')
    } finally {
      setProcessing(false)
    }
  }

  if (!assignment) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-8 text-gray-500">Loading assignment...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/scanner/key" className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-flex items-center">
          <BackIcon className="w-4 h-4 mr-1" />
          Back to Assignments
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create Answer Key</h1>
        <p className="text-gray-600">{assignment.title}</p>
      </div>

      {/* Choose method */}
      {step === 'choose' && (
        <div className="space-y-4">
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-blue-500"
            onClick={() => setStep('manual')}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <EditIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Type Answers Manually</h3>
                  <p className="text-sm text-gray-600">
                    Enter your answer key by typing each answer (recommended)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-green-500"
            onClick={() => setStep('capture')}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CameraIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Scan Answer Key</h3>
                  <p className="text-sm text-gray-600">
                    Take a photo of your printed answer key
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-purple-500"
            onClick={() => setStep('generate')}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <SparklesIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Generate from Test</h3>
                  <p className="text-sm text-gray-600">
                    Scan your test and let AI generate the correct answers
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {existingKey && step === 'choose' && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <WarningIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Existing Answer Key</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This assignment already has an answer key. Creating a new one will replace it.
              </p>
              <Link
                href={`/scanner/key/${assignmentId}/review?keyId=${existingKey.id}`}
                className="text-sm text-yellow-800 underline mt-2 inline-block"
              >
                View existing key
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry */}
      {step === 'manual' && (
        <div>
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="font-medium text-gray-900 mb-2">Instructions</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>Enter one answer per line</li>
                <li>Format: "1. A" or "1 A" or just "A" (will auto-number)</li>
                <li>Supports: A-E for multiple choice, True/False, or any text</li>
              </ul>
            </CardContent>
          </Card>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer Key
            </label>
            <textarea
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg text-base font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
              placeholder="1. A&#10;2. B&#10;3. C&#10;4. D&#10;5. True&#10;6. False&#10;7. 42&#10;8. photosynthesis"
              value={manualAnswers}
              onChange={(e) => setManualAnswers(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('choose')}>
              Back
            </Button>
            <Button
              onClick={() => {
                const lines = manualAnswers.split('\n').filter(l => l.trim())
                const parsed: ExtractedAnswer[] = []

                lines.forEach((line, index) => {
                  const trimmed = line.trim()
                  // Try to match "1. A" or "1) A" or "1 A" format
                  const numberedMatch = trimmed.match(/^(\d+)\s*[.\):\-]?\s*(.+)$/)
                  if (numberedMatch) {
                    parsed.push({
                      question_number: parseInt(numberedMatch[1]),
                      answer: numberedMatch[2].trim(),
                      question_type: detectAnswerType(numberedMatch[2].trim()),
                      confidence: 1.0,
                    })
                  } else if (trimmed) {
                    // Auto-number if no number provided
                    parsed.push({
                      question_number: index + 1,
                      answer: trimmed,
                      question_type: detectAnswerType(trimmed),
                      confidence: 1.0,
                    })
                  }
                })

                if (parsed.length > 0) {
                  setExtractedAnswers(parsed)
                  setStep('review')
                }
              }}
              disabled={!manualAnswers.trim()}
            >
              Review Answers ({manualAnswers.split('\n').filter(l => l.trim()).length})
            </Button>
          </div>
        </div>
      )}

      {existingKey && step === 'capture' && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <WarningIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Existing Answer Key</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This assignment already has an answer key. Scanning a new one will replace it.
              </p>
              <Link
                href={`/scanner/key/${assignmentId}/review?keyId=${existingKey.id}`}
                className="text-sm text-yellow-800 underline mt-2 inline-block"
              >
                View existing key
              </Link>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {step === 'capture' && (
        <div>
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="font-medium text-gray-900 mb-2">Instructions</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>1. Take clear photos of your answer key</li>
                <li>2. Make sure all answers are clearly visible</li>
                <li>3. Number each question (1, 2, 3...)</li>
                <li>4. You can capture multiple pages</li>
              </ul>
            </CardContent>
          </Card>
          <CameraCapture onCapture={handleCapture} maxFiles={10} />
        </div>
      )}

      {step === 'processing' && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Processing Answer Key
            </h3>
            <p className="text-gray-500 mb-4">{progress.message}</p>
            {progress.total > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generate from Test - Capture */}
      {step === 'generate' && (
        <div>
          <Card className="mb-4">
            <CardContent className="p-4">
              <h3 className="font-medium text-gray-900 mb-2">AI Answer Key Generation</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>1. Take clear photos of your test/quiz</li>
                <li>2. Make sure questions are clearly visible</li>
                <li>3. AI will analyze questions and generate correct answers</li>
                <li>4. Review and edit before saving</li>
              </ul>
            </CardContent>
          </Card>
          <CameraCapture onCapture={handleGenerateCapture} maxFiles={10} />
          <div className="mt-4">
            <Button variant="outline" onClick={() => setStep('choose')}>
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Generating - AI Processing */}
      {step === 'generating' && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              AI Generating Answer Key
            </h3>
            <p className="text-gray-500 mb-4">{progress.message}</p>
            {progress.total > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'review' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Extracted Answers ({extractedAnswers.length} questions)
          </h2>

          {extractedAnswers.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <WarningIcon className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-medium">No answers detected</h3>
                    <p className="text-gray-500 text-sm">
                      The OCR couldn't find numbered answers. You can add them manually below.
                    </p>
                  </div>
                </div>

                {rawOcrText && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Raw OCR Text (what we detected):
                    </label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 max-h-40 overflow-auto whitespace-pre-wrap font-mono">
                      {rawOcrText || '(No text detected)'}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter answers manually (one per line, format: "1. A" or "1 A"):
                  </label>
                  <textarea
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-base font-mono"
                    style={{ color: '#111827', backgroundColor: '#ffffff' }}
                    placeholder="1. A&#10;2. B&#10;3. C&#10;4. D"
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(l => l.trim())
                      const parsed: ExtractedAnswer[] = []
                      lines.forEach(line => {
                        const match = line.match(/^(\d+)\s*[.\):\-]?\s*(.+)$/)
                        if (match) {
                          parsed.push({
                            question_number: parseInt(match[1]),
                            answer: match[2].trim(),
                            question_type: 'multiple_choice',
                            confidence: 1.0,
                          })
                        }
                      })
                      setExtractedAnswers(parsed)
                    }}
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => setStep('capture')} variant="outline">
                    Scan Again
                  </Button>
                  {extractedAnswers.length > 0 && (
                    <Button onClick={() => handleSaveKey(extractedAnswers)}>
                      Save {extractedAnswers.length} Answers
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="space-y-2 mb-6">
                {extractedAnswers.map((answer, index) => (
                  <Card key={index}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                          {answer.question_number}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{answer.answer}</div>
                          <div className="text-xs text-gray-500">
                            {answer.question_type.replace('_', ' ')}
                            {answer.confidence < 0.8 && (
                              <span className="ml-2 text-yellow-600">Low confidence</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3">
                <Button onClick={() => handleSaveKey(extractedAnswers)} disabled={processing}>
                  {processing ? 'Saving...' : 'Save Answer Key'}
                </Button>
                <Button variant="outline" onClick={() => setStep('choose')}>
                  Start Over
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Icons
function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
