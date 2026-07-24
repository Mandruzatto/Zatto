import { createClient } from '@/lib/supabase/server'
import { PortalHome } from '@/components/collaborator/portal-home'
import type { KnowledgeArticle, ServiceCatalogItem, Ticket } from '@/lib/types'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: catalog }, { data: articles }, { data: tickets }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user!.id).single(),
    supabase.from('service_catalog_items').select('*').eq('is_published', true).order('title'),
    supabase.from('knowledge_articles').select('*, category:knowledge_categories(*)').eq('status', 'published').order('title'),
    supabase
      .from('tickets')
      .select('*')
      .eq('requester_id', user!.id)
      .not('status', 'in', '("resolved","closed")')
      .order('updated_at', { ascending: false })
      .limit(6),
  ])

  return (
    <PortalHome
      name={profile?.full_name ?? 'Colaborador'}
      catalog={(catalog ?? []) as ServiceCatalogItem[]}
      articles={(articles ?? []) as unknown as KnowledgeArticle[]}
      tickets={(tickets ?? []) as Ticket[]}
    />
  )
}
