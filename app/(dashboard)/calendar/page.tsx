'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarView } from '@/components/calendar/calendar-view'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent } from '@/types/database'

export default function CalendarPage() {
  const router = useRouter()
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handleDateSelect = async (start: Date, end: Date) => {
    // Could open a modal to create new event
    console.log('Selected date range:', start, end)
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return

    const confirmed = window.confirm('Are you sure you want to delete this event?')
    if (!confirmed) return

    const supabase = createClient()
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', selectedEvent.id)

    if (error) {
      console.error('Error deleting event:', error)
    } else {
      setShowEventModal(false)
      setSelectedEvent(null)
      // Refresh the page to update calendar
      window.location.reload()
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600">Manage your teaching schedule</p>
        </div>
        <Button onClick={() => router.push('/plans')}>
          View All Plans
        </Button>
      </div>

      <CalendarView
        onEventClick={handleEventClick}
        onDateSelect={handleDateSelect}
      />

      {/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{selectedEvent.title}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(selectedEvent.start_time).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedEvent.color || '#3B82F6' }}
                />
                <span className="text-sm font-medium capitalize">{selectedEvent.event_type}</span>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">Time</p>
                <p className="text-sm text-gray-600">
                  {new Date(selectedEvent.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {' - '}
                  {new Date(selectedEvent.end_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {selectedEvent.description && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Description</p>
                  <p className="text-sm text-gray-600">{selectedEvent.description}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                {selectedEvent.lesson_plan_id && (
                  <Button
                    onClick={() => router.push(`/plans/${selectedEvent.lesson_plan_id}`)}
                    className="flex-1"
                  >
                    View Lesson Plan
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowEventModal(false)}
                  className={selectedEvent.lesson_plan_id ? '' : 'flex-1'}
                >
                  Close
                </Button>
                <Button variant="danger" onClick={handleDeleteEvent}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
