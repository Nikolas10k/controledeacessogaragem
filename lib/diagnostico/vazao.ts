/**
 * Vazão: intervalo entre autorizações consecutivas na mesma cancela.
 * Aumento sustentado indica ciclo lento da haste (requisito do spec).
 * Agrupado por hora do dia e dia da semana para permitir correlação com
 * padrões de uso e, quando houver esse dado, com dias de chuva.
 */

import type { CancelaId } from "../domain/types.js";
import { agruparPor, type EventoAcesso } from "./types.js";

export interface IntervaloDeVazao {
  cancelaId: CancelaId;
  desde: Date;
  ate: Date;
  segundos: number;
  hora: number;
  diaDaSemana: number;
}

/** Intervalos, em segundos, entre autorizações consecutivas na cancela informada. */
export function calcularIntervalosDeVazao(
  eventos: EventoAcesso[],
  cancelaId: CancelaId,
): IntervaloDeVazao[] {
  const daCancela = eventos
    .filter((e) => e.papelLeitor === "entrada" && e.cancelaId === cancelaId && e.tipo === "autorizado")
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const intervalos: IntervaloDeVazao[] = [];
  for (let i = 1; i < daCancela.length; i++) {
    const anterior = daCancela[i - 1]!;
    const atual = daCancela[i]!;
    intervalos.push({
      cancelaId,
      desde: anterior.timestamp,
      ate: atual.timestamp,
      segundos: (atual.timestamp.getTime() - anterior.timestamp.getTime()) / 1000,
      hora: atual.timestamp.getUTCHours(),
      diaDaSemana: atual.timestamp.getUTCDay(),
    });
  }
  return intervalos;
}

export interface EstatisticaVazao {
  hora: number;
  diaDaSemana: number;
  amostras: number;
  medianaSegundos: number;
}

function mediana(valores: number[]): number {
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  if (ordenado.length % 2 === 0) {
    return (ordenado[meio - 1]! + ordenado[meio]!) / 2;
  }
  return ordenado[meio]!;
}

/** Agrupa os intervalos por (dia da semana, hora) e calcula a mediana de cada grupo. */
export function agruparVazaoPorHoraEDiaDaSemana(
  intervalos: IntervaloDeVazao[],
): EstatisticaVazao[] {
  const grupos = agruparPor(intervalos, (i) => `${i.diaDaSemana}::${i.hora}`);

  const estatisticas: EstatisticaVazao[] = [];
  for (const [chave, grupo] of grupos) {
    const [diaDaSemanaStr, horaStr] = chave.split("::");
    estatisticas.push({
      diaDaSemana: Number(diaDaSemanaStr),
      hora: Number(horaStr),
      amostras: grupo.length,
      medianaSegundos: mediana(grupo.map((i) => i.segundos)),
    });
  }

  return estatisticas.sort((a, b) => a.diaDaSemana - b.diaDaSemana || a.hora - b.hora);
}
