/**
 * Modelo de domínio do sistema de controle de acesso veicular.
 *
 * Estes tipos representam o cadastro (fonte da verdade) — independentes de
 * como são persistidos (ver prisma/schema.prisma) e independentes do
 * formato de objetos do iDFace (ver lib/idface/desired-state.ts).
 */

/** As duas cancelas físicas na entrada única da garagem. */
export type CancelaId = "A" | "B";

export interface Subsolo {
  id: string;
  /** "1", "2", "3" */
  codigo: string;
  nome: string;
  /** Cancela que atende este subsolo — dado de configuração, não regra fixa no código. */
  cancelaId: CancelaId;
}

export type TipoVinculo =
  | "condomino"
  | "funcionario"
  | "prestador_fixo"
  | "visitante_temporario";

export type StatusPessoa = "ativo" | "bloqueado" | "inativo";

export interface Empresa {
  id: string;
  nome: string;
  sala: string;
}

export interface Pessoa {
  id: string;
  nome: string;
  cpf: string;
  telefone?: string;
  email?: string;
  empresaId: string;
  tipoVinculo: TipoVinculo;
  status: StatusPessoa;
  validadeInicio: Date;
  /** Ausente = vínculo por prazo indeterminado (condômino, funcionário fixo). */
  validadeFim?: Date;
  /** Um ou mais subsolos autorizados — política: união de todas as cancelas correspondentes. */
  subsolosAutorizadosIds: string[];
  /** LGPD: sem consentimento, a pessoa não pode ser impedida de acessar — usa meio alternativo. */
  consentimentoBiometriaAceito: boolean;
}

export interface Veiculo {
  id: string;
  pessoaId: string;
  placa: string;
  modelo?: string;
  cor?: string;
}

export interface Vaga {
  id: string;
  numero: string;
  subsoloId: string;
  empresaId?: string;
  pessoaId?: string;
}

export type PapelLeitor = "entrada" | "saida";

export interface Leitor {
  id: string;
  nome: string;
  papel: PapelLeitor;
  ipAddress: string;
  firmwareVersion?: string;
}
