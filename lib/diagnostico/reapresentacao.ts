/**
 * Reapresentação: mesmo rosto reconhecido de novo no mesmo leitor/cancela em
 * menos de 60s. Sinaliza que a cancela não abriu ou a pessoa não conseguiu
 * passar (requisito do spec). Indicador inferido, nunca confirmado.
 *
 * Considera apenas eventos "autorizado": um evento "efetivado" é a
 * confirmação da mesma passagem (quando o firmware distingue os dois — ver
 * lib/diagnostico/liberacao-sem-passagem.ts), não uma nova apresentação de
 * rosto, e não deve contar como reapresentação.
 */

import type { CancelaId } from "../domain/types";
import {
  agruparEOrdenarPorTempo,
  autorizadosComPessoa,
  chavePessoaLeitorCancela,
  type EventoAcesso,
  type ResultadoIndicador,
} from "./types";

export interface Reapresentacao {
  pessoaId: string;
  cancelaId?: CancelaId;
  papelLeitor: "entrada" | "saida";
  primeiroEventoEm: Date;
  segundoEventoEm: Date;
  intervaloSegundos: number;
}

const JANELA_PADRAO_SEGUNDOS = 60;

export function detectarReapresentacoes(
  eventos: EventoAcesso[],
  janelaSegundos = JANELA_PADRAO_SEGUNDOS,
): ResultadoIndicador<Reapresentacao> {
  const porGrupo = agruparEOrdenarPorTempo(
    autorizadosComPessoa(eventos),
    chavePessoaLeitorCancela,
    (e) => e.timestamp.getTime(),
  );

  const ocorrencias: Reapresentacao[] = [];
  for (const ordenado of porGrupo.values()) {
    for (let i = 1; i < ordenado.length; i++) {
      const anterior = ordenado[i - 1]!;
      const atual = ordenado[i]!;
      const intervaloSegundos = (atual.timestamp.getTime() - anterior.timestamp.getTime()) / 1000;
      if (intervaloSegundos <= janelaSegundos) {
        ocorrencias.push({
          pessoaId: atual.pessoaId!,
          cancelaId: atual.cancelaId,
          papelLeitor: atual.papelLeitor,
          primeiroEventoEm: anterior.timestamp,
          segundoEventoEm: atual.timestamp,
          intervaloSegundos,
        });
      }
    }
  }

  return { disponivel: true, tipo: "inferido", ocorrencias };
}
