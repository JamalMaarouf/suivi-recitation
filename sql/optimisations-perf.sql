-- ============================================================================
-- OPTIMISATIONS PERFORMANCE - À exécuter UNE FOIS dans le SQL Editor Supabase
-- ============================================================================
-- Ce script est 100% sûr :
-- - Il ne modifie AUCUNE donnée existante
-- - Il ne supprime RIEN
-- - Il ajoute uniquement des indexes (accélération des lectures) et une fonction
--   RPC qui pré-calcule les stats des élèves côté serveur.
--
-- Pour l'exécuter :
-- 1. Va sur https://supabase.com/dashboard → ton projet → SQL Editor
-- 2. Clique "New query"
-- 3. Copie-colle TOUT ce fichier
-- 4. Clique "Run" (ou Ctrl+Enter)
-- 5. Tu dois voir "Success. No rows returned" en bas
-- ============================================================================

-- ─── 1. INDEXES pour accélérer les lectures filtrées ─────────────────────────
-- Ces indexes permettent à PostgreSQL de trouver instantanément les lignes
-- qui matchent ecole_id + eleve_id au lieu de scanner toute la table.

CREATE INDEX IF NOT EXISTS idx_validations_ecole_eleve
  ON validations (ecole_id, eleve_id);

CREATE INDEX IF NOT EXISTS idx_validations_ecole_date
  ON validations (ecole_id, date_validation DESC);

CREATE INDEX IF NOT EXISTS idx_recitations_ecole_eleve
  ON recitations_sourates (ecole_id, eleve_id);

CREATE INDEX IF NOT EXISTS idx_recitations_ecole_date
  ON recitations_sourates (ecole_id, date_validation DESC);

CREATE INDEX IF NOT EXISTS idx_eleves_ecole
  ON eleves (ecole_id);

-- ─── 2. RPC qui pré-calcule les stats Dashboard en une seule requête ─────────
-- Au lieu de télécharger 5000 validations + recitations + élèves sur le
-- téléphone puis de tout agréger en JavaScript, on fait tout côté serveur
-- PostgreSQL (beaucoup plus rapide) et on renvoie seulement les stats par élève.

CREATE OR REPLACE FUNCTION get_eleves_stats(p_ecole_id uuid)
RETURNS TABLE (
  eleve_id uuid,
  prenom text,
  nom text,
  code_niveau text,
  niveau text,
  hizb_depart integer,
  tomon_depart integer,
  sourates_acquises integer,
  instituteur_referent_id uuid,
  eleve_id_ecole text,
  -- Stats agrégées
  tomon_cumul integer,
  hizb_complets_count integer,
  validation_count integer,
  derniere_validation timestamp with time zone,
  derniere_recitation timestamp with time zone,
  recitations_completes_count integer
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    e.id AS eleve_id,
    e.prenom,
    e.nom,
    e.code_niveau,
    e.niveau,
    e.hizb_depart,
    e.tomon_depart,
    e.sourates_acquises,
    e.instituteur_referent_id,
    e.eleve_id_ecole,
    COALESCE(v_stats.tomon_cumul, 0)::integer AS tomon_cumul,
    COALESCE(v_stats.hizb_complets_count, 0)::integer AS hizb_complets_count,
    COALESCE(v_stats.validation_count, 0)::integer AS validation_count,
    v_stats.derniere_validation,
    r_stats.derniere_recitation,
    COALESCE(r_stats.recitations_completes_count, 0)::integer AS recitations_completes_count
  FROM eleves e
  LEFT JOIN LATERAL (
    SELECT
      -- Somme des tomons (hors muraja)
      SUM(CASE WHEN v.type_validation = 'tomon' THEN v.nombre_tomon ELSE 0 END)::integer AS tomon_cumul,
      -- Nombre de hizb complets distincts
      COUNT(DISTINCT CASE WHEN v.type_validation = 'hizb_complet' THEN v.hizb_valide END)::integer AS hizb_complets_count,
      COUNT(*)::integer AS validation_count,
      MAX(v.date_validation) AS derniere_validation
    FROM validations v
    WHERE v.eleve_id = e.id
      AND v.ecole_id = e.ecole_id
  ) v_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      MAX(r.date_validation) AS derniere_recitation,
      COUNT(CASE WHEN r.type_recitation = 'complete' THEN 1 END)::integer AS recitations_completes_count
    FROM recitations_sourates r
    WHERE r.eleve_id = e.id
      AND r.ecole_id = e.ecole_id
  ) r_stats ON true
  WHERE e.ecole_id = p_ecole_id
  ORDER BY e.nom;
$$;

-- Donner les permissions d'appel aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_eleves_stats(uuid) TO authenticated, anon;

-- ─── 3. RPC pour le classement par points (ListeNotes) ───────────────────────
-- Pré-calcule les points totaux par élève sur une période donnée.

CREATE OR REPLACE FUNCTION get_classement_notes(
  p_ecole_id uuid,
  p_date_debut timestamp with time zone DEFAULT '2000-01-01'::timestamp with time zone,
  p_date_fin timestamp with time zone DEFAULT now()
)
RETURNS TABLE (
  eleve_id uuid,
  prenom text,
  nom text,
  code_niveau text,
  eleve_id_ecole text,
  instituteur_referent_id uuid,
  tomon_periode integer,
  hizb_periode integer,
  validations_periode integer
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    e.id AS eleve_id,
    e.prenom,
    e.nom,
    e.code_niveau,
    e.eleve_id_ecole,
    e.instituteur_referent_id,
    COALESCE(SUM(CASE WHEN v.type_validation = 'tomon' THEN v.nombre_tomon ELSE 0 END), 0)::integer AS tomon_periode,
    COALESCE(COUNT(DISTINCT CASE WHEN v.type_validation = 'hizb_complet' THEN v.hizb_valide END), 0)::integer AS hizb_periode,
    COALESCE(COUNT(v.id), 0)::integer AS validations_periode
  FROM eleves e
  LEFT JOIN validations v
    ON v.eleve_id = e.id
    AND v.ecole_id = e.ecole_id
    AND v.date_validation >= p_date_debut
    AND v.date_validation <= p_date_fin
  WHERE e.ecole_id = p_ecole_id
  GROUP BY e.id, e.prenom, e.nom, e.code_niveau, e.eleve_id_ecole, e.instituteur_referent_id
  ORDER BY tomon_periode DESC, hizb_periode DESC;
$$;

GRANT EXECUTE ON FUNCTION get_classement_notes(uuid, timestamp with time zone, timestamp with time zone) TO authenticated, anon;

-- ============================================================================
-- FIN DU SCRIPT - Tu peux supprimer ce script après exécution, ou le garder
-- comme documentation.
-- ============================================================================
-- Pour vérifier que tout est bien en place :
--   SELECT * FROM get_eleves_stats('TON_ECOLE_ID'::uuid) LIMIT 3;
-- ============================================================================
