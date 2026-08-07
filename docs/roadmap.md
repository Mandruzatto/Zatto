# Roadmap do zaTTo (ITSM)

Documento vivo. Atualize ao final de cada sessão de trabalho.

Última atualização: 2026-08-07

## Princípios firmados

**E-mail é recurso escasso.** Notificar por e-mail só quem *não* está dentro do sistema
e só quando precisa agir. Volume alto faz a pessoa filtrar tudo — inclusive o que
importava. Analista vive no sistema: recebe sino, nunca e-mail de rotina. Ninguém é
notificado da própria ação, e eventos repetidos no mesmo chamado colapsam em um só.

Ciclo de vida típico: **2 e-mails** para o solicitante, **1** para o aprovador (se
houver aprovação), **zero** para o analista.

## Entregue

| | Detalhe |
|---|---|
| Aprovador livre | Deixa de ser obrigatório na abertura; card próprio com "Adicionar/Trocar aprovador", seleção livre de qualquer colaborador. Gestor é valor inicial de conveniência, nunca trava |
| CSAT | Nota 1–5 + comentário após finalizar, corrigível; analista vê no chamado |
| Ordenação por atividade | Coluna "Atualizado" ordenável; trigger passou a contar qualquer comentário como atividade (antes resposta de colaborador não contava) |
| Notificações in-app | Tabela `notifications` + 5 triggers, RLS por usuário, sino com realtime, sino também no portal do colaborador |
| Multi-cliente | Tabela `tenants`, marca de dono nas 8 tabelas raiz, isolamento reescrito em 45 políticas e verificado com cliente fictício |
| Convite e ativação | Criação de cliente com convite do ponto focal, ativação por link, conta master convidando o time. Token guardado como hash |
| Envio de e-mail | Resend com três modos (seco, caixa de teste, normal). Entrega confirmada |
| Composer no chamado | Destinatário por nome com cópia e cópia oculta, log na conversa |
| Notificação por e-mail | Régua estreita: aprovador, e solicitante quando respondido ou finalizado. Analista não recebe |
| Relatórios | `/reports` com SLA cumprido, tempo médio, satisfação e distribuições |
| Sugestão de artigo | Casa palavra-chave do catálogo com a base antes de abrir chamado |
| Endurecimento | Funções privilegiadas fechadas para visitante, gatilho tirado do alcance de RPC, `search_path` esvaziado |

## Pendente

### E-mail de entrada — escrito, não exercitado
`/api/email/inbound` recebe a resposta e devolve para o chamado: casa pelo número no
assunto, corta citação e assinatura, e só aceita remetente cadastrado, dentro do
cliente dele. A assinatura do webhook é obrigatória — sem `INBOUND_WEBHOOK_SECRET`
a rota recusa tudo.

**Nunca rodou de verdade.** Receber e-mail exige domínio com registros MX apontando
para o provedor. Tratar como rascunho até haver domínio.

### Domínio próprio
Enquanto não existir, o remetente é `onboarding@resend.dev` e todo envio é
redirecionado para `EMAIL_TEST_INBOX`. Registrar um `.com.br` (~R$ 40/ano) destrava
envio real, remetente com a cara do produto e, depois, o e-mail de entrada.

### Multi-cliente — o que falta
Roteamento por subdomínio (`cliente.zatto.com`) e SSO por cliente, que depende de
domínio e do plano pago do Supabase (SAML ~US$ 75/mês). Sem faturamento ainda.

### Acabamento do composer
Formatação, respostas prontas, rascunho salvo, "enviar e mudar status", anexo no
e-mail (hoje o anexo fica só no portal).

### Notificação de SLA
SLA em risco ou vencido é baseado em tempo passando, não em alguém agir, então não
sai de gatilho: precisa de agendamento. A coluna `notifications.email_sent_at` já
existe como fila para quando houver agendador com chave de serviço.

### Proteção contra senha vazada
Continua desligada. É configuração do painel de Auth do Supabase, fora do alcance
das ferramentas de banco — precisa ser ligada à mão em Authentication → Providers.

### Avisos de segurança que permanecem, e por quê
O verificador aponta funções `SECURITY DEFINER` executáveis por usuário autenticado.
São os auxiliares das políticas de acesso: política é avaliada como o usuário, então
ele precisa poder executá-las. Todas devolvem booleano ou o próprio cliente de quem
pergunta — não expõem dado de terceiro. `invitation_preview` fica aberta para
visitante de propósito: quem clica no link do convite ainda não tem conta.

### Planilha de custos e retorno
Pedida para mais adiante: custo fixo, custo por cliente, ponto de equilíbrio e
simulação de planos. Faz sentido depois do SSO, quando os custos reais estiverem
conhecidos — antes disso os números seriam chutados.

## Conteúdo é de cada cliente

Catálogo, base de conhecimento e inventário são preenchidos por cada cliente no
ambiente dele, não pelo fornecedor. Uma base vazia no ambiente de demonstração
não é lacuna do produto — é ambiente sem cliente dentro.

O que o produto precisa garantir é que preencher seja fácil: o catálogo já vem
com 26 itens padrão que servem de ponto de partida. Vale considerar o mesmo para
a base de conhecimento (artigos iniciais que o cliente adapta) e um importador de
CSV para o inventário, que costuma vir de planilha.

## Fora do plano

- **Problem/Change Management** — só com volume de incidentes recorrentes que justifique
- **Acesso remoto** — pausado, ver `docs/remote-access.md`
