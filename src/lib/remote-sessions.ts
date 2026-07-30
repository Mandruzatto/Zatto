import type { RemoteSessionStatus } from '@/lib/types'

export const ACTIVE_REMOTE_STATUSES: RemoteSessionStatus[] = [
  'proposed',
  'confirmed',
  'ready',
  'in_progress',
]

export function dayBounds(now = new Date()) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export type RemoteSessionSignal = {
  ticket_id: string
  status: RemoteSessionStatus
  scheduled_for: string
}

export function pickRemoteSignal(sessions: RemoteSessionSignal[]): RemoteSessionSignal | null {
  const priority: RemoteSessionStatus[] = ['in_progress', 'ready', 'confirmed', 'proposed']
  for (const status of priority) {
    const match = sessions.find((session) => session.status === status)
    if (match) return match
  }
  return null
}
