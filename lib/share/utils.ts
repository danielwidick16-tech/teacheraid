import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { CalendarEvent, ShareLink } from '@/types/database'

export async function createShareLink(options: {
  startDate: Date
  endDate: Date
  pin?: string
  expiresAt?: Date
  label?: string
}): Promise<{ url: string; shareCode: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const shareCode = nanoid(12)
  const pinHash = options.pin ? await bcrypt.hash(options.pin, 10) : null

  // Get classroom routines if available
  const { data: classroom } = await supabase
    .from('classrooms')
    .select('classroom_routines')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const { error } = await supabase.from('share_links').insert({
    user_id: user.id,
    share_code: shareCode,
    pin_hash: pinHash,
    start_date: options.startDate.toISOString().split('T')[0],
    end_date: options.endDate.toISOString().split('T')[0],
    expires_at: options.expiresAt?.toISOString(),
    classroom_routines: classroom?.classroom_routines || null,
  })

  if (error) throw error

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return {
    url: `${baseUrl}/sub/${shareCode}`,
    shareCode,
  }
}

export async function validateShareLink(
  shareCode: string,
  pin?: string
): Promise<{
  valid: boolean
  shareLink?: ShareLink
  error?: string
}> {
  const supabase = await createServiceRoleClient()

  const { data: shareLink, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('share_code', shareCode)
    .eq('is_active', true)
    .single()

  if (error || !shareLink) {
    return { valid: false, error: 'Share link not found or expired' }
  }

  // Check expiration
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return { valid: false, error: 'This link has expired' }
  }

  // Check PIN if required
  if (shareLink.pin_hash) {
    if (!pin) {
      return { valid: false, error: 'PIN required' }
    }
    const pinValid = await bcrypt.compare(pin, shareLink.pin_hash)
    if (!pinValid) {
      return { valid: false, error: 'Incorrect PIN' }
    }
  }

  // Increment view count
  await supabase
    .from('share_links')
    .update({ view_count: (shareLink.view_count || 0) + 1 })
    .eq('id', shareLink.id)

  return { valid: true, shareLink }
}

export async function getSharedEvents(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const supabase = await createServiceRoleClient()

  const { data: events } = await supabase
    .from('calendar_events')
    .select(`
      *,
      lesson_plan:lesson_plans (
        id,
        title,
        subject,
        grade_level,
        duration_minutes,
        sections,
        objectives,
        vocabulary
      )
    `)
    .eq('user_id', userId)
    .gte('start_time', `${startDate}T00:00:00Z`)
    .lte('end_time', `${endDate}T23:59:59Z`)
    .order('start_time', { ascending: true })

  return (events || []) as CalendarEvent[]
}
