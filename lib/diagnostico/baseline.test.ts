import { describe, expect, it } from "vitest";
import { calcularBaseline, excedeLimiarDeAlerta, type ContagemDiaria } from "./baseline.js";

function serieConstante(valor: number, dias: number, ateExclusive: Date): ContagemDiaria[] {
  const serie: ContagemDiaria[] = [];
  for (let i = 1; i <= dias; i++) {
    const dia = new Date(ateExclusive);
    dia.setUTCDate(dia.getUTCDate() - i);
    serie.push({ dia, contagem: valor });
  }
  return serie;
}

describe("calcularBaseline", () => {
  it("calcula média e desvio padrão a partir dos últimos 30 dias", () => {
    const referencia = new Date("2026-09-20T00:00:00Z");
    const serie = serieConstante(10, 30, referencia);

    const baseline = calcularBaseline(serie, referencia);

    expect(baseline.mediaMovel).toBe(10);
    expect(baseline.desvioPadrao).toBe(0);
    expect(baseline.amostras).toBe(30);
  });

  it("ignora dias fora da janela (mais antigos que janelaDias)", () => {
    const referencia = new Date("2026-09-20T00:00:00Z");
    const dentro = serieConstante(10, 30, referencia);
    const foraDaJanela: ContagemDiaria = { dia: new Date("2026-01-01T00:00:00Z"), contagem: 1000 };

    const baseline = calcularBaseline([...dentro, foraDaJanela], referencia);

    expect(baseline.amostras).toBe(30);
    expect(baseline.mediaMovel).toBe(10);
  });

  it("ignora o próprio dia de referência", () => {
    const referencia = new Date("2026-09-20T00:00:00Z");
    const serie = serieConstante(10, 5, referencia);
    serie.push({ dia: referencia, contagem: 9999 });

    const baseline = calcularBaseline(serie, referencia);

    expect(baseline.amostras).toBe(5);
    expect(baseline.mediaMovel).toBe(10);
  });

  it("retorna zeros quando não há amostras na janela", () => {
    const baseline = calcularBaseline([], new Date("2026-09-20T00:00:00Z"));
    expect(baseline).toEqual({ mediaMovel: 0, desvioPadrao: 0, amostras: 0 });
  });

  it("respeita janela customizada", () => {
    const referencia = new Date("2026-09-20T00:00:00Z");
    const serie = serieConstante(10, 7, referencia);
    const baseline = calcularBaseline(serie, referencia, 7);
    expect(baseline.amostras).toBe(7);
  });
});

describe("excedeLimiarDeAlerta", () => {
  it("não alerta quando a contagem está dentro do desvio configurado", () => {
    const baseline = { mediaMovel: 10, desvioPadrao: 2, amostras: 30 };
    expect(excedeLimiarDeAlerta(13, baseline, 2)).toBe(false); // limiar = 14
  });

  it("alerta quando a contagem excede o limiar", () => {
    const baseline = { mediaMovel: 10, desvioPadrao: 2, amostras: 30 };
    expect(excedeLimiarDeAlerta(15, baseline, 2)).toBe(true); // limiar = 14
  });

  it("nunca alerta quando o desvio padrão é zero e a contagem é igual à média", () => {
    const baseline = { mediaMovel: 10, desvioPadrao: 0, amostras: 30 };
    expect(excedeLimiarDeAlerta(10, baseline)).toBe(false);
  });
});
