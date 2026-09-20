import { describe, expect, it } from "vitest";
import type { Leitor, Pessoa, Subsolo } from "../domain/types.js";
import {
  ErroDeProvisionamento,
  GRUPO_SAIDA,
  cancelasNoPlano,
  nomeGrupoSubsolo,
  traduzirPessoaParaProvisionamento,
} from "./translation.js";

const subsolo1: Subsolo = { id: "s1", codigo: "1", nome: "1º subsolo", cancelaId: "A" };
const subsolo2: Subsolo = { id: "s2", codigo: "2", nome: "2º subsolo", cancelaId: "B" };
const subsolo3: Subsolo = { id: "s3", codigo: "3", nome: "3º subsolo", cancelaId: "B" };
const todosSubsolos = [subsolo1, subsolo2, subsolo3];

const leitorEntrada: Leitor = {
  id: "leitor-entrada",
  nome: "Entrada",
  papel: "entrada",
  ipAddress: "192.168.1.10",
};
const leitorSaida: Leitor = {
  id: "leitor-saida",
  nome: "Saída",
  papel: "saida",
  ipAddress: "192.168.1.11",
};

function pessoaBase(overrides: Partial<Pessoa> = {}): Pessoa {
  return {
    id: "p1",
    nome: "Maria Silva",
    cpf: "12345678900",
    empresaId: "e1",
    tipoVinculo: "funcionario",
    status: "ativo",
    validadeInicio: new Date("2026-01-01"),
    subsolosAutorizadosIds: ["s1"],
    consentimentoBiometriaAceito: true,
    ...overrides,
  };
}

