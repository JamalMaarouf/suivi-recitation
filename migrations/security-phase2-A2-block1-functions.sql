-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION SECURITE A2 : RLS STRICT AVEC ISOLATION MULTI-ECOLES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Auteur : Claude (audit securite Phase A2)
-- Date : 2026-05-18
-- Application : QA d'abord, puis Prod si tests OK
--
-- OBJECTIF
-- ========
-- Apres A1 (RLS activee avec policies permissives), un attaquant authentifie
-- pouvait theoriquement requetter les donnees d'autres ecoles via DevTools.
-- A2 ferme cette derniere faille en filtrant strictement par ecole_id.
--
-- STRATEGIE A2.1 (validee par Jamal)
-- ===================================
-- - Auth custom conservee (pas de migration vers Supabase Auth natif)
-- - Headers HTTP custom envoyes par le frontend :
--   * x-tartily-ecole  : UUID de l'ecole de l'utilisateur connecte (surveillant)
--   * x-tartily-parent : UUID du parent connecte (portail parent)
-- - Fonctions Postgres lisent ces headers via current_setting('request.headers')
-- - Policies RLS filtrent automatiquement par ecole_id / parent_id
--
-- LIMITATION ASSUMEE (sera durcie en A2.2 plus tard)
-- ===================================================
-- Les headers peuvent etre FALSIFIES par un attaquant via DevTools/Postman.
-- Cela arrete les attaques opportunistes (99% des cas), mais pas un attaquant
-- determine qui :
-- - Connait la structure de l'API
-- - Sait modifier ses headers HTTP
-- - A des notions de Supabase
-- Pour fermer le 1% restant, A2.2 ajoutera des JWT signes cryptographiquement
-- (a faire quand plus de 5 ecoles en Prod).
--
-- DECISIONS VALIDEES PAR JAMAL
-- =============================
-- Q1=C : table 'utilisateurs' garde policy permissive (bcrypt protege le hash)
-- Q2=OUI : exception pour inscription publique (INSERT ecoles + utilisateurs)
-- Q3=alpha : page Verify reste publique sur 7 tables (obscurite par numero)
--
-- CATEGORISATION DES 45 TABLES
-- =============================
-- CAT A (35 tables) : isolation stricte par ecole_id
-- CAT B (3 tables)  : isolation hybride ecole_id ou parent_id
-- CAT C (1 table)   : isolation par parent_id seul (parent_eleve)
-- CAT D (4 tables)  : tables racine sans ecole_id direct (JOIN)
-- CAT E (3 tables)  : reference publique en lecture seule
-- CAT F (2 tables)  : tables systeme (acces tres restreint)
-- + utilisateurs : exception Q1=C (permissive)
--
-- ROLLBACK SI PROBLEME
-- ====================
-- Voir migrations/security-phase2-A2-rollback.sql
-- (re-installe les policies permissives A1)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- BLOC 1 : FONCTIONS POSTGRES CUSTOM
-- ─────────────────────────────────────────────────────────────────────────

-- Lit l'UUID de l'ecole courante depuis le header HTTP 'x-tartily-ecole'.
-- Retourne NULL si le header n'est pas present (= utilisateur non connecte
-- ou en cours d'inscription publique).
CREATE OR REPLACE FUNCTION public.current_ecole_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    (current_setting('request.headers', true)::json ->> 'x-tartily-ecole'),
    ''
  )::uuid;
$$;

-- Lit l'UUID du parent courant depuis le header HTTP 'x-tartily-parent'.
-- Retourne NULL si le header n'est pas present (= pas un parent connecte).
CREATE OR REPLACE FUNCTION public.current_parent_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    (current_setting('request.headers', true)::json ->> 'x-tartily-parent'),
    ''
  )::uuid;
$$;

-- Helper : check si l'utilisateur courant peut acceder a une ecole donnee
-- Renvoie TRUE si :
-- - l'utilisateur est connecte avec cet ecole_id (surveillant)
-- - OU le parent connecte est rattache a un eleve de cette ecole
CREATE OR REPLACE FUNCTION public.can_access_ecole(target_ecole_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Cas surveillant : ecole_id du header match
    (public.current_ecole_id() IS NOT NULL AND public.current_ecole_id() = target_ecole_id)
    OR
    -- Cas parent : parent rattache a au moins 1 eleve de cette ecole
    (public.current_parent_id() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.parent_eleve pe
      JOIN public.eleves e ON e.id = pe.eleve_id
      WHERE pe.parent_id = public.current_parent_id()
        AND e.ecole_id = target_ecole_id
    ));
$$;

-- Grant execution aux roles anon (frontend) et authenticated (Supabase Auth si jamais utilise)
GRANT EXECUTE ON FUNCTION public.current_ecole_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_parent_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_ecole(uuid) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTANT : LES POLICIES A2 NE SONT PAS DANS CE FICHIER
-- ═══════════════════════════════════════════════════════════════════════════
-- Pour faciliter le debug par bloc et permettre des rollbacks granulaires,
-- les nouvelles policies sont dans des fichiers separes :
--
-- - security-phase2-A2-block-A.sql : 35 tables avec ecole_id (CAT A)
-- - security-phase2-A2-block-B.sql : 3 tables hybrides (CAT B)
-- - security-phase2-A2-block-C.sql : 1 table parent_eleve (CAT C)
-- - security-phase2-A2-block-D.sql : 4 tables racine + JOIN (CAT D)
-- - security-phase2-A2-block-E.sql : 3 tables reference publique (CAT E)
-- - security-phase2-A2-block-F.sql : 2 tables systeme (CAT F)
-- - security-phase2-A2-block-G.sql : exceptions (inscription, verify)
--
-- Ordre d'application : Bloc 1 (ce fichier) -> A -> B -> C -> D -> E -> F -> G
-- Apres chaque bloc : tester l'app QA pour detecter d'eventuelles regressions
-- ═══════════════════════════════════════════════════════════════════════════
