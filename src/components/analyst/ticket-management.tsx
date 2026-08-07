'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { Input } from '@/components/ui/input'
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPE_LABELS,
  TICKET_AREA_LABELS,
  toDateTimeLocalValue,
  cn,
} from '@/lib/utils'
import type { Ticket, TicketStatus, TicketPriority, TicketType, TicketArea } from '@/lib/types'
import { RefreshCw, Trash2, UserCheck, UserPlus } from 'lucide-react'
import type { TicketApproval } from '@/lib/types'

interface TicketManagementProps {
  ticket: Ticket
  analysts: { id: string; full_name: string }[]
  currentApproval?: TicketApproval | null
  currentUserId: string
}

export function TicketManagement({
  ticket,
  analysts,
  currentApproval,
  currentUserId,
}: TicketManagementProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    status: ticket.status,
    priority: ticket.priority,
    type: ticket.type,
    area: ticket.area ?? '',
    assignee_id: ticket.assignee_id ?? '',
    resolution: ticket.resolution ?? '',
    pending_reason: ticket.pending_reason ?? '',
    scheduled_for: toDateTimeLocalValue(ticket.scheduled_for),
  })

  const needsResolution = form.status === 'finalized'
  const isPending = form.status === 'pending'
  const needsApproval = form.status === 'awaiting_approval'
  const isScheduled = form.status === 'scheduled'

  const dirty =
    form.status !== ticket.status ||
    form.priority !== ticket.priority ||
    form.type !== ticket.type ||
    form.area !== (ticket.area ?? '') ||
    form.assignee_id !== (ticket.assignee_id ?? '') ||
    form.resolution !== (ticket.resolution ?? '') ||
    form.pending_reason !== (ticket.pending_reason ?? '') ||
    (isScheduled && form.scheduled_for !== toDateTimeLocalValue(ticket.scheduled_for))

  const missingResolution = needsResolution && !form.resolution.trim()
  const missingPendingReason = isPending && !form.pending_reason.trim()
  const missingSchedule = isScheduled && !form.scheduled_for

  async function handleSave() {
    if (missingSchedule) {
      toast('Informe a data do agendamento', 'error')
      return
    }

    setSaving(true)

    const updates: Record<string, unknown> = {
      status: form.status,
      priority: form.priority,
      type: form.type,
      area: form.area || null,
      assignee_id: form.assignee_id || null,
      resolution: needsResolution ? form.resolution.trim() || null : null,
      pending_reason: isPending ? form.pending_reason.trim() || null : null,
      scheduled_for: isScheduled ? new Date(form.scheduled_for).toISOString() : null,
    }

    if (needsApproval) {
      // O aprovador é definido no card de Aprovação; aqui só marcamos se já há alguém designado.
      updates.approval_status = currentApproval?.approver_id ? 'pending' : 'pending_assignment'
    } else if (ticket.status === 'awaiting_approval' && form.status !== 'awaiting_approval') {
      updates.approval_status = form.status === 'finalized' ? 'cancelled' : ticket.approval_status
    }

    if (needsResolution && !ticket.resolved_at) {
      updates.resolved_at = new Date().toISOString()
    }
    if (!needsResolution) {
      updates.resolved_at = null
    }

    const { error } = await supabase.from('tickets').update(updates).eq('id', ticket.id)
    if (error) {
      setSaving(false)
      toast('Erro ao salvar alterações', 'error')
      return
    }

    if (needsResolution && ticket.status !== 'finalized') {
      await fetch(`/api/tickets/${ticket.id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'ticket_finalized' }),
      })
    }

    setSaving(false)
    toast('Alterações salvas')
    router.refresh()
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)

    const { error } = await supabase.from('tickets').delete().eq('id', ticket.id)

    if (error) {
      setDeleting(false)
      setConfirmDelete(false)
      toast('Erro ao excluir chamado', 'error')
      return
    }
    toast(`Chamado ${ticket.ticket_number} excluído`)
    router.push('/tickets')
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
        {needsResolution && (
          <Textarea
            label="Resolução"
            placeholder="Descreva como o chamado foi resolvido..."
            rows={3}
            value={form.resolution}
            onChange={(e) => setForm({ ...form, resolution: e.target.value })}
            hint="Obrigatório para finalizar o chamado"
          />
        )}
        {isPending && (
          <Textarea
            label="Motivo da pendência"
            placeholder="Ex: aguardando resposta do colaborador, peça em compra..."
            rows={3}
            value={form.pending_reason}
            onChange={(e) => setForm({ ...form, pending_reason: e.target.value })}
            hint="Obrigatório ao marcar como Pendente"
          />
        )}
        {isScheduled && (
          <Input
            label="Agendado para"
            type="datetime-local"
            value={form.scheduled_for}
            onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
            hint="Obrigatório ao marcar como Agendado"
          />
        )}
        {needsApproval && !currentApproval?.approver_id && (
          <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-zinc-400">
            Defina quem aprova no card <span className="text-zinc-200">Aprovação</span>, abaixo.
          </p>
        )}
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
          disabled={!dirty || missingResolution || missingPendingReason || missingSchedule}
          className="w-full"
          size="sm"
        >
          Salvar alterações
        </Button>

        <div className="border-t border-zinc-800/70 pt-3.5">
          <Button
            onClick={handleDelete}
            loading={deleting}
            onBlur={() => setConfirmDelete(false)}
            variant={confirmDelete ? 'danger' : 'ghost'}
            size="sm"
            className={cn('w-full', !confirmDelete && 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10')}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {confirmDelete ? 'Clique para confirmar a exclusão' : 'Excluir chamado'}
          </Button>
          {confirmDelete && (
            <p className="text-xs text-zinc-600 mt-1.5 text-center">
              Comentários e vínculos serão removidos permanentemente.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ApprovalManagement({
  ticketId,
  approval,
  approvers,
  currentUserId,
}: {
  ticketId: string
  approval?: (TicketApproval & { approver?: { full_name?: string } | null }) | null
  approvers: { id: string; full_name: string }[]
  currentUserId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const currentApproverId = approval?.approver_id ?? ''
  const [approverId, setApproverId] = useState(currentApproverId)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)

  const decided = approval?.decision === 'approved' || approval?.decision === 'rejected'
  const approverName =
    approvers.find((profile) => profile.id === currentApproverId)?.full_name ??
    approval?.approver?.full_name ??
    'aprovador'

  async function save() {
    if (!approverId) return
    setSaving(true)

    // Upsert cobre o caso em que ainda não existe linha de aprovação para o chamado.
    const { error } = await supabase.from('ticket_approvals').upsert({
      ticket_id: ticketId,
      approver_id: approverId,
      assigned_by: currentUserId,
      decision: 'pending',
      comment: null,
      decided_at: null,
      requested_at: new Date().toISOString(),
    }, { onConflict: 'ticket_id' })

    if (error) {
      setSaving(false)
      return toast('Erro ao definir aprovador', 'error')
    }

    await supabase.from('tickets').update({ approval_status: 'pending' }).eq('id', ticketId)

    // O aprovador quase nunca abre o sistema: sem este aviso o chamado trava.
    await fetch(`/api/tickets/${ticketId}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'approval_requested' }),
    })

    setSaving(false)
    setPicking(false)
    toast(currentApproverId ? 'Aprovador alterado' : 'Aprovador definido')
    router.refresh()
  }

  function cancel() {
    setApproverId(currentApproverId)
    setPicking(false)
  }

  // Decidido já aparece nos cards de "Aprovado"/"Rejeitado" da coluna principal.
  if (decided) return null

  return (
    <Card className="border-cyan-500/20">
      <CardHeader><CardTitle>Aprovação</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {picking ? (
          <>
            <Select
              label="Aprovador"
              options={approvers.map((profile) => ({ value: profile.id, label: profile.full_name }))}
              placeholder="Selecionar colaborador..."
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                loading={saving}
                disabled={!approverId || approverId === currentApproverId}
                onClick={save}
              >
                Salvar
              </Button>
              <Button size="sm" variant="secondary" onClick={cancel} disabled={saving}>
                Cancelar
              </Button>
            </div>
            <p className="text-xs text-zinc-600">Qualquer pessoa pode ser aprovadora deste chamado.</p>
          </>
        ) : currentApproverId ? (
          <>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-cyan-400/80" />
              <p className="text-[13px] text-zinc-300">Aguardando {approverName}</p>
            </div>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => setPicking(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Trocar aprovador
            </Button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-zinc-400">Nenhum aprovador definido.</p>
            <Button size="sm" className="w-full" onClick={() => setPicking(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Adicionar aprovador
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
