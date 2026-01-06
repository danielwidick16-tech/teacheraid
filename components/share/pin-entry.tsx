'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

interface PinEntryProps {
  shareCode: string
  error?: string
}

export function PinEntry({ shareCode, error }: PinEntryProps) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Set cookie and redirect
    document.cookie = `sub_pin_${shareCode}=${pin}; path=/; max-age=86400`
    router.push(`/sub/${shareCode}?pin=${pin}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Sub Packet Access</CardTitle>
          <CardDescription>Enter the PIN to view this sub packet</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg text-center">
                {error}
              </div>
            )}
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={pin[i] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    if (val) {
                      const newPin = pin.split('')
                      newPin[i] = val
                      setPin(newPin.join(''))
                      // Auto-focus next input
                      if (i < 5) {
                        const next = e.target.nextElementSibling as HTMLInputElement
                        next?.focus()
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !pin[i] && i > 0) {
                      const prev = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                      prev?.focus()
                    }
                  }}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              ))}
            </div>
            <Button type="submit" className="w-full" loading={loading} disabled={pin.length < 4}>
              View Sub Packet
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
