import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function PlansPage() {
  const supabase = await createClient()

  const { data: plans } = await supabase
    .from('lesson_plans')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lesson Plans</h1>
          <p className="text-gray-600">Your library of teaching plans</p>
        </div>
        <Link href="/scan">
          <Button>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Plan
          </Button>
        </Link>
      </div>

      {plans && plans.length > 0 ? (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/plans/${plan.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{plan.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        {plan.subject && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                            {plan.subject}
                          </span>
                        )}
                        {plan.grade_level && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                            {plan.grade_level}
                          </span>
                        )}
                        {plan.duration_minutes && (
                          <span>{plan.duration_minutes} min</span>
                        )}
                      </div>
                      {plan.objectives && plan.objectives.length > 0 && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-1">
                          {plan.objectives[0]}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-400">
                      <p>{new Date(plan.created_at).toLocaleDateString()}</p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
                          plan.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {plan.status}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No lesson plans yet</h3>
            <p className="text-gray-500 mb-6">
              Scan your curriculum materials to create your first AI-powered lesson plan.
            </p>
            <Link href="/scan">
              <Button>Scan Curriculum</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
