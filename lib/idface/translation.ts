/**
 * Camada de tradução: negócio (Pessoa + subsolos autorizados) -> estado
 * desejado de objetos iDFace (usuário, grupos, regras de acesso).
 *
 * Pura e sem I/O — nenhuma chamada de rede ou banco aqui. O agente
 * (entregável 2) é quem aplica este estado desejado no(s) dispositivo(s).
 */

import type { Leitor, Pessoa, Subsolo } from "../domain/types";
import type { PlanoProvisionamento } from "./desired-state";
import { resolverCancelasParaSubsolos } from "./routing";

export const GRUPO_SAIDA = "ACESSO_SAIDA";

export class ErroDeProvisionamento extends Error {}

export function nomeGrupoSubsolo(subsolo: Subsolo): string {
  return `ACESSO_SUBSOLO_${subsolo.codigo}`;
}

function nomeRegraEntrada(subsolo: Subsolo): string {
  return `ENTRADA_CANCELA_${subsolo.cancelaId}_SUBSOLO_${subsolo.codigo}`;
}

/**
 * Traduz uma pessoa e seus subsolos autorizados no plano de provisionamento
 * desejado no iDFace.
 *
 * - status "ativo" sem nenhum subsolo autorizado é um erro de cadastro
 *   (política: toda pessoa ativa deve ter pelo menos um subsolo autorizado
 *   antes de ser provisionada).
 * - status "bloqueado"/"inativo" produz um plano que remove todo acesso
 *   (usuário inativo, sem grupos, sem regras) — mas o efeito só é real após
 *   a sincronização com o dispositivo (responsabilidade do agente/UI).
 * - direito a mais de um subsolo gera uma regra de acesso por subsolo,
 *   cobrindo a união das cancelas correspondentes (ver lib/idface/routing.ts).
 * - ausência de consentimento com biometria (LGPD) não bloqueia o acesso:
 *   o plano é gerado normalmente e o motivo é sinalizado para que o agente
 *   e a UI usem meio alternativo (cartão/TAG) em vez de template facial.
 */
export function traduzirPessoaParaProvisionamento(
  pessoa: Pessoa,
  subsolosAutorizados: Subsolo[],
  leitorEntrada: Leitor,
  leitorSaida: Leitor,
  horarioNome = "24x7",
): PlanoProvisionamento {
  if (leitorEntrada.papel !== "entrada") {
    throw new ErroDeProvisionamento(
      `Leitor ${leitorEntrada.id} informado como entrada não tem papel "entrada"`,
    );
  }
  if (leitorSaida.papel !== "saida") {
    throw new ErroDeProvisionamento(
      `Leitor ${leitorSaida.id} informado como saída não tem papel "saida"`,
    );
  }

  const idsAutorizados = new Set(pessoa.subsolosAutorizadosIds);
  const subsolosDaPessoa = subsolosAutorizados.filter((s) =>
    idsAutorizados.has(s.id),
  );
  if (subsolosDaPessoa.length !== idsAutorizados.size) {
    throw new ErroDeProvisionamento(
      `Pessoa ${pessoa.id} referencia subsolo(s) autorizado(s) inexistente(s)`,
    );
  }

  const ativo = pessoa.status === "ativo";

  if (ativo && subsolosDaPessoa.length === 0) {
    throw new ErroDeProvisionamento(
      `Pessoa ${pessoa.id} está ativa mas não possui nenhum subsolo autorizado`,
    );
  }

  const motivoSemBiometria = !pessoa.consentimentoBiometriaAceito
    ? "Pessoa não consentiu com biometria (LGPD): provisionar apenas meio " +
      "alternativo (cartão/TAG), sem template facial. O acesso não pode " +
      "ser negado por falta de consentimento."
    : undefined;

  if (!ativo) {
    return {
      usuario: {
        pessoaId: pessoa.id,
        nome: pessoa.nome,
        matricula: pessoa.cpf,
        ativo: false,
        grupos: [],
      },
      grupos: [],
      regrasAcesso: [],
      motivoSemBiometria,
    };
  }

  // Garante ordem determinística (por código de subsolo) independente da
  // ordem de entrada, para que o plano gerado seja estável/comparável.
  const subsolosOrdenados = [...subsolosDaPessoa].sort((a, b) =>
    a.codigo.localeCompare(b.codigo),
  );

  const grupos = [
    ...subsolosOrdenados.map((subsolo) => ({
      nome: nomeGrupoSubsolo(subsolo),
      descricao: `Acesso ao ${subsolo.nome} (cancela ${subsolo.cancelaId})`,
    })),
    { nome: GRUPO_SAIDA, descricao: "Acesso ao leitor de saída" },
  ];
  const nomesGrupos = grupos.map((g) => g.nome);

  const regrasAcesso = [
    ...subsolosOrdenados.map((subsolo) => ({
      nome: nomeRegraEntrada(subsolo),
      grupoNome: nomeGrupoSubsolo(subsolo),
      leitorId: leitorEntrada.id,
      portalAlvo: subsolo.cancelaId,
      horarioNome,
    })),
    {
      nome: "SAIDA",
      grupoNome: GRUPO_SAIDA,
      leitorId: leitorSaida.id,
      portalAlvo: "SAIDA" as const,
      horarioNome,
    },
  ];

  return {
    usuario: {
      pessoaId: pessoa.id,
      nome: pessoa.nome,
      matricula: pessoa.cpf,
      ativo: true,
      grupos: nomesGrupos,
    },
    grupos,
    regrasAcesso,
    motivoSemBiometria,
  };
}

/** As cancelas às quais o plano concede acesso na entrada (derivado, para UI/testes). */
export function cancelasNoPlano(
  plano: PlanoProvisionamento,
): ReturnType<typeof resolverCancelasParaSubsolos> {
  const cancelas = plano.regrasAcesso
    .map((r) => r.portalAlvo)
    .filter((p): p is "A" | "B" => p === "A" || p === "B");
  return Array.from(new Set(cancelas)).sort();
}
