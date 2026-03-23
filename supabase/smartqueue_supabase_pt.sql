-- ============================================================
--  SMARTQUEUE – FILA INTELIGENTE
--  Script completo para Supabase (PostgreSQL)
--  Nomenclatura 100% em português
--  Ordem: Extensions → Types → Tabelas → Índices →
--          Functions → Triggers → Políticas RLS → Seed
-- ============================================================


-- ============================================================
-- 0. EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. TIPOS PERSONALIZADOS (ENUMs)
-- ============================================================

CREATE TYPE perfil_usuario AS ENUM ('usuario', 'administrador', 'super_administrador');

CREATE TYPE status_agendamento AS ENUM (
  'agendado',
  'aguardando',
  'em_atendimento',
  'concluido',
  'cancelado',
  'nao_compareceu'
);

CREATE TYPE grupo_prioridade AS ENUM (
  'normal',
  'idoso',
  'gestante',
  'deficiente',
  'lactante',
  'obeso'
);

CREATE TYPE tipo_plano AS ENUM ('gratuito', 'premium');

CREATE TYPE status_notificacao AS ENUM ('pendente', 'enviada', 'lida');

CREATE TYPE tipo_relatorio AS ENUM ('diario', 'mensal');


-- ============================================================
-- 2. TABELAS
-- ============================================================

