import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailMode } from '@/lib/email'
import { createInvitation } from '@/lib/invitations'

const SLUG_RULE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_platform_admin) {
    return NextResponse.json({ error: 'Apenas o administrador da plataforma cria clientes' }, { status: 403 })
  }

  const body = (await request.json()) as {
    name?: string
    slug?: string
    focalPointEmail?: string
  }

  const name = body.name?.trim()
  const slug = body.slug?.trim().toLowerCase()
  const focalPointEmail = body.focalPointEmail?.trim().toLowerCase()

  if (!name) {
    return NextResponse.json({ error: 'Informe o nome da empresa' }, { status: 400 })
  }
  if (!slug || !SLUG_RULE.test(slug)) {
    return NextResponse.json(
      { error: 'Identificador inválido: use letras minúsculas, números e hífen' },
      { status: 400 }
    )
  }
  if (!focalPointEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(focalPointEmail)) {
    return NextResponse.json({ error: 'E-mail do ponto focal inválido' }, { status: 400 })
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({ name, slug })
    .select('id, name')
    .single()

  if (error) {
    return NextResponse.json(
      {
        error: error.code === '23505'
          ? 'Já existe um cliente com esse identificador'
          : error.message,
      },
      { status: error.code === '23505' ? 409 : 400 }
    )
  }

  // O ponto focal nasce como analista e conta administradora daquele cliente:
  // é quem vai convidar o resto do time.
  const invitation = await createInvitation({
    supabase,
    tenantId: tenant.id,
    tenantName: tenant.name,
    email: focalPointEmail,
    role: 'analyst',
    grantsTenantAdmin: true,
    invitedBy: user.id,
    invitedByName: profile.full_name,
    origin: process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin,
  })

  if (!invitation.ok) {
    // O cliente foi criado; só o convite falhou. Melhor avisar do que desfazer,
    // porque o convite pode ser reenviado pela tela de colaboradores.
    return NextResponse.json(
      { warning: `Cliente criado, mas o convite falhou: ${invitation.error}`, link: invitation.link },
      { status: 207 }
    )
  }

  return NextResponse.json({
    ok: true,
    mode: emailMode(),
    tenant: { id: tenant.id, name: tenant.name },
    link: invitation.link,
    redirectedTo: invitation.redirectedTo,
  })
}
