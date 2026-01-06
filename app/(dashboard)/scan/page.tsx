'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CameraCapture } from '@/components/scan/camera-capture'
import { OcrProgress } from '@/components/scan/ocr-progress'
import { FieldEditor } from '@/components/scan/field-editor'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ExtractedFields } from '@/lib/ocr/extract-fields'
import type { Json } from '@/types/database'

type Step = 'capture' | 'processing' | 'review' | 'generating' | 'complete'

interface ProcessingState {
  current: number
  total: number
  status: 'uploading' | 'ocr' | 'extracting' | 'complete' | 'error'
  message?: string
}

export default function ScanPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [processingState, setProcessingState] = useState<ProcessingState>({
    current: 0,
    total: 0,
    status: 'uploading',
  })
  const [extractedFields, setExtractedFields] = useState<ExtractedFields | null>(null)
  const [curriculumSourceId, setCurriculumSourceId] = useState<string | null>(null)
  const [rawOcrText, setRawOcrText] = useState<string>('')
  const [generatedPlanId, setGeneratedPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCapture = useCallback(async (files: File[]) => {
    setStep('processing')
    setError(null)
    setProcessingState({ current: 0, total: files.length, status: 'uploading' })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('Please sign in to continue')
      setStep('capture')
      return
    }

    try {
      // Create curriculum source record
      const { data: source, error: sourceError } = await supabase
        .from('curriculum_sources')
        .insert({
          user_id: user.id,
          source_type: 'scan',
          status: 'processing',
        })
        .select()
        .single()

      if (sourceError) throw sourceError
      setCurriculumSourceId(source.id)

      // Upload images to Supabase Storage
      const imagePaths: string[] = []

      for (let i = 0; i < files.length; i++) {
        setProcessingState((prev) => ({
          ...prev,
          current: i + 1,
          status: 'uploading',
          message: `Uploading image ${i + 1} of ${files.length}...`,
        }))

        const file = files[i]
        const path = `${user.id}/${source.id}/${Date.now()}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('curriculum-images')
          .upload(path, file)

        if (uploadError) throw uploadError

        // Create curriculum page record
        await supabase.from('curriculum_pages').insert({
          curriculum_source_id: source.id,
          user_id: user.id,
          storage_path: path,
          page_number: i + 1,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        })

        imagePaths.push(path)
      }

      // Call OCR API with SSE
      setProcessingState((prev) => ({
        ...prev,
        status: 'ocr',
        current: 0,
        message: 'Starting OCR processing...',
      }))

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePaths,
          curriculumSourceId: source.id,
        }),
      })

      if (!response.ok) {
        throw new Error('OCR processing failed')
      }

      // Handle SSE stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let ocrTexts: string[] = []

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.status === 'ocr') {
                  setProcessingState((prev) => ({
                    ...prev,
                    status: 'ocr',
                    current: data.current || prev.current,
                    total: data.total || prev.total,
                    message: data.message,
                  }))
                } else if (data.status === 'extracting') {
                  setProcessingState((prev) => ({
                    ...prev,
                    status: 'extracting',
                    message: data.message,
                  }))
                } else if (data.preview) {
                  ocrTexts.push(data.preview)
                } else if (data.fields) {
                  setExtractedFields(data.fields)
                  setRawOcrText(ocrTexts.join('\n\n'))
                  setProcessingState((prev) => ({
                    ...prev,
                    status: 'complete',
                    message: 'Processing complete!',
                  }))
                  setStep('review')
                } else if (data.message && line.includes('error')) {
                  throw new Error(data.message)
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Processing error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setProcessingState((prev) => ({ ...prev, status: 'error' }))
    }
  }, [])

  const handleGeneratePlan = async (fields: ExtractedFields) => {
    setStep('generating')
    setError(null)

    try {
      // Save user edits
      if (curriculumSourceId) {
        const supabase = createClient()
        await supabase
          .from('extraction_results')
          .update({ user_edits: fields as unknown as Json })
          .eq('curriculum_source_id', curriculumSourceId)
      }

      // Generate lesson plan
      const response = await fetch('/api/plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          fields,
          rawText: rawOcrText,
          curriculumSourceId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate plan')
      }

      const { plan } = await response.json()
      setGeneratedPlanId(plan.id)
      setStep('complete')
    } catch (err) {
      console.error('Plan generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate plan')
      setStep('review')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scan Curriculum</h1>
        <p className="text-gray-600">
          Take photos of your curriculum materials to generate a lesson plan
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {step === 'capture' && (
        <CameraCapture onCapture={handleCapture} maxFiles={10} />
      )}

      {step === 'processing' && (
        <OcrProgress
          current={processingState.current}
          total={processingState.total}
          status={processingState.status}
          message={processingState.message}
        />
      )}

      {step === 'review' && extractedFields && (
        <FieldEditor
          fields={extractedFields}
          onSave={handleGeneratePlan}
          onBack={() => setStep('capture')}
        />
      )}

      {step === 'generating' && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Generating Your Lesson Plan
            </h3>
            <p className="text-gray-500">
              Our AI is creating a detailed, classroom-ready lesson plan...
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'complete' && generatedPlanId && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Lesson Plan Created!
            </h3>
            <p className="text-gray-500 mb-6">
              Your lesson plan has been generated and saved.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => router.push(`/plans/${generatedPlanId}`)}>
                View Lesson Plan
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep('capture')
                  setExtractedFields(null)
                  setCurriculumSourceId(null)
                  setGeneratedPlanId(null)
                }}
              >
                Scan Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
