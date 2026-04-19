-- ═══════════════════════════════════════════════════════════════
-- SCHÉMA DE BASE — PROJET SUPABASE QA (Quality)
-- ═══════════════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor du NOUVEAU projet Supabase QA
-- APRÈS sa création. 
-- 
-- Ce script crée les 32 tables de la Production avec leurs colonnes.
-- ATTENTION : les contraintes (FK), RLS, indexes, RPC NE sont PAS inclus.
--             Ils seront ajoutés progressivement au fur et à mesure
--             des tests en QA (approche itérative).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alertes (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ, niveau TEXT NOT NULL, type_alerte TEXT NOT NULL, titre TEXT NOT NULL, message TEXT NOT NULL, cle_dedup TEXT NOT NULL, ecole_id UUID, mail_envoye BOOLEAN NOT NULL DEFAULT false, metadata JSONB);

CREATE TABLE IF NOT EXISTS apprentissages (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID, hizb INTEGER NOT NULL, tomon INTEGER NOT NULL, date_debut TIMESTAMP DEFAULT now(), created_at TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS audit_log (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), actor_user_id UUID, actor_role TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT, target_id UUID, target_label TEXT, metadata JSONB, ip_address TEXT, user_agent TEXT);

CREATE TABLE IF NOT EXISTS bareme_notes (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, type_action TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, actif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), objet_id UUID);

