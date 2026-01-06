'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { Profile, AutoScheduleRule } from '@/types/database'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SUBJECTS = ['Math', 'Reading', 'ELA', 'Science', 'Social Studies', 'Writing', 'Phonics', 'Art', 'Music', 'PE']

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [scheduleRules, setScheduleRules] = useState<AutoScheduleRule[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // New rule form
  const [newRule, setNewRule] = useState({
    subject: '',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '09:45',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
      } else {
        // Create profile if doesn't exist
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({ id: user.id, email: user.email! })
          .select()
          .single()
        setProfile(newProfile)
      }

      const { data: rules } = await supabase
        .from('auto_schedule_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true })

      setScheduleRules(rules || [])
    }
  }

  const handleProfileSave = async () => {
    if (!profile) return
    setSaving(true)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        school_name: profile.school_name,
        grade_level: profile.grade_level,
        timezone: profile.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save profile' })
    } else {
      setMessage({ type: 'success', text: 'Profile saved!' })
    }
    setSaving(false)
  }

  const handleAddRule = async () => {
    if (!newRule.subject) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase.from('auto_schedule_rules').insert({
      user_id: user.id,
      subject: newRule.subject,
      day_of_week: newRule.day_of_week,
      start_time: newRule.start_time,
      end_time: newRule.end_time,
    })

    if (!error) {
      fetchData()
      setNewRule({
        subject: '',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '09:45',
      })
    }
  }

  const handleDeleteRule = async (id: string) => {
    const supabase = createClient()
    await supabase.from('auto_schedule_rules').delete().eq('id', id)
    fetchData()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your profile and schedule preferences</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profile Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Full Name"
            value={profile?.full_name || ''}
            onChange={(e) => setProfile((prev) => prev ? { ...prev, full_name: e.target.value } : null)}
            placeholder="Jane Smith"
          />
          <Input
            label="School Name"
            value={profile?.school_name || ''}
            onChange={(e) => setProfile((prev) => prev ? { ...prev, school_name: e.target.value } : null)}
            placeholder="Lincoln Elementary"
          />
          <Input
            label="Grade Level"
            value={profile?.grade_level || ''}
            onChange={(e) => setProfile((prev) => prev ? { ...prev, grade_level: e.target.value } : null)}
            placeholder="3rd Grade"
          />
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Timezone</label>
            <select
              value={profile?.timezone || 'America/New_York'}
              onChange={(e) => setProfile((prev) => prev ? { ...prev, timezone: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>
          <Button onClick={handleProfileSave} loading={saving}>
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Schedule Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Rules</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Set your regular teaching schedule for auto-scheduling lessons
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing Rules */}
          {scheduleRules.length > 0 && (
            <div className="space-y-2">
              {scheduleRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="font-medium">{rule.subject}</span>
                    <span className="text-gray-500 mx-2">•</span>
                    <span className="text-gray-600">{DAYS[rule.day_of_week]}</span>
                    <span className="text-gray-500 mx-2">•</span>
                    <span className="text-gray-600">
                      {rule.start_time} - {rule.end_time}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Rule */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Add Schedule Block</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select
                value={newRule.subject}
                onChange={(e) => setNewRule((prev) => ({ ...prev, subject: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Subject</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={newRule.day_of_week}
                onChange={(e) => setNewRule((prev) => ({ ...prev, day_of_week: parseInt(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DAYS.map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
              <input
                type="time"
                value={newRule.start_time}
                onChange={(e) => setNewRule((prev) => ({ ...prev, start_time: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="time"
                value={newRule.end_time}
                onChange={(e) => setNewRule((prev) => ({ ...prev, end_time: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button
              onClick={handleAddRule}
              variant="outline"
              className="mt-3"
              disabled={!newRule.subject}
            >
              Add Block
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
