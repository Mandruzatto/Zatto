import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * Sugere artigo antes de abrir chamado. O casamento é pelas palavras-chave e
 * pelo título do item de catálogo — se a base estiver vazia, nada aparece e o
 * fluxo segue igual.
 */
export async function ArticleSuggestions({
  keywords,
  title,
}: {
  keywords: string[]
  title: string
}) {
  const terms = [...new Set([...keywords, ...title.split(/\s+/)])]
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 3)
    .slice(0, 8)

  if (terms.length === 0) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('knowledge_articles')
    .select('id, title, summary, slug, keywords')
    .eq('status', 'published')
    .limit(50)

  const articles = (data ?? []) as {
    id: string
    title: string
    summary: string | null
    slug: string
    keywords: string[] | null
  }[]

  const scored = articles
    .map((article) => {
      const haystack = [
        article.title,
        article.summary ?? '',
        ...(article.keywords ?? []),
      ]
        .join(' ')
        .toLowerCase()
      const score = terms.filter((term) => haystack.includes(term)).length
      return { article, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (scored.length === 0) return null

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-sky-400" />
        <p className="text-[13px] font-medium text-zinc-200">
          Talvez isto resolva sem abrir chamado
        </p>
      </div>
      <div className="space-y-2">
        {scored.map(({ article }) => (
          <Link
            key={article.id}
            href={`/knowledge/${article.slug}`}
            className="block rounded-lg border border-zinc-800/70 px-3 py-2 transition-colors hover:border-zinc-700 hover:bg-zinc-900/60"
          >
            <p className="text-[13px] font-medium text-zinc-200">{article.title}</p>
            {article.summary && (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-zinc-500">{article.summary}</p>
            )}
          </Link>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-zinc-600">
        Se nenhum resolver, é só continuar e abrir o chamado abaixo.
      </p>
    </div>
  )
}
