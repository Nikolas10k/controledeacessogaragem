import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Controle de Acesso" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-text-primary">Controle de Acesso</h1>
      <p className="mb-6 text-sm text-text-muted">Portaria e administração da garagem.</p>
      <LoginForm />
    </div>
  );
}
