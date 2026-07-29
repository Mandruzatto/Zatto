-- Most requested service catalog items, grouped by category.

insert into public.service_catalog_items (
  slug, title, description, instructions, keywords, category, area,
  default_priority, default_type, requires_approval, form_schema, is_published
)
values
  -- Acessos e contas ------------------------------------------------------
  (
    'reset-de-senha',
    'Reset de senha',
    'Redefina a senha de um sistema que você usa no dia a dia.',
    'Escolha o sistema e, se quiser, deixe uma observação para a equipe.',
    array['senha','reset','esqueci','password','login','redefinir'],
    'Acessos e contas', 'systems', 'high', 'request', false,
    '[
      {"key":"sistema","label":"Qual sistema?","type":"select","required":true,"options":["Windows / Rede","E-mail (Microsoft 365)","ERP","Portal de RH","Outro"]},
      {"key":"details","label":"Observações","type":"textarea","required":false,"placeholder":"Algo que ajude a equipe a te atender mais rápido"}
    ]'::jsonb,
    true
  ),
  (
    'conta-bloqueada',
    'Conta bloqueada ou desbloqueio de usuário',
    'Sua conta travou depois de várias tentativas de acesso.',
    'Informe o sistema e a mensagem que aparece na tela.',
    array['bloqueio','bloqueada','desbloquear','conta','acesso negado','travada'],
    'Acessos e contas', 'systems', 'high', 'request', false,
    '[
      {"key":"sistema","label":"Qual sistema?","type":"select","required":true,"options":["Windows / Rede","E-mail (Microsoft 365)","ERP","Portal de RH","Outro"]},
      {"key":"mensagem","label":"Mensagem exibida","type":"text","required":false,"placeholder":"Ex: sua conta foi bloqueada"}
    ]'::jsonb,
    true
  ),
  (
    'acesso-sistema-pasta',
    'Acesso a sistema ou pasta de rede',
    'Peça permissão para um sistema, pasta compartilhada ou drive.',
    'Este pedido passa pela aprovação do seu gestor antes do atendimento.',
    array['acesso','permissão','pasta','rede','compartilhada','sistema','drive'],
    'Acessos e contas', 'systems', 'medium', 'request', true,
    '[
      {"key":"recurso","label":"Sistema ou caminho da pasta","type":"text","required":true,"placeholder":"Ex: ERP módulo financeiro ou pasta Financeiro do servidor"},
      {"key":"nivel","label":"Nível de acesso","type":"select","required":true,"options":["Somente leitura","Leitura e escrita","Administrador"]},
      {"key":"justificativa","label":"Por que você precisa desse acesso?","type":"textarea","required":true,"placeholder":"Explique a atividade que depende desse acesso"}
    ]'::jsonb,
    true
  ),
  (
    'email-corporativo',
    'Criação ou alteração de e-mail corporativo',
    'Novo endereço, lista de distribuição ou caixa compartilhada.',
    'Este pedido passa pela aprovação do seu gestor.',
    array['email','e-mail','caixa','lista','distribuição','outlook','365'],
    'Acessos e contas', 'systems', 'medium', 'request', true,
    '[
      {"key":"tipo","label":"O que você precisa?","type":"select","required":true,"options":["Novo e-mail","Alterar nome ou endereço","Lista de distribuição","Caixa compartilhada"]},
      {"key":"details","label":"Detalhes","type":"textarea","required":true,"placeholder":"Endereço desejado, quem deve ter acesso e para quê"}
    ]'::jsonb,
    true
  ),
  (
    'acesso-remoto-vpn',
    'Acesso remoto ou VPN',
    'Trabalhe fora do escritório com acesso à rede da empresa.',
    'Este pedido passa pela aprovação do seu gestor.',
    array['vpn','remoto','home office','externo','rede','fora'],
    'Acessos e contas', 'infrastructure', 'medium', 'request', true,
    '[
      {"key":"periodo","label":"Período","type":"select","required":true,"options":["Permanente","Temporário"]},
      {"key":"motivo","label":"Motivo do acesso","type":"textarea","required":true,"placeholder":"Explique quando e por que vai usar o acesso remoto"}
    ]'::jsonb,
    true
  ),
  (
    'desligamento-colaborador',
    'Desligamento de colaborador',
    'Revogue acessos e recolha os equipamentos de quem está saindo.',
    'Abra com antecedência para que os acessos sejam encerrados no prazo certo.',
    array['desligamento','demissão','saída','revogar','offboarding','bloquear'],
    'Acessos e contas', 'systems', 'high', 'request', true,
    '[
      {"key":"colaborador","label":"Nome do colaborador","type":"text","required":true,"placeholder":"Nome completo"},
      {"key":"data","label":"Data do desligamento","type":"text","required":true,"placeholder":"Ex: 15/08"},
      {"key":"details","label":"Observações","type":"textarea","required":false,"placeholder":"Equipamentos a recolher, transferência de arquivos, redirecionamento de e-mail"}
    ]'::jsonb,
    true
  ),

  -- Equipamentos ----------------------------------------------------------
  (
    'notebook-com-defeito',
    'Notebook ou desktop com defeito',
    'Seu computador parou de funcionar ou está com problema.',
    'Descreva o defeito e informe o patrimônio, se souber.',
    array['notebook','desktop','computador','quebrado','defeito','não liga','lento'],
    'Equipamentos', 'infrastructure', 'high', 'incident', false,
    '[
      {"key":"patrimonio","label":"Patrimônio ou nome do equipamento","type":"text","required":false,"placeholder":"Ex: NB-0421"},
      {"key":"problema","label":"Qual o problema?","type":"select","required":true,"options":["Não liga","Muito lento","Tela quebrada","Superaquecendo","Bateria não carrega","Teclado ou touchpad","Outro"]},
      {"key":"details","label":"Detalhes","type":"textarea","required":true,"placeholder":"Desde quando acontece e o que você já tentou"}
    ]'::jsonb,
    true
  ),
  (
    'periferico-mouse-teclado-headset',
    'Mouse, teclado ou headset',
    'Peça um periférico novo ou a troca de um que quebrou.',
    'Escolha o item e o motivo do pedido.',
    array['mouse','teclado','headset','fone','periférico','webcam','acessório'],
    'Equipamentos', 'infrastructure', 'low', 'request', false,
    '[
      {"key":"item","label":"Qual item?","type":"select","required":true,"options":["Mouse","Teclado","Headset","Webcam","Mousepad","Suporte para notebook"]},
      {"key":"motivo","label":"Motivo","type":"select","required":true,"options":["Quebrado ou com defeito","Ainda não tenho","Substituição por desgaste"]}
    ]'::jsonb,
    true
  ),
  (
    'monitor-adicional',
    'Monitor adicional',
    'Peça uma segunda tela para a sua estação de trabalho.',
    'Este pedido passa pela aprovação do seu gestor.',
    array['monitor','tela','segunda tela','display'],
    'Equipamentos', 'infrastructure', 'low', 'request', true,
    '[
      {"key":"justificativa","label":"Por que você precisa?","type":"textarea","required":true,"placeholder":"Conte como a segunda tela ajuda no seu trabalho"}
    ]'::jsonb,
    true
  ),
  (
    'equipamento-novo',
    'Notebook ou desktop novo',
    'Solicite um computador para um colaborador.',
    'Este pedido passa pela aprovação do seu gestor.',
    array['notebook','desktop','computador','novo','máquina','equipamento'],
    'Equipamentos', 'infrastructure', 'medium', 'request', true,
    '[
      {"key":"colaborador","label":"Para quem é o equipamento?","type":"text","required":true,"placeholder":"Nome completo"},
      {"key":"perfil","label":"Perfil de uso","type":"select","required":true,"options":["Uso administrativo","Uso técnico ou desenvolvimento","Uso em campo","Uso em produção ou chão de fábrica"]},
      {"key":"justificativa","label":"Justificativa","type":"textarea","required":true,"placeholder":"Substituição, nova contratação ou projeto"}
    ]'::jsonb,
    true
  ),
  (
    'troca-equipamento',
    'Troca ou upgrade de equipamento',
    'Seu equipamento atual não dá mais conta do trabalho.',
    'Este pedido passa pela aprovação do seu gestor.',
    array['troca','upgrade','memória','ssd','substituir','melhorar'],
    'Equipamentos', 'infrastructure', 'medium', 'request', true,
    '[
      {"key":"patrimonio","label":"Patrimônio do equipamento atual","type":"text","required":true,"placeholder":"Ex: NB-0421"},
      {"key":"motivo","label":"O que está limitando o seu trabalho?","type":"textarea","required":true,"placeholder":"Ex: trava ao abrir vários sistemas ao mesmo tempo"}
    ]'::jsonb,
    true
  ),
  (
    'impressora-problema',
    'Impressora com problema',
    'A impressora do seu setor parou de funcionar.',
    'Informe onde fica a impressora e o que está acontecendo.',
    array['impressora','imprimir','toner','papel','scanner','multifuncional'],
    'Equipamentos', 'infrastructure', 'medium', 'incident', false,
    '[
      {"key":"impressora","label":"Nome ou local da impressora","type":"text","required":true,"placeholder":"Ex: impressora do 2o andar"},
      {"key":"problema","label":"Qual o problema?","type":"select","required":true,"options":["Não imprime","Atolando papel","Sem toner","Qualidade ruim","Não aparece na rede"]}
    ]'::jsonb,
    true
  ),
  (
    'celular-linha-corporativa',
    'Celular corporativo ou linha telefônica',
    'Novo aparelho, nova linha ou problema com a linha atual.',
    'Este pedido passa pela aprovação do seu gestor.',
    array['celular','linha','chip','telefone','aparelho','corporativo'],
    'Equipamentos', 'infrastructure', 'medium', 'request', true,
    '[
      {"key":"tipo","label":"O que você precisa?","type":"select","required":true,"options":["Novo aparelho","Nova linha","Troca de aparelho","Problema na linha atual"]},
      {"key":"justificativa","label":"Justificativa","type":"textarea","required":true,"placeholder":"Explique o uso previsto ou o problema"}
    ]'::jsonb,
    true
  ),

  -- Software --------------------------------------------------------------
  (
    'instalacao-software',
    'Instalação de software',
    'Peça a instalação de um programa no seu equipamento.',
    'Este pedido passa pela aprovação do seu gestor.',
    array['software','instalar','programa','aplicativo','instalação'],
    'Software', 'systems', 'medium', 'request', true,
    '[
      {"key":"software","label":"Qual software?","type":"text","required":true,"placeholder":"Nome e versão, se souber"},
      {"key":"patrimonio","label":"Patrimônio do equipamento","type":"text","required":false,"placeholder":"Ex: NB-0421"},
      {"key":"justificativa","label":"Para que você vai usar?","type":"textarea","required":true,"placeholder":"Explique a atividade que depende do programa"}
    ]'::jsonb,
    true
  ),
  (
    'licenca-software',
    'Licença de software',
    'Solicite uma licença paga como Microsoft 365 ou Adobe.',
    'Este pedido passa pela aprovação do seu gestor por envolver custo.',
    array['licença','office','microsoft','adobe','autocad','assinatura'],
    'Software', 'systems', 'medium', 'request', true,
    '[
      {"key":"software","label":"Qual licença?","type":"select","required":true,"options":["Microsoft 365","Adobe Creative Cloud","AutoCAD","Antivírus","Outro"]},
      {"key":"justificativa","label":"Justificativa","type":"textarea","required":true,"placeholder":"Explique a necessidade e por quanto tempo"}
    ]'::jsonb,
    true
  ),
  (
    'incidente-erro-sistema',
    'Erro em sistema ou aplicação',
    'Um sistema apresenta erro ou comportamento inesperado.',
    'Se puder, anexe a mensagem de erro exata.',
    array['erro','bug','sistema','aplicação','falha','mensagem'],
    'Software', 'systems', 'high', 'incident', false,
    '[
      {"key":"sistema","label":"Qual sistema?","type":"text","required":true,"placeholder":"Nome do sistema ou tela"},
      {"key":"mensagem","label":"Mensagem de erro","type":"text","required":false,"placeholder":"Copie a mensagem exibida"},
      {"key":"details","label":"O que você estava fazendo?","type":"textarea","required":true,"placeholder":"Passos para reproduzir o erro"}
    ]'::jsonb,
    true
  ),
  (
    'incidente-sistema-fora-do-ar',
    'Sistema fora do ar',
    'Um sistema essencial está indisponível para você ou para a equipe.',
    'Use este item quando o trabalho estiver parado.',
    array['fora do ar','indisponível','caiu','offline','parado','urgente'],
    'Software', 'systems', 'critical', 'incident', false,
    '[
      {"key":"sistema","label":"Qual sistema?","type":"text","required":true,"placeholder":"Nome do sistema"},
      {"key":"afetados","label":"Quem está afetado?","type":"select","required":true,"options":["Só eu","Minha equipe","Todo o setor","Toda a empresa"]},
      {"key":"details","label":"Desde quando?","type":"textarea","required":true,"placeholder":"Horário aproximado e o que aparece na tela"}
    ]'::jsonb,
    true
  ),

  -- Rede e infraestrutura -------------------------------------------------
  (
    'incidente-sem-internet',
    'Sem internet ou rede lenta',
    'Sua conexão caiu ou está lenta demais para trabalhar.',
    'Informe o local para agilizar o diagnóstico.',
    array['internet','rede','lenta','sem conexão','cabo','link'],
    'Rede e infraestrutura', 'infrastructure', 'high', 'incident', false,
    '[
      {"key":"local","label":"Local","type":"text","required":true,"placeholder":"Sala, andar ou unidade"},
      {"key":"sintoma","label":"O que acontece?","type":"select","required":true,"options":["Sem conexão","Conexão lenta","Quedas intermitentes"]}
    ]'::jsonb,
    true
  ),
  (
    'incidente-wifi',
    'Problema com Wi-Fi',
    'A rede sem fio não conecta ou cai o tempo todo.',
    'Informe o local e o aparelho usado.',
    array['wifi','wi-fi','sem fio','wireless','sinal'],
    'Rede e infraestrutura', 'infrastructure', 'medium', 'incident', false,
    '[
      {"key":"local","label":"Local","type":"text","required":true,"placeholder":"Sala, andar ou unidade"},
      {"key":"details","label":"Detalhes","type":"textarea","required":true,"placeholder":"Aparelho usado e o que acontece ao tentar conectar"}
    ]'::jsonb,
    true
  ),
  (
    'incidente-ramal-telefonia',
    'Ramal ou telefonia',
    'Seu ramal está mudo, com ruído ou não completa chamadas.',
    'Informe o número do ramal.',
    array['ramal','telefone','telefonia','voip','linha','pabx'],
    'Rede e infraestrutura', 'infrastructure', 'low', 'incident', false,
    '[
      {"key":"ramal","label":"Número do ramal","type":"text","required":true,"placeholder":"Ex: 4021"},
      {"key":"problema","label":"Qual o problema?","type":"select","required":true,"options":["Sem linha","Não recebe chamadas","Não faz chamadas","Ruído na linha"]}
    ]'::jsonb,
    true
  ),

  -- Outros ----------------------------------------------------------------
  (
    'onboarding-novo-colaborador',
    'Novo colaborador: kit de TI',
    'Prepare equipamento, e-mail e acessos para quem está chegando.',
    'Abra com antecedência para que tudo esteja pronto no primeiro dia.',
    array['onboarding','novo','contratação','admissão','kit','primeiro dia'],
    'Outros', 'systems', 'medium', 'request', true,
    '[
      {"key":"colaborador","label":"Nome do novo colaborador","type":"text","required":true,"placeholder":"Nome completo"},
      {"key":"cargo","label":"Cargo e setor","type":"text","required":true,"placeholder":"Ex: Analista Financeiro"},
      {"key":"inicio","label":"Data de início","type":"text","required":true,"placeholder":"Ex: 01/09"},
      {"key":"itens","label":"Equipamentos e acessos necessários","type":"textarea","required":true,"placeholder":"Notebook, e-mail, ERP, telefone, crachá"}
    ]'::jsonb,
    true
  ),
  (
    'restauracao-backup',
    'Restauração de arquivo ou backup',
    'Recupere um arquivo apagado ou uma versão anterior.',
    'Quanto antes for aberto, maior a chance de recuperação.',
    array['backup','restaurar','recuperar','arquivo','apagado','versão'],
    'Outros', 'infrastructure', 'medium', 'request', false,
    '[
      {"key":"arquivo","label":"Arquivo ou pasta","type":"text","required":true,"placeholder":"Nome e caminho, se souber"},
      {"key":"data","label":"Versão de qual data?","type":"text","required":false,"placeholder":"Ex: 20/07 pela manhã"},
      {"key":"details","label":"Detalhes","type":"textarea","required":false,"placeholder":"O que aconteceu com o arquivo"}
    ]'::jsonb,
    true
  ),
  (
    'duvida-sistema',
    'Dúvida sobre uso de sistema',
    'Precisa de ajuda para usar alguma ferramenta ou funcionalidade.',
    'Antes de abrir, vale procurar na base de conhecimento.',
    array['dúvida','ajuda','como fazer','treinamento','orientação'],
    'Outros', 'systems', 'low', 'request', false,
    '[
      {"key":"sistema","label":"Qual sistema ou ferramenta?","type":"text","required":true,"placeholder":"Ex: ERP, Microsoft Teams"},
      {"key":"duvida","label":"Qual a sua dúvida?","type":"textarea","required":true,"placeholder":"Descreva o que você está tentando fazer"}
    ]'::jsonb,
    true
  )
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  instructions = excluded.instructions,
  keywords = excluded.keywords,
  category = excluded.category,
  area = excluded.area,
  default_priority = excluded.default_priority,
  default_type = excluded.default_type,
  requires_approval = excluded.requires_approval,
  form_schema = excluded.form_schema,
  is_published = true,
  updated_at = now();

-- Keep the two generic fallbacks for anything that does not fit a category.
update public.service_catalog_items
set category = 'Outros'
where slug in ('solicitacao-padrao', 'incidente-padrao');
