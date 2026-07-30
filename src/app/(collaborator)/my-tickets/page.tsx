import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  formatDate
} from '@/lib/utils'
import { Plus } from 'lucide-react'
import { CopyTicketNumber } from '@/components/copy-ticket-number'

export default async function MyTicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('*, assignee:profiles!assignee_id(full_name)')
    .eq('requester_id', user!.id)
    .order('created_at', { ascending: false })

  const open = tickets?.filter((t) => t.status !== 'finalized').length ?? 0
  const finalized = tickets?.filter((t) => t.status === 'finalized').length ?? 0

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Meus Chamados</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">
            {open} abertos · {finalized} finalizados
          </p>
        </div>
        <Link
          href="/new-ticket"
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-3.5 py-2 text-[13px] font-medium text-zinc-950 hover:bg-zinc-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Abrir Chamado
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Chamado</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Prioridade</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Atendente</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {tickets?.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={
                    ticket.status === 'finalized'
                      ? 'opacity-40 transition-colors hover:bg-zinc-900/60 hover:opacity-70'
                      : 'transition-colors hover:bg-zinc-900/60'
                  }
                >
                  <td className="px-4 py-3">
                    <Link href={`/my-tickets/${ticket.id}`} className="group">
                      <p className="font-medium text-zinc-200 group-hover:text-zinc-50">{ticket.title}</p>
                    </Link>
                    <CopyTicketNumber value={ticket.ticket_number} className="mt-0.5 text-xs" />
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
                  <td className="px-4 py-3 text-zinc-400">
                    {(ticket.assignee as unknown as { full_name: string } | null)?.full_name ?? (
                      <span className="text-zinc-600 text-xs">Aguardando</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {formatDate(ticket.created_at)}
                  </td>
                </tr>
              ))}
              {(!tickets || tickets.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-600">
                    Você ainda não abriu nenhum chamado.{' '}
                    <Link href="/new-ticket" className="text-zinc-300 hover:text-zinc-50 underline underline-offset-2">
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
