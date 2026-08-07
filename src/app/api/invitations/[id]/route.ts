import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailMode, sendEmail } from '@/lib/email'
import { INVITE_TTL_DAYS, hashToken } from '@/lib/invitations'

/** Cancela um convite pendente. O RLS já limita ao que quem chamou pode gerir. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { error, count } = await supabase
    .from('invitations')
    .delete({ count: 'exact' })
    .eq('id', id)
    .is('accepted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!count) {
    return NextResponse.json(
      { error: 'Convite não encontrado, já aceito ou fora do seu alcance' },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true })
}

/**
 * Reenvia o convite. O token em claro não existe em lugar nenhum — o banco guarda
 * só o hash — então reenviar significa gerar um link novo. O anterior deixa de
 * funcionar na hora, o que também serve para revogar um link que vazou.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data: invite } = await supabase
    .from('invitations')
    .select('id, email, tenant:tenants!tenant_id(name)')
    .eq('id', id)
    .is('accepted_at', null)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json(
      { error: 'Convite não encontrado, já aceito ou fora do seu alcance' },
      { status: 404 }
    )
  }

  const token = randomBytes(32).toString('base64url')
  const { error: updateError } = await supabase
    .from('invitations')
    .update({
      token_hash: hashToken(token),
      invited_by: user.id,
      expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const link = `${origin}/invite/${token}`
  const tenantName = (invite.tenant as unknown as { name: string } | null)?.name ?? 'zaTTo'

  const result = await sendEmail({
    to: [invite.email],
    subject: `Seu acesso ao zaTTo — ${tenantName}`,
    text: [
      `Você foi convidado por ${profile?.full_name ?? 'a equipe'} para acessar o zaTTo (${tenantName}).`,
      '',
      'Para ativar sua conta, acesse:',
      link,
      '',
      `O link expira em ${INVITE_TTL_DAYS} dias. Links enviados antes deste deixaram de valer.`,
    ].join('\n'),
  })

  if (result.status === 'failed') {
    return NextResponse.json(
      { warning: `Link renovado, mas o e-mail falhou: ${result.error}`, link },
      { status: 207 }
    )
  }

  return NextResponse.json({
    ok: true,
    mode: emailMode(),
    link,
    redirectedTo: result.status === 'sent' ? result.redirectedTo : undefined,
  })
}
