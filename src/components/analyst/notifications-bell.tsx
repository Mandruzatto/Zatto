'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle2, MessageSquare, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'

const SEEN_KEY = 'zatto:notifications-seen'
const REFRESH_MS = 60_000
const ACTIVE_STATUSES = ['open', 'awaiting_approval', 'in_progress', 'pending', 'scheduled']

type Notification = {
  id: string
  ticketId: string
  kind: 'assigned' | 'approved' | 'reply'
  ticketNumber: string
  title: string
  at: string
}

const KIND_META = {
  assigned: { icon: UserCheck, label: 'Atribuído a você', color: 'text-sky-400' },
  approved: { icon: CheckCircle2, label: 'Aprovado, pronto para atendimento', color: 'text-emerald-400' },
  reply: { icon: MessageSquare, label: 'Nova resposta do solicitante', color: 'text-amber-400' },
} as const

function seenAt(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? new Date(Date.now() - 7 * 86_400_000).toISOString()
  } catch {
    return new Date(Date.now() - 7 * 86_400_000).toISOString()
  }
}

export function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const since = seenAt()

    const [assigned, approved, replied] = await Promise.all([
      supabase
        .from('tickets')
        .select('id, ticket_number, title, updated_at')
        .eq('assignee_id', userId)
        .in('status', ACTIVE_STATUSES)
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('tickets')
        .select('id, ticket_number, title, updated_at')
        .eq('approval_status', 'approved')
        .eq('status', 'open')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('ticket_comments')
        .select('id, created_at, ticket:tickets!ticket_id(id, ticket_number, title, requester_id, assignee_id)')
        .eq('is_internal', false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const list: Notification[] = []

    assigned.data?.forEach((ticket) =>
      list.push({
        id: `assigned-${ticket.id}`,
        ticketId: ticket.id,
        kind: 'assigned',
        ticketNumber: ticket.ticket_number,
        title: ticket.title,
        at: ticket.updated_at,
      })
    )

    approved.data?.forEach((ticket) =>
      list.push({
        id: `approved-${ticket.id}`,
        ticketId: ticket.id,
        kind: 'approved',
        ticketNumber: ticket.ticket_number,
        title: ticket.title,
        at: ticket.updated_at,
      })
    )

    replied.data?.forEach((comment) => {
      const ticket = comment.ticket as unknown as {
        id: string
        ticket_number: string
        title: string
        requester_id: string
        assignee_id: string | null
      } | null
      if (!ticket || ticket.assignee_id !== userId) return
      list.push({
        id: `reply-${comment.id}`,
        ticketId: ticket.id,
        kind: 'reply',
        ticketNumber: ticket.ticket_number,
        title: ticket.title,
        at: comment.created_at,
      })
    })

    const deduped = Array.from(new Map(list.map((item) => [item.id, item])).values()).sort((a, b) =>
      b.at.localeCompare(a.at)
    )

    setItems(deduped.slice(0, 12))
    setUnread(deduped.length)
  }, [userId])

  useEffect(() => {
    // load() only sets state after awaiting Supabase, so no cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const interval = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!open) return
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function markAllRead() {
    try {
      localStorage.setItem(SEEN_KEY, new Date().toISOString())
    } catch {}
    setItems([])
    setUnread(0)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificações"
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
          open
            ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
            : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200'
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold tabular-nums text-zinc-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-zinc-950/60">
          <div className="flex items-center justify-between border-b border-zinc-800/70 px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-zinc-200">Novidades</p>
            {items.length > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-zinc-500 hover:text-zinc-200">
                Marcar como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.map((item) => {
              const meta = KIND_META[item.kind]
              const Icon = meta.icon
              return (
                <Link
                  key={item.id}
                  href={`/tickets/${item.ticketId}`}
                  onClick={() => setOpen(false)}
                  className="flex gap-2.5 border-b border-zinc-800/50 px-3.5 py-3 last:border-0 hover:bg-zinc-900/60"
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.color)} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-zinc-200">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      <span className="font-mono">{item.ticketNumber}</span> · {meta.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-700">{formatDate(item.at)}</p>
                  </div>
                </Link>
              )
            })}
            {items.length === 0 && (
              <p className="px-3.5 py-8 text-center text-[12px] text-zinc-600">
                Nenhuma novidade desde a última visita.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
