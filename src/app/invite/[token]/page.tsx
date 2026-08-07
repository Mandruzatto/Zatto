import { createClient } from '@/lib/supabase/server'
import { AcceptInviteForm } from '@/components/accept-invite-form'
import { Zap } from 'lucide-react'
import Link from 'next/link'

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // Função aberta: quem chega aqui ainda não tem conta.
  const { data } = await supabase.rpc('invitation_preview', { p_token: token })
  const invite = (data ?? [])[0] as
    | { email: string; tenant_name: string; grants_tenant_admin: boolean }
    | undefined

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
            <Zap className="h-5 w-5 text-zinc-950" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">zaTTo</h1>
        </div>

        {!invite ? (
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-center">
            <p className="text-[15px] font-medium text-zinc-200">Convite inválido ou expirado</p>
            <p className="text-[13px] text-zinc-500">
              O link pode já ter sido usado ou passado da validade. Peça um novo para quem
              te convidou.
            </p>
            <Link href="/login" className="inline-block text-[13px] text-zinc-400 hover:text-zinc-100">
              Ir para o login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5 text-center">
              <p className="text-[15px] text-zinc-200">
                Você foi convidado para o ambiente de{' '}
                <span className="font-semibold">{invite.tenant_name}</span>
              </p>
              {invite.grants_tenant_admin && (
                <p className="mt-1.5 inline-block rounded-md bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400">
                  Conta administradora
                </p>
              )}
            </div>
            <AcceptInviteForm email={invite.email} />
          </>
        )}
      </div>
    </div>
  )
}
