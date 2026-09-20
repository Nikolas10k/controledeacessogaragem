/**
 * Tipos do módulo de diagnóstico das cancelas.
 *
 * Limitação estrutural que atravessa todo este módulo (spec do produto):
 * os logs do iDFace registram AUTORIZAÇÕES, não o movimento físico da
 * haste da cancela. Todo indicador calculado a partir de log é uma
 * INFERÊNCIA, nunca uma confirmação, e deve ser rotulado como tal na
 * interface — os tipos abaixo carregam esse rótulo explicitamente
 * (`TipoIndicador`) para que a UI não possa esquecer de exibi-lo.
 */

import type { CancelaId } from "../domain/types.js";

export type TipoIndicador = "inferido" | "registro_manual";

/**
 * Evento de acesso normalizado — decoupled do formato de log bruto do
 * iDFace (ver lib/idface-client/log-collector.ts). A conversão de
 * LogAcessoIDFace para EventoAcesso é responsabilidade de quem consome
 * este módulo (a aplicação), o que mantém os indicadores testáveis sem
 * depender do formato exato do dispositivo.
 */
export interface EventoAcesso {
  id: string;
  /** Ausente quando o log não pôde ser correlacionado a uma pessoa cadastrada. */
  pessoaId?: string;
  /** Ausente para o leitor de saída, que não distingue cancela. */
  cancelaId?: CancelaId;
  papelLeitor: "entrada" | "saida";
  timestamp: Date;
  /**
   * "autorizado" = liberação concedida pelo leitor; "efetivado" = o
   * firmware confirmou passagem. Nem todo firmware distingue os dois —
   * ver lib/diagnostico/liberacao-sem-passagem.ts.
   */
  tipo: "autorizado" | "efetivado";
}

/** Resultado de um indicador que pode não estar disponível com os dados atuais. */
export type ResultadoIndicador<T> =
  | { disponivel: true; tipo: TipoIndicador; ocorrencias: T[] }
  | { disponivel: false; motivoIndisponivel: string };

/**
 * Utilitários de agrupamento compartilhados pelos indicadores deste módulo
 * — evita que cada arquivo reimplemente seu próprio "Map + push" e sua
 * própria chave pessoa/leitor/cancela.
 */

/** Agrupa itens por chave, preservando a ordem relativa dentro de cada grupo. */
export function agruparPor<T>(itens: T[], chave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const lista = grupos.get(chave(item)) ?? [];
    lista.push(item);
    grupos.set(chave(item), lista);
  }
  return grupos;
}

/** Como `agruparPor`, mas cada grupo sai ordenado ascendentemente por `tempoMs`. */
export function agruparEOrdenarPorTempo<T>(
  itens: T[],
  chave: (item: T) => string,
  tempoMs: (item: T) => number,
): Map<string, T[]> {
  const grupos = agruparPor(itens, chave);
  for (const [chaveDoGrupo, grupo] of grupos) {
    grupos.set(
      chaveDoGrupo,
      [...grupo].sort((a, b) => tempoMs(a) - tempoMs(b)),
    );
  }
  return grupos;
}

/** Chave de agrupamento pessoa + leitor + cancela, usada por reapresentação e liberação sem passagem. */
export function chavePessoaLeitorCancela(evento: EventoAcesso): string {
  return `${evento.pessoaId}::${evento.papelLeitor}::${evento.cancelaId ?? ""}`;
}

/** Eventos correlacionados a uma pessoa cadastrada. */
export function comPessoa(eventos: EventoAcesso[]): EventoAcesso[] {
  return eventos.filter((e) => e.pessoaId !== undefined);
}

/**
 * Eventos "autorizado" correlacionados a uma pessoa — o evento de
 * apresentação/movimento em si; "efetivado" é só a confirmação da mesma
 * passagem (ver EventoAcesso.tipo) e não deve ser tratado como um novo
 * movimento por indicadores como reapresentação ou entrada/saída.
 */
export function autorizadosComPessoa(eventos: EventoAcesso[]): EventoAcesso[] {
  return comPessoa(eventos).filter((e) => e.tipo === "autorizado");
}
