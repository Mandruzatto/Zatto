'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toast'

export function KnowledgeFeedback({ articleId }: { articleId: string }) {
  const supabase = createClient()
  const [sent, setSent] = useState(false)

  async function vote(helpful: boolean) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('knowledge_article_feedback').upsert({
      article_id: articleId,
      user_id: user.id,
      helpful,
      created_at: new Date().toISOString(),
    })
    if (error) return toast('Não foi possível enviar sua avaliação', 'error')
    setSent(true)
    toast('Obrigado pela avaliação')
  }

  return (
    <div className="mt-6 text-center text-[13px] text-zinc-500">
      {sent ? 'Obrigado! Seu feedback foi registrado.' : (
        <>Este artigo ajudou?{' '}
          <button onClick={() => vote(true)} className="ml-2 text-zinc-300 hover:text-zinc-50">Sim</button>
          <span className="mx-2 text-zinc-800">·</span>
          <button onClick={() => vote(false)} className="text-zinc-300 hover:text-zinc-50">Não</button>
        </>
      )}
    </div>
  )
}
