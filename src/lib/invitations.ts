import { createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

export const INVITE_TTL_DAYS = 7

/** O banco guarda só o hash; o token em claro existe apenas no link enviado. */
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export type CreateInvitationInput = {
  supabase: SupabaseClient
  tenantId: string
  tenantName: string
  email: string
  role: 'analyst' | 'collaborator'
  grantsTenantAdmin: boolean
  invitedBy: string
  invitedByName: string
  origin: string
}

export type CreateInvitationResult =
  | { ok: true; link: string; emailStatus: 'sent' | 'skipped'; redirectedTo?: string }
  | { ok: false; error: string; duplicate?: boolean; link?: string }

export async function createInvitation(
  input: CreateInvitationInput
): Promise<CreateInvitationResult> {
  const token = randomBytes(32).toString('base64url')

  const { error } = await input.supabase.from('invitations').insert({
    tenant_id: input.tenantId,
    email: input.email,
    role: input.role,
    grants_tenant_admin: input.grantsTenantAdmin,
    token_hash: hashToken(token),
    invited_by: input.invitedBy,
    expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
  })

  if (error) {
    return {
      ok: false,
      error: error.code === '23505'
        ? 'Já existe um convite pendente para este e-mail'
        : error.message,
      duplicate: error.code === '23505',
    }
  }

  const link = `${input.origin}/invite/${token}`

  const result = await sendEmail({
    to: [input.email],
    subject: `Seu acesso ao zaTTo — ${input.tenantName}`,
    text: [
      `Você foi convidado por ${input.invitedByName} para acessar o zaTTo (${input.tenantName}).`,
      '',
      'Para ativar sua conta, acesse:',
      link,
      '',
      `O link expira em ${INVITE_TTL_DAYS} dias.`,
    ].join('\n'),
  })

  if (result.status === 'failed') {
    // O convite existe; só a entrega falhou. O link volta para reenvio manual.
    return { ok: false, error: `Convite criado, mas o e-mail falhou: ${result.error}`, link }
  }

  return {
    ok: true,
    link,
    emailStatus: result.status,
    redirectedTo: result.status === 'sent' ? result.redirectedTo : undefined,
  }
}
