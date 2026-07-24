'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import {
  TICKET_PRIORITY_LABELS,
  TICKET_TYPE_LABELS,
  TICKET_AREA_LABELS,
  TICKET_STATUS_LABELS,
} from '@/lib/utils'
import type { ServiceCatalogItem, TicketArea, TicketPriority, TicketStatus, TicketType } from '@/lib/types'

type ProfileOption = { id: string; full_name: string; email: string; role: string }

export function AnalystNewTicketForm({
  requesters,
  analysts,
  catalog,
  currentUserId,
}: {
  requesters: ProfileOption[]
  analysts: ProfileOption[]
  catalog: ServiceCatalogItem[]
  currentUserId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    requester_id: '',
    catalog_item_id: '',
    title: '',
    description: '',
    type: 'request' as TicketType,
    priority: 'medium' as TicketPriority,
    area: '' as TicketArea | '',
    status: 'open' as TicketStatus,
    assignee_id: currentUserId,
    approver_id: '',
  })

  const selectedCatalog = useMemo(
    () => catalog.find((item) => item.id === form.catalog_item_id) ?? null,
    [catalog, form.catalog_item_id]
  )

  const needsApprover = form.status === 'awaiting_approval' || Boolean(selectedCatalog?.requires_approval)

  function applyCatalog(catalogItemId: string) {
    const item = catalog.find((row) => row.id === catalogItemId) ?? null
    setForm((prev) => ({
      ...prev,
      catalog_item_id: catalogItemId,
      title: item ? item.title : prev.title,
      description: item && !prev.description ? item.description : prev.description,
      type: item?.slug.includes('incidente') ? 'incident' : item ? 'request' : prev.type,
      priority: (item?.default_priority ?? prev.priority) as TicketPriority,
      area: (item?.area ?? prev.area) as TicketArea | '',
      status: item?.requires_approval ? 'awaiting_approval' : prev.status === 'awaiting_approval' && !item ? 'open' : prev.status,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.requester_id) return toast('Selecione o solicitante', 'error')
    if (!form.title.trim() || !form.description.trim()) return toast('Preencha título e descrição', 'error')
    if (needsApprover && !form.approver_id) return toast('Selecione o aprovador', 'error')

    setLoading(true)
    const { data, error } = await supabase.from('tickets').insert({
      requester_id: form.requester_id,
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      priority: form.priority,
      area: form.area || null,
      status: form.status,
      assignee_id: form.assignee_id || null,
      catalog_item_id: form.catalog_item_id || null,
      approval_status: needsApprover ? 'pending' : 'not_required',
      form_responses: {},
    }).select('id, ticket_number').single()

    if (error || !data) {
      setLoading(false)
      return toast(error?.message || 'Não foi possível abrir o chamado', 'error')
    }

    if (needsApprover) {
      const { error: approvalError } = await supabase.from('ticket_approvals').upsert({
        ticket_id: data.id,
        approver_id: form.approver_id,
        assigned_by: currentUserId,
        decision: 'pending',
        comment: null,
        decided_at: null,
        requested_at: new Date().toISOString(),
      }, { onConflict: 'ticket_id' })

      if (approvalError) {
        setLoading(false)
        toast('Chamado criado, mas falhou ao definir o aprovador', 'error')
        router.push(`/tickets/${data.id}`)
        return
      }
    }

    setLoading(false)
    toast(`Chamado ${data.ticket_number} aberto`)
    router.push(`/tickets/${data.id}`)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <Link href="/tickets" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Chamados
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Abrir chamado</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">Registre um chamado em nome de um colaborador.</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Solicitante"
              required
              placeholder="Selecionar colaborador..."
              options={requesters.map((profile) => ({
                value: profile.id,
                label: `${profile.full_name} · ${profile.email}`,
              }))}
              value={form.requester_id}
              onChange={(e) => setForm({ ...form, requester_id: e.target.value })}
            />

            <Select
              label="Item do catálogo"
              placeholder="Sem catálogo (manual)"
              options={catalog.map((item) => ({
                value: item.id,
                label: item.requires_approval ? `${item.title} (exige aprovação)` : item.title,
              }))}
              value={form.catalog_item_id}
              onChange={(e) => applyCatalog(e.target.value)}
            />

            <Input
              label="Título"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Textarea
              label="Descrição"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Tipo"
                options={Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TicketType })}
              />
              <Select
                label="Prioridade"
                options={Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Área"
                placeholder="Definir..."
                options={Object.entries(TICKET_AREA_LABELS).map(([value, label]) => ({ value, label }))}
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value as TicketArea | '' })}
              />
              <Select
                label="Status"
                options={Object.entries(TICKET_STATUS_LABELS)
                  .filter(([value]) => !['resolved', 'closed'].includes(value))
                  .map(([value, label]) => ({ value, label }))}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TicketStatus })}
              />
            </div>

            <Select
              label="Agente"
              placeholder="Não atribuído"
              options={analysts.map((profile) => ({
                value: profile.id,
                label: profile.id === currentUserId ? `${profile.full_name} (eu)` : profile.full_name,
              }))}
              value={form.assignee_id}
              onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
            />

            {needsApprover && (
              <div className="space-y-1.5">
                <Select
                  label="Aprovador"
                  placeholder="Selecionar aprovador..."
                  options={requesters
                    .concat(analysts)
                    .filter((profile, index, list) => list.findIndex((row) => row.id === profile.id) === index)
                    .map((profile) => ({ value: profile.id, label: profile.full_name }))}
                  value={form.approver_id}
                  onChange={(e) => setForm({ ...form, approver_id: e.target.value })}
                />
                <p className="text-xs text-zinc-600">Obrigatório quando o chamado exige aprovação.</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={loading}>Abrir chamado</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/tickets')}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
