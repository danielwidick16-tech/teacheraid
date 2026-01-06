'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import type { Assignment, ScannerSession, Grade } from '@/types/database'

interface SessionWithAssignment {
  id: string
  user_id: string
  mode: 'grade' | 'key'
  assignment_id: string | null
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  assignment: Assignment | null
}

interface Stats {
  totalAssignments: number
  totalGraded: number
  pendingReview: number
  recentSessions: SessionWithAssignment[]
}

export default function ScannerPage() {
  const [stats, setStats] = useState<Stats>({
    totalAssignments: 0,
    totalGraded: 0,
    pendingReview: 0,
    recentSessions: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      try {
        const [assignmentsRes, gradesRes, sessionsRes] = await Promise.all([
          supabase.from('assignments').select('id', { count: 'exact' }).eq('user_id', user.id),
          supabase.from('grades').select('id, status', { count: 'exact' }).eq('user_id', user.id),
          supabase
            .from('scanner_sessions')
            .select('*, assignment:assignments(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        const grades = gradesRes.data || []
        const pendingCount = grades.filter((g: { status: string }) => g.status === 'draft').length

        setStats({
          totalAssignments: assignmentsRes.count || 0,
          totalGraded: gradesRes.count || 0,
          pendingReview: pendingCount,
          recentSessions: sessionsRes.data || [],
        })
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scanner Mode</h1>
        <p className="text-gray-600">Grade assignments and create answer keys by scanning student work</p>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link href="/scanner/grade">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <GradeIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Grade Assignments</h2>
                  <p className="text-sm text-gray-600">
                    Scan student work and automatically grade against an answer key
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                Start grading
                <ArrowRightIcon className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/scanner/key">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-500">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <KeyIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Create Answer Key</h2>
                  <p className="text-sm text-gray-600">
                    Scan your answer key to set up automatic grading
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center text-green-600 text-sm font-medium">
                Create key
                <ArrowRightIcon className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {loading ? '-' : stats.totalAssignments}
            </div>
            <div className="text-sm text-gray-500">Assignments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {loading ? '-' : stats.totalGraded}
            </div>
            <div className="text-sm text-gray-500">Papers Graded</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {loading ? '-' : stats.pendingReview}
            </div>
            <div className="text-sm text-gray-500">Pending Review</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Sessions</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : stats.recentSessions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <ScanIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 font-medium mb-1">No scanning sessions yet</h3>
              <p className="text-gray-500 text-sm">
                Start by creating an answer key or grading some assignments
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.recentSessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      session.mode === 'grade' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {session.mode === 'grade' ? (
                        <GradeIcon className={`w-5 h-5 text-blue-600`} />
                      ) : (
                        <KeyIcon className={`w-5 h-5 text-green-600`} />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {session.mode === 'grade' ? 'Grading Session' : 'Answer Key'}
                        {session.assignment && `: ${session.assignment.title}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(session.created_at).toLocaleDateString()}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                          session.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : session.status === 'active'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ArrowRightIcon className="w-5 h-5 text-gray-400" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Icons
function GradeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
