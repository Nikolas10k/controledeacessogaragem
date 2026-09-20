import { describe, expect, it } from "vitest";
import type { EventoAcesso } from "./types.js";
import { detectarReapresentacoes } from "./reapresentacao.js";

function evento(overrides: Partial<EventoAcesso> = {}): EventoAcesso {
  return {
    id: "e1",
    pessoaId: "p1",
    cancelaId: "A",
    papelLeitor: "entrada",
    timestamp: new Date("2026-09-20T08:00:00Z"),
    tipo: "autorizado",
    ...overrides,
  };
}

describe("detectarReapresentacoes", () => {
  it("sinaliza quando o mesmo rosto é reconhecido de novo na mesma cancela em menos de 60s", () => {
    const eventos = [
      evento({ id: "e1", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", timestamp: new Date("2026-09-20T08:00:30Z") }),
    ];

    const resultado = detectarReapresentacoes(eventos);

    expect(resultado.disponivel).toBe(true);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.tipo).toBe("inferido");
    expect(resultado.ocorrencias).toHaveLength(1);
    expect(resultado.ocorrencias[0]).toMatchObject({ pessoaId: "p1", intervaloSegundos: 30 });
  });

  it("não sinaliza quando o intervalo é maior que a janela", () => {
    const eventos = [
      evento({ id: "e1", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", timestamp: new Date("2026-09-20T08:02:00Z") }),
    ];

    const resultado = detectarReapresentacoes(eventos);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });

  it("não cruza pessoas diferentes", () => {
    const eventos = [
      evento({ id: "e1", pessoaId: "p1", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", pessoaId: "p2", timestamp: new Date("2026-09-20T08:00:10Z") }),
    ];

    const resultado = detectarReapresentacoes(eventos);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });

  it("não cruza cancelas diferentes para a mesma pessoa", () => {
    const eventos = [
      evento({ id: "e1", cancelaId: "A", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", cancelaId: "B", timestamp: new Date("2026-09-20T08:00:10Z") }),
    ];

    const resultado = detectarReapresentacoes(eventos);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });

  it("ignora eventos sem pessoa correlacionada", () => {
    const eventos = [
      evento({ id: "e1", pessoaId: undefined, timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", pessoaId: undefined, timestamp: new Date("2026-09-20T08:00:05Z") }),
    ];

    const resultado = detectarReapresentacoes(eventos);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });

  it("detecta múltiplas reapresentações em sequência (3 eventos próximos geram 2 ocorrências)", () => {
    const eventos = [
      evento({ id: "e1", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", timestamp: new Date("2026-09-20T08:00:20Z") }),
      evento({ id: "e3", timestamp: new Date("2026-09-20T08:00:40Z") }),
    ];

    const resultado = detectarReapresentacoes(eventos);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(2);
  });

  it("respeita janela customizada", () => {
    const eventos = [
      evento({ id: "e1", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", timestamp: new Date("2026-09-20T08:01:30Z") }),
    ];

    const resultado = detectarReapresentacoes(eventos, 120);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(1);
  });
});
