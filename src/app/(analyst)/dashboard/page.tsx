import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Ticket, Monitor, Users, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS, TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS, formatDate } from '@/lib/utils'
import type { Ticket as TicketType } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: openTickets },
    { count: inProgressTickets },
    { count: totalAssets },
    { count: totalUsers },
    { data: recentTickets },
    { data: criticalTickets },
  ] = await Promise.all([
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'collaborator'),
    supabase
      .from('tickets')
      .select('*, requester:profiles!requester_id(full_name, department)')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('tickets')
      .select('*, requester:profiles!requester_id(full_name)')
      .eq('priority', 'critical')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const stats = [
    { label: 'Chamados Abertos', value: openTickets ?? 0, icon: Ticket, color: 'text-blue-600', bg: 'bg-blue-50', href: '/tickets?status=open' },
    { label: 'Em Atendimento', value: inProgressTickets ?? 0, icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', href: '/tickets?status=in_progress' },
    { label: 'Ativos Ativos', value: totalAssets ?? 0, icon: Monitor, color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/assets' },
    { label: 'Colaboradores', value: totalUsers ?? 0, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50', href: '/users' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral do suporte</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Chamados Recentes</CardTitle>
              <Link href="/tickets" className="text-sm text-indigo-600 hover:underline">Ver todos</Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentTickets && recentTickets.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {(recentTickets as unknown as (TicketType & { requester: { full_name: string; department?: string } })[]).map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{ticket.ticket_number}</span>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-500">{ticket.requester?.full_name}</span>
                          {ticket.requester?.department && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400">{ticket.requester.department}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
                          {TICKET_PRIORITY_LABELS[ticket.priority]}
                        </Badge>
                        <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                          {TICKET_STATUS_LABELS[ticket.status]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-8 text-center text-sm text-gray-500">
                  Nenhum chamado aberto no momento.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Chamados Críticos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {criticalTickets && criticalTickets.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {(criticalTickets as unknown as (TicketType & { requester: { full_name: string } })[]).map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="block px-6 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">{ticket.requester?.full_name}</span>
                        <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                          {TICKET_STATUS_LABELS[ticket.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(ticket.created_at)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-8 text-center text-sm text-gray-500">
                  Nenhum chamado crítico.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
