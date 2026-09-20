/**
 * Registro manual de ocorrência feito pela portaria — a fonte de verdade
 * sobre o comportamento físico da haste da cancela (requisito do spec,
 * já que os logs só registram autorizações). Cruzado com os indicadores
 * inferidos no relatório mensal (ver relatorio-mensal.ts).
 */

import type { CancelaId } from "../domain/types.js";

export type TipoOcorrenciaManual =
  | "nao_abriu"
  | "nao_desceu"
  | "desceu_sobre_veiculo"
  | "abertura_espontanea";

export interface OcorrenciaManual {
  id: string;
  cancelaId: CancelaId;
  tipo: TipoOcorrenciaManual;
  /** Automática — momento do registro, não editável pelo usuário da portaria. */
  registradoEm: Date;
  registradoPorUsuarioId: string;
  placa?: string;
  observacao?: string;
  anexoFotoUrl?: string;
}

export type EntradaOcorrenciaManual = Omit<OcorrenciaManual, "id" | "registradoEm">;

export class ErroValidacaoOcorrencia extends Error {}

const TIPOS_VALIDOS: readonly TipoOcorrenciaManual[] = [
  "nao_abriu",
  "nao_desceu",
  "desceu_sobre_veiculo",
  "abertura_espontanea",
];

/**
 * Valida os campos obrigatórios de uma ocorrência antes de persistir.
 * Não atribui `id`/`registradoEm` — isso é responsabilidade da camada de
 * persistência (banco), para manter esta validação pura e testável.
 */
export function validarEntradaOcorrenciaManual(
  entrada: EntradaOcorrenciaManual,
): EntradaOcorrenciaManual {
  if (!TIPOS_VALIDOS.includes(entrada.tipo)) {
    throw new ErroValidacaoOcorrencia(`Tipo de ocorrência inválido: ${entrada.tipo}`);
  }
  if (entrada.cancelaId !== "A" && entrada.cancelaId !== "B") {
    throw new ErroValidacaoOcorrencia(`Cancela inválida: ${entrada.cancelaId}`);
  }
  if (!entrada.registradoPorUsuarioId) {
    throw new ErroValidacaoOcorrencia("Ocorrência precisa do usuário da portaria que registrou");
  }
  return entrada;
}
