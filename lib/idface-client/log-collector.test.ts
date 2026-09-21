import { beforeEach, describe, expect, it } from "vitest";
import { IDFaceClient } from "./client";
import { TransporteFalso } from "./fake-transport.test-helper";
import { ArmazenamentoDeCursorEmMemoria, coletarLogsIncrementais } from "./log-collector";

describe("coletarLogsIncrementais", () => {
  let transporte: TransporteFalso;
  let cliente: IDFaceClient;
  let cursorStore: ArmazenamentoDeCursorEmMemoria;

  beforeEach(() => {
    transporte = new TransporteFalso();
    transporte.quando("/login.fcgi", () => ({ status: 200, corpo: { session: "sess-1" } }));
    cliente = new IDFaceClient({
      baseUrl: "https://192.168.1.10",
      login: "admin",
      senha: "segredo",
      transporte,
    });
    cursorStore = new ArmazenamentoDeCursorEmMemoria();
  });

  it("consulta com id > cursor atual (0 na primeira coleta)", async () => {
    transporte.quando("/load_objects.fcgi", () => ({ status: 200, corpo: { objects: [] } }));
    await coletarLogsIncrementais(cliente, "leitor-1", cursorStore);

    const chamada = transporte.chamadas.find((c) => c.url.includes("load_objects"));
    expect(chamada?.corpo).toEqual({ object: "access_logs", where: { id: [">", 0] } });
  });

  it("avança e persiste o cursor para o maior id coletado", async () => {
    transporte.quando("/load_objects.fcgi", () => ({
      status: 200,
      corpo: { objects: [{ id: 3, time: 100 }, { id: 1, time: 90 }, { id: 2, time: 95 }] },
    }));

    const resultado = await coletarLogsIncrementais(cliente, "leitor-1", cursorStore);

    expect(resultado.logs.map((l) => l.id)).toEqual([1, 2, 3]);
    expect(resultado.ultimoIdColetado).toBe(3);
    expect(await cursorStore.obterUltimoId("leitor-1")).toBe(3);
  });

  it("não avança o cursor quando não há logs novos", async () => {
    await cursorStore.salvarUltimoId("leitor-1", 10);
    transporte.quando("/load_objects.fcgi", () => ({ status: 200, corpo: { objects: [] } }));

    const resultado = await coletarLogsIncrementais(cliente, "leitor-1", cursorStore);

    expect(resultado.logs).toEqual([]);
    expect(resultado.possivelLacuna).toBe(false);
    expect(await cursorStore.obterUltimoId("leitor-1")).toBe(10);
  });

  it("usa cursores independentes por leitor", async () => {
    await cursorStore.salvarUltimoId("leitor-1", 50);
    transporte.quando("/load_objects.fcgi", (chamada) => {
      const corpo = chamada.corpo as { where: { id: [string, number] } };
      expect(corpo.where.id).toEqual([">", 0]);
      return { status: 200, corpo: { objects: [] } };
    });

    await coletarLogsIncrementais(cliente, "leitor-2", cursorStore);
  });

  it("sinaliza possível lacuna quando o primeiro log não é imediatamente posterior ao cursor", async () => {
    await cursorStore.salvarUltimoId("leitor-1", 10);
    transporte.quando("/load_objects.fcgi", () => ({
      status: 200,
      corpo: { objects: [{ id: 15 }, { id: 16 }] },
    }));

    const resultado = await coletarLogsIncrementais(cliente, "leitor-1", cursorStore);
    expect(resultado.possivelLacuna).toBe(true);
  });

  it("não sinaliza lacuna quando a sequência é contígua", async () => {
    await cursorStore.salvarUltimoId("leitor-1", 10);
    transporte.quando("/load_objects.fcgi", () => ({
      status: 200,
      corpo: { objects: [{ id: 11 }, { id: 12 }] },
    }));

    const resultado = await coletarLogsIncrementais(cliente, "leitor-1", cursorStore);
    expect(resultado.possivelLacuna).toBe(false);
  });
});
