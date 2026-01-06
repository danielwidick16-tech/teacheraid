'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Assignment, AnswerKey } from '@/types/database'

interface AssignmentWithKey extends Assignment {
  answer_keys?: AnswerKey[]
}

export default function GradeAssignmentsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<AssignmentWithKey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAssignments() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('assignments')
        .select('*, answer_keys(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Filter to only show assignments with active answer keys
      const withKeys = (data || []).filter((a: AssignmentWithKey) =>
        a.answer_keys?.some((k: AnswerKey) => k.is_active)
      )

      setAssignments(withKeys)
      setLoading(false)
    }

    loadAssignments()
  }, [])

  const handleStartGrading = async (assignmentId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create grading session
    const { data: session, error } = await supabase
      .from('scanner_sessions')
      .insert({
        user_id: user.id,
        mode: 'grade',
        assignment_id: assignmentId,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create session:', error)
      return
    }

    router.push(`/scanner/grade/${session.id}`)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/scanner" className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-flex items-center">
          <BackIcon className="w-4 h-4 mr-1" />
          Back to Scanner
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Grade Assignments</h1>
        <p className="text-gray-600">Select an assignment to start grading student work</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <KeyIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-medium mb-1">No assignments ready for grading</h3>
            <p className="text-gray-500 text-sm mb-4">
              Create an answer key for an assignment first
            </p>
            <Link href="/scanner/key">
              <Button>Create Answer Key</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const activeKey = assignment.answer_keys?.find((k: AnswerKey) => k.is_active)

            return (
              <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckIcon className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{assignment.title}</div>
                        <div className="text-sm text-gray-500">
                          {assignment.subject && `${assignment.subject} • `}
                          {activeKey?.total_points || assignment.total_points} points
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleStartGrading(assignment.id)}>
                      Start Grading
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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
