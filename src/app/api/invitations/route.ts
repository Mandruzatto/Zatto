import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailMode, sendEmail } from '@/lib/email'

const INVITE_TTL_DAYS = 7

/** O banco guarda só o hash; o token em claro existe apenas no link enviado. */
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, full_name, is_platform_admin, is_tenant_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_platform_admin && !profile?.is_tenant_admin) {
    return NextResponse.json({ error: 'Sem permissão para convidar' }, { status: 403 })
  }

  const body = (await request.json()) as {
    email?: string
    tenantId?: string
    role?: 'analyst' | 'collaborator'
    grantsTenantAdmin?: boolean
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
  }

  // Admin do cliente só convida para o próprio cliente, independente do que mandar.
  const tenantId = profile.is_platform_admin
    ? body.tenantId || profile.tenant_id
    : profile.tenant_id

  const token = randomBytes(32).toString('base64url')

  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({
      tenant_id: tenantId,
      email,
      role: body.role ?? 'collaborator',
      grants_tenant_admin: body.grantsTenantAdmin ?? false,
      token_hash: hashToken(token),
      invited_by: user.id,
      expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
    })
    .select('id, tenant:tenants!tenant_id(name)')
    .single()

  if (error) {
    const duplicate = error.code === '23505'
    return NextResponse.json(
      { error: duplicate ? 'Já existe um convite pendente para este e-mail' : error.message },
      { status: duplicate ? 409 : 400 }
    )
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const link = `${origin}/invite/${token}`
  const tenantName = (invitation.tenant as unknown as { name: string } | null)?.name ?? 'zaTTo'

  const result = await sendEmail({
    to: [email],
    subject: `Seu acesso ao zaTTo — ${tenantName}`,
    text: [
      `Você foi convidado por ${profile.full_name} para acessar o zaTTo (${tenantName}).`,
      '',
      'Para ativar sua conta, acesse:',
      link,
      '',
      `O link expira em ${INVITE_TTL_DAYS} dias.`,
    ].join('\n'),
  })

  if (result.status === 'failed') {
    // O convite existe; só a entrega falhou. O link volta para reenvio manual.
    return NextResponse.json(
      { warning: `Convite criado, mas o e-mail falhou: ${result.error}`, link },
      { status: 207 }
    )
  }

  return NextResponse.json({
    ok: true,
    mode: emailMode(),
    // Quem criou o convite pode copiar o link — útil no modo seco e para reenvio.
    link,
    redirectedTo: result.status === 'sent' ? result.redirectedTo : undefined,
  })
}
