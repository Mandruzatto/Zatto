import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CollaboratorSidebar } from '@/components/collaborator/sidebar'
import { SessionTimeout } from '@/components/session-timeout'

export default async function CollaboratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from('profiles')
      .select('can_approve, full_name, email')
      .eq('id', user.id)
      .single(),
    supabase
      .from('ticket_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('approver_id', user.id)
      .eq('decision', 'pending'),
  ])

  const canApprove = (profile?.can_approve ?? false) || (count ?? 0) > 0

  return (
    <div className="flex h-screen bg-zinc-950">
      <SessionTimeout />
      <CollaboratorSidebar
        canApprove={canApprove}
        user={{
          fullName: profile?.full_name || user.email || 'Usuário',
          email: profile?.email || user.email || '',
        }}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
