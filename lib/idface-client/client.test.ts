import { beforeEach, describe, expect, it } from "vitest";
import { ErroAutenticacaoIDFace, ErroIDFace, IDFaceClient } from "./client.js";
import { TransporteFalso } from "./fake-transport.test-helper.js";

function criarCliente(transporte: TransporteFalso, agora?: () => number) {
  return new IDFaceClient({
    baseUrl: "https://192.168.1.10",
    login: "admin",
    senha: "segredo",
    transporte,
    agora,
  });
}

describe("IDFaceClient — autenticação", () => {
  let transporte: TransporteFalso;

  beforeEach(() => {
    transporte = new TransporteFalso();
    transporte.quando("/login.fcgi", () => ({ status: 200, corpo: { session: "sess-1" } }));
  });

  it("faz login em /login.fcgi com login e password", async () => {
    const cliente = criarCliente(transporte);
    await cliente.autenticar();

    expect(transporte.chamadas).toHaveLength(1);
    expect(transporte.chamadas[0]?.url).toBe("https://192.168.1.10/login.fcgi");
    expect(transporte.chamadas[0]?.corpo).toEqual({ login: "admin", password: "segredo" });
  });

  it("lança ErroAutenticacaoIDFace quando o login falha", async () => {
    transporte.quando("/login.fcgi", () => ({ status: 401, corpo: { error: "bad credentials" } }));
    const cliente = criarCliente(transporte);
    await expect(cliente.autenticar()).rejects.toThrow(ErroAutenticacaoIDFace);
  });

  it("lança ErroAutenticacaoIDFace quando a resposta não tem campo 'session'", async () => {
    transporte.quando("/login.fcgi", () => ({ status: 200, corpo: {} }));
    const cliente = criarCliente(transporte);
    await expect(cliente.autenticar()).rejects.toThrow(ErroAutenticacaoIDFace);
  });

  it("renova a sessão automaticamente antes de expirar (dentro da margem)", async () => {
    let agoraMs = 0;
    const cliente = criarCliente(transporte, () => agoraMs);
    transporte.quando("/create_objects.fcgi", () => ({ status: 200, corpo: { ids: [1] } }));

    await cliente.criarObjetos("users", [{ name: "a" }]);
    expect(transporte.chamadas.filter((c) => c.url.includes("login.fcgi"))).toHaveLength(1);

    // avança para dentro da margem de renovação (60s) antes do TTL de 3600s
    agoraMs = (3600 - 30) * 1000;
    await cliente.criarObjetos("users", [{ name: "b" }]);
    expect(transporte.chamadas.filter((c) => c.url.includes("login.fcgi"))).toHaveLength(2);
  });

  it("renova a sessão e tenta novamente uma vez quando o dispositivo responde 401", async () => {
    let sessoesEmitidas = 0;
    transporte.quando("/login.fcgi", () => {
      sessoesEmitidas += 1;
      return { status: 200, corpo: { session: `sess-${sessoesEmitidas}` } };
    });

    let primeiraChamada = true;
    transporte.quando("/create_objects.fcgi", (chamada) => {
      const sessaoUsada = new URL(chamada.url).searchParams.get("session");
      if (primeiraChamada) {
        primeiraChamada = false;
        expect(sessaoUsada).toBe("sess-1");
        return { status: 401, corpo: { error: "expired" } };
      }
      expect(sessaoUsada).toBe("sess-2");
      return { status: 200, corpo: { ids: [1] } };
    });

    const cliente = criarCliente(transporte);
    const resultado = await cliente.criarObjetos("users", [{ name: "a" }]);

    expect(resultado.ids).toEqual([1]);
    expect(sessoesEmitidas).toBe(2);
  });
});

describe("IDFaceClient — CRUD em lote", () => {
  let transporte: TransporteFalso;
  let cliente: IDFaceClient;

  beforeEach(() => {
    transporte = new TransporteFalso();
    transporte.quando("/login.fcgi", () => ({ status: 200, corpo: { session: "sess-1" } }));
    cliente = criarCliente(transporte);
  });

  it("criarObjetos envia todos os valores em uma única requisição", async () => {
    transporte.quando("/create_objects.fcgi", () => ({ status: 200, corpo: { ids: [1, 2, 3] } }));

    const resultado = await cliente.criarObjetos("users", [
      { name: "a" },
      { name: "b" },
      { name: "c" },
    ]);

    const chamadasDeCreate = transporte.chamadas.filter((c) => c.url.includes("create_objects"));
    expect(chamadasDeCreate).toHaveLength(1);
    expect(chamadasDeCreate[0]?.corpo).toEqual({
      object: "users",
      values: [{ name: "a" }, { name: "b" }, { name: "c" }],
    });
    expect(resultado.ids).toEqual([1, 2, 3]);
  });

  it("criarObjetos com lista vazia não faz nenhuma requisição", async () => {
    const resultado = await cliente.criarObjetos("users", []);
    expect(resultado).toEqual({ ids: [] });
    expect(transporte.chamadas.filter((c) => c.url.includes("create_objects"))).toHaveLength(0);
  });

  it("modificarObjetos envia object, where e values", async () => {
    transporte.quando("/modify_objects.fcgi", () => ({ status: 200, corpo: {} }));
    await cliente.modificarObjetos("users", { id: 42 }, { name: "novo nome" });

    const chamada = transporte.chamadas.find((c) => c.url.includes("modify_objects"));
    expect(chamada?.corpo).toEqual({ object: "users", where: { id: 42 }, values: { name: "novo nome" } });
  });

  it("destruirObjetos envia object e where", async () => {
    transporte.quando("/destroy_objects.fcgi", () => ({ status: 200, corpo: {} }));
    await cliente.destruirObjetos("users", { id: 42 });

    const chamada = transporte.chamadas.find((c) => c.url.includes("destroy_objects"));
    expect(chamada?.corpo).toEqual({ object: "users", where: { id: 42 } });
  });

  it("carregarObjetos omite where quando não informado", async () => {
    transporte.quando("/load_objects.fcgi", () => ({ status: 200, corpo: { objects: [] } }));
    await cliente.carregarObjetos("access_logs");

    const chamada = transporte.chamadas.find((c) => c.url.includes("load_objects"));
    expect(chamada?.corpo).toEqual({ object: "access_logs" });
  });

  it("carregarObjetos inclui where quando informado", async () => {
    transporte.quando("/load_objects.fcgi", () => ({ status: 200, corpo: { objects: [{ id: 5 }] } }));
    const resultado = await cliente.carregarObjetos("access_logs", { id: [">", 4] });

    const chamada = transporte.chamadas.find((c) => c.url.includes("load_objects"));
    expect(chamada?.corpo).toEqual({ object: "access_logs", where: { id: [">", 4] } });
    expect(resultado.objects).toEqual([{ id: 5 }]);
  });

  it("lança ErroIDFace quando uma operação retorna status diferente de 200", async () => {
    transporte.quando("/destroy_objects.fcgi", () => ({ status: 500, corpo: { error: "boom" } }));
    await expect(cliente.destruirObjetos("users", { id: 1 })).rejects.toThrow(ErroIDFace);
  });
});

