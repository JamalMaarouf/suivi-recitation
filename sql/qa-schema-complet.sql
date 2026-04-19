-- ═══════════════════════════════════════════════════════════════
-- SCHÉMA COMPLET — PROJET SUPABASE QA (Quality)
-- ═══════════════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor du NOUVEAU projet Supabase QA
-- après sa création. Ce script recrée la Production à l'identique :
--   ✓ 32 tables
--   ✓ 43 indexes
--   ✓ 42 foreign keys
--   ✓ 28 RLS policies
--   ✓ 124 RPC functions
-- 
-- ⚠️  À EXÉCUTER UNIQUEMENT SUR LE PROJET QA, JAMAIS SUR LA PROD.
-- Vérifie bien le nom du projet en haut de Supabase avant de Run.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1/5 — TABLES (32)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alertes (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ, niveau TEXT NOT NULL, type_alerte TEXT NOT NULL, titre TEXT NOT NULL, message TEXT NOT NULL, cle_dedup TEXT NOT NULL, ecole_id UUID, mail_envoye BOOLEAN NOT NULL DEFAULT false, metadata JSONB);

CREATE TABLE IF NOT EXISTS apprentissages (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID, hizb INTEGER NOT NULL, tomon INTEGER NOT NULL, date_debut TIMESTAMP DEFAULT now(), created_at TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS audit_log (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), actor_user_id UUID, actor_role TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT, target_id UUID, target_label TEXT, metadata JSONB, ip_address TEXT, user_agent TEXT);

CREATE TABLE IF NOT EXISTS bareme_notes (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, type_action TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, actif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), objet_id UUID);

