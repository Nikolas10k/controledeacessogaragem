/**
 * Formato "de arame" (wire format) da API REST local do iDFace — os
 * endpoints .fcgi descritos no spec do produto.
 *
 * ATENÇÃO — limitação de validação: o domínio oficial
 * (controlid.com.br/docs/access-api-en) estava bloqueado pelo proxy de
 * egresso deste ambiente ao construir este módulo, então os nomes de
 * endpoint e de objeto abaixo foram corroborados por DUAS fontes de
 * terceiros (um emulador de código aberto que reproduz a API e o SDK
 * Python `controlid-sdk`), não pela documentação oficial diretamente.
 * Nomes de objeto e de endpoint têm boa confiança; formatos exatos de
 * campo por tipo de objeto (ex.: quais colunas `users` aceita) NÃO foram
 * confirmados e devem ser validados contra um leitor real antes de uso em
 * produção — ver README.md deste módulo.
 */

export type TipoObjetoIDFace =
  | "users"
  | "cards"
  | "fingerprints"
  | "face_templates"
  | "groups"
  | "access_rules"
  | "time_zones"
  | "time_spans"
  | "portals"
  | "doors"
  | "areas"
  | "devices"
  | "access_logs"
  | "user_groups"
  | "group_access_rules"
  | "user_access_rules"
  | "access_rule_time_zones"
  | "portal_access_rules"
  | "area_access_rules";

/** Cláusula `where` no formato `{ campo: [operador, valor] }` ou `{ campo: valor }`. */
export type ClausulaWhere = Record<string, unknown>;

export interface RespostaLogin {
  session: string;
}

export interface RespostaCreateObjects {
  ids: number[];
}

export interface RespostaLoadObjects<T = Record<string, unknown>> {
  objects: T[];
}

export interface RespostaCountObjects {
  count: number;
}

export interface RespostaSystemInformation {
  device_model?: string;
  firmware_version?: string;
  [chave: string]: unknown;
}
