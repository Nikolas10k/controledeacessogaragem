import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/db/env";

/**
 * Renomeado de middleware.ts para proxy.ts (Next.js 16: "middleware" file
 * convention deprecated, renomeada para "proxy" — ver
 * node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md).
 *
 * Só reescreve/atualiza os cookies de sessão do Supabase a cada request
 * (refresh de token). Autorização de verdade (sessão válida, papel de
 * administrador/porteiro) é decidida nos guards server-side
 * (lib/auth/session.ts), nunca aqui.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
