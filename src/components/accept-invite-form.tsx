'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const MIN_PASSWORD = 8

export function AcceptInviteForm({ email }: { email: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return setError('Informe seu nome.')
    if (password.length < MIN_PASSWORD) {
      return setError(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`)
    }
    if (password !== confirmation) return setError('As senhas não conferem.')

    setLoading(true)
    setError('')

    // O cliente, o papel e a permissão de administrador vêm do convite pendente,
    // lido pelo trigger de cadastro a partir deste mesmo e-mail.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    })

    if (signUpError) {
      setLoading(false)
      setError(
        signUpError.message.includes('already registered')
          ? 'Já existe uma conta com este e-mail. Use o login normal.'
          : signUpError.message
      )
      return
    }

    // Sem sessão de volta significa que o projeto exige confirmação por e-mail.
    if (!data.session) {
      setLoading(false)
      setNeedsConfirmation(true)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user!.id)
      .single()

    router.push(profile?.role === 'analyst' ? '/dashboard' : '/portal')
    router.refresh()
  }

  if (needsConfirmation) {
    return (
      <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
        <p className="text-[15px] font-medium text-zinc-100">Conta criada</p>
        <p className="text-[13px] text-zinc-400">
          Enviamos um e-mail de confirmação para <span className="text-zinc-200">{email}</span>.
          Confirme para entrar.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="E-mail" value={email} disabled readOnly />
      <Input
        label="Seu nome"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Nome e sobrenome"
        required
      />
      <Input
        label="Senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={`Mínimo de ${MIN_PASSWORD} caracteres`}
        required
      />
      <Input
        label="Confirme a senha"
        type="password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        required
      />

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
          {error}
        </p>
      )}

      <Button type="submit" loading={loading} className="w-full">
        Ativar conta
      </Button>
    </form>
  )
}
