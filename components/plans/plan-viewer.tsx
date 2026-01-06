'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { LessonPlan } from '@/types/database'

interface PlanViewerProps {
  plan: LessonPlan
}

interface LessonSections {
  warmUp?: string
  directInstruction?: string
  guidedPractice?: string
  independentPractice?: string
  exitTicket?: string
  differentiation?: {
    belowLevel?: string
    onLevel?: string
    aboveLevel?: string
  }
  assessment?: string
  materials?: string[]
}

const SECTION_LABELS: Record<string, { label: string; icon: string }> = {
  warmUp: { label: 'Warm-Up', icon: '🌅' },
  directInstruction: { label: 'Direct Instruction', icon: '📚' },
  guidedPractice: { label: 'Guided Practice', icon: '👥' },
  independentPractice: { label: 'Independent Practice', icon: '✍️' },
  exitTicket: { label: 'Exit Ticket', icon: '🎫' },
  differentiation: { label: 'Differentiation', icon: '🎯' },
  assessment: { label: 'Assessment', icon: '📊' },
  materials: { label: 'Materials', icon: '📦' },
}

export function PlanViewer({ plan }: PlanViewerProps) {
  const router = useRouter()
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleResult, setScheduleResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const sections = plan.sections as LessonSections

  const handleRegenerateSection = async (sectionName: string) => {
    setRegenerating(sectionName)

    try {
      const response = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate-section',
          planId: plan.id,
          sectionName,
        }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to regenerate section:', error)
    } finally {
      setRegenerating(null)
    }
  }

  const handleSchedule = async () => {
    setScheduling(true)
    setScheduleResult(null)

    try {
      const response = await fetch('/api/calendar/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonPlanId: plan.id,
          subject: plan.subject || 'General',
          duration: plan.duration_minutes || 45,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setScheduleResult({
          success: true,
          message: result.message || 'Scheduled successfully',
        })
        router.refresh()
      } else {
        setScheduleResult({
          success: false,
          message: result.reason || 'Could not find an available slot',
        })
      }
    } catch (error) {
      console.error('Scheduling error:', error)
      setScheduleResult({ success: false, message: 'Failed to schedule' })
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{plan.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              {plan.subject && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {plan.subject}
                </span>
              )}
              {plan.grade_level && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  {plan.grade_level}
                </span>
              )}
              {plan.duration_minutes && (
                <span className="text-gray-500 text-sm">
                  {plan.duration_minutes} minutes
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSchedule} loading={scheduling}>
              Add to Calendar
            </Button>
            <Button onClick={() => router.push('/share')}>Create Sub Packet</Button>
          </div>
        </div>

        {scheduleResult && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              scheduleResult.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            }`}
          >
            {scheduleResult.message}
            {scheduleResult.success && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/calendar')}
                className="ml-2"
              >
                View Calendar →
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Objectives */}
      {plan.objectives && plan.objectives.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Learning Objectives</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Lesson Sections */}
      <div className="space-y-4">
        {Object.entries(sections).map(([key, value]) => {
          if (!value || key === 'materials') return null

          const sectionInfo = SECTION_LABELS[key] || { label: key, icon: '📌' }

          if (key === 'differentiation' && typeof value === 'object') {
            const diff = value as LessonSections['differentiation']
            return (
              <Card key={key}>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{sectionInfo.icon}</span>
                    {sectionInfo.label}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerateSection(key)}
                    disabled={regenerating === key}
                  >
                    {regenerating === key ? 'Regenerating...' : '↻ Regenerate'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {diff?.belowLevel && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-700 mb-1">Below Level</p>
                      <p className="text-sm text-gray-700">{diff.belowLevel}</p>
                    </div>
                  )}
                  {diff?.onLevel && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-700 mb-1">On Level</p>
                      <p className="text-sm text-gray-700">{diff.onLevel}</p>
                    </div>
                  )}
                  {diff?.aboveLevel && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm font-medium text-purple-700 mb-1">Above Level</p>
                      <p className="text-sm text-gray-700">{diff.aboveLevel}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>{sectionInfo.icon}</span>
                  {sectionInfo.label}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegenerateSection(key)}
                  disabled={regenerating === key}
                >
                  {regenerating === key ? 'Regenerating...' : '↻ Regenerate'}
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{value as string}</p>
              </CardContent>
            </Card>
          )
        })}

        {/* Materials */}
        {sections.materials && sections.materials.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span>📦</span>
                Materials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sections.materials.map((material, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {material}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vocabulary */}
        {plan.vocabulary && Array.isArray(plan.vocabulary) && plan.vocabulary.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span>📖</span>
                Vocabulary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(plan.vocabulary as { term: string; definition: string }[]).map((vocab, i) => (
                  <div key={i} className="p-3 bg-blue-50 rounded-lg">
                    <p className="font-medium text-blue-700">{vocab.term}</p>
                    <p className="text-sm text-gray-600 mt-1">{vocab.definition}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
