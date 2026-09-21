/**
 * Entrada sem saída correspondente e vice-versa, por período — requisito do
 * spec. Pareia cronologicamente os eventos de entrada e saída de cada
 * pessoa: uma saída sem uma entrada aberta anterior é anômala, assim como
 * uma entrada que permanece aberta (sem saída) até o fim do período
 * analisado.
 *
 * Indicador inferido: não sabemos se a pessoa de fato saiu por outro meio
 * (ex.: saiu a pé) nem se dois veículos da mesma pessoa cruzaram a garagem.
 *
 * Considera apenas eventos "autorizado": um evento "efetivado" confirma a
 * mesma passagem (quando o firmware distingue os dois), não representa uma
 * nova entrada/saída, e não deve entrar no pareamento cronológico abaixo.
 */

import { agruparEOrdenarPorTempo, type EventoAcesso, type ResultadoIndicador } from "./types";

export interface EventoNaoPareado {
  pessoaId: string;
  tipo: "entrada_sem_saida" | "saida_sem_entrada";
  evento: EventoAcesso;
}

export interface PeriodoAnalise {
  inicio: Date;
  fim: Date;
}

export function detectarEventosNaoPareados(
  eventos: EventoAcesso[],
  periodo: PeriodoAnalise,
): ResultadoIndicador<EventoNaoPareado> {
  const noPeriodo = eventos.filter(
    (e) =>
      e.pessoaId !== undefined &&
      e.tipo === "autorizado" &&
      e.timestamp.getTime() >= periodo.inicio.getTime() &&
      e.timestamp.getTime() <= periodo.fim.getTime(),
  );

  const porPessoa = agruparEOrdenarPorTempo(
    noPeriodo,
    (e) => e.pessoaId!,
    (e) => e.timestamp.getTime(),
  );

  const ocorrencias: EventoNaoPareado[] = [];

  for (const [pessoaId, ordenado] of porPessoa) {
    let entradaAberta: EventoAcesso | undefined;
    for (const evento of ordenado) {
      if (evento.papelLeitor === "entrada") {
        if (entradaAberta) {
          // duas entradas seguidas sem saída entre elas: a primeira fica sem saída
          ocorrencias.push({ pessoaId, tipo: "entrada_sem_saida", evento: entradaAberta });
        }
        entradaAberta = evento;
      } else {
        if (entradaAberta) {
          entradaAberta = undefined;
        } else {
          ocorrencias.push({ pessoaId, tipo: "saida_sem_entrada", evento });
        }
      }
    }

    if (entradaAberta) {
      ocorrencias.push({ pessoaId, tipo: "entrada_sem_saida", evento: entradaAberta });
    }
  }

  return { disponivel: true, tipo: "inferido", ocorrencias };
}
