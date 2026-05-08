-- ============================================================
-- Migration : Notes par sourate dans un ensemble (Mode 3)
-- Date : 2026-05-08
-- ============================================================
--
-- Contexte :
-- Pour aligner les totaux des notes entre eleves recitant en
-- Hizb et eleves recitant en sourates, le surveillant doit
-- pouvoir attribuer une note PAR SOURATE dans le contexte d'un
-- ensemble (ex: chaque sourate de Hizb 60 = 3 pts).
--
-- Strategie :
-- - Nouveau type_action = 'sourate_dans_ensemble' dans bareme_notes
-- - Ajout colonne sourate_id (INTEGER, nullable) pour cibler la sourate
-- - Ajout colonne groupe_factorisation (TEXT, nullable) pour grouper
--   les criteres saisis ensemble (factorisation UX)
-- ============================================================

-- 1. Ajouter colonne sourate_id (nullable, ne casse pas l'existant)
ALTER TABLE bareme_notes
  ADD COLUMN IF NOT EXISTS sourate_id INTEGER;

-- 2. Ajouter colonne groupe_factorisation (pour identifier les criteres
-- saisis ensemble dans une session de factorisation)
ALTER TABLE bareme_notes
  ADD COLUMN IF NOT EXISTS groupe_factorisation TEXT;

-- 3. Supprimer ancien index unique pour le recreer avec sourate_id
DROP INDEX IF EXISTS bareme_notes_classique_unique;
DROP INDEX IF EXISTS bareme_notes_sourate_unique;

-- 4. Index unique pour les types CLASSIQUES (sans sourate_dans_ensemble)
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_classique_unique
  ON bareme_notes (ecole_id, type_action, objet_id)
  WHERE actif = true AND type_action != 'sourate_dans_ensemble';

-- 5. Index unique pour le NOUVEAU type sourate_dans_ensemble
-- (cle = ecole + type + ensemble + sourate)
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_sourate_in_ens_unique
  ON bareme_notes (ecole_id, type_action, objet_id, sourate_id)
  WHERE actif = true AND type_action = 'sourate_dans_ensemble';

-- 6. Verification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bareme_notes'
ORDER BY ordinal_position;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bareme_notes'
ORDER BY indexname;
