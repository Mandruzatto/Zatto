'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { KnowledgeArticle } from '@/lib/types'

export function KnowledgeIndex({ articles }: { articles: KnowledgeArticle[] }) {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!term) return articles
    return articles.filter((article) =>
      [article.title, article.summary, ...article.keywords].join(' ').toLowerCase().includes(term)
    )
  }, [articles, term])

  const grouped = filtered.reduce<Record<string, KnowledgeArticle[]>>((acc, article) => {
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
        <div className="relative mt-4 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, resumo ou palavra-chave..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 py-2.5 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>
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

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-[13px] font-medium text-zinc-400">
              {term ? 'Nenhum artigo encontrado' : 'Nenhum artigo publicado'}
            </p>
            <p className="mt-1 text-[13px] text-zinc-600">
              {term
                ? 'Tente outros termos ou limpe a busca.'
                : 'A equipe de TI ainda está montando a base de conhecimento.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
