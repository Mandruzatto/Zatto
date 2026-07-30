-- Replace "patrimônio" fields with practical collaborator-facing inputs
-- (AnyDesk + availability / equipment description).

update public.service_catalog_items
set
  instructions = 'Descreva o problema e, se possível, informe o AnyDesk e um horário em que você pode atender.',
  form_schema = '[
    {"key":"problema","label":"Qual o problema?","type":"select","required":true,"options":["Não liga","Muito lento","Tela quebrada","Superaquecendo","Bateria não carrega","Teclado ou touchpad","Outro"]},
    {"key":"anydesk","label":"ID do AnyDesk","type":"text","required":false,"placeholder":"Ex: 1 234 567 890 — se conseguir abrir o computador"},
    {"key":"disponibilidade","label":"Melhor horário para atendimento","type":"text","required":true,"placeholder":"Ex: hoje à tarde, ou 14h–16h"},
    {"key":"details","label":"Detalhes","type":"textarea","required":true,"placeholder":"Desde quando acontece e o que você já tentou"}
  ]'::jsonb,
  updated_at = now()
where slug = 'notebook-com-defeito';

update public.service_catalog_items
set
  form_schema = '[
    {"key":"equipamento","label":"Qual equipamento você usa hoje?","type":"text","required":true,"placeholder":"Ex: notebook Dell da minha mesa"},
    {"key":"disponibilidade","label":"Melhor horário para conversarmos","type":"text","required":false,"placeholder":"Ex: manhãs, ou amanhã depois das 14h"},
    {"key":"motivo","label":"O que está limitando o seu trabalho?","type":"textarea","required":true,"placeholder":"Ex: trava ao abrir vários sistemas ao mesmo tempo"}
  ]'::jsonb,
  updated_at = now()
where slug = 'troca-equipamento';

update public.service_catalog_items
set
  instructions = 'Informe o software, um horário bom para instalação remota e o AnyDesk, se tiver.',
  form_schema = '[
    {"key":"software","label":"Qual software?","type":"text","required":true,"placeholder":"Nome e versão, se souber"},
    {"key":"anydesk","label":"ID do AnyDesk","type":"text","required":false,"placeholder":"Ex: 1 234 567 890"},
    {"key":"disponibilidade","label":"Melhor horário para instalação remota","type":"text","required":true,"placeholder":"Ex: hoje entre 14h e 17h"},
    {"key":"justificativa","label":"Para que você vai usar?","type":"textarea","required":true,"placeholder":"Explique a atividade que depende do programa"}
  ]'::jsonb,
  updated_at = now()
where slug = 'instalacao-software';