CREATE TABLE IF NOT EXISTS blocs_examen (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, examen_id UUID NOT NULL, ecole_id UUID NOT NULL, niveau_id UUID NOT NULL, nom TEXT NOT NULL, ordre INTEGER NOT NULL DEFAULT 1, type_contenu TEXT NOT NULL, contenu_ids JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS certificats_eleves (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID, ecole_id UUID, titre TEXT NOT NULL, description TEXT, date_emission DATE DEFAULT CURRENT_DATE, type_certificat TEXT DEFAULT 'accomplissement'::text, cree_par UUID, created_at TIMESTAMP DEFAULT now());

CREATE TABLE IF NOT EXISTS cotisations (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID, montant NUMERIC NOT NULL, date_paiement DATE NOT NULL, periode TEXT, statut TEXT NOT NULL DEFAULT 'paye'::text, note TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS depenses (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, montant NUMERIC NOT NULL, date_depense DATE NOT NULL, categorie TEXT NOT NULL, beneficiaire_id UUID, description TEXT, reference TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS ecoles (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, nom TEXT NOT NULL, ville TEXT, pays TEXT DEFAULT 'Maroc'::text, telephone TEXT, email TEXT, code_acces TEXT, statut TEXT DEFAULT 'en_attente'::text, valide_par UUID, date_validation TIMESTAMPTZ, note_admin TEXT, created_at TIMESTAMPTZ DEFAULT now(), mdp_defaut_instituteurs TEXT DEFAULT 'ecole2024'::text, mdp_defaut_parents TEXT DEFAULT 'parent2024'::text, sens_recitation_defaut TEXT DEFAULT 'desc'::text);

CREATE TABLE IF NOT EXISTS eleves (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, niveau TEXT NOT NULL, instituteur_referent_id UUID, hizb_depart INTEGER NOT NULL DEFAULT 1, tomon_depart INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT now(), code_niveau TEXT DEFAULT '1'::text, eleve_id_ecole TEXT, sourates_acquises INTEGER DEFAULT 0, ecole_id UUID, telephone TEXT);

CREATE TABLE IF NOT EXISTS ensembles_sourates (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, niveau_id UUID NOT NULL, nom TEXT NOT NULL, ordre INTEGER NOT NULL DEFAULT 1, sourates_ids JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS examens (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, niveau_id UUID, nom TEXT NOT NULL, description TEXT, score_minimum INTEGER NOT NULL DEFAULT 0, bloquant BOOLEAN NOT NULL DEFAULT true, actif BOOLEAN NOT NULL DEFAULT true, ordre INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ DEFAULT now(), contenu_ids JSONB NOT NULL DEFAULT '[]'::jsonb, type_contenu TEXT NOT NULL DEFAULT 'hizb'::text);

CREATE TABLE IF NOT EXISTS exceptions_hizb (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID, hizb_numero INTEGER NOT NULL, active BOOLEAN DEFAULT true, cree_par UUID, date_creation TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS exceptions_recitation (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID, sourate_numero INTEGER NOT NULL, active BOOLEAN DEFAULT true, cree_par UUID, date_creation TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS jalons (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, nom TEXT NOT NULL, nom_ar TEXT, type_jalon TEXT NOT NULL, valeur INTEGER, ensemble_id UUID, actif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), examen_id UUID, hizb_ids _int4, condition_obtention TEXT NOT NULL DEFAULT 'cumul'::text, description_condition TEXT, examen_final_id UUID);

CREATE TABLE IF NOT EXISTS niveaux (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, code TEXT NOT NULL, nom TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'hizb'::text, ordre INTEGER NOT NULL DEFAULT 1, couleur TEXT NOT NULL DEFAULT '#1D9E75'::text, actif BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), sens_recitation TEXT);

CREATE TABLE IF NOT EXISTS objectifs (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, type_cible TEXT NOT NULL, niveau_id UUID, eleve_id UUID, metrique TEXT NOT NULL, valeur_cible INTEGER NOT NULL DEFAULT 1, type_periode TEXT NOT NULL, date_debut DATE NOT NULL, date_fin DATE NOT NULL, notes TEXT, actif BOOLEAN DEFAULT true, created_by UUID, created_at TIMESTAMP DEFAULT now());

CREATE TABLE IF NOT EXISTS objectifs_globaux (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, type_cible TEXT NOT NULL, eleve_id UUID, code_niveau TEXT, instituteur_id UUID, periode TEXT NOT NULL, date_debut DATE NOT NULL, date_fin DATE NOT NULL, metrique TEXT NOT NULL, valeur_cible INTEGER NOT NULL, titre TEXT, notes TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now(), cible_specifique TEXT, ecole_id UUID);

CREATE TABLE IF NOT EXISTS parent_eleve (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, parent_id UUID, eleve_id UUID);

CREATE TABLE IF NOT EXISTS parents (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, identifiant TEXT NOT NULL, mot_de_passe TEXT NOT NULL, telephone TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS passages_niveau (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID, niveau_from TEXT NOT NULL, niveau_to TEXT NOT NULL, date_passage TIMESTAMPTZ DEFAULT now(), valide_par UUID, acquis_tomon INTEGER DEFAULT 0, acquis_hizb INTEGER DEFAULT 0, acquis_sourates INTEGER DEFAULT 0, acquis_points INTEGER DEFAULT 0, note TEXT, created_at TIMESTAMPTZ DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS periodes_notes (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, nom TEXT NOT NULL, nom_ar TEXT, date_debut DATE NOT NULL, date_fin DATE NOT NULL, actif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS points_eleves (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID NOT NULL, ecole_id UUID NOT NULL, type_event TEXT NOT NULL, objet_id UUID, points INTEGER NOT NULL DEFAULT 0, date_event TIMESTAMPTZ DEFAULT now(), valide_par UUID, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS programmes (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, niveau_id UUID NOT NULL, ecole_id UUID NOT NULL, type_contenu TEXT NOT NULL, reference_id TEXT NOT NULL, nom_reference TEXT, ordre INTEGER NOT NULL DEFAULT 1, obligatoire BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS recitations_sourates (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID, sourate_id INTEGER, type_recitation TEXT NOT NULL, verset_debut INTEGER, verset_fin INTEGER, valide_par UUID, date_validation TIMESTAMP DEFAULT now(), points INTEGER DEFAULT 0, is_muraja BOOLEAN DEFAULT false, ecole_id UUID);

CREATE TABLE IF NOT EXISTS regles_passage_niveau (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, niveau_from TEXT NOT NULL, niveau_to TEXT NOT NULL, type_depart TEXT NOT NULL DEFAULT 'continuer'::text, hizb_depart_fixe INTEGER DEFAULT 0, tomon_depart_fixe INTEGER DEFAULT 1, sourates_acquises_fixe INTEGER DEFAULT 0, note TEXT, actif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS resultats_examens (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, examen_id UUID NOT NULL, bloc_id UUID, eleve_id UUID NOT NULL, ecole_id UUID NOT NULL, date_examen DATE NOT NULL DEFAULT CURRENT_DATE, score INTEGER, statut TEXT NOT NULL DEFAULT 'en_attente'::text, notes_examinateur TEXT, certificat_genere BOOLEAN NOT NULL DEFAULT false, date_certificat TIMESTAMPTZ, valide_par UUID, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS sante_systeme (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), check_type TEXT NOT NULL, status TEXT NOT NULL, latency_ms INTEGER, message TEXT, metadata JSONB);

CREATE TABLE IF NOT EXISTS sequences_config (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ecole_id UUID NOT NULL, niveau_id UUID NOT NULL, nb_sequences INTEGER NOT NULL DEFAULT 3, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS sourates (id SERIAL PRIMARY KEY, numero INTEGER NOT NULL, nom_ar TEXT NOT NULL, niveau_5b BOOLEAN DEFAULT false, niveau_5a BOOLEAN DEFAULT false, niveau_2m BOOLEAN DEFAULT false);

CREATE TABLE IF NOT EXISTS utilisateurs (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, prenom TEXT NOT NULL, nom TEXT NOT NULL, identifiant TEXT NOT NULL, mot_de_passe TEXT NOT NULL, role TEXT NOT NULL, created_at TIMESTAMP DEFAULT now(), statut_compte TEXT DEFAULT 'actif'::text, ecole_id UUID, telephone TEXT, derniere_connexion TIMESTAMPTZ);

CREATE TABLE IF NOT EXISTS validations (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, eleve_id UUID, valide_par UUID, nombre_tomon INTEGER NOT NULL, date_validation TIMESTAMP DEFAULT now(), type_validation TEXT NOT NULL DEFAULT 'tomon'::text, hizb_valide INTEGER, tomon_debut INTEGER, hizb_validation INTEGER, is_muraja BOOLEAN DEFAULT false, ecole_id UUID);


-- ─────────────────────────────────────────────────────────────
-- 2/5 — INDEXES (44)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX alertes_active_idx ON public.alertes USING btree (resolved_at) WHERE (resolved_at IS NULL);
CREATE INDEX alertes_dedup_idx ON public.alertes USING btree (cle_dedup) WHERE (resolved_at IS NULL);
CREATE INDEX alertes_ecole_idx ON public.alertes USING btree (ecole_id) WHERE (resolved_at IS NULL);
CREATE INDEX alertes_niveau_idx ON public.alertes USING btree (niveau, created_at DESC);
CREATE INDEX audit_log_action_idx ON public.audit_log USING btree (action);
CREATE INDEX audit_log_actor_idx ON public.audit_log USING btree (actor_user_id);
CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at DESC);
CREATE INDEX audit_log_target_idx ON public.audit_log USING btree (target_type, target_id);
CREATE UNIQUE INDEX bareme_notes_ecole_type_objet_key ON public.bareme_notes USING btree (ecole_id, type_action, objet_id);
CREATE INDEX idx_bareme_ecole ON public.bareme_notes USING btree (ecole_id);
CREATE INDEX idx_blocs_examen_id ON public.blocs_examen USING btree (examen_id);
CREATE INDEX idx_blocs_niveau_id ON public.blocs_examen USING btree (niveau_id);
CREATE INDEX idx_certificats_ecole ON public.certificats_eleves USING btree (ecole_id);
CREATE INDEX idx_certificats_eleve ON public.certificats_eleves USING btree (eleve_id);
CREATE UNIQUE INDEX ecoles_code_acces_key ON public.ecoles USING btree (code_acces);
CREATE INDEX idx_eleves_ecole ON public.eleves USING btree (ecole_id);
CREATE INDEX idx_ensembles_ecole ON public.ensembles_sourates USING btree (ecole_id);
CREATE INDEX idx_ensembles_niveau ON public.ensembles_sourates USING btree (niveau_id);
CREATE INDEX idx_examens_ecole ON public.examens USING btree (ecole_id);
CREATE INDEX idx_jalons_ecole ON public.jalons USING btree (ecole_id);
CREATE INDEX idx_niveaux_ecole ON public.niveaux USING btree (ecole_id);
CREATE UNIQUE INDEX niveaux_ecole_id_code_key ON public.niveaux USING btree (ecole_id, code);
CREATE INDEX idx_objectifs_ecole ON public.objectifs USING btree (ecole_id);
CREATE INDEX idx_objectifs_eleve ON public.objectifs USING btree (eleve_id);
CREATE INDEX idx_objectifs_niveau ON public.objectifs USING btree (niveau_id);
CREATE UNIQUE INDEX parent_eleve_parent_id_eleve_id_key ON public.parent_eleve USING btree (parent_id, eleve_id);
CREATE UNIQUE INDEX parents_identifiant_key ON public.parents USING btree (identifiant);
CREATE INDEX idx_periodes_ecole ON public.periodes_notes USING btree (ecole_id);
CREATE INDEX idx_points_ecole ON public.points_eleves USING btree (ecole_id);
CREATE INDEX idx_points_eleve ON public.points_eleves USING btree (eleve_id);
CREATE INDEX idx_recitations_ecole_date ON public.recitations_sourates USING btree (ecole_id, date_validation DESC);
CREATE INDEX idx_recitations_ecole_eleve ON public.recitations_sourates USING btree (ecole_id, eleve_id);
CREATE INDEX idx_resultats_eleve ON public.resultats_examens USING btree (eleve_id);
CREATE INDEX idx_resultats_examen ON public.resultats_examens USING btree (examen_id);
CREATE INDEX idx_resultats_statut ON public.resultats_examens USING btree (statut);
CREATE INDEX sante_systeme_date_idx ON public.sante_systeme USING btree (created_at DESC);
CREATE INDEX sante_systeme_type_date_idx ON public.sante_systeme USING btree (check_type, created_at DESC);
CREATE INDEX idx_sequences_niveau ON public.sequences_config USING btree (niveau_id);
CREATE UNIQUE INDEX sequences_config_ecole_id_niveau_id_key ON public.sequences_config USING btree (ecole_id, niveau_id);
CREATE UNIQUE INDEX sourates_numero_unique ON public.sourates USING btree (numero);
CREATE INDEX utilisateurs_derniere_connexion_idx ON public.utilisateurs USING btree (derniere_connexion DESC NULLS LAST);
CREATE UNIQUE INDEX utilisateurs_identifiant_key ON public.utilisateurs USING btree (identifiant);
CREATE INDEX idx_validations_ecole_date ON public.validations USING btree (ecole_id, date_validation DESC);
CREATE INDEX idx_validations_ecole_eleve ON public.validations USING btree (ecole_id, eleve_id);


-- ─────────────────────────────────────────────────────────────
-- 3/5 — FOREIGN KEYS (43)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE alertes ADD CONSTRAINT alertes_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE SET NULL;
ALTER TABLE apprentissages ADD CONSTRAINT apprentissages_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE apprentissages ADD CONSTRAINT apprentissages_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id);
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES utilisateurs(id) ON DELETE SET NULL;
ALTER TABLE certificats_eleves ADD CONSTRAINT certificats_eleves_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES utilisateurs(id);
ALTER TABLE certificats_eleves ADD CONSTRAINT certificats_eleves_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE;
ALTER TABLE certificats_eleves ADD CONSTRAINT certificats_eleves_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE;
ALTER TABLE cotisations ADD CONSTRAINT cotisations_created_by_fkey FOREIGN KEY (created_by) REFERENCES utilisateurs(id);
ALTER TABLE cotisations ADD CONSTRAINT cotisations_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE cotisations ADD CONSTRAINT cotisations_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id);
ALTER TABLE depenses ADD CONSTRAINT depenses_beneficiaire_id_fkey FOREIGN KEY (beneficiaire_id) REFERENCES utilisateurs(id);
ALTER TABLE depenses ADD CONSTRAINT depenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES utilisateurs(id);
ALTER TABLE depenses ADD CONSTRAINT depenses_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE ecoles ADD CONSTRAINT ecoles_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES utilisateurs(id);
ALTER TABLE eleves ADD CONSTRAINT eleves_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE eleves ADD CONSTRAINT eleves_instituteur_referent_id_fkey FOREIGN KEY (instituteur_referent_id) REFERENCES utilisateurs(id);
ALTER TABLE exceptions_hizb ADD CONSTRAINT exceptions_hizb_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES utilisateurs(id);
ALTER TABLE exceptions_hizb ADD CONSTRAINT exceptions_hizb_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE exceptions_hizb ADD CONSTRAINT exceptions_hizb_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id);
ALTER TABLE exceptions_recitation ADD CONSTRAINT exceptions_recitation_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES utilisateurs(id);
ALTER TABLE exceptions_recitation ADD CONSTRAINT exceptions_recitation_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE exceptions_recitation ADD CONSTRAINT exceptions_recitation_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id);
ALTER TABLE jalons ADD CONSTRAINT jalons_examen_final_id_fkey FOREIGN KEY (examen_final_id) REFERENCES examens(id) ON DELETE SET NULL;
ALTER TABLE objectifs_globaux ADD CONSTRAINT objectifs_globaux_created_by_fkey FOREIGN KEY (created_by) REFERENCES utilisateurs(id);
ALTER TABLE objectifs_globaux ADD CONSTRAINT objectifs_globaux_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE objectifs_globaux ADD CONSTRAINT objectifs_globaux_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id);
ALTER TABLE objectifs_globaux ADD CONSTRAINT objectifs_globaux_instituteur_id_fkey FOREIGN KEY (instituteur_id) REFERENCES utilisateurs(id);
ALTER TABLE parent_eleve ADD CONSTRAINT parent_eleve_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE;
ALTER TABLE parents ADD CONSTRAINT parents_created_by_fkey FOREIGN KEY (created_by) REFERENCES utilisateurs(id);
ALTER TABLE parents ADD CONSTRAINT parents_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE passages_niveau ADD CONSTRAINT passages_niveau_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE passages_niveau ADD CONSTRAINT passages_niveau_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE;
ALTER TABLE passages_niveau ADD CONSTRAINT passages_niveau_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES utilisateurs(id);
ALTER TABLE points_eleves ADD CONSTRAINT points_eleves_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE;
ALTER TABLE recitations_sourates ADD CONSTRAINT recitations_sourates_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE recitations_sourates ADD CONSTRAINT recitations_sourates_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id);
ALTER TABLE recitations_sourates ADD CONSTRAINT recitations_sourates_sourate_id_fkey FOREIGN KEY (sourate_id) REFERENCES sourates(id);
ALTER TABLE recitations_sourates ADD CONSTRAINT recitations_sourates_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES utilisateurs(id);
ALTER TABLE regles_passage_niveau ADD CONSTRAINT regles_passage_niveau_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id) ON DELETE CASCADE;
ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE validations ADD CONSTRAINT validations_ecole_id_fkey FOREIGN KEY (ecole_id) REFERENCES ecoles(id);
ALTER TABLE validations ADD CONSTRAINT validations_eleve_id_fkey FOREIGN KEY (eleve_id) REFERENCES eleves(id);
ALTER TABLE validations ADD CONSTRAINT validations_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES utilisateurs(id);


-- ─────────────────────────────────────────────────────────────
-- 4/5 — RLS POLICIES (27)
-- ─────────────────────────────────────────────────────────────

-- 4a) Activer RLS sur les tables concernées
ALTER TABLE public.alertes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bareme_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocs_examen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificats_eleves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ensembles_sourates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jalons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niveaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodes_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_eleves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regles_passage_niveau ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultats_examens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sante_systeme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences_config ENABLE ROW LEVEL SECURITY;

-- 4b) Supprimer d'abord les policies existantes (sécurité ré-exec)
DROP POLICY IF EXISTS "alertes_read" ON public.alertes;
DROP POLICY IF EXISTS "alertes_write" ON public.alertes;
DROP POLICY IF EXISTS "audit_log_insert_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_read_policy" ON public.audit_log;
DROP POLICY IF EXISTS "bareme_acces" ON public.bareme_notes;
DROP POLICY IF EXISTS "blocs_examen_access" ON public.blocs_examen;
DROP POLICY IF EXISTS "certificats_acces" ON public.certificats_eleves;
DROP POLICY IF EXISTS "Insertion cotisations" ON public.cotisations;
DROP POLICY IF EXISTS "Lecture cotisations" ON public.cotisations;
DROP POLICY IF EXISTS "Mise à jour cotisations" ON public.cotisations;
DROP POLICY IF EXISTS "Suppression cotisations" ON public.cotisations;
DROP POLICY IF EXISTS "Insertion depenses" ON public.depenses;
DROP POLICY IF EXISTS "Lecture depenses" ON public.depenses;
DROP POLICY IF EXISTS "Mise à jour depenses" ON public.depenses;
DROP POLICY IF EXISTS "Suppression depenses" ON public.depenses;
DROP POLICY IF EXISTS "ensembles_access" ON public.ensembles_sourates;
DROP POLICY IF EXISTS "examens_access" ON public.examens;
DROP POLICY IF EXISTS "jalons_acces" ON public.jalons;
DROP POLICY IF EXISTS "niveaux_access" ON public.niveaux;
DROP POLICY IF EXISTS "periodes_acces" ON public.periodes_notes;
DROP POLICY IF EXISTS "points_acces" ON public.points_eleves;
DROP POLICY IF EXISTS "programmes_access" ON public.programmes;
DROP POLICY IF EXISTS "ecole_access" ON public.regles_passage_niveau;
DROP POLICY IF EXISTS "resultats_examens_access" ON public.resultats_examens;
DROP POLICY IF EXISTS "sante_insert" ON public.sante_systeme;
DROP POLICY IF EXISTS "sante_read" ON public.sante_systeme;
DROP POLICY IF EXISTS "sequences_config_access" ON public.sequences_config;

-- 4c) Créer les policies
CREATE POLICY "alertes_read" ON public.alertes AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "alertes_write" ON public.alertes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "audit_log_insert_policy" ON public.audit_log AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "audit_log_read_policy" ON public.audit_log AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "bareme_acces" ON public.bareme_notes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "blocs_examen_access" ON public.blocs_examen AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "certificats_acces" ON public.certificats_eleves AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Insertion cotisations" ON public.cotisations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Lecture cotisations" ON public.cotisations AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mise à jour cotisations" ON public.cotisations AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Suppression cotisations" ON public.cotisations AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Insertion depenses" ON public.depenses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Lecture depenses" ON public.depenses AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mise à jour depenses" ON public.depenses AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Suppression depenses" ON public.depenses AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "ensembles_access" ON public.ensembles_sourates AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "examens_access" ON public.examens AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "jalons_acces" ON public.jalons AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "niveaux_access" ON public.niveaux AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "periodes_acces" ON public.periodes_notes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "points_acces" ON public.points_eleves AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "programmes_access" ON public.programmes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "ecole_access" ON public.regles_passage_niveau AS PERMISSIVE FOR ALL TO public USING ((ecole_id = ( SELECT utilisateurs.ecole_id
   FROM utilisateurs
  WHERE (utilisateurs.id = auth.uid()))));
