import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlanViewer } from '@/components/plans/plan-viewer'

interface PlanPageProps {
  params: Promise<{ id: string }>
}

export default async function PlanPage({ params }: PlanPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: plan, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !plan) {
    notFound()
  }

  return <PlanViewer plan={plan} />
}
