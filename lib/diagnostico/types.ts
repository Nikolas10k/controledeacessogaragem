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
