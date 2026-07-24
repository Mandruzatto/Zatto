import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalystSidebar } from '@/components/analyst/sidebar'

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
    <div className="flex h-screen bg-gray-50">
      <AnalystSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
