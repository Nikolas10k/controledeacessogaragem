import { describe, expect, it } from "vitest";
import { resolverCapacidades } from "./firmware";

describe("resolverCapacidades", () => {
  it("trata firmware ausente como o mínimo (sem recursos avançados)", () => {
    const capacidades = resolverCapacidades(undefined);
    expect(capacidades.suportaFaceTemplatesSeparado).toBe(false);
    expect(capacidades.suportaContarObjetos).toBe(false);
  });

  it("degrada graciosamente para firmware 1.x", () => {
    const capacidades = resolverCapacidades("1.9.0");
    expect(capacidades.suportaFaceTemplatesSeparado).toBe(false);
    expect(capacidades.suportaContarObjetos).toBe(false);
  });

  it("habilita count_objects a partir da major 2", () => {
    const capacidades = resolverCapacidades("2.0.0");
    expect(capacidades.suportaContarObjetos).toBe(true);
    expect(capacidades.suportaFaceTemplatesSeparado).toBe(false);
  });

  it("habilita face_templates separado a partir da major 3", () => {
    const capacidades = resolverCapacidades("3.4.1");
    expect(capacidades.suportaFaceTemplatesSeparado).toBe(true);
    expect(capacidades.suportaContarObjetos).toBe(true);
  });
});
