import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { KnowledgeFeedback } from '@/components/collaborator/knowledge-feedback'
import { ArrowLeft } from 'lucide-react'

export default async function KnowledgeArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient()
  const { slug } = await params
  const { data: article } = await supabase
    .from('knowledge_articles')
    .select('*, category:knowledge_categories(name)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  if (!article) notFound()

  return (
    <article className="mx-auto max-w-3xl p-6 lg:p-10">
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-violet-400">
        {(article.category as unknown as { name: string } | null)?.name ?? 'Base de conhecimento'}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{article.title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{article.summary}</p>
      <Card className="mt-7"><CardContent className="py-6">
        <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">{article.content}</div>
      </CardContent></Card>
      <KnowledgeFeedback articleId={article.id} />
    </article>
  )
}
