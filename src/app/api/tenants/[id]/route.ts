import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SLUG_RULE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, ok: false as const, status: 401, error: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_platform_admin) {
    return { supabase, ok: false as const, status: 403, error: 'Apenas o administrador da plataforma gerencia clientes' }
  }
  return { supabase, ok: true as const }
}

/** Renomeia, troca o identificador ou suspende/reativa o cliente. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await requirePlatformAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = (await request.json()) as {
    name?: string
    slug?: string
    isActive?: boolean
  }

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'O nome não pode ficar vazio' }, { status: 400 })
    updates.name = name
  }

  if (body.slug !== undefined) {
    const slug = body.slug.trim().toLowerCase()
    if (!SLUG_RULE.test(slug)) {
      return NextResponse.json(
        { error: 'Identificador inválido: use letras minúsculas, números e hífen' },
        { status: 400 }
      )
    }
    updates.slug = slug
  }

  if (body.isActive !== undefined) updates.is_active = body.isActive

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 })
  }

  const { error, count } = await guard.supabase
    .from('tenants')
    .update(updates, { count: 'exact' })
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { error: error.code === '23505' ? 'Já existe um cliente com esse identificador' : error.message },
      { status: error.code === '23505' ? 409 : 400 }
    )
  }
  if (!count) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

/**
 * Exclui o cliente. As chaves estrangeiras usam "on delete restrict", então o
 * banco recusa se houver gente dentro — só passa para cadastro vazio. Convites
 * pendentes somem junto, porque esses são em cascata.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await requirePlatformAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { count: people } = await guard.supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', id)

  if (people && people > 0) {
    return NextResponse.json(
      {
        error: `Este cliente tem ${people} pessoa(s) e não pode ser excluído. Suspenda o acesso em vez de excluir.`,
      },
      { status: 409 }
    )
  }

  const { error, count } = await guard.supabase
    .from('tenants')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!count) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
