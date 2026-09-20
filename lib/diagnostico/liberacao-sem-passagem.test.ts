import { describe, expect, it } from "vitest";
import type { EventoAcesso } from "./types.js";
import { detectarLiberacoesSemPassagem } from "./liberacao-sem-passagem.js";

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

describe("detectarLiberacoesSemPassagem", () => {
  it("fica indisponível e explica o motivo quando o firmware não distingue autorizado de efetivado", () => {
    const resultado = detectarLiberacoesSemPassagem([evento()], { firmwareDistingueTipos: false });

    expect(resultado.disponivel).toBe(false);
    if (resultado.disponivel) throw new Error("esperado indisponível");
    expect(resultado.motivoIndisponivel).toMatch(/não distingue/);
  });

  it("sinaliza autorização sem efetivação correspondente", () => {
    const eventos = [evento({ id: "e1", tipo: "autorizado" })];

    const resultado = detectarLiberacoesSemPassagem(eventos, { firmwareDistingueTipos: true });

    expect(resultado.disponivel).toBe(true);
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.tipo).toBe("inferido");
    expect(resultado.ocorrencias).toHaveLength(1);
    expect(resultado.ocorrencias[0]?.pessoaId).toBe("p1");
  });

  it("não sinaliza quando existe efetivação dentro da janela", () => {
    const eventos = [
      evento({ id: "e1", tipo: "autorizado", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", tipo: "efetivado", timestamp: new Date("2026-09-20T08:00:10Z") }),
    ];

    const resultado = detectarLiberacoesSemPassagem(eventos, { firmwareDistingueTipos: true });
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });

  it("sinaliza quando a efetivação está fora da janela configurada", () => {
    const eventos = [
      evento({ id: "e1", tipo: "autorizado", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", tipo: "efetivado", timestamp: new Date("2026-09-20T08:05:00Z") }),
    ];

    const resultado = detectarLiberacoesSemPassagem(eventos, {
      firmwareDistingueTipos: true,
      janelaSegundos: 60,
    });
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(1);
  });

  it("não confunde efetivação de outra pessoa ou outra cancela", () => {
    const eventos = [
      evento({ id: "e1", pessoaId: "p1", cancelaId: "A", tipo: "autorizado" }),
      evento({
        id: "e2",
        pessoaId: "p2",
        cancelaId: "A",
        tipo: "efetivado",
        timestamp: new Date("2026-09-20T08:00:05Z"),
      }),
      evento({
        id: "e3",
        pessoaId: "p1",
        cancelaId: "B",
        tipo: "efetivado",
        timestamp: new Date("2026-09-20T08:00:05Z"),
      }),
    ];

    const resultado = detectarLiberacoesSemPassagem(eventos, { firmwareDistingueTipos: true });
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(1);
    expect(resultado.ocorrencias[0]?.pessoaId).toBe("p1");
  });

  it("ignora eventos sem pessoa correlacionada", () => {
    const eventos = [evento({ pessoaId: undefined })];
    const resultado = detectarLiberacoesSemPassagem(eventos, { firmwareDistingueTipos: true });
    if (!resultado.disponivel) throw new Error("esperado disponível");
    expect(resultado.ocorrencias).toHaveLength(0);
  });
});
