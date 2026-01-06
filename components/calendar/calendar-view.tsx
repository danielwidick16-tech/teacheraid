'use client'

import { useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent } from '@/types/database'
import type { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core'

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void
  onDateSelect?: (start: Date, end: Date) => void
}

export function CalendarView({ onEventClick, onDateSelect }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching events:', error)
    } else {
      setEvents(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleEventClick = (info: EventClickArg) => {
    const event = events.find((e) => e.id === info.event.id)
    if (event && onEventClick) {
      onEventClick(event)
    }
  }

  const handleDateSelect = (info: DateSelectArg) => {
    if (onDateSelect) {
      onDateSelect(info.start, info.end)
    }
  }

  const handleEventDrop = async (info: EventDropArg) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('calendar_events')
      .update({
        start_time: info.event.start?.toISOString(),
        end_time: info.event.end?.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', info.event.id)

    if (error) {
      console.error('Error updating event:', error)
      info.revert()
    } else {
      fetchEvents()
    }
  }

  const calendarEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start_time,
    end: event.end_time,
    allDay: event.all_day,
    backgroundColor: event.color || '#3B82F6',
    borderColor: event.color || '#3B82F6',
    extendedProps: {
      eventType: event.event_type,
      lessonPlanId: event.lesson_plan_id,
    },
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={calendarEvents}
        editable={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={3}
        weekends={false}
        eventClick={handleEventClick}
        select={handleDateSelect}
        eventDrop={handleEventDrop}
        height="auto"
        eventDisplay="block"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
        slotMinTime="07:00:00"
        slotMaxTime="18:00:00"
      />

      <style jsx global>{`
        .fc {
          --fc-border-color: #e5e7eb;
          --fc-button-bg-color: #3b82f6;
          --fc-button-border-color: #3b82f6;
          --fc-button-hover-bg-color: #2563eb;
          --fc-button-hover-border-color: #2563eb;
          --fc-button-active-bg-color: #1d4ed8;
          --fc-button-active-border-color: #1d4ed8;
          --fc-today-bg-color: #eff6ff;
        }
        .fc .fc-button {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .fc .fc-event {
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 0.75rem;
          cursor: pointer;
        }
        .fc .fc-daygrid-day-number {
          padding: 4px 8px;
          font-size: 0.875rem;
        }
        .fc .fc-col-header-cell-cushion {
          padding: 8px;
          font-weight: 500;
        }
        @media (max-width: 768px) {
          .fc .fc-toolbar {
            flex-direction: column;
            gap: 0.5rem;
          }
          .fc .fc-toolbar-chunk {
            display: flex;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
