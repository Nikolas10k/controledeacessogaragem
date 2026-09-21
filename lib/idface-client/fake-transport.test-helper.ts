/**
 * Transporte falso para testes — registra as chamadas feitas e responde de
 * acordo com um roteador configurável por caminho (sem query string).
 */

import type { RespostaHttp, TransporteHttp } from "./transport";

export interface ChamadaRegistrada {
  metodo: "postJson" | "postBinario";
  url: string;
  corpo: unknown;
  contentType?: string;
}

type Manipulador = (chamada: ChamadaRegistrada) => RespostaHttp;

export class TransporteFalso implements TransporteHttp {
  readonly chamadas: ChamadaRegistrada[] = [];
  private readonly manipuladores = new Map<string, Manipulador>();

  quando(caminho: string, manipulador: Manipulador): void {
    this.manipuladores.set(caminho, manipulador);
  }

  private caminhoSemQuery(url: string): string {
    return new URL(url).pathname;
  }

  private resolver(chamada: ChamadaRegistrada): RespostaHttp {
    const manipulador = this.manipuladores.get(this.caminhoSemQuery(chamada.url));
    if (!manipulador) {
      throw new Error(`Nenhum manipulador configurado para ${chamada.url}`);
    }
    return manipulador(chamada);
  }

  async postJson(url: string, corpo: unknown): Promise<RespostaHttp> {
    const chamada: ChamadaRegistrada = { metodo: "postJson", url, corpo };
    this.chamadas.push(chamada);
    return this.resolver(chamada);
  }

  async postBinario(url: string, corpo: Uint8Array, contentType: string): Promise<RespostaHttp> {
    const chamada: ChamadaRegistrada = { metodo: "postBinario", url, corpo, contentType };
    this.chamadas.push(chamada);
    return this.resolver(chamada);
  }
}
