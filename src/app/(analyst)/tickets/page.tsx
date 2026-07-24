import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  TICKET_TYPE_COLORS, TICKET_TYPE_LABELS,
  TICKET_AREA_COLORS, TICKET_AREA_LABELS,
  formatDate, getSlaState
} from '@/lib/utils'
import { TicketsFilters } from '@/components/analyst/tickets-filters'
import type { Ticket, TicketArea } from '@/lib/types'

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; type?: string; area?: string; sla?: string; q?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  let query = supabase
    .from('tickets')
    .select('*, requester:profiles!requester_id(id, full_name, department), assignee:profiles!assignee_id(id, full_name)')
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('status', params.status)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.type) query = query.eq('type', params.type)
  if (params.area) query = query.eq('area', params.area)
  if (params.sla === 'breached') query = query.lt('resolution_due_at', new Date().toISOString()).not('status', 'in', '("resolved","closed")')
  if (params.sla === 'risk') {
    // SLA filters intentionally use request-time clock.
    // eslint-disable-next-line react-hooks/purity
    const soon = new Date(Date.now() + 4 * 3_600_000).toISOString()
    query = query.gte('resolution_due_at', new Date().toISOString()).lte('resolution_due_at', soon).not('status', 'in', '("resolved","closed")')
  }
  if (params.q) {
    const term = `%${params.q}%`
    query = query.or(`title.ilike.${term},ticket_number.ilike.${term},description.ilike.${term}`)
  }

  const { data: tickets } = await query

  type TicketRow = Ticket & {
    requester: { id: string; full_name: string; department?: string } | null
    assignee: { id: string; full_name: string } | null
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Chamados</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">{tickets?.length ?? 0} chamados encontrados</p>
      </div>

      <TicketsFilters />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Chamado</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Solicitante</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Área</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Prioridade</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">SLA</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Agente</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {(tickets as unknown as TicketRow[])?.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-zinc-900/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${ticket.id}`} className="group">
                      <p className="font-medium text-zinc-200 group-hover:text-white">{ticket.title}</p>
                      <p className="text-xs text-zinc-600 mt-0.5 font-mono">{ticket.ticket_number}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-300">{ticket.requester?.full_name}</p>
                    {ticket.requester?.department && (
                      <p className="text-xs text-zinc-600">{ticket.requester.department}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={TICKET_TYPE_COLORS[ticket.type]}>
                      {TICKET_TYPE_LABELS[ticket.type]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {ticket.area ? (
                      <Badge className={TICKET_AREA_COLORS[ticket.area as TicketArea]}>
                        {TICKET_AREA_LABELS[ticket.area as TicketArea]}
                      </Badge>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
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
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const sla = getSlaState(ticket.resolution_due_at, ticket.resolved_at)
                      return <Badge className={sla.className}>{sla.label}</Badge>
                    })()}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {ticket.assignee?.full_name ?? <span className="text-zinc-600 text-xs">Não atribuído</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {formatDate(ticket.created_at)}
                  </td>
                </tr>
              ))}
              {(!tickets || tickets.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-zinc-600">
                    Nenhum chamado encontrado.
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
