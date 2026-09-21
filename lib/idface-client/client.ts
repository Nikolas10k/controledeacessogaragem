/**
 * Cliente REST para os endpoints .fcgi do iDFace: autenticação com renovação
 * automática de sessão, CRUD em lote, carga de biometria envolvida em
 * template_sync_init/end, upload de foto em binário puro e utilidades de
 * relógio/firmware.
 *
 * Este é o único componente do sistema que fala diretamente com os
 * leitores (fronteira AGENTE / APLICAÇÃO do spec do produto).
 */

import type { RespostaHttp, TransporteHttp } from "./transport";
import type {
  ClausulaWhere,
  RespostaCountObjects,
  RespostaCreateObjects,
  RespostaLoadObjects,
  RespostaLogin,
  RespostaSystemInformation,
  TipoObjetoIDFace,
} from "./types";

export class ErroIDFace extends Error {
  /**
   * `corpo` carrega a resposta crua do dispositivo — em erros de
   * create/modify_objects ela pode ecoar os valores enviados (nome, CPF).
   * NUNCA registrar este campo em log de aplicação/telemetria sem
   * redigir dados pessoais antes (requisito de segurança de primeira
   * classe do spec do produto: "nenhum dado pessoal em log de aplicação,
   * mensagem de erro ou telemetria"). `message` sozinho já identifica a
   * rota e o status; use `corpo` só em depuração pontual e local.
   */
  constructor(
    message: string,
    readonly status?: number,
    readonly corpo?: unknown,
  ) {
    super(message);
    this.name = "ErroIDFace";
  }
}

export class ErroAutenticacaoIDFace extends ErroIDFace {}

export interface OpcoesIDFaceClient {
  baseUrl: string;
  login: string;
  senha: string;
  transporte: TransporteHttp;
  /** Segundos antes da expiração assumida da sessão em que ela é renovada proativamente. */
  margemRenovacaoSegundos?: number;
  /** Injetável para testes determinísticos; padrão `Date.now`. */
  agora?: () => number;
}

/**
 * TTL assumido para a sessão — corroborado por fonte de terceiro (emulador
 * da API), não pela documentação oficial (inacessível ao construir este
 * módulo). O cliente renova proativamente antes desse prazo e também reage
 * a uma resposta 401/403 tentando novo login uma vez, então um TTL real
 * diferente não quebra o funcionamento — apenas muda a frequência de
 * renovação.
 */
const TTL_SESSAO_PADRAO_SEGUNDOS = 3600;

export class IDFaceClient {
  private readonly baseUrl: string;
  private readonly login: string;
  private readonly senha: string;
  private readonly transporte: TransporteHttp;
  private readonly margemRenovacaoSegundos: number;
  private readonly agora: () => number;

  private session: string | undefined;
  private expiraEm = 0;

  constructor(opcoes: OpcoesIDFaceClient) {
    this.baseUrl = opcoes.baseUrl.replace(/\/+$/, "");
    this.login = opcoes.login;
    this.senha = opcoes.senha;
    this.transporte = opcoes.transporte;
    this.margemRenovacaoSegundos = opcoes.margemRenovacaoSegundos ?? 60;
    this.agora = opcoes.agora ?? (() => Date.now());
  }

  private precisaRenovar(): boolean {
    if (!this.session) return true;
    return this.agora() >= this.expiraEm - this.margemRenovacaoSegundos * 1000;
  }

  private caminho(rota: string): string {
    return `${this.baseUrl}${rota}`;
  }

  async autenticar(): Promise<void> {
    const resposta = await this.transporte.postJson(this.caminho("/login.fcgi"), {
      login: this.login,
      password: this.senha,
    });
    if (resposta.status !== 200) {
      throw new ErroAutenticacaoIDFace(
        `Falha ao autenticar no iDFace (status ${resposta.status})`,
        resposta.status,
        resposta.corpo,
      );
    }
    const corpo = resposta.corpo as RespostaLogin;
    if (!corpo?.session) {
      throw new ErroAutenticacaoIDFace(
        "Resposta de login sem campo 'session'",
        resposta.status,
        resposta.corpo,
      );
    }
    this.session = corpo.session;
    this.expiraEm = this.agora() + TTL_SESSAO_PADRAO_SEGUNDOS * 1000;
  }

  private async garantirSessao(): Promise<string> {
    if (this.precisaRenovar()) {
      await this.autenticar();
    }
    if (!this.session) {
      throw new ErroAutenticacaoIDFace("Sessão indisponível após autenticação");
    }
    return this.session;
  }

