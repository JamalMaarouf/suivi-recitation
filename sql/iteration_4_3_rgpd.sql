-- ══════════════════════════════════════════════════════════════════════
-- ITÉRATION 4.3 — RGPD EXPORT JSON
-- Table de traçabilité des exports de données personnelles
--
-- Obligations RGPD couvertes :
--   - Art. 15 : droit d'accès (qui a exporté ses données et quand)
--   - Art. 20 : portabilité (format structuré JSON)
--   - Art. 30 : registre des traitements (audit trail)
--
-- Conforme loi marocaine 09-08 (CNDP).
-- ══════════════════════════════════════════════════════════════════════

-- Drop si existe (idempotent pour QA)
DROP TABLE IF EXISTS exports_rgpd CASCADE;

-- Table de journalisation des exports
CREATE TABLE exports_rgpd (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,              -- qui a exporté
  ecole_id        uuid NOT NULL,              -- contexte école
  export_scope    text NOT NULL,              -- 'self', 'self_plus_children'
  export_role     text NOT NULL,              -- 'parent','instituteur','surveillant','super_admin'
  nb_enfants      integer DEFAULT 0,          -- si parent : nombre d'enfants inclus
  nb_validations  integer DEFAULT 0,          -- volume de validations incluses
  nb_certificats  integer DEFAULT 0,          -- volume de certificats inclus
  file_size_bytes bigint,                     -- taille fichier genere (optionnel)
  user_agent      text,                       -- navigateur/device pour audit
  exported_at     timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- Index pour requêtes audit (qui a exporté quoi quand)
CREATE INDEX idx_exports_rgpd_user ON exports_rgpd(user_id, exported_at DESC);
CREATE INDEX idx_exports_rgpd_ecole ON exports_rgpd(ecole_id, exported_at DESC);

-- RLS permissive (auth custom de l'app, pas auth.uid() de Supabase)
ALTER TABLE exports_rgpd ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exports_rgpd_read_all" ON exports_rgpd
  FOR SELECT USING (true);

CREATE POLICY "exports_rgpd_insert_all" ON exports_rgpd
  FOR INSERT WITH CHECK (true);

-- Pas de UPDATE ni DELETE : logs immuables (audit trail legal)
-- En cas de besoin de purge après rétention, faire un batch admin séparé.

COMMENT ON TABLE exports_rgpd IS 'Journal d''audit des exports RGPD (conforme art. 30). Logs immuables.';
COMMENT ON COLUMN exports_rgpd.export_scope IS 'Périmètre : self = données personnelles seules, self_plus_children = parent + enfants';
