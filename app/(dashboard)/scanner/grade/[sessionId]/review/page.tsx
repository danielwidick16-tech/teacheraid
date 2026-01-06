'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Assignment, Grade, QuestionGrade } from '@/types/database'

interface GradeWithDetails extends Grade {
  question_grades?: QuestionGrade[]
  studentName?: string
}

export default function ReviewGradesPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [grades, setGrades] = useState<GradeWithDetails[]>([])
  const [selectedGrade, setSelectedGrade] = useState<GradeWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function loadGrades() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load session to get assignment
      const { data: sessionData } = await supabase
        .from('scanner_sessions')
        .select('*, assignment:assignments(*)')
        .eq('id', sessionId)
        .single()

      if (sessionData?.assignment) {
        setAssignment(sessionData.assignment)
      }

      // Load grades for this session's documents
      const { data: documents } = await supabase
        .from('scanned_documents')
        .select('id')
        .eq('session_id', sessionId)

      const documentIds = documents?.map((d: { id: string }) => d.id) || []

      if (documentIds.length === 0) {
        setGrades([])
        setLoading(false)
        return
      }

      // Load grades with student info
      const { data: gradesData } = await supabase
        .from('grades')
        .select('*, question_grades(*)')
        .eq('user_id', user.id)
        .in('document_id', documentIds)
        .order('created_at', { ascending: false })

      // Load student names separately
      const studentIds = (gradesData || [])
        .map((g) => g.student_id)
        .filter((id): id is string => id !== null)

      let studentsMap: Record<string, { first_name: string; last_name: string }> = {}
      if (studentIds.length > 0) {
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .in('id', studentIds)

        studentsMap = (studentsData || []).reduce((acc, s) => {
          acc[s.id] = { first_name: s.first_name, last_name: s.last_name }
          return acc
        }, {} as Record<string, { first_name: string; last_name: string }>)
      }

      const sessionGrades = (gradesData || []).map((g) => ({
        ...g,
        studentName: g.student_id && studentsMap[g.student_id]
          ? `${studentsMap[g.student_id].first_name} ${studentsMap[g.student_id].last_name}`
          : 'Unknown Student',
      }))

      setGrades(sessionGrades)
      setLoading(false)
    }

    loadGrades()
  }, [sessionId])

  const handleFinalize = async (gradeId: string) => {
    const supabase = createClient()

    await supabase
      .from('grades')
      .update({ status: 'finalized' })
      .eq('id', gradeId)

    setGrades((prev) =>
      prev.map((g) =>
        g.id === gradeId ? { ...g, status: 'finalized' } : g
      )
    )
  }

  const handleFinalizeAll = async () => {
    const supabase = createClient()

    const draftGrades = grades.filter((g) => g.status === 'draft')
    for (const grade of draftGrades) {
      await supabase
        .from('grades')
        .update({ status: 'finalized' })
        .eq('id', grade.id)
    }

    setGrades((prev) =>
      prev.map((g) => ({ ...g, status: 'finalized' }))
    )
  }

  const handleExportCSV = async () => {
    setExporting(true)

    try {
      const headers = ['Student', 'Score', 'Total Points', 'Percentage', 'Status']
      const rows = grades.map((g) => [
        g.studentName || 'Unknown',
        g.earned_points.toString(),
        g.total_points.toString(),
        `${g.percentage || 0}%`,
        g.status,
      ])

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${assignment?.title || 'grades'}-export.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const getGradeColor = (percentage: number | null) => {
    if (!percentage) return 'text-gray-500'
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 80) return 'text-blue-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-8 text-gray-500">Loading grades...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/scanner" className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-flex items-center">
          <BackIcon className="w-4 h-4 mr-1" />
          Back to Scanner
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Review Grades</h1>
        <p className="text-gray-600">{assignment?.title}</p>
      </div>

      {/* Summary Stats */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{grades.length}</div>
              <div className="text-sm text-gray-500">Total Papers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {grades.filter((g) => g.status === 'finalized').length}
              </div>
              <div className="text-sm text-gray-500">Finalized</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {grades.length > 0
                  ? Math.round(grades.reduce((sum, g) => sum + (g.percentage || 0), 0) / grades.length)
                  : 0}%
              </div>
              <div className="text-sm text-gray-500">Class Average</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {grades.filter((g) => (g.percentage || 0) >= 70).length}
              </div>
              <div className="text-sm text-gray-500">Passing</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <Button
          variant="outline"
          onClick={handleFinalizeAll}
          disabled={grades.every((g) => g.status === 'finalized')}
        >
          Finalize All
        </Button>
        <Button variant="outline" onClick={handleExportCSV} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Grades List */}
      {grades.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <DocumentIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-medium mb-1">No grades yet</h3>
            <p className="text-gray-500 text-sm">
              Scan some student papers to see grades here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {grades.map((grade) => (
            <Card
              key={grade.id}
              className={`cursor-pointer transition-shadow hover:shadow-md ${
                selectedGrade?.id === grade.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedGrade(selectedGrade?.id === grade.id ? null : grade)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      grade.status === 'finalized' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {grade.status === 'finalized' ? (
                        <CheckIcon className="w-5 h-5 text-green-600" />
                      ) : (
                        <PencilIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{grade.studentName}</div>
                      <div className="text-sm text-gray-500">
                        {grade.earned_points}/{grade.total_points} points
                        {grade.question_grades && (
                          <span className="ml-2">
                            ({grade.question_grades.filter((qg: QuestionGrade) => qg.needs_review).length} need review)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-bold ${getGradeColor(grade.percentage)}`}>
                      {grade.percentage}%
                    </div>
                    {grade.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFinalize(grade.id)
                        }}
                      >
                        Finalize
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedGrade?.id === grade.id && grade.question_grades && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Question Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {grade.question_grades.map((qg: QuestionGrade) => (
                        <div
                          key={qg.id}
                          className={`p-2 rounded-lg text-sm ${
                            qg.is_correct
                              ? 'bg-green-50 text-green-700'
                              : qg.needs_review
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          <div className="font-medium">Q{qg.question_number}</div>
                          <div className="text-xs">
                            {qg.points_earned}/{qg.points_possible}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
