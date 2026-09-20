/**
 * Coleta incremental de logs de acesso: polling com `where id > ultimoId`,
 * cursor persistido por dispositivo — nunca uma varredura completa
 * (requisito de eficiência do spec).
 */

import type { IDFaceClient } from "./client.js";

export interface LogAcessoIDFace {
  id: number;
  user_id?: number;
  time?: number;
  portal_id?: number;
  event?: number;
  [chave: string]: unknown;
}

/** Persistência do cursor por leitor — implementação real fica a cargo da aplicação (banco). */
export interface ArmazenamentoDeCursor {
  obterUltimoId(leitorId: string): Promise<number>;
  salvarUltimoId(leitorId: string, ultimoId: number): Promise<void>;
}

export class ArmazenamentoDeCursorEmMemoria implements ArmazenamentoDeCursor {
  private readonly cursores = new Map<string, number>();

  async obterUltimoId(leitorId: string): Promise<number> {
    return this.cursores.get(leitorId) ?? 0;
  }

  async salvarUltimoId(leitorId: string, ultimoId: number): Promise<void> {
    this.cursores.set(leitorId, ultimoId);
  }
}

export interface ResultadoColeta {
  logs: LogAcessoIDFace[];
  ultimoIdColetado: number;
  /**
   * Heurística simples: verdadeiro quando o primeiro log retornado não é
   * imediatamente posterior ao cursor anterior, o que pode indicar perda de
   * eventos por sobrescrita da memória do aparelho entre duas coletas
   * (spec: "frequência suficiente para não perder eventos"). Não é uma
   * confirmação — apenas um sinal para o operador investigar a frequência
   * de polling configurada para este leitor.
   */
  possivelLacuna: boolean;
}

export async function coletarLogsIncrementais(
  client: IDFaceClient,
  leitorId: string,
  cursorStore: ArmazenamentoDeCursor,
): Promise<ResultadoColeta> {
  const ultimoId = await cursorStore.obterUltimoId(leitorId);

  const resposta = await client.carregarObjetos<LogAcessoIDFace>("access_logs", {
    id: [">", ultimoId],
  });

  const logsOrdenados = [...resposta.objects].sort((a, b) => a.id - b.id);

  if (logsOrdenados.length === 0) {
    return { logs: [], ultimoIdColetado: ultimoId, possivelLacuna: false };
  }

  const primeiroLog = logsOrdenados[0]!;
  const ultimoLog = logsOrdenados[logsOrdenados.length - 1]!;
  const possivelLacuna = ultimoId > 0 && primeiroLog.id !== ultimoId + 1;

  await cursorStore.salvarUltimoId(leitorId, ultimoLog.id);

  return { logs: logsOrdenados, ultimoIdColetado: ultimoLog.id, possivelLacuna };
}
