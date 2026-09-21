import { prisma } from "@/lib/db/prisma";
import { consultarComSeguranca } from "@/lib/db/safe-query";
import { Card } from "@/components/ui";
import {
  montarRelatorioSaudeCancelas,
  type HorarioCritico,
} from "@/lib/diagnostico/relatorio-mensal";
import type { EventoAcesso } from "@/lib/diagnostico/types";
import type { OcorrenciaManual } from "@/lib/diagnostico/ocorrencia-manual";
import type { CancelaId } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Diagnóstico — Controle de Acesso" };

const NOME_CANCELA: Record<CancelaId, string> = { A: "Cancela A (1º subsolo)", B: "Cancela B (2º/3º subsolos)" };

function inicioDoMesAtual(): { inicio: Date; fim: Date } {
  const agora = new Date();
  const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59));
  return { inicio, fim };
}

async function carregarDadosDoDiagnostico() {
  const periodo = inicioDoMesAtual();

  const [logs, ocorrenciasManuaisDb] = await Promise.all([
    prisma.logAcesso.findMany({
      where: { timestamp: { gte: periodo.inicio, lte: periodo.fim } },
    }),
    prisma.ocorrenciaManual.findMany({
      where: { registradoEm: { gte: periodo.inicio, lte: periodo.fim } },
      orderBy: { registradoEm: "desc" },
    }),
  ]);

  const eventos: EventoAcesso[] = logs.map((log) => ({
    id: log.id,
    pessoaId: log.pessoaId ?? undefined,
    cancelaId: log.cancelaId ?? undefined,
    papelLeitor: log.papelLeitor,
    timestamp: log.timestamp,
    tipo: log.tipo,
  }));

  const ocorrenciasManuais: OcorrenciaManual[] = ocorrenciasManuaisDb.map((o) => ({
    id: o.id,
    cancelaId: o.cancelaId,
    tipo: o.tipo,
    registradoEm: o.registradoEm,
    registradoPorUsuarioId: o.registradoPorUsuarioId,
    placa: o.placa ?? undefined,
    observacao: o.observacao ?? undefined,
    anexoFotoUrl: o.anexoFotoUrl ?? undefined,
  }));

  // Heurística: se algum log do período veio marcado "efetivado", o firmware
  // do parque de leitores distingue os dois tipos de evento neste período —
  // não há hoje um jeito melhor de saber isso sem consultar cada dispositivo
  // (ver lib/idface-client/firmware.ts).
  const firmwareDistingueTipos = eventos.some((e) => e.tipo === "efetivado");

  const relatorio = montarRelatorioSaudeCancelas(eventos, ocorrenciasManuais, periodo, {
    firmwareDistingueTipos,
  });

  return { relatorio, periodo };
}

function StatTile({ label, valor, tom = "neutro" }: { label: string; valor: string; tom?: "neutro" | "atencao" | "indisponivel" }) {
  const corValor =
    tom === "atencao" ? "text-warning" : tom === "indisponivel" ? "text-text-muted" : "text-text-primary";
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${corValor}`}>{valor}</p>
    </div>
  );
}

function ListaHorariosCriticos({ horarios }: { horarios: HorarioCritico[] }) {
  if (horarios.length === 0) {
    return <p className="text-sm text-text-muted">Sem horários com concentração de eventos anômalos.</p>;
  }
  const maximo = Math.max(...horarios.map((h) => h.contagem));
  return (
    <ul className="space-y-2">
      {horarios.map((h) => (
        <li key={h.hora} className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-xs text-text-muted">{String(h.hora).padStart(2, "0")}h</span>
          <span className="h-4 flex-1 overflow-hidden rounded bg-surface-raised">
            <span
              className="block h-full rounded bg-primary"
              style={{ width: `${(h.contagem / maximo) * 100}%` }}
            />
          </span>
          <span className="w-6 shrink-0 text-right text-xs text-text-secondary">{h.contagem}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function DiagnosticoPage() {
  const resultado = await consultarComSeguranca(carregarDadosDoDiagnostico);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-text-primary">Saúde das cancelas</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-muted">
        Todo indicador abaixo é uma <strong className="text-text-secondary">inferência</strong> a
        partir de logs de autorização — os logs não registram o movimento físico da haste.
        Cruze com os registros manuais da portaria antes de decidir manutenção.
      </p>

      {!resultado.ok ? (
        <Card className="text-sm text-danger">{resultado.erro}</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {resultado.dados.relatorio.porCancela.map((cancela) => (
              <Card key={cancela.cancelaId}>
                <h2 className="mb-4 font-medium text-text-primary">{NOME_CANCELA[cancela.cancelaId]}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <StatTile label="Reapresentações" valor={String(cancela.totalReapresentacoes)} />
                  <StatTile label="Entrada/saída sem par" valor={String(cancela.totalEventosNaoPareados)} />
                  <StatTile
                    label="Liberação sem passagem"
                    valor={
                      cancela.liberacoesSemPassagem.disponivel
                        ? String(cancela.liberacoesSemPassagem.total)
                        : "indisponível"
                    }
                    tom={cancela.liberacoesSemPassagem.disponivel ? "neutro" : "indisponivel"}
                  />
                  <StatTile label="Ocorrências manuais" valor={String(cancela.totalOcorrenciasManuais)} />
                </div>
                {!cancela.liberacoesSemPassagem.disponivel && (
                  <p className="mt-3 text-xs text-text-muted">{cancela.liberacoesSemPassagem.motivoIndisponivel}</p>
                )}
                <h3 className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-text-muted">
                  Horários críticos
                </h3>
                <ListaHorariosCriticos horarios={cancela.horariosCriticos} />
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-text-primary">Carona</h2>
                <p className="mt-1 max-w-xl text-xs text-text-muted">
                  {resultado.dados.relatorio.carona.motivoIndisponivel}
                </p>
              </div>
              <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-text-muted">
                indisponível
              </span>
            </div>
          </Card>

          {resultado.dados.relatorio.totalSaidasSemEntradaNaoAtribuidas > 0 && (
            <Card className="mt-4">
              <p className="text-sm text-text-secondary">
                {resultado.dados.relatorio.totalSaidasSemEntradaNaoAtribuidas} saída(s) no leitor de
                saída sem entrada correspondente no período (não atribuível a uma cancela específica,
                já que o leitor de saída não distingue cancela).
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
