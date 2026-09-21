import { prisma } from "@/lib/db/prisma";
import { consultarComSeguranca } from "@/lib/db/safe-query";
import { Card } from "@/components/ui";

// Depende do banco em cada acesso — nunca deve ser pré-renderizada
// estaticamente no build.
export const dynamic = "force-dynamic";

export const metadata = { title: "Leitores — Controle de Acesso" };

function formatarDataHora(data: Date | null): string {
  if (!data) return "nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

export default async function LeitoresPage() {
  const resultado = await consultarComSeguranca(() =>
    prisma.leitor.findMany({ orderBy: { nome: "asc" } }),
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-text-primary">Leitores</h1>
      <p className="mb-6 text-sm text-text-muted">
        Status e último sync de cada leitor. Bloquear uma pessoa só tem efeito após a
        sincronização com o dispositivo.
      </p>

      {!resultado.ok ? (
        <Card className="text-sm text-danger">{resultado.erro}</Card>
      ) : resultado.dados.length === 0 ? (
        <Card className="text-sm text-text-muted">Nenhum leitor cadastrado ainda.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resultado.dados.map((leitor) => (
            <Card key={leitor.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-medium text-text-primary">{leitor.nome}</h2>
                  <p className="text-xs text-text-muted">
                    {leitor.papel === "entrada" ? "Entrada" : "Saída"} · {leitor.ipAddress}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    leitor.online
                      ? "bg-success/15 text-success"
                      : "bg-danger/15 text-danger"
                  }`}
                >
                  {leitor.online ? "online" : "offline"}
                </span>
              </div>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Último sync</dt>
                  <dd className="text-text-secondary">{formatarDataHora(leitor.ultimoSyncEm)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Firmware</dt>
                  <dd className="text-text-secondary">{leitor.firmwareVersion ?? "desconhecido"}</dd>
                </div>
              </dl>
              <button
                type="button"
                disabled
                title="Fila de sincronização ainda não persistida em banco — o agente não está conectado a esta interface (ver README)."
                className="mt-4 w-full rounded-md border border-border px-3 py-1.5 text-xs text-text-muted disabled:cursor-not-allowed"
              >
                Forçar sincronização
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
