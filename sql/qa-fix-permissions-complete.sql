-- ═══════════════════════════════════════════════════════════════
-- FIX COMPLET — Permissions QA
-- ═══════════════════════════════════════════════════════════════
-- À exécuter UNIQUEMENT sur le projet QA
-- 
-- Ce script corrige en profondeur les permissions :
--   1) GRANT niveaux base sur toutes les tables du schéma public
--      (nécessaire AVANT que les RLS policies puissent fonctionner)
--   2) RLS policies pour les rôles anon et authenticated
-- ═══════════════════════════════════════════════════════════════

-- ─── PARTIE 1 : GRANTs globaux ─────────────────────────────
-- Donne au rôle anon (clé publique) les permissions de base
-- sur toutes les tables du schéma public

-- Donne accès au schéma public
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Permissions SELECT/INSERT/UPDATE/DELETE sur toutes les tables existantes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Permissions sur les séquences (pour les auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Permissions sur les fonctions RPC
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Pour que les tables créées dans le futur héritent automatiquement
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;


-- ─── PARTIE 2 : Policies RLS améliorées ────────────────────
-- Recrée les policies sur ecoles et utilisateurs en ciblant
-- explicitement les rôles anon et authenticated

-- Ecoles : policies publiques (lecture, création, mise à jour)
DROP POLICY IF EXISTS ecoles_insert_public ON ecoles;
DROP POLICY IF EXISTS ecoles_select_public ON ecoles;
DROP POLICY IF EXISTS ecoles_update_public ON ecoles;

CREATE POLICY ecoles_all_public ON ecoles
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Utilisateurs : policies publiques
DROP POLICY IF EXISTS utilisateurs_insert_public ON utilisateurs;
DROP POLICY IF EXISTS utilisateurs_select_public ON utilisateurs;
DROP POLICY IF EXISTS utilisateurs_update_public ON utilisateurs;

CREATE POLICY utilisateurs_all_public ON utilisateurs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


-- ─── Vérification finale ───────────────────────────────────
-- Vérifie que les policies sont bien en place et appliquées aux bons rôles
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('ecoles', 'utilisateurs')
ORDER BY tablename, policyname;
