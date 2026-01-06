import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addDays, setHours, setMinutes, isWeekend, format } from 'date-fns'
import type { AutoScheduleRule } from '@/types/database'

// Subject color mapping
const SUBJECT_COLORS: Record<string, string> = {
  math: '#3B82F6',
  reading: '#10B981',
  ela: '#10B981',
  'english language arts': '#10B981',
  science: '#8B5CF6',
  'social studies': '#F59E0B',
  history: '#F59E0B',
  writing: '#EC4899',
  phonics: '#06B6D4',
  art: '#F97316',
  music: '#A855F7',
  pe: '#EF4444',
  'physical education': '#EF4444',
}

function getSubjectColor(subject: string): string {
  const normalizedSubject = subject.toLowerCase().trim()
  return SUBJECT_COLORS[normalizedSubject] || '#6B7280'
}

interface ScheduleSlot {
  startTime: Date
  endTime: Date
  ruleId: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { lessonPlanId, subject, duration = 45 } = await request.json()

  // Get schedule rules for this subject
  const { data: rules, error: rulesError } = await supabase
    .from('auto_schedule_rules')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (rulesError) {
    return NextResponse.json({
      success: false,
      reason: 'Failed to fetch schedule rules',
      needsManual: true,
    })
  }

  // Filter rules by subject (case-insensitive)
  const matchingRules = rules?.filter(r =>
    r.subject.toLowerCase().includes(subject.toLowerCase()) ||
    subject.toLowerCase().includes(r.subject.toLowerCase())
  ) || []

  if (matchingRules.length === 0) {
    return NextResponse.json({
      success: false,
      reason: `No schedule rules found for ${subject}. Please set up your schedule in Settings.`,
      needsManual: true,
    })
  }

  // Find next available slot
  const slot = await findNextAvailableSlot(user.id, matchingRules, duration, supabase)

  if (!slot) {
    return NextResponse.json({
      success: false,
      reason: 'No available slots in the next 14 days',
      needsManual: true,
    })
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
      user_id: user.id,
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
    return NextResponse.json({
      success: false,
      reason: 'Failed to create calendar event',
      needsManual: true,
    })
  }

  return NextResponse.json({
    success: true,
    event,
    slot: {
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
      ruleId: slot.ruleId,
    },
    message: `Scheduled for ${format(slot.startTime, "EEEE 'at' h:mm a")}`,
  })
}

async function findNextAvailableSlot(
  userId: string,
  rules: AutoScheduleRule[],
  duration: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ScheduleSlot | null> {
  const now = new Date()
  const maxDaysToSearch = 14

  const searchEnd = addDays(now, maxDaysToSearch)
  const { data: existingEvents } = await supabase
    .from('calendar_events')
    .select('start_time, end_time')
    .eq('user_id', userId)
    .gte('start_time', now.toISOString())
    .lte('end_time', searchEnd.toISOString())

  const candidates: ScheduleSlot[] = []

  for (let day = 0; day < maxDaysToSearch; day++) {
    const currentDate = addDays(now, day)

    if (isWeekend(currentDate)) continue

    for (const rule of rules) {
      if (currentDate.getDay() !== rule.day_of_week) continue

      const [startHour, startMin] = rule.start_time.split(':').map(Number)
      const [endHour, endMin] = rule.end_time.split(':').map(Number)

      const slotStart = setMinutes(setHours(new Date(currentDate), startHour), startMin)
      slotStart.setSeconds(0, 0)
      const slotEnd = setMinutes(setHours(new Date(currentDate), endHour), endMin)
      slotEnd.setSeconds(0, 0)

      if (slotStart <= now) continue

      const slotDuration = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60)
      if (slotDuration < duration) continue

      candidates.push({
        startTime: slotStart,
        endTime: new Date(slotStart.getTime() + duration * 60 * 1000),
        ruleId: rule.id,
      })
    }
  }

  candidates.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

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
