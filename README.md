# Controle de Acesso — Garagem

Sistema de gestão cadastral, provisionamento de leitores faciais Control iD
(linha iDFace) e diagnóstico de acesso veicular para a garagem de um
condomínio comercial. Servidor local, na rede do condomínio.

**O sistema não comanda cancelas nem decide acesso em tempo real** — quem
reconhece o rosto e aciona o relé é o próprio iDFace. O sistema é a fonte da
verdade do cadastro, provisiona os leitores via API e coleta/diagnostica a
partir dos logs. Ver a arquitetura completa (agente + aplicação) e o
detalhamento de cada módulo na descrição do produto.

## Estado atual

**Entregável 1 — modelo de dados e camada de tradução** (`prisma/schema.prisma`,
`lib/idface/`): traduz "pessoa X tem direito ao subsolo N" em grupo + regra
de acesso + portal no leitor de entrada compartilhado pelas duas cancelas
(A → 1º subsolo, B → 2º/3º subsolos). Pura (sem rede, sem banco), coberta
por testes em `lib/idface/*.test.ts`.

**Entregável 2 — agente de provisionamento e coleta** (`lib/idface-client/`):
cliente REST para os endpoints `.fcgi` do iDFace.

- `client.ts` — login com renovação automática de sessão, CRUD em lote
  (`create_objects`/`modify_objects`/`destroy_objects`/`load_objects`),
  upload de biometria envolvido em `template_sync_init`/`template_sync_end`,
  upload de foto em binário puro, sincronização de relógio.
- `log-collector.ts` — coleta incremental de logs por cursor (`where id >
  ultimoId`), persistido por leitor; nunca varre a base inteira.
- `queue.ts` — fila de sincronização com retentativa e backoff exponencial;
  implementação em memória como referência testável (persistência real via
  banco é responsabilidade da aplicação, mesma interface).
- `reconciler.ts` — consolida os planos de provisionamento (entregável 1) de
  várias pessoas em operações em lote, deduplicando grupos/regras
  compartilhados — nunca uma requisição por pessoa.
- `firmware.ts` — detecção de versão e degradação graciosa entre firmwares.

**⚠️ Limitação de validação conhecida:** o domínio oficial
(`controlid.com.br/docs/access-api-en`) estava bloqueado pelo proxy de rede
deste ambiente durante a implementação. Os nomes de endpoint e de objeto
foram corroborados por duas fontes de terceiros (um emulador de código
aberto da API e o SDK Python `controlid-sdk`), mas os formatos exatos de
campo por tipo de objeto e os limiares de degradação por firmware **não
foram confirmados contra a documentação oficial nem contra um dispositivo
real** — ver os comentários no topo de `lib/idface-client/types.ts` e
`lib/idface-client/firmware.ts`. Validar antes de apontar para um leitor
real, conforme exigido pelo spec do produto.

Ainda não implementados: módulo de diagnóstico das cancelas, interface e
relatórios.

## Stack

Node.js + TypeScript · Prisma + PostgreSQL · Vitest.

## Como rodar

```bash
pnpm install
pnpm test        # testes da camada de tradução e do cliente iDFace
pnpm typecheck
```

Persistência (opcional nesta fase, ainda não há código que leia/escreva no
banco):

```bash
cp .env.example .env
pnpm prisma:generate
```

## Estrutura

```
lib/
  domain/         tipos de domínio do cadastro (Pessoa, Empresa, Subsolo, ...)
  idface/         camada de tradução negócio -> estado desejado no iDFace
    routing.ts        regra de roteamento subsolo -> cancela
    translation.ts    pessoa -> usuário/grupos/regras de acesso desejados
    desired-state.ts  tipos do estado desejado (não é o payload .fcgi)
  idface-client/  agente: fala com os leitores via API REST .fcgi
    client.ts         login, CRUD em lote, template sync, foto, relógio
    fetch-transport.ts implementação real do transporte (fetch nativo)
    transport.ts       interface de transporte injetável (testável sem rede)
    reconciler.ts       planos de provisionamento -> operações em lote
    log-collector.ts   coleta incremental de logs por cursor
    queue.ts            fila de sincronização com backoff exponencial
    firmware.ts         detecção de firmware e degradação graciosa
prisma/
  schema.prisma  modelo de dados persistente do cadastro
```
