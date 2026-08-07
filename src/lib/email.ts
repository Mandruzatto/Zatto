/**
 * Envio de e-mail via Resend, sem SDK — a API é um POST simples e não vale uma
 * dependência a mais.
 *
 * Três modos, escolhidos pelas variáveis de ambiente:
 *
 * 1. Sem RESEND_API_KEY   -> modo seco: nada sai, o e-mail é registrado no log.
 *    Permite construir e testar o fluxo inteiro sem criar conta em lugar nenhum.
 * 2. Com EMAIL_TEST_INBOX -> modo teste: envia de verdade, mas redireciona todos
 *    os destinatários para esse endereço. Usado enquanto o domínio não está
 *    verificado, para não disparar mensagem real para colaborador nenhum.
 * 3. Só com RESEND_API_KEY -> modo normal.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type EmailRecipients = {
  to: string[]
  cc?: string[]
  bcc?: string[]
}

export type SendEmailInput = EmailRecipients & {
  subject: string
  /** Corpo em texto puro. HTML fica para quando o composer ganhar formatação. */
  text: string
  replyTo?: string
}

export type SendEmailResult =
  | { status: 'sent'; id: string; redirectedTo?: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

function fromAddress(): string {
  // onboarding@resend.dev funciona sem domínio verificado, mas só entrega no
  // e-mail dono da conta Resend. Serve para desenvolvimento.
  return process.env.EMAIL_FROM || 'zaTTo <onboarding@resend.dev>'
}

function describe(input: SendEmailInput): string {
  const parts = [`para=${input.to.join(', ')}`]
  if (input.cc?.length) parts.push(`cc=${input.cc.join(', ')}`)
  if (input.bcc?.length) parts.push(`cco=${input.bcc.join(', ')}`)
  return `${parts.join(' ')} assunto="${input.subject}"`
}

export function emailMode(): 'dry-run' | 'test-inbox' | 'live' {
  if (!process.env.RESEND_API_KEY) return 'dry-run'
  if (process.env.EMAIL_TEST_INBOX) return 'test-inbox'
  return 'live'
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (input.to.length === 0) {
    return { status: 'failed', error: 'Nenhum destinatário informado' }
  }

  const mode = emailMode()

  if (mode === 'dry-run') {
    console.info(`[email:modo-seco] ${describe(input)}\n${input.text}`)
    return { status: 'skipped', reason: 'RESEND_API_KEY não configurada' }
  }

  const testInbox = process.env.EMAIL_TEST_INBOX
  const redirected = mode === 'test-inbox'

  // No modo teste tudo vai para uma caixa só, e o assunto carrega os
  // destinatários reais para dar para conferir o que teria sido enviado.
  const payload = {
    from: fromAddress(),
    to: redirected ? [testInbox!] : input.to,
    cc: redirected ? undefined : input.cc,
    bcc: redirected ? undefined : input.bcc,
    subject: redirected ? `[teste → ${input.to.join(', ')}] ${input.subject}` : input.subject,
    text: input.text,
    reply_to: input.replyTo,
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text()
      return { status: 'failed', error: `Resend ${response.status}: ${body.slice(0, 300)}` }
    }

    const data = (await response.json()) as { id?: string }
    return {
      status: 'sent',
      id: data.id ?? 'sem-id',
      ...(redirected ? { redirectedTo: testInbox } : {}),
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Falha desconhecida no envio',
    }
  }
}
