'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { ArrowLeft } from 'lucide-react'

export default function NewUserPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    job_title: '',
    department: '',
    password: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: rpcError } = await supabase.rpc('create_collaborator', {
      p_email: form.email,
      p_password: form.password,
      p_full_name: form.full_name,
      p_job_title: form.job_title || null,
      p_department: form.department || null,
    })

    setLoading(false)
    if (rpcError) {
      setError(rpcError.message)
      toast('Erro ao criar colaborador', 'error')
      return
    }
    toast(`Colaborador ${form.full_name} criado`)
    router.push('/users')
    router.refresh()
  }

  return (
    <div className="p-6 space-y-5 max-w-xl">
      <Link href="/users" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Colaboradores
      </Link>

      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Novo Colaborador</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">
          O colaborador poderá acessar o portal com o e-mail e a senha inicial definidos aqui.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome completo"
              placeholder="Ex: Maria Souza"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
            <Input
              label="E-mail"
              type="email"
              placeholder="maria@empresa.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cargo"
                placeholder="Ex: Analista Financeiro"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              />
              <Input
                label="Departamento"
                placeholder="Ex: Financeiro"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <Input
              label="Senha inicial"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              hint="Compartilhe com o colaborador; ele pode alterá-la depois."
            />

            {error && (
              <p className="text-[13px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={loading}>
                Criar Colaborador
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
