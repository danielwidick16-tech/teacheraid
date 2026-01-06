'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CameraCaptureProps {
  onCapture: (files: File[]) => void
  maxFiles?: number
}

export function CameraCapture({ onCapture, maxFiles = 10 }: CameraCaptureProps) {
  const [capturedImages, setCapturedImages] = useState<{ file: File; preview: string }[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera on mobile
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsCapturing(true)
    } catch (error) {
      console.error('Failed to access camera:', error)
      alert('Could not access camera. Please check permissions or use file upload.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsCapturing(false)
  }

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
        const preview = URL.createObjectURL(blob)
        setCapturedImages((prev) => [...prev, { file, preview }])
      },
      'image/jpeg',
      0.8
    )
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newImages = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))

    setCapturedImages((prev) => [...prev, ...newImages].slice(0, maxFiles))
  }

  const removeImage = (index: number) => {
    setCapturedImages((prev) => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  const handleDone = () => {
    stopCamera()
    onCapture(capturedImages.map((img) => img.file))
  }

  return (
    <div className="space-y-4">
      {/* Camera Controls */}
      {!isCapturing ? (
        <div className="grid grid-cols-2 gap-4">
          <Button onClick={startCamera} className="h-32 flex-col gap-2" variant="outline">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Use Camera</span>
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="h-32 flex-col gap-2"
            variant="outline"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Upload Photos</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-t-xl"
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button onClick={stopCamera} variant="secondary">
                Cancel
              </Button>
              <Button
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white border-4 border-blue-500"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Captured Images Preview */}
      {capturedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">
              {capturedImages.length} image{capturedImages.length > 1 ? 's' : ''} captured
            </h3>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
              Add More
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {capturedImages.map((img, index) => (
              <div key={index} className="relative aspect-[3/4] rounded-lg overflow-hidden">
                <img
                  src={img.preview}
                  alt={`Capture ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
          <Button onClick={handleDone} className="w-full" size="lg">
            Process {capturedImages.length} Image{capturedImages.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  )
}
