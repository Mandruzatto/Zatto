# Acesso remoto nativo (zaTTo)

Documento vivo. Atualize ao final de cada sessão de trabalho sobre este tema, para não perder o fio em outro chat.

## Status atual

| Item | Estado |
|---|---|
| Decisão de produto | Fechada — acesso remoto **próprio**, não bridge AnyDesk |
| Agendamento no chamado | Feito (MVP UI + tabela `remote_sessions`) |
| Viewer WebRTC / agente / TURN / UAC | **Não iniciado** |
| Próxima fase | Kickoff técnico (abaixo) |

Última atualização: 2026-07-29

## Objetivo

Colaborador agenda sessão no chamado → autoriza no horário → analista entra **dentro do zaTTo** e controla o PC (incluindo prompts de admin/UAC). Agente instalado no Windows do colaborador.

## Decisões fechadas

1. **Produto próprio** integrado ao chamado (não só abrir AnyDesk).
2. **Controle total** no MVP (mouse + teclado). Só visualizar não serve.
3. **Admin/UAC é requisito** — agente Windows com **serviço elevado** (não só app de bandeja).
4. **Instalar agente nos PCs** é aceitável / desejável.
5. **Windows primeiro**; macOS/Linux depois.
6. Stack alvo: WebRTC + sinalização Supabase + TURN + serviço Windows + viewer no Next.js.
7. Não clonar protocolo AnyDesk do zero.

## O que já existe no código

- Migration: `supabase/migrations/20260729230000_remote_sessions.sql`
- UI: `src/components/remote-session-panel.tsx` (analista + colaborador)
- Helpers: `src/lib/remote-sessions.ts`, tipos em `src/lib/types.ts`
- Chips/filtros: header, lista (`?remote=`), dashboard widget
- Hoje o painel ainda fala em AnyDesk/link — isso será trocado por WebRTC na fase 1

Fluxo de status atual da sessão:

`proposed → confirmed → ready → in_progress → done | cancelled`

## Arquitetura alvo (resumo)

```
Colaborador (agente Windows elevado)
        |  WebRTC (+ TURN se necessário)
        v
Analista (browser no zaTTo)
        |
        v
Supabase (auth, remote_sessions, Realtime signaling, tokens)
```

Componentes do agente:

| Peça | Papel |
|---|---|
| Serviço Windows (SYSTEM/elevado) | Captura (incl. UAC), input, sessão |
| App tray | “Conectado”, autorizar/encerrar para o usuário |
| Instalador MSI | Requer admin na instalação |

## Roadmap — próximos passos para iniciar

### Fase 0 — Kickoff (esta semana)
- [ ] Congelar escopo MVP (este doc)
- [ ] Criar pasta `apps/remote-agent/` (placeholder do agente)
- [ ] Evoluir `remote_sessions`: `access_method` default `webrtc`, campos de token/presence se preciso
- [ ] Remover dependência de UX “AnyDesk” no painel (copy → “agente zaTTo”)
- [ ] Definir provedor TURN para testes (coturn self-host **ou** serviço gerenciado)

### Fase 1 — Sessão + signaling (sem tela ainda)
- [ ] Edge Function / API: emitir token de sessão curto só se `ready|in_progress` + janela válida
- [ ] Tabela/canal Realtime `remote_session_signals` (SDP/ICE)
- [ ] Página viewer: `/tickets/[id]/remote/[sessionId]` (UI + peer connection stub)
- [ ] Agente mínimo: autentica, registra “online”, troca signaling fake/local

### Fase 2 — Tela + controle (sessão do usuário)
- [ ] Captura de tela no agente
- [ ] Stream WebRTC para o viewer
- [ ] Input remoto (mouse/teclado) na sessão do usuário logado
- [ ] Kill switch nos dois lados

### Fase 3 — Elevação / UAC (requisito corporativo)
- [ ] Serviço Windows elevado
- [ ] Captura/input no Secure Desktop (UAC)
- [ ] Instalador MSI
- [ ] Teste: instalar app que pede admin + digitar senha via sessão remota

### Fase 4 — Rede e endurecimento
- [ ] TURN em produção
- [ ] Testes em NAT/firewall corporativo
- [ ] Reconexão, logs de auditoria, qualidade adaptativa

## Estimativa

| Bloco | Tempo |
|---|---|
| Fase 0–1 | 1–2 semanas |
| Fase 2 | 3–5 semanas |
| Fase 3 (UAC) | 3–6 semanas |
| Fase 4 | 1–4 semanas |
| **MVP usável com admin** | **~3–5 meses** |

## Fora do MVP

- macOS/Linux
- Gravação de sessão
- Transferência de arquivo
- Sessão desatendida sem usuário na frente
- Deploy em massa GPO/Intune (desejável cedo, não bloqueia protótipo)

## Como continuar em outro chat

Cole isto (ou aponte o arquivo):

> Continuar o acesso remoto nativo do zaTTo. Ler `docs/remote-access.md` e o plano em `.cursor/plans/built-in_remote_access_2bdb4478.plan.md`. Não reinventar decisões fechadas. Atualizar `docs/remote-access.md` ao final do trabalho.

## Log de sessões

### 2026-07-29
- Produto: remoto próprio, não bridge AnyDesk.
- Fechado: controle total + UAC via serviço elevado; instalação de agente ok.
- Já existe agendamento `remote_sessions` + UI.
- Próximo: Fase 0 kickoff (evoluir modelo/copy + pasta do agente + decisão TURN).
