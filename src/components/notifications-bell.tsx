'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CheckCircle2, MessageSquare, ShieldCheck, UserCheck, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { NotificationKind } from '@/lib/types'

type NotificationRow = {
  id: string
  kind: NotificationKind
  created_at: string
  read_at: string | null
  ticket: {
    id: string
    ticket_number: string
    title: string
    approval_status: string | null
  } | null
  actor: { full_name: string } | null
}

const KIND_META: Record<NotificationKind, { icon: typeof Bell; color: string }> = {
  ticket_assigned: { icon: UserCheck, color: 'text-sky-400' },
  ticket_replied: { icon: MessageSquare, color: 'text-amber-400' },
  ticket_finalized: { icon: CheckCircle2, color: 'text-emerald-400' },
  approval_requested: { icon: ShieldCheck, color: 'text-cyan-400' },
  approval_decided: { icon: CheckCircle2, color: 'text-emerald-400' },
}

function describe(item: NotificationRow, mode: 'analyst' | 'collaborator') {
  const actor = item.actor?.full_name
  switch (item.kind) {
    case 'ticket_assigned':
      return 'Atribuído a você'
    case 'ticket_replied':
      return actor ? `Nova resposta de ${actor}` : 'Nova resposta'
    case 'ticket_finalized':
      return mode === 'collaborator' ? 'Finalizado — avalie o atendimento' : 'Chamado finalizado'
    case 'approval_requested':
      return 'Aprovação pendente com você'
    case 'approval_decided':
      return item.ticket?.approval_status === 'rejected' ? 'Solicitação rejeitada' : 'Solicitação aprovada'
  }
}

function iconFor(item: NotificationRow) {
  if (item.kind === 'approval_decided' && item.ticket?.approval_status === 'rejected') {
    return { icon: XCircle, color: 'text-red-400' }
  }
  return KIND_META[item.kind]
}

function relativeTime(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}

export function NotificationsBell({
  userId,
  mode,
  align = 'right',
}: {
  userId: string
  mode: 'analyst' | 'collaborator'
  /** Lado em que o painel abre. Na sidebar do portal precisa abrir para a direita. */
  align?: 'left' | 'right'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const basePath = mode === 'analyst' ? '/tickets' : '/my-tickets'
  const unread = items.filter((item) => !item.read_at).length

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select(
        'id, kind, created_at, read_at, ticket:tickets!ticket_id(id, ticket_number, title, approval_status), actor:profiles!actor_id(full_name)'
      )
      .order('created_at', { ascending: false })
      .limit(20)

    setItems((data ?? []) as unknown as NotificationRow[])
  }, [])

  useEffect(() => {
    // load() only sets state after awaiting Supabase, so no cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => void load()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load, userId])

  useEffect(() => {
    if (!open) return
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }

  async function markAllRead() {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    await load()
    router.refresh()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : 'Notificações'}
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
        <div
          className={cn(
            'absolute top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-zinc-950/60',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="flex items-center justify-between border-b border-zinc-800/70 px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-zinc-200">Notificações</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-zinc-500 hover:text-zinc-200">
                Marcar como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.map((item) => {
              const { icon: Icon, color } = iconFor(item)
              const isUnread = !item.read_at
              return (
                <Link
                  key={item.id}
                  href={item.ticket ? `${basePath}/${item.ticket.id}` : basePath}
                  onClick={() => {
                    if (isUnread) void markRead(item.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex gap-2.5 border-b border-zinc-800/50 px-3.5 py-3 last:border-0 hover:bg-zinc-900/60',
                    isUnread && 'bg-zinc-900/40'
                  )}
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', color)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[13px]', isUnread ? 'font-medium text-zinc-100' : 'text-zinc-400')}>
                      {item.ticket?.title ?? 'Chamado removido'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {item.ticket && <span className="font-mono">{item.ticket.ticket_number}</span>}
                      {item.ticket && ' · '}
                      {describe(item, mode)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-700">{relativeTime(item.created_at)}</p>
                  </div>
                  {isUnread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />}
                </Link>
              )
            })}
            {items.length === 0 && (
              <p className="px-3.5 py-8 text-center text-[12px] text-zinc-600">
                Nenhuma notificação por aqui.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
