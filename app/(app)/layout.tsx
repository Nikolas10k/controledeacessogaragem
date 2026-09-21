import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { logOutAction } from "../(login)/actions";

const NAV = [
  { href: "/leitores", label: "Leitores" },
  { href: "/pessoas", label: "Pessoas" },
  { href: "/diagnostico", label: "Diagnóstico" },
] as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-6">
            <span className="text-sm font-semibold text-text-primary">Controle de Acesso</span>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-muted">{user.email}</span>
            <form action={logOutAction}>
              <button type="submit" className="text-sm text-text-secondary hover:text-text-primary">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
