'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CameraCapture } from '@/components/scan/camera-capture'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Assignment, ScannerSession, AnswerKey, Student } from '@/types/database'

interface ScannedPaper {
  id: string
  studentName: string
  studentId?: string
  pages: string[]
  status: 'pending' | 'processing' | 'graded' | 'error'
  score?: number
  totalPoints?: number
}

export default function GradingSessionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<ScannerSession | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [answerKey, setAnswerKey] = useState<AnswerKey | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [scannedPapers, setScannedPapers] = useState<ScannedPaper[]>([])
  const [currentStudent, setCurrentStudent] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ message: '', current: 0, total: 0 })

  useEffect(() => {
    async function loadSession() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load session
      const { data: sessionData } = await supabase
        .from('scanner_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (!sessionData) {
        router.push('/scanner/grade')
        return
      }

      setSession(sessionData)

      // Load assignment
      if (sessionData.assignment_id) {
        const { data: assignmentData } = await supabase
          .from('assignments')
          .select('*')
          .eq('id', sessionData.assignment_id)
          .single()

        if (assignmentData) {
          setAssignment(assignmentData)

          // Load answer key
          const { data: keyData } = await supabase
            .from('answer_keys')
            .select('*')
            .eq('assignment_id', assignmentData.id)
            .eq('is_active', true)
            .single()

          if (keyData) {
            setAnswerKey(keyData)
          }
        }
      }

      // Load students
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .order('last_name')

      setStudents(studentsData || [])
      setLoading(false)
    }

    loadSession()
  }, [sessionId, router])

  const handleCapture = useCallback(async (files: File[]) => {
    if (!currentStudent.trim()) {
      alert('Please enter a student name')
      return
    }

    setProcessing(true)
    setProgress({ message: 'Uploading images...', current: 0, total: files.length })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Upload images
      const imagePaths: string[] = []
      for (let i = 0; i < files.length; i++) {
        setProgress({ message: `Uploading page ${i + 1}...`, current: i + 1, total: files.length })

        const file = files[i]
        const path = `${user.id}/grades/${sessionId}/${Date.now()}-${i}.jpg`

        const { error: uploadError } = await supabase.storage
          .from('scanned-documents')
          .upload(path, file)

        if (uploadError) throw uploadError
        imagePaths.push(path)
      }

      // Add to scanned papers list (pending processing)
      const newPaper: ScannedPaper = {
        id: `paper-${Date.now()}`,
        studentName: currentStudent,
        pages: imagePaths,
        status: 'pending',
      }

      setScannedPapers((prev) => [...prev, newPaper])
      setCurrentStudent('')

      // Process the paper
      setProgress({ message: 'Processing with OCR...', current: 0, total: 1 })

      const response = await fetch('/api/scanner/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          assignmentId: assignment?.id,
          answerKeyId: answerKey?.id,
          studentName: currentStudent,
          imagePaths,
        }),
      })

      if (!response.ok) {
        throw new Error('Grading failed')
      }

      // Handle SSE stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let gradeResult: { score: number; totalPoints: number; gradeId: string } | null = null

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
                    message: data.progress.message,
                    current: data.progress.current,
                    total: data.progress.total,
                  })
                } else if (data.result) {
                  gradeResult = data.result
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

      // Update paper status
      setScannedPapers((prev) =>
        prev.map((p) =>
          p.id === newPaper.id
            ? {
                ...p,
                status: 'graded' as const,
                score: gradeResult?.score,
                totalPoints: gradeResult?.totalPoints,
              }
            : p
        )
      )
    } catch (err) {
      console.error('Processing error:', err)
      setScannedPapers((prev) =>
        prev.map((p) =>
          p.studentName === currentStudent && p.status === 'pending'
            ? { ...p, status: 'error' as const }
            : p
        )
      )
    } finally {
      setProcessing(false)
    }
  }, [currentStudent, sessionId, assignment, answerKey])

  const handleFinishSession = async () => {
    const supabase = createClient()

    await supabase
      .from('scanner_sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId)

    router.push(`/scanner/grade/${sessionId}/review`)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-8 text-gray-500">Loading session...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/scanner/grade" className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-flex items-center">
          <BackIcon className="w-4 h-4 mr-1" />
          Back to Assignments
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Grading Session</h1>
        <p className="text-gray-600">{assignment?.title}</p>
      </div>

      {/* Session Stats */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{scannedPapers.length}</div>
              <div className="text-sm text-gray-500">Scanned</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {scannedPapers.filter((p) => p.status === 'graded').length}
              </div>
              <div className="text-sm text-gray-500">Graded</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {answerKey?.total_points || assignment?.total_points || 0}
              </div>
              <div className="text-sm text-gray-500">Total Points</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Name Input */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentStudent}
              onChange={(e) => setCurrentStudent(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
              placeholder="Enter student name"
              list="students-list"
              disabled={processing}
            />
          </div>
          <datalist id="students-list">
            {students.map((s) => (
              <option key={s.id} value={`${s.first_name} ${s.last_name}`} />
            ))}
          </datalist>
        </CardContent>
      </Card>

      {/* Camera Capture */}
      {processing ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processing</h3>
            <p className="text-gray-500">{progress.message}</p>
            {progress.total > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="mb-6">
          <CameraCapture onCapture={handleCapture} maxFiles={5} />
        </div>
      )}

      {/* Scanned Papers List */}
      {scannedPapers.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Scanned Papers</h2>
          <div className="space-y-2">
            {scannedPapers.map((paper) => (
              <Card key={paper.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      paper.status === 'graded'
                        ? 'bg-green-100'
                        : paper.status === 'error'
                        ? 'bg-red-100'
                        : 'bg-gray-100'
                    }`}>
                      {paper.status === 'graded' ? (
                        <CheckIcon className="w-5 h-5 text-green-600" />
                      ) : paper.status === 'error' ? (
                        <XIcon className="w-5 h-5 text-red-600" />
                      ) : (
                        <ClockIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{paper.studentName}</div>
                      <div className="text-sm text-gray-500">
                        {paper.status === 'graded' && paper.score !== undefined
                          ? `${paper.score}/${paper.totalPoints} points`
                          : paper.status === 'error'
                          ? 'Processing failed'
                          : 'Pending'}
                      </div>
                    </div>
                  </div>
                  {paper.status === 'graded' && (
                    <div className="text-lg font-bold text-gray-900">
                      {Math.round(((paper.score || 0) / (paper.totalPoints || 1)) * 100)}%
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {scannedPapers.length > 0 && (
        <div className="mt-6 flex gap-3">
          <Button onClick={handleFinishSession} className="flex-1">
            Finish & Review Grades
          </Button>
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
