'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Assignment, AnswerKey } from '@/types/database'

export default function CreateKeyPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<(Assignment & { answer_keys?: AnswerKey[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewAssignment, setShowNewAssignment] = useState(false)
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    subject: '',
    total_points: 100,
  })
  const [creating, setCreating] = useState(false)

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

      setAssignments(data || [])
      setLoading(false)
    }

    loadAssignments()
  }, [])

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          user_id: user.id,
          title: newAssignment.title,
          subject: newAssignment.subject || null,
          total_points: newAssignment.total_points,
        })
        .select()
        .single()

      if (error) throw error

      router.push(`/scanner/key/${data.id}`)
    } catch (error) {
      console.error('Failed to create assignment:', error)
      alert('Failed to create assignment')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/scanner" className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-flex items-center">
          <BackIcon className="w-4 h-4 mr-1" />
          Back to Scanner
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create Answer Key</h1>
        <p className="text-gray-600">Select an assignment or create a new one</p>
      </div>

      {/* New Assignment Form */}
      {showNewAssignment ? (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">New Assignment</h2>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  required
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ color: '#111827', backgroundColor: '#ffffff' }}
                  placeholder="e.g., Chapter 5 Quiz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={newAssignment.subject}
                  onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ color: '#111827', backgroundColor: '#ffffff' }}
                  placeholder="e.g., Math, Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Points
                </label>
                <input
                  type="number"
                  value={newAssignment.total_points}
                  onChange={(e) => setNewAssignment({ ...newAssignment, total_points: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  style={{ color: '#111827', backgroundColor: '#ffffff' }}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create & Continue'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewAssignment(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowNewAssignment(true)} className="mb-6">
          <PlusIcon className="w-4 h-4 mr-2" />
          New Assignment
        </Button>
      )}

      {/* Existing Assignments */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Select Assignment</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <DocumentIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 font-medium mb-1">No assignments yet</h3>
              <p className="text-gray-500 text-sm mb-4">
                Create your first assignment to get started
              </p>
              <Button onClick={() => setShowNewAssignment(true)}>
                Create Assignment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => {
              const hasKey = assignment.answer_keys && assignment.answer_keys.length > 0
              const activeKey = assignment.answer_keys?.find((k: AnswerKey) => k.is_active)

              return (
                <Link key={assignment.id} href={`/scanner/key/${assignment.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          hasKey ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          {hasKey ? (
                            <CheckIcon className="w-5 h-5 text-green-600" />
                          ) : (
                            <DocumentIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{assignment.title}</div>
                          <div className="text-sm text-gray-500">
                            {assignment.subject && `${assignment.subject} • `}
                            {assignment.total_points} points
                            {activeKey && ' • Key ready'}
                          </div>
                        </div>
                      </div>
                      <ArrowRightIcon className="w-5 h-5 text-gray-400" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
