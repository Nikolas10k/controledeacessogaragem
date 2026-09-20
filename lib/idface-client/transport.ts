/**
 * Transporte HTTP injetável — o cliente do iDFace nunca chama `fetch`
 * diretamente, para que login/CRUD/retry sejam testáveis sem rede e sem um
 * dispositivo real.
 */

export interface RespostaHttp {
  status: number;
  corpo: unknown;
}

export interface TransporteHttp {
  postJson(url: string, corpo: unknown): Promise<RespostaHttp>;
  postBinario(url: string, corpo: Uint8Array, contentType: string): Promise<RespostaHttp>;
}
