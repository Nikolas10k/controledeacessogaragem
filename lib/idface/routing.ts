/**
 * Regra de roteamento: traduz "pessoa X tem direito ao subsolo N" na escolha
 * de cancela feita pelo leitor de entrada compartilhado.
 *
 * Esta é a peça mais crítica da integração (ver AGENTS/spec do produto):
 * mantida isolada e sem dependência de rede ou de banco para ser testável
 * de forma determinística.
 *
 * Política adotada para quem tem direito a mais de um subsolo: a pessoa
 * recebe acesso à UNIÃO das cancelas correspondentes a todos os subsolos
 * autorizados (não precisa escolher uma única cancela).
 */

import type { CancelaId, Subsolo } from "../domain/types.js";

/**
 * Dado o conjunto de subsolos autorizados de uma pessoa, resolve o conjunto
 * (sem duplicatas, ordenado) de cancelas às quais ela deve ter acesso no
 * leitor de entrada.
 */
export function resolverCancelasParaSubsolos(
  subsolosAutorizados: Subsolo[],
): CancelaId[] {
  const cancelas = new Set<CancelaId>();
  for (const subsolo of subsolosAutorizados) {
    cancelas.add(subsolo.cancelaId);
  }
  return Array.from(cancelas).sort();
}

/**
 * Verdadeiro se a pessoa (pelos subsolos autorizados) tem direito a mais de
 * uma cancela na entrada — útil para a UI sinalizar esse caso e para a
 * camada de tradução emitir múltiplas regras de acesso.
 */
export function temAcessoAMultiplasCancelas(
  subsolosAutorizados: Subsolo[],
): boolean {
  return resolverCancelasParaSubsolos(subsolosAutorizados).length > 1;
}
