import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedFields } from '@/lib/ocr/extract-fields'

export interface LessonPlanSections {
  warmUp: string
  directInstruction: string
  guidedPractice: string
  independentPractice: string
  exitTicket: string
  differentiation: {
    belowLevel: string
    onLevel: string
    aboveLevel: string
  }
  assessment: string
  materials: string[]
}

export interface GeneratedLessonPlan {
  title: string
  subject: string
  gradeLevel: string
  duration: number
  sections: LessonPlanSections
  objectives: string[]
  vocabulary: { term: string; definition: string }[]
}

export async function generateLessonPlan(
  fields: ExtractedFields,
  rawOcrText: string
): Promise<GeneratedLessonPlan> {
  const anthropic = new Anthropic()

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are an expert elementary education curriculum specialist. Create a detailed, classroom-ready lesson plan based on this curriculum content.

EXTRACTED CURRICULUM INFO:
- Subject: ${fields.subject || 'Not specified'}
- Grade Level: ${fields.gradeLevel || 'Not specified'}
- Duration: ${fields.duration || '45 minutes'}
- Objectives: ${fields.objectives.length > 0 ? fields.objectives.join(', ') : 'See curriculum text'}
- Materials: ${fields.materials.length > 0 ? fields.materials.join(', ') : 'See curriculum text'}
- Vocabulary: ${fields.vocabulary.length > 0 ? fields.vocabulary.join(', ') : 'None specified'}

RAW CURRICULUM TEXT:
${rawOcrText.slice(0, 3000)}

Generate a complete lesson plan as JSON with this exact structure:
{
  "title": "Engaging, descriptive lesson title",
  "subject": "Subject name (Math, Reading, Science, etc.)",
  "gradeLevel": "Grade level (e.g., 3rd Grade)",
  "duration": 45,
  "sections": {
    "warmUp": "5-minute engaging opener - be specific about the activity",
    "directInstruction": "Detailed teacher-led instruction with step-by-step guidance",
    "guidedPractice": "We Do Together activity with specific examples",
    "independentPractice": "You Do - independent work activity with clear instructions",
    "exitTicket": "Quick 2-3 question formative assessment",
    "differentiation": {
      "belowLevel": "Specific support strategies for struggling learners",
      "onLevel": "Standard activity modifications",
      "aboveLevel": "Extension activities for advanced learners"
    },
    "assessment": "How to check for understanding throughout",
    "materials": ["list", "of", "specific", "materials", "needed"]
  },
  "objectives": ["SWBAT objective 1", "SWBAT objective 2"],
  "vocabulary": [{"term": "word", "definition": "simple, kid-friendly definition"}]
}

Requirements:
- Make it practical and immediately usable
- Use age-appropriate language and activities
- Include specific examples and questions
- Be detailed but not overwhelming
- Return ONLY valid JSON, no markdown or explanation`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Clean up the response - remove any markdown code blocks if present
  let jsonText = content.text.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7)
  }
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3)
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3)
  }

  try {
    const plan = JSON.parse(jsonText)
    return {
      title: plan.title || 'Untitled Lesson',
      subject: plan.subject || fields.subject || 'General',
      gradeLevel: plan.gradeLevel || fields.gradeLevel || 'Elementary',
      duration: plan.duration || 45,
      sections: {
        warmUp: plan.sections?.warmUp || '',
        directInstruction: plan.sections?.directInstruction || '',
        guidedPractice: plan.sections?.guidedPractice || '',
        independentPractice: plan.sections?.independentPractice || '',
        exitTicket: plan.sections?.exitTicket || '',
        differentiation: {
          belowLevel: plan.sections?.differentiation?.belowLevel || '',
          onLevel: plan.sections?.differentiation?.onLevel || '',
          aboveLevel: plan.sections?.differentiation?.aboveLevel || '',
        },
        assessment: plan.sections?.assessment || '',
        materials: plan.sections?.materials || fields.materials || [],
      },
      objectives: plan.objectives || fields.objectives || [],
      vocabulary: plan.vocabulary || [],
    }
  } catch (error) {
    console.error('Failed to parse plan JSON:', error, jsonText)
    throw new Error('Failed to generate lesson plan - invalid response format')
  }
}

export async function regenerateSection(
  plan: GeneratedLessonPlan,
  sectionName: string,
  feedback?: string
): Promise<string> {
  const anthropic = new Anthropic()

  const currentContent =
    sectionName === 'differentiation'
      ? JSON.stringify(plan.sections.differentiation)
      : (plan.sections as unknown as Record<string, unknown>)[sectionName]

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Regenerate the "${sectionName}" section of this elementary lesson plan.

Current plan context:
- Title: ${plan.title}
- Subject: ${plan.subject}
- Grade: ${plan.gradeLevel}
- Duration: ${plan.duration} minutes
- Objectives: ${plan.objectives.join(', ')}

Current ${sectionName}: ${currentContent}

${feedback ? `Teacher feedback: ${feedback}` : 'Please make it more engaging, practical, and specific.'}

Requirements:
- Keep it age-appropriate for ${plan.gradeLevel}
- Be specific with activities and examples
- Make it immediately usable in the classroom

Return ONLY the new section content as plain text (not JSON).`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  return content.text.trim()
}
