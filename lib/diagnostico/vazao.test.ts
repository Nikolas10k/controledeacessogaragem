import { describe, expect, it } from "vitest";
import type { EventoAcesso } from "./types.js";
import { agruparVazaoPorHoraEDiaDaSemana, calcularIntervalosDeVazao } from "./vazao.js";

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

describe("calcularIntervalosDeVazao", () => {
  it("calcula o intervalo em segundos entre autorizações consecutivas na mesma cancela", () => {
    const eventos = [
      evento({ id: "e1", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", timestamp: new Date("2026-09-20T08:00:45Z") }),
      evento({ id: "e3", timestamp: new Date("2026-09-20T08:01:30Z") }),
    ];

    const intervalos = calcularIntervalosDeVazao(eventos, "A");
    expect(intervalos.map((i) => i.segundos)).toEqual([45, 45]);
  });

  it("ignora eventos de outra cancela", () => {
    const eventos = [
      evento({ id: "e1", cancelaId: "A", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", cancelaId: "B", timestamp: new Date("2026-09-20T08:00:10Z") }),
      evento({ id: "e3", cancelaId: "A", timestamp: new Date("2026-09-20T08:00:20Z") }),
    ];

    const intervalos = calcularIntervalosDeVazao(eventos, "A");
    expect(intervalos).toHaveLength(1);
    expect(intervalos[0]?.segundos).toBe(20);
  });

  it("ignora eventos do leitor de saída (não tem cancela própria)", () => {
    const eventos = [
      evento({ id: "e1", papelLeitor: "saida", cancelaId: undefined }),
      evento({ id: "e2", papelLeitor: "saida", cancelaId: undefined }),
    ];

    expect(calcularIntervalosDeVazao(eventos, "A")).toHaveLength(0);
  });

  it("ignora eventos apenas 'efetivado' (usa somente autorizações)", () => {
    const eventos = [
      evento({ id: "e1", tipo: "autorizado", timestamp: new Date("2026-09-20T08:00:00Z") }),
      evento({ id: "e2", tipo: "efetivado", timestamp: new Date("2026-09-20T08:00:05Z") }),
      evento({ id: "e3", tipo: "autorizado", timestamp: new Date("2026-09-20T08:00:30Z") }),
    ];

    const intervalos = calcularIntervalosDeVazao(eventos, "A");
    expect(intervalos).toHaveLength(1);
    expect(intervalos[0]?.segundos).toBe(30);
  });

  it("retorna vazio com 0 ou 1 evento", () => {
    expect(calcularIntervalosDeVazao([], "A")).toHaveLength(0);
    expect(calcularIntervalosDeVazao([evento()], "A")).toHaveLength(0);
  });
});

describe("agruparVazaoPorHoraEDiaDaSemana", () => {
  it("agrupa por dia da semana e hora, calculando a mediana", () => {
    const eventos = [
      evento({ id: "e1", timestamp: new Date("2026-09-21T08:00:00Z") }), // segunda
      evento({ id: "e2", timestamp: new Date("2026-09-21T08:00:20Z") }), // +20s
      evento({ id: "e3", timestamp: new Date("2026-09-21T08:00:40Z") }), // +20s
      evento({ id: "e4", timestamp: new Date("2026-09-21T08:02:40Z") }), // +120s
    ];

    const intervalos = calcularIntervalosDeVazao(eventos, "A");
    const estatisticas = agruparVazaoPorHoraEDiaDaSemana(intervalos);

    expect(estatisticas).toHaveLength(1);
    expect(estatisticas[0]?.amostras).toBe(3);
    expect(estatisticas[0]?.medianaSegundos).toBe(20);
    expect(estatisticas[0]?.hora).toBe(8);
    expect(estatisticas[0]?.diaDaSemana).toBe(1); // segunda-feira
  });

  it("separa grupos por hora distinta mesmo no mesmo dia", () => {
    const eventos = [
      evento({ id: "e1", timestamp: new Date("2026-09-21T08:00:00Z") }),
      evento({ id: "e2", timestamp: new Date("2026-09-21T08:00:30Z") }),
      evento({ id: "e3", timestamp: new Date("2026-09-21T09:00:00Z") }),
      evento({ id: "e4", timestamp: new Date("2026-09-21T09:01:00Z") }),
    ];

    const intervalos = calcularIntervalosDeVazao(eventos, "A");
    const estatisticas = agruparVazaoPorHoraEDiaDaSemana(intervalos);

    expect(estatisticas.map((e) => e.hora)).toEqual([8, 9]);
  });
});
