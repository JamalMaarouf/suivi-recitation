-- ══════════════════════════════════════════════════════════════════════
-- MIGRATION PHASE 4 — Niveaux dynamiques, Programmes, Examens, Certificats
-- À exécuter dans Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. TABLE NIVEAUX ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS niveaux (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ecole_id    UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,             -- ex: 5B, N1, CM2 — libre par école
  nom         TEXT NOT NULL,             -- ex: Préscolaire, Niveau 1
  type        TEXT NOT NULL DEFAULT 'hizb' CHECK (type IN ('hizb','sourate')),
  ordre       INTEGER NOT NULL DEFAULT 1, -- ordre d'affichage
  couleur     TEXT NOT NULL DEFAULT '#1D9E75',
  actif       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ecole_id, code)
);

-- ── 2. TABLE PROGRAMMES ─────────────────────────────────────────────────
-- Définit le contenu pédagogique de chaque niveau
CREATE TABLE IF NOT EXISTS programmes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niveau_id       UUID NOT NULL REFERENCES niveaux(id) ON DELETE CASCADE,
  ecole_id        UUID NOT NULL,
  type_contenu    TEXT NOT NULL CHECK (type_contenu IN ('sourate','hizb')),
  reference_id    TEXT NOT NULL,   -- numéro hizb (1-60) ou id sourate
  nom_reference   TEXT,            -- nom affiché (ex: Hizb 1, Al-Fatiha)
  ordre           INTEGER NOT NULL DEFAULT 1,
  obligatoire     BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 3. TABLE EXAMENS ────────────────────────────────────────────────────
-- Seuils déclencheurs d'examen configurables par école
CREATE TABLE IF NOT EXISTS examens (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ecole_id        UUID NOT NULL,
  niveau_id       UUID REFERENCES niveaux(id) ON DELETE CASCADE,  -- null = tous niveaux
  nom             TEXT NOT NULL,   -- ex: Examen Hizb 1, Examen mi-parcours
  description     TEXT,
  type_seuil      TEXT NOT NULL CHECK (type_seuil IN ('hizb','tomon','sourate','points')),
  valeur_seuil    INTEGER NOT NULL, -- ex: 1 hizb, 5 hizb, 15 hizb
  score_minimum   INTEGER NOT NULL DEFAULT 0,  -- score minimum pour réussir (0-100)
  bloquant        BOOLEAN NOT NULL DEFAULT true, -- bloque la progression si non passé
  actif           BOOLEAN NOT NULL DEFAULT true,
  ordre           INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 4. TABLE RESULTATS EXAMENS ──────────────────────────────────────────
-- Résultats individuels + déclenchement certificat
CREATE TABLE IF NOT EXISTS resultats_examens (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  examen_id           UUID NOT NULL REFERENCES examens(id) ON DELETE CASCADE,
  eleve_id            UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  ecole_id            UUID NOT NULL,
  date_examen         DATE NOT NULL DEFAULT CURRENT_DATE,
  score               INTEGER,          -- 0-100, null si en attente
  statut              TEXT NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente','reussi','echoue')),
  notes_examinateur   TEXT,
  certificat_genere   BOOLEAN NOT NULL DEFAULT false,
  date_certificat     TIMESTAMPTZ,
  valide_par          UUID REFERENCES utilisateurs(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(examen_id, eleve_id)           -- un seul résultat par élève par examen
);

-- ── 5. INDEX POUR PERFORMANCE ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_niveaux_ecole    ON niveaux(ecole_id);
CREATE INDEX IF NOT EXISTS idx_programmes_niveau ON programmes(niveau_id);
CREATE INDEX IF NOT EXISTS idx_examens_ecole    ON examens(ecole_id);
CREATE INDEX IF NOT EXISTS idx_resultats_eleve  ON resultats_examens(eleve_id);
CREATE INDEX IF NOT EXISTS idx_resultats_examen ON resultats_examens(examen_id);

-- ── 6. MIGRATION — Créer les niveaux depuis les codes existants ──────────
-- Pour l'école test : créer automatiquement les 5 niveaux hardcodés
-- Remplacer 'VOTRE_ECOLE_ID' par l'UUID de votre école dans utilisateurs

-- D'abord trouver votre ecole_id :
SELECT id, prenom, nom, role FROM utilisateurs WHERE role = 'super_admin' LIMIT 5;
-- OU :
SELECT DISTINCT ecole_id FROM eleves LIMIT 5;

-- Ensuite lancer ceci en remplaçant VOTRE_ECOLE_ID :
/*
INSERT INTO niveaux (ecole_id, code, nom, type, ordre, couleur) VALUES
  ('VOTRE_ECOLE_ID', '5B', 'Préscolaire',   'sourate', 1, '#534AB7'),
  ('VOTRE_ECOLE_ID', '5A', 'Primaire 1-2',  'sourate', 2, '#378ADD'),
  ('VOTRE_ECOLE_ID', '2M', 'Primaire 3-4',  'sourate', 3, '#1D9E75'),
  ('VOTRE_ECOLE_ID', '2',  'Primaire 5-6',  'hizb',    4, '#EF9F27'),
  ('VOTRE_ECOLE_ID', '1',  'Collège/Lycée', 'hizb',    5, '#E24B4A')
ON CONFLICT (ecole_id, code) DO NOTHING;
*/

-- ── 7. EXEMPLE EXAMENS pour l'école test ────────────────────────────────
-- Après avoir créé les niveaux, créer les examens bloquants
-- Ex: examen après 1 hizb, 5 hizb, 15 hizb (configuré pour niveau hizb)
/*
INSERT INTO examens (ecole_id, niveau_id, nom, type_seuil, valeur_seuil, score_minimum, bloquant, ordre)
SELECT
  'VOTRE_ECOLE_ID',
  n.id,
  'Examen Hizb 1',
  'hizb', 1, 70, true, 1
FROM niveaux n WHERE n.ecole_id = 'VOTRE_ECOLE_ID' AND n.type = 'hizb' AND n.code = '2';

INSERT INTO examens (ecole_id, niveau_id, nom, type_seuil, valeur_seuil, score_minimum, bloquant, ordre)
SELECT
  'VOTRE_ECOLE_ID',
  n.id,
  'Examen 5 Hizb',
  'hizb', 5, 70, true, 2
FROM niveaux n WHERE n.ecole_id = 'VOTRE_ECOLE_ID' AND n.type = 'hizb' AND n.code = '2';

INSERT INTO examens (ecole_id, niveau_id, nom, type_seuil, valeur_seuil, score_minimum, bloquant, ordre)
SELECT
  'VOTRE_ECOLE_ID',
  n.id,
  'Examen 15 Hizb',
  'hizb', 15, 80, true, 3
FROM niveaux n WHERE n.ecole_id = 'VOTRE_ECOLE_ID' AND n.type = 'hizb' AND n.code = '2';
*/

-- ── 8. VÉRIFICATION ─────────────────────────────────────────────────────
SELECT 'niveaux' AS table_name, COUNT(*) FROM niveaux
UNION ALL
SELECT 'programmes', COUNT(*) FROM programmes
UNION ALL
SELECT 'examens', COUNT(*) FROM examens
UNION ALL
SELECT 'resultats_examens', COUNT(*) FROM resultats_examens;
