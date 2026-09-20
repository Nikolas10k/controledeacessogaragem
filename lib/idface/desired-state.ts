/**
 * Objetos de "estado desejado" do iDFace — o resultado da camada de
 * tradução (negócio -> iDFace).
 *
 * Deliberadamente NÃO é o formato de payload wire (create_objects.fcgi):
 * essa conversão final (nomes -> ids reais no dispositivo, campos exatos
 * por versão de firmware) é responsabilidade do AGENTE (fora deste
 * entregável), que compara este estado desejado com o estado atual do
 * dispositivo e decide o que criar/alterar/remover, em lote.
 *
 * Manter esse limite explícito é o que torna a tradução testável sem rede.
 */

import type { CancelaId } from "../domain/types.js";

export interface EstadoDesejadoUsuario {
  /** Id da pessoa no cadastro — usado para correlacionar com o dispositivo. */
  pessoaId: string;
  nome: string;
  /** Identificador estável (ex.: CPF) usado como matrícula no dispositivo. */
  matricula: string;
  ativo: boolean;
  grupos: string[];
}

export interface EstadoDesejadoGrupo {
  nome: string;
  descricao: string;
}

/** Portal do leitor de entrada é a cancela; leitor de saída não distingue portal. */
export type PortalAlvo = CancelaId | "SAIDA";

export interface EstadoDesejadoRegraAcesso {
  nome: string;
  grupoNome: string;
  leitorId: string;
  portalAlvo: PortalAlvo;
  horarioNome: string;
}

export interface PlanoProvisionamento {
  usuario: EstadoDesejadoUsuario;
  grupos: EstadoDesejadoGrupo[];
  regrasAcesso: EstadoDesejadoRegraAcesso[];
  /** Presente quando a pessoa não consentiu com biometria (LGPD): documenta
   * que o acesso não pode ser bloqueado e que deve ser provido meio
   * alternativo (cartão/TAG) em vez de template facial. */
  motivoSemBiometria?: string;
}
