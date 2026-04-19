-- ═══════════════════════════════════════════════════════════════
-- CRÉATION DU COMPTE SUPER ADMIN — QA
-- ═══════════════════════════════════════════════════════════════
-- À exécuter UNIQUEMENT sur le projet QA
-- 
-- Ce script crée un compte super admin pour tester la QA.
-- Identifiant de connexion : superadmin-qa
-- Mot de passe             : qatest2026
--
-- ⚠️ Ce compte n'existe QUE sur la QA. Il ne permet PAS de se
--    connecter à la Prod.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO utilisateurs (
  id,
  prenom,
  nom,
  identifiant,
  mot_de_passe,
  role,
  statut_compte,
  ecole_id
) VALUES (
  gen_random_uuid(),
  'Super',
  'Admin QA',
  'superadmin-qa',
  '$2b$10$Eoe9MRzqJCHO8MLGyUPUN.3wXP3GaUF2L.w6gDY94ffyubb8XxBhG',  -- hash de 'qatest2026'
  'super_admin',
  'actif',
  NULL  -- super admin n'est rattaché à aucune école
)
ON CONFLICT (identifiant) DO NOTHING;

-- Vérification : affiche le compte créé
SELECT
  id,
  prenom,
  nom,
  identifiant,
  role,
  statut_compte,
  created_at
FROM utilisateurs
WHERE identifiant = 'superadmin-qa';
