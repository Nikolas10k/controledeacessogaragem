/**
 * Relatório mensal "Saúde das cancelas": eventos anômalos por cancela,
 * ocorrências manuais registradas na portaria e horários críticos —
 * formato apresentável em assembleia (requisito do spec).
 *
 * Este módulo monta os DADOS do relatório, compondo os indicadores das
 * demais peças deste diretório. A renderização em PDF em si é trabalho de
 * interface (entregável "Interface e relatórios") e não está aqui — a
 * separação mantém esta agregação pura e testável sem depender de uma
 * biblioteca de PDF.
 */

import type { CancelaId } from "../domain/types";
import { detectarCarona } from "./carona";
import { detectarEventosNaoPareados, type PeriodoAnalise } from "./entrada-saida";
import {
  detectarLiberacoesSemPassagem,
} from "./liberacao-sem-passagem";
import type { OcorrenciaManual } from "./ocorrencia-manual";
import { detectarReapresentacoes } from "./reapresentacao";
import type { EventoAcesso } from "./types";

const CANCELAS: readonly CancelaId[] = ["A", "B"];

export interface HorarioCritico {
  hora: number;
  contagem: number;
}

export interface ResumoAnomaliasPorCancela {
  cancelaId: CancelaId;
  totalReapresentacoes: number;
  totalEventosNaoPareados: number;
  liberacoesSemPassagem: { disponivel: boolean; total: number; motivoIndisponivel?: string };
  totalOcorrenciasManuais: number;
  horariosCriticos: HorarioCritico[];
}

export interface RelatorioSaudeCancelas {
  periodo: PeriodoAnalise;
  porCancela: ResumoAnomaliasPorCancela[];
  /** Não atribuível a uma cancela específica: leitor de saída não distingue cancela. */
  totalSaidasSemEntradaNaoAtribuidas: number;
  ocorrenciasManuais: OcorrenciaManual[];
  carona: ReturnType<typeof detectarCarona>;
}

export interface OpcoesRelatorioMensal {
  firmwareDistingueTipos: boolean;
  janelaReapresentacaoSegundos?: number;
  topHorariosCriticos?: number;
}

function contarPorHora(horas: number[], limite: number): HorarioCritico[] {
  const contagemPorHora = new Map<number, number>();
  for (const hora of horas) {
    contagemPorHora.set(hora, (contagemPorHora.get(hora) ?? 0) + 1);
  }
  return Array.from(contagemPorHora.entries())
    .map(([hora, contagem]) => ({ hora, contagem }))
    .sort((a, b) => b.contagem - a.contagem || a.hora - b.hora)
    .slice(0, limite);
}

export function montarRelatorioSaudeCancelas(
  eventos: EventoAcesso[],
  ocorrenciasManuais: OcorrenciaManual[],
  periodo: PeriodoAnalise,
  opcoes: OpcoesRelatorioMensal,
): RelatorioSaudeCancelas {
  const topHorariosCriticos = opcoes.topHorariosCriticos ?? 5;

  const eventosNoPeriodo = eventos.filter(
    (e) => e.timestamp >= periodo.inicio && e.timestamp <= periodo.fim,
  );

  const reapresentacoes = detectarReapresentacoes(eventosNoPeriodo, opcoes.janelaReapresentacaoSegundos);
  const naoPareados = detectarEventosNaoPareados(eventosNoPeriodo, periodo);
  const liberacoesSemPassagem = detectarLiberacoesSemPassagem(eventosNoPeriodo, {
    firmwareDistingueTipos: opcoes.firmwareDistingueTipos,
  });

  const reapresentacoesOk = reapresentacoes.disponivel ? reapresentacoes.ocorrencias : [];
  const naoPareadosOk = naoPareados.disponivel ? naoPareados.ocorrencias : [];

  const porCancela: ResumoAnomaliasPorCancela[] = CANCELAS.map((cancelaId) => {
    const reapresentacoesDaCancela = reapresentacoesOk.filter((r) => r.cancelaId === cancelaId);
    const naoPareadosDaCancela = naoPareadosOk.filter((e) => e.evento.cancelaId === cancelaId);
    const ocorrenciasDaCancela = ocorrenciasManuais.filter((o) => o.cancelaId === cancelaId);

    const horasAnomalas = [
      ...reapresentacoesDaCancela.map((r) => r.segundoEventoEm.getUTCHours()),
      ...naoPareadosDaCancela.map((e) => e.evento.timestamp.getUTCHours()),
    ];

    return {
      cancelaId,
      totalReapresentacoes: reapresentacoesDaCancela.length,
      totalEventosNaoPareados: naoPareadosDaCancela.length,
      liberacoesSemPassagem: liberacoesSemPassagem.disponivel
        ? {
            disponivel: true,
            total: liberacoesSemPassagem.ocorrencias.filter((o) => o.cancelaId === cancelaId).length,
          }
        : { disponivel: false, total: 0, motivoIndisponivel: liberacoesSemPassagem.motivoIndisponivel },
      totalOcorrenciasManuais: ocorrenciasDaCancela.length,
      horariosCriticos: contarPorHora(horasAnomalas, topHorariosCriticos),
    };
  });

  const totalSaidasSemEntradaNaoAtribuidas = naoPareadosOk.filter(
    (e) => e.tipo === "saida_sem_entrada" && e.evento.cancelaId === undefined,
  ).length;

  return {
    periodo,
    porCancela,
    totalSaidasSemEntradaNaoAtribuidas,
    ocorrenciasManuais,
    carona: detectarCarona(),
  };
}
