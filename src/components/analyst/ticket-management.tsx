'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPE_LABELS,
  TICKET_AREA_LABELS,
  cn,
} from '@/lib/utils'
import type { Ticket, TicketStatus, TicketPriority, TicketType, TicketArea } from '@/lib/types'
import { Lock, MessageSquare } from 'lucide-react'

interface TicketManagementProps {
  ticket: Ticket
  analysts: { id: string; full_name: string }[]
  currentUserId: string
}

export function TicketManagement({ ticket, analysts, currentUserId }: TicketManagementProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    status: ticket.status,
    priority: ticket.priority,
    type: ticket.type,
    area: ticket.area ?? '',
    assignee_id: ticket.assignee_id ?? '',
  })

  const dirty =
    form.status !== ticket.status ||
    form.priority !== ticket.priority ||
    form.type !== ticket.type ||
    form.area !== (ticket.area ?? '') ||
    form.assignee_id !== (ticket.assignee_id ?? '')

  async function handleSave() {
    setSaving(true)

    const updates: Record<string, unknown> = {
      status: form.status,
      priority: form.priority,
      type: form.type,
      area: form.area || null,
      assignee_id: form.assignee_id || null,
    }

    if (['resolved', 'closed'].includes(form.status) && !ticket.resolved_at) {
      updates.resolved_at = new Date().toISOString()
    }
    if (!['resolved', 'closed'].includes(form.status)) {
      updates.resolved_at = null
    }

    await supabase.from('tickets').update(updates).eq('id', ticket.id)

    setSaving(false)
    router.refresh()
  }

  const statusOptions = Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ value, label }))
  const priorityOptions = Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))
  const typeOptions = Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => ({ value, label }))
  const areaOptions = Object.entries(TICKET_AREA_LABELS).map(([value, label]) => ({ value, label }))
  const agentOptions = analysts.map((a) => ({
    value: a.id,
    label: a.id === currentUserId ? `${a.full_name} (eu)` : a.full_name,
  }))

  return (
    <Card>
      <CardHeader><CardTitle>Triagem</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        <Select
          label="Agente"
          options={agentOptions}
          placeholder="Não atribuído"
          value={form.assignee_id}
          onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
        />
        <Select
          label="Status"
          options={statusOptions}
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as TicketStatus })}
        />
        <Select
          label="Prioridade"
          options={priorityOptions}
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            options={typeOptions}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as TicketType })}
          />
          <Select
            label="Área"
            options={areaOptions}
            placeholder="Definir..."
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value as TicketArea | '' })}
          />
        </div>
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!dirty}
          className="w-full"
          size="sm"
        >
          Salvar alterações
        </Button>
      </CardContent>
    </Card>
  )
}

export function CommentForm({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      author_id: user.id,
      content: content.trim(),
      is_internal: isInternal,
    })

    setContent('')
    setIsInternal(false)
    setSending(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 border-t border-zinc-800/70 space-y-3">
      <Textarea
        placeholder={isInternal ? 'Nota interna (visível só para analistas)...' : 'Responder ao solicitante...'}
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={isInternal ? 'border-amber-500/30 bg-amber-500/[0.03]' : ''}
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsInternal(!isInternal)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors',
            isInternal
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
          )}
        >
          {isInternal ? <Lock className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
          {isInternal ? 'Nota interna' : 'Resposta pública'}
        </button>
        <Button type="submit" size="sm" loading={sending} disabled={!content.trim()}>
          Enviar
        </Button>
      </div>
    </form>
  )
}
