import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { consultarComSeguranca } from "@/lib/db/safe-query";
import { Button, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pessoas — Controle de Acesso" };

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  bloqueado: "Bloqueado",
  inativo: "Inativo",
};

export default async function PessoasPage() {
  const resultado = await consultarComSeguranca(() =>
    prisma.pessoa.findMany({
      orderBy: { nome: "asc" },
      include: { empresa: true, subsolosAutorizados: { include: { subsolo: true } } },
    }),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Pessoas</h1>
          <p className="text-sm text-text-muted">Cadastro individual — condôminos, funcionários e prestadores.</p>
        </div>
        <Link href="/pessoas/nova">
          <Button>Nova pessoa</Button>
        </Link>
      </div>

      {!resultado.ok ? (
        <Card className="text-sm text-danger">{resultado.erro}</Card>
      ) : resultado.dados.length === 0 ? (
        <Card className="text-sm text-text-muted">Nenhuma pessoa cadastrada ainda.</Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Empresa/Sala</th>
                <th className="px-4 py-3 font-medium">Subsolos</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {resultado.dados.map((pessoa) => (
                <tr key={pessoa.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text-primary">{pessoa.nome}</td>
                  <td className="px-4 py-3 text-text-secondary">{pessoa.empresa.nome}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {pessoa.subsolosAutorizados.map((p) => p.subsolo.codigo).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        pessoa.status === "ativo"
                          ? "text-success"
                          : pessoa.status === "bloqueado"
                            ? "text-danger"
                            : "text-text-muted"
                      }
                    >
                      {STATUS_LABEL[pessoa.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
