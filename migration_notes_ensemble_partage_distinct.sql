-- ============================================================
-- Migration : Separer ensemble_partage et ensemble_sourates
-- Date : 2026-05-05 (fix coexistence 2 modes)
-- ============================================================
--
-- Probleme detecte par Jamal en Prod :
-- 1. Bug ON CONFLICT : index partiels incompatibles avec upsert
-- 2. Bug 'critere existe' : impossible de mettre 'Hizb 60 partage' (3 pts/sourate)
--    ET 'Hizb 60 classique' (50 pts bonus) car stockes dans le meme type_action
--
-- Architecture pedagogique reelle :
-- - Mode 'ensemble_partage'   : points PAR sourate recitee (factorisation)
-- - Mode 'ensemble_sourates'  : note BONUS a la completion (bloque a la derniere sourate)
-- Les 2 doivent COEXISTER sur le meme objet_id (ensemble).
--
-- Solution : nouveau type_action='ensemble_partage' distinct en BDD.
-- ============================================================

-- 1. Supprimer l'ancien index partiel (incompatible ON CONFLICT)
DROP INDEX IF EXISTS bareme_notes_classique_unique;

-- 2. Recreer index UNIQUE pour 'ensemble_sourates' classique uniquement
-- Permet ON CONFLICT(ecole_id, type_action, objet_id) de fonctionner
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_classique_unique
  ON bareme_notes (ecole_id, type_action, objet_id)
  WHERE actif = true AND type_action != 'sourate_dans_ensemble' AND type_action != 'ensemble_partage';

-- 3. Index unique pour le NOUVEAU type 'ensemble_partage'
-- Coexiste avec 'ensemble_sourates' car type_action different
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_partage_unique
  ON bareme_notes (ecole_id, type_action, objet_id)
  WHERE actif = true AND type_action = 'ensemble_partage';

-- 4. Verification
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bareme_notes'
ORDER BY indexname;
