/**
 * Linha de base por média móvel de 30 dias, por cancela. Alerta quando a
 * taxa de anomalia do dia excede o desvio configurado em relação à linha de
 * base (requisito do spec).
 */

export interface ContagemDiaria {
  dia: Date;
  contagem: number;
}

export interface Baseline {
  mediaMovel: number;
  desvioPadrao: number;
  amostras: number;
}

function mediaDe(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

function desvioPadraoDe(valores: number[], media: number): number {
  if (valores.length === 0) return 0;
  const somaDosQuadrados = valores.reduce((soma, v) => soma + (v - media) ** 2, 0);
  return Math.sqrt(somaDosQuadrados / valores.length);
}

/**
 * Calcula a linha de base a partir dos últimos `janelaDias` dias anteriores
 * a `dataReferencia` (exclusive) presentes na série — dias sem registro na
 * série não entram na média (não são tratados como zero).
 */
export function calcularBaseline(
  serie: ContagemDiaria[],
  dataReferencia: Date,
  janelaDias = 30,
): Baseline {
  const inicioDaJanela = new Date(dataReferencia);
  inicioDaJanela.setUTCDate(inicioDaJanela.getUTCDate() - janelaDias);

  const contagensDaJanela = serie
    .filter((p) => p.dia >= inicioDaJanela && p.dia < dataReferencia)
    .map((p) => p.contagem);

  const mediaMovel = mediaDe(contagensDaJanela);
  return {
    mediaMovel,
    desvioPadrao: desvioPadraoDe(contagensDaJanela, mediaMovel),
    amostras: contagensDaJanela.length,
  };
}

/** Verdadeiro quando a contagem do dia excede a linha de base em mais de `desviosParaAlerta` desvios-padrão. */
export function excedeLimiarDeAlerta(
  contagemDoDia: number,
  baseline: Baseline,
  desviosParaAlerta = 2,
): boolean {
  const limiar = baseline.mediaMovel + desviosParaAlerta * baseline.desvioPadrao;
  return contagemDoDia > limiar;
}
