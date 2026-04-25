-- ══════════════════════════════════════════════════════════════════════
-- SOFT-DELETE — Élèves & Utilisateurs (parents/instituteurs)
-- À executer sur QA puis sur Prod (idempotent)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Colonnes soft-delete sur eleves
ALTER TABLE eleves ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE eleves ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Index partiel pour accelerer les requetes sur eleves non supprimes
CREATE INDEX IF NOT EXISTS idx_eleves_non_deleted ON eleves(ecole_id) WHERE deleted_at IS NULL;

-- 2. Colonnes soft-delete sur utilisateurs (parents + instituteurs + surveillants)
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Index partiel pour requetes sur utilisateurs non supprimes
CREATE INDEX IF NOT EXISTS idx_users_non_deleted ON utilisateurs(ecole_id, role) WHERE deleted_at IS NULL;

-- 3. Commentaires de documentation
COMMENT ON COLUMN eleves.deleted_at IS 'Timestamp de soft-delete. NULL = element actif.';
COMMENT ON COLUMN eleves.deleted_by IS 'ID de utilisateur qui a effectue le soft-delete.';
COMMENT ON COLUMN utilisateurs.deleted_at IS 'Timestamp de soft-delete. NULL = element actif.';
COMMENT ON COLUMN utilisateurs.deleted_by IS 'ID de utilisateur qui a effectue le soft-delete.';

-- 4. Verification
-- Apres execution, doit retourner 4 lignes :
SELECT table_name, column_name FROM information_schema.columns
WHERE table_name IN ('eleves','utilisateurs')
  AND column_name IN ('deleted_at','deleted_by')
ORDER BY table_name, column_name;
