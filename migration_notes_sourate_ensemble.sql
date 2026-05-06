-- ============================================================
-- Migration : Notes par sourate spécifique dans un ensemble
-- Date : 2026-05-05
-- Auteur : Jamal Maarouf (suite onboarding surveillant)
-- ============================================================
--
-- Contexte :
-- Le surveillant souhaite pouvoir attribuer une note specifique
-- a UNE sourate donnee dans le contexte d'un ensemble, en plus
-- de la note globale de l'ensemble.
--
-- Exemple :
--   Ensemble "Petites sourates 5A" -> note globale = 5 pts/sourate
--   Mais sourate "Al-Mulk" dans cet ensemble -> note specifique = 10 pts
--
-- Strategie :
-- Au lieu de creer une nouvelle table, on etend la table existante
-- bareme_notes en ajoutant une colonne sourate_id (nullable) et un
-- nouveau type_action = 'sourate_dans_ensemble'.
--
-- Logique:
--   - type_action='sourate_dans_ensemble', objet_id=ensemble_id, sourate_id=numero_sourate
--   - Une cle unique (ecole_id, type_action, objet_id, sourate_id)
--     pour eviter les doublons
-- ============================================================

-- 1. Ajouter colonne sourate_id (INT, nullable)
ALTER TABLE bareme_notes
  ADD COLUMN IF NOT EXISTS sourate_id INTEGER;

-- 2. Index pour les recherches rapides (lookup au calcul des points)
CREATE INDEX IF NOT EXISTS idx_bareme_notes_sourate_dans_ensemble
  ON bareme_notes (ecole_id, type_action, objet_id, sourate_id)
  WHERE type_action = 'sourate_dans_ensemble' AND actif = true;

-- 3. Contrainte d'unicite : une seule note par (ecole, type, ensemble, sourate)
-- Note : on supprime l'ancien index/contrainte d'unicite si elle existait
-- pour la recreer avec sourate_id inclus.
-- En cas de conflit (sourate_id NULL pour les anciens types), on utilise
-- COALESCE pour traiter les NULL comme une valeur fictive.
DROP INDEX IF EXISTS bareme_notes_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_unique_idx
  ON bareme_notes (ecole_id, type_action, COALESCE(objet_id::text, ''), COALESCE(sourate_id, -1))
  WHERE actif = true;

-- 4. Verification
-- Pour tester :
-- INSERT INTO bareme_notes (ecole_id, type_action, objet_id, sourate_id, points, actif)
-- VALUES ('UUID_ECOLE', 'sourate_dans_ensemble', 'UUID_ENSEMBLE', 67, 10, true);
-- (sourate 67 = Al-Mulk dans l'ensemble UUID_ENSEMBLE pour 10 pts)
