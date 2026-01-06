'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { exportToPDF } from '@/lib/utils/pdf'

interface PrintButtonProps {
  contentId: string
  title: string
}

export function PrintButton({ contentId, title }: PrintButtonProps) {
  const [loading, setLoading] = useState(false)

  const handlePrint = async () => {
    setLoading(true)
    try {
      await exportToPDF(contentId, `sub-packet-${title.replace(/\s+/g, '-').toLowerCase()}`)
    } catch (error) {
      console.error('PDF export failed:', error)
      // Fallback to browser print
      window.print()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handlePrint} variant="outline" loading={loading}>
      <svg
        className="w-4 h-4 mr-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
        />
      </svg>
      {loading ? 'Generating PDF...' : 'Download PDF'}
    </Button>
  )
}
