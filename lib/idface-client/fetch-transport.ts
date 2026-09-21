/**
 * Implementação real do transporte, usando o `fetch` nativo do Node — a
 * única parte deste módulo que efetivamente fala com um leitor na rede.
 * Os testes do cliente usam um transporte falso; este arquivo não é
 * exercitado por eles.
 */

import type { RespostaHttp, TransporteHttp } from "./transport";

async function corpoDaResposta(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

export class TransporteFetch implements TransporteHttp {
  async postJson(url: string, corpo: unknown): Promise<RespostaHttp> {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return { status: resposta.status, corpo: await corpoDaResposta(resposta) };
  }

  async postBinario(url: string, corpo: Uint8Array, contentType: string): Promise<RespostaHttp> {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "content-type": contentType },
      // `Uint8Array` genérico (TS 5.7+) não bate estruturalmente com o
      // `BodyInit` do lib.dom nesta combinação de versões — é o mesmo
      // Uint8Array em runtime, só uma folga do sistema de tipos.
      body: corpo as BodyInit,
    });
    return { status: resposta.status, corpo: await corpoDaResposta(resposta) };
  }
}
