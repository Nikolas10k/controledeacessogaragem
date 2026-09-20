import { describe, expect, it } from "vitest";
import type { Leitor, Pessoa, Subsolo } from "../domain/types.js";
import { traduzirPessoaParaProvisionamento } from "../idface/translation.js";
import { construirOperacoesDeProvisionamento, type EstadoAtualDispositivo } from "./reconciler.js";

const subsolo1: Subsolo = { id: "s1", codigo: "1", nome: "1º subsolo", cancelaId: "A" };
const subsolo2: Subsolo = { id: "s2", codigo: "2", nome: "2º subsolo", cancelaId: "B" };
const todosSubsolos = [subsolo1, subsolo2];

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

function pessoa(id: string, cpf: string, subsolosIds: string[], overrides: Partial<Pessoa> = {}): Pessoa {
  return {
    id,
    nome: `Pessoa ${id}`,
    cpf,
    empresaId: "e1",
    tipoVinculo: "funcionario",
    status: "ativo",
    validadeInicio: new Date("2026-01-01"),
    subsolosAutorizadosIds: subsolosIds,
    consentimentoBiometriaAceito: true,
    ...overrides,
  };
}

const estadoVazio: EstadoAtualDispositivo = { grupos: [], regras: [], usuarios: [] };

describe("construirOperacoesDeProvisionamento", () => {
  it("deduplica grupos e regras compartilhados entre pessoas do mesmo subsolo", () => {
    const planoA = traduzirPessoaParaProvisionamento(
      pessoa("p1", "111", ["s1"]),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );
    const planoB = traduzirPessoaParaProvisionamento(
      pessoa("p2", "222", ["s1"]),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    const operacoes = construirOperacoesDeProvisionamento([planoA, planoB], estadoVazio);

    // grupo do subsolo 1 + grupo de saída, cada um uma única vez apesar de duas pessoas
    expect(operacoes.gruposParaCriar).toHaveLength(2);
    expect(operacoes.regrasParaCriar).toHaveLength(2);
    expect(operacoes.usuariosParaCriar).toHaveLength(2);
    expect(operacoes.usuariosParaAtualizar).toHaveLength(0);
  });

  it("não repete grupos/regras que já existem no dispositivo", () => {
    const plano = traduzirPessoaParaProvisionamento(
      pessoa("p1", "111", ["s1"]),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    const estadoComGrupoExistente: EstadoAtualDispositivo = {
      grupos: [{ nome: "ACESSO_SUBSOLO_1", id: 900 }],
      regras: [],
      usuarios: [],
    };

    const operacoes = construirOperacoesDeProvisionamento([plano], estadoComGrupoExistente);

    expect(operacoes.gruposParaCriar.map((g) => g.nome)).toEqual(["ACESSO_SAIDA"]);
  });

  it("classifica como atualização quando a matrícula já existe no dispositivo", () => {
    const plano = traduzirPessoaParaProvisionamento(
      pessoa("p1", "111", ["s1"]),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    const estadoComUsuarioExistente: EstadoAtualDispositivo = {
      grupos: [],
      regras: [],
      usuarios: [{ matricula: "111", id: 77 }],
    };

    const operacoes = construirOperacoesDeProvisionamento([plano], estadoComUsuarioExistente);

    expect(operacoes.usuariosParaCriar).toHaveLength(0);
    expect(operacoes.usuariosParaAtualizar).toEqual([{ id: 77, usuario: plano.usuario }]);
  });

  it("inclui o plano de uma pessoa bloqueada (para remover acesso) na lista de atualização", () => {
    const planoBloqueio = traduzirPessoaParaProvisionamento(
      pessoa("p1", "111", [], { status: "bloqueado" }),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    const estado: EstadoAtualDispositivo = {
      grupos: [],
      regras: [],
      usuarios: [{ matricula: "111", id: 77 }],
    };

    const operacoes = construirOperacoesDeProvisionamento([planoBloqueio], estado);

    expect(operacoes.usuariosParaAtualizar).toEqual([
      { id: 77, usuario: { pessoaId: "p1", nome: "Pessoa p1", matricula: "111", ativo: false, grupos: [] } },
    ]);
  });

  it("lança erro se dois planos tiverem a mesma matrícula", () => {
    const plano = traduzirPessoaParaProvisionamento(
      pessoa("p1", "111", ["s1"]),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );
    const planoDuplicado = traduzirPessoaParaProvisionamento(
      pessoa("p2", "111", ["s1"]),
      todosSubsolos,
      leitorEntrada,
      leitorSaida,
    );

    expect(() =>
      construirOperacoesDeProvisionamento([plano, planoDuplicado], estadoVazio),
    ).toThrow(/Matrícula duplicada/);
  });

  it("com lista de planos vazia não gera nenhuma operação", () => {
    const operacoes = construirOperacoesDeProvisionamento([], estadoVazio);
    expect(operacoes).toEqual({
      gruposParaCriar: [],
      regrasParaCriar: [],
      usuariosParaCriar: [],
      usuariosParaAtualizar: [],
    });
  });
});
