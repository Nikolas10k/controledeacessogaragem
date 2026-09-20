import { describe, expect, it } from "vitest";
import { detectarCarona } from "./carona.js";

describe("detectarCarona", () => {
  it("declara-se indisponível e explica a limitação de dados", () => {
    const resultado = detectarCarona();
    expect(resultado.disponivel).toBe(false);
    expect(resultado.motivoIndisponivel).toMatch(/contagem de ocupação/);
  });
});
