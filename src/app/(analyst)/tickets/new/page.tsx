import { createClient } from '@/lib/supabase/server'
import { AnalystNewTicketForm } from '@/components/analyst/new-ticket-form'
import type { ServiceCatalogItem } from '@/lib/types'

export default async function AnalystNewTicketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: requesters }, { data: analysts }, { data: catalog }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role, manager_id')
      .eq('role', 'collaborator')
      .order('full_name'),
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('role', 'analyst')
      .order('full_name'),
    supabase
      .from('service_catalog_items')
      .select('*')
      .eq('is_published', true)
      .order('title'),
  ])

  return (
    <AnalystNewTicketForm
      requesters={requesters ?? []}
      analysts={analysts ?? []}
      catalog={(catalog ?? []) as ServiceCatalogItem[]}
      currentUserId={user!.id}
    />
  )
}
