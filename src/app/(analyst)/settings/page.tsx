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
    { data: rules },
    { data: teams },
    { data: members },
    { data: automationSettings },
    { data: people },
  ] = await Promise.all([
    supabase.from('sla_policies').select('*, calendar:sla_calendars(name)').order('precedence'),
    supabase.from('sla_calendars').select('*').order('name'),
    supabase.from('service_catalog_items').select('*').order('title'),
    supabase.from('knowledge_articles').select('*, category:knowledge_categories(name)').order('updated_at', { ascending: false }),
    supabase.from('knowledge_categories').select('*').order('name'),
    supabase.from('automation_rules').select('*').order('position'),
    supabase.from('teams').select('*').order('position'),
    supabase.from('team_members').select('team_id, profile_id'),
    // Uma linha por cliente; maybeSingle porque cliente antigo pode não ter.
    supabase.from('tenant_automation_settings').select('*').maybeSingle(),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
  ])

  const everyone = people ?? []

  return (
    <ItsmSettings
      policies={policies ?? []}
      calendars={calendars ?? []}
      catalog={catalog ?? []}
      articles={articles ?? []}
      categories={categories ?? []}
      automations={{
        rules: rules ?? [],
        teams: teams ?? [],
        members: members ?? [],
        settings: automationSettings ?? null,
        analysts: everyone.filter((p) => p.role === 'analyst'),
        people: everyone,
        catalog: (catalog ?? []).map((c) => ({ id: c.id as string, title: c.title as string })),
      }}
    />
  )
}
