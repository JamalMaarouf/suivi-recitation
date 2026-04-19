-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Alertes proactives (Itération 2)
-- ═══════════════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor de Supabase (Production)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1) TABLE alertes — Historique des alertes détectées
-- ─────────────────────────────────────────────────────────────────
-- Chaque alerte détectée est enregistrée ici pour :
--   a) Éviter de mailer 1000 fois la même alerte (dédup)
--   b) Afficher les alertes actives dans le cockpit
--   c) Tracer l'historique (analytique, debug)

CREATE TABLE IF NOT EXISTS alertes (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,                      -- NULL = active, non-NULL = résolue
  niveau        TEXT NOT NULL,                    -- 'critique' | 'warning' | 'info'
  type_alerte   TEXT NOT NULL,                    -- 'ping_supabase_ko', 'backup_failed', 'ecole_inactive', etc.
  titre         TEXT NOT NULL,                    -- Titre lisible
  message       TEXT NOT NULL,                    -- Description détaillée
  cle_dedup     TEXT NOT NULL,                    -- Clé unique pour éviter les doublons (ex: "ping_ko" reste 1 même si 10 échecs)
  ecole_id      UUID REFERENCES ecoles(id) ON DELETE SET NULL,
  mail_envoye   BOOLEAN NOT NULL DEFAULT FALSE,
  metadata      JSONB
);

CREATE INDEX IF NOT EXISTS alertes_active_idx  ON alertes(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS alertes_dedup_idx   ON alertes(cle_dedup) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS alertes_niveau_idx  ON alertes(niveau, created_at DESC);
CREATE INDEX IF NOT EXISTS alertes_ecole_idx   ON alertes(ecole_id) WHERE resolved_at IS NULL;

ALTER TABLE alertes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alertes_read ON alertes;
CREATE POLICY alertes_read ON alertes FOR SELECT USING (true);

DROP POLICY IF EXISTS alertes_write ON alertes;
CREATE POLICY alertes_write ON alertes FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE alertes IS 'Alertes détectées par le cron /api/alertes. Active si resolved_at IS NULL.';

-- ─────────────────────────────────────────────────────────────────
-- 2) RPC : compter les alertes actives par niveau
-- ─────────────────────────────────────────────────────────────────
-- Utilisée par le cockpit pour afficher le compteur

CREATE OR REPLACE FUNCTION get_alertes_actives_count()
RETURNS TABLE (
  niveau TEXT,
  nb     BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT a.niveau, COUNT(*)::BIGINT
  FROM alertes a
  WHERE a.resolved_at IS NULL
  GROUP BY a.niveau;
$$;

COMMENT ON FUNCTION get_alertes_actives_count IS 'Compte des alertes actives (non résolues) par niveau.';

-- ─────────────────────────────────────────────────────────────────
-- Fin de migration
-- ─────────────────────────────────────────────────────────────────
SELECT 'alertes' AS table_name, COUNT(*) AS nb_lignes FROM alertes;
