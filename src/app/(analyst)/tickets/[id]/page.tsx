import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TicketManagement, CommentForm } from '@/components/analyst/ticket-management'
import { TicketAssetsManager } from '@/components/analyst/ticket-assets'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  TICKET_TYPE_COLORS, TICKET_TYPE_LABELS,
  TICKET_AREA_COLORS, TICKET_AREA_LABELS,
  ASSET_TYPE_LABELS, ASSET_STATUS_COLORS, ASSET_STATUS_LABELS,
  getWarrantyStatus, WARRANTY_STATUS_LABELS, WARRANTY_STATUS_COLORS,
  formatDate, getSlaState, getScheduleState
} from '@/lib/utils'
import { Monitor, User, Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Asset, Profile, Ticket, TicketApproval, WarrantyStatus, TicketArea } from '@/lib/types'

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
    { data: comments },
    { data: analysts },
    { data: approval },
    { data: approvers },
  ] = await Promise.all([
    supabase.from('ticket_assets').select('asset:assets(*)').eq('ticket_id', id),
    supabase
      .from('asset_assignments')
      .select('asset:assets(*)')
      .eq('user_id', ticket.requester_id)
      .is('returned_at', null),
    supabase
      .from('ticket_comments')
      .select('*, author:profiles!author_id(full_name, role)')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, full_name').eq('role', 'analyst').order('full_name'),
    supabase.from('ticket_approvals').select('*, approver:profiles!approver_id(*)').eq('ticket_id', id).maybeSingle(),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  const requester = ticket.requester as unknown as Profile | null
  const ticketApproval = approval as unknown as (TicketApproval & {
    approver?: { full_name?: string } | null
  }) | null
  const isApproved = ticket.approval_status === 'approved' || ticketApproval?.decision === 'approved'
  const isRejected = ticket.approval_status === 'rejected' || ticketApproval?.decision === 'rejected'

  type CommentRow = {
    id: string
    content: string
    is_internal: boolean
    created_at: string
    author: { full_name: string; role: string } | null
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <Link href="/tickets" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Chamados
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-[13px] text-zinc-600 font-mono">{ticket.ticket_number}</span>
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
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{ticket.title}</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Solicitante:{' '}
          <Link
            href={`/users/${ticket.requester_id}`}
            className="font-medium text-zinc-300 hover:text-white transition-colors"
          >
            {requester?.full_name ?? 'não identificado'}
          </Link>
          {requester?.department && <span className="text-zinc-600"> · {requester.department}</span>}
          {requester?.email && <span className="text-zinc-600"> · {requester.email}</span>}
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
                  <p className="text-xs text-zinc-600 mt-2.5">Resolvido em {formatDate(ticket.resolved_at)}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Equipamentos do solicitante</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {requesterAssets && requesterAssets.length > 0 ? (
                <div className="divide-y divide-zinc-800/70">
                  {requesterAssets.map((ra) => {
                    const asset = ra.asset as unknown as Asset
                    const warranty = getWarrantyStatus(asset.warranty_end_date)
                    return (
                      <Link
                        key={asset.id}
                        href={`/assets/${asset.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-900/60 transition-colors"
                      >
                        <Monitor className="h-4 w-4 text-zinc-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-zinc-200">{asset.name}</p>
                          <p className="text-xs text-zinc-600 font-mono">
                            {asset.asset_tag} · {ASSET_TYPE_LABELS[asset.type]}
                          </p>
                        </div>
                        <Badge className={WARRANTY_STATUS_COLORS[warranty as WarrantyStatus]}>
                          {WARRANTY_STATUS_LABELS[warranty as WarrantyStatus]}
                        </Badge>
                        <Badge className={ASSET_STATUS_COLORS[asset.status]}>
                          {ASSET_STATUS_LABELS[asset.status]}
                        </Badge>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="px-5 py-6 text-[13px] text-zinc-600 text-center">
                  Nenhum equipamento sob responsabilidade.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Conversa ({comments?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="p-0">
              {comments && comments.length > 0 ? (
                <div className="divide-y divide-zinc-800/70">
                  {(comments as unknown as CommentRow[]).map((comment) => (
                    <div key={comment.id} className={`px-5 py-4 ${comment.is_internal ? 'bg-amber-500/[0.04]' : ''}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[13px] font-medium text-zinc-200">{comment.author?.full_name}</span>
                        {comment.is_internal && (
                          <span className="text-[11px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">Interno</span>
                        )}
                        <span className="text-xs text-zinc-600 ml-auto">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-[13px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-6 text-[13px] text-zinc-600 text-center">Nenhum comentário ainda.</div>
              )}
              <CommentForm ticketId={ticket.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <TicketManagement
            ticket={ticket as unknown as Ticket}
            analysts={analysts ?? []}
            approvers={approvers ?? []}
            currentApproval={(approval as unknown as TicketApproval | null) ?? null}
            currentUserId={user!.id}
          />
          {ticketApproval?.approver_id && ticket.status === 'awaiting_approval' && (
            <Card className="border-cyan-500/20">
              <CardHeader><CardTitle>Fila de aprovação</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <p className="text-[13px] text-zinc-300">
                  Aguardando {ticketApproval.approver?.full_name ?? 'aprovador'}
                </p>
                <p className="text-xs text-zinc-600">
                  Altere o aprovador na triagem se precisar redistribuir.
                </p>
              </CardContent>
            </Card>
          )}
          {isApproved && ticketApproval && (
            <Card className="border-emerald-500/20">
              <CardHeader><CardTitle>Aprovação</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <p className="text-[13px] text-emerald-300">Solicitação aprovada</p>
                <p className="text-xs text-zinc-600">
                  {ticketApproval.approver?.full_name ?? 'Aprovador'}
                  {ticketApproval.decided_at ? ` · ${formatDate(ticketApproval.decided_at)}` : ''}
                </p>
                {ticketApproval.comment && (
                  <p className="text-xs text-zinc-500">Comentário: {ticketApproval.comment}</p>
                )}
              </CardContent>
            </Card>
          )}
          {isRejected && ticketApproval && (
            <Card className="border-red-500/20">
              <CardHeader><CardTitle>Aprovação</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <p className="text-[13px] text-red-300">Solicitação rejeitada</p>
                {ticketApproval.comment && (
                  <p className="text-xs text-zinc-500">Motivo: {ticketApproval.comment}</p>
                )}
              </CardContent>
            </Card>
          )}

          {ticket.resolution_due_at && (
            <Card>
              <CardHeader><CardTitle>SLA</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const sla = getSlaState(ticket.resolution_due_at, ticket.resolved_at)
                  return <Badge className={sla.className}>{sla.label}</Badge>
                })()}
                <p className="text-xs text-zinc-600">Resolução até {formatDate(ticket.resolution_due_at)}</p>
                {ticket.first_response_due_at && (
                  <p className="text-xs text-zinc-600">
                    Primeira resposta: {ticket.first_responded_at ? formatDate(ticket.first_responded_at) : `até ${formatDate(ticket.first_response_due_at)}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-600">Solicitante</p>
                  <Link href={`/users/${ticket.requester_id}`} className="text-[13px] font-medium text-zinc-200 hover:text-white transition-colors">
                    {requester?.full_name}
                  </Link>
                  {requester?.department && (
                    <p className="text-xs text-zinc-600">{requester.department}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-600">Criado em</p>
                  <p className="text-[13px] font-medium text-zinc-200">{formatDate(ticket.created_at)}</p>
                </div>
              </div>

              {ticket.resolved_at && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-600">Resolvido em</p>
                    <p className="text-[13px] font-medium text-zinc-200">{formatDate(ticket.resolved_at)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
