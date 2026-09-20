/**
 * Reapresentação: mesmo rosto reconhecido de novo no mesmo leitor/cancela em
 * menos de 60s. Sinaliza que a cancela não abriu ou a pessoa não conseguiu
 * passar (requisito do spec). Indicador inferido, nunca confirmado.
 */

import type { CancelaId } from "../domain/types.js";
import type { EventoAcesso, ResultadoIndicador } from "./types.js";

export interface Reapresentacao {
  pessoaId: string;
  cancelaId?: CancelaId;
  papelLeitor: "entrada" | "saida";
  primeiroEventoEm: Date;
  segundoEventoEm: Date;
  intervaloSegundos: number;
}

const JANELA_PADRAO_SEGUNDOS = 60;

function chaveDeAgrupamento(evento: EventoAcesso): string {
  return `${evento.pessoaId}::${evento.papelLeitor}::${evento.cancelaId ?? ""}`;
}

export function detectarReapresentacoes(
  eventos: EventoAcesso[],
  janelaSegundos = JANELA_PADRAO_SEGUNDOS,
): ResultadoIndicador<Reapresentacao> {
  const comPessoa = eventos.filter((e) => e.pessoaId !== undefined);

  const porGrupo = new Map<string, EventoAcesso[]>();
  for (const evento of comPessoa) {
    const chave = chaveDeAgrupamento(evento);
    const lista = porGrupo.get(chave) ?? [];
    lista.push(evento);
    porGrupo.set(chave, lista);
  }

  const ocorrencias: Reapresentacao[] = [];
  for (const grupo of porGrupo.values()) {
    const ordenado = [...grupo].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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
