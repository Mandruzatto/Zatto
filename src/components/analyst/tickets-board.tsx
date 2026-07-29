'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_BAR_COLORS,
  TICKET_PRIORITY_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPE_COLORS,
  TICKET_TYPE_LABELS,
  formatDateShort,
  getSlaState,
  getScheduleState,
  cn,
} from '@/lib/utils'
import type { TicketPriority, TicketStatus, TicketType } from '@/lib/types'

export type BoardTicket = {
  id: string
  ticket_number: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  type: TicketType
  scheduled_for: string | null
  resolution_due_at: string | null
  resolved_at: string | null
  created_at: string
  requester_name: string
  assignee_name: string | null
}

const COLUMNS: TicketStatus[] = [
  'open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled', 'resolved', 'closed',
]

// Statuses that need extra data before saving must be set from the ticket page.
const GUARDED_STATUSES: Partial<Record<TicketStatus, string>> = {
  awaiting_approval: 'Aguardando Aprovação exige um aprovador',
  pending: 'Pendente exige o motivo da pendência',
  scheduled: 'Agendado exige data e hora',
  resolved: 'Resolvido exige a resolução',
  closed: 'Encerrado exige a resolução',
}

function initialsOf(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export function TicketsBoard({ tickets }: { tickets: BoardTicket[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<TicketStatus | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)

  async function moveTicket(ticketId: string, status: TicketStatus) {
    const ticket = tickets.find((row) => row.id === ticketId)
    if (!ticket || ticket.status === status) return

    const guard = GUARDED_STATUSES[status]
    if (guard) {
      toast(`${guard}. Abra o chamado para alterar.`, 'error')
      return
    }

    setMovingId(ticketId)
    const { error } = await supabase
      .from('tickets')
      .update({ status, resolution: null, resolved_at: null, pending_reason: null })
      .eq('id', ticketId)
    setMovingId(null)

    if (error) {
      toast('Não foi possível mover o chamado', 'error')
      return
    }
    toast(`${ticket.ticket_number} movido para ${TICKET_STATUS_LABELS[status]}`)
    router.refresh()
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((status) => {
        const columnTickets = tickets.filter((ticket) => ticket.status === status)
        const isTarget = dropTarget === status
        return (
          <section
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              if (dropTarget !== status) setDropTarget(status)
            }}
            onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
            onDrop={(e) => {
              e.preventDefault()
              setDropTarget(null)
              const id = e.dataTransfer.getData('text/zatto-ticket')
              if (id) void moveTicket(id, status)
            }}
            className={cn(
              'flex max-h-[calc(100vh-13rem)] w-72 shrink-0 flex-col rounded-xl border bg-zinc-900/30 transition-colors',
              isTarget && draggingId ? 'border-zinc-600 bg-zinc-900/70' : 'border-zinc-800'
            )}
          >
            <header className="flex items-center gap-2 border-b border-zinc-800/70 px-3.5 py-2.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', TICKET_STATUS_BAR_COLORS[status])} />
              <span className="truncate text-[13px] font-medium text-zinc-200">
                {TICKET_STATUS_LABELS[status]}
              </span>
              <span className="ml-auto rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-400">
                {columnTickets.length}
              </span>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
              {columnTickets.map((ticket) => {
                const sla = getSlaState(ticket.resolution_due_at, ticket.resolved_at)
                return (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/zatto-ticket', ticket.id)
                      e.dataTransfer.effectAllowed = 'move'
                      setDraggingId(ticket.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setDropTarget(null)
                    }}
                    className={cn(
                      'block cursor-grab rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-700 active:cursor-grabbing',
                      draggingId === ticket.id && 'opacity-40',
                      movingId === ticket.id && 'animate-pulse'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-zinc-600">{ticket.ticket_number}</span>
                      {ticket.resolution_due_at && (
                        <Badge className={cn(sla.className, 'text-[10px]')}>{sla.label}</Badge>
                      )}
                    </div>

                    <p className="mt-1.5 text-[13px] font-medium leading-snug text-zinc-200 line-clamp-2">
                      {ticket.title}
                    </p>

                    {ticket.status === 'scheduled' && ticket.scheduled_for && (
                      <p className="mt-1.5 text-[11px] text-violet-400/80">
                        {formatDateShort(ticket.scheduled_for)} · {getScheduleState(ticket.scheduled_for).label}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Badge className={cn(TICKET_PRIORITY_COLORS[ticket.priority], 'text-[10px]')}>
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </Badge>
                      <Badge className={cn(TICKET_TYPE_COLORS[ticket.type], 'text-[10px]')}>
                        {TICKET_TYPE_LABELS[ticket.type]}
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2 border-t border-zinc-800/70 pt-2">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-600">
                        {ticket.requester_name || 'Sem solicitante'}
                      </span>
                      <span
                        title={ticket.assignee_name ?? 'Não atribuído'}
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold',
                          ticket.assignee_name
                            ? 'bg-zinc-800 text-zinc-300'
                            : 'border border-dashed border-zinc-700 text-zinc-700'
                        )}
                      >
                        {ticket.assignee_name ? initialsOf(ticket.assignee_name) : '—'}
                      </span>
                    </div>
                  </Link>
                )
              })}

              {columnTickets.length === 0 && (
                <p className="px-1 py-6 text-center text-[11px] text-zinc-700">
                  Nenhum chamado em {TICKET_STATUS_LABELS[status]}
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
