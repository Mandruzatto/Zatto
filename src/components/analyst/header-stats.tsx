'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, Inbox, MessageSquare, MonitorSmartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACTIVE_TICKET_STATUSES, findAwaitingReplyTicketIds } from '@/lib/awaiting-reply'
import { ACTIVE_REMOTE_STATUSES, dayBounds } from '@/lib/remote-sessions'
import { cn } from '@/lib/utils'

const REFRESH_MS = 60_000

export function HeaderStats({ userId }: { userId: string }) {
  const [stats, setStats] = useState({
    breached: 0,
    risk: 0,
    mine: 0,
    awaiting: 0,
    remoteToday: 0,
    remoteReady: 0,
  })

  const load = useCallback(async () => {
    const supabase = createClient()
    const now = new Date()
    const soon = new Date(now.getTime() + 4 * 3_600_000).toISOString()
    const { start, end } = dayBounds(now)

    const [breached, risk, mine, activeTickets, remoteToday, remoteReady] = await Promise.all([
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', [...ACTIVE_TICKET_STATUSES])
        .lt('resolution_due_at', now.toISOString()),
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', [...ACTIVE_TICKET_STATUSES])
        .gte('resolution_due_at', now.toISOString())
        .lte('resolution_due_at', soon),
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', [...ACTIVE_TICKET_STATUSES])
        .eq('assignee_id', userId),
      supabase
        .from('tickets')
        .select('id, requester_id')
        .in('status', [...ACTIVE_TICKET_STATUSES]),
      supabase
        .from('remote_sessions')
        .select('ticket_id', { count: 'exact', head: true })
        .in('status', ACTIVE_REMOTE_STATUSES)
        .gte('scheduled_for', start)
        .lte('scheduled_for', end),
      supabase
        .from('remote_sessions')
        .select('ticket_id', { count: 'exact', head: true })
        .eq('status', 'ready'),
    ])

    let awaiting = 0
    const tickets = activeTickets.data ?? []
    if (tickets.length > 0) {
      const { data: comments } = await supabase
        .from('ticket_comments')
        .select('ticket_id, author_id, created_at')
        .in('ticket_id', tickets.map((ticket) => ticket.id))
        .eq('is_internal', false)
        .order('created_at', { ascending: true })
      awaiting = findAwaitingReplyTicketIds(tickets, comments ?? []).size
    }

    setStats({
      breached: breached.count ?? 0,
      risk: risk.count ?? 0,
      mine: mine.count ?? 0,
      awaiting,
      remoteToday: remoteToday.count ?? 0,
      remoteReady: remoteReady.count ?? 0,
    })
  }, [userId])

  useEffect(() => {
    // load() only sets state after awaiting Supabase, so no cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const interval = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [load])

  return (
    <div className="flex items-center gap-1.5">
      {stats.breached > 0 && (
        <StatChip
          href="/tickets?sla=breached"
          icon={AlertTriangle}
          label={`${stats.breached} vencido${stats.breached > 1 ? 's' : ''}`}
          className="border-red-500/25 bg-red-500/10 text-red-400 hover:border-red-500/50"
        />
      )}
      {stats.risk > 0 && (
        <StatChip
          href="/tickets?sla=risk"
          icon={Clock}
          label={`${stats.risk} vencendo em 4h`}
          className="border-amber-500/25 bg-amber-500/10 text-amber-400 hover:border-amber-500/50"
        />
      )}
      {stats.awaiting > 0 && (
        <StatChip
          href="/tickets?awaiting=1"
          icon={MessageSquare}
          label={`${stats.awaiting} aguardando resposta`}
          className="border-sky-500/25 bg-sky-500/10 text-sky-400 hover:border-sky-500/50"
        />
      )}
      {stats.remoteReady > 0 && (
        <StatChip
          href="/tickets?remote=ready"
          icon={MonitorSmartphone}
          label={`${stats.remoteReady} sessão autorizada`}
          className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/50"
        />
      )}
      {stats.remoteToday > 0 && (
        <StatChip
          href="/tickets?remote=today"
          icon={MonitorSmartphone}
          label={`${stats.remoteToday} sessão hoje`}
          className="border-violet-500/25 bg-violet-500/10 text-violet-400 hover:border-violet-500/50"
        />
      )}
      <StatChip
        href="/tickets?assignee=me"
        icon={Inbox}
        label={`${stats.mine} comigo`}
        className="border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
      />
    </div>
  )
}

function StatChip({
  href,
  icon: Icon,
  label,
  className,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  )
}