-- ----------------------------------------------------------
-- 2.1 PERFIS
-- ----------------------------------------------------------
CREATE TABLE perfis (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo     TEXT NOT NULL,
  cpf               TEXT UNIQUE,
  telefone          TEXT,
  data_nascimento   DATE,
  grupo_prioridade  grupo_prioridade NOT NULL DEFAULT 'normal',
  perfil            perfil_usuario NOT NULL DEFAULT 'usuario',
  url_avatar        TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE perfis IS 'Dados dos usuários, extensão de auth.users';


-- ----------------------------------------------------------
-- 2.2 UNIDADES
-- ----------------------------------------------------------
CREATE TABLE unidades (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome                TEXT NOT NULL,
  descricao           TEXT,
  endereco            TEXT,
  cidade              TEXT,
  estado              CHAR(2),
  telefone            TEXT,
  email               TEXT,
  plano               tipo_plano NOT NULL DEFAULT 'gratuito',
  plano_expira_em     TIMESTAMPTZ,
  ativa               BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE unidades IS 'Unidades de atendimento (1 no gratuito, N no premium)';


-- ----------------------------------------------------------
-- 2.3 ADMINISTRADORES_UNIDADES
-- ----------------------------------------------------------
CREATE TABLE administradores_unidades (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id    UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (unidade_id, usuario_id)
);

COMMENT ON TABLE administradores_unidades IS 'Administradores vinculados a cada unidade';


-- ----------------------------------------------------------
-- 2.4 TIPOS_ATENDIMENTO
-- ----------------------------------------------------------
CREATE TABLE tipos_atendimento (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id                UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  nome                      TEXT NOT NULL,
  descricao                 TEXT,
  duracao_media_minutos     INT NOT NULL DEFAULT 15,
  vagas_maximas_dia         INT NOT NULL DEFAULT 50,
  ativo                     BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tipos_atendimento IS 'Tipos de atendimento disponíveis em cada unidade';


-- ----------------------------------------------------------
-- 2.5 HORARIOS_FUNCIONAMENTO
-- ----------------------------------------------------------
CREATE TABLE horarios_funcionamento (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id      UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  abre_as         TIME NOT NULL,
  fecha_as        TIME NOT NULL,
  aberto          BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (unidade_id, dia_semana)
);

COMMENT ON TABLE horarios_funcionamento IS 'Horários de funcionamento por dia da semana';


-- ----------------------------------------------------------
-- 2.6 AGENDAMENTOS
-- ----------------------------------------------------------
CREATE TABLE agendamentos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id            UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  usuario_id            UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  tipo_atendimento_id   UUID NOT NULL REFERENCES tipos_atendimento(id),
  data_agendamento      DATE NOT NULL,
  hora_agendamento      TIME NOT NULL,
  grupo_prioridade      grupo_prioridade NOT NULL DEFAULT 'normal',
  pontuacao_prioridade  SMALLINT NOT NULL DEFAULT 0,
  status                status_agendamento NOT NULL DEFAULT 'agendado',
  numero_senha          TEXT,
  observacoes           TEXT,
  cancelado_em          TIMESTAMPTZ,
  motivo_cancelamento   TEXT,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agendamentos IS 'Agendamentos realizados pelos usuários';

CREATE INDEX idx_agendamentos_unidade_data
  ON agendamentos (unidade_id, data_agendamento, status);

CREATE INDEX idx_agendamentos_usuario
  ON agendamentos (usuario_id, data_agendamento DESC);


-- ----------------------------------------------------------
-- 2.7 FILA
-- ----------------------------------------------------------
CREATE TABLE fila (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agendamento_id      UUID NOT NULL UNIQUE REFERENCES agendamentos(id) ON DELETE CASCADE,
  unidade_id          UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  posicao             INT NOT NULL,
  chamado_em          TIMESTAMPTZ,
  atendimento_inicio  TIMESTAMPTZ,
  atendimento_fim     TIMESTAMPTZ,
  numero_guiche       SMALLINT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fila IS 'Estado da fila em tempo real para cada unidade';

CREATE INDEX idx_fila_unidade_posicao
  ON fila (unidade_id, posicao) WHERE atendimento_fim IS NULL;


-- ----------------------------------------------------------
-- 2.8 NOTIFICACOES
-- ----------------------------------------------------------
CREATE TABLE notificacoes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id      UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  agendamento_id  UUID REFERENCES agendamentos(id) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  mensagem        TEXT NOT NULL,
  status          status_notificacao NOT NULL DEFAULT 'pendente',
  enviada_em      TIMESTAMPTZ,
  lida_em         TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notificacoes IS 'Notificações enviadas aos usuários';

CREATE INDEX idx_notificacoes_usuario_status
  ON notificacoes (usuario_id, status) WHERE status != 'lida';


-- ----------------------------------------------------------
-- 2.9 HISTORICO_ATENDIMENTOS
-- ----------------------------------------------------------
CREATE TABLE historico_atendimentos (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agendamento_id        UUID NOT NULL REFERENCES agendamentos(id),
  unidade_id            UUID NOT NULL REFERENCES unidades(id),
  tipo_atendimento_id   UUID NOT NULL REFERENCES tipos_atendimento(id),
  usuario_id            UUID NOT NULL REFERENCES perfis(id),
  grupo_prioridade      grupo_prioridade NOT NULL DEFAULT 'normal',
  data_atendimento      DATE NOT NULL,
  tempo_espera_minutos  INT,
  duracao_minutos       INT,
  status                status_agendamento NOT NULL,
  atendido_por          UUID REFERENCES perfis(id),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE historico_atendimentos IS 'Log imutável para geração de relatórios';

CREATE INDEX idx_historico_unidade_data
  ON historico_atendimentos (unidade_id, data_atendimento);


-- ----------------------------------------------------------
-- 2.10 RELATORIOS
-- ----------------------------------------------------------
CREATE TABLE relatorios (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unidade_id            UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  tipo_relatorio        tipo_relatorio NOT NULL,
  data_referencia       DATE NOT NULL,
  total_agendados       INT NOT NULL DEFAULT 0,
  total_atendidos       INT NOT NULL DEFAULT 0,
  total_cancelados      INT NOT NULL DEFAULT 0,
  total_nao_compareceu  INT NOT NULL DEFAULT 0,
  media_espera_minutos  NUMERIC(6,2),
  media_duracao_minutos NUMERIC(6,2),
  gerado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dados_extras          JSONB,
  UNIQUE (unidade_id, tipo_relatorio, data_referencia)
);

COMMENT ON TABLE relatorios IS 'Relatórios diários e mensais pré-calculados';


-- ============================================================
-- 3. FUNÇÕES E TRIGGERS
-- ============================================================

-- ----------------------------------------------------------
-- 3.1 Atualiza atualizado_em automaticamente
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_perfis_atualizado_em
  BEFORE UPDATE ON perfis
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trg_unidades_atualizado_em
  BEFORE UPDATE ON unidades
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trg_tipos_atendimento_atualizado_em
  BEFORE UPDATE ON tipos_atendimento
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trg_agendamentos_atualizado_em
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();


-- ----------------------------------------------------------
-- 3.2 Cria perfil automaticamente após cadastro no auth
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION criar_perfil_novo_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO perfis (id, nome_completo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ao_criar_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION criar_perfil_novo_usuario();


-- ----------------------------------------------------------
-- 3.3 Calcula pontuação de prioridade
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION calcular_pontuacao_prioridade()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.pontuacao_prioridade := CASE NEW.grupo_prioridade
    WHEN 'deficiente' THEN 100
    WHEN 'idoso'      THEN 90
    WHEN 'gestante'   THEN 85
    WHEN 'lactante'   THEN 80
    WHEN 'obeso'      THEN 70
    ELSE 0
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calcular_prioridade
  BEFORE INSERT OR UPDATE OF grupo_prioridade ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION calcular_pontuacao_prioridade();


-- ----------------------------------------------------------
-- 3.4 Gera número da senha ao criar agendamento
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION gerar_numero_senha()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_contador INT;
  v_prefixo  CHAR(1);
BEGIN
  v_prefixo := CASE NEW.grupo_prioridade
    WHEN 'normal' THEN 'A'
    ELSE 'P'
  END;

  SELECT COUNT(*) + 1 INTO v_contador
  FROM agendamentos
  WHERE unidade_id = NEW.unidade_id
    AND data_agendamento = NEW.data_agendamento
    AND id != NEW.id;

  NEW.numero_senha := v_prefixo || LPAD(v_contador::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_senha
  BEFORE INSERT ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION gerar_numero_senha();


-- ----------------------------------------------------------
-- 3.5 Gerencia fila ao mudar status do agendamento
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION gerenciar_fila_por_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_posicao INT;
BEGIN
  IF NEW.status = 'aguardando' AND OLD.status != 'aguardando' THEN
    SELECT COALESCE(MAX(posicao), 0) + 1 INTO v_posicao
    FROM fila
    WHERE unidade_id = NEW.unidade_id AND atendimento_fim IS NULL;

    INSERT INTO fila (agendamento_id, unidade_id, posicao)
    VALUES (NEW.id, NEW.unidade_id, v_posicao);
  END IF;

  IF NEW.status IN ('concluido', 'cancelado', 'nao_compareceu')
     AND OLD.status NOT IN ('concluido', 'cancelado', 'nao_compareceu') THEN

    UPDATE fila
    SET atendimento_fim = NOW()
    WHERE agendamento_id = NEW.id;

    INSERT INTO historico_atendimentos (
      agendamento_id, unidade_id, tipo_atendimento_id,
      usuario_id, grupo_prioridade, data_atendimento, status
    ) VALUES (
      NEW.id, NEW.unidade_id, NEW.tipo_atendimento_id,
      NEW.usuario_id, NEW.grupo_prioridade, NEW.data_agendamento, NEW.status
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerenciar_fila
  AFTER UPDATE OF status ON agendamentos
  FOR EACH ROW EXECUTE FUNCTION gerenciar_fila_por_status();


-- ============================================================
-- 4. SEGURANÇA – ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE perfis                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE administradores_unidades  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_atendimento         ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionamento    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_atendimentos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorios                ENABLE ROW LEVEL SECURITY;

-- ── PERFIS ────────────────────────────────────────────────
CREATE POLICY "Usuario ve o proprio perfil"
  ON perfis FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuario atualiza o proprio perfil"
  ON perfis FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Administrador ve todos os perfis"
  ON perfis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM perfis p
      WHERE p.id = auth.uid()
        AND p.perfil IN ('administrador', 'super_administrador')
    )
  );

-- ── UNIDADES ──────────────────────────────────────────────
CREATE POLICY "Usuario autenticado ve unidades ativas"
  ON unidades FOR SELECT
  USING (auth.uid() IS NOT NULL AND ativa = TRUE);

CREATE POLICY "Super administrador gerencia unidades"
  ON unidades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfis WHERE id = auth.uid() AND perfil = 'super_administrador'
    )
  );

-- ── TIPOS_ATENDIMENTO ─────────────────────────────────────
CREATE POLICY "Usuario ve tipos de atendimento ativos"
  ON tipos_atendimento FOR SELECT
  USING (auth.uid() IS NOT NULL AND ativo = TRUE);

CREATE POLICY "Admin da unidade gerencia tipos de atendimento"
  ON tipos_atendimento FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM administradores_unidades
      WHERE unidade_id = tipos_atendimento.unidade_id AND usuario_id = auth.uid()
    )
  );

-- ── HORARIOS_FUNCIONAMENTO ────────────────────────────────
CREATE POLICY "Usuario autenticado ve horarios"
  ON horarios_funcionamento FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin da unidade gerencia horarios"
  ON horarios_funcionamento FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM administradores_unidades
      WHERE unidade_id = horarios_funcionamento.unidade_id AND usuario_id = auth.uid()
    )
  );

