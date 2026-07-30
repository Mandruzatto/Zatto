import { createClient } from '@/lib/supabase/server'
import { KnowledgeIndex } from '@/components/collaborator/knowledge-index'
import type { KnowledgeArticle } from '@/lib/types'

export default async function KnowledgeIndexPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('knowledge_articles')
    .select('*, category:knowledge_categories(*)')
    .eq('status', 'published')
    .order('view_count', { ascending: false })

  return <KnowledgeIndex articles={(data ?? []) as unknown as KnowledgeArticle[]} />
}
