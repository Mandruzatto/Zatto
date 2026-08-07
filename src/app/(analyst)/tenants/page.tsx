import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TenantsManager } from '@/components/analyst/tenants-manager'

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
    supabase.from('tenants').select('id, name, slug, created_at').order('created_at'),
    supabase.from('profiles').select('tenant_id'),
    supabase.from('invitations').select('tenant_id').is('accepted_at', null),
  ])

  const peopleByTenant = new Map<string, number>()
  profiles?.forEach((p) => peopleByTenant.set(p.tenant_id, (peopleByTenant.get(p.tenant_id) ?? 0) + 1))

  const invitesByTenant = new Map<string, number>()
  invites?.forEach((i) => invitesByTenant.set(i.tenant_id, (invitesByTenant.get(i.tenant_id) ?? 0) + 1))

  return (
    <TenantsManager
      tenants={(tenants ?? []).map((tenant) => ({
        ...tenant,
        pessoas: peopleByTenant.get(tenant.id) ?? 0,
        convites_pendentes: invitesByTenant.get(tenant.id) ?? 0,
      }))}
    />
  )
}
