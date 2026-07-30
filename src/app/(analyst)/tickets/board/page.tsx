import { createClient } from '@/lib/supabase/server'
import { TicketsFilters } from '@/components/analyst/tickets-filters'
import { TicketsBoard, type BoardTicket } from '@/components/analyst/tickets-board'
import { BoardSort } from '@/components/analyst/board-sort'
import { findAwaitingReplyTicketIds } from '@/lib/awaiting-reply'
import type { TicketPriority } from '@/lib/types'

const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export default async function TicketsBoardPage({
  searchParams,
}: {
  searchParams: Promise<{
    priority?: string
    type?: string
    area?: string
    sla?: string
    q?: string
    sort?: string
    assignee?: string
    awaiting?: string
  }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const { data: { user } } = await supabase.auth.getUser()
  const { data: analysts } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'analyst')
    .order('full_name')

  let query = supabase
    .from('tickets')
    .select(`
      id, ticket_number, title, status, priority, type, requester_id,
      scheduled_for, resolution_due_at, resolved_at, created_at,
      requester:profiles!requester_id(full_name),
      assignee:profiles!assignee_id(full_name)
    `)
    .order('created_at', { ascending: false })

  if (params.assignee === 'me' && user) query = query.eq('assignee_id', user.id)
  else if (params.assignee === 'unassigned') query = query.is('assignee_id', null)
  else if (params.assignee) query = query.eq('assignee_id', params.assignee)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.type) query = query.eq('type', params.type)
  if (params.area) query = query.eq('area', params.area)
  if (params.sla === 'breached') {
    query = query
      .lt('resolution_due_at', new Date().toISOString())
      .neq('status', 'finalized')
  }
  if (params.sla === 'risk') {
    // SLA filters intentionally use request-time clock.
    // eslint-disable-next-line react-hooks/purity
    const soon = new Date(Date.now() + 4 * 3_600_000).toISOString()
    query = query
      .gte('resolution_due_at', new Date().toISOString())
      .lte('resolution_due_at', soon)
      .neq('status', 'finalized')
  }
  if (params.awaiting === '1') query = query.neq('status', 'finalized')
  if (params.q) {
    const term = `%${params.q}%`
    query = query.or(`title.ilike.${term},ticket_number.ilike.${term},description.ilike.${term}`)
  }

  const { data } = await query
  let rows = data ?? []

  let awaitingIds = new Set<string>()
  if (rows.length > 0) {
    const { data: comments } = await supabase
      .from('ticket_comments')
      .select('ticket_id, author_id, created_at')
      .in('ticket_id', rows.map((row) => row.id))
      .eq('is_internal', false)
      .order('created_at', { ascending: true })

    awaitingIds = findAwaitingReplyTicketIds(
      rows.map((row) => ({ id: row.id, requester_id: row.requester_id })),
      comments ?? []
    )

    if (params.awaiting === '1') {
      rows = rows.filter((row) => awaitingIds.has(row.id))
    }
  }

  const tickets: BoardTicket[] = rows.map((row) => ({
    id: row.id,
    ticket_number: row.ticket_number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    type: row.type,
    scheduled_for: row.scheduled_for,
    resolution_due_at: row.resolution_due_at,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    requester_name: (row.requester as unknown as { full_name: string } | null)?.full_name ?? '',
    assignee_name: (row.assignee as unknown as { full_name: string } | null)?.full_name ?? null,
    awaiting_reply: awaitingIds.has(row.id),
  }))

  if (params.sort === 'priority') {
    tickets.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
  } else if (params.sort === 'sla') {
    tickets.sort((a, b) => (a.resolution_due_at ?? '9999').localeCompare(b.resolution_due_at ?? '9999'))
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Quadro de chamados</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          {tickets.length} chamados · arraste um card para mover entre colunas
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <TicketsFilters
          exclude={['status']}
          analysts={analysts ?? []}
          currentUserId={user?.id}
        />
        <BoardSort />
      </div>

      <TicketsBoard tickets={tickets} />
    </div>
  )
}
