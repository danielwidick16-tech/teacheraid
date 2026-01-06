'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { format, addDays } from 'date-fns'
import type { ShareLink } from '@/types/database'

export default function SharePage() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [pin, setPin] = useState('')
  const [usePin, setUsePin] = useState(false)
  const [expiresIn, setExpiresIn] = useState<number | null>(7)
  const [creating, setCreating] = useState(false)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [existingLinks, setExistingLinks] = useState<ShareLink[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchExistingLinks()
  }, [])

  const fetchExistingLinks = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('share_links')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setExistingLinks(data)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    setCreatedLink(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('Please sign in')
        return
      }

      const { nanoid } = await import('nanoid')
      const shareCode = nanoid(12)

      let pinHash = null
      if (usePin && pin) {
        const bcrypt = await import('bcryptjs')
        pinHash = await bcrypt.hash(pin, 10)
      }

      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
        : null

      const { error } = await supabase.from('share_links').insert({
        user_id: user.id,
        share_code: shareCode,
        pin_hash: pinHash,
        start_date: startDate,
        end_date: endDate,
        expires_at: expiresAt,
      })

      if (error) throw error

      const baseUrl = window.location.origin
      setCreatedLink(`${baseUrl}/sub/${shareCode}`)
      fetchExistingLinks()
    } catch (error) {
      console.error('Error creating share link:', error)
      alert('Failed to create share link')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = () => {
    if (createdLink) {
      navigator.clipboard.writeText(createdLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDeactivate = async (id: string) => {
    const supabase = createClient()
    await supabase.from('share_links').update({ is_active: false }).eq('id', id)
    fetchExistingLinks()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Share with Substitute</h1>
        <p className="text-gray-600">Create a view-only link for your substitute teacher</p>
      </div>

      {/* Create New Link */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Sub Packet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="usePin"
              checked={usePin}
              onChange={(e) => setUsePin(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="usePin" className="text-sm text-gray-700">
              Require PIN for access
            </label>
          </div>

          {usePin && (
            <Input
              type="text"
              label="PIN (4-6 digits)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter PIN"
              maxLength={6}
            />
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Link Expiration</label>
            <div className="flex gap-2">
              {[1, 3, 7, 30, null].map((days) => (
                <button
                  key={days ?? 'never'}
                  onClick={() => setExpiresIn(days)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    expiresIn === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {days ? `${days}d` : 'Never'}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleCreate} loading={creating} className="w-full">
            Create Share Link
          </Button>

          {createdLink && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-700 mb-2">Link created!</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createdLink}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-white border border-green-300 rounded"
                />
                <Button onClick={handleCopy} variant="outline">
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              {usePin && pin && (
                <p className="mt-2 text-sm text-green-600">PIN: {pin}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Links */}
      <Card>
        <CardHeader>
          <CardTitle>Active Share Links</CardTitle>
        </CardHeader>
        <CardContent>
          {existingLinks.length > 0 ? (
            <div className="space-y-3">
              {existingLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(link.start_date), 'MMM d')} -{' '}
                      {format(new Date(link.end_date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {link.view_count} views
                      {link.pin_hash && ' • PIN protected'}
                      {link.expires_at && ` • Expires ${format(new Date(link.expires_at), 'MMM d')}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/sub/${link.share_code}`
                        )
                      }}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivate(link.id)}
                    >
                      Deactivate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No active share links</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
