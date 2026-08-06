import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  TICKET_TYPE_LABELS,
  TICKET_AREA_LABELS,
  REMOTE_SESSION_STATUS_LABELS,
  formatDateShort, formatRelativeTime, getSlaState, getScheduleState, cn
} from '@/lib/utils'
import { TicketsFilters } from '@/components/analyst/tickets-filters'
import { SortableHeader, type TicketSortKey } from '@/components/analyst/sortable-header'
import { CopyTicketNumber } from '@/components/copy-ticket-number'
import { ExportTicketsCsv } from '@/components/analyst/export-tickets-csv'
import { findAwaitingReplyTicketIds } from '@/lib/awaiting-reply'
import { ACTIVE_REMOTE_STATUSES, dayBounds, pickRemoteSignal } from '@/lib/remote-sessions'
import type { RemoteSessionStatus, Ticket, TicketArea, TicketPriority, TicketStatus, TicketType } from '@/lib/types'

const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const STATUS_WEIGHT: Record<TicketStatus, number> = {
  open: 0,
  awaiting_approval: 1,
  in_progress: 2,
  pending: 3,
  scheduled: 4,
  finalized: 5,
}

const TYPE_WEIGHT: Record<TicketType, number> = {
  incident: 0,
  request: 1,
}

type TicketRow = Ticket & {
  requester: { id: string; full_name: string; department?: string } | null
  assignee: { id: string; full_name: string } | null
}

function compareTickets(a: TicketRow, b: TicketRow, sort: TicketSortKey, ascending: boolean) {
  let result = 0
  switch (sort) {
    case 'ticket':
      result = a.ticket_number.localeCompare(b.ticket_number, 'pt-BR')
      break
    case 'requester':
      result = (a.requester?.full_name ?? '').localeCompare(b.requester?.full_name ?? '', 'pt-BR')
      break
    case 'type':
      result = TYPE_WEIGHT[a.type] - TYPE_WEIGHT[b.type]
      break
    case 'area':
      result = (a.area ?? '').localeCompare(b.area ?? '', 'pt-BR')
      break
    case 'priority':
      result = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
      break
    case 'status':
      result = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status]
      break
    case 'sla': {
      const aDue = a.resolution_due_at ?? (ascending ? '9999' : '')
      const bDue = b.resolution_due_at ?? (ascending ? '9999' : '')
      result = aDue.localeCompare(bDue)
      break
    }
    case 'assignee':
      result = (a.assignee?.full_name ?? '').localeCompare(b.assignee?.full_name ?? '', 'pt-BR')
      break
    case 'updated_at':
      result = (a.updated_at ?? a.created_at).localeCompare(b.updated_at ?? b.created_at)
      break
    case 'created_at':
    default:
      result = a.created_at.localeCompare(b.created_at)
      break
  }
  return ascending ? result : -result
}

