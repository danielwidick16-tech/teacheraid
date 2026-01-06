'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { ExtractedFields } from '@/lib/ocr/extract-fields'

interface FieldEditorProps {
  fields: ExtractedFields
  onSave: (fields: ExtractedFields) => void
  onBack: () => void
}

export function FieldEditor({ fields, onSave, onBack }: FieldEditorProps) {
  const [editedFields, setEditedFields] = useState<ExtractedFields>(fields)

  const updateField = <K extends keyof ExtractedFields>(
    key: K,
    value: ExtractedFields[K]
  ) => {
    setEditedFields((prev) => ({ ...prev, [key]: value }))
  }

  const addToArray = (key: 'objectives' | 'materials' | 'vocabulary' | 'activities') => {
    setEditedFields((prev) => ({
      ...prev,
      [key]: [...prev[key], ''],
    }))
  }

  const removeFromArray = (
    key: 'objectives' | 'materials' | 'vocabulary' | 'activities',
    index: number
  ) => {
    setEditedFields((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }))
  }

  const updateArrayItem = (
    key: 'objectives' | 'materials' | 'vocabulary' | 'activities',
    index: number,
    value: string
  ) => {
    setEditedFields((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? value : item)),
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Confidence: {Math.round(editedFields.confidence * 100)}%
          </span>
          <div
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor:
                editedFields.confidence > 0.7
                  ? '#10B981'
                  : editedFields.confidence > 0.4
                    ? '#F59E0B'
                    : '#EF4444',
            }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review Detected Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Subject"
              value={editedFields.subject || ''}
              onChange={(e) => updateField('subject', e.target.value || null)}
              placeholder="e.g., Math, Reading"
            />
            <Input
              label="Grade Level"
              value={editedFields.gradeLevel || ''}
              onChange={(e) => updateField('gradeLevel', e.target.value || null)}
              placeholder="e.g., 3rd Grade"
            />
            <Input
              label="Duration"
              value={editedFields.duration || ''}
              onChange={(e) => updateField('duration', e.target.value || null)}
              placeholder="e.g., 45 minutes"
            />
          </div>

          {/* Objectives */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Learning Objectives
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addToArray('objectives')}
              >
                + Add
              </Button>
            </div>
            {editedFields.objectives.length > 0 ? (
              <div className="space-y-2">
                {editedFields.objectives.map((obj, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={obj}
                      onChange={(e) => updateArrayItem('objectives', i, e.target.value)}
                      placeholder="Students will be able to..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromArray('objectives', i)}
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No objectives detected</p>
            )}
          </div>

          {/* Materials */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Materials</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addToArray('materials')}
              >
                + Add
              </Button>
            </div>
            {editedFields.materials.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {editedFields.materials.map((mat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full"
                  >
                    <input
                      value={mat}
                      onChange={(e) => updateArrayItem('materials', i, e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-sm w-auto"
                      style={{ width: `${Math.max(mat.length, 5)}ch` }}
                    />
                    <button
                      type="button"
                      onClick={() => removeFromArray('materials', i)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No materials detected</p>
            )}
          </div>

          {/* Vocabulary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Vocabulary</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addToArray('vocabulary')}
              >
                + Add
              </Button>
            </div>
            {editedFields.vocabulary.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {editedFields.vocabulary.map((word, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full"
                  >
                    <input
                      value={word}
                      onChange={(e) => updateArrayItem('vocabulary', i, e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-sm w-auto"
                      style={{ width: `${Math.max(word.length, 5)}ch` }}
                    />
                    <button
                      type="button"
                      onClick={() => removeFromArray('vocabulary', i)}
                      className="text-blue-400 hover:text-red-500"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No vocabulary detected</p>
            )}
          </div>

          {/* Assessment */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Assessment</label>
            <textarea
              value={editedFields.assessment || ''}
              onChange={(e) => updateField('assessment', e.target.value || null)}
              placeholder="How will students be assessed?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => onSave(editedFields)} className="w-full" size="lg">
        Generate Teaching Plan
      </Button>
    </div>
  )
}
