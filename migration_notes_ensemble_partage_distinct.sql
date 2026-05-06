-- ============================================================
-- Migration : Separer ensemble_partage et ensemble_sourates
-- Date : 2026-05-05 (fix coexistence 2 modes + bug ON CONFLICT)
-- ============================================================
--
-- Probleme detecte par Jamal en Prod :
-- 1. Bug ON CONFLICT : index partiels (avec WHERE) incompatibles avec upsert
--    -> 'there is no unique or exclusion constraint matching the ON CONFLICT specification'
-- 2. Bug 'critere existe' : impossible de mettre 'Hizb 60 partage' (3 pts/sourate)
--    ET 'Hizb 60 classique' (50 pts bonus) car stockes dans le meme type_action
--
-- Architecture pedagogique reelle :
-- - Mode 'ensemble_partage'   : points PAR sourate recitee (factorisation)
-- - Mode 'ensemble_sourates'  : note BONUS a la completion (bloque a la derniere sourate)
-- Les 2 doivent COEXISTER sur le meme objet_id (ensemble).
--
-- Solution :
-- Le code applicatif (saveBaremeItem) gere les conflits cote client via
-- DELETE + INSERT (au lieu de UPSERT) pour eviter le probleme ON CONFLICT
-- avec les index partiels.
--
-- En BDD, on garde des index partiels QUI VALIDENT l'unicite metier mais
-- ne sont PAS utilises par ON CONFLICT (le code n'en a plus besoin).
-- ============================================================

-- 1. Nettoyage des anciens index partiels qui posaient probleme
DROP INDEX IF EXISTS bareme_notes_classique_unique;
DROP INDEX IF EXISTS bareme_notes_partage_unique;
DROP INDEX IF EXISTS bareme_notes_sourate_unique;
DROP INDEX IF EXISTS idx_bareme_notes_sourate_dans_ensemble;

-- 2. Index unique CONDITIONNELS pour validation metier
-- Mode classique (ensemble_sourates, examen, jalon, etc.) : 1 ligne par (ecole, type, objet)
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_classique_unique
  ON bareme_notes (ecole_id, type_action, objet_id)
  WHERE actif = true
    AND type_action != 'sourate_dans_ensemble'
    AND type_action != 'ensemble_partage';

-- Mode partage : 1 ligne par (ecole, objet) car type_action='ensemble_partage' force
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_partage_unique
  ON bareme_notes (ecole_id, type_action, objet_id)
  WHERE actif = true AND type_action = 'ensemble_partage';

-- Mode sourate dans ensemble : 1 ligne par (ecole, objet, sourate)
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_sourate_unique
  ON bareme_notes (ecole_id, type_action, objet_id, sourate_id)
  WHERE actif = true AND type_action = 'sourate_dans_ensemble';

-- 3. Verification
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bareme_notes'
ORDER BY indexname;

-- Resultat attendu :
-- bareme_notes_classique_unique
-- bareme_notes_partage_unique
-- bareme_notes_pkey
-- bareme_notes_sourate_unique
-- idx_bareme_ecole (informatif)
