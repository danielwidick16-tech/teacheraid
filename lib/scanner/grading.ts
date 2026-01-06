// Grading logic for different question types

export type QuestionType = 'multiple_choice' | 'fill_in' | 'short_answer' | 'true_false' | 'math' | 'unknown'

export interface GradeResult {
  isCorrect: boolean
  confidence: number
  pointsEarned: number
  needsReview: boolean
  feedback?: string
}

export interface GradeOptions {
  pointsPossible: number
  acceptedVariants?: string[]
  tolerance?: number // For math questions
}

/**
 * Grade a student answer against a correct answer
 */
export function gradeQuestion(
  studentAnswer: string,
  correctAnswer: string,
  questionType: QuestionType,
  options: GradeOptions
): GradeResult {
  const { pointsPossible, acceptedVariants = [], tolerance = 0.01 } = options

  // Normalize both answers
  const normalizedStudent = normalizeAnswer(studentAnswer, questionType)
  const normalizedCorrect = normalizeAnswer(correctAnswer, questionType)

  // Check all accepted variants
  const allCorrectAnswers = [normalizedCorrect, ...acceptedVariants.map(v => normalizeAnswer(v, questionType))]

  let isCorrect = false
  let confidence = 0
  let needsReview = false

  switch (questionType) {
    case 'multiple_choice':
      ({ isCorrect, confidence } = gradeMultipleChoice(normalizedStudent, allCorrectAnswers))
      break

    case 'true_false':
      ({ isCorrect, confidence } = gradeTrueFalse(normalizedStudent, normalizedCorrect))
      break

    case 'fill_in':
      ({ isCorrect, confidence, needsReview } = gradeFillIn(normalizedStudent, allCorrectAnswers))
      break

    case 'math':
      ({ isCorrect, confidence, needsReview } = gradeMath(normalizedStudent, normalizedCorrect, tolerance))
      break

    case 'short_answer':
      ({ isCorrect, confidence, needsReview } = gradeShortAnswer(normalizedStudent, allCorrectAnswers))
      break

    default:
      // Unknown type - mark for review
      needsReview = true
      confidence = 0.5
      isCorrect = normalizedStudent === normalizedCorrect
  }

  return {
    isCorrect,
    confidence,
    pointsEarned: isCorrect ? pointsPossible : 0,
    needsReview,
    feedback: needsReview ? 'Manual review recommended' : undefined,
  }
}

/**
 * Normalize answer based on question type
 */
function normalizeAnswer(answer: string, type: QuestionType): string {
  if (!answer) return ''

  let normalized = answer.trim().toLowerCase()

  // Remove common OCR artifacts
  normalized = normalized
    .replace(/['"''""]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '')

  switch (type) {
    case 'multiple_choice':
      // Extract just the letter (A, B, C, D, etc.)
      const letterMatch = normalized.match(/^([a-e])[\.\)\:]?\s*/)
      if (letterMatch) {
        return letterMatch[1]
      }
      // If it's just a single letter
      if (/^[a-e]$/.test(normalized)) {
        return normalized
      }
      return normalized

    case 'true_false':
      // Normalize true/false variations
      if (['true', 't', 'yes', 'y', '1', 'correct'].includes(normalized)) {
        return 'true'
      }
      if (['false', 'f', 'no', 'n', '0', 'incorrect'].includes(normalized)) {
        return 'false'
      }
      return normalized

    case 'math':
      // Remove spaces, normalize mathematical expressions
      normalized = normalized
        .replace(/\s/g, '')
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/,/g, '') // Remove thousands separators
      return normalized

    default:
      return normalized
  }
}

/**
 * Grade multiple choice question
 */
function gradeMultipleChoice(
  student: string,
  correct: string[]
): { isCorrect: boolean; confidence: number } {
  const isCorrect = correct.includes(student)

  // High confidence for MC since it's exact match
  const confidence = student.length === 1 ? 0.95 : 0.85

  return { isCorrect, confidence }
}

/**
 * Grade true/false question
 */
function gradeTrueFalse(
  student: string,
  correct: string
): { isCorrect: boolean; confidence: number } {
  const isCorrect = student === correct

  // High confidence for T/F
  const confidence = 0.95

  return { isCorrect, confidence }
}

/**
 * Grade fill-in-the-blank question
 */
