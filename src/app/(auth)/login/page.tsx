'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EXPIRED_FLAG_KEY } from '@/components/session-timeout'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ssoEmail, setSsoEmail] = useState('')
  const [ssoLoading, setSsoLoading] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(EXPIRED_FLAG_KEY)) return
      sessionStorage.removeItem(EXPIRED_FLAG_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpired(true)
    } catch {}
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    router.push(profile?.role === 'analyst' ? '/dashboard' : '/portal')
    router.refresh()
  }

  async function handleSso() {
    const domain = ssoEmail.split('@')[1]?.trim()
    if (!domain) {
      setError('Informe seu e-mail corporativo para continuar com SSO.')
      return
    }
    setError('')
    setSsoLoading(true)
    const { error: ssoError } = await supabase.auth.signInWithSSO({
      domain,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (ssoError) {
      setError('SSO ainda não está configurado para este domínio.')
      setSsoLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 mb-4">
            <Zap className="h-5 w-5 text-zinc-950" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">zaTTo</h1>
          <p className="text-zinc-500 text-[13px] mt-1">Suporte & Inventário</p>
        </div>

        {expired && (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-400">
            Sua sessão expirou por inatividade. Entre novamente.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="text-[13px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Entrar
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-[11px] uppercase tracking-wider text-zinc-700">login corporativo</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>
        <div className="space-y-3">
          <Input
            label="E-mail corporativo"
            type="email"
            placeholder="voce@empresa.com"
            value={ssoEmail}
            onChange={(e) => setSsoEmail(e.target.value)}
          />
          <Button type="button" variant="secondary" className="w-full" loading={ssoLoading} onClick={handleSso}>
            Entrar com SSO
          </Button>
          <p className="text-center text-[11px] text-zinc-700">Disponível após configuração do provedor SAML.</p>
        </div>
      </div>
    </div>
  )
}
