'use client'

interface OcrProgressProps {
  current: number
  total: number
  status: 'uploading' | 'ocr' | 'extracting' | 'complete' | 'error'
  message?: string
}

export function OcrProgress({ current, total, status, message }: OcrProgressProps) {
  const percentage =
    status === 'uploading'
      ? Math.round((current / total) * 33)
      : status === 'ocr'
        ? 33 + Math.round((current / total) * 33)
        : status === 'extracting'
          ? 80
          : status === 'complete'
            ? 100
            : 0

  const statusLabels = {
    uploading: 'Uploading images...',
    ocr: 'Reading text from images...',
    extracting: 'Analyzing curriculum content...',
    complete: 'Done!',
    error: 'Error occurred',
  }

  return (
    <div className="space-y-4 p-6 bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status !== 'complete' && status !== 'error' && (
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          {status === 'complete' && (
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
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
          )}
          {status === 'error' && (
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">{statusLabels[status]}</p>
            {message && <p className="text-sm text-gray-500">{message}</p>}
          </div>
        </div>
        <span className="text-sm text-gray-500">{percentage}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {(status === 'ocr' || status === 'uploading') && total > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < current ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
