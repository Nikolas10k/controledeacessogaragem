import { describe, expect, it } from "vitest";
import { FilaSincronizacaoEmMemoria, calcularBackoffMs } from "./queue";

describe("calcularBackoffMs", () => {
  it("cresce exponencialmente a partir da base", () => {
    expect(calcularBackoffMs(1, { baseMs: 1000, fatorMultiplicador: 2 })).toBe(1000);
    expect(calcularBackoffMs(2, { baseMs: 1000, fatorMultiplicador: 2 })).toBe(2000);
    expect(calcularBackoffMs(3, { baseMs: 1000, fatorMultiplicador: 2 })).toBe(4000);
    expect(calcularBackoffMs(4, { baseMs: 1000, fatorMultiplicador: 2 })).toBe(8000);
  });

  it("respeita o teto máximo configurado", () => {
    expect(calcularBackoffMs(10, { baseMs: 1000, fatorMultiplicador: 2, maximoMs: 5000 })).toBe(5000);
  });

  it("usa os padrões quando nenhuma opção é informada", () => {
    expect(calcularBackoffMs(1)).toBe(1000);
    expect(calcularBackoffMs(2)).toBe(2000);
  });

  it("rejeita tentativa menor que 1", () => {
    expect(() => calcularBackoffMs(0)).toThrow(RangeError);
  });
});

describe("FilaSincronizacaoEmMemoria", () => {
  it("um job recém-enfileirado está pronto imediatamente", async () => {
    const fila = new FilaSincronizacaoEmMemoria();
    await fila.enfileirar({ leitorId: "leitor-1", tipo: "provisionar_usuario", payload: { id: 1 } });

    const prontos = await fila.prontosParaProcessar(0);
    expect(prontos).toHaveLength(1);
    expect(prontos[0]?.status).toBe("pendente");
    expect(prontos[0]?.tentativas).toBe(0);
  });

  it("marcarConcluido remove o job da lista de prontos", async () => {
    const fila = new FilaSincronizacaoEmMemoria();
    const job = await fila.enfileirar({ leitorId: "leitor-1", tipo: "x", payload: {} });

    await fila.marcarConcluido(job.id);

    expect(await fila.prontosParaProcessar(0)).toHaveLength(0);
    expect(fila.obter(job.id)?.status).toBe("concluido");
  });

  it("marcarFalha agenda a próxima tentativa com backoff e não fica pronto antes disso", async () => {
    const fila = new FilaSincronizacaoEmMemoria();
    const job = await fila.enfileirar({ leitorId: "leitor-1", tipo: "x", payload: {} });

    await fila.marcarFalha(job.id, "leitor offline", 0, { baseMs: 1000, fatorMultiplicador: 2 });

    expect(await fila.prontosParaProcessar(500)).toHaveLength(0);
    expect(await fila.prontosParaProcessar(1000)).toHaveLength(1);

    const atualizado = fila.obter(job.id);
    expect(atualizado?.tentativas).toBe(1);
    expect(atualizado?.ultimoErro).toBe("leitor offline");
    expect(atualizado?.status).toBe("pendente");
  });

  it("cada falha sucessiva aumenta o backoff", async () => {
    const fila = new FilaSincronizacaoEmMemoria();
    const job = await fila.enfileirar({ leitorId: "leitor-1", tipo: "x", payload: {} });
    const opcoes = { baseMs: 1000, fatorMultiplicador: 2 };

    await fila.marcarFalha(job.id, "erro 1", 0, opcoes);
    expect(fila.obter(job.id)?.proximaTentativaEm).toBe(1000);

    await fila.marcarFalha(job.id, "erro 2", 1000, opcoes);
    expect(fila.obter(job.id)?.proximaTentativaEm).toBe(1000 + 2000);
  });

  it("prontosParaProcessar retorna em ordem de próxima tentativa", async () => {
    const fila = new FilaSincronizacaoEmMemoria();
    const jobA = await fila.enfileirar({ leitorId: "leitor-1", tipo: "a", payload: {} });
    const jobB = await fila.enfileirar({ leitorId: "leitor-1", tipo: "b", payload: {} });

    await fila.marcarFalha(jobA.id, "erro", 0, { baseMs: 5000 });
    await fila.marcarFalha(jobB.id, "erro", 0, { baseMs: 1000 });

    const prontos = await fila.prontosParaProcessar(10_000);
    expect(prontos.map((j) => j.id)).toEqual([jobB.id, jobA.id]);
  });
});
