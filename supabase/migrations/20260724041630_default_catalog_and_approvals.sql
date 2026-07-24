-- Default catalog items for collaborators + keep approvers able to approve

insert into public.service_catalog_items (
  slug, title, description, instructions, keywords, area, default_priority,
  requires_approval, form_schema, is_published
)
values
  (
    'solicitacao-padrao',
    'Solicitação padrão',
    'Abra uma solicitação de serviço para a equipe de TI.',
    'Descreva o que você precisa e qualquer prazo relevante.',
    array['solicitação','pedido','serviço','ajuda','padrão'],
    'systems',
    'medium',
    false,
    '[
      {"key":"subject","label":"Assunto","type":"text","required":true,"placeholder":"Resumo da solicitação"},
      {"key":"details","label":"Detalhes","type":"textarea","required":true,"placeholder":"Explique o que precisa e o contexto"}
    ]'::jsonb,
    true
  ),
  (
    'incidente-padrao',
    'Incidente padrão',
    'Reporte um problema ou falha que está atrapalhando o seu trabalho.',
    'Inclua o que aconteceu, desde quando e o impacto.',
    array['incidente','problema','erro','falha','padrão'],
    'infrastructure',
    'high',
    false,
    '[
      {"key":"subject","label":"O que está acontecendo?","type":"text","required":true,"placeholder":"Ex: não consigo acessar o e-mail"},
      {"key":"impact","label":"Impacto","type":"select","required":true,"options":["Baixo","Médio","Alto","Crítico"]},
      {"key":"details","label":"Detalhes","type":"textarea","required":true,"placeholder":"Quando começou, mensagem de erro, o que já tentou"}
    ]'::jsonb,
    true
  )
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  instructions = excluded.instructions,
  keywords = excluded.keywords,
  area = excluded.area,
  default_priority = excluded.default_priority,
  form_schema = excluded.form_schema,
  is_published = true,
  updated_at = now();

-- Anyone designated as approver gains approval permission
create or replace function public.ensure_approver_capability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approver_id is not null then
    update public.profiles
      set can_approve = true
      where id = new.approver_id
        and coalesce(can_approve, false) = false;
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_approver_capability() from public, anon, authenticated;

drop trigger if exists trg_ensure_approver_capability on public.ticket_approvals;
create trigger trg_ensure_approver_capability
  after insert or update of approver_id on public.ticket_approvals
  for each row execute function public.ensure_approver_capability();

-- Managers configured on profiles can approve
create or replace function public.ensure_manager_can_approve()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.manager_id is not null then
    update public.profiles
      set can_approve = true
      where id = new.manager_id
        and coalesce(can_approve, false) = false;
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_manager_can_approve() from public, anon, authenticated;

drop trigger if exists trg_ensure_manager_can_approve on public.profiles;
create trigger trg_ensure_manager_can_approve
  after insert or update of manager_id on public.profiles
  for each row execute function public.ensure_manager_can_approve();

-- Backfill existing designated approvers/managers
update public.profiles p
set can_approve = true
where coalesce(p.can_approve, false) = false
  and (
    exists (select 1 from public.ticket_approvals ta where ta.approver_id = p.id)
    or exists (select 1 from public.profiles c where c.manager_id = p.id)
  );
