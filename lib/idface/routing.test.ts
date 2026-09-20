import { describe, expect, it } from "vitest";
import type { Subsolo } from "../domain/types.js";
import {
  resolverCancelasParaSubsolos,
  temAcessoAMultiplasCancelas,
} from "./routing.js";

const subsolo1: Subsolo = { id: "s1", codigo: "1", nome: "1º subsolo", cancelaId: "A" };
const subsolo2: Subsolo = { id: "s2", codigo: "2", nome: "2º subsolo", cancelaId: "B" };
const subsolo3: Subsolo = { id: "s3", codigo: "3", nome: "3º subsolo", cancelaId: "B" };

describe("resolverCancelasParaSubsolos", () => {
  it("retorna vazio quando não há subsolos autorizados", () => {
    expect(resolverCancelasParaSubsolos([])).toEqual([]);
  });

  it("resolve a cancela única correspondente a um subsolo", () => {
    expect(resolverCancelasParaSubsolos([subsolo1])).toEqual(["A"]);
    expect(resolverCancelasParaSubsolos([subsolo2])).toEqual(["B"]);
  });

  it("deduplica quando múltiplos subsolos compartilham a mesma cancela", () => {
    expect(resolverCancelasParaSubsolos([subsolo2, subsolo3])).toEqual(["B"]);
  });

  it("retorna a união ordenada quando os subsolos usam cancelas diferentes", () => {
    expect(resolverCancelasParaSubsolos([subsolo3, subsolo1])).toEqual(["A", "B"]);
  });
});

describe("temAcessoAMultiplasCancelas", () => {
  it("é falso para nenhum ou um subsolo", () => {
    expect(temAcessoAMultiplasCancelas([])).toBe(false);
    expect(temAcessoAMultiplasCancelas([subsolo1])).toBe(false);
  });

  it("é falso quando subsolos distintos caem na mesma cancela", () => {
    expect(temAcessoAMultiplasCancelas([subsolo2, subsolo3])).toBe(false);
  });

  it("é verdadeiro quando os subsolos autorizados cobrem as duas cancelas", () => {
    expect(temAcessoAMultiplasCancelas([subsolo1, subsolo2])).toBe(true);
  });
});
