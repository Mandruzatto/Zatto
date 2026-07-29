'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const ACTIVE_STATUSES = ['open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled']
const REFRESH_MS = 60_000

export function HeaderStats({ userId }: { userId: string }) {
  const [stats, setStats] = useState({ breached: 0, risk: 0, mine: 0 })

  const load = useCallback(async () => {
    const supabase = createClient()
    const now = new Date()
    const soon = new Date(now.getTime() + 4 * 3_600_000).toISOString()

    const [breached, risk, mine] = await Promise.all([
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ACTIVE_STATUSES)
        .lt('resolution_due_at', now.toISOString()),
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ACTIVE_STATUSES)
        .gte('resolution_due_at', now.toISOString())
        .lte('resolution_due_at', soon),
      supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ACTIVE_STATUSES)
        .eq('assignee_id', userId),
    ])

    setStats({
      breached: breached.count ?? 0,
      risk: risk.count ?? 0,
      mine: mine.count ?? 0,
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
