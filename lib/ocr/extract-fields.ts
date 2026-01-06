import Anthropic from '@anthropic-ai/sdk'

export interface ExtractedFields {
  subject: string | null
  gradeLevel: string | null
  duration: string | null
  objectives: string[]
  materials: string[]
  vocabulary: string[]
  activities: string[]
  assessment: string | null
  confidence: number
}

export async function extractFieldsWithLLM(ocrText: string): Promise<ExtractedFields> {
  const anthropic = new Anthropic()

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an expert at extracting curriculum information from OCR text. Extract structured curriculum information from the following OCR text and return it as valid JSON.

Return JSON with these exact fields (use null for strings and empty arrays if not found):
{
  "subject": string | null (e.g., "Math", "Reading", "Science", "Social Studies", "ELA"),
  "gradeLevel": string | null (e.g., "1st Grade", "2nd Grade", "K-2"),
  "duration": string | null (e.g., "45 minutes", "1 hour"),
  "objectives": string[] (learning objectives, "Students will be able to..." statements, SWBAT),
  "materials": string[] (required materials, supplies, books),
  "vocabulary": string[] (key vocabulary words or terms),
  "activities": string[] (lesson activities, steps, or procedures),
  "assessment": string | null (how students will be assessed),
  "confidence": number (0-1, your confidence in the extraction quality)
}

OCR Text:
${ocrText.slice(0, 4000)}

Important:
- Extract exactly what you find, don't make up information
- Use null for fields you cannot find
- Use empty arrays [] for list fields you cannot find
- Set confidence lower if the text is unclear or incomplete

Return ONLY valid JSON, no explanation or markdown.`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  try {
    const parsed = JSON.parse(content.text)
    return {
      subject: parsed.subject || null,
      gradeLevel: parsed.gradeLevel || null,
      duration: parsed.duration || null,
      objectives: parsed.objectives || [],
      materials: parsed.materials || [],
      vocabulary: parsed.vocabulary || [],
      activities: parsed.activities || [],
      assessment: parsed.assessment || null,
      confidence: parsed.confidence || 0.5,
    }
  } catch {
    // If JSON parsing fails, return default values with low confidence
    console.error('Failed to parse Claude response:', content.text)
    return {
      subject: null,
      gradeLevel: null,
      duration: null,
      objectives: [],
      materials: [],
      vocabulary: [],
      activities: [],
      assessment: null,
      confidence: 0.1,
    }
  }
}

// Fallback regex-based extraction for when LLM fails or confidence is low
export function extractFieldsWithRegex(ocrText: string): Partial<ExtractedFields> {
  const result: Partial<ExtractedFields> = {}

  // Grade level patterns
  const gradeMatch = ocrText.match(
    /(?:grade|gr\.?)\s*([K1-8]|[1-9](?:st|nd|rd|th)?|kindergarten)/i
  )
  if (gradeMatch) {
    result.gradeLevel = gradeMatch[0].trim()
  }

  // Duration patterns
  const durationMatch = ocrText.match(/(\d+)\s*(?:minutes?|mins?|hours?|hrs?)/i)
  if (durationMatch) {
    result.duration = durationMatch[0].trim()
  }

  // Subject patterns
  const subjectPatterns = [
    /\b(math(?:ematics)?)\b/i,
    /\b(reading|literacy|ela|english language arts)\b/i,
    /\b(science)\b/i,
    /\b(social studies|history|geography)\b/i,
    /\b(writing)\b/i,
    /\b(phonics)\b/i,
  ]

  for (const pattern of subjectPatterns) {
    const match = ocrText.match(pattern)
    if (match) {
      result.subject = match[1]
      break
    }
  }

  // SWBAT/Objectives patterns
  const swbatMatches = ocrText.match(
    /(?:SWBAT|students will be able to|objective[s]?:?|learning goal[s]?:?)\s*([^.]+)/gi
  )
  if (swbatMatches) {
    result.objectives = swbatMatches.map((s) => s.trim())
  }

  // Materials patterns
  const materialsMatch = ocrText.match(/materials?:?\s*([^\n]+(?:\n[•\-*]\s*[^\n]+)*)/i)
  if (materialsMatch) {
    result.materials = materialsMatch[1]
      .split(/[•\-*\n,]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  return result
}

// Combine LLM and regex results for better accuracy
export async function extractFields(ocrText: string): Promise<ExtractedFields> {
  try {
    const llmResult = await extractFieldsWithLLM(ocrText)

    // If LLM confidence is low, supplement with regex
    if (llmResult.confidence < 0.5) {
      const regexResult = extractFieldsWithRegex(ocrText)

      return {
        ...llmResult,
        subject: llmResult.subject || regexResult.subject || null,
        gradeLevel: llmResult.gradeLevel || regexResult.gradeLevel || null,
        duration: llmResult.duration || regexResult.duration || null,
        objectives:
          llmResult.objectives.length > 0
            ? llmResult.objectives
            : regexResult.objectives || [],
        materials:
          llmResult.materials.length > 0
            ? llmResult.materials
            : regexResult.materials || [],
      }
    }

    return llmResult
  } catch (error) {
    console.error('LLM extraction failed, falling back to regex:', error)
    const regexResult = extractFieldsWithRegex(ocrText)
    return {
      subject: regexResult.subject || null,
      gradeLevel: regexResult.gradeLevel || null,
      duration: regexResult.duration || null,
      objectives: regexResult.objectives || [],
      materials: regexResult.materials || [],
      vocabulary: [],
      activities: [],
      assessment: null,
      confidence: 0.2,
    }
  }
}