describe("traduzirPessoaParaProvisionamento", () => {
  it("gera usuário, grupo, regra de entrada e regra de saída para um único subsolo", () => {
    const pessoa = pessoaBase({ subsolosAutorizadosIds: ["s1"] });
    const plano = traduzirPessoaParaProvisionamento(
      pessoa,
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    expect(plano.usuario).toEqual({
      pessoaId: "p1",
      nome: "Maria Silva",
      matricula: "12345678900",
      ativo: true,
      grupos: [nomeGrupoSubsolo(subsolo1), GRUPO_SAIDA],
    });
    expect(plano.grupos).toHaveLength(2);
    expect(plano.regrasAcesso).toHaveLength(2);
    expect(cancelasNoPlano(plano)).toEqual(["A"]);

    const regraEntrada = plano.regrasAcesso.find((r) => r.portalAlvo === "A");
    expect(regraEntrada?.leitorId).toBe(leitorEntrada.id);
    expect(regraEntrada?.grupoNome).toBe(nomeGrupoSubsolo(subsolo1));

    const regraSaida = plano.regrasAcesso.find((r) => r.portalAlvo === "SAIDA");
    expect(regraSaida?.leitorId).toBe(leitorSaida.id);
    expect(regraSaida?.grupoNome).toBe(GRUPO_SAIDA);
  });

  it("concede acesso à união das cancelas quando a pessoa tem direito a subsolos em cancelas diferentes", () => {
    const pessoa = pessoaBase({ subsolosAutorizadosIds: ["s1", "s2"] });
    const plano = traduzirPessoaParaProvisionamento(
      pessoa,
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    expect(cancelasNoPlano(plano)).toEqual(["A", "B"]);
    // um grupo e uma regra de entrada por subsolo, mais saída
    expect(plano.grupos).toHaveLength(3);
    expect(plano.regrasAcesso).toHaveLength(3);
  });

  it("gera uma regra de entrada por subsolo mesmo quando os subsolos compartilham a mesma cancela", () => {
    const pessoa = pessoaBase({ subsolosAutorizadosIds: ["s2", "s3"] });
    const plano = traduzirPessoaParaProvisionamento(
      pessoa,
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    expect(cancelasNoPlano(plano)).toEqual(["B"]);
    const regrasEntrada = plano.regrasAcesso.filter((r) => r.portalAlvo === "B");
    expect(regrasEntrada).toHaveLength(2);
    expect(new Set(regrasEntrada.map((r) => r.grupoNome))).toEqual(
      new Set([nomeGrupoSubsolo(subsolo2), nomeGrupoSubsolo(subsolo3)]),
    );
  });

  it("produz um plano estável (mesma ordem) independente da ordem de entrada dos ids", () => {
    const a = traduzirPessoaParaProvisionamento(
      pessoaBase({ subsolosAutorizadosIds: ["s2", "s1"] }),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );
    const b = traduzirPessoaParaProvisionamento(
      pessoaBase({ subsolosAutorizadosIds: ["s1", "s2"] }),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );
    expect(a.usuario.grupos).toEqual(b.usuario.grupos);
    expect(a.regrasAcesso.map((r) => r.nome)).toEqual(b.regrasAcesso.map((r) => r.nome));
  });

  it("remove todo acesso para pessoa bloqueada, sem erro mesmo sem subsolo", () => {
    const pessoa = pessoaBase({ status: "bloqueado", subsolosAutorizadosIds: [] });
    const plano = traduzirPessoaParaProvisionamento(
      pessoa,
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    expect(plano.usuario.ativo).toBe(false);
    expect(plano.usuario.grupos).toEqual([]);
    expect(plano.grupos).toEqual([]);
    expect(plano.regrasAcesso).toEqual([]);
  });

  it("remove todo acesso para pessoa inativa mesmo que ainda tenha subsolos cadastrados", () => {
    const pessoa = pessoaBase({ status: "inativo", subsolosAutorizadosIds: ["s1"] });
    const plano = traduzirPessoaParaProvisionamento(
      pessoa,
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    expect(plano.usuario.ativo).toBe(false);
    expect(plano.regrasAcesso).toEqual([]);
  });

  it("lança erro para pessoa ativa sem nenhum subsolo autorizado", () => {
    const pessoa = pessoaBase({ status: "ativo", subsolosAutorizadosIds: [] });
    expect(() =>
      traduzirPessoaParaProvisionamento(pessoa, todosSubsolos, leitorEntrada, leitorSaida),
    ).toThrow(ErroDeProvisionamento);
  });

  it("lança erro quando a pessoa referencia um subsolo que não existe na lista fornecida", () => {
    const pessoa = pessoaBase({ subsolosAutorizadosIds: ["subsolo-inexistente"] });
    expect(() =>
      traduzirPessoaParaProvisionamento(pessoa, todosSubsolos, leitorEntrada, leitorSaida),
    ).toThrow(ErroDeProvisionamento);
  });

  it("lança erro se o leitor de entrada informado não tem papel 'entrada'", () => {
    const pessoa = pessoaBase();
    expect(() =>
      traduzirPessoaParaProvisionamento(pessoa, todosSubsolos, leitorSaida, leitorSaida),
    ).toThrow(ErroDeProvisionamento);
  });

  it("lança erro se o leitor de saída informado não tem papel 'saida'", () => {
    const pessoa = pessoaBase();
    expect(() =>
      traduzirPessoaParaProvisionamento(pessoa, todosSubsolos, leitorEntrada, leitorEntrada),
    ).toThrow(ErroDeProvisionamento);
  });

  it("não bloqueia o acesso por falta de consentimento de biometria (LGPD), mas sinaliza o motivo", () => {
    const pessoa = pessoaBase({ consentimentoBiometriaAceito: false });
    const plano = traduzirPessoaParaProvisionamento(
      pessoa,
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    expect(plano.usuario.ativo).toBe(true);
    expect(plano.grupos.length).toBeGreaterThan(0);
    expect(plano.regrasAcesso.length).toBeGreaterThan(0);
    expect(plano.motivoSemBiometria).toBeDefined();
  });

  it("não sinaliza motivo quando a pessoa consentiu com biometria", () => {
    const pessoa = pessoaBase({ consentimentoBiometriaAceito: true });
    const plano = traduzirPessoaParaProvisionamento(
      pessoa,
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );
    expect(plano.motivoSemBiometria).toBeUndefined();
  });
});
