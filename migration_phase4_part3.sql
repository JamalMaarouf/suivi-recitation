-- ══════════════════════════════════════════════════════════════════
-- MIGRATION PHASE 4 — Partie 3 : Ensembles sourates + Séquences config
-- À exécuter dans Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 1. TABLE ENSEMBLES_SOURATES ──────────────────────────────────
-- Groupements de sourates pour la progression (équivalent des Hizb)
-- L'élève doit finir l'ensemble en cours avant de passer au suivant
CREATE TABLE IF NOT EXISTS ensembles_sourates (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ecole_id     UUID NOT NULL,
  niveau_id    UUID NOT NULL,
  nom          TEXT NOT NULL,        -- ex: "Ensemble 1", "Groupe Amma"
  ordre        INTEGER NOT NULL DEFAULT 1,
  sourates_ids JSONB NOT NULL DEFAULT '[]',  -- UUIDs des sourates
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ensembles_niveau ON ensembles_sourates(niveau_id);
CREATE INDEX IF NOT EXISTS idx_ensembles_ecole  ON ensembles_sourates(ecole_id);

-- RLS
ALTER TABLE ensembles_sourates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ensembles_access" ON ensembles_sourates
  FOR ALL USING (true) WITH CHECK (true);

-- ── 2. TABLE SEQUENCES_CONFIG ────────────────────────────────────
-- Nombre de séquences configurable par niveau (remplace le hardcodé "3")
CREATE TABLE IF NOT EXISTS sequences_config (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ecole_id       UUID NOT NULL,
  niveau_id      UUID NOT NULL,
  nb_sequences   INTEGER NOT NULL DEFAULT 3 CHECK (nb_sequences >= 1 AND nb_sequences <= 10),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ecole_id, niveau_id)   -- une seule config par niveau et par école
);

CREATE INDEX IF NOT EXISTS idx_sequences_niveau ON sequences_config(niveau_id);

-- RLS
ALTER TABLE sequences_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sequences_config_access" ON sequences_config
  FOR ALL USING (true) WITH CHECK (true);

-- ── 3. INSÉRER CONFIG PAR DÉFAUT (3 séquences) pour niveaux sourate existants
-- À adapter selon votre ecole_id
/*
INSERT INTO sequences_config (ecole_id, niveau_id, nb_sequences)
SELECT
  'ca551668-d4d5-4535-ad9f-4c40241c6af9',
  n.id,
  3
FROM niveaux n
WHERE n.ecole_id = 'ca551668-d4d5-4535-ad9f-4c40241c6af9'
AND n.type = 'sourate'
ON CONFLICT (ecole_id, niveau_id) DO NOTHING;
*/

-- ── 4. VÉRIFICATION ──────────────────────────────────────────────
SELECT 'ensembles_sourates' AS table_name, COUNT(*) FROM ensembles_sourates
UNION ALL
SELECT 'sequences_config', COUNT(*) FROM sequences_config;
