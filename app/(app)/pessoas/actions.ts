"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

const pessoaSchema = z.object({
  nome: z.string().min(1, "Informe o nome"),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF precisa ter 11 dígitos"),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  empresaId: z.string().min(1, "Selecione a empresa/sala"),
  tipoVinculo: z.enum(["condomino", "funcionario", "prestador_fixo", "visitante_temporario"]),
  validadeInicio: z.string().min(1, "Informe a data de início"),
  validadeFim: z.string().optional(),
  subsolosAutorizadosIds: z.array(z.string()).min(1, "Selecione ao menos um subsolo"),
  consentimentoBiometriaAceito: z.boolean(),
});

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path[0];
    if (typeof campo === "string" && !erros[campo]) {
      erros[campo] = issue.message;
    }
  }
  return erros;
}

export async function criarPessoaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();

  const parsed = pessoaSchema.safeParse({
    nome: formData.get("nome"),
    cpf: formData.get("cpf"),
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
    empresaId: formData.get("empresaId"),
    tipoVinculo: formData.get("tipoVinculo"),
    validadeInicio: formData.get("validadeInicio"),
    validadeFim: formData.get("validadeFim") || undefined,
    subsolosAutorizadosIds: formData.getAll("subsolosAutorizadosIds"),
    consentimentoBiometriaAceito: formData.get("consentimentoBiometriaAceito") === "on",
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const dados = parsed.data;

  try {
    await prisma.pessoa.create({
      data: {
        nome: dados.nome,
        cpf: dados.cpf,
        telefone: dados.telefone || null,
        email: dados.email || null,
        empresaId: dados.empresaId,
        tipoVinculo: dados.tipoVinculo,
        validadeInicio: new Date(dados.validadeInicio),
        validadeFim: dados.validadeFim ? new Date(dados.validadeFim) : null,
        consentimentoBiometriaAceito: dados.consentimentoBiometriaAceito,
        subsolosAutorizados: {
          create: dados.subsolosAutorizadosIds.map((subsoloId) => ({ subsoloId })),
        },
      },
    });
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes("cpf")) {
      return { ok: false, fieldErrors: { cpf: "Já existe uma pessoa cadastrada com este CPF" } };
    }
    return { ok: false, message: "Não foi possível salvar — verifique a conexão com o banco." };
  }

  // TODO (pendente): "ao salvar, enfileirar provisionamento" (spec) — falta
  // a fila de sincronização persistida em banco (hoje só a referência em
  // memória do agente, lib/idface-client/queue.ts) para o agente pegar este
  // cadastro e provisionar no(s) leitor(es) via lib/idface/translation.ts.

  revalidatePath("/pessoas");
  redirect("/pessoas");
}