describe("IDFaceClient — sincronização de template", () => {
  it("envolve a operação entre template_sync_init e template_sync_end", async () => {
    const transporte = new TransporteFalso();
    transporte.quando("/login.fcgi", () => ({ status: 200, corpo: { session: "sess-1" } }));
    transporte.quando("/template_sync_init.fcgi", () => ({ status: 200, corpo: {} }));
    transporte.quando("/template_sync_end.fcgi", () => ({ status: 200, corpo: {} }));
    transporte.quando("/create_objects.fcgi", () => ({ status: 200, corpo: { ids: [1] } }));

    const cliente = criarCliente(transporte);
    const ordem: string[] = [];

    await cliente.comSincronizacaoDeTemplate(async () => {
      ordem.push("init-foi-chamado-antes");
      await cliente.criarObjetos("face_templates", [{ user_id: 1, template: "..." }]);
      ordem.push("operacao-concluida");
    });

    const rotas = transporte.chamadas.map((c) => new URL(c.url).pathname);
    expect(rotas).toEqual([
      "/login.fcgi",
      "/template_sync_init.fcgi",
      "/create_objects.fcgi",
      "/template_sync_end.fcgi",
    ]);
    expect(ordem).toEqual(["init-foi-chamado-antes", "operacao-concluida"]);
  });

  it("chama template_sync_end mesmo se a operação lançar erro", async () => {
    const transporte = new TransporteFalso();
    transporte.quando("/login.fcgi", () => ({ status: 200, corpo: { session: "sess-1" } }));
    transporte.quando("/template_sync_init.fcgi", () => ({ status: 200, corpo: {} }));
    transporte.quando("/template_sync_end.fcgi", () => ({ status: 200, corpo: {} }));

    const cliente = criarCliente(transporte);

    await expect(
      cliente.comSincronizacaoDeTemplate(async () => {
        throw new Error("falha ao processar biometria");
      }),
    ).rejects.toThrow("falha ao processar biometria");

    const rotas = transporte.chamadas.map((c) => new URL(c.url).pathname);
    expect(rotas).toEqual(["/login.fcgi", "/template_sync_init.fcgi", "/template_sync_end.fcgi"]);
  });
});

describe("IDFaceClient — foto, relógio e firmware", () => {
  let transporte: TransporteFalso;
  let cliente: IDFaceClient;

  beforeEach(() => {
    transporte = new TransporteFalso();
    transporte.quando("/login.fcgi", () => ({ status: 200, corpo: { session: "sess-1" } }));
    cliente = criarCliente(transporte);
  });

  it("envia a foto como binário puro, não como JSON", async () => {
    transporte.quando("/user_set_image.fcgi", () => ({ status: 200, corpo: {} }));
    const imagem = new Uint8Array([0xff, 0xd8, 0xff]);

    await cliente.enviarFotoUsuario(7, imagem, "image/jpeg");

    const chamada = transporte.chamadas.find((c) => c.url.includes("user_set_image"));
    expect(chamada?.metodo).toBe("postBinario");
    expect(chamada?.contentType).toBe("image/jpeg");
    expect(chamada?.corpo).toBe(imagem);
    expect(chamada?.url).toContain("user_id=7");
  });

  it("sincronizarRelogio envia o horário em epoch segundos", async () => {
    transporte.quando("/set_system_time.fcgi", () => ({ status: 200, corpo: {} }));
    await cliente.sincronizarRelogio(new Date("2026-01-01T00:00:00Z"));

    const chamada = transporte.chamadas.find((c) => c.url.includes("set_system_time"));
    expect(chamada?.corpo).toEqual({ time: 1_767_225_600 });
  });

  it("informacoesDoSistema retorna o corpo da resposta", async () => {
    transporte.quando("/system_information.fcgi", () => ({
      status: 200,
      corpo: { device_model: "iDFace", firmware_version: "3.4.1" },
    }));
    const info = await cliente.informacoesDoSistema();
    expect(info.firmware_version).toBe("3.4.1");
  });
});
