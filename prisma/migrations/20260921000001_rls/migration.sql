-- Habilita Row Level Security em todas as tabelas do cadastro.
--
-- Postura padrão (deliberadamente restritiva): nenhuma policy é criada para
-- os papéis "anon"/"authenticated" do Supabase — com RLS habilitado e sem
-- policy, toda linha fica invisível/inacessível por esses papéis via
-- PostgREST. Todo acesso passa pelo backend Next.js usando a service role
-- key (que ignora RLS), nunca por consulta direta do cliente ao banco.
--
-- Isso é intencional enquanto o sistema de papéis (condômino / porteiro /
-- administrador) descrito no spec ainda não existe: negar por padrão é
-- mais seguro do que abrir acesso amplo e restringir depois. Quando os
-- papéis forem modelados, este arquivo ganha policies específicas por
-- papel (ex.: porteiro só lê pessoas ativas e cria OcorrenciaManual;
-- administrador tem acesso completo) em vez de depender só da service role.
--
-- Dado sensível (CPF em Pessoa, biometria referenciada via
-- ConsentimentoLGPD): manter RLS habilitado aqui não é opcional.

ALTER TABLE "Empresa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subsolo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pessoa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PessoaSubsolo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Veiculo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vaga" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentimentoLGPD" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Leitor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OcorrenciaManual" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LogAcesso" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Empresa" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Subsolo" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Pessoa" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PessoaSubsolo" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Veiculo" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Vaga" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ConsentimentoLGPD" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Leitor" FORCE ROW LEVEL SECURITY;
ALTER TABLE "OcorrenciaManual" FORCE ROW LEVEL SECURITY;
ALTER TABLE "LogAcesso" FORCE ROW LEVEL SECURITY;