function emptyMessage(params: {
  status?: string
  priority?: string
  type?: string
  area?: string
  sla?: string
  q?: string
  assignee?: string
  awaiting?: string
  remote?: string
}) {
  if (params.remote === 'today') {
    return {
      title: 'Nenhuma sessão remota hoje',
      hint: 'Quando houver horário marcado para hoje, o chamado aparece aqui.',
    }
  }
  if (params.remote === 'ready') {
    return {
      title: 'Nenhuma sessão autorizada',
      hint: 'Quando o colaborador autorizar o acesso, o chamado aparece aqui.',
    }
  }
  if (params.remote === 'awaiting') {
    return {
      title: 'Nada aguardando autorização',
      hint: 'Sessões confirmadas esperando o colaborador liberar o acesso.',
    }
  }
  if (params.awaiting === '1') {
    return {
      title: 'Nada aguardando sua resposta',
      hint: 'Quando o colaborador falar por último, o chamado aparece aqui.',
    }
  }
  if (params.sla === 'breached') {
    return {
      title: 'Nenhum chamado com SLA vencido',
      hint: 'Bom sinal — a fila está dentro do prazo.',
    }
  }
  if (params.sla === 'risk') {
    return {
      title: 'Nenhum chamado crítico agora',
      hint: 'Não há SLAs vencendo nas próximas 4 horas.',
    }
  }
  if (params.assignee === 'me') {
    return {
      title: 'Nenhum chamado atribuído a você',
      hint: 'Pegue um da fila ou limpe o filtro de responsável.',
    }
  }
  if (params.assignee === 'unassigned') {
    return {
      title: 'Nenhum chamado sem responsável',
      hint: 'Todos os chamados filtrados já têm um agente.',
    }
  }
  if (params.status || params.priority || params.type || params.area || params.q || params.assignee) {
    return {
      title: 'Nenhum chamado com esses filtros',
      hint: 'Ajuste ou limpe os filtros para ver mais resultados.',
    }
  }
  return {
    title: 'Nenhum chamado encontrado',
    hint: 'Abra o primeiro chamado ou aguarde novas solicitações.',
  }
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    priority?: string
    type?: string
    area?: string
    sla?: string
    q?: string
    assignee?: string
    awaiting?: string
    remote?: string
    sort?: string
    dir?: string
  }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: analysts }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'analyst').order('full_name'),
  ])

  let query = supabase
    .from('tickets')
    .select('*, requester:profiles!requester_id(id, full_name, department), assignee:profiles!assignee_id(id, full_name)')
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('status', params.status)
  if (params.assignee === 'me' && user) query = query.eq('assignee_id', user.id)
  else if (params.assignee === 'unassigned') query = query.is('assignee_id', null)
  else if (params.assignee) query = query.eq('assignee_id', params.assignee)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.type) query = query.eq('type', params.type)
  if (params.area) query = query.eq('area', params.area)
  if (params.sla === 'breached') query = query.lt('resolution_due_at', new Date().toISOString()).neq('status', 'finalized')
  if (params.sla === 'risk') {
    // SLA filters intentionally use request-time clock.
    // eslint-disable-next-line react-hooks/purity
    const soon = new Date(Date.now() + 4 * 3_600_000).toISOString()
    query = query.gte('resolution_due_at', new Date().toISOString()).lte('resolution_due_at', soon).neq('status', 'finalized')
  }
  if (params.awaiting === '1' || params.remote) query = query.neq('status', 'finalized')
  if (params.q) {
    const term = `%${params.q}%`
    query = query.or(`title.ilike.${term},ticket_number.ilike.${term},description.ilike.${term}`)
  }

  const { data: tickets } = await query
  let rows = (tickets ?? []) as unknown as TicketRow[]

  let awaitingIds = new Set<string>()
  const remoteByTicket = new Map<string, { status: RemoteSessionStatus; scheduled_for: string }[]>()

  if (rows.length > 0) {
    const ticketIds = rows.map((ticket) => ticket.id)
    const [{ data: comments }, { data: remoteRows }] = await Promise.all([
      supabase
        .from('ticket_comments')
        .select('ticket_id, author_id, created_at')
        .in('ticket_id', ticketIds)
        .eq('is_internal', false)
        .order('created_at', { ascending: true }),
      supabase
        .from('remote_sessions')
        .select('ticket_id, status, scheduled_for')
        .in('ticket_id', ticketIds)
        .in('status', ACTIVE_REMOTE_STATUSES),
    ])

    awaitingIds = findAwaitingReplyTicketIds(
      rows.map((ticket) => ({ id: ticket.id, requester_id: ticket.requester_id })),
      comments ?? []
    )

    remoteRows?.forEach((session) => {
      const list = remoteByTicket.get(session.ticket_id) ?? []
      list.push({
        status: session.status as RemoteSessionStatus,
        scheduled_for: session.scheduled_for,
      })
      remoteByTicket.set(session.ticket_id, list)
    })

    if (params.awaiting === '1') {
      rows = rows.filter((ticket) => awaitingIds.has(ticket.id))
    }

    if (params.remote) {
      const { start, end } = dayBounds()
      rows = rows.filter((ticket) => {
        const sessions = remoteByTicket.get(ticket.id) ?? []
        if (params.remote === 'today') {
          return sessions.some((session) => session.scheduled_for >= start && session.scheduled_for <= end)
        }
        if (params.remote === 'ready') {
          return sessions.some((session) => session.status === 'ready' || session.status === 'in_progress')
        }
        if (params.remote === 'awaiting') {
          return sessions.some((session) => session.status === 'confirmed')
        }
        return false
      })
    }
  }

  const sortKey = params.sort as TicketSortKey | undefined
  const sorted = sortKey
    ? [...rows].sort((a, b) => compareTickets(a, b, sortKey, params.dir !== 'desc'))
    : rows

  const empty = emptyMessage(params)
  const exportRows = sorted.map((ticket) => ({
    ticket_number: ticket.ticket_number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    type: ticket.type,
    area: ticket.area,
    resolution_due_at: ticket.resolution_due_at,
    resolved_at: ticket.resolved_at,
    created_at: ticket.created_at,
    requester_name: ticket.requester?.full_name ?? '',
    assignee_name: ticket.assignee?.full_name ?? '',
  }))

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Chamados</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">{sorted.length} chamados encontrados</p>
        </div>
        <ExportTicketsCsv tickets={exportRows} />
      </div>

      <Suspense fallback={null}>
        <TicketsFilters
          analysts={analysts ?? []}
          currentUserId={user?.id}
        />
      </Suspense>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <Suspense fallback={<th className="px-4 py-2.5 text-left font-medium text-zinc-500">Chamado</th>}>
                  <SortableHeader label="Chamado" sortKey="ticket" />
                </Suspense>
                <Suspense fallback={<th className="px-4 py-2.5 text-left font-medium text-zinc-500">Solicitante</th>}>
                  <SortableHeader label="Solicitante" sortKey="requester" />
                </Suspense>
                <Suspense fallback={<th className="px-4 py-2.5 text-left font-medium text-zinc-500">Prioridade</th>}>
                  <SortableHeader label="Prioridade" sortKey="priority" />
                </Suspense>
                <Suspense fallback={<th className="px-4 py-2.5 text-left font-medium text-zinc-500">Status</th>}>
                  <SortableHeader label="Status" sortKey="status" />
                </Suspense>
                <Suspense fallback={<th className="px-4 py-2.5 text-left font-medium text-zinc-500">SLA</th>}>
                  <SortableHeader label="SLA" sortKey="sla" />
                </Suspense>
                <Suspense fallback={<th className="px-4 py-2.5 text-left font-medium text-zinc-500">Agente</th>}>
                  <SortableHeader label="Agente" sortKey="assignee" />
                </Suspense>
                <Suspense fallback={<th className="px-4 py-2.5 text-left font-medium text-zinc-500">Atualizado</th>}>
                  <SortableHeader label="Atualizado" sortKey="updated_at" />
                </Suspense>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {sorted.map((ticket) => {
                const sla = getSlaState(ticket.resolution_due_at, ticket.resolved_at)
                const meta = [
                  TICKET_TYPE_LABELS[ticket.type],
                  ticket.area ? TICKET_AREA_LABELS[ticket.area as TicketArea] : null,
                  formatDateShort(ticket.created_at),
                ].filter(Boolean).join(' · ')
                const remoteSignal = pickRemoteSignal(
                  (remoteByTicket.get(ticket.id) ?? []).map((session) => ({
                    ticket_id: ticket.id,
                    ...session,
                  }))
                )

                return (
                  <tr
                    key={ticket.id}
                    className={cn(
                      'transition-colors hover:bg-zinc-900/60',
                      ticket.status === 'finalized' && 'opacity-40 hover:opacity-70'
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/tickets/${ticket.id}`} className="group">
                        <p className="font-medium text-zinc-200 group-hover:text-zinc-50">{ticket.title}</p>
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <CopyTicketNumber value={ticket.ticket_number} className="text-xs" />
                        <span className="text-[11px] text-zinc-600">{meta}</span>
                      </div>
                      {remoteSignal && (
                        <p className="mt-1 text-[11px] font-medium text-violet-400/90">
                          Sessão remota · {REMOTE_SESSION_STATUS_LABELS[remoteSignal.status]}
                          {' · '}
                          {formatDateShort(remoteSignal.scheduled_for)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ticket.requester ? (
                        <>
                          <p className="text-zinc-300">{ticket.requester.full_name}</p>
                          {ticket.requester.department && (
                            <p className="text-xs text-zinc-600">{ticket.requester.department}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-zinc-600">Não identificado</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                      {awaitingIds.has(ticket.id) && (
                        <p className="mt-1 text-[11px] font-medium text-sky-400/90">Aguardando resposta</p>
                      )}
                      {ticket.status === 'scheduled' && ticket.scheduled_for && (
                        <p className="mt-1 text-xs text-violet-400/80">
                          {formatDateShort(ticket.scheduled_for)} · {getScheduleState(ticket.scheduled_for).label}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sla.hot ? (
                        <Badge className={sla.className}>{sla.label}</Badge>
                      ) : (
                        <span className="text-xs text-zinc-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {ticket.assignee?.full_name ?? <span className="text-zinc-600 text-xs">Não atribuído</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500">
                      {formatRelativeTime(ticket.updated_at ?? ticket.created_at)}
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-[13px] font-medium text-zinc-400">{empty.title}</p>
                    <p className="mt-1 text-[13px] text-zinc-600">{empty.hint}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
