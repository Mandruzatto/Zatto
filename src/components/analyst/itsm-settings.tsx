'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { TICKET_PRIORITY_LABELS, cn } from '@/lib/utils'
import type { TicketPriority } from '@/lib/types'

type Row = Record<string, unknown>

const emptyPolicy = {
  id: '',
  name: '',
  priority: 'medium',
  first_hours: '4',
  resolution_hours: '24',
  calendar_id: '',
  precedence: '30',
}

export function ItsmSettings({
  policies, calendars, catalog, articles, categories,
}: { policies: Row[]; calendars: Row[]; catalog: Row[]; articles: Row[]; categories: Row[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'catalog' | 'sla' | 'knowledge'>('catalog')
  const [saving, setSaving] = useState(false)
  const [policy, setPolicy] = useState({
    ...emptyPolicy,
    calendar_id: (calendars[0]?.id as string) ?? '',
  })
  const [item, setItem] = useState({ title: '', slug: '', description: '', keywords: '', requires_approval: false })
  const [article, setArticle] = useState({ title: '', slug: '', summary: '', content: '', keywords: '', category_id: '', published: true })

  const editing = Boolean(policy.id)

  function startEdit(row: Row) {
    setPolicy({
      id: row.id as string,
      name: row.name as string,
      priority: (row.priority as string) ?? 'medium',
      first_hours: String(Number(row.first_response_minutes) / 60),
      resolution_hours: String(Number(row.resolution_minutes) / 60),
      calendar_id: (row.calendar_id as string) ?? ((calendars[0]?.id as string) ?? ''),
      precedence: String(row.precedence ?? 30),
    })
  }

  function resetPolicy() {
    setPolicy({
      ...emptyPolicy,
      calendar_id: (calendars[0]?.id as string) ?? '',
    })
  }

  async function savePolicy(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: policy.name,
      calendar_id: policy.calendar_id || calendars[0]?.id,
      priority: policy.priority as TicketPriority,
      first_response_minutes: Math.round(Number(policy.first_hours) * 60),
      resolution_minutes: Math.round(Number(policy.resolution_hours) * 60),
      precedence: Number(policy.precedence) || 30,
    }
    const { error } = editing
      ? await supabase.from('sla_policies').update(payload).eq('id', policy.id)
      : await supabase.from('sla_policies').insert(payload)
    setSaving(false)
    if (error) return toast(editing ? 'Erro ao atualizar política' : 'Erro ao criar política', 'error')
    toast(editing ? 'Política de SLA atualizada' : 'Política de SLA criada')
    resetPolicy()
    router.refresh()
  }

  async function createCatalog(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('service_catalog_items').insert({
      ...item,
      keywords: item.keywords.split(',').map((v) => v.trim()).filter(Boolean),
      is_published: true,
      form_schema: [
        { key: 'details', label: 'Detalhes da solicitação', type: 'textarea', required: true },
      ],
    })
    setSaving(false)
    if (error) return toast('Erro ao criar item do catálogo', 'error')
    toast('Item publicado'); setItem({ title: '', slug: '', description: '', keywords: '', requires_approval: false }); router.refresh()
  }

  async function createArticle(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('knowledge_articles').insert({
      title: article.title, slug: article.slug, summary: article.summary, content: article.content,
      keywords: article.keywords.split(',').map((v) => v.trim()).filter(Boolean),
      category_id: article.category_id || null, author_id: user?.id,
      status: article.published ? 'published' : 'draft',
      published_at: article.published ? new Date().toISOString() : null,
    })
    setSaving(false)
    if (error) return toast('Erro ao criar artigo', 'error')
    toast('Artigo salvo'); setArticle({ title: '', slug: '', summary: '', content: '', keywords: '', category_id: '', published: true }); router.refresh()
  }

  async function toggle(table: string, id: unknown, field: string, value: boolean) {
    const { error } = await supabase.from(table).update({ [field]: value }).eq('id', id as string)
    if (error) return toast('Erro ao atualizar', 'error')
    toast('Configuração atualizada'); router.refresh()
  }

  async function setArticleStatus(id: unknown, status: 'draft' | 'published' | 'archived') {
    const { error } = await supabase.from('knowledge_articles').update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    }).eq('id', id as string)
    if (error) return toast('Erro ao atualizar artigo', 'error')
    toast('Status do artigo atualizado'); router.refresh()
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div><h1 className="text-lg font-semibold text-zinc-100">Configurações</h1><p className="text-[13px] text-zinc-500">Catálogo, SLA e base de conhecimento.</p></div>
      <div className="flex gap-1 border-b border-zinc-800">
        {([['catalog','Catálogo'],['sla','SLAs'],['knowledge','Conhecimento']] as const).map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('px-3 py-2 text-[13px] border-b-2 -mb-px', tab===id?'border-zinc-100 text-zinc-100':'border-transparent text-zinc-500')}>{label}</button>
        ))}
      </div>

      {tab === 'catalog' && <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Novo item do catálogo</CardTitle></CardHeader><CardContent>
          <form onSubmit={createCatalog} className="space-y-3">
            <Input label="Título" value={item.title} onChange={(e)=>setItem({...item,title:e.target.value})} required />
            <Input label="Slug" placeholder="ex: acesso-vpn" value={item.slug} onChange={(e)=>setItem({...item,slug:e.target.value})} required />
            <Textarea label="Descrição" value={item.description} onChange={(e)=>setItem({...item,description:e.target.value})} required />
            <Input label="Palavras-chave" hint="Separadas por vírgula" value={item.keywords} onChange={(e)=>setItem({...item,keywords:e.target.value})} />
            <label className="flex gap-2 text-[13px] text-zinc-300"><input type="checkbox" checked={item.requires_approval} onChange={(e)=>setItem({...item,requires_approval:e.target.checked})}/> Exige aprovação do gestor</label>
            <Button loading={saving} type="submit">Publicar item</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Itens publicados</CardTitle></CardHeader><CardContent className="space-y-2">
          {catalog.map((row)=><div key={row.id as string} className="flex items-center justify-between border-b border-zinc-800/70 py-2.5"><div><p className="text-[13px] text-zinc-200">{row.title as string}</p><p className="text-xs text-zinc-600">{row.slug as string}</p></div><button onClick={()=>toggle('service_catalog_items',row.id,'is_published',!row.is_published)}><Badge className={row.is_published?'bg-emerald-500/10 text-emerald-400':'bg-zinc-800 text-zinc-500'}>{row.is_published?'Publicado':'Oculto'}</Badge></button></div>)}
        </CardContent></Card>
      </div>}

      {tab === 'sla' && <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Editar política' : 'Nova política'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePolicy} className="space-y-3">
              <Input label="Nome" value={policy.name} onChange={(e)=>setPolicy({...policy,name:e.target.value})} required />
              <Select label="Prioridade" options={Object.entries(TICKET_PRIORITY_LABELS).map(([value,label])=>({value,label}))} value={policy.priority} onChange={(e)=>setPolicy({...policy,priority:e.target.value})}/>
              {calendars.length > 0 && (
                <Select
                  label="Calendário"
                  options={calendars.map((c)=>({value:c.id as string,label:c.name as string}))}
                  value={policy.calendar_id}
                  onChange={(e)=>setPolicy({...policy,calendar_id:e.target.value})}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input label="1ª resposta (horas úteis)" type="number" min="0.5" step="0.5" value={policy.first_hours} onChange={(e)=>setPolicy({...policy,first_hours:e.target.value})}/>
                <Input label="Resolução (horas úteis)" type="number" min="1" step="1" value={policy.resolution_hours} onChange={(e)=>setPolicy({...policy,resolution_hours:e.target.value})}/>
              </div>
              <Input label="Precedência" type="number" min="1" value={policy.precedence} onChange={(e)=>setPolicy({...policy,precedence:e.target.value})} hint="Menor número = maior prioridade na seleção automática" />
              <div className="flex gap-2">
                <Button loading={saving} type="submit">{editing ? 'Salvar alterações' : 'Criar política'}</Button>
                {editing && <Button type="button" variant="secondary" onClick={resetPolicy}>Cancelar</Button>}
              </div>
            </form>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Políticas</CardTitle></CardHeader><CardContent className="space-y-2">
          {policies.map((row)=>(
            <div key={row.id as string} className="flex items-center justify-between gap-3 border-b border-zinc-800/70 py-2.5">
              <button type="button" className="min-w-0 text-left" onClick={() => startEdit(row)}>
                <p className="text-[13px] text-zinc-200 hover:text-zinc-50">{row.name as string}</p>
                <p className="text-xs text-zinc-600">
                  {TICKET_PRIORITY_LABELS[row.priority as TicketPriority] ?? String(row.priority)}
                  {' · '}
                  {Number(row.first_response_minutes)/60}h resposta · {Number(row.resolution_minutes)/60}h resolução
                </p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(row)}>Editar</Button>
                <button onClick={()=>toggle('sla_policies',row.id,'is_active',!row.is_active)}>
                  <Badge className={row.is_active?'bg-emerald-500/10 text-emerald-400':'bg-zinc-800 text-zinc-500'}>
                    {row.is_active?'Ativa':'Inativa'}
                  </Badge>
                </button>
              </div>
            </div>
          ))}
        </CardContent></Card>
      </div>}

      {tab === 'knowledge' && <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Novo artigo</CardTitle></CardHeader><CardContent>
          <form onSubmit={createArticle} className="space-y-3">
            <Input label="Título" value={article.title} onChange={(e)=>setArticle({...article,title:e.target.value})} required />
            <Input label="Slug" value={article.slug} onChange={(e)=>setArticle({...article,slug:e.target.value})} required />
            <Input label="Resumo" value={article.summary} onChange={(e)=>setArticle({...article,summary:e.target.value})} required />
            <Select label="Categoria" placeholder="Sem categoria" options={categories.map((c)=>({value:c.id as string,label:c.name as string}))} value={article.category_id} onChange={(e)=>setArticle({...article,category_id:e.target.value})}/>
            <Textarea label="Conteúdo" rows={8} value={article.content} onChange={(e)=>setArticle({...article,content:e.target.value})} required />
            <Input label="Palavras-chave" value={article.keywords} onChange={(e)=>setArticle({...article,keywords:e.target.value})}/>
            <label className="flex gap-2 text-[13px] text-zinc-300"><input type="checkbox" checked={article.published} onChange={(e)=>setArticle({...article,published:e.target.checked})}/> Publicar agora</label>
            <Button loading={saving} type="submit">Salvar artigo</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Artigos</CardTitle></CardHeader><CardContent className="space-y-2">
          {articles.map((row)=><div key={row.id as string} className="border-b border-zinc-800/70 py-2.5"><div className="flex justify-between gap-3"><div><p className="text-[13px] text-zinc-200">{row.title as string}</p><p className="text-xs text-zinc-600">{row.summary as string}</p></div><button onClick={()=>setArticleStatus(row.id,row.status==='published'?'draft':'published')}><Badge className={row.status==='published'?'bg-violet-500/10 text-violet-400':'bg-zinc-800 text-zinc-500'}>{row.status==='published'?'Publicado':'Rascunho'}</Badge></button></div></div>)}
        </CardContent></Card>
      </div>}
    </div>
  )
}
