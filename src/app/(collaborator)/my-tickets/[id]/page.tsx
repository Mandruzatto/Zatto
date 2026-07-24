import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TICKET_STATUS_COLORS, TICKET_STATUS_LABELS,
  TICKET_PRIORITY_COLORS, TICKET_PRIORITY_LABELS,
  TICKET_CATEGORY_LABELS, formatDate
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

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link href="/my-tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-gray-500 font-mono">{ticket.ticket_number}</span>
          <Badge className={TICKET_STATUS_COLORS[ticket.status as keyof typeof TICKET_STATUS_COLORS]}>
            {TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS]}
          </Badge>
          <Badge className={TICKET_PRIORITY_COLORS[ticket.priority as keyof typeof TICKET_PRIORITY_COLORS]}>
            {TICKET_PRIORITY_LABELS[ticket.priority as keyof typeof TICKET_PRIORITY_LABELS]}
          </Badge>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="flex items-start gap-2">
          <Tag className="h-4 w-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Categoria</p>
            <p className="font-medium text-gray-900">
              {TICKET_CATEGORY_LABELS[ticket.category as keyof typeof TICKET_CATEGORY_LABELS]}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Atendente</p>
            <p className="font-medium text-gray-900">
              {(ticket.assignee as any)?.full_name ?? <span className="text-gray-400 italic">Não atribuído</span>}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Criado em</p>
            <p className="font-medium text-gray-900">{formatDate(ticket.created_at)}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Atualizações ({comments?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {comments && comments.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {comments.map((comment: any) => (
                <div key={comment.id} className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{comment.author?.full_name}</span>
                    {comment.author?.role === 'analyst' && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Suporte</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-sm text-gray-400 text-center">
              Nenhuma atualização ainda. Nossa equipe irá entrar em contato em breve.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
