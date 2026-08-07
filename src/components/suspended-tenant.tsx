import { Zap } from 'lucide-react'

/**
 * Suspender precisa barrar o acesso, senão é só um rótulo na tela do fornecedor.
 * A sessão continua válida — o que muda é que não há para onde ir.
 */
export function SuspendedTenant({ name }: { name: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="max-w-sm space-y-3 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
          <Zap className="h-5 w-5 text-zinc-950" />
        </div>
        <h1 className="text-[15px] font-semibold text-zinc-100">Acesso suspenso</h1>
        <p className="text-[13px] text-zinc-500">
          O ambiente de <span className="text-zinc-300">{name}</span> está temporariamente
          suspenso. Fale com o responsável pela contratação para reativar.
        </p>
      </div>
    </div>
  )
}
