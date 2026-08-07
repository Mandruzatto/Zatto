import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TenantsManager, type PendingInvite } from '@/components/analyst/tenants-manager'

export default async function TenantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: me } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user!.id)
    .single()

  // Página do fornecedor, não do cliente. O RLS já esconderia os dados,
  // mas não faz sentido nem mostrar a tela.
  if (!me?.is_platform_admin) notFound()

  const [{ data: tenants }, { data: profiles }, { data: invites }] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, is_active, created_at').order('created_at'),
    supabase.from('profiles').select('tenant_id'),
    supabase
      .from('invitations')
      .select('id, tenant_id, email, role, grants_tenant_admin, expires_at')
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ])

  const peopleByTenant = new Map<string, number>()
  profiles?.forEach((p) => peopleByTenant.set(p.tenant_id, (peopleByTenant.get(p.tenant_id) ?? 0) + 1))

  const invitesByTenant = new Map<string, PendingInvite[]>()
  invites?.forEach((invite) => {
    const list = invitesByTenant.get(invite.tenant_id) ?? []
    list.push(invite as PendingInvite)
    invitesByTenant.set(invite.tenant_id, list)
  })

  return (
    <TenantsManager
      tenants={(tenants ?? []).map((tenant) => ({
        ...tenant,
        pessoas: peopleByTenant.get(tenant.id) ?? 0,
        convites: invitesByTenant.get(tenant.id) ?? [],
      }))}
    />
  )
}
