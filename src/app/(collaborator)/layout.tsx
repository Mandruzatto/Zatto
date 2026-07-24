import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CollaboratorSidebar } from '@/components/collaborator/sidebar'

export default async function CollaboratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('can_approve')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-zinc-950">
      <CollaboratorSidebar canApprove={profile?.can_approve ?? false} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
