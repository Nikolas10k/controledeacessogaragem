/**
 * Consolida N planos de provisionamento (um por pessoa, produzidos pela
 * camada de tradução em lib/idface/translation.ts) em operações em lote,
 * deduplicando grupos e regras de acesso compartilhados entre pessoas —
 * por exemplo, todas as pessoas autorizadas ao 1º subsolo compartilham o
 * mesmo grupo e a mesma regra de acesso, e devem ser criados uma única vez.
 *
 * "Escritas em lote, nunca uma requisição por pessoa" (requisito do spec)
 * é responsabilidade de quem consome o resultado desta função: ela produz
 * listas prontas para virar uma única chamada a IDFaceClient.criarObjetos
 * por tipo de objeto.
 *
 * Função pura, sem I/O — o estado atual do dispositivo (o que já existe,
 * para não recriar e para decidir criar vs. atualizar cada usuário) é
 * responsabilidade do chamador obter via IDFaceClient.carregarObjetos.
 */

import type { PlanoProvisionamento } from "../idface/desired-state.js";

export interface GrupoExistente {
  nome: string;
  id: number;
}

export interface RegraExistente {
  nome: string;
  id: number;
}

export interface UsuarioExistente {
  /** Correlacionado pela matrícula (CPF) armazenada no campo `registration` do dispositivo. */
  matricula: string;
  id: number;
}

export interface EstadoAtualDispositivo {
  grupos: GrupoExistente[];
  regras: RegraExistente[];
  usuarios: UsuarioExistente[];
}

export type UsuarioParaCriar = PlanoProvisionamento["usuario"];

export interface UsuarioParaAtualizar {
  id: number;
  usuario: PlanoProvisionamento["usuario"];
}

export interface OperacoesLoteProvisionamento {
  gruposParaCriar: PlanoProvisionamento["grupos"];
  regrasParaCriar: PlanoProvisionamento["regrasAcesso"];
  usuariosParaCriar: UsuarioParaCriar[];
  usuariosParaAtualizar: UsuarioParaAtualizar[];
}

export function construirOperacoesDeProvisionamento(
  planos: PlanoProvisionamento[],
  estadoAtual: EstadoAtualDispositivo,
): OperacoesLoteProvisionamento {
  const nomesGruposExistentes = new Set(estadoAtual.grupos.map((g) => g.nome));
  const nomesRegrasExistentes = new Set(estadoAtual.regras.map((r) => r.nome));
  const idsUsuariosPorMatricula = new Map(
    estadoAtual.usuarios.map((u) => [u.matricula, u.id] as const),
  );

  const gruposParaCriarPorNome = new Map<string, PlanoProvisionamento["grupos"][number]>();
  const regrasParaCriarPorNome = new Map<
    string,
    PlanoProvisionamento["regrasAcesso"][number]
  >();
  const usuariosParaCriar: UsuarioParaCriar[] = [];
  const usuariosParaAtualizar: UsuarioParaAtualizar[] = [];
  const matriculasVistas = new Set<string>();

  function adicionarSeNovo<T extends { nome: string }>(
    paraCriarPorNome: Map<string, T>,
    jaExistentesNoDispositivo: Set<string>,
    item: T,
  ): void {
    if (!jaExistentesNoDispositivo.has(item.nome) && !paraCriarPorNome.has(item.nome)) {
      paraCriarPorNome.set(item.nome, item);
    }
  }

  for (const plano of planos) {
    if (matriculasVistas.has(plano.usuario.matricula)) {
      throw new Error(
        `Matrícula duplicada entre planos de provisionamento: ${plano.usuario.matricula}`,
      );
    }
    matriculasVistas.add(plano.usuario.matricula);

    for (const grupo of plano.grupos) {
      adicionarSeNovo(gruposParaCriarPorNome, nomesGruposExistentes, grupo);
    }

    for (const regra of plano.regrasAcesso) {
      adicionarSeNovo(regrasParaCriarPorNome, nomesRegrasExistentes, regra);
    }

    const idExistente = idsUsuariosPorMatricula.get(plano.usuario.matricula);
    if (idExistente === undefined) {
      usuariosParaCriar.push(plano.usuario);
    } else {
      usuariosParaAtualizar.push({ id: idExistente, usuario: plano.usuario });
    }
  }

  return {
    gruposParaCriar: Array.from(gruposParaCriarPorNome.values()),
    regrasParaCriar: Array.from(regrasParaCriarPorNome.values()),
    usuariosParaCriar,
    usuariosParaAtualizar,
  };
}
