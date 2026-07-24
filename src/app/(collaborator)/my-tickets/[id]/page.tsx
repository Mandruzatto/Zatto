import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  TICKET_TYPE_LABELS, formatDate
} from '@/lib/utils'
import { ArrowLeft, User, Calendar, Tag } from 'lucide-react'
import Link from 'next/link'

export default async function CollaboratorTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { id } = await params

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, assignee:profiles!assignee_id(full_name)')
    .eq('id', id)
    .eq('requester_id', user!.id)
    .single()

  if (!ticket) notFound()

  const { data: comments } = await supabase
    .from('ticket_comments')
    .select('*, author:profiles!author_id(full_name, role)')
    .eq('ticket_id', id)
    .eq('is_internal', false)
    .order('created_at', { ascending: true })

  const { data: approval } = await supabase
    .from('ticket_approvals')
    .select('*, approver:profiles!approver_id(full_name)')
    .eq('ticket_id', id)
    .maybeSingle()

  type CommentRow = {
    id: string
    content: string
    created_at: string
    author: { full_name: string; role: string } | null
  }

  const assignee = ticket.assignee as unknown as { full_name: string } | null

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <Link href="/my-tickets" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Meus Chamados
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] text-zinc-600 font-mono">{ticket.ticket_number}</span>
          <Badge className={TICKET_STATUS_COLORS[ticket.status as keyof typeof TICKET_STATUS_COLORS]}>
            {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS]}
          </Badge>
          <Badge className={TICKET_PRIORITY_COLORS[ticket.priority as keyof typeof TICKET_PRIORITY_COLORS]}>
            {TICKET_PRIORITY_LABELS[ticket.priority as keyof typeof TICKET_PRIORITY_LABELS]}
          </Badge>
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{ticket.title}</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-start gap-2.5">
          <Tag className="h-4 w-4 text-zinc-600 mt-0.5" />
          <div>
            <p className="text-xs text-zinc-600">Tipo</p>
            <p className="text-[13px] font-medium text-zinc-200">
              {TICKET_TYPE_LABELS[ticket.type as keyof typeof TICKET_TYPE_LABELS]}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <User className="h-4 w-4 text-zinc-600 mt-0.5" />
          <div>
            <p className="text-xs text-zinc-600">Atendente</p>
            <p className="text-[13px] font-medium text-zinc-200">
              {assignee?.full_name ?? <span className="text-zinc-600">Não atribuído</span>}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Calendar className="h-4 w-4 text-zinc-600 mt-0.5" />
          <div>
            <p className="text-xs text-zinc-600">Criado em</p>
            <p className="text-[13px] font-medium text-zinc-200">{formatDate(ticket.created_at)}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
        <CardContent>
          <p className="text-[13px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
        </CardContent>
      </Card>

      {approval && (
        <Card className="border-cyan-500/20">
          <CardHeader><CardTitle>Aprovação</CardTitle></CardHeader>
          <CardContent>
            <p className="text-[13px] text-zinc-300">
              {approval.decision === 'approved'
                ? 'Solicitação aprovada'
                : approval.decision === 'rejected'
                  ? 'Solicitação rejeitada'
                  : approval.approver
                    ? `Aguardando decisão de ${(approval.approver as unknown as { full_name: string }).full_name}`
                    : 'Aguardando definição de um aprovador'}
            </p>
            {approval.comment && <p className="mt-2 text-xs text-zinc-500">Comentário: {approval.comment}</p>}
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Atualizações ({comments?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {comments && comments.length > 0 ? (
            <div className="divide-y divide-zinc-800/70">
              {(comments as unknown as CommentRow[]).map((comment) => (
                <div key={comment.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[13px] font-medium text-zinc-200">{comment.author?.full_name}</span>
                    {comment.author?.role === 'analyst' && (
                      <span className="text-[11px] bg-zinc-100 text-zinc-950 px-1.5 py-0.5 rounded font-medium">Suporte</span>
                    )}
                    <span className="text-xs text-zinc-600 ml-auto">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-[13px] text-zinc-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-[13px] text-zinc-600 text-center">
              Nenhuma atualização ainda. Nossa equipe irá entrar em contato em breve.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
