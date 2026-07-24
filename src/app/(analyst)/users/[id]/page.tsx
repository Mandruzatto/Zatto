import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserEdit, PasswordReset, UserAssetsPanel } from '@/components/analyst/user-management'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  formatDate,
} from '@/lib/utils'
import { ArrowLeft, Ticket as TicketIcon } from 'lucide-react'
import type { Asset, Profile, TicketStatus, TicketPriority } from '@/lib/types'

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const [{ data: assignments }, { data: tickets }] = await Promise.all([
    supabase
      .from('asset_assignments')
      .select('id, asset:assets(*)')
      .eq('user_id', id)
      .is('returned_at', null),
    supabase
      .from('tickets')
      .select('id, ticket_number, title, status, priority, created_at')
      .eq('requester_id', id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const heldAssets = (assignments ?? []).map((a) => {
    const asset = a.asset as unknown as Asset
    return {
      assignmentId: a.id,
      id: asset.id,
      asset_tag: asset.asset_tag,
      name: asset.name,
      type: asset.type,
    }
  })

  type TicketRow = {
    id: string
    ticket_number: string
    title: string
    status: TicketStatus
    priority: TicketPriority
    created_at: string
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Link href="/users" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Colaboradores
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{profile.full_name}</h1>
          {profile.role === 'analyst' && (
            <Badge className="bg-violet-500/10 text-violet-400">Analista</Badge>
          )}
        </div>
        <p className="text-[13px] text-zinc-500">
          {profile.email}
          {profile.job_title && ` · ${profile.job_title}`}
          {profile.department && ` · ${profile.department}`}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <UserEdit profile={profile as unknown as Profile} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TicketIcon className="h-4 w-4 text-zinc-500" />
                Chamados do colaborador
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tickets && tickets.length > 0 ? (
                <div className="divide-y divide-zinc-800/70">
                  {(tickets as unknown as TicketRow[]).map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-zinc-200 truncate">{ticket.title}</p>
                        <p className="text-xs text-zinc-600 font-mono mt-0.5">
                          {ticket.ticket_number} · {formatDate(ticket.created_at)}
                        </p>
                      </div>
                      <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </Badge>
                      <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-6 text-[13px] text-zinc-600 text-center">
                  Nenhum chamado aberto por este colaborador.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <UserAssetsPanel userId={profile.id} heldAssets={heldAssets} />
          <PasswordReset userId={profile.id} />
        </div>
      </div>
    </div>
  )
}
