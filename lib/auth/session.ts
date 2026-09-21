import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase-server";

/**
 * Lê o usuário autenticado revalidando o JWT junto ao Supabase Auth (não
 * confia só no cookie local) — chamada correta para decisões de
 * autorização server-side. Nunca usar `getSession()` para isso.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Guard para as rotas operacionais (app/(app)/*): exige sessão válida.
 *
 * LIMITAÇÃO CONHECIDA: o spec pede perfis com privilégio mínimo distinto
 * (condômino / porteiro / administrador) e MFA obrigatório para o perfil
 * administrador — nenhum dos dois existe ainda. Por ora todo usuário
 * autenticado tem o mesmo acesso operacional. Separar papéis é trabalho
 * futuro (tabela de papéis + policy por papel em vez desta checagem única).
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
