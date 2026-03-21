-- =============================================================
--  SMARTQUEUE – Automações para as Edge Functions
--  Execute no SQL Editor do Supabase
--
--  O que este arquivo configura:
--    1. Trigger de banco que chama notificar-fila via HTTP
--       sempre que a tabela `fila` é atualizada
--    2. Job agendado (pg_cron) que chama notificar-fila
--       a cada 1 minuto para TODAS as unidades ativas
-- =============================================================


-- =============================================================
-- 1. HABILITAR EXTENSÃO pg_cron  (rodar uma única vez)
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;    -- necessário para chamadas HTTP dentro do SQL


-- =============================================================
-- 2. FUNÇÃO QUE CHAMA A EDGE FUNCTION VIA HTTP
--    Usada tanto pelo trigger quanto pelo cron
-- =============================================================
CREATE OR REPLACE FUNCTION chamar_notificar_fila(p_unidade_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url       TEXT;
  v_service   TEXT;
  v_payload   JSONB;
BEGIN
  v_url     := current_setting('app.supabase_url', TRUE) || '/functions/v1/notificar-fila';
  v_service := current_setting('app.service_role_key', TRUE);
  v_payload := jsonb_build_object('unidade_id', p_unidade_id, 'limite_pessoas', 3);

  PERFORM net.http_post(
    url     := v_url,
    body    := v_payload::TEXT,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service
    )
  );
END;
$$;

-- =============================================================
-- 2.1 Configure as variáveis da sua instância:
--     Substitua os valores abaixo pelos seus reais antes de rodar
-- =============================================================
ALTER DATABASE postgres
  SET app.supabase_url    = 'https://qlssrbkoxndiprbfjunk.supabase.co';

ALTER DATABASE postgres
  SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsc3NyYmtveG5kaXByYmZqdW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE3NzE2NSwiZXhwIjoyMDg4NzUzMTY1fQ.0kF7ixbDQ1M5MRws98X9TzrttBcUX3GVG9B7NhjY3no';


-- =============================================================
-- 3. TRIGGER NA TABELA `fila`
--    Dispara notificar-fila sempre que uma posição muda
-- =============================================================
CREATE OR REPLACE FUNCTION tg_fila_notificar()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Só aciona quando a posição muda ou o status finaliza
  IF TG_OP = 'UPDATE' AND OLD.posicao IS DISTINCT FROM NEW.posicao THEN
    PERFORM chamar_notificar_fila(NEW.unidade_id);
  END IF;

  -- Quando alguém é chamado (chamado_em preenchido), avisa os próximos
  IF TG_OP = 'UPDATE'
     AND OLD.chamado_em IS NULL
     AND NEW.chamado_em IS NOT NULL THEN
    PERFORM chamar_notificar_fila(NEW.unidade_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_fila_mudanca_posicao
  AFTER UPDATE ON fila
  FOR EACH ROW EXECUTE FUNCTION tg_fila_notificar();


-- =============================================================
-- 4. CRON JOB – Verificação periódica a cada 1 minuto
--    Garante que ninguém fique sem notificação
-- =============================================================

-- Remove job anterior se existir
SELECT cron.unschedule('smartqueue-notificar-fila')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'smartqueue-notificar-fila'
);

-- Cria o job
SELECT cron.schedule(
  'smartqueue-notificar-fila',    -- nome do job
  '* * * * *',                    -- a cada 1 minuto
  $$
    SELECT chamar_notificar_fila(id)
    FROM unidades
    WHERE ativa = TRUE;
  $$
);


-- =============================================================
-- 5. VISUALIZAR JOBS AGENDADOS (para conferir)
-- =============================================================
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;


-- =============================================================
-- 6. SQL PARA TESTAR MANUALMENTE NO SQL EDITOR
-- =============================================================

-- Testa previsão de espera (substitua o UUID pelo ID real):
/*
SELECT * FROM net.http_post(
  url  := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/previsao-espera',
  body := '{"agendamento_id": "UUID_DO_AGENDAMENTO"}'::TEXT,
  headers := '{"Content-Type":"application/json","Authorization":"Bearer SUA_ANON_KEY"}'::JSONB
);
*/

-- Testa notificar-fila manualmente:
/*
SELECT * FROM net.http_post(
  url  := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/notificar-fila',
  body := '{"unidade_id": "a0000000-0000-0000-0000-000000000001", "limite_pessoas": 3}'::TEXT,
  headers := '{"Content-Type":"application/json","Authorization":"Bearer SUA_ANON_KEY"}'::JSONB
);
*/
