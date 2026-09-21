-- CreateEnum
CREATE TYPE "TipoVinculo" AS ENUM ('condomino', 'funcionario', 'prestador_fixo', 'visitante_temporario');

-- CreateEnum
CREATE TYPE "StatusPessoa" AS ENUM ('ativo', 'bloqueado', 'inativo');

-- CreateEnum
CREATE TYPE "CancelaId" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "PapelLeitor" AS ENUM ('entrada', 'saida');

-- CreateEnum
CREATE TYPE "TipoOcorrenciaManual" AS ENUM ('nao_abriu', 'nao_desceu', 'desceu_sobre_veiculo', 'abertura_espontanea');

-- CreateEnum
CREATE TYPE "TipoEventoAcesso" AS ENUM ('autorizado', 'efetivado');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sala" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subsolo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cancelaId" "CancelaId" NOT NULL,

    CONSTRAINT "Subsolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pessoa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "empresaId" TEXT NOT NULL,
    "tipoVinculo" "TipoVinculo" NOT NULL,
    "status" "StatusPessoa" NOT NULL DEFAULT 'ativo',
    "validadeInicio" TIMESTAMP(3) NOT NULL,
    "validadeFim" TIMESTAMP(3),
    "consentimentoBiometriaAceito" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PessoaSubsolo" (
    "pessoaId" TEXT NOT NULL,
    "subsoloId" TEXT NOT NULL,

    CONSTRAINT "PessoaSubsolo_pkey" PRIMARY KEY ("pessoaId","subsoloId")
);

-- CreateTable
CREATE TABLE "Veiculo" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "modelo" TEXT,
    "cor" TEXT,

    CONSTRAINT "Veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaga" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "subsoloId" TEXT NOT NULL,
    "empresaId" TEXT,
    "pessoaId" TEXT,

    CONSTRAINT "Vaga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentimentoLGPD" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "versaoTermo" TEXT NOT NULL,
    "aceito" BOOLEAN NOT NULL,
    "ip" TEXT NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentimentoLGPD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leitor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "PapelLeitor" NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "firmwareVersion" TEXT,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "ultimoSyncEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAcesso" (
    "id" TEXT NOT NULL,
    "leitorId" TEXT NOT NULL,
    "idNoDispositivo" INTEGER NOT NULL,
    "pessoaId" TEXT,
    "cancelaId" "CancelaId",
    "papelLeitor" "PapelLeitor" NOT NULL,
    "tipo" "TipoEventoAcesso" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcorrenciaManual" (
    "id" TEXT NOT NULL,
    "cancelaId" "CancelaId" NOT NULL,
    "tipo" "TipoOcorrenciaManual" NOT NULL,
    "placa" TEXT,
    "observacao" TEXT,
    "anexoFotoUrl" TEXT,
    "registradoPorUsuarioId" TEXT NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcorrenciaManual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subsolo_codigo_key" ON "Subsolo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Pessoa_cpf_key" ON "Pessoa"("cpf");

-- CreateIndex
CREATE INDEX "Pessoa_empresaId_idx" ON "Pessoa"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Veiculo_placa_key" ON "Veiculo"("placa");

-- CreateIndex
CREATE INDEX "Veiculo_pessoaId_idx" ON "Veiculo"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "Vaga_pessoaId_key" ON "Vaga"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "Vaga_subsoloId_numero_key" ON "Vaga"("subsoloId", "numero");

-- CreateIndex
CREATE INDEX "ConsentimentoLGPD_pessoaId_idx" ON "ConsentimentoLGPD"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "Leitor_ipAddress_key" ON "Leitor"("ipAddress");

-- CreateIndex
CREATE INDEX "LogAcesso_pessoaId_timestamp_idx" ON "LogAcesso"("pessoaId", "timestamp");

-- CreateIndex
CREATE INDEX "LogAcesso_leitorId_timestamp_idx" ON "LogAcesso"("leitorId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "LogAcesso_leitorId_idNoDispositivo_key" ON "LogAcesso"("leitorId", "idNoDispositivo");

-- CreateIndex
CREATE INDEX "OcorrenciaManual_cancelaId_registradoEm_idx" ON "OcorrenciaManual"("cancelaId", "registradoEm");

-- AddForeignKey
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaSubsolo" ADD CONSTRAINT "PessoaSubsolo_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PessoaSubsolo" ADD CONSTRAINT "PessoaSubsolo_subsoloId_fkey" FOREIGN KEY ("subsoloId") REFERENCES "Subsolo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_subsoloId_fkey" FOREIGN KEY ("subsoloId") REFERENCES "Subsolo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaga" ADD CONSTRAINT "Vaga_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentimentoLGPD" ADD CONSTRAINT "ConsentimentoLGPD_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAcesso" ADD CONSTRAINT "LogAcesso_leitorId_fkey" FOREIGN KEY ("leitorId") REFERENCES "Leitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAcesso" ADD CONSTRAINT "LogAcesso_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

