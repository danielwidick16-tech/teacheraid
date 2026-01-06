import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLessonPlan, regenerateSection } from '@/lib/plans/generator'
import type { ExtractedFields } from '@/lib/ocr/extract-fields'
import type { Json } from '@/types/database'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  try {
    if (action === 'generate') {
      const { fields, rawText, curriculumSourceId } = body as {
        fields: ExtractedFields
        rawText: string
        curriculumSourceId?: string
      }

      const plan = await generateLessonPlan(fields, rawText)

      // Save the plan to the database
      const { data: savedPlan, error: saveError } = await supabase
        .from('lesson_plans')
        .insert({
          user_id: user.id,
          curriculum_source_id: curriculumSourceId || null,
          title: plan.title,
          subject: plan.subject,
          grade_level: plan.gradeLevel,
          duration_minutes: plan.duration,
          sections: plan.sections as unknown as Json,
          objectives: plan.objectives,
          vocabulary: plan.vocabulary as unknown as Json,
          status: 'draft',
        })
        .select()
        .single()

      if (saveError) {
        console.error('Error saving plan:', saveError)
        return NextResponse.json(
          { error: 'Failed to save lesson plan' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        plan: savedPlan,
      })
    }

    if (action === 'regenerate-section') {
      const { planId, sectionName, feedback } = body as {
        planId: string
        sectionName: string
        feedback?: string
      }

      // Get the existing plan
      const { data: existingPlan, error: fetchError } = await supabase
        .from('lesson_plans')
        .select('*')
        .eq('id', planId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !existingPlan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      }

      // Convert to GeneratedLessonPlan format
      type LessonPlanSections = Awaited<ReturnType<typeof generateLessonPlan>>['sections']
      const planData = {
        title: existingPlan.title,
        subject: existingPlan.subject || '',
        gradeLevel: existingPlan.grade_level || '',
        duration: existingPlan.duration_minutes || 45,
        sections: existingPlan.sections as unknown as LessonPlanSections,
        objectives: existingPlan.objectives || [],
        vocabulary: (existingPlan.vocabulary as unknown as { term: string; definition: string }[]) || [],
      }

      const newContent = await regenerateSection(planData, sectionName, feedback)

      // Update the plan
      const updatedSections = { ...planData.sections }
      if (sectionName === 'differentiation') {
        // Handle differentiation object
        try {
          updatedSections.differentiation = JSON.parse(newContent)
        } catch {
          // If parsing fails, it might be a single field update
          updatedSections.differentiation = {
            ...updatedSections.differentiation,
            onLevel: newContent,
          }
        }
      } else {
        (updatedSections as Record<string, unknown>)[sectionName] = newContent
      }

      const { error: updateError } = await supabase
        .from('lesson_plans')
        .update({ sections: updatedSections, updated_at: new Date().toISOString() })
        .eq('id', planId)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update section' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        sectionName,
        newContent,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Plan generation error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Plan generation failed',
      },
      { status: 500 }
    )
  }
}
