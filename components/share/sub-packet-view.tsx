'use client'

import { format, parseISO } from 'date-fns'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PrintButton } from './print-button'
import type { CalendarEvent, ShareLink, Json } from '@/types/database'

interface EventWithPlan extends CalendarEvent {
  lesson_plan?: {
    id: string
    title: string
    subject: string | null
    grade_level: string | null
    duration_minutes: number | null
    sections: Json
    objectives: string[] | null
    vocabulary: Json
  } | null
}

interface SubPacketViewProps {
  events: EventWithPlan[]
  shareLink: ShareLink
  teacherName: string
  schoolName?: string | null
  routines?: Json | null
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

export function SubPacketView({
  events,
  shareLink,
  teacherName,
  schoolName,
  routines,
}: SubPacketViewProps) {
  const dateRange = `${format(parseISO(shareLink.start_date), 'MMMM d')} - ${format(
    parseISO(shareLink.end_date),
    'MMMM d, yyyy'
  )}`

  // Group events by date
  const eventsByDate = events.reduce(
    (acc, event) => {
      const date = format(parseISO(event.start_time), 'yyyy-MM-dd')
      if (!acc[date]) acc[date] = []
      acc[date].push(event)
      return acc
    },
    {} as Record<string, EventWithPlan[]>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sub Packet</h1>
            <p className="text-sm text-gray-600">{dateRange}</p>
          </div>
          <PrintButton contentId="sub-packet-content" title={dateRange} />
        </div>
      </div>

      {/* Content */}
      <div id="sub-packet-content" className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Teacher Info */}
        <Card className="print:shadow-none">
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">{teacherName}&apos;s Class</h2>
              {schoolName && <p className="text-gray-600 mt-1">{schoolName}</p>}
              <p className="text-lg text-gray-700 mt-2">{dateRange}</p>
            </div>
          </CardContent>
        </Card>

        {/* Classroom Routines */}
        {routines && Object.keys(routines as Record<string, unknown>).length > 0 && (
          <Card className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle>Classroom Routines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(routines as Record<string, string>).map(([key, value]) => (
                  <div key={key} className="flex gap-3">
                    <span className="font-medium text-gray-700 capitalize min-w-[120px]">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <span className="text-gray-600">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Schedule */}
        {Object.entries(eventsByDate).map(([date, dayEvents]) => (
          <div key={date} className="space-y-4 print:break-inside-avoid">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              {format(parseISO(date), 'EEEE, MMMM d')}
            </h3>

            {dayEvents.map((event) => (
              <Card key={event.id} className="print:shadow-none print:border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {format(parseISO(event.start_time), 'h:mm a')} -{' '}
                        {format(parseISO(event.end_time), 'h:mm a')}
                      </p>
                    </div>
                    <span
                      className="px-3 py-1 text-xs font-medium rounded-full text-white"
                      style={{ backgroundColor: event.color || '#3B82F6' }}
                    >
                      {event.event_type}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {event.description && (
                    <p className="text-gray-700 mb-4">{event.description}</p>
                  )}

                  {event.lesson_plan && (
                    <div className="space-y-4">
                      {/* Objectives */}
                      {event.lesson_plan.objectives && event.lesson_plan.objectives.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Learning Objectives</h4>
                          <ul className="list-disc list-inside space-y-1 text-gray-700">
                            {event.lesson_plan.objectives.map((obj, i) => (
                              <li key={i}>{obj}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Lesson Sections */}
                      {event.lesson_plan.sections && (
                        <div className="space-y-3">
                          {renderLessonSections(event.lesson_plan.sections as LessonSections)}
                        </div>
                      )}

                      {/* Materials */}
                      {(event.lesson_plan.sections as LessonSections)?.materials && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Materials Needed</h4>
                          <div className="flex flex-wrap gap-2">
                            {((event.lesson_plan.sections as LessonSections).materials || []).map(
                              (material, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                                >
                                  {material}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}

        {events.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No events scheduled for this date range.</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 pt-4 print:pt-8">
          <p>Generated by Teacher Companion</p>
        </div>
      </div>
    </div>
  )
}

function renderLessonSections(sections: LessonSections) {
  const sectionOrder = [
    { key: 'warmUp', label: 'Warm-Up', icon: '🌅' },
    { key: 'directInstruction', label: 'Direct Instruction', icon: '📚' },
    { key: 'guidedPractice', label: 'Guided Practice', icon: '👥' },
    { key: 'independentPractice', label: 'Independent Practice', icon: '✍️' },
    { key: 'exitTicket', label: 'Exit Ticket', icon: '🎫' },
    { key: 'assessment', label: 'Assessment', icon: '📊' },
  ]

  return sectionOrder.map(({ key, label, icon }) => {
    const value = sections[key as keyof LessonSections]
    if (!value || typeof value !== 'string') return null

    return (
      <div key={key} className="p-3 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-1">
          {icon} {label}
        </h4>
        <p className="text-gray-700 text-sm whitespace-pre-wrap">{value}</p>
      </div>
    )
  })
}
