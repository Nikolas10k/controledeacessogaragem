import { describe, expect, it } from "vitest";
import type { OcorrenciaManual } from "./ocorrencia-manual";
import { montarRelatorioSaudeCancelas } from "./relatorio-mensal";
import type { EventoAcesso } from "./types";

const periodo = { inicio: new Date("2026-09-01T00:00:00Z"), fim: new Date("2026-09-30T23:59:59Z") };

function evento(overrides: Partial<EventoAcesso> = {}): EventoAcesso {
  return {
    id: "e1",
    pessoaId: "p1",
    cancelaId: "A",
    papelLeitor: "entrada",
    timestamp: new Date("2026-09-10T08:00:00Z"),
    tipo: "autorizado",
    ...overrides,
  };
}

function ocorrencia(overrides: Partial<OcorrenciaManual> = {}): OcorrenciaManual {
  return {
    id: "o1",
    cancelaId: "A",
    tipo: "nao_abriu",
    registradoEm: new Date("2026-09-10T08:05:00Z"),
    registradoPorUsuarioId: "porteiro-1",
    ...overrides,
  };
}

describe("montarRelatorioSaudeCancelas", () => {
  it("sempre retorna as duas cancelas, mesmo sem nenhum evento", () => {
    const relatorio = montarRelatorioSaudeCancelas([], [], periodo, { firmwareDistingueTipos: true });
    expect(relatorio.porCancela.map((c) => c.cancelaId)).toEqual(["A", "B"]);
  });

  it("atribui reapresentações e eventos não pareados à cancela correta", () => {
    const eventos = [
      evento({ id: "e1", cancelaId: "A", timestamp: new Date("2026-09-10T08:00:00Z") }),
      evento({ id: "e2", cancelaId: "A", timestamp: new Date("2026-09-10T08:00:20Z") }), // reapresentação em A
      evento({ id: "e3", pessoaId: "p2", cancelaId: "B", papelLeitor: "entrada" }), // entrada sem saída em B
    ];

    const relatorio = montarRelatorioSaudeCancelas(eventos, [], periodo, { firmwareDistingueTipos: true });

    const cancelaA = relatorio.porCancela.find((c) => c.cancelaId === "A")!;
    const cancelaB = relatorio.porCancela.find((c) => c.cancelaId === "B")!;

    expect(cancelaA.totalReapresentacoes).toBe(1);
    expect(cancelaB.totalEventosNaoPareados).toBe(1);
  });

  it("propaga a indisponibilidade de liberação sem passagem quando o firmware não distingue tipos", () => {
    const relatorio = montarRelatorioSaudeCancelas([evento()], [], periodo, {
      firmwareDistingueTipos: false,
    });

    for (const cancela of relatorio.porCancela) {
      expect(cancela.liberacoesSemPassagem.disponivel).toBe(false);
      expect(cancela.liberacoesSemPassagem.motivoIndisponivel).toBeDefined();
    }
  });

  it("conta liberações sem passagem por cancela quando disponível", () => {
    const eventos = [evento({ id: "e1", cancelaId: "A", tipo: "autorizado" })];
    const relatorio = montarRelatorioSaudeCancelas(eventos, [], periodo, {
      firmwareDistingueTipos: true,
    });

    const cancelaA = relatorio.porCancela.find((c) => c.cancelaId === "A")!;
    expect(cancelaA.liberacoesSemPassagem).toEqual({ disponivel: true, total: 1 });
  });

  it("associa ocorrências manuais à cancela correspondente e mantém a lista completa no topo", () => {
    const ocorrencias = [ocorrencia({ id: "o1", cancelaId: "A" }), ocorrencia({ id: "o2", cancelaId: "B" })];
    const relatorio = montarRelatorioSaudeCancelas([], ocorrencias, periodo, {
      firmwareDistingueTipos: true,
    });

    expect(relatorio.porCancela.find((c) => c.cancelaId === "A")?.totalOcorrenciasManuais).toBe(1);
    expect(relatorio.porCancela.find((c) => c.cancelaId === "B")?.totalOcorrenciasManuais).toBe(1);
    expect(relatorio.ocorrenciasManuais).toEqual(ocorrencias);
  });

  it("conta saídas sem entrada do leitor de saída separadamente, sem atribuir a uma cancela", () => {
    const eventos = [evento({ id: "e1", papelLeitor: "saida", cancelaId: undefined })];
    const relatorio = montarRelatorioSaudeCancelas(eventos, [], periodo, { firmwareDistingueTipos: true });

    expect(relatorio.totalSaidasSemEntradaNaoAtribuidas).toBe(1);
    for (const cancela of relatorio.porCancela) {
      expect(cancela.totalEventosNaoPareados).toBe(0);
    }
  });

  it("carona está sempre marcada como indisponível (limitação de dados documentada)", () => {
    const relatorio = montarRelatorioSaudeCancelas([], [], periodo, { firmwareDistingueTipos: true });
    expect(relatorio.carona.disponivel).toBe(false);
  });

  it("ignora eventos fora do período informado", () => {
    const eventos = [
      evento({ id: "e1", timestamp: new Date("2026-08-01T08:00:00Z") }),
      evento({ id: "e2", timestamp: new Date("2026-08-01T08:00:20Z") }),
    ];
    const relatorio = montarRelatorioSaudeCancelas(eventos, [], periodo, { firmwareDistingueTipos: true });
    const cancelaA = relatorio.porCancela.find((c) => c.cancelaId === "A")!;
    expect(cancelaA.totalReapresentacoes).toBe(0);
  });

  it("limita horários críticos ao top configurado, ordenado por contagem decrescente", () => {
    // pessoas distintas sem saída correspondente: cada uma é uma anomalia
    // "entrada_sem_saida" isolada, sem interferência de reapresentação —
    // isola o comportamento de agregação/ordenação por hora que este teste
    // quer verificar.
    const eventos: EventoAcesso[] = [
      evento({ id: "e1", pessoaId: "p1", timestamp: new Date("2026-09-10T08:00:00Z") }),
      evento({ id: "e2", pessoaId: "p2", timestamp: new Date("2026-09-10T08:10:00Z") }),
      evento({ id: "e3", pessoaId: "p3", timestamp: new Date("2026-09-10T08:20:00Z") }),
      evento({ id: "e4", pessoaId: "p4", timestamp: new Date("2026-09-10T09:00:00Z") }),
      evento({ id: "e5", pessoaId: "p5", timestamp: new Date("2026-09-10T10:00:00Z") }),
    ];

    const relatorio = montarRelatorioSaudeCancelas(eventos, [], periodo, {
      firmwareDistingueTipos: true,
      topHorariosCriticos: 1,
    });

    const cancelaA = relatorio.porCancela.find((c) => c.cancelaId === "A")!;
    expect(cancelaA.horariosCriticos).toHaveLength(1);
    expect(cancelaA.horariosCriticos[0]).toEqual({ hora: 8, contagem: 3 });
  });
});
