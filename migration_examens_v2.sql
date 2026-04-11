-- ══════════════════════════════════════════════════════════════════
-- MIGRATION EXAMENS V2 — Fusion blocs dans examens
-- Exécuter dans Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- 1. Ajouter les nouvelles colonnes à examens
ALTER TABLE examens 
  ADD COLUMN IF NOT EXISTS contenu_ids  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS type_contenu TEXT  NOT NULL DEFAULT 'hizb'
    CHECK (type_contenu IN ('hizb','sourate'));

-- 2. Supprimer les colonnes obsolètes
ALTER TABLE examens 
  DROP COLUMN IF EXISTS type_seuil,
  DROP COLUMN IF EXISTS valeur_seuil;

-- 3. Vérification
SELECT id, nom, niveau_id, type_contenu, contenu_ids, 
       score_minimum, bloquant, ordre, actif
FROM examens 
WHERE ecole_id = 'ca551668-d4d5-4535-ad9f-4c40241c6af9'
ORDER BY ordre;
