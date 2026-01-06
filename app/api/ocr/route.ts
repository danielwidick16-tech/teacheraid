import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { performOcr } from '@/lib/google-vision/client'
import { extractFields } from '@/lib/ocr/extract-fields'
import type { Json } from '@/types/database'

export const maxDuration = 60 // Allow up to 60 seconds for OCR processing

export async function POST(request: NextRequest) {
  const { imagePaths, curriculumSourceId } = await request.json()

  if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
    return new Response(JSON.stringify({ error: 'No image paths provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const send = (event: string, data: object) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        const allText: string[] = []
        const ocrResults: { pageId: string; text: string; confidence: number }[] = []

        // Process each image
        for (let i = 0; i < imagePaths.length; i++) {
          send('progress', {
            current: i + 1,
            total: imagePaths.length,
            status: 'ocr',
            message: `Processing image ${i + 1} of ${imagePaths.length}...`,
          })

          const storagePath = imagePaths[i]

          // Download image from Supabase Storage
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('curriculum-images')
            .download(storagePath)

          if (downloadError) {
            send('error', {
              index: i,
              message: `Failed to download image: ${downloadError.message}`,
            })
            continue
          }

          // Convert to buffer
          const arrayBuffer = await imageData.arrayBuffer()
          const imageBuffer = Buffer.from(arrayBuffer)

          // Perform OCR
          try {
            const ocrResult = await performOcr(imageBuffer)
            allText.push(ocrResult.text)

            // Get the curriculum page ID for this image
            const { data: pageData } = await supabase
              .from('curriculum_pages')
              .select('id')
              .eq('storage_path', storagePath)
              .single()

            if (pageData) {
              // Save OCR result to database
              await supabase.from('ocr_results').upsert({
                curriculum_page_id: pageData.id,
                user_id: user.id,
                raw_text: ocrResult.text,
                structured_blocks: ocrResult.blocks as unknown as Json,
                confidence: ocrResult.confidence,
                status: 'completed',
                processing_time_ms: ocrResult.processingTimeMs,
              })

              ocrResults.push({
                pageId: pageData.id,
                text: ocrResult.text,
                confidence: ocrResult.confidence,
              })
            }

            send('ocr-complete', {
              index: i,
              preview: ocrResult.text.slice(0, 300),
              confidence: ocrResult.confidence,
            })
          } catch (ocrError) {
            console.error('OCR error:', ocrError)
            send('error', {
              index: i,
              message: `OCR failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
            })
          }
        }

        // Extract fields from combined text
        if (allText.length > 0) {
          send('progress', {
            status: 'extracting',
            message: 'Analyzing curriculum content...',
          })

          const combinedText = allText.join('\n\n---PAGE BREAK---\n\n')
          const fields = await extractFields(combinedText)

          // Save extraction result
          if (curriculumSourceId) {
            await supabase.from('extraction_results').upsert({
              curriculum_source_id: curriculumSourceId,
              user_id: user.id,
              detected_fields: fields as unknown as Json,
            })

            // Update curriculum source status
            await supabase
              .from('curriculum_sources')
              .update({ status: 'completed' })
              .eq('id', curriculumSourceId)
          }

          send('complete', {
            fields,
            curriculumSourceId,
            totalPages: imagePaths.length,
            successfulPages: ocrResults.length,
          })
        } else {
          send('error', {
            message: 'No text could be extracted from any images',
          })
        }
      } catch (error) {
        console.error('OCR processing error:', error)
        send('error', {
          message: error instanceof Error ? error.message : 'Processing failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
