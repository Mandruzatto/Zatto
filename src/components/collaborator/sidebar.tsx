'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Ticket,
  PlusCircle,
  Monitor,
  Home,
  CheckSquare,
  LogOut,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { NavUser } from '@/components/nav-user'
import { ThemeToggle } from '@/components/theme-toggle'

const navItems = [
  { href: '/portal', label: 'Início', icon: Home },
  { href: '/new-ticket', label: 'Abrir Chamado', icon: PlusCircle },
  { href: '/my-tickets', label: 'Meus Chamados', icon: Ticket },
  { href: '/my-assets', label: 'Meus Equipamentos', icon: Monitor },
]

export function CollaboratorSidebar({
  canApprove = false,
  user,
}: {
  canApprove?: boolean
  user: { fullName: string; email: string }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-800/80 bg-zinc-950">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100">
          <Zap className="h-3.5 w-3.5 text-zinc-950" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tracking-tight text-zinc-100">zaTTo</span>
          <span className="text-[11px] text-zinc-600 font-medium">portal</span>
        </div>
      </div>

      <nav className="flex-1 px-2.5 pt-2 space-y-0.5">
        {[...navItems, ...(canApprove ? [{ href: '/approvals', label: 'Aprovações', icon: CheckSquare }] : [])].map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-zinc-900 text-zinc-50'
                  : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-zinc-300' : 'text-zinc-600')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-zinc-800/80 p-2.5">
        <NavUser fullName={user.fullName} email={user.email} roleLabel="Colaborador" />
        <ThemeToggle />
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
        >
          <LogOut className="h-4 w-4 text-zinc-600" />
          Sair
        </button>
      </div>
    </aside>
  )
}
