'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  FileText,
  BookOpen,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  KeyRound,
  Laptop,
  Package,
  Wifi,
  Sparkles,
  Monitor,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TICKET_STATUS_COLORS, TICKET_STATUS_LABELS, formatDate, cn } from '@/lib/utils'
import type { Asset, KnowledgeArticle, ServiceCatalogItem, Ticket } from '@/lib/types'

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Acessos e contas': KeyRound,
  Equipamentos: Laptop,
  Software: Package,
  'Rede e infraestrutura': Wifi,
  Outros: Sparkles,
}

export function PortalHome({
  catalog,
  articles,
  tickets,
  waitingOnMe,
  resolvedCount,
  pendingApprovals,
  assets,
  name,
}: {
  catalog: ServiceCatalogItem[]
  articles: KnowledgeArticle[]
  tickets: Ticket[]
  waitingOnMe: Ticket[]
  resolvedCount: number
  pendingApprovals: number
  assets: Asset[]
  name: string
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const term = query.trim().toLowerCase()

  const categories = useMemo(() => {
    const names = new Set(catalog.map((item) => item.category || 'Outros'))
    return Array.from(names).sort()
  }, [catalog])

  const results = useMemo(() => {
    if (term.length < 2) return { catalog: [], articles: [], tickets: [] }
    return {
      catalog: catalog.filter((item) =>
        [item.title, item.description, ...item.keywords].join(' ').toLowerCase().includes(term)
      ),
      articles: articles.filter((article) =>
        [article.title, article.summary, article.content, ...article.keywords].join(' ').toLowerCase().includes(term)
      ),
      tickets: tickets.filter((ticket) =>
        [ticket.title, ticket.ticket_number].join(' ').toLowerCase().includes(term)
      ),
    }
  }, [term, catalog, articles, tickets])

  const visibleCatalog = category
    ? catalog.filter((item) => (item.category || 'Outros') === category)
    : catalog

  const awaitingApproval = tickets.filter((ticket) => ticket.status === 'awaiting_approval').length
  const searching = term.length >= 2

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-10">
      <div className="pt-2 text-center">
        <p className="text-sm text-zinc-500">Olá, {name.split(' ')[0]}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">Como podemos ajudar?</h1>
        <div className="relative mx-auto mt-6 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-zinc-600" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquise um acesso, problema, artigo ou o número do seu chamado..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-3.5 pl-12 pr-4 text-sm text-zinc-100 shadow-xl shadow-zinc-950/40 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>
      </div>

      {searching ? (
        <SearchResults results={results} />
      ) : (
        <>
          {(waitingOnMe.length > 0 || pendingApprovals > 0) && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-500/80">
                Precisa da sua atenção
              </p>
              <div className="space-y-2">
                {pendingApprovals > 0 && (
                  <Link href="/approvals">
                    <Card className="border-cyan-500/25 bg-cyan-500/5 transition-colors hover:border-cyan-500/50">
                      <CardContent className="flex items-center gap-3 py-3.5">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-400" />
                        <p className="flex-1 text-[13px] text-cyan-200">
                          {pendingApprovals === 1
                            ? '1 solicitação aguarda a sua aprovação'
                            : `${pendingApprovals} solicitações aguardam a sua aprovação`}
                        </p>
                        <ArrowRight className="h-4 w-4 shrink-0 text-cyan-400/60" />
                      </CardContent>
                    </Card>
                  </Link>
                )}
                {waitingOnMe.map((ticket) => (
                  <Link key={ticket.id} href={`/my-tickets/${ticket.id}`}>
                    <Card className="border-amber-500/25 bg-amber-500/5 transition-colors hover:border-amber-500/50">
                      <CardContent className="flex items-center gap-3 py-3.5">
                        <MessageSquare className="h-4 w-4 shrink-0 text-amber-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-amber-100">{ticket.title}</p>
                          <p className="mt-0.5 text-xs text-amber-500/70">
                            <span className="font-mono">{ticket.ticket_number}</span> · o suporte respondeu e aguarda você
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-amber-400/60" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-2 sm:grid-cols-3">
            <SummaryTile label="Chamados em andamento" value={tickets.length} href="/my-tickets" />
            <SummaryTile label="Aguardando aprovação" value={awaitingApproval} href="/my-tickets" />
            <SummaryTile label="Finalizados em 30 dias" value={resolvedCount} href="/my-tickets" />
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <p className="mr-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Abrir chamado
              </p>
              <CategoryChip label="Tudo" active={category === null} onClick={() => setCategory(null)} />
              {categories.map((name) => (
                <CategoryChip
                  key={name}
                  label={name}
                  active={category === name}
                  onClick={() => setCategory(name)}
                />
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleCatalog.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] ?? FileText
                return (
                  <Link key={item.id} href={`/new-ticket?catalog=${item.slug}`}>
                    <Card className="h-full transition-colors hover:border-zinc-700">
                      <CardContent className="flex items-start gap-3 py-3.5">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                            {item.requires_approval && (
                              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{item.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Seus chamados em aberto</h2>
                <Link href="/my-tickets" className="text-xs text-zinc-500 hover:text-zinc-200">Ver todos</Link>
              </div>
              <Card className="overflow-hidden">
                {tickets.length ? (
                  <div className="divide-y divide-zinc-800/70">
                    {tickets.slice(0, 5).map((ticket) => (
                      <Link
                        key={ticket.id}
                        href={`/my-tickets/${ticket.id}`}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-zinc-200">{ticket.title}</p>
                          <p className="mt-0.5 text-xs text-zinc-600">
                            <span className="font-mono">{ticket.ticket_number}</span> · {formatDate(ticket.created_at)}
                          </p>
                        </div>
                        <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                          {TICKET_STATUS_LABELS[ticket.status]}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <CardContent className="py-8 text-center text-[13px] text-zinc-600">
                    Nenhum chamado aberto.
                  </CardContent>
                )}
              </Card>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Seus equipamentos</h2>
                <Link href="/my-assets" className="text-xs text-zinc-500 hover:text-zinc-200">Ver todos</Link>
              </div>
              <Card className="overflow-hidden">
                {assets.length ? (
                  <div className="divide-y divide-zinc-800/70">
                    {assets.map((asset) => (
                      <div key={asset.id} className="flex items-center gap-3 px-4 py-3.5">
                        <Monitor className="h-4 w-4 shrink-0 text-zinc-600" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-zinc-200">{asset.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-zinc-600">{asset.asset_tag}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <CardContent className="py-8 text-center text-[13px] text-zinc-600">
                    Nenhum equipamento atribuído.
                  </CardContent>
                )}
              </Card>
            </section>
          </div>

          {articles.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">Artigos em destaque</h2>
                <Link href="/knowledge" className="text-xs text-zinc-500 hover:text-zinc-200">Ver base completa</Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {articles.slice(0, 4).map((article) => (
                  <Link key={article.id} href={`/knowledge/${article.slug}`}>
                    <Card className="h-full transition-colors hover:border-zinc-700">
                      <CardContent className="flex items-start gap-3 py-3.5">
                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-200">{article.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{article.summary}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SummaryTile({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-zinc-700">
        <CardContent className="py-3.5">
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-100">{value}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
        active
          ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
          : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
      )}
    >
      {label}
    </button>
  )
}

function SearchResults({
  results,
}: {
  results: { catalog: ServiceCatalogItem[]; articles: KnowledgeArticle[]; tickets: Ticket[] }
}) {
  const empty =
    results.catalog.length === 0 && results.articles.length === 0 && results.tickets.length === 0

  return (
    <div className="space-y-5">
      {results.tickets.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">Seus chamados</p>
          <div className="grid gap-2">
            {results.tickets.map((ticket) => (
              <Link key={ticket.id} href={`/my-tickets/${ticket.id}`}>
                <Card className="transition-colors hover:border-zinc-700">
                  <CardContent className="flex items-center gap-3 py-3.5">
                    <span className="font-mono text-xs text-zinc-600">{ticket.ticket_number}</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{ticket.title}</p>
                    <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.catalog.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">Solicitações</p>
          <div className="grid gap-2">
            {results.catalog.map((item) => (
              <Link key={item.id} href={`/new-ticket?catalog=${item.slug}`}>
                <Card className="transition-colors hover:border-zinc-700">
                  <CardContent className="flex items-center gap-3 py-3.5">
                    <FileText className="h-4 w-4 shrink-0 text-sky-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                      <p className="truncate text-xs text-zinc-500">{item.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-zinc-700" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.articles.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">Base de conhecimento</p>
          <div className="grid gap-2">
            {results.articles.map((article) => (
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
      )}

      {empty && (
        <div className="text-center text-sm text-zinc-600">
          Nada encontrado. Tente outros termos ou veja o catálogo completo em{' '}
          <Link href="/new-ticket" className="text-zinc-300 hover:text-zinc-50">Abrir chamado</Link>.
        </div>
      )}
    </div>
  )
}
