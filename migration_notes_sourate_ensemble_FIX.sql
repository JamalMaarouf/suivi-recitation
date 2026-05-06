-- ============================================================
-- Migration FIX : contrainte unique pour notes par sourate
-- Date : 2026-05-05 (fix bug enregistrement)
-- ============================================================
--
-- Probleme detecte par Jamal en QA :
-- L'enregistrement de plusieurs notes pour le meme ensemble
-- (sourates differentes) ne fonctionnait pas. Tout etait perdu.
--
-- Cause :
-- L'index unique existant 'bareme_notes_ecole_type_objet_key'
-- portait sur (ecole_id, type_action, objet_id). Donc 6 lignes
-- avec le meme objet_id (meme ensemble) mais des sourate_id
-- differents declenchaient le upsert qui ECRASE au lieu d'ajouter.
--
-- Solution :
-- Remplacer l'index unique par un index conditionnel qui inclut
-- sourate_id pour le type 'sourate_dans_ensemble'.
-- ============================================================

-- 1. Supprimer l'ancien index unique (qui ne supportait pas sourate_id)
DROP INDEX IF EXISTS bareme_notes_ecole_type_objet_key;

-- 2. Creer 2 index uniques distincts :

-- Index 2a : pour les types CLASSIQUES (examen, ensemble_sourates, jalon)
-- = unicite sur (ecole_id, type_action, objet_id) SAUF pour sourate_dans_ensemble
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_classique_unique
  ON bareme_notes (ecole_id, type_action, objet_id)
  WHERE actif = true AND type_action != 'sourate_dans_ensemble';

-- Index 2b : pour le NOUVEAU type sourate_dans_ensemble
-- = unicite sur (ecole_id, type_action, objet_id, sourate_id)
-- Permet plusieurs lignes avec meme ensemble mais sourates differentes
CREATE UNIQUE INDEX IF NOT EXISTS bareme_notes_sourate_unique
  ON bareme_notes (ecole_id, type_action, objet_id, sourate_id)
  WHERE actif = true AND type_action = 'sourate_dans_ensemble';

-- 3. Verification
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bareme_notes'
ORDER BY indexname;