  /**
   * Núcleo comum a toda chamada autenticada, qualquer que seja o transporte
   * (JSON ou binário): garante sessão, executa `chamar`, e em 401/403
   * derruba a sessão e tenta de novo exatamente uma vez antes de desistir.
   *
   * Nota de segurança: o token de sessão vai na query string da URL (é
   * assim que a API .fcgi do iDFace exige — ver types.ts), então qualquer
   * log de acesso HTTP ou de requisições feito por quem consome este
   * cliente (ex.: um proxy, um middleware de log da aplicação) precisa
   * redigir a query string antes de persistir, para não gravar o token em
   * texto puro.
   */
  private async executarAutenticada(
    rota: string,
    chamar: (session: string) => Promise<RespostaHttp>,
    tentarRenovarAoExpirar = true,
  ): Promise<unknown> {
    const session = await this.garantirSessao();
    const resposta = await chamar(session);

    if ((resposta.status === 401 || resposta.status === 403) && tentarRenovarAoExpirar) {
      this.session = undefined;
      return this.executarAutenticada(rota, chamar, false);
    }

    if (resposta.status !== 200) {
      throw new ErroIDFace(
        `Requisição a ${rota} falhou (status ${resposta.status})`,
        resposta.status,
        resposta.corpo,
      );
    }

    return resposta.corpo;
  }

  private async requisicaoAutenticada(
    rota: string,
    corpo: Record<string, unknown>,
  ): Promise<unknown> {
    return this.executarAutenticada(rota, (session) =>
      this.transporte.postJson(`${this.caminho(rota)}?session=${encodeURIComponent(session)}`, corpo),
    );
  }

  private async requisicaoBinariaAutenticada(
    rota: string,
    caminhoComQuery: (session: string) => string,
    corpo: Uint8Array,
    contentType: string,
  ): Promise<unknown> {
    return this.executarAutenticada(rota, (session) =>
      this.transporte.postBinario(this.caminho(caminhoComQuery(session)), corpo, contentType),
    );
  }

  /** Cria objetos em lote — o chamador nunca deve fazer uma requisição por pessoa. */
  async criarObjetos(
    tipo: TipoObjetoIDFace,
    valores: Record<string, unknown>[],
  ): Promise<RespostaCreateObjects> {
    if (valores.length === 0) return { ids: [] };
    const corpo = await this.requisicaoAutenticada("/create_objects.fcgi", {
      object: tipo,
      values: valores,
    });
    return corpo as RespostaCreateObjects;
  }

  async modificarObjetos(
    tipo: TipoObjetoIDFace,
    where: ClausulaWhere,
    valores: Record<string, unknown>,
  ): Promise<void> {
    await this.requisicaoAutenticada("/modify_objects.fcgi", {
      object: tipo,
      where,
      values: valores,
    });
  }

  async destruirObjetos(tipo: TipoObjetoIDFace, where: ClausulaWhere): Promise<void> {
    await this.requisicaoAutenticada("/destroy_objects.fcgi", { object: tipo, where });
  }

  async carregarObjetos<T = Record<string, unknown>>(
    tipo: TipoObjetoIDFace,
    where?: ClausulaWhere,
  ): Promise<RespostaLoadObjects<T>> {
    const corpo = await this.requisicaoAutenticada("/load_objects.fcgi", {
      object: tipo,
      ...(where ? { where } : {}),
    });
    return corpo as RespostaLoadObjects<T>;
  }

  async contarObjetos(tipo: TipoObjetoIDFace, where?: ClausulaWhere): Promise<number> {
    const corpo = (await this.requisicaoAutenticada("/count_objects.fcgi", {
      object: tipo,
      ...(where ? { where } : {}),
    })) as RespostaCountObjects;
    return corpo.count;
  }

  /**
   * Carga em massa de biometria: envolve obrigatoriamente as operações entre
   * template_sync_init.fcgi e template_sync_end.fcgi (requisito explícito
   * do spec). Chama template_sync_end mesmo se a operação falhar, para não
   * deixar o dispositivo preso em modo de sincronização.
   */
  async comSincronizacaoDeTemplate<T>(operacao: () => Promise<T>): Promise<T> {
    await this.requisicaoAutenticada("/template_sync_init.fcgi", {});
    try {
      return await operacao();
    } finally {
      await this.requisicaoAutenticada("/template_sync_end.fcgi", {});
    }
  }

  /**
   * Upload da foto facial — binário puro, nunca em JSON. Passa pelo mesmo
   * mecanismo de renovação reativa de sessão (401/403 -> novo login ->
   * tenta de novo uma vez) que as demais chamadas autenticadas, para que
   * uma sessão invalidada entre a renovação proativa e o envio não derrube
   * o upload sem necessidade.
   */
  async enviarFotoUsuario(
    userId: number,
    imagem: Uint8Array,
    contentType: string,
  ): Promise<void> {
    await this.requisicaoBinariaAutenticada(
      "/user_set_image.fcgi",
      (session) => `/user_set_image.fcgi?session=${encodeURIComponent(session)}&user_id=${userId}`,
      imagem,
      contentType,
    );
  }

  /** Sincroniza o relógio do dispositivo com o horário informado. */
  async sincronizarRelogio(data: Date): Promise<void> {
    await this.requisicaoAutenticada("/set_system_time.fcgi", {
      time: Math.floor(data.getTime() / 1000),
    });
  }

  async informacoesDoSistema(): Promise<RespostaSystemInformation> {
    return (await this.requisicaoAutenticada(
      "/system_information.fcgi",
      {},
    )) as RespostaSystemInformation;
  }
}
