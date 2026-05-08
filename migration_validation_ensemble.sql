-- ============================================================
-- Migration : Validation des ensembles de sourates
-- Date : 2026-05-08
-- ============================================================
--
-- Contexte :
-- Pour les niveaux recitant en sourates, blocage de la progression
-- a la derniere sourate de chaque ensemble. Le surveillant valide
-- l'ensemble, debloquant ainsi la progression.
--
-- Strategie : reutiliser la table 'validations' existante avec un
-- nouveau type_validation='ensemble_valide' + nouvelle colonne
-- ensemble_id pour identifier l'ensemble valide.
-- ============================================================

-- 1. Nouvelle colonne ensemble_id (nullable, ne casse pas l'existant)
ALTER TABLE validations
  ADD COLUMN IF NOT EXISTS ensemble_id UUID;

-- 2. Index pour recherche rapide (eleve, ensemble valide)
CREATE INDEX IF NOT EXISTS idx_validations_ensemble
  ON validations (eleve_id, ensemble_id)
  WHERE type_validation = 'ensemble_valide';

-- 3. Verification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'validations'
ORDER BY ordinal_position;
