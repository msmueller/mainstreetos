'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Communication, CommunicationType, CommunicationDirection } from '@/lib/types'

interface CommFormProps {
  contactId: string
  contactEmail: string | null
  contactPhone: string | null
  onSaved: (comm: Communication) => void
  onCancel: () => void
}

export default function CommForm({ contactId, contactEmail, contactPhone, onSaved, onCancel }: CommFormProps) {
  const [commType, setCommType] = useState<CommunicationType>('note')
  const [direction, setDirection] = useState<CommunicationDirection>('outbound')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(contactPhone || '')
  const [duration, setDuration] = useState('')
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16) // datetime-local format
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const record = {
        broker_id: user.id,
        contact_id: contactId,
        comm_type: commType,
        direction: commType === 'note' ? null : direction,
        subject: subject.trim() || null,
        body: body.trim() || null,
        phone_number: (commType === 'phone' || commType === 'text') ? phoneNumber.trim() || null : null,
        duration_minutes: commType === 'phone' && duration ? parseInt(duration) : null,
        from_address: commType === 'email' && direction === 'outbound' ? user.email : (commType === 'email' ? contactEmail : null),
        to_addresses: commType === 'email' && direction === 'outbound' ? (contactEmail ? [contactEmail] : []) : (commType === 'email' ? (user.email ? [user.email] : []) : null),
        occurred_at: new Date(occurredAt).toISOString(),
        logged_by: 'manual',
      }

      const { data, error: dbError } = await supabase
        .from('communications')
        .insert(record)
        .select()
        .single()

      if (dbError) throw dbError

      onSaved(data as Communication)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-slate-900 mb-3">Log Communication</h4>

      {/* Type selector */}
      <div className="flex gap-1.5 mb-3">
        {(['email', 'phone', 'note', 'text'] as CommunicationType[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setCommType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              commType === t
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t === 'email' ? '✉ Email' : t === 'phone' ? '📞 Phone' : t === 'note' ? '📝 Note' : '💬 Text'}
          </button>
        ))}
      </div>

      {/* Direction (not for notes) */}
      {commType !== 'note' && (
        <div className="flex gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setDirection('outbound')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              direction === 'outbound'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            → Sent / Outbound
          </button>
          <button
            type="button"
            onClick={() => setDirection('inbound')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              direction === 'inbound'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            ← Received / Inbound
          </button>
        </div>
      )}

      {/* Phone number for phone/text */}
      {(commType === 'phone' || commType === 'text') && (
        <input
          type="text"
          placeholder="Phone number"
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      )}

      {/* Duration for phone calls */}
      {commType === 'phone' && (
        <input
          type="number"
          placeholder="Duration (minutes)"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      )}

      {/* Subject */}
      <input
        type="text"
        placeholder={commType === 'email' ? 'Email subject' : commType === 'phone' ? 'Call topic' : commType === 'text' ? 'Text topic (optional)' : 'Note title (optional)'}
        value={subject}
        onChange={e => setSubject(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {/* Body */}
      <textarea
        placeholder={commType === 'email' ? 'Email body or summary...' : commType === 'phone' ? 'Call notes...' : commType === 'text' ? 'Text content...' : 'Note content...'}
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />

      {/* Date/time */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-500 mb-1">When did this happen?</label>
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={e => setOccurredAt(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || (!body.trim() && !subject.trim())}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
