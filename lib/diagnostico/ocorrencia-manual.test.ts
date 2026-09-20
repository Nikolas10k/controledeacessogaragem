import { describe, expect, it } from "vitest";
import {
  ErroValidacaoOcorrencia,
  validarEntradaOcorrenciaManual,
  type EntradaOcorrenciaManual,
} from "./ocorrencia-manual.js";

function entradaBase(overrides: Partial<EntradaOcorrenciaManual> = {}): EntradaOcorrenciaManual {
  return {
    cancelaId: "A",
    tipo: "nao_abriu",
    registradoPorUsuarioId: "porteiro-1",
    ...overrides,
  };
}

describe("validarEntradaOcorrenciaManual", () => {
  it("aceita uma entrada válida com os campos mínimos", () => {
    expect(() => validarEntradaOcorrenciaManual(entradaBase())).not.toThrow();
  });

  it("aceita os quatro tipos previstos no spec", () => {
    for (const tipo of ["nao_abriu", "nao_desceu", "desceu_sobre_veiculo", "abertura_espontanea"] as const) {
      expect(() => validarEntradaOcorrenciaManual(entradaBase({ tipo }))).not.toThrow();
    }
  });

  it("rejeita tipo inválido", () => {
    // @ts-expect-error testando entrada inválida em runtime
    expect(() => validarEntradaOcorrenciaManual(entradaBase({ tipo: "tipo_invalido" }))).toThrow(
      ErroValidacaoOcorrencia,
    );
  });

  it("rejeita cancela inválida", () => {
    // @ts-expect-error testando entrada inválida em runtime
    expect(() => validarEntradaOcorrenciaManual(entradaBase({ cancelaId: "C" }))).toThrow(
      ErroValidacaoOcorrencia,
    );
  });

  it("rejeita ausência do usuário que registrou", () => {
    expect(() =>
      validarEntradaOcorrenciaManual(entradaBase({ registradoPorUsuarioId: "" })),
    ).toThrow(ErroValidacaoOcorrencia);
  });

  it("aceita placa, observação e anexo opcionais", () => {
    const entrada = entradaBase({
      placa: "ABC1D23",
      observacao: "carro ficou preso",
      anexoFotoUrl: "https://storage.local/ocorrencia-1.jpg",
    });
    expect(() => validarEntradaOcorrenciaManual(entrada)).not.toThrow();
  });
});
