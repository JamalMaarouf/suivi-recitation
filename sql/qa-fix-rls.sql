-- ═══════════════════════════════════════════════════════════════
-- FIX RLS — Permissions pour l'inscription d'école
-- ═══════════════════════════════════════════════════════════════
-- À exécuter UNIQUEMENT sur le projet QA (pas Prod)
-- Corrige l'erreur "permission denied for table ecoles" lors
-- de l'inscription d'une nouvelle école.
-- ═══════════════════════════════════════════════════════════════

-- L'inscription d'une école nécessite 2 permissions :
-- 1) INSERT sur la table ecoles
-- 2) INSERT sur la table utilisateurs (le surveillant général)

-- ─── 1) Policy INSERT sur ecoles ────────────────────────────
-- Autorise la création d'une nouvelle école (publiquement)
DROP POLICY IF EXISTS ecoles_insert_public ON ecoles;
CREATE POLICY ecoles_insert_public ON ecoles
  FOR INSERT
  WITH CHECK (true);

-- ─── 2) Policy INSERT sur utilisateurs ──────────────────────
-- Autorise la création du compte surveillant lors de l'inscription
DROP POLICY IF EXISTS utilisateurs_insert_public ON utilisateurs;
CREATE POLICY utilisateurs_insert_public ON utilisateurs
  FOR INSERT
  WITH CHECK (true);

-- ─── 3) Policy SELECT sur ecoles ────────────────────────────
-- Pour que l'app puisse lire la liste des écoles (utile au login)
DROP POLICY IF EXISTS ecoles_select_public ON ecoles;
CREATE POLICY ecoles_select_public ON ecoles
  FOR SELECT
  USING (true);

-- ─── 4) Policy SELECT sur utilisateurs ──────────────────────
-- Pour que l'app puisse vérifier un login
DROP POLICY IF EXISTS utilisateurs_select_public ON utilisateurs;
CREATE POLICY utilisateurs_select_public ON utilisateurs
  FOR SELECT
  USING (true);

-- ─── 5) Policy UPDATE sur utilisateurs ──────────────────────
-- Pour que l'API auth puisse updater derniere_connexion, mot_de_passe, etc.
DROP POLICY IF EXISTS utilisateurs_update_public ON utilisateurs;
CREATE POLICY utilisateurs_update_public ON utilisateurs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ─── 6) Policy UPDATE sur ecoles ────────────────────────────
-- Pour que le super admin puisse activer/suspendre des écoles
DROP POLICY IF EXISTS ecoles_update_public ON ecoles;
CREATE POLICY ecoles_update_public ON ecoles
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ─── Vérification ───────────────────────────────────────────
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE tablename IN ('ecoles', 'utilisateurs')
ORDER BY tablename, policyname;
