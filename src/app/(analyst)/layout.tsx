import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalystSidebar } from '@/components/analyst/sidebar'
import { GlobalSearch } from '@/components/analyst/global-search'

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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'analyst') redirect('/my-tickets')

  return (
    <div className="flex h-screen bg-zinc-950">
      <AnalystSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center border-b border-zinc-800/80 px-6 py-2.5">
          <GlobalSearch />
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
