import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS, formatDate
} from '@/lib/utils'
import type { Ticket } from '@/lib/types'
import { PlusCircle } from 'lucide-react'

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  let query = supabase
    .from('tickets')
    .select('*, requester:profiles!requester_id(id, full_name, department), assignee:profiles!assignee_id(id, full_name)')
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('status', params.status)
  if (params.priority) query = query.eq('priority', params.priority)
  if (params.q) query = query.ilike('title', `%${params.q}%`)

  const { data: tickets } = await query

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chamados</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tickets?.length ?? 0} chamados encontrados</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chamado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Solicitante</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Prioridade</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Atribuído a</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(tickets as unknown as (Ticket & {
                requester: { id: string; full_name: string; department?: string }
                assignee: { id: string; full_name: string } | null
              })[])?.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${ticket.id}`} className="hover:text-indigo-600">
                      <p className="font-medium text-gray-900">{ticket.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ticket.ticket_number}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{ticket.requester?.full_name}</p>
                    {ticket.requester?.department && (
                      <p className="text-xs text-gray-400">{ticket.requester.department}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {TICKET_CATEGORY_LABELS[ticket.category]}
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
                  <td className="px-4 py-3 text-gray-600">
                    {ticket.assignee?.full_name ?? <span className="text-gray-400 italic">Não atribuído</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(ticket.created_at)}
                  </td>
                </tr>
              ))}
              {(!tickets || tickets.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
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
