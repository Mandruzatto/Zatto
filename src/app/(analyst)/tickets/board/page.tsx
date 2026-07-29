import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TicketsFilters } from '@/components/analyst/tickets-filters'
import { TicketsBoard, type BoardTicket } from '@/components/analyst/tickets-board'
import { BoardSort } from '@/components/analyst/board-sort'
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
  searchParams: Promise<{ priority?: string; type?: string; area?: string; sla?: string; q?: string; sort?: string; assignee?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('tickets')
    .select(`
      id, ticket_number, title, status, priority, type,
      scheduled_for, resolution_due_at, resolved_at, created_at,
      requester:profiles!requester_id(full_name),
      assignee:profiles!assignee_id(full_name)
    `)
    .order('created_at', { ascending: false })

  if (params.assignee === 'me' && user) query = query.eq('assignee_id', user.id)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.type) query = query.eq('type', params.type)
  if (params.area) query = query.eq('area', params.area)
  if (params.sla === 'breached') {
    query = query
      .lt('resolution_due_at', new Date().toISOString())
      .not('status', 'in', '("resolved","closed")')
  }
  if (params.sla === 'risk') {
    // SLA filters intentionally use request-time clock.
    // eslint-disable-next-line react-hooks/purity
    const soon = new Date(Date.now() + 4 * 3_600_000).toISOString()
    query = query
      .gte('resolution_due_at', new Date().toISOString())
      .lte('resolution_due_at', soon)
      .not('status', 'in', '("resolved","closed")')
  }
  if (params.q) {
    const term = `%${params.q}%`
    query = query.or(`title.ilike.${term},ticket_number.ilike.${term},description.ilike.${term}`)
  }

  const { data } = await query

  const tickets: BoardTicket[] = (data ?? []).map((row) => ({
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
  }))

  if (params.sort === 'priority') {
    tickets.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
  } else if (params.sort === 'sla') {
    tickets.sort((a, b) => (a.resolution_due_at ?? '9999').localeCompare(b.resolution_due_at ?? '9999'))
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Quadro de chamados</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {tickets.length} chamados · arraste um card para mover entre colunas
          </p>
        </div>
        <Link
          href="/tickets/new"
          className="inline-flex shrink-0 items-center rounded-lg bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-300"
        >
          Novo chamado
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <TicketsFilters exclude={['status']} />
        <BoardSort />
      </div>

      <TicketsBoard tickets={tickets} />
    </div>
  )
}
