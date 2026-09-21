"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, FieldError, Input, Label } from "@/components/ui";
import { criarPessoaAction, type ActionState } from "../actions";

const initialState: ActionState = { ok: false };

const TIPOS_VINCULO = [
  { value: "condomino", label: "Condômino" },
  { value: "funcionario", label: "Funcionário" },
  { value: "prestador_fixo", label: "Prestador fixo" },
  { value: "visitante_temporario", label: "Visitante temporário" },
] as const;

interface Props {
  empresas: { id: string; nome: string; sala: string }[];
  subsolos: { id: string; codigo: string; nome: string }[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando…" : "Salvar"}
    </Button>
  );
}

export function PessoaForm({ empresas, subsolos }: Props) {
  const [state, formAction] = useActionState(criarPessoaAction, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div>
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required />
        <FieldError message={state.fieldErrors?.nome} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" name="cpf" inputMode="numeric" placeholder="somente números" required />
          <FieldError message={state.fieldErrors?.cpf} />
        </div>
        <div>
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" />
        </div>
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" />
        <FieldError message={state.fieldErrors?.email} />
      </div>

      <div>
        <Label htmlFor="empresaId">Empresa/Sala</Label>
        <select
          id="empresaId"
          name="empresaId"
          required
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
        >
          <option value="">Selecione…</option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nome} — {empresa.sala}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.empresaId} />
        {empresas.length === 0 && (
          <p className="mt-1 text-xs text-warning">
            Nenhuma empresa cadastrada ainda — o cadastro de empresas/salas ainda não tem tela própria.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="tipoVinculo">Tipo de vínculo</Label>
        <select
          id="tipoVinculo"
          name="tipoVinculo"
          required
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
        >
          {TIPOS_VINCULO.map((tipo) => (
            <option key={tipo.value} value={tipo.value}>
              {tipo.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Subsolos autorizados</Label>
        <div className="mt-1 flex flex-wrap gap-3">
          {subsolos.map((subsolo) => (
            <label key={subsolo.id} className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" name="subsolosAutorizadosIds" value={subsolo.id} />
              {subsolo.nome}
            </label>
          ))}
        </div>
        <FieldError message={state.fieldErrors?.subsolosAutorizadosIds} />
        {subsolos.length === 0 && (
          <p className="mt-1 text-xs text-warning">
            Nenhum subsolo cadastrado ainda — o cadastro de subsolos ainda não tem tela própria.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="validadeInicio">Válido a partir de</Label>
          <Input id="validadeInicio" name="validadeInicio" type="date" required />
          <FieldError message={state.fieldErrors?.validadeInicio} />
        </div>
        <div>
          <Label htmlFor="validadeFim">Válido até (opcional)</Label>
          <Input id="validadeFim" name="validadeFim" type="date" />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-text-secondary">
        <input type="checkbox" name="consentimentoBiometriaAceito" className="mt-1" />
        <span>
          A pessoa consentiu com o uso de biometria facial (LGPD). Sem consentimento, o
          cadastro segue normalmente — o acesso não pode ser negado por isso — mas deve ser
          usado meio alternativo (cartão/TAG) em vez de reconhecimento facial.
        </span>
      </label>

      {state.message ? <FieldError message={state.message} /> : null}
      <SubmitButton />
    </form>
  );
}
