'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, FileText, BookOpen, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS, formatDate } from '@/lib/utils'
import type { KnowledgeArticle, ServiceCatalogItem, Ticket } from '@/lib/types'

export function PortalHome({
  catalog,
  articles,
  tickets,
  name,
}: {
  catalog: ServiceCatalogItem[]
  articles: KnowledgeArticle[]
  tickets: Ticket[]
  name: string
}) {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (term.length < 2) return { catalog: [], articles: [] }
    return {
      catalog: catalog.filter((item) =>
        [item.title, item.description, ...item.keywords].join(' ').toLowerCase().includes(term)
      ),
      articles: articles.filter((article) =>
        [article.title, article.summary, article.content, ...article.keywords].join(' ').toLowerCase().includes(term)
      ),
    }
  }, [term, catalog, articles])

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-10 space-y-9">
      <div className="pt-4 text-center">
        <p className="text-sm text-zinc-500">Olá, {name.split(' ')[0]}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">Como podemos ajudar?</h1>
        <div className="relative mx-auto mt-6 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-zinc-600" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquise um acesso, problema ou dúvida..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-3.5 pl-12 pr-4 text-sm text-zinc-100 shadow-xl shadow-black/20 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>
      </div>

      {term.length < 2 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">Solicitações comuns</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.slice(0, 6).map((item) => (
              <Link key={item.id} href={`/new-ticket?catalog=${item.slug}`}>
                <Card className="h-full hover:border-zinc-700 transition-colors">
                  <CardContent className="flex items-start gap-3 py-3.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {term.length >= 2 && (
        <div className="space-y-5">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">Solicitações</p>
            <div className="grid gap-2">
              {results.catalog.map((item) => (
                <Link key={item.id} href={`/new-ticket?catalog=${item.slug}`}>
                  <Card className="hover:border-zinc-700 transition-colors">
                    <CardContent className="flex items-center gap-3 py-3.5">
                      <FileText className="h-4 w-4 text-sky-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                        <p className="text-xs text-zinc-500">{item.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-700" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
          </section>
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">Base de conhecimento</p>
            <div className="grid gap-2">
              {results.articles.map((article) => (
                <Link key={article.id} href={`/knowledge/${article.slug}`}>
                  <Card className="hover:border-zinc-700 transition-colors">
                    <CardContent className="flex items-center gap-3 py-3.5">
                      <BookOpen className="h-4 w-4 text-violet-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-200">{article.title}</p>
                        <p className="text-xs text-zinc-500">{article.summary}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-700" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
          {results.catalog.length === 0 && results.articles.length === 0 && (
            <div className="text-center text-sm text-zinc-600">
              Nada encontrado. Tente outros termos ou abra pelo catálogo em{' '}
              <Link href="/new-ticket" className="text-zinc-300 hover:text-white">Abrir chamado</Link>.
            </div>
          )}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Seus tickets em aberto</h2>
          <Link href="/my-tickets" className="text-xs text-zinc-500 hover:text-zinc-200">Ver todos</Link>
        </div>
        <Card className="overflow-hidden">
          {tickets.length ? (
            <div className="divide-y divide-zinc-800/70">
              {tickets.map((ticket) => (
                <Link key={ticket.id} href={`/my-tickets/${ticket.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-zinc-200">{ticket.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-600"><span className="font-mono">{ticket.ticket_number}</span> · {formatDate(ticket.created_at)}</p>
                  </div>
                  <Badge className={TICKET_STATUS_COLORS[ticket.status]}>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <CardContent className="py-8 text-center text-[13px] text-zinc-600">Nenhum ticket aberto.</CardContent>
          )}
        </Card>
      </section>
    </div>
  )
}
