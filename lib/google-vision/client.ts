import { ImageAnnotatorClient, protos } from '@google-cloud/vision'

let client: ImageAnnotatorClient | null = null

export function getVisionClient(): ImageAnnotatorClient {
  if (client) return client

  // Check for base64-encoded credentials (for deployment)
  if (process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64) {
    const credentialsJson = Buffer.from(
      process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64,
      'base64'
    ).toString('utf-8')

    const credentials = JSON.parse(credentialsJson)

    client = new ImageAnnotatorClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      projectId: credentials.project_id,
    })
  } else {
    // Fall back to application default credentials (local dev with gcloud)
    client = new ImageAnnotatorClient()
  }

  return client
}

export interface OcrResult {
  text: string
  blocks: protos.google.cloud.vision.v1.IBlock[]
  confidence: number
  processingTimeMs: number
}

export async function performOcr(imageBuffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now()
  const visionClient = getVisionClient()

  const [result] = await visionClient.documentTextDetection({
    image: { content: imageBuffer },
    imageContext: {
      languageHints: ['en'],
    },
  })

  const fullTextAnnotation = result.fullTextAnnotation
  const text = fullTextAnnotation?.text || ''

  // Extract blocks for structured data
  const blocks = fullTextAnnotation?.pages?.[0]?.blocks || []

  // Calculate average confidence
  let totalConfidence = 0
  let symbolCount = 0

  for (const page of fullTextAnnotation?.pages || []) {
    for (const block of page.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const word of paragraph.words || []) {
          for (const symbol of word.symbols || []) {
            if (symbol.confidence) {
              totalConfidence += symbol.confidence
              symbolCount++
            }
          }
        }
      }
    }
  }

  const confidence = symbolCount > 0 ? totalConfidence / symbolCount : 0
  const processingTimeMs = Date.now() - startTime

  return {
    text,
    blocks: blocks as protos.google.cloud.vision.v1.IBlock[],
    confidence,
    processingTimeMs,
  }
}
