import { prisma } from "@/lib/db/prisma";
import { consultarComSeguranca } from "@/lib/db/safe-query";
import { Card } from "@/components/ui";
import { PessoaForm } from "./pessoa-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nova pessoa — Controle de Acesso" };

export default async function NovaPessoaPage() {
  const resultado = await consultarComSeguranca(async () => {
    const [empresas, subsolos] = await Promise.all([
      prisma.empresa.findMany({ orderBy: { nome: "asc" } }),
      prisma.subsolo.findMany({ orderBy: { codigo: "asc" } }),
    ]);
    return { empresas, subsolos };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">Nova pessoa</h1>

      {!resultado.ok ? (
        <Card className="text-sm text-danger">{resultado.erro}</Card>
      ) : (
        <PessoaForm empresas={resultado.dados.empresas} subsolos={resultado.dados.subsolos} />
      )}
    </div>
  );
}
