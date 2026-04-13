-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION PHASE 4 — Partie 2 : Blocs d'examen + Résultats
-- À exécuter APRÈS migration_phase4.sql
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. TABLE BLOCS_EXAMEN ────────────────────────────────────────────
-- Un bloc = ensemble de Hizb ou Sourates sur lequel porte un examen
-- L'école définit librement quels éléments composent chaque bloc
CREATE TABLE IF NOT EXISTS blocs_examen (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  examen_id     UUID NOT NULL REFERENCES examens(id) ON DELETE CASCADE,
  ecole_id      UUID NOT NULL,
  niveau_id     UUID NOT NULL REFERENCES niveaux(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,          -- ex: "Bloc 1 — 5 premiers Hizb"
  ordre         INTEGER NOT NULL DEFAULT 1,
  type_contenu  TEXT NOT NULL CHECK (type_contenu IN ('hizb','sourate')),
  -- Pour hizb : tableau de numéros [1,2,3,4,5]
  -- Pour sourate : tableau d'IDs sourates ["uuid1","uuid2"...]
  contenu_ids   JSONB NOT NULL DEFAULT '[]',
  -- Dernier élément du bloc = celui qui déclenche l'examen
  -- Calculé automatiquement depuis contenu_ids (max pour hizb, dernier pour sourate)
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 2. TABLE RESULTATS_EXAMENS ────────────────────────────────────────
-- Résultats individuels de chaque élève à chaque examen
CREATE TABLE IF NOT EXISTS resultats_examens (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  examen_id           UUID NOT NULL REFERENCES examens(id) ON DELETE CASCADE,
  bloc_id             UUID REFERENCES blocs_examen(id) ON DELETE SET NULL,
  eleve_id            UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  ecole_id            UUID NOT NULL,
  date_examen         DATE NOT NULL DEFAULT CURRENT_DATE,
  score               INTEGER CHECK (score >= 0 AND score <= 100),
  statut              TEXT NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente','reussi','echoue')),
  notes_examinateur   TEXT,
  certificat_genere   BOOLEAN NOT NULL DEFAULT false,
  date_certificat     TIMESTAMPTZ,
  valide_par          UUID REFERENCES utilisateurs(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  -- Un élève peut repasser un examen (pas de UNIQUE strict)
  -- On garde l'historique complet
  UNIQUE(examen_id, eleve_id, date_examen)
);

-- ── 3. INDEX ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_blocs_examen_id  ON blocs_examen(examen_id);
CREATE INDEX IF NOT EXISTS idx_blocs_niveau_id  ON blocs_examen(niveau_id);
CREATE INDEX IF NOT EXISTS idx_resultats_eleve  ON resultats_examens(eleve_id);
CREATE INDEX IF NOT EXISTS idx_resultats_examen ON resultats_examens(examen_id);
CREATE INDEX IF NOT EXISTS idx_resultats_statut ON resultats_examens(statut);

-- ── 4. EXEMPLE — École test : blocs Hizb ─────────────────────────────
-- Après avoir créé les examens, créer les blocs correspondants
-- Remplacer les UUIDs par ceux de votre base

-- Exemple bloc 1 : Hizb 1 à 5
/*
INSERT INTO blocs_examen (examen_id, ecole_id, niveau_id, nom, ordre, type_contenu, contenu_ids)
SELECT
  e.id,                          -- examen_id
  e.ecole_id,                    -- ecole_id
  e.niveau_id,                   -- niveau_id
  'Bloc 1 — Hizb 1 à 5',        -- nom
  1,                             -- ordre
  'hizb',                        -- type_contenu
  '[1,2,3,4,5]'::jsonb           -- les 5 premiers Hizb
FROM examens e
WHERE e.nom = 'Examen Hizb 1' AND e.ecole_id = 'VOTRE_ECOLE_ID';

-- Exemple bloc 2 : Hizb 1 à 15 (cumulatif)
INSERT INTO blocs_examen (examen_id, ecole_id, niveau_id, nom, ordre, type_contenu, contenu_ids)
SELECT
  e.id,
  e.ecole_id,
  e.niveau_id,
  'Bloc 2 — Hizb 1 à 15',
  1,
  'hizb',
  '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]'::jsonb
FROM examens e
WHERE e.nom = 'Examen 15 Hizb' AND e.ecole_id = 'VOTRE_ECOLE_ID';
*/

-- ── 5. VÉRIFICATION ──────────────────────────────────────────────────
SELECT 'blocs_examen' AS table_name, COUNT(*) FROM blocs_examen
UNION ALL
SELECT 'resultats_examens', COUNT(*) FROM resultats_examens;
