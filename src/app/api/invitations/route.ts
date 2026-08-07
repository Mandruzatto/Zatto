import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailMode } from '@/lib/email'
import { createInvitation } from '@/lib/invitations'

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

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  const result = await createInvitation({
    supabase,
    tenantId,
    tenantName: tenant?.name ?? 'zaTTo',
    email,
    role: body.role ?? 'collaborator',
    grantsTenantAdmin: body.grantsTenantAdmin ?? false,
    invitedBy: user.id,
    invitedByName: profile.full_name,
    origin: process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, link: result.link },
      { status: result.duplicate ? 409 : result.link ? 207 : 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    mode: emailMode(),
    // Quem criou o convite pode copiar o link — útil no modo seco e para reenvio.
    link: result.link,
    redirectedTo: result.redirectedTo,
  })
}
