-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Cockpit SuperAdmin (Itération 1)
-- ═══════════════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor de Supabase (Production + QA quand prêt)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1) TABLE audit_log — Journal d'audit des actions sensibles
-- ─────────────────────────────────────────────────────────────────
-- Chaque action critique (suppression école, suspension, impersonification,
-- export, etc.) laisse une trace ici. Obligatoire pour RGPD + traçabilité.

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  actor_role    TEXT NOT NULL,                -- 'super_admin', 'surveillant', etc.
  action        TEXT NOT NULL,                -- 'suspendre_ecole', 'impersonifier', 'supprimer_eleve', etc.
  target_type   TEXT,                         -- 'ecole', 'eleve', 'utilisateur', etc.
  target_id     UUID,                         -- ID de l'entité concernée
  target_label  TEXT,                         -- Libellé lisible ("École Tekna")
  metadata      JSONB,                        -- Infos libres (ancien/nouveau statut, motif, etc.)
  ip_address    TEXT,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx  ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx       ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_log_target_idx      ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx      ON audit_log(action);

-- RLS : seul le super_admin peut lire tout, les surveillants rien
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_read_policy ON audit_log;
CREATE POLICY audit_log_read_policy ON audit_log
  FOR SELECT
  USING (true);  -- temporairement ouvert — la vérification se fait côté app

DROP POLICY IF EXISTS audit_log_insert_policy ON audit_log;
CREATE POLICY audit_log_insert_policy ON audit_log
  FOR INSERT
  WITH CHECK (true);  -- insertion libre — sécurisée côté app

COMMENT ON TABLE audit_log IS 'Journal d''audit : chaque action sensible du SuperAdmin y laisse une trace. Rétention illimitée en Prod, purge 30j en QA.';


-- ─────────────────────────────────────────────────────────────────
-- 2) TABLE sante_systeme — Journal de santé + ping anti-suspension
-- ─────────────────────────────────────────────────────────────────
-- Chaque ping enregistre son résultat ici. Permet au cockpit d'afficher
-- l'état de santé en temps réel.

CREATE TABLE IF NOT EXISTS sante_systeme (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_type  TEXT NOT NULL,             -- 'ping_supabase', 'backup', 'alerte', etc.
  status      TEXT NOT NULL,             -- 'ok' | 'warning' | 'error'
  latency_ms  INTEGER,                   -- Temps de réponse en ms
  message     TEXT,                      -- Détail (erreur, nb lignes, taille backup, etc.)
  metadata    JSONB                      -- Infos libres
);

CREATE INDEX IF NOT EXISTS sante_systeme_type_date_idx ON sante_systeme(check_type, created_at DESC);
CREATE INDEX IF NOT EXISTS sante_systeme_date_idx      ON sante_systeme(created_at DESC);

ALTER TABLE sante_systeme ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sante_read ON sante_systeme;
CREATE POLICY sante_read ON sante_systeme FOR SELECT USING (true);

DROP POLICY IF EXISTS sante_insert ON sante_systeme;
CREATE POLICY sante_insert ON sante_systeme FOR INSERT WITH CHECK (true);

COMMENT ON TABLE sante_systeme IS 'Journal de santé : pings Supabase, backups, alertes. Base du tableau de bord SuperAdmin.';


-- ─────────────────────────────────────────────────────────────────
-- 3) RPC get_stats_ecoles_super_admin
-- ─────────────────────────────────────────────────────────────────
-- Retourne les KPIs consolidés de toutes les écoles pour le cockpit.
-- Gain : 1 requête au lieu de N requêtes par école.

CREATE OR REPLACE FUNCTION get_stats_ecoles_super_admin()
RETURNS TABLE (
  ecole_id                  UUID,
  ecole_nom                 TEXT,
  ecole_statut              TEXT,
  ecole_created_at          TIMESTAMPTZ,
  nb_eleves                 BIGINT,
  nb_instituteurs           BIGINT,
  nb_parents                BIGINT,
  nb_validations_total      BIGINT,
  nb_validations_7j         BIGINT,
  nb_validations_30j        BIGINT,
  derniere_validation       TIMESTAMPTZ,
  derniere_connexion        TIMESTAMPTZ,
  nb_certificats            BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id                              AS ecole_id,
    e.nom                             AS ecole_nom,
    COALESCE(e.statut, 'active')      AS ecole_statut,
    e.created_at                      AS ecole_created_at,
    COUNT(DISTINCT el.id)             AS nb_eleves,
    COUNT(DISTINCT CASE WHEN u.role = 'instituteur' THEN u.id END) AS nb_instituteurs,
    COUNT(DISTINCT CASE WHEN u.role = 'parent'      THEN u.id END) AS nb_parents,
    COUNT(DISTINCT v.id)              AS nb_validations_total,
    COUNT(DISTINCT CASE WHEN v.date_validation > NOW() - INTERVAL '7 days'  THEN v.id END) AS nb_validations_7j,
    COUNT(DISTINCT CASE WHEN v.date_validation > NOW() - INTERVAL '30 days' THEN v.id END) AS nb_validations_30j,
    MAX(v.date_validation)            AS derniere_validation,
    MAX(u.derniere_connexion)         AS derniere_connexion,
    COUNT(DISTINCT c.id)              AS nb_certificats
  FROM ecoles e
  LEFT JOIN eleves           el ON el.ecole_id = e.id
  LEFT JOIN utilisateurs     u  ON u.ecole_id  = e.id
  LEFT JOIN validations      v  ON v.ecole_id  = e.id
  LEFT JOIN certificats_eleves c ON c.eleve_id = el.id
  GROUP BY e.id, e.nom, e.statut, e.created_at
  ORDER BY e.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_stats_ecoles_super_admin IS 'KPIs consolidés de toutes les écoles pour le cockpit SuperAdmin. 1 requête = tout.';


-- ─────────────────────────────────────────────────────────────────
-- 4) Colonne derniere_connexion sur utilisateurs
-- ─────────────────────────────────────────────────────────────────
-- Permet de détecter les écoles inactives (engagement 🟢🟡🔴)

ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS derniere_connexion TIMESTAMPTZ;

-- Index pour requêtes rapides "utilisateurs inactifs"
CREATE INDEX IF NOT EXISTS utilisateurs_derniere_connexion_idx
  ON utilisateurs(derniere_connexion DESC NULLS LAST);

COMMENT ON COLUMN utilisateurs.derniere_connexion IS 'Horodatage de la dernière connexion réussie. Mis à jour par /api/auth action=login.';


-- ─────────────────────────────────────────────────────────────────
-- Fin de migration
-- ─────────────────────────────────────────────────────────────────
-- Vérification :
SELECT 'audit_log'      AS table_name, COUNT(*) AS lignes FROM audit_log
UNION ALL
SELECT 'sante_systeme'  AS table_name, COUNT(*) FROM sante_systeme
UNION ALL
SELECT 'utilisateurs avec derniere_connexion' AS table_name, COUNT(*) FROM utilisateurs WHERE derniere_connexion IS NOT NULL;
