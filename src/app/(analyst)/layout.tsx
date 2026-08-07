import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalystSidebar } from '@/components/analyst/sidebar'
import { GlobalSearch } from '@/components/analyst/global-search'
import { HeaderStats } from '@/components/analyst/header-stats'
import { NotificationsBell } from '@/components/notifications-bell'
import { UserMenu } from '@/components/analyst/user-menu'
import { SessionTimeout } from '@/components/session-timeout'

export default async function AnalystLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'analyst') redirect('/my-tickets')

  return (
    <div className="flex h-screen bg-zinc-950">
      <SessionTimeout />
      <AnalystSidebar
        isPlatformAdmin={Boolean(profile.is_platform_admin)}
        user={{
          fullName: profile.full_name || user.email || 'Analista',
          email: profile.email || user.email || '',
        }}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-zinc-800/80 px-6 py-2.5">
          <GlobalSearch />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <HeaderStats userId={user.id} />
            <NotificationsBell userId={user.id} mode="analyst" />
            <Link
              href="/tickets/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-zinc-300"
            >
              <Plus className="h-4 w-4" />
              Novo chamado
            </Link>
            <UserMenu
              fullName={profile.full_name || user.email || 'Analista'}
              email={profile.email || user.email || ''}
            />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
