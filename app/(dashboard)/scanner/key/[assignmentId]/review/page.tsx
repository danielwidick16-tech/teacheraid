'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Assignment, AnswerKey, AnswerKeyItem } from '@/types/database'

interface EditableItem extends AnswerKeyItem {
  isEditing?: boolean
}

export default function ReviewKeyPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const assignmentId = params.assignmentId as string
  const keyId = searchParams.get('keyId')

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [answerKey, setAnswerKey] = useState<AnswerKey | null>(null)
  const [items, setItems] = useState<EditableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load assignment
      const { data: assignmentData } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single()

      if (assignmentData) {
        setAssignment(assignmentData)
      }

      // Load answer key
      let keyQuery = supabase
        .from('answer_keys')
        .select('*')
        .eq('assignment_id', assignmentId)

      if (keyId) {
        keyQuery = keyQuery.eq('id', keyId)
      } else {
        keyQuery = keyQuery.eq('is_active', true)
      }

      const { data: keyData } = await keyQuery.single()

      if (keyData) {
        setAnswerKey(keyData)

        // Load items
        const { data: itemsData } = await supabase
          .from('answer_key_items')
          .select('*')
          .eq('answer_key_id', keyData.id)
          .order('question_number')

        setItems(itemsData || [])
      }

      setLoading(false)
    }

    loadData()
  }, [assignmentId, keyId])

  const handleUpdateItem = (index: number, updates: Partial<EditableItem>) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      )
    )
  }

  const handleAddItem = () => {
    const maxNum = items.length > 0 ? Math.max(...items.map((i) => i.question_number)) : 0
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        answer_key_id: answerKey?.id || '',
        question_number: maxNum + 1,
        correct_answer: '',
        accepted_variants: [],
        points: 1,
        question_type: 'unknown',
        rubric_notes: null,
        created_at: new Date().toISOString(),
        isEditing: true,
      },
    ])
  }

  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!answerKey) return
    setSaving(true)

    const supabase = createClient()

    try {
      // Delete existing items
      await supabase
        .from('answer_key_items')
        .delete()
        .eq('answer_key_id', answerKey.id)

      // Insert updated items
      const itemsToInsert = items.map((item) => ({
        answer_key_id: answerKey.id,
        question_number: item.question_number,
        correct_answer: item.correct_answer,
        accepted_variants: item.accepted_variants,
        points: item.points,
        question_type: item.question_type,
        rubric_notes: item.rubric_notes,
      }))

      const { error } = await supabase
        .from('answer_key_items')
        .insert(itemsToInsert)

      if (error) throw error

      // Update total points
      const totalPoints = items.reduce((sum, i) => sum + (i.points || 1), 0)
      await supabase
        .from('answer_keys')
        .update({ total_points: totalPoints })
        .eq('id', answerKey.id)

      router.push('/scanner/key')
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save answer key')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-8 text-gray-500">Loading answer key...</div>
      </div>
    )
  }

  if (!answerKey) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="text-center py-8">
          <h2 className="text-lg font-medium text-gray-900 mb-2">No Answer Key Found</h2>
          <p className="text-gray-500 mb-4">Create an answer key for this assignment first.</p>
          <Link href={`/scanner/key/${assignmentId}`}>
            <Button>Create Answer Key</Button>
          </Link>
        </div>
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
        <h1 className="text-2xl font-bold text-gray-900">Edit Answer Key</h1>
        <p className="text-gray-600">{assignment?.title}</p>
      </div>

      {/* Summary */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{items.length}</div>
              <div className="text-sm text-gray-500">Questions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {items.reduce((sum, i) => sum + (i.points || 1), 0)}
              </div>
              <div className="text-sm text-gray-500">Total Points</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <div className="space-y-3 mb-6">
        {items.map((item, index) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium flex-shrink-0">
                  {item.question_number}
                </div>
                <div className="flex-1">
                  {item.isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Correct Answer</label>
                        <input
                          type="text"
                          value={item.correct_answer}
                          onChange={(e) => handleUpdateItem(index, { correct_answer: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          style={{ color: '#111827', backgroundColor: '#ffffff' }}
                          placeholder="Enter correct answer"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Type</label>
                          <select
                            value={item.question_type || 'unknown'}
                            onChange={(e) => handleUpdateItem(index, { question_type: e.target.value as EditableItem['question_type'] })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            style={{ color: '#111827', backgroundColor: '#ffffff' }}
                          >
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="fill_in">Fill In</option>
                            <option value="short_answer">Short Answer</option>
                            <option value="true_false">True/False</option>
                            <option value="math">Math</option>
                            <option value="unknown">Unknown</option>
                          </select>
                        </div>
                        <div className="w-20">
                          <label className="block text-xs text-gray-500 mb-1">Points</label>
                          <input
                            type="number"
                            value={item.points}
                            onChange={(e) => handleUpdateItem(index, { points: parseFloat(e.target.value) || 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            style={{ color: '#111827', backgroundColor: '#ffffff' }}
                            min="0"
                            step="0.5"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateItem(index, { isEditing: false })}
                        >
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer"
                      onClick={() => handleUpdateItem(index, { isEditing: true })}
                    >
                      <div className="font-medium text-gray-900">{item.correct_answer || '(empty)'}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {item.question_type?.replace('_', ' ')} • {item.points} pt{item.points !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" onClick={handleAddItem}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Question
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Answer Key'}
        </Button>
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
