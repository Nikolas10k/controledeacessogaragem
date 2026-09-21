import "server-only";

export type ResultadoConsulta<T> = { ok: true; dados: T } | { ok: false; erro: string };

/**
 * Envolve uma consulta ao banco para páginas que não podem simplesmente
 * quebrar se o Postgres estiver indisponível (ex.: projeto Supabase ainda
 * não provisionado — ver README). Nunca propaga a mensagem de erro bruta
 * do driver (pode conter host/credencial) para a UI.
 */
export async function consultarComSeguranca<T>(consulta: () => Promise<T>): Promise<ResultadoConsulta<T>> {
  try {
    const dados = await consulta();
    return { ok: true, dados };
  } catch {
    return {
      ok: false,
      erro: "Não foi possível conectar ao banco de dados. Verifique se DATABASE_URL está configurado.",
    };
  }
}