CREATE POLICY "resultats_examens_access" ON public.resultats_examens AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "sante_insert" ON public.sante_systeme AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "sante_read" ON public.sante_systeme AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "sequences_config_access" ON public.sequences_config AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 5/5 — RPC FUNCTIONS (6)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_alertes_actives_count() RETURNS TABLE(niveau text, nb bigint) LANGUAGE sql SECURITY DEFINER AS $BODY$
  SELECT a.niveau, COUNT(*)::BIGINT
  FROM alertes a
  WHERE a.resolved_at IS NULL
  GROUP BY a.niveau;
$BODY$;

CREATE OR REPLACE FUNCTION public.get_classement_notes(p_ecole_id uuid, p_date_debut timestamp with time zone, p_date_fin timestamp with time zone) RETURNS TABLE(eleve_id uuid, prenom text, nom text, code_niveau text, eleve_id_ecole text, instituteur_referent_id uuid, tomon_periode integer, hizb_periode integer, validations_periode integer) LANGUAGE sql AS $BODY$
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
$BODY$;

CREATE OR REPLACE FUNCTION public.get_eleves_stats(p_ecole_id uuid) RETURNS TABLE(eleve_id uuid, prenom text, nom text, code_niveau text, niveau text, hizb_depart integer, tomon_depart integer, sourates_acquises integer, instituteur_referent_id uuid, eleve_id_ecole text, tomon_cumul integer, hizb_complets_count integer, validation_count integer, derniere_validation timestamp with time zone, derniere_recitation timestamp with time zone, recitations_completes_count integer) LANGUAGE sql AS $BODY$
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
$BODY$;

