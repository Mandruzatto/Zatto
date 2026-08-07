import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Recebe e-mail de entrada e devolve a mensagem para o chamado.
 *
 * Fecha o ciclo do composer: hoje quem responde o e-mail fala com o vazio, e o
 * rodapé precisa pedir para responder pelo portal.
 *
 * ATENÇÃO — esta rota ainda não foi exercitada de ponta a ponta. Receber e-mail
 * exige um domínio com registros MX apontando para o provedor, e ainda não há
 * domínio. O formato do corpo abaixo segue o payload do Resend; se ele divergir,
 * o ajuste é no parse, não na lógica.
 *
 * Segurança: a rota é pública por natureza (quem chama é o provedor), então a
 * assinatura do webhook é obrigatória. Sem INBOUND_WEBHOOK_SECRET configurado a
 * rota recusa tudo, em vez de aceitar qualquer requisição.
 */

type InboundPayload = {
  from?: string
  to?: string[]
  subject?: string
  text?: string
}

/** O número do chamado viaja no assunto: "[TKT-1042] ..." */
function extractTicketNumber(subject: string) {
  return subject.match(/\bTKT-\d+\b/i)?.[0]?.toUpperCase() ?? null
}

/**
 * Corta citação e assinatura. Sem isso, cada resposta arrastaria o histórico
 * inteiro para dentro do chamado.
 */
function stripQuotedReply(text: string) {
  const cutMarkers = [
    /^-{2,}\s*$/m,
    /^_{4,}\s*$/m,
    /^Em .+ escreveu:$/m,
    /^On .+ wrote:$/m,
    /^De: /m,
    /^From: /m,
    /^>/m,
  ]

  let cut = text.length
  for (const marker of cutMarkers) {
    const found = text.search(marker)
    if (found >= 0 && found < cut) cut = found
  }
  return text.slice(0, cut).trim()
}

function signatureIsValid(raw: string, header: string | null) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET
  if (!secret || !header) return false

  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  const received = header.replace(/^sha256=/, '')

  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const raw = await request.text()

  if (!signatureIsValid(raw, request.headers.get('webhook-signature'))) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  let payload: InboundPayload
  try {
    payload = JSON.parse(raw) as InboundPayload
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const from = payload.from?.match(/<(.+)>/)?.[1] ?? payload.from
  const ticketNumber = extractTicketNumber(payload.subject ?? '')
  const body = stripQuotedReply(payload.text ?? '')

  if (!from || !ticketNumber || !body) {
    // Sem número de chamado não há onde encaixar. Responder 200 evita que o
    // provedor fique reenviando algo que nunca vai dar certo.
    return NextResponse.json({ ok: true, ignorado: 'sem chamado, remetente ou texto' })
  }

  const supabase = await createClient()

  // Só quem já é cadastrado consegue escrever no chamado por e-mail; caso
  // contrário qualquer um que descobrisse o número escreveria em nome de outro.
  const { data: author } = await supabase
    .from('profiles')
    .select('id, tenant_id')
    .ilike('email', from)
    .maybeSingle()

  if (!author) {
    return NextResponse.json({ ok: true, ignorado: 'remetente não cadastrado' })
  }

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id')
    .eq('ticket_number', ticketNumber)
    .eq('tenant_id', author.tenant_id)
    .maybeSingle()

  if (!ticket) {
    return NextResponse.json({ ok: true, ignorado: 'chamado não encontrado nesse cliente' })
  }

  const { error } = await supabase.from('ticket_comments').insert({
    ticket_id: ticket.id,
    author_id: author.id,
    content: body,
    is_internal: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, chamado: ticketNumber })
}
