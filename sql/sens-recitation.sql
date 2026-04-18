-- ═══════════════════════════════════════════════════════════════════
-- Migration : Sens de récitation (croissant / décroissant)
-- Date : 2026-04-18
-- ═══════════════════════════════════════════════════════════════════

-- 1) Ajouter une colonne sens_recitation_defaut sur la table ecoles
-- Cette valeur est le défaut pour TOUS les niveaux de l'école
ALTER TABLE ecoles
ADD COLUMN IF NOT EXISTS sens_recitation_defaut text DEFAULT 'desc'
CHECK (sens_recitation_defaut IN ('desc','asc'));

COMMENT ON COLUMN ecoles.sens_recitation_defaut IS
  'Sens de récitation par défaut pour les niveaux de cette école. desc = Hizb 60 → 1 / Sourate 114 → 1. asc = inverse.';

-- 2) Ajouter une colonne sens_recitation sur la table niveaux
-- NULL = utiliser la valeur par défaut de l'école
-- 'desc' ou 'asc' = surcharge spécifique à ce niveau
ALTER TABLE niveaux
ADD COLUMN IF NOT EXISTS sens_recitation text DEFAULT NULL
CHECK (sens_recitation IS NULL OR sens_recitation IN ('desc','asc'));

COMMENT ON COLUMN niveaux.sens_recitation IS
  'Sens spécifique à ce niveau. NULL = utilise ecoles.sens_recitation_defaut.';

-- 3) S'assurer que les écoles existantes ont 'desc' comme défaut
-- (au cas où la colonne existait déjà avec NULL)
UPDATE ecoles SET sens_recitation_defaut = 'desc' WHERE sens_recitation_defaut IS NULL;

-- 4) RPC helper : récupérer le sens effectif d'un niveau
-- Retourne le sens du niveau s'il est défini, sinon le défaut de l'école
CREATE OR REPLACE FUNCTION get_sens_niveau(p_niveau_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(n.sens_recitation, e.sens_recitation_defaut, 'desc')
  FROM niveaux n
  LEFT JOIN ecoles e ON e.id = n.ecole_id
  WHERE n.id = p_niveau_id;
$$;

GRANT EXECUTE ON FUNCTION get_sens_niveau(uuid) TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════
-- Verification : afficher les ecoles et niveaux avec leurs sens
-- ═══════════════════════════════════════════════════════════════════
SELECT
  e.nom AS ecole,
  e.sens_recitation_defaut AS defaut_ecole,
  COUNT(n.id) AS nb_niveaux,
  COUNT(n.sens_recitation) AS nb_niveaux_surcharges
FROM ecoles e
LEFT JOIN niveaux n ON n.ecole_id = e.id
GROUP BY e.id, e.nom, e.sens_recitation_defaut
ORDER BY e.nom;
