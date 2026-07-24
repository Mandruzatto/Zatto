import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  formatDate
} from '@/lib/utils'
import { PlusCircle } from 'lucide-react'

export default async function MyTicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('*, assignee:profiles!assignee_id(full_name)')
    .eq('requester_id', user!.id)
    .order('created_at', { ascending: false })

  const open = tickets?.filter((t) => !['resolved', 'closed'].includes(t.status)).length ?? 0
  const resolved = tickets?.filter((t) => ['resolved', 'closed'].includes(t.status)).length ?? 0

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meus Chamados</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {open} abertos · {resolved} resolvidos
          </p>
        </div>
        <Link
          href="/new-ticket"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Abrir Chamado
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chamado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Prioridade</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Atendente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tickets?.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/my-tickets/${ticket.id}`} className="hover:text-emerald-600">
                      <p className="font-medium text-gray-900">{ticket.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ticket.ticket_number}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={TICKET_PRIORITY_COLORS[ticket.priority as keyof typeof TICKET_PRIORITY_COLORS]}>
                      {TICKET_PRIORITY_LABELS[ticket.priority as keyof typeof TICKET_PRIORITY_LABELS]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={TICKET_STATUS_COLORS[ticket.status as keyof typeof TICKET_STATUS_COLORS]}>
                      {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(ticket.assignee as any)?.full_name ?? <span className="text-gray-400 italic">Aguardando</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(ticket.created_at)}
                  </td>
                </tr>
              ))}
              {(!tickets || tickets.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    Você ainda não abriu nenhum chamado.{' '}
                    <Link href="/new-ticket" className="text-emerald-600 hover:underline">
                      Abrir chamado
                    </Link>
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