function gradeFillIn(
  student: string,
  correct: string[]
): { isCorrect: boolean; confidence: number; needsReview: boolean } {
  // Check exact match
  if (correct.includes(student)) {
    return { isCorrect: true, confidence: 0.95, needsReview: false }
  }

  // Check fuzzy match (Levenshtein distance)
  for (const answer of correct) {
    const similarity = calculateSimilarity(student, answer)

    if (similarity >= 0.9) {
      return { isCorrect: true, confidence: 0.85, needsReview: false }
    }

    if (similarity >= 0.75) {
      // Close enough to flag for review
      return { isCorrect: false, confidence: 0.6, needsReview: true }
    }
  }

  return { isCorrect: false, confidence: 0.8, needsReview: false }
}

/**
 * Grade math question
 */
function gradeMath(
  student: string,
  correct: string,
  tolerance: number
): { isCorrect: boolean; confidence: number; needsReview: boolean } {
  // Try to parse as numbers
  const studentNum = parseNumber(student)
  const correctNum = parseNumber(correct)

  if (studentNum !== null && correctNum !== null) {
    // Compare numerically with tolerance
    const diff = Math.abs(studentNum - correctNum)
    const isCorrect = diff <= Math.abs(correctNum * tolerance)

    return { isCorrect, confidence: 0.9, needsReview: false }
  }

  // Fall back to string comparison for expressions
  if (student === correct) {
    return { isCorrect: true, confidence: 0.85, needsReview: false }
  }

  // Mark for review if we can't parse
  return { isCorrect: false, confidence: 0.5, needsReview: true }
}

/**
 * Grade short answer question
 */
function gradeShortAnswer(
  student: string,
  correct: string[]
): { isCorrect: boolean; confidence: number; needsReview: boolean } {
  // Check exact match
  if (correct.includes(student)) {
    return { isCorrect: true, confidence: 0.95, needsReview: false }
  }

  // Check if student answer contains the correct answer
  for (const answer of correct) {
    if (student.includes(answer) || answer.includes(student)) {
      return { isCorrect: true, confidence: 0.75, needsReview: true }
    }
  }

  // Check word overlap
  for (const answer of correct) {
    const similarity = calculateWordOverlap(student, answer)

    if (similarity >= 0.8) {
      return { isCorrect: true, confidence: 0.7, needsReview: true }
    }

    if (similarity >= 0.5) {
      return { isCorrect: false, confidence: 0.5, needsReview: true }
    }
  }

  return { isCorrect: false, confidence: 0.7, needsReview: false }
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(a: string, b: string): number {
  if (a.length === 0) return b.length === 0 ? 1 : 0
  if (b.length === 0) return 0

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  const maxLen = Math.max(a.length, b.length)
  return 1 - matrix[b.length][a.length] / maxLen
}

/**
 * Calculate word overlap between two strings
 */
function calculateWordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let overlap = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++
  }

  return overlap / Math.max(wordsA.size, wordsB.size)
}

/**
 * Parse a string as a number
 */
function parseNumber(str: string): number | null {
  // Handle fractions
  const fractionMatch = str.match(/^(-?\d+)\/(\d+)$/)
  if (fractionMatch) {
    return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2])
  }

  // Handle percentages
  const percentMatch = str.match(/^(-?\d+(?:\.\d+)?)\s*%$/)
  if (percentMatch) {
    return parseFloat(percentMatch[1]) / 100
  }

  // Handle regular numbers
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

/**
 * Detect question type from answer content
 */
export function detectQuestionType(answer: string): QuestionType {
  const normalized = answer.trim().toLowerCase()

  // Single letter = multiple choice
  if (/^[a-e][\.\)\:]?$/.test(normalized)) {
    return 'multiple_choice'
  }

  // True/False variants
  if (['true', 'false', 't', 'f', 'yes', 'no'].includes(normalized)) {
    return 'true_false'
  }

  // Numeric = math
  if (/^-?\d+(?:\.\d+)?(?:\/\d+)?%?$/.test(normalized.replace(/\s/g, ''))) {
    return 'math'
  }

  // Short single word = fill in
  if (normalized.split(/\s+/).length <= 3) {
    return 'fill_in'
  }

  // Longer text = short answer
  return 'short_answer'
}
