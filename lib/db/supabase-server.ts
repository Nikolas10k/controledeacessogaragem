import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Client Supabase para Server Components, Server Actions e Route Handlers —
 * usado apenas para autenticação (login/logout/sessão), com a chave anon.
 *
 * O acesso aos dados do cadastro em si passa por lib/db/prisma.ts (conexão
 * direta ao Postgres com DATABASE_URL, nunca exposta ao navegador), não por
 * este client — ver o comentário em lib/db/prisma.ts sobre a fronteira de
 * confiança adotada enquanto não existe um sistema de papéis modelado em
 * RLS (prisma/migrations/.../rls: nega tudo para anon/authenticated).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component sem permissão de escrita de
          // cookies: proxy.ts cuida do refresh de sessão nesse caso.
        }
      },
    },
  });
}