-- ── AGENDAMENTOS ──────────────────────────────────────────
CREATE POLICY "Usuario ve os proprios agendamentos"
  ON agendamentos FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Usuario cria agendamento"
  ON agendamentos FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuario cancela o proprio agendamento"
  ON agendamentos FOR UPDATE
  USING (auth.uid() = usuario_id AND status = 'agendado');

CREATE POLICY "Admin da unidade ve todos os agendamentos"
  ON agendamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM administradores_unidades
      WHERE unidade_id = agendamentos.unidade_id AND usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admin da unidade atualiza agendamentos"
  ON agendamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM administradores_unidades
      WHERE unidade_id = agendamentos.unidade_id AND usuario_id = auth.uid()
    )
  );

-- ── FILA ──────────────────────────────────────────────────
CREATE POLICY "Usuario ve a propria posicao na fila"
  ON fila FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agendamentos a
      WHERE a.id = fila.agendamento_id AND a.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admin ve a fila completa da sua unidade"
  ON fila FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM administradores_unidades
      WHERE unidade_id = fila.unidade_id AND usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admin gerencia a fila"
  ON fila FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM administradores_unidades
      WHERE unidade_id = fila.unidade_id AND usuario_id = auth.uid()
    )
  );

-- ── NOTIFICACOES ──────────────────────────────────────────
CREATE POLICY "Usuario ve as proprias notificacoes"
  ON notificacoes FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Usuario marca notificacao como lida"
  ON notificacoes FOR UPDATE USING (auth.uid() = usuario_id);

