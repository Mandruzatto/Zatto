import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailMode, sendEmail } from '@/lib/email'

type Body = {
  content?: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'analyst') {
    return NextResponse.json({ error: 'Apenas analistas enviam e-mail pelo chamado' }, { status: 403 })
  }

  // O RLS já limita o chamado ao cliente do analista; se não vier nada, não é dele.
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, ticket_number, title, requester_id')
    .eq('id', ticketId)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 })

  const body = (await request.json()) as Body
  const content = body.content?.trim()
  if (!content) return NextResponse.json({ error: 'Escreva a mensagem' }, { status: 400 })

  const ids = [...new Set([...(body.to ?? []), ...(body.cc ?? []), ...(body.bcc ?? [])])]
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Escolha ao menos um destinatário' }, { status: 400 })
  }

  // Resolve nome -> e-mail pelo cadastro. O RLS garante que só vêm pessoas do
  // mesmo cliente, então não dá para enviar para fora do ambiente.
  const { data: people } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids)

  const byId = new Map((people ?? []).map((person) => [person.id, person]))
  const resolve = (list?: string[]) =>
    (list ?? []).map((personId) => byId.get(personId)).filter(Boolean) as {
      id: string
      full_name: string
      email: string
    }[]

  const to = resolve(body.to)
  const cc = resolve(body.cc)
  const bcc = resolve(body.bcc)

  if (to.length === 0) {
    return NextResponse.json({ error: 'Escolha ao menos um destinatário principal' }, { status: 400 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const ticketUrl = `${origin}/my-tickets/${ticket.id}`

  const result = await sendEmail({
    to: to.map((person) => person.email),
    cc: cc.length ? cc.map((person) => person.email) : undefined,
    bcc: bcc.length ? bcc.map((person) => person.email) : undefined,
    subject: `[${ticket.ticket_number}] ${ticket.title}`,
    text: [
      content,
      '',
      '—',
      `Chamado: ${ticketUrl}`,
      // Sem e-mail de entrada ainda, responder por aqui não volta para o chamado.
      'Responda pelo portal para que a equipe veja sua mensagem.',
    ].join('\n'),
  })

  if (result.status === 'failed') {
    return NextResponse.json({ error: `Falha no envio: ${result.error}` }, { status: 502 })
  }

  // O log da conversa registra os nomes, não os endereços: é o que o solicitante
  // reconhece, e evita espalhar e-mail de terceiro na tela.
  const recipientNames = [
    ...to.map((person) => person.full_name),
    ...cc.map((person) => `${person.full_name} (cópia)`),
    ...bcc.map((person) => `${person.full_name} (cópia oculta)`),
  ]

  const { error: commentError } = await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    author_id: user.id,
    content,
    is_internal: false,
    email_recipients: recipientNames,
  })

  if (commentError) {
    return NextResponse.json(
      { warning: 'E-mail enviado, mas não foi registrado na conversa', error: commentError.message },
      { status: 207 }
    )
  }

  return NextResponse.json({
    ok: true,
    mode: emailMode(),
    recipients: recipientNames,
    redirectedTo: result.status === 'sent' ? result.redirectedTo : undefined,
  })
}
