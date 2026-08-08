'use client'

import { AutomationRulesPanel } from '@/components/analyst/automation-rules-panel'
import { AutomationTimingPanel } from '@/components/analyst/automation-timing-panel'
import { TeamQueuesPanel } from '@/components/analyst/team-queues-panel'
import type { AutomationRule, AutomationSettings, Team } from '@/lib/types'

export function AutomationsSettings({
  rules,
  teams,
  members,
  settings,
  analysts,
  people,
  catalog,
}: {
  rules: AutomationRule[]
  teams: Team[]
  members: { team_id: string; profile_id: string }[]
  settings: AutomationSettings | null
  analysts: { id: string; full_name: string }[]
  people: { id: string; full_name: string }[]
  catalog: { id: string; title: string }[]
}) {
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name }))

  return (
    <div className="space-y-5">
      <AutomationRulesPanel
        rules={rules}
        ctx={{ teams: teamOptions, analysts, people, catalog }}
      />
      <TeamQueuesPanel teams={teams} members={members} analysts={analysts} />
      {settings && (
        <AutomationTimingPanel settings={settings} teams={teamOptions} analysts={analysts} />
      )}
    </div>
  )
}
