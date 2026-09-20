/**
 * Liberação sem passagem: autorização sem evento de acesso "efetivado"
 * correspondente (requisito do spec). Só é calculável se o firmware do
 * leitor distinguir "autorizado" de "efetivado" nos logs — quando não
 * distingue, o indicador fica indisponível e o motivo deve aparecer na UI
 * em vez de um número inventado.
 */

import type { CancelaId } from "../domain/types.js";
import type { EventoAcesso, ResultadoIndicador } from "./types.js";

export interface LiberacaoSemPassagem {
  pessoaId: string;
  cancelaId?: CancelaId;
  papelLeitor: "entrada" | "saida";
  autorizadoEm: Date;
}

const JANELA_PADRAO_SEGUNDOS = 60;

function chaveDeAgrupamento(evento: EventoAcesso): string {
  return `${evento.pessoaId}::${evento.papelLeitor}::${evento.cancelaId ?? ""}`;
}

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
  const comPessoa = eventos.filter((e) => e.pessoaId !== undefined);

  const porGrupo = new Map<string, EventoAcesso[]>();
  for (const evento of comPessoa) {
    const chave = chaveDeAgrupamento(evento);
    const lista = porGrupo.get(chave) ?? [];
    lista.push(evento);
    porGrupo.set(chave, lista);
  }

  const ocorrencias: LiberacaoSemPassagem[] = [];
  for (const grupo of porGrupo.values()) {
    const ordenado = [...grupo].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (const evento of ordenado) {
      if (evento.tipo !== "autorizado") continue;
      const temEfetivadoProximo = ordenado.some(
        (outro) =>
          outro.tipo === "efetivado" &&
          outro.timestamp.getTime() >= evento.timestamp.getTime() &&
          (outro.timestamp.getTime() - evento.timestamp.getTime()) / 1000 <= janelaSegundos,
      );
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
