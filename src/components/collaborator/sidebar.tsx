'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Ticket,
  Plus,
  Monitor,
  Home,
  BookOpen,
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
  { href: '/my-tickets', label: 'Meus Chamados', icon: Ticket },
  { href: '/my-assets', label: 'Meus Equipamentos', icon: Monitor },
  { href: '/knowledge', label: 'Base de conhecimento', icon: BookOpen },
]

export function CollaboratorSidebar({
  canApprove = false,
  pendingApprovals = 0,
  user,
}: {
  canApprove?: boolean
  pendingApprovals?: number
  user: { fullName: string; email: string }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const items = [
    ...navItems,
    ...(canApprove ? [{ href: '/approvals', label: 'Aprovações', icon: CheckSquare }] : []),
  ]

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

      <div className="px-2.5 pb-1">
        <Link
          href="/new-ticket"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-zinc-300"
        >
          <Plus className="h-4 w-4" />
          Abrir chamado
        </Link>
      </div>

      <nav className="flex-1 px-2.5 pt-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const badge = item.href === '/approvals' ? pendingApprovals : 0
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
              <span className="truncate">{item.label}</span>
              {badge > 0 && (
                <span className="ml-auto rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-400">
                  {badge}
                </span>
              )}
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
