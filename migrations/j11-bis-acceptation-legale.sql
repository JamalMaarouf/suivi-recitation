-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION J11-BIS : Traçabilité acceptation CGU + Politique de Confidentialité
-- ═══════════════════════════════════════════════════════════════════════════
-- Objectif : permettre la traçabilité juridique de l'acceptation des
-- conditions par les écoles lors de leur inscription.
--
-- LEGAL : RGPD + Loi marocaine 09-08 imposent de pouvoir prouver que
-- l'utilisateur a accepté les conditions à un instant T. Cette migration
-- ajoute les champs nécessaires sur la table `ecoles`.
--
-- VERSIONING : si on modifie les CGU ou la Confidentialité plus tard, on
-- incrémente CGU_VERSION ou PRIVACY_VERSION dans le code. Les écoles qui
-- ont accepté une version antérieure pourront être détectées (mismatch
-- entre version stockée et version courante) -> on demandera la
-- re-acceptation lors de leur prochaine connexion.
--
-- À APPLIQUER : sur Prod ET QA Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- Colonnes acceptation CGU
ALTER TABLE ecoles
  ADD COLUMN IF NOT EXISTS cgu_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cgu_version TEXT;

-- Colonnes acceptation Politique de Confidentialité
ALTER TABLE ecoles
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS privacy_version TEXT;

-- Index pour requêter rapidement les écoles avec une version périmée
-- (utile si on veut envoyer des notifications de re-acceptation)
CREATE INDEX IF NOT EXISTS idx_ecoles_cgu_version
  ON ecoles(cgu_version) WHERE cgu_version IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecoles_privacy_version
  ON ecoles(privacy_version) WHERE privacy_version IS NOT NULL;

-- ── COMMENTAIRES POUR DOCUMENTATION ─────────────────────────────────────
COMMENT ON COLUMN ecoles.cgu_accepted_at IS 'Date/heure d''acceptation des CGU lors de l''inscription (RGPD/09-08)';
COMMENT ON COLUMN ecoles.cgu_version IS 'Version des CGU acceptées (ex: 1.0). À comparer avec CGU_VERSION du code pour détecter une version périmée.';
COMMENT ON COLUMN ecoles.privacy_accepted_at IS 'Date/heure d''acceptation de la Politique de Confidentialité';
COMMENT ON COLUMN ecoles.privacy_version IS 'Version de la Politique de Confidentialité acceptée (ex: 1.0)';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION POST-MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Apres execution, vérifier avec :
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'ecoles' AND column_name LIKE '%accepted%' OR column_name LIKE '%version%';
-- ═══════════════════════════════════════════════════════════════════════════
