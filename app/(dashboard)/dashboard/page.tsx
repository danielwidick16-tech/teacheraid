import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user's profile
  let firstName: string | null = null
  if (user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Cast to handle Supabase generic type inference
    const profile = profileData as { full_name: string | null } | null
    firstName = profile?.full_name?.split(' ')[0] || null
  }

  // Get recent lesson plans
  const { data: recentPlans } = await supabase
    .from('lesson_plans')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)

  // Get upcoming events
  const { data: upcomingEvents } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(3)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-gray-600 mt-1">Here&apos;s what&apos;s happening in your classroom</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/scan">
          <Card className="hover:shadow-md transition-shadow cursor-pointer bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Scan Curriculum</h3>
                  <p className="text-sm text-blue-100">Photo to lesson plan</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/plans/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">New Lesson Plan</h3>
                  <p className="text-sm text-gray-500">Create from scratch</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/share">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Sub Packet</h3>
                  <p className="text-sm text-gray-500">Share with substitute</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Plans */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Lesson Plans</CardTitle>
            <CardDescription>Your latest lesson plans</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPlans && recentPlans.length > 0 ? (
              <div className="space-y-3">
                {recentPlans.map((plan) => (
                  <Link
                    key={plan.id}
                    href={`/plans/${plan.id}`}
                    className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <h4 className="font-medium text-gray-900">{plan.title}</h4>
                    <p className="text-sm text-gray-500">
                      {plan.subject} {plan.grade_level && `• ${plan.grade_level}`}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No lesson plans yet</p>
                <Link href="/scan">
                  <Button>Create Your First Plan</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Schedule</CardTitle>
            <CardDescription>Your next lessons and events</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/calendar?event=${event.id}`}
                    className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <span
                        className="px-2 py-1 text-xs rounded-full"
                        style={{ backgroundColor: event.color || '#3B82F6', color: 'white' }}
                      >
                        {event.event_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(event.start_time).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No upcoming events</p>
                <Link href="/calendar">
                  <Button variant="outline">View Calendar</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
