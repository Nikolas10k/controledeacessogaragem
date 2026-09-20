/**
 * Liberação sem passagem: autorização sem evento de acesso "efetivado"
 * correspondente (requisito do spec). Só é calculável se o firmware do
 * leitor distinguir "autorizado" de "efetivado" nos logs — quando não
 * distingue, o indicador fica indisponível e o motivo deve aparecer na UI
 * em vez de um número inventado.
 */

import type { CancelaId } from "../domain/types.js";
import {
  agruparEOrdenarPorTempo,
  chavePessoaLeitorCancela,
  comPessoa,
  type EventoAcesso,
  type ResultadoIndicador,
} from "./types.js";

export interface LiberacaoSemPassagem {
  pessoaId: string;
  cancelaId?: CancelaId;
  papelLeitor: "entrada" | "saida";
  autorizadoEm: Date;
}

const JANELA_PADRAO_SEGUNDOS = 60;

export function detectarLiberacoesSemPassagem(
  eventos: EventoAcesso[],
  opcoes: { firmwareDistingueTipos: boolean; janelaSegundos?: number },
): ResultadoIndicador<LiberacaoSemPassagem> {
  if (!opcoes.firmwareDistingueTipos) {
    return {
      disponivel: false,
      motivoIndisponivel:
        "O firmware deste leitor não distingue 'autorizado' de 'efetivado' nos logs de " +
        "acesso — não é possível inferir liberação sem passagem a partir dos dados " +
        "disponíveis. Registre ocorrências manualmente na portaria enquanto essa " +
        "limitação persistir.",
    };
  }

  const janelaSegundos = opcoes.janelaSegundos ?? JANELA_PADRAO_SEGUNDOS;
  const porGrupo = agruparEOrdenarPorTempo(
    comPessoa(eventos),
    chavePessoaLeitorCancela,
    (e) => e.timestamp.getTime(),
  );

  const ocorrencias: LiberacaoSemPassagem[] = [];
  for (const ordenado of porGrupo.values()) {
    // ambos já ordenados ascendentemente: um único ponteiro percorre
    // `efetivados` em vez de reescaneá-lo para cada evento "autorizado"
    // (evita O(n²) por grupo em meses de log).
    const efetivados = ordenado.filter((e) => e.tipo === "efetivado");
    let ponteiro = 0;

    for (const evento of ordenado) {
      if (evento.tipo !== "autorizado") continue;

      while (
        ponteiro < efetivados.length &&
        efetivados[ponteiro]!.timestamp.getTime() < evento.timestamp.getTime()
      ) {
        ponteiro++;
      }

      const candidato = efetivados[ponteiro];
      const temEfetivadoProximo =
        candidato !== undefined &&
        (candidato.timestamp.getTime() - evento.timestamp.getTime()) / 1000 <= janelaSegundos;

      if (!temEfetivadoProximo) {
        ocorrencias.push({
          pessoaId: evento.pessoaId!,
          cancelaId: evento.cancelaId,
          papelLeitor: evento.papelLeitor,
          autorizadoEm: evento.timestamp,
        });
      }
    }
  }

  return { disponivel: true, tipo: "inferido", ocorrencias };
}