-- ── HISTORICO_ATENDIMENTOS ────────────────────────────────
CREATE POLICY "Admin ve historico da sua unidade"
  ON historico_atendimentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM administradores_unidades
      WHERE unidade_id = historico_atendimentos.unidade_id AND usuario_id = auth.uid()
    )
  );

-- ── RELATORIOS ────────────────────────────────────────────
CREATE POLICY "Admin ve relatorios da sua unidade"
  ON relatorios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM administradores_unidades
      WHERE unidade_id = relatorios.unidade_id AND usuario_id = auth.uid()
    )
  );


-- ============================================================
-- 5. TEMPO REAL (Realtime)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE fila;
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE agendamentos;


-- ============================================================
-- 6. DADOS INICIAIS (Seed)
-- ============================================================

INSERT INTO unidades (id, nome, descricao, endereco, cidade, estado, plano)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'SmartQueue Demo',
  'Unidade de demonstração do sistema',
  'Rua das Flores, 100',
  'Belo Horizonte',
  'MG',
  'gratuito'
);

INSERT INTO tipos_atendimento (unidade_id, nome, descricao, duracao_media_minutos, vagas_maximas_dia)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Atendimento Geral',       'Atendimento comum sem especialidade',  15, 60),
  ('a0000000-0000-0000-0000-000000000001', 'Emissão de Documentos',   'Certidões, declarações e afins',       20, 30),
  ('a0000000-0000-0000-0000-000000000001', 'Suporte Técnico',         'Dúvidas e problemas técnicos',         25, 20),
  ('a0000000-0000-0000-0000-000000000001', 'Atendimento Prioritário', 'Exclusivo para grupos prioritários',   20, 15);

INSERT INTO horarios_funcionamento (unidade_id, dia_semana, abre_as, fecha_as, aberto)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 0, '08:00', '17:00', FALSE),
  ('a0000000-0000-0000-0000-000000000001', 1, '08:00', '17:00', TRUE),
  ('a0000000-0000-0000-0000-000000000001', 2, '08:00', '17:00', TRUE),
  ('a0000000-0000-0000-0000-000000000001', 3, '08:00', '17:00', TRUE),
  ('a0000000-0000-0000-0000-000000000001', 4, '08:00', '17:00', TRUE),
  ('a0000000-0000-0000-0000-000000000001', 5, '08:00', '17:00', TRUE),
  ('a0000000-0000-0000-0000-000000000001', 6, '08:00', '12:00', TRUE);


-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
