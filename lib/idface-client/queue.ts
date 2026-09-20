/**
 * Fila de sincronização: toda escrita no dispositivo passa por aqui, com
 * retentativa e backoff exponencial. Leitor offline -> job fica pendente e
 * sincroniza sozinho no retorno (requisito do spec).
 *
 * A implementação em memória abaixo é a referência testável; a persistência
 * real (sobrevivendo a reinício do agente) é responsabilidade da aplicação
 * (banco de dados) e deve implementar a mesma interface `FilaSincronizacao`.
 */

export interface OpcoesBackoff {
  baseMs?: number;
  fatorMultiplicador?: number;
  maximoMs?: number;
}

/**
 * Backoff exponencial determinístico (sem jitter aleatório, para manter os
 * testes previsíveis): tentativa 1 = baseMs, tentativa 2 = baseMs*fator, ...
 * limitado a maximoMs.
 */
export function calcularBackoffMs(tentativa: number, opcoes: OpcoesBackoff = {}): number {
  const { baseMs = 1000, fatorMultiplicador = 2, maximoMs = 5 * 60 * 1000 } = opcoes;
  if (tentativa < 1) {
    throw new RangeError("tentativa deve ser >= 1");
  }
  const atraso = baseMs * fatorMultiplicador ** (tentativa - 1);
  return Math.min(atraso, maximoMs);
}

export type StatusJobSincronizacao = "pendente" | "concluido" | "falhou";

export interface JobSincronizacao<T = unknown> {
  id: string;
  leitorId: string;
  tipo: string;
  payload: T;
  tentativas: number;
  status: StatusJobSincronizacao;
  proximaTentativaEm: number;
  ultimoErro?: string;
}

export type NovoJobSincronizacao<T = unknown> = Pick<
  JobSincronizacao<T>,
  "leitorId" | "tipo" | "payload"
>;

export interface FilaSincronizacao {
  enfileirar<T>(job: NovoJobSincronizacao<T>): Promise<JobSincronizacao<T>>;
  /** Jobs pendentes cuja próxima tentativa já venceu, prontos para processar. */
  prontosParaProcessar(agoraMs: number): Promise<JobSincronizacao[]>;
  marcarConcluido(id: string): Promise<void>;
  marcarFalha(id: string, erro: string, agoraMs: number, opcoesBackoff?: OpcoesBackoff): Promise<void>;
}

let contador = 0;
function proximoId(): string {
  contador += 1;
  return `job-${contador}`;
}

export class FilaSincronizacaoEmMemoria implements FilaSincronizacao {
  private readonly jobs = new Map<string, JobSincronizacao>();

  async enfileirar<T>(job: NovoJobSincronizacao<T>): Promise<JobSincronizacao<T>> {
    const novo: JobSincronizacao<T> = {
      id: proximoId(),
      leitorId: job.leitorId,
      tipo: job.tipo,
      payload: job.payload,
      tentativas: 0,
      status: "pendente",
      proximaTentativaEm: 0,
    };
    this.jobs.set(novo.id, novo as JobSincronizacao);
    return novo;
  }

  async prontosParaProcessar(agoraMs: number): Promise<JobSincronizacao[]> {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === "pendente" && job.proximaTentativaEm <= agoraMs)
      .sort((a, b) => a.proximaTentativaEm - b.proximaTentativaEm);
  }

  async marcarConcluido(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = "concluido";
  }

  async marcarFalha(
    id: string,
    erro: string,
    agoraMs: number,
    opcoesBackoff?: OpcoesBackoff,
  ): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    job.tentativas += 1;
    job.ultimoErro = erro;
    job.status = "pendente";
    job.proximaTentativaEm = agoraMs + calcularBackoffMs(job.tentativas, opcoesBackoff);
  }

  /** Utilitário de teste/depuração — não faz parte da interface `FilaSincronizacao`. */
  obter(id: string): JobSincronizacao | undefined {
    return this.jobs.get(id);
  }
}
