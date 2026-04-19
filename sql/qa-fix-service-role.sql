-- ═══════════════════════════════════════════════════════════════
-- FIX RLS — Ajout du rôle service_role aux policies
-- ═══════════════════════════════════════════════════════════════
-- À exécuter UNIQUEMENT sur le projet QA
-- 
-- Les policies actuelles couvrent anon + authenticated mais pas
-- service_role. L'API Vercel utilise service_role et se fait donc
-- bloquer par les policies. On ajoute service_role partout où
-- c'est nécessaire.
-- ═══════════════════════════════════════════════════════════════

-- Recrée les policies en incluant service_role
DROP POLICY IF EXISTS ecoles_all_public ON ecoles;
CREATE POLICY ecoles_all_public ON ecoles
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS utilisateurs_all_public ON utilisateurs;
CREATE POLICY utilisateurs_all_public ON utilisateurs
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);


-- ─── Donner aussi les GRANTs à service_role (par sécurité) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;


-- ─── Vérification ──────────────────────────────────────────
SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('ecoles', 'utilisateurs');
