import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SubPacketView } from '@/components/share/sub-packet-view'
import { PinEntry } from '@/components/share/pin-entry'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

interface SubPageProps {
  params: Promise<{ code: string }>
  searchParams: Promise<{ pin?: string }>
}

export default async function SubPage({ params, searchParams }: SubPageProps) {
  const { code } = await params
  const { pin: queryPin } = await searchParams

  const supabase = await createServiceRoleClient()

  // Fetch share link
  const { data: shareLink, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('share_code', code)
    .eq('is_active', true)
    .single()

  if (error || !shareLink) {
    notFound()
  }

  // Check expiration
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600">This share link has expired. Please contact the teacher for a new link.</p>
        </div>
      </div>
    )
  }

  // Check PIN if required
  if (shareLink.pin_hash) {
    const cookieStore = await cookies()
    const savedPin = cookieStore.get(`sub_pin_${code}`)?.value || queryPin

    if (!savedPin) {
      return <PinEntry shareCode={code} />
    }

    const pinValid = await bcrypt.compare(savedPin, shareLink.pin_hash)
    if (!pinValid) {
      return <PinEntry shareCode={code} error="Incorrect PIN" />
    }
  }

  // Increment view count
  await supabase
    .from('share_links')
    .update({ view_count: (shareLink.view_count || 0) + 1 })
    .eq('id', shareLink.id)

  // Fetch events for the date range
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
    .eq('user_id', shareLink.user_id)
    .gte('start_time', `${shareLink.start_date}T00:00:00Z`)
    .lte('end_time', `${shareLink.end_date}T23:59:59Z`)
    .order('start_time', { ascending: true })

  // Get teacher profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, school_name')
    .eq('id', shareLink.user_id)
    .single()

  return (
    <SubPacketView
      events={events || []}
      shareLink={shareLink}
      teacherName={profile?.full_name || 'Teacher'}
      schoolName={profile?.school_name}
      routines={shareLink.classroom_routines}
    />
  )
}