CREATE OR REPLACE FUNCTION public.get_sens_niveau(p_niveau_id uuid) RETURNS text LANGUAGE sql AS $BODY$
  SELECT COALESCE(n.sens_recitation, e.sens_recitation_defaut, 'desc')
  FROM niveaux n
  LEFT JOIN ecoles e ON e.id = n.ecole_id
  WHERE n.id = p_niveau_id;
$BODY$;

CREATE OR REPLACE FUNCTION public.get_stats_ecoles_super_admin() RETURNS TABLE(ecole_id uuid, ecole_nom text, ecole_statut text, ecole_created_at timestamp with time zone, nb_eleves bigint, nb_instituteurs bigint, nb_parents bigint, nb_validations_total bigint, nb_validations_7j bigint, nb_validations_30j bigint, derniere_validation timestamp with time zone, derniere_connexion timestamp with time zone, nb_certificats bigint) LANGUAGE plpgsql SECURITY DEFINER AS $BODY$
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
$BODY$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER AS $BODY$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$BODY$;


-- ─────────────────────────────────────────────────────────────
-- Fin de la migration QA
-- ─────────────────────────────────────────────────────────────
-- Vérification finale
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS nb_tables,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND indexname NOT LIKE '%_pkey') AS nb_indexes,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='FOREIGN KEY') AS nb_foreign_keys,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public') AS nb_rls_policies,
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prolang IN (SELECT oid FROM pg_language WHERE lanname IN ('plpgsql','sql'))) AS nb_rpc_functions;
