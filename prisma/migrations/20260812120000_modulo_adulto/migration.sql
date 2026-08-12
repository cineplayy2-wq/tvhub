-- Módulo adulto (+18) contratado à parte, por cliente.
--
-- O padrão é FALSO de propósito: conteúdo adulto fica bloqueado para todo
-- mundo e liberar é ato explícito no painel, para quem paga o adicional.
--
-- `IF NOT EXISTS` porque o banco de produção foi construído com ALTER TABLE
-- manual antes do pipeline de migrations existir, e esta migration precisa
-- poder rodar sobre um banco que já tenha a coluna.
ALTER TABLE "M3uPlaylist" ADD COLUMN IF NOT EXISTS "adultUnlocked" BOOLEAN NOT NULL DEFAULT false;

-- Reafirma a trava sobre o que já está no catálogo: grupo adulto sempre oculto.
-- Sem isto, um grupo classificado como adulto antes desta regra continuaria
-- visível para sempre, já que a sincronização não atualiza grupo existente.
UPDATE "M3uGroup" SET "isHidden" = true WHERE category = 'adult' AND "isHidden" = false;
