import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TicketManagement, ApprovalManagement } from '@/components/analyst/ticket-management'
import { TicketAssetsManager } from '@/components/analyst/ticket-assets'
import { TicketChat } from '@/components/ticket-chat'
import { loadTicketChat } from '@/lib/ticket-chat'
import { CopyTicketNumber } from '@/components/copy-ticket-number'
import { TicketStatusTimeline, type StatusEvent } from '@/components/analyst/ticket-status-timeline'
import { RemoteSessionPanel } from '@/components/remote-session-panel'
import type { RemoteSession } from '@/lib/types'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  TICKET_TYPE_COLORS, TICKET_TYPE_LABELS,
  TICKET_AREA_COLORS, TICKET_AREA_LABELS,
  formatDate, getSlaState, getScheduleState
} from '@/lib/utils'
import { ArrowLeft, Star } from 'lucide-react'
import Link from 'next/link'
import type { Asset, Profile, Ticket, TicketApproval, TicketArea } from '@/lib/types'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()

  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      *,
      requester:profiles!requester_id(*),
      assignee:profiles!assignee_id(*)
    `)
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  const [
    { data: ticketAssets },
    { data: requesterAssets },
    messages,
    { data: analysts },
    { data: approval },
    { data: approvers },
    { data: statusEvents },
    { data: remoteSessions },
    { data: satisfaction },
  ] = await Promise.all([
    supabase.from('ticket_assets').select('asset:assets(*)').eq('ticket_id', id),
    supabase
      .from('asset_assignments')
      .select('asset:assets(*)')
      .eq('user_id', ticket.requester_id)
      .is('returned_at', null),
    loadTicketChat(id, { includeInternal: true }),
    supabase.from('profiles').select('id, full_name').eq('role', 'analyst').order('full_name'),
    supabase.from('ticket_approvals').select('*, approver:profiles!approver_id(*)').eq('ticket_id', id).maybeSingle(),
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
    supabase
      .from('ticket_events')
      .select('id, event_type, from_status, to_status, metadata, created_at, actor:profiles!actor_id(full_name)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('remote_sessions')
      .select('*, proposer:profiles!proposed_by(full_name)')
      .eq('ticket_id', id)
      .order('scheduled_for', { ascending: false }),
    supabase.from('ticket_satisfaction').select('*').eq('ticket_id', id).maybeSingle(),
  ])

  const requester = ticket.requester as unknown as Profile | null
  const ticketApproval = approval as unknown as (TicketApproval & {
    approver?: { full_name?: string } | null
  }) | null
  const isApproved = ticket.approval_status === 'approved' || ticketApproval?.decision === 'approved'
  const isRejected = ticket.approval_status === 'rejected' || ticketApproval?.decision === 'rejected'
  const sla = ticket.resolution_due_at
    ? getSlaState(ticket.resolution_due_at, ticket.resolved_at)
    : null

  const formResponses = (ticket.form_responses ?? {}) as Record<string, string>
  const defaultAnydesk = formResponses.anydesk ?? ''
  const sessions = (remoteSessions ?? []).map((row) => ({
    ...row,
    proposer: row.proposer as unknown as { full_name: string } | null,
  })) as RemoteSession[]

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Link href="/tickets" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Chamados
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <CopyTicketNumber value={ticket.ticket_number} />
          <Badge className={TICKET_STATUS_COLORS[ticket.status as keyof typeof TICKET_STATUS_COLORS]}>
            {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS]}
          </Badge>
          <Badge className={TICKET_PRIORITY_COLORS[ticket.priority as keyof typeof TICKET_PRIORITY_COLORS]}>
            {TICKET_PRIORITY_LABELS[ticket.priority as keyof typeof TICKET_PRIORITY_LABELS]}
          </Badge>
          <Badge className={TICKET_TYPE_COLORS[ticket.type as keyof typeof TICKET_TYPE_COLORS]}>
            {TICKET_TYPE_LABELS[ticket.type as keyof typeof TICKET_TYPE_LABELS]}
          </Badge>
          {ticket.area && (
            <Badge className={TICKET_AREA_COLORS[ticket.area as TicketArea]}>
              {TICKET_AREA_LABELS[ticket.area as TicketArea]}
            </Badge>
          )}
          {isApproved && (
            <Badge className="bg-emerald-500/10 text-emerald-400">Aprovado</Badge>
          )}
          {isRejected && (
            <Badge className="bg-red-500/10 text-red-400">Rejeitado</Badge>
          )}
          {sla?.hot && (
            <Badge className={sla.className}>{sla.label}</Badge>
          )}
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{ticket.title}</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Solicitante:{' '}
          <Link
            href={`/users/${ticket.requester_id}`}
            className="font-medium text-zinc-300 hover:text-zinc-50 transition-colors"
          >
            {requester?.full_name ?? 'não identificado'}
          </Link>
          {requester?.department && <span className="text-zinc-600"> · {requester.department}</span>}
          {requester?.email && <span className="text-zinc-600"> · {requester.email}</span>}
          {requester?.phone && (
            <>
              <span className="text-zinc-600"> · </span>
              <a
                href={`https://wa.me/55${requester.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-400/90 hover:text-emerald-300"
              >
                {requester.phone}
              </a>
            </>
          )}
          <span className="text-zinc-600"> · criado {formatDate(ticket.created_at)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          {isApproved && (
            <Card className="border-emerald-500/20">
              <CardHeader><CardTitle>Aprovado — pode seguir o atendimento</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <p className="text-[13px] text-zinc-300">
                  Esta solicitação foi aprovada
                  {ticketApproval?.approver?.full_name ? ` por ${ticketApproval.approver.full_name}` : ''}
                  {ticketApproval?.decided_at ? ` em ${formatDate(ticketApproval.decided_at)}` : ''}
                  .
                </p>
                {ticketApproval?.comment && (
                  <p className="text-xs text-zinc-500">Comentário: {ticketApproval.comment}</p>
                )}
              </CardContent>
            </Card>
          )}

          {isRejected && (
            <Card className="border-red-500/20">
              <CardHeader><CardTitle>Solicitação rejeitada</CardTitle></CardHeader>
              <CardContent>
                {ticketApproval?.comment ? (
                  <p className="text-[13px] text-zinc-300">Motivo: {ticketApproval.comment}</p>
                ) : (
                  <p className="text-[13px] text-zinc-400">Sem comentário do aprovador.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
            <CardContent>
              <p className="text-[13px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </CardContent>
          </Card>

          {ticket.status === 'scheduled' && ticket.scheduled_for && (
            <Card className="border-violet-500/20">
              <CardHeader><CardTitle>Agendamento</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-2.5">
                <Badge className={getScheduleState(ticket.scheduled_for).className}>
                  {getScheduleState(ticket.scheduled_for).label}
                </Badge>
                <p className="text-[13px] text-zinc-300">{formatDate(ticket.scheduled_for)}</p>
              </CardContent>
            </Card>
          )}

          {ticket.status === 'pending' && ticket.pending_reason && (
            <Card className="border-orange-500/20">
              <CardHeader><CardTitle>Motivo da pendência</CardTitle></CardHeader>
              <CardContent>
                <p className="text-[13px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{ticket.pending_reason}</p>
              </CardContent>
            </Card>
          )}

          {ticket.resolution && (
            <Card className="border-emerald-500/20">
              <CardHeader><CardTitle>Resolução</CardTitle></CardHeader>
              <CardContent>
                <p className="text-[13px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{ticket.resolution}</p>
                {ticket.resolved_at && (
                  <p className="text-xs text-zinc-600 mt-2.5">Finalizado em {formatDate(ticket.resolved_at)}</p>
                )}
              </CardContent>
            </Card>
          )}

          {satisfaction && (
            <Card className="border-amber-500/20">
              <CardHeader><CardTitle>Avaliação do solicitante</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        className={`h-4 w-4 ${
                          value <= satisfaction.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[13px] text-zinc-400">{satisfaction.rating} de 5</span>
                </div>
                {satisfaction.comment && (
                  <p className="text-[13px] text-zinc-300 whitespace-pre-wrap">{satisfaction.comment}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <TicketChat
              ticketId={ticket.id}
              messages={messages}
              mode="analyst"
              closed={ticket.status === 'finalized'}
              people={(approvers ?? []) as { id: string; full_name: string; email: string }[]}
              requesterId={ticket.requester_id}
            />
          </Card>

          <TicketStatusTimeline
            events={(statusEvents ?? []).map((event) => ({
              id: event.id,
              event_type: event.event_type,
              from_status: event.from_status,
              to_status: event.to_status,
              metadata: event.metadata as Record<string, string | null> | null,
              created_at: event.created_at,
              actor: event.actor as unknown as { full_name: string } | null,
            })) as StatusEvent[]}
          />
        </div>

        <div className="space-y-5">
          <TicketManagement
            ticket={ticket as unknown as Ticket}
            analysts={analysts ?? []}
            currentApproval={(approval as unknown as TicketApproval | null) ?? null}
            currentUserId={user!.id}
          />

          {(ticket.status === 'awaiting_approval' || ticketApproval) && (
            <ApprovalManagement
              ticketId={ticket.id}
              approval={ticketApproval}
              approvers={approvers ?? []}
              currentUserId={user!.id}
            />
          )}

          <RemoteSessionPanel
            ticketId={ticket.id}
            currentUserId={user!.id}
            mode="analyst"
            sessions={sessions}
            defaultAccessPayload={defaultAnydesk}
            ticketFinalized={ticket.status === 'finalized'}
          />

          {ticket.resolution_due_at && (
            <Card>
              <CardHeader><CardTitle>SLA</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {sla && <Badge className={sla.className}>{sla.label}</Badge>}
                <p className="text-xs text-zinc-600">Resolução até {formatDate(ticket.resolution_due_at)}</p>
                {ticket.first_response_due_at && (
                  <p className="text-xs text-zinc-600">
                    Primeira resposta: {ticket.first_responded_at ? formatDate(ticket.first_responded_at) : `até ${formatDate(ticket.first_response_due_at)}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <TicketAssetsManager
            ticketId={ticket.id}
            linkedAssets={(ticketAssets ?? []).map((ta) => {
              const asset = ta.asset as unknown as Asset
              return { id: asset.id, asset_tag: asset.asset_tag, name: asset.name }
            })}
            requesterAssets={(requesterAssets ?? []).map((ra) => {
              const asset = ra.asset as unknown as Asset
              return {
                id: asset.id,
                asset_tag: asset.asset_tag,
                name: asset.name,
                type: asset.type,
                phone_line: asset.phone_line ?? null,
              }
            })}
          />
        </div>
      </div>
    </div>
  )
}
