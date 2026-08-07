import { createClient } from '@/lib/supabase/server'
import { CatalogTicketForm } from '@/components/collaborator/catalog-ticket-form'
import { CatalogPicker } from '@/components/collaborator/catalog-picker'
import { ArticleSuggestions } from '@/components/collaborator/article-suggestions'
import type { ServiceCatalogItem } from '@/lib/types'

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>
}) {
  const supabase = await createClient()
  const { catalog: slug } = await searchParams

  const { data: catalog } = await supabase
    .from('service_catalog_items')
    .select('*')
    .eq('is_published', true)
    .order('title')

  const items = (catalog ?? []) as ServiceCatalogItem[]

  if (!slug) {
    return <CatalogPicker items={items} />
  }

  const item = items.find((row) => row.slug === slug) ?? null
  if (!item) {
    return <CatalogPicker items={items} />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      {/* Deflection: se houver artigo que resolva, ele aparece antes do formulário. */}
      <ArticleSuggestions keywords={item.keywords ?? []} title={item.title} />
      <CatalogTicketForm item={item} />
    </div>
  )
}
