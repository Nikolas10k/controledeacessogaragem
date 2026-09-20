/**
 * Detecção de versão de firmware e degradação graciosa — campos e tabelas
 * variam entre versões do iDFace (requisito explícito do spec).
 *
 * IMPORTANTE — limitação: os limiares de versão abaixo são um placeholder
 * estrutural, não foram validados contra a documentação oficial (o domínio
 * controlid.com.br estava inacessível ao construir este módulo) nem contra
 * um dispositivo real. O objetivo desta função é concentrar esse
 * conhecimento em um único lugar testável — calibre os limiares reais
 * assim que o parque de leitores e/ou a documentação oficial estiverem
 * acessíveis, sem precisar tocar no restante do agente.
 */

export interface CapacidadesDispositivo {
  versaoFirmware: string;
  /** Firmwares mais antigos podem não expor `face_templates` como objeto próprio. */
  suportaFaceTemplatesSeparado: boolean;
  /** `count_objects.fcgi` é um endpoint mais recente; ausente em versões antigas. */
  suportaContarObjetos: boolean;
}

export function resolverCapacidades(versaoFirmware: string | undefined): CapacidadesDispositivo {
  const versao = versaoFirmware ?? "0.0.0";
  const partes = versao.split(".");
  const maior = Number.parseInt(partes[0] ?? "0", 10) || 0;

  return {
    versaoFirmware: versao,
    suportaFaceTemplatesSeparado: maior >= 3,
    suportaContarObjetos: maior >= 2,
  };
}
