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

Entregável 1 em andamento: **modelo de dados** (`prisma/schema.prisma`) e a
**camada de tradução** negócio → objetos iDFace (`lib/idface/`), que é a
peça mais crítica da integração — traduz "pessoa X tem direito ao subsolo
N" em grupo + regra de acesso + portal no leitor de entrada compartilhado
pelas duas cancelas (A → 1º subsolo, B → 2º/3º subsolos).

Essa camada é pura (sem rede, sem banco) e coberta por testes automatizados
em `lib/idface/*.test.ts`.

Ainda não implementados: agente de provisionamento/coleta (cliente REST dos
endpoints `.fcgi`), módulo de diagnóstico das cancelas, interface e
relatórios.

## Stack

Node.js + TypeScript · Prisma + PostgreSQL · Vitest.

## Como rodar

```bash
pnpm install
pnpm test        # testes da camada de tradução
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
  domain/       tipos de domínio do cadastro (Pessoa, Empresa, Subsolo, ...)
  idface/       camada de tradução negócio -> estado desejado no iDFace
    routing.ts       regra de roteamento subsolo -> cancela
    translation.ts   pessoa -> usuário/grupos/regras de acesso desejados
    desired-state.ts tipos do estado desejado (não é o payload .fcgi)
prisma/
  schema.prisma  modelo de dados persistente do cadastro
```
