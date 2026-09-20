/**
 * Carona: entrada sem autorização correspondente, detectada pela
 * divergência entre ocupação contada e autorizações emitidas (requisito do
 * spec).
 *
 * NÃO IMPLEMENTADO DE PROPÓSITO: calcular esse indicador exige uma fonte de
 * contagem de ocupação independente das autorizações do iDFace (ex.: sensor
 * de contagem dedicado, câmera de contagem de veículos). A infraestrutura
 * física descrita no spec do produto só prevê laço indutivo e fotocélula
 * por cancela — sinais de responsabilidade da própria cancela, fora do
 * escopo do software (ver seção "PAPEL DO SISTEMA" do spec) — e nenhum
 * sensor de ocupação independente. Sem essa fonte de dados, qualquer
 * "detecção de carona" calculada a partir dos logs de autorização seria
 * inventada, não inferida.
 *
 * O roadmap do produto prevê entrada de sinal seco do laço/fotocélula via
 * módulo de I/O — quando essa fonte existir, este arquivo passa a ter uma
 * implementação real. Até lá, esta função existe para que a interface
 * sempre passe por aqui (e mostre a limitação) em vez de simplesmente
 * omitir o indicador.
 */

export interface ResultadoCarona {
  disponivel: false;
  motivoIndisponivel: string;
}

export function detectarCarona(): ResultadoCarona {
  return {
    disponivel: false,
    motivoIndisponivel:
      "Requer uma fonte de contagem de ocupação independente das autorizações do iDFace " +
      "(ex.: sensor de contagem dedicado, câmera de contagem de veículos), que não existe " +
      "na infraestrutura atual — laço indutivo e fotocélula são de responsabilidade da " +
      "cancela, fora do escopo do software. Ver roadmap: módulo de I/O para sinal seco do " +
      "laço/fotocélula.",
  };
}