CREATE TABLE IF NOT EXISTS blocs_examen (id UUID NOT NULL DEFAULT gen_random_uuid(), examen_id UUID NOT NULL, ecole_id UUID NOT NULL, niveau_id UUID NOT NULL, nom TEXT NOT NULL, ordre INTEGER NOT NULL DEFAULT 1, type_contenu TEXT NOT NULL, contenu_ids JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS certificats_eleves (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID, ecole_id UUID, titre TEXT NOT NULL, description TEXT, date_emission DATE DEFAULT CURRENT_DATE, type_certificat TEXT DEFAULT 'accomplissement'::text, cree_par UUID, created_at TIMESTAMP DEFAULT now());

CREATE TABLE IF NOT EXISTS cotisations (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID, montant NUMERIC NOT NULL, date_paiement DATE NOT NULL, periode TEXT, statut TEXT NOT NULL DEFAULT 'paye'::text, note TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS depenses (id UUID NOT NULL DEFAULT gen_random_uuid(), montant NUMERIC NOT NULL, date_depense DATE NOT NULL, categorie TEXT NOT NULL, beneficiaire_id UUID, description TEXT, reference TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS ecoles (id UUID NOT NULL DEFAULT gen_random_uuid(), nom TEXT NOT NULL, ville TEXT, pays TEXT DEFAULT 'Maroc'::text, telephone TEXT, email TEXT, code_acces TEXT, statut TEXT DEFAULT 'en_attente'::text, valide_par UUID, date_validation TIMESTAMPTZ, note_admin TEXT, created_at TIMESTAMPTZ DEFAULT now(), mdp_defaut_instituteurs TEXT DEFAULT 'ecole2024'::text, mdp_defaut_parents TEXT DEFAULT 'parent2024'::text, sens_recitation_defaut TEXT DEFAULT 'desc'::text);

CREATE TABLE IF NOT EXISTS eleves (id UUID NOT NULL DEFAULT gen_random_uuid(), prenom TEXT NOT NULL, nom TEXT NOT NULL, niveau TEXT NOT NULL, instituteur_referent_id UUID, hizb_depart INTEGER NOT NULL DEFAULT 1, tomon_depart INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT now(), code_niveau TEXT DEFAULT '1'::text, eleve_id_ecole TEXT, sourates_acquises INTEGER DEFAULT 0, ecole_id UUID, telephone TEXT);

CREATE TABLE IF NOT EXISTS ensembles_sourates (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, niveau_id UUID NOT NULL, nom TEXT NOT NULL, ordre INTEGER NOT NULL DEFAULT 1, sourates_ids JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS examens (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, niveau_id UUID, nom TEXT NOT NULL, description TEXT, score_minimum INTEGER NOT NULL DEFAULT 0, bloquant BOOLEAN NOT NULL DEFAULT true, actif BOOLEAN NOT NULL DEFAULT true, ordre INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ DEFAULT now(), contenu_ids JSONB NOT NULL DEFAULT '[]'::jsonb, type_contenu TEXT NOT NULL DEFAULT 'hizb'::text);

CREATE TABLE IF NOT EXISTS exceptions_hizb (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID, hizb_numero INTEGER NOT NULL, active BOOLEAN DEFAULT true, cree_par UUID, date_creation TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS exceptions_recitation (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID, sourate_numero INTEGER NOT NULL, active BOOLEAN DEFAULT true, cree_par UUID, date_creation TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS jalons (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, nom TEXT NOT NULL, nom_ar TEXT, type_jalon TEXT NOT NULL, valeur INTEGER, ensemble_id UUID, actif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), examen_id UUID, hizb_ids _int4, condition_obtention TEXT NOT NULL DEFAULT 'cumul'::text, description_condition TEXT, examen_final_id UUID);

CREATE TABLE IF NOT EXISTS niveaux (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, code TEXT NOT NULL, nom TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'hizb'::text, ordre INTEGER NOT NULL DEFAULT 1, couleur TEXT NOT NULL DEFAULT '#1D9E75'::text, actif BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), sens_recitation TEXT);

CREATE TABLE IF NOT EXISTS objectifs (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, type_cible TEXT NOT NULL, niveau_id UUID, eleve_id UUID, metrique TEXT NOT NULL, valeur_cible INTEGER NOT NULL DEFAULT 1, type_periode TEXT NOT NULL, date_debut DATE NOT NULL, date_fin DATE NOT NULL, notes TEXT, actif BOOLEAN DEFAULT true, created_by UUID, created_at TIMESTAMP DEFAULT now());

CREATE TABLE IF NOT EXISTS objectifs_globaux (id UUID NOT NULL DEFAULT gen_random_uuid(), type_cible TEXT NOT NULL, eleve_id UUID, code_niveau TEXT, instituteur_id UUID, periode TEXT NOT NULL, date_debut DATE NOT NULL, date_fin DATE NOT NULL, metrique TEXT NOT NULL, valeur_cible INTEGER NOT NULL, titre TEXT, notes TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now(), cible_specifique TEXT, ecole_id UUID);

CREATE TABLE IF NOT EXISTS parent_eleve (id UUID NOT NULL DEFAULT gen_random_uuid(), parent_id UUID, eleve_id UUID);

CREATE TABLE IF NOT EXISTS parents (id UUID NOT NULL DEFAULT gen_random_uuid(), prenom TEXT NOT NULL, nom TEXT NOT NULL, identifiant TEXT NOT NULL, mot_de_passe TEXT NOT NULL, telephone TEXT, created_by UUID, created_at TIMESTAMP DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS passages_niveau (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID, niveau_from TEXT NOT NULL, niveau_to TEXT NOT NULL, date_passage TIMESTAMPTZ DEFAULT now(), valide_par UUID, acquis_tomon INTEGER DEFAULT 0, acquis_hizb INTEGER DEFAULT 0, acquis_sourates INTEGER DEFAULT 0, acquis_points INTEGER DEFAULT 0, note TEXT, created_at TIMESTAMPTZ DEFAULT now(), ecole_id UUID);

CREATE TABLE IF NOT EXISTS periodes_notes (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, nom TEXT NOT NULL, nom_ar TEXT, date_debut DATE NOT NULL, date_fin DATE NOT NULL, actif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS points_eleves (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID NOT NULL, ecole_id UUID NOT NULL, type_event TEXT NOT NULL, objet_id UUID, points INTEGER NOT NULL DEFAULT 0, date_event TIMESTAMPTZ DEFAULT now(), valide_par UUID, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS programmes (id UUID NOT NULL DEFAULT gen_random_uuid(), niveau_id UUID NOT NULL, ecole_id UUID NOT NULL, type_contenu TEXT NOT NULL, reference_id TEXT NOT NULL, nom_reference TEXT, ordre INTEGER NOT NULL DEFAULT 1, obligatoire BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS recitations_sourates (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID, sourate_id INTEGER, type_recitation TEXT NOT NULL, verset_debut INTEGER, verset_fin INTEGER, valide_par UUID, date_validation TIMESTAMP DEFAULT now(), points INTEGER DEFAULT 0, is_muraja BOOLEAN DEFAULT false, ecole_id UUID);

CREATE TABLE IF NOT EXISTS regles_passage_niveau (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, niveau_from TEXT NOT NULL, niveau_to TEXT NOT NULL, type_depart TEXT NOT NULL DEFAULT 'continuer'::text, hizb_depart_fixe INTEGER DEFAULT 0, tomon_depart_fixe INTEGER DEFAULT 1, sourates_acquises_fixe INTEGER DEFAULT 0, note TEXT, actif BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS resultats_examens (id UUID NOT NULL DEFAULT gen_random_uuid(), examen_id UUID NOT NULL, bloc_id UUID, eleve_id UUID NOT NULL, ecole_id UUID NOT NULL, date_examen DATE NOT NULL DEFAULT CURRENT_DATE, score INTEGER, statut TEXT NOT NULL DEFAULT 'en_attente'::text, notes_examinateur TEXT, certificat_genere BOOLEAN NOT NULL DEFAULT false, date_certificat TIMESTAMPTZ, valide_par UUID, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS sante_systeme (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), check_type TEXT NOT NULL, status TEXT NOT NULL, latency_ms INTEGER, message TEXT, metadata JSONB);

CREATE TABLE IF NOT EXISTS sequences_config (id UUID NOT NULL DEFAULT gen_random_uuid(), ecole_id UUID NOT NULL, niveau_id UUID NOT NULL, nb_sequences INTEGER NOT NULL DEFAULT 3, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS sourates (id INTEGER NOT NULL DEFAULT nextval('sourates_id_seq'::regclass), numero INTEGER NOT NULL, nom_ar TEXT NOT NULL, niveau_5b BOOLEAN DEFAULT false, niveau_5a BOOLEAN DEFAULT false, niveau_2m BOOLEAN DEFAULT false);

CREATE TABLE IF NOT EXISTS utilisateurs (id UUID NOT NULL DEFAULT gen_random_uuid(), prenom TEXT NOT NULL, nom TEXT NOT NULL, identifiant TEXT NOT NULL, mot_de_passe TEXT NOT NULL, role TEXT NOT NULL, created_at TIMESTAMP DEFAULT now(), statut_compte TEXT DEFAULT 'actif'::text, ecole_id UUID, telephone TEXT, derniere_connexion TIMESTAMPTZ);

CREATE TABLE IF NOT EXISTS validations (id UUID NOT NULL DEFAULT gen_random_uuid(), eleve_id UUID, valide_par UUID, nombre_tomon INTEGER NOT NULL, date_validation TIMESTAMP DEFAULT now(), type_validation TEXT NOT NULL DEFAULT 'tomon'::text, hizb_valide INTEGER, tomon_debut INTEGER, hizb_validation INTEGER, is_muraja BOOLEAN DEFAULT false, ecole_id UUID);


-- ─────────────────────────────────────────────────────────────────
-- Fin du schéma de base
-- ─────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS nb_tables_creees 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
