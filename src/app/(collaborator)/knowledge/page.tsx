import Link from 'next/link'
import { BookOpen, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import type { KnowledgeArticle } from '@/lib/types'

export default async function KnowledgeIndexPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('knowledge_articles')
    .select('*, category:knowledge_categories(*)')
    .eq('status', 'published')
    .order('view_count', { ascending: false })

  const articles = (data ?? []) as unknown as KnowledgeArticle[]

  const grouped = articles.reduce<Record<string, KnowledgeArticle[]>>((acc, article) => {
    const key = article.category?.name ?? 'Geral'
    ;(acc[key] ??= []).push(article)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Base de conhecimento</h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          {articles.length} artigos para resolver dúvidas sem precisar abrir chamado
        </p>
      </div>

      {Object.entries(grouped).map(([category, list]) => (
        <section key={category}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">{category}</p>
          <div className="grid gap-2">
            {list.map((article) => (
              <Link key={article.id} href={`/knowledge/${article.slug}`}>
                <Card className="transition-colors hover:border-zinc-700">
                  <CardContent className="flex items-center gap-3 py-3.5">
                    <BookOpen className="h-4 w-4 shrink-0 text-violet-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200">{article.title}</p>
                      <p className="truncate text-xs text-zinc-500">{article.summary}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-700" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {articles.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-[13px] font-medium text-zinc-400">Nenhum artigo publicado</p>
            <p className="mt-1 text-[13px] text-zinc-600">
              A equipe de TI ainda está montando a base de conhecimento.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
