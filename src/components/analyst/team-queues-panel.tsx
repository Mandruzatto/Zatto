'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { Team } from '@/lib/types'

type Member = { team_id: string; profile_id: string }

const emptyTeam = { id: '', name: '', description: '', position: '100' }

export function TeamQueuesPanel({
  teams,
  members,
  analysts,
}: {
  teams: Team[]
  members: Member[]
  analysts: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState(emptyTeam)
  const [saving, setSaving] = useState(false)
  const [openMembers, setOpenMembers] = useState<string | null>(null)

  const editing = Boolean(form.id)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      position: Number(form.position) || 100,
    }
    const { error } = editing
      ? await supabase.from('teams').update(payload).eq('id', form.id)
      : await supabase.from('teams').insert(payload)
    setSaving(false)

    if (error) {
      return toast(
        error.code === '23505' ? 'Já existe uma fila com esse nome' : 'Erro ao salvar a fila',
        'error'
      )
    }
    toast(editing ? 'Fila atualizada' : 'Fila criada')
    setForm(emptyTeam)
    router.refresh()
  }

  async function remove(team: Team) {
    // Chamado que estava na fila fica sem fila (a FK é "set null"), não some.
    const { error } = await supabase.from('teams').delete().eq('id', team.id)
    if (error) return toast('Erro ao excluir a fila', 'error')
    toast(`Fila ${team.name} excluída`)
    if (form.id === team.id) setForm(emptyTeam)
    router.refresh()
  }

  async function toggleMember(teamId: string, profileId: string, isMember: boolean) {
    const { error } = isMember
      ? await supabase
          .from('team_members')
          .delete()
          .eq('team_id', teamId)
          .eq('profile_id', profileId)
      : await supabase.from('team_members').insert({ team_id: teamId, profile_id: profileId })

    if (error) return toast('Erro ao atualizar o time', 'error')
    router.refresh()
  }

  function membersOf(teamId: string) {
    return members.filter((m) => m.team_id === teamId)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filas</CardTitle>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Grupos para onde o chamado é encaminhado. As três iniciais são um ponto de partida —
          renomeie para os times que o cliente realmente tem.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <Input
            label="Nome"
            placeholder="ex: Suporte N2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="min-w-44"
          />
          <Input
            label="Descrição"
            placeholder="opcional"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="min-w-56 flex-1"
          />
          <Input
            label="Ordem"
            type="number"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="w-20"
          />
          <Button type="submit" size="sm" loading={saving}>
            {editing ? 'Salvar' : 'Criar fila'}
          </Button>
          {editing && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm(emptyTeam)}>
              Cancelar
            </Button>
          )}
        </form>

        <div className="space-y-2">
          {teams.map((team) => {
            const teamMembers = membersOf(team.id)
            const open = openMembers === team.id
            return (
              <div key={team.id} className="rounded-lg border border-zinc-800/80">
                <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-zinc-100">{team.name}</span>
                      <Badge className="bg-zinc-800 text-zinc-400">
                        {teamMembers.length === 1
                          ? '1 pessoa'
                          : `${teamMembers.length} pessoas`}
                      </Badge>
                    </div>
                    {team.description && (
                      <p className="mt-0.5 text-[12px] text-zinc-500">{team.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenMembers(open ? null : team.id)}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Time
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          id: team.id,
                          name: team.name,
                          description: team.description ?? '',
                          position: String(team.position),
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => remove(team)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {open && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-zinc-800/80 px-3 py-2.5">
                    {analysts.length === 0 && (
                      <p className="text-[12px] text-zinc-600">
                        Nenhum analista cadastrado ainda.
                      </p>
                    )}
                    {analysts.map((person) => {
                      const isMember = teamMembers.some((m) => m.profile_id === person.id)
                      return (
                        <label
                          key={person.id}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 text-[13px]',
                            isMember ? 'text-zinc-200' : 'text-zinc-500'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isMember}
                            onChange={() => toggleMember(team.id, person.id, isMember)}
                          />
                          {person.full_name}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {teams.length === 0 && (
            <p className="py-4 text-center text-[13px] text-zinc-600">
              Nenhuma fila cadastrada.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
