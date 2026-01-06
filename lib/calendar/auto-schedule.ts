import { createClient } from '@/lib/supabase/server'
import { addDays, setHours, setMinutes, isWeekend, format, parse } from 'date-fns'
import type { AutoScheduleRule, CalendarEvent } from '@/types/database'

// Subject color mapping
const SUBJECT_COLORS: Record<string, string> = {
  math: '#3B82F6', // blue
  reading: '#10B981', // green
  ela: '#10B981',
  'english language arts': '#10B981',
  science: '#8B5CF6', // purple
  'social studies': '#F59E0B', // amber
  history: '#F59E0B',
  writing: '#EC4899', // pink
  phonics: '#06B6D4', // cyan
  art: '#F97316', // orange
  music: '#A855F7', // violet
  pe: '#EF4444', // red
  'physical education': '#EF4444',
}

export function getSubjectColor(subject: string): string {
  const normalizedSubject = subject.toLowerCase().trim()
  return SUBJECT_COLORS[normalizedSubject] || '#6B7280' // gray default
}

export interface ScheduleSlot {
  startTime: Date
  endTime: Date
  ruleId: string
}

export interface AutoScheduleResult {
  success: boolean
  event?: CalendarEvent
  slot?: ScheduleSlot
  reason?: string
  needsManual?: boolean
  alternatives?: ScheduleSlot[]
}

export async function autoScheduleLesson(
  userId: string,
  lessonPlanId: string,
  subject: string,
  duration: number = 45
): Promise<AutoScheduleResult> {
  const supabase = await createClient()

  // Get schedule rules for this subject
  const { data: rules, error: rulesError } = await supabase
    .from('auto_schedule_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`subject.ilike.%${subject}%,subject.eq.${subject}`)

  if (rulesError) {
    console.error('Error fetching rules:', rulesError)
    return {
      success: false,
      reason: 'Failed to fetch schedule rules',
      needsManual: true,
    }
  }

  if (!rules || rules.length === 0) {
    return {
      success: false,
      reason: `No schedule rules found for ${subject}. Please set up your schedule in Settings.`,
      needsManual: true,
    }
  }

  // Find next available slot
  const slot = await findNextAvailableSlot(userId, rules, duration, supabase)

  if (!slot) {
    // Try to find alternatives
    const alternatives = await findAlternativeSlots(userId, rules, duration, supabase)
    return {
      success: false,
      reason: 'No available slots in the next 14 days',
      needsManual: true,
      alternatives,
    }
  }

  // Get lesson plan details
  const { data: lessonPlan } = await supabase
    .from('lesson_plans')
    .select('title, subject')
    .eq('id', lessonPlanId)
    .single()

  // Create calendar event
  const { data: event, error: eventError } = await supabase
    .from('calendar_events')
    .insert({
      user_id: userId,
      lesson_plan_id: lessonPlanId,
      title: lessonPlan?.title || `${subject} Lesson`,
      event_type: 'lesson',
      start_time: slot.startTime.toISOString(),
      end_time: slot.endTime.toISOString(),
      color: getSubjectColor(subject),
      metadata: {
        auto_scheduled: true,
        schedule_rule_id: slot.ruleId,
      },
    })
    .select()
    .single()

  if (eventError) {
    console.error('Error creating event:', eventError)
    return {
      success: false,
      reason: 'Failed to create calendar event',
      needsManual: true,
    }
  }

  return {
    success: true,
    event: event as CalendarEvent,
    slot,
  }
}

async function findNextAvailableSlot(
  userId: string,
  rules: AutoScheduleRule[],
  duration: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ScheduleSlot | null> {
  const now = new Date()
  const maxDaysToSearch = 14

  // Get existing events in the search window
  const searchEnd = addDays(now, maxDaysToSearch)
  const { data: existingEvents } = await supabase
    .from('calendar_events')
    .select('start_time, end_time')
    .eq('user_id', userId)
    .gte('start_time', now.toISOString())
    .lte('end_time', searchEnd.toISOString())

  // Generate candidate slots
  const candidates: ScheduleSlot[] = []

  for (let day = 0; day < maxDaysToSearch; day++) {
    const currentDate = addDays(now, day)

    // Skip weekends
    if (isWeekend(currentDate)) continue

    for (const rule of rules) {
      // Check if this day matches the rule's day_of_week
      if (currentDate.getDay() !== rule.day_of_week) continue

      // Parse start and end times
      const [startHour, startMin] = rule.start_time.split(':').map(Number)
      const [endHour, endMin] = rule.end_time.split(':').map(Number)

      const slotStart = setMinutes(setHours(currentDate, startHour), startMin)
      const slotEnd = setMinutes(setHours(currentDate, endHour), endMin)

      // Skip if slot is in the past
      if (slotStart <= now) continue

      // Check if slot has enough duration
      const slotDuration = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60)
      if (slotDuration < duration) continue

      candidates.push({
        startTime: slotStart,
        endTime: new Date(slotStart.getTime() + duration * 60 * 1000),
        ruleId: rule.id,
      })
    }
  }

  // Sort by date
  candidates.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  // Find first available slot without conflicts
  for (const candidate of candidates) {
    const hasConflict = existingEvents?.some((event) => {
      const eventStart = new Date(event.start_time)
      const eventEnd = new Date(event.end_time)
      return (
        (candidate.startTime >= eventStart && candidate.startTime < eventEnd) ||
        (candidate.endTime > eventStart && candidate.endTime <= eventEnd) ||
        (candidate.startTime <= eventStart && candidate.endTime >= eventEnd)
      )
    })

    if (!hasConflict) {
      return candidate
    }
  }

  return null
}

async function findAlternativeSlots(
  userId: string,
  rules: AutoScheduleRule[],
  duration: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ScheduleSlot[]> {
  // Similar to findNextAvailableSlot but returns multiple options
  const now = new Date()
  const alternatives: ScheduleSlot[] = []

  // Get existing events
  const searchEnd = addDays(now, 7)
  const { data: existingEvents } = await supabase
    .from('calendar_events')
    .select('start_time, end_time')
    .eq('user_id', userId)
    .gte('start_time', now.toISOString())
    .lte('end_time', searchEnd.toISOString())

  for (let day = 0; day < 7; day++) {
    const currentDate = addDays(now, day)
    if (isWeekend(currentDate)) continue

    for (const rule of rules) {
      if (currentDate.getDay() !== rule.day_of_week) continue

      const [startHour, startMin] = rule.start_time.split(':').map(Number)
      const slotStart = setMinutes(setHours(currentDate, startHour), startMin)

      if (slotStart <= now) continue

      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000)

      const hasConflict = existingEvents?.some((event) => {
        const eventStart = new Date(event.start_time)
        const eventEnd = new Date(event.end_time)
        return slotStart < eventEnd && slotEnd > eventStart
      })

      if (!hasConflict) {
        alternatives.push({
          startTime: slotStart,
          endTime: slotEnd,
          ruleId: rule.id,
        })
      }
    }
  }

  return alternatives.slice(0, 3) // Return top 3 alternatives
}

export function formatSlotTime(slot: ScheduleSlot): string {
  return format(slot.startTime, "EEEE 'at' h:mm a")
}
