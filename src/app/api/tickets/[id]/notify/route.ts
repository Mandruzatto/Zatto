import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

/**
 * Avisa por e-mail quem precisa agir num chamado.
 *
 * A régua é deliberadamente estreita (ver docs/roadmap.md): e-mail só para quem
 * não vive dentro do sistema e só quando precisa agir. Volume alto faz a pessoa
 * filtrar tudo, inclusive o que importava.
 *
 *   approval_requested -> o aprovador. Ele quase nunca abre o sistema e o
 *                         atendimento fica parado esperando por ele.
 *   ticket_replied     -> o solicitante, e só ele. Analista vive aqui dentro e
 *                         recebe pelo sino.
 *   ticket_finalized   -> o solicitante, que ainda vai avaliar.
 *
 * Todo o resto fica só no sino.
 *
 * O corpo da requisição não escolhe destinatário nem texto: o evento é validado
 * contra o estado real do chamado e o destinatário sai daí. Assim não há como
 * usar esta rota para mandar e-mail arbitrário para alguém.
 *
 * Nota: quem dispara é o app, logo depois da ação. Notificação não enviada não
 * é reenviada sozinha — a coluna notifications.email_sent_at existe para quando
 * houver um agendador com chave de serviço fazendo esse retrabalho.
 */

type Event = 'approval_requested' | 'ticket_replied' | 'ticket_finalized'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { event } = (await request.json()) as { event?: Event }
  if (!event) return NextResponse.json({ error: 'Evento não informado' }, { status: 400 })

  // O RLS já garante que o chamado é do cliente de quem chamou.
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, status, requester_id, approval_status')
    .eq('id', ticketId)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

  let recipientId: string | null = null

  if (event === 'approval_requested') {
    // Só avisa se de fato existe aprovação pendente com alguém designado.
    const { data: approval } = await supabase
      .from('ticket_approvals')
      .select('approver_id, decision')
      .eq('ticket_id', ticketId)
      .maybeSingle()

    if (approval?.decision === 'pending' && approval.approver_id) {
      recipientId = approval.approver_id
    }
  } else if (event === 'ticket_finalized') {
    if (ticket.status === 'finalized') recipientId = ticket.requester_id
  } else if (event === 'ticket_replied') {
    recipientId = ticket.requester_id
  }

  // Ninguém é avisado da própria ação.
  if (!recipientId || recipientId === user.id) {
    return NextResponse.json({ ok: true, enviado: false })
  }

  const { data: recipient } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', recipientId)
    .single()

  if (!recipient?.email) return NextResponse.json({ ok: true, enviado: false })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const url =
    event === 'approval_requested'
      ? `${origin}/approvals`
      : `${origin}/my-tickets/${ticket.id}`

  const assunto =
    event === 'approval_requested'
      ? `Aprovação pendente — [${ticket.ticket_number}] ${ticket.title}`
      : event === 'ticket_finalized'
        ? `Chamado finalizado — [${ticket.ticket_number}] ${ticket.title}`
        : `Nova resposta — [${ticket.ticket_number}] ${ticket.title}`

  const intro =
    event === 'approval_requested'
      ? 'Uma solicitação está aguardando a sua aprovação. Sem ela, o atendimento não segue.'
      : event === 'ticket_finalized'
        ? 'Seu chamado foi finalizado. Se ainda não resolveu, dá para reabrir pelo portal.'
        : 'Há uma nova resposta no seu chamado.'

  const result = await sendEmail({
    to: [recipient.email],
    subject: assunto,
    text: [`Olá ${recipient.full_name},`, '', intro, '', url].join('\n'),
  })

  if (result.status === 'failed') {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    enviado: result.status === 'sent',
    redirectedTo: result.status === 'sent' ? result.redirectedTo : undefined,
  })
}
