import { createClient } from '@/lib/supabase/server'
import { ItsmSettings } from '@/components/analyst/itsm-settings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const [
    { data: policies },
    { data: calendars },
    { data: catalog },
    { data: articles },
    { data: categories },
  ] = await Promise.all([
    supabase.from('sla_policies').select('*, calendar:sla_calendars(name)').order('precedence'),
    supabase.from('sla_calendars').select('*').order('name'),
    supabase.from('service_catalog_items').select('*').order('title'),
    supabase.from('knowledge_articles').select('*, category:knowledge_categories(name)').order('updated_at', { ascending: false }),
    supabase.from('knowledge_categories').select('*').order('name'),
  ])

  return (
    <ItsmSettings
      policies={policies ?? []}
      calendars={calendars ?? []}
      catalog={catalog ?? []}
      articles={articles ?? []}
      categories={categories ?? []}
    />
  )
}
