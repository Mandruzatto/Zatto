'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Ticket,
  Monitor,
  Users,
  Settings,
  Zap,
  ChevronDown,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavUser } from '@/components/nav-user'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  children?: { href: string; label: string }[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/tickets',
    label: 'Chamados',
    icon: Ticket,
    children: [
      { href: '/tickets', label: 'Lista' },
      { href: '/tickets/board', label: 'Quadro' },
    ],
  },
  { href: '/assets', label: 'Inventário', icon: Monitor },
  { href: '/users', label: 'Colaboradores', icon: Users },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

export function AnalystSidebar({
  user,
  isPlatformAdmin = false,
}: {
  user: { fullName: string; email: string }
  isPlatformAdmin?: boolean
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Clientes é tela do fornecedor, não do cliente.
  const items: NavItem[] = isPlatformAdmin
    ? [...navItems, { href: '/tenants', label: 'Clientes', icon: Building2 }]
    : navItems

  function isChildActive(href: string) {
    if (href === '/tickets/board') return pathname === '/tickets/board'
    return pathname.startsWith(href) && pathname !== '/tickets/board'
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-800/80 bg-zinc-950">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100">
          <Zap className="h-3.5 w-3.5 text-zinc-950" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tracking-tight text-zinc-100">zaTTo</span>
          <span className="text-[11px] text-zinc-600 font-medium">analista</span>
        </div>
      </div>

      <nav className="flex-1 px-2.5 pt-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')

          if (!item.children) {
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
          }

          const expanded = !(collapsed[item.href] ?? !active)

          return (
            <div key={item.href}>
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [item.href]: expanded }))}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                  active ? 'text-zinc-50' : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-zinc-300' : 'text-zinc-600')} />
                {item.label}
                <ChevronDown
                  className={cn(
                    'ml-auto h-3.5 w-3.5 text-zinc-600 transition-transform',
                    expanded && 'rotate-180'
                  )}
                />
              </button>
              {expanded && (
                <div className="mt-0.5 ml-[1.4rem] space-y-0.5 border-l border-zinc-800/80 pl-2">
                  {item.children.map((child) => {
                    const childActive = isChildActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'block rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                          childActive
                            ? 'bg-zinc-900 text-zinc-50 font-medium'
                            : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200'
                        )}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Theme and sign out live in the header avatar menu. */}
      <div className="border-t border-zinc-800/80 p-2.5">
        <NavUser fullName={user.fullName} email={user.email} roleLabel="Analista" />
      </div>
    </aside>
  )
}
