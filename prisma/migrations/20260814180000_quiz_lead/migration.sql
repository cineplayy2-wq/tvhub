-- Respostas do quiz de campanha.
--
-- email UNIQUE de proposito: refazer o quiz atualiza em vez de duplicar o
-- contato, porque lead repetido estraga a metrica e o disparo.
CREATE TABLE IF NOT EXISTS "QuizLead" (
  "id"           TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "respostas"    JSONB NOT NULL,
  "origem"       TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "QuizLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QuizLead_email_key" ON "QuizLead"("email");
CREATE INDEX IF NOT EXISTS "QuizLead_criadoEm_idx" ON "QuizLead"("criadoEm");
