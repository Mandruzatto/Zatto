import { createClient } from '@/lib/supabase/server'
import { CatalogTicketForm } from '@/components/collaborator/catalog-ticket-form'
import type { ServiceCatalogItem } from '@/lib/types'

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>
}) {
  const supabase = await createClient()
  const { catalog: slug } = await searchParams
  let item: ServiceCatalogItem | null = null

  if (slug) {
    const { data } = await supabase
      .from('service_catalog_items')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()
    item = data as ServiceCatalogItem | null
  }

  return <CatalogTicketForm item={item} />
}
