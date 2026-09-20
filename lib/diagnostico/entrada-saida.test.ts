import { describe, expect, it } from "vitest";
import type { EventoAcesso } from "./types.js";
import { detectarEventosNaoPareados } from "./entrada-saida.js";

const periodo = { inicio: new Date("2026-09-20T00:00:00Z"), fim: new Date("2026-09-20T23:59:59Z") };

function evento(overrides: Partial<EventoAcesso> = {}): EventoAcesso {
  return {
    id: "e1",
    pessoaId: "p1",
    papelLeitor: "entrada",
    timestamp: new Date("2026-09-20T08:00:00Z"),
    tipo: "autorizado",
    ...overrides,
  };
}

describe("detectarEventosNaoPareados", () => {
  it("não sinaliza nada para uma entrada seguida de uma saída", () => {
    const eventos = [
      evento({ id: "e1", papelLeitor: "entrada", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", papelLeitor: "saida", timestamp: new Date("2026-09-20T18:00:00Z") }),
    ];

    const resultado = detectarEventosNaoPareados(eventos, periodo);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });

  it("sinaliza entrada sem saída até o fim do período", () => {
    const eventos = [evento({ id: "e1", papelLeitor: "entrada" })];

    const resultado = detectarEventosNaoPareados(eventos, periodo);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toEqual([
      { pessoaId: "p1", tipo: "entrada_sem_saida", evento: eventos[0] },
    ]);
  });

  it("sinaliza saída sem entrada anterior", () => {
    const eventos = [evento({ id: "e1", papelLeitor: "saida" })];

    const resultado = detectarEventosNaoPareados(eventos, periodo);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toEqual([
      { pessoaId: "p1", tipo: "saida_sem_entrada", evento: eventos[0] },
    ]);
  });

  it("sinaliza a primeira de duas entradas consecutivas sem saída entre elas", () => {
    const eventos = [
      evento({ id: "e1", papelLeitor: "entrada", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", papelLeitor: "entrada", timestamp: new Date("2026-09-20T09:00:00Z") }),
      evento({ id: "e3", papelLeitor: "saida", timestamp: new Date("2026-09-20T18:00:00Z") }),
    ];

    const resultado = detectarEventosNaoPareados(eventos, periodo);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toEqual([
      { pessoaId: "p1", tipo: "entrada_sem_saida", evento: eventos[0] },
    ]);
  });

  it("trata cada pessoa independentemente", () => {
    const eventos = [
      evento({ id: "e1", pessoaId: "p1", papelLeitor: "entrada", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", pessoaId: "p1", papelLeitor: "saida", timestamp: new Date("2026-09-20T18:00:00Z") }),
      evento({ id: "e3", pessoaId: "p2", papelLeitor: "saida", timestamp: new Date("2026-09-20T10:00:00Z") }),
    ];

    const resultado = detectarEventosNaoPareados(eventos, periodo);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toEqual([
      { pessoaId: "p2", tipo: "saida_sem_entrada", evento: eventos[2] },
    ]);
  });

  it("ignora eventos fora do período informado", () => {
    const eventos = [evento({ id: "e1", papelLeitor: "saida", timestamp: new Date("2026-09-19T08:00:00Z") })];

    const resultado = detectarEventosNaoPareados(eventos, periodo);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });

  it("ignora eventos sem pessoa correlacionada", () => {
    const eventos = [evento({ pessoaId: undefined, papelLeitor: "saida" })];
    const resultado = detectarEventosNaoPareados(eventos, periodo);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });
});
