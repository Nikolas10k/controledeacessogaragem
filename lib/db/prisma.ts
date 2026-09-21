import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Acesso ao cadastro (Pessoa, Leitor, Vaga, ...) — conexão direta ao
 * Postgres via DATABASE_URL, nunca exposta ao navegador (o import
 * "server-only" faz o build falhar se este módulo acabar num bundle de
 * cliente).
 *
 * Por que Prisma direto em vez de Supabase JS + RLS por papel: o projeto
 * ainda não tem o sistema de papéis (condômino / porteiro / administrador)
 * modelado — a migração prisma/migrations/.../rls habilita RLS em todas as
 * tabelas e propositalmente NÃO cria nenhuma policy para "anon"/
 * "authenticated", negando por padrão qualquer acesso via API pública do
 * Supabase (PostgREST) com a chave anon do navegador. Este client, por
 * outro lado, conecta com a credencial de aplicação (só existe no
 * servidor) e é a única via de acesso aos dados — autorização é decidida em
 * código (ver lib/auth/session.ts), não em RLS, até os papéis existirem.
 * Quando existirem, dá pra migrar para policies por papel sem reescrever
 * quem chama este client.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
