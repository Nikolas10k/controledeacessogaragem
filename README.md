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

**Entregável 3 — módulo de diagnóstico** (`lib/diagnostico/`): transforma
"a cancela vive dando problema" em número auditável, por cancela. Todo
indicador aqui é uma INFERÊNCIA a partir de logs de autorização — nunca uma
confirmação do movimento físico da haste — e os tipos carregam isso
explicitamente (`ResultadoIndicador`) para a UI nunca esconder essa
limitação.

- `reapresentacao.ts` — mesmo rosto reconhecido de novo na mesma
  cancela/leitor em menos de 60s.
- `liberacao-sem-passagem.ts` — autorização sem "efetivado" correspondente;
  fica **indisponível com motivo explicado** quando o firmware do leitor
  não distingue os dois tipos de evento.
- `entrada-saida.ts` — entrada sem saída correspondente e vice-versa, por
  pessoa e período.
- `vazao.ts` — intervalo entre autorizações consecutivas na mesma cancela,
  agrupado por hora e dia da semana (para detectar ciclo lento da haste).
- `baseline.ts` — média móvel de 30 dias por cancela e limiar de alerta por
  desvio padrão configurável.
- `ocorrencia-manual.ts` — registro rápido da portaria (não abriu / não
  desceu / desceu sobre o veículo / abertura espontânea) — a fonte de
  verdade sobre o comportamento físico da cancela, persistido em
  `OcorrenciaManual` no schema Prisma.
- `carona.ts` — **não implementado de propósito**: requer contagem de
  ocupação independente das autorizações (sensor dedicado), que não existe
  na infraestrutura atual; retorna sempre "indisponível" com o motivo
  documentado, em vez de inventar um número.
- `relatorio-mensal.ts` — agrega os indicadores acima por cancela, cruzados
  com as ocorrências manuais e horários críticos, para o relatório "Saúde
  das cancelas". A renderização em PDF fica para o entregável de
  interface/relatórios — aqui só os dados agregados e testáveis.

Ainda não implementados: interface e relatórios (incluindo a geração do PDF
mensal), fila de sincronização persistida em banco (hoje só a referência em
memória do agente).

## Segurança e LGPD — estado atual vs. exigido pelo spec

O spec do produto trata segurança e LGPD como requisito de primeira classe
(biometria é dado pessoal sensível). Nesta fase (entregáveis 1-3, modelo de
dados + agente + diagnóstico) já vale:

- Nenhum segredo hardcoded, nenhum log de dado pessoal/sessão em `lib/`
  (verificado manualmente — sem `console.*` no código de produção, sem
  senha/token/CPF em texto fixo).
- `ErroIDFace.corpo` (resposta crua do dispositivo) e a query string com o
  token de sessão estão documentados no código como sensíveis — quem
  consumir este cliente não deve logá-los sem redigir.
- Consentimento LGPD já é modelado de forma versionada e auditável
  (`ConsentimentoLGPD`: aceito/recusado, versão do termo, IP, data).

Meramente adiado para os entregáveis de interface/aplicação — não
implementado ainda, e não deve ser lido como concluído:

- Armazenamento segregado e criptografado de fotos/templates com chave fora
  do banco (nenhuma foto/template é persistida por este código ainda — o
  upload vai direto ao dispositivo).
- Cofre de segredos para credenciais dos leitores (hoje passadas como
  opções ao `IDFaceClient`; onde/como ficam guardadas é responsabilidade da
  aplicação que instancia o cliente).
- MFA do perfil administrador, sessão com expiração/rate limit/bloqueio
  progressivo, trilha de auditoria com encadeamento de hash, TLS com
  certificado próprio na rede local, VLAN isolada dos leitores — tudo isso
  é infraestrutura/aplicação, fora do escopo do que existe em `lib/` até
  aqui.
- Expurgo automático de imagens/logs por prazo de retenção, exportação e
  exclusão de dados a pedido do titular.

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
  diagnostico/    indicadores de saúde das cancelas (inferidos dos logs)
    types.ts             EventoAcesso normalizado, ResultadoIndicador<T>
    reapresentacao.ts    mesmo rosto na mesma cancela em <60s
    liberacao-sem-passagem.ts  autorizado sem efetivado
    entrada-saida.ts     entrada/saída sem par correspondente
    vazao.ts             intervalo entre autorizações por hora/dia
    baseline.ts          média móvel 30 dias + limiar de alerta
    ocorrencia-manual.ts registro da portaria (fonte de verdade física)
    carona.ts            indicador indisponível (sem sensor de ocupação)
    relatorio-mensal.ts  agregação para o relatório "Saúde das cancelas"
prisma/
  schema.prisma  modelo de dados persistente do cadastro
```
