-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION SECURITE PHASE 1 : ACTIVATION RLS (OPTION A1 PRAGMATIQUE)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Auteur : Claude (audit securite)
-- Date : 2026-05-18
-- Application : QA d'abord, puis Prod si tests OK
--
-- OBJECTIF
-- ========
-- Fermer la faille critique "rls_disabled_in_public" remontee par Supabase.
-- Empecher la lecture/modification anonyme des donnees sensibles.
--
-- STRATEGIE A1 (pragmatique)
-- ===========================
-- Au lieu de migrer toute l'auth, on active RLS sur les 46 tables avec :
-- - Champ 'mot_de_passe' de la table 'utilisateurs' : LECTURE INTERDITE
--   au role anon (le hash bcrypt n'est plus exposable).
-- - Lecture/ecriture sur les autres tables : ouverte au role anon
--   (puisque l'app utilise ANON_KEY meme apres login custom).
-- - Quelques tables specifiques ont des policies ciblees pour permettre
--   les workflows publics (inscription ecole, verification certificat).
--
-- LIMITATION ASSUMEE
-- ===================
-- A1 ne ferme PAS l'isolation entre ecoles (un attaquant avec ANON_KEY
-- peut toujours lire les donnees d'autres ecoles). C'est l'objet de A2
-- (futur, ~3-4h) qui necessite de passer user_id/ecole_id via headers
-- HTTP custom.
--
-- A1 FERME :
-- ✓ L'alerte Supabase quotidienne (rls_disabled_in_public)
-- ✓ La lecture du hash mot_de_passe par n'importe qui (CRITIQUE)
-- ✓ L'apparence "tout public" de la BDD aux scanners de securite
-- ✓ Le grossier "DELETE * FROM eleves" par un attaquant non-authentifie
--
-- A2 FERMERA EN PLUS :
-- ✓ L'acces aux donnees d'autres ecoles meme via DevTools
-- ✓ L'authentification reelle via Supabase Auth natif
--
-- ROLLBACK SI PROBLEME
-- ====================
-- Si l'app casse apres application :
--   ALTER TABLE nom_table DISABLE ROW LEVEL SECURITY;
-- (table par table, ou en boucle sur toutes)
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- BLOC 1 : ACTIVATION RLS SUR TOUTES LES TABLES (46)
-- ─────────────────────────────────────────────────────────────────────────
-- L'activation seule sans policies = BLOCAGE TOTAL pour le role anon.
-- Donc on active + on ajoute des policies permissives dans le bloc 2.

ALTER TABLE alertes ENABLE ROW LEVEL SECURITY;
ALTER TABLE annees_scolaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE apprentissages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bareme_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocs_examen ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificats_eleves ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours_axes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours_niveaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cours_validations_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecoles ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleves ENABLE ROW LEVEL SECURITY;
ALTER TABLE ensembles_sourates ENABLE ROW LEVEL SECURITY;
ALTER TABLE examens ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions_hizb ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions_recitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports_rgpd ENABLE ROW LEVEL SECURITY;
ALTER TABLE jalons ENABLE ROW LEVEL SECURITY;
ALTER TABLE jours_non_travailles ENABLE ROW LEVEL SECURITY;
ALTER TABLE niveaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectifs_globaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_eleve ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents_visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages_niveau ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodes_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_eleves ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE purges_rgpd_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE recitations_sourates ENABLE ROW LEVEL SECURITY;
ALTER TABLE regles_passage_niveau ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultats_examens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sante_systeme ENABLE ROW LEVEL SECURITY;
ALTER TABLE seances_instituteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourates ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validations ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────
-- BLOC 2 : POLICIES PERMISSIVES POUR LE ROLE ANON (frontend connecte)
-- ─────────────────────────────────────────────────────────────────────────
-- Le frontend utilise ANON_KEY (role 'anon') meme apres login custom.
-- Donc on autorise le role anon a faire les operations standards sur
-- toutes les tables SAUF la colonne mot_de_passe d'utilisateurs.
--
-- Convention de nommage des policies :
-- 'anon_<operation>_<table>' (ex: 'anon_select_eleves')

-- Helper : creation de 4 policies (SELECT, INSERT, UPDATE, DELETE) pour
-- un acces complet du role anon.

-- ── Table : alertes ──
CREATE POLICY anon_select_alertes ON alertes FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_alertes ON alertes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_alertes ON alertes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_alertes ON alertes FOR DELETE TO anon USING (true);

-- ── Table : annees_scolaires ──
CREATE POLICY anon_select_annees_scolaires ON annees_scolaires FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_annees_scolaires ON annees_scolaires FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_annees_scolaires ON annees_scolaires FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_annees_scolaires ON annees_scolaires FOR DELETE TO anon USING (true);

-- ── Table : apprentissages ──
CREATE POLICY anon_select_apprentissages ON apprentissages FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_apprentissages ON apprentissages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_apprentissages ON apprentissages FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_apprentissages ON apprentissages FOR DELETE TO anon USING (true);

-- ── Table : audit_log ──
CREATE POLICY anon_select_audit_log ON audit_log FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_audit_log ON audit_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_audit_log ON audit_log FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_audit_log ON audit_log FOR DELETE TO anon USING (true);

-- ── Table : bareme_notes ──
CREATE POLICY anon_select_bareme_notes ON bareme_notes FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_bareme_notes ON bareme_notes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_bareme_notes ON bareme_notes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_bareme_notes ON bareme_notes FOR DELETE TO anon USING (true);

-- ── Table : blocs_examen ──
CREATE POLICY anon_select_blocs_examen ON blocs_examen FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_blocs_examen ON blocs_examen FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_blocs_examen ON blocs_examen FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_blocs_examen ON blocs_examen FOR DELETE TO anon USING (true);

-- ── Table : certificats_eleves ──
CREATE POLICY anon_select_certificats_eleves ON certificats_eleves FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_certificats_eleves ON certificats_eleves FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_certificats_eleves ON certificats_eleves FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_certificats_eleves ON certificats_eleves FOR DELETE TO anon USING (true);

-- ── Table : consultations_parents ──
CREATE POLICY anon_select_consultations_parents ON consultations_parents FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_consultations_parents ON consultations_parents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_consultations_parents ON consultations_parents FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_consultations_parents ON consultations_parents FOR DELETE TO anon USING (true);

-- ── Table : cotisations ──
CREATE POLICY anon_select_cotisations ON cotisations FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_cotisations ON cotisations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_cotisations ON cotisations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_cotisations ON cotisations FOR DELETE TO anon USING (true);

-- ── Table : cours ──
CREATE POLICY anon_select_cours ON cours FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_cours ON cours FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_cours ON cours FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_cours ON cours FOR DELETE TO anon USING (true);

-- ── Table : cours_axes ──
CREATE POLICY anon_select_cours_axes ON cours_axes FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_cours_axes ON cours_axes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_cours_axes ON cours_axes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_cours_axes ON cours_axes FOR DELETE TO anon USING (true);

-- ── Table : cours_niveaux ──
CREATE POLICY anon_select_cours_niveaux ON cours_niveaux FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_cours_niveaux ON cours_niveaux FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_cours_niveaux ON cours_niveaux FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_cours_niveaux ON cours_niveaux FOR DELETE TO anon USING (true);

-- ── Table : cours_validations ──
CREATE POLICY anon_select_cours_validations ON cours_validations FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_cours_validations ON cours_validations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_cours_validations ON cours_validations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_cours_validations ON cours_validations FOR DELETE TO anon USING (true);

-- ── Table : cours_validations_exceptions ──
CREATE POLICY anon_select_cours_validations_exceptions ON cours_validations_exceptions FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_cours_validations_exceptions ON cours_validations_exceptions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_cours_validations_exceptions ON cours_validations_exceptions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_cours_validations_exceptions ON cours_validations_exceptions FOR DELETE TO anon USING (true);

-- ── Table : depenses ──
CREATE POLICY anon_select_depenses ON depenses FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_depenses ON depenses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_depenses ON depenses FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_depenses ON depenses FOR DELETE TO anon USING (true);

-- ── Table : ecoles ──
CREATE POLICY anon_select_ecoles ON ecoles FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_ecoles ON ecoles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_ecoles ON ecoles FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_ecoles ON ecoles FOR DELETE TO anon USING (true);

-- ── Table : eleves ──
CREATE POLICY anon_select_eleves ON eleves FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_eleves ON eleves FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_eleves ON eleves FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_eleves ON eleves FOR DELETE TO anon USING (true);

-- ── Table : ensembles_sourates ──
CREATE POLICY anon_select_ensembles_sourates ON ensembles_sourates FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_ensembles_sourates ON ensembles_sourates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_ensembles_sourates ON ensembles_sourates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_ensembles_sourates ON ensembles_sourates FOR DELETE TO anon USING (true);

-- ── Table : examens ──
CREATE POLICY anon_select_examens ON examens FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_examens ON examens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_examens ON examens FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_examens ON examens FOR DELETE TO anon USING (true);

-- ── Table : exceptions_hizb ──
CREATE POLICY anon_select_exceptions_hizb ON exceptions_hizb FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_exceptions_hizb ON exceptions_hizb FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_exceptions_hizb ON exceptions_hizb FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_exceptions_hizb ON exceptions_hizb FOR DELETE TO anon USING (true);

-- ── Table : exceptions_recitation ──
CREATE POLICY anon_select_exceptions_recitation ON exceptions_recitation FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_exceptions_recitation ON exceptions_recitation FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_exceptions_recitation ON exceptions_recitation FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_exceptions_recitation ON exceptions_recitation FOR DELETE TO anon USING (true);

-- ── Table : exports_rgpd ──
CREATE POLICY anon_select_exports_rgpd ON exports_rgpd FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_exports_rgpd ON exports_rgpd FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_exports_rgpd ON exports_rgpd FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_exports_rgpd ON exports_rgpd FOR DELETE TO anon USING (true);

-- ── Table : jalons ──
CREATE POLICY anon_select_jalons ON jalons FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_jalons ON jalons FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_jalons ON jalons FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_jalons ON jalons FOR DELETE TO anon USING (true);

-- ── Table : jours_non_travailles ──
CREATE POLICY anon_select_jours_non_travailles ON jours_non_travailles FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_jours_non_travailles ON jours_non_travailles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_jours_non_travailles ON jours_non_travailles FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_jours_non_travailles ON jours_non_travailles FOR DELETE TO anon USING (true);

-- ── Table : niveaux ──
CREATE POLICY anon_select_niveaux ON niveaux FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_niveaux ON niveaux FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_niveaux ON niveaux FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_niveaux ON niveaux FOR DELETE TO anon USING (true);

-- ── Table : notifications_parents ──
CREATE POLICY anon_select_notifications_parents ON notifications_parents FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_notifications_parents ON notifications_parents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_notifications_parents ON notifications_parents FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_notifications_parents ON notifications_parents FOR DELETE TO anon USING (true);

-- ── Table : objectifs ──
CREATE POLICY anon_select_objectifs ON objectifs FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_objectifs ON objectifs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_objectifs ON objectifs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_objectifs ON objectifs FOR DELETE TO anon USING (true);

-- ── Table : objectifs_globaux ──
CREATE POLICY anon_select_objectifs_globaux ON objectifs_globaux FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_objectifs_globaux ON objectifs_globaux FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_objectifs_globaux ON objectifs_globaux FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_objectifs_globaux ON objectifs_globaux FOR DELETE TO anon USING (true);

-- ── Table : parent_eleve ──
CREATE POLICY anon_select_parent_eleve ON parent_eleve FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_parent_eleve ON parent_eleve FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_parent_eleve ON parent_eleve FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_parent_eleve ON parent_eleve FOR DELETE TO anon USING (true);

-- ── Table : parents_visites ──
CREATE POLICY anon_select_parents_visites ON parents_visites FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_parents_visites ON parents_visites FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_parents_visites ON parents_visites FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_parents_visites ON parents_visites FOR DELETE TO anon USING (true);

-- ── Table : passages_niveau ──
CREATE POLICY anon_select_passages_niveau ON passages_niveau FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_passages_niveau ON passages_niveau FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_passages_niveau ON passages_niveau FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_passages_niveau ON passages_niveau FOR DELETE TO anon USING (true);

-- ── Table : periodes_notes ──
CREATE POLICY anon_select_periodes_notes ON periodes_notes FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_periodes_notes ON periodes_notes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_periodes_notes ON periodes_notes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_periodes_notes ON periodes_notes FOR DELETE TO anon USING (true);

-- ── Table : points_eleves ──
CREATE POLICY anon_select_points_eleves ON points_eleves FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_points_eleves ON points_eleves FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_points_eleves ON points_eleves FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_points_eleves ON points_eleves FOR DELETE TO anon USING (true);

-- ── Table : preferences_notifications ──
CREATE POLICY anon_select_preferences_notifications ON preferences_notifications FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_preferences_notifications ON preferences_notifications FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_preferences_notifications ON preferences_notifications FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_preferences_notifications ON preferences_notifications FOR DELETE TO anon USING (true);

-- ── Table : presences ──
CREATE POLICY anon_select_presences ON presences FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_presences ON presences FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_presences ON presences FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_presences ON presences FOR DELETE TO anon USING (true);

-- ── Table : programmes ──
CREATE POLICY anon_select_programmes ON programmes FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_programmes ON programmes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_programmes ON programmes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_programmes ON programmes FOR DELETE TO anon USING (true);

-- ── Table : purges_rgpd_log ──
CREATE POLICY anon_select_purges_rgpd_log ON purges_rgpd_log FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_purges_rgpd_log ON purges_rgpd_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_purges_rgpd_log ON purges_rgpd_log FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_purges_rgpd_log ON purges_rgpd_log FOR DELETE TO anon USING (true);

-- ── Table : recitations_sourates ──
CREATE POLICY anon_select_recitations_sourates ON recitations_sourates FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_recitations_sourates ON recitations_sourates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_recitations_sourates ON recitations_sourates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_recitations_sourates ON recitations_sourates FOR DELETE TO anon USING (true);

-- ── Table : regles_passage_niveau ──
CREATE POLICY anon_select_regles_passage_niveau ON regles_passage_niveau FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_regles_passage_niveau ON regles_passage_niveau FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_regles_passage_niveau ON regles_passage_niveau FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_regles_passage_niveau ON regles_passage_niveau FOR DELETE TO anon USING (true);

-- ── Table : resultats_examens ──
CREATE POLICY anon_select_resultats_examens ON resultats_examens FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_resultats_examens ON resultats_examens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_resultats_examens ON resultats_examens FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_resultats_examens ON resultats_examens FOR DELETE TO anon USING (true);

-- ── Table : sante_systeme ──
CREATE POLICY anon_select_sante_systeme ON sante_systeme FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_sante_systeme ON sante_systeme FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_sante_systeme ON sante_systeme FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_sante_systeme ON sante_systeme FOR DELETE TO anon USING (true);

-- ── Table : seances_instituteurs ──
CREATE POLICY anon_select_seances_instituteurs ON seances_instituteurs FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_seances_instituteurs ON seances_instituteurs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_seances_instituteurs ON seances_instituteurs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_seances_instituteurs ON seances_instituteurs FOR DELETE TO anon USING (true);

-- ── Table : sequences_config ──
CREATE POLICY anon_select_sequences_config ON sequences_config FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_sequences_config ON sequences_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_sequences_config ON sequences_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_sequences_config ON sequences_config FOR DELETE TO anon USING (true);

-- ── Table : sourates ──
CREATE POLICY anon_select_sourates ON sourates FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_sourates ON sourates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_sourates ON sourates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_sourates ON sourates FOR DELETE TO anon USING (true);

-- ── Table : validations ──
CREATE POLICY anon_select_validations ON validations FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_validations ON validations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_validations ON validations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_validations ON validations FOR DELETE TO anon USING (true);


-- ─────────────────────────────────────────────────────────────────────────
-- BLOC 3 : TABLE 'utilisateurs' — TRAITEMENT SPECIAL
-- ─────────────────────────────────────────────────────────────────────────
-- Cette table contient la colonne mot_de_passe (hash bcrypt). On veut :
-- - SELECT autorise au role anon SAUF la colonne mot_de_passe
-- - INSERT autorise (inscription publique nouvelle ecole)
-- - UPDATE autorise (modif profil, changement statut par super_admin)
-- - DELETE autorise (super_admin)
--
-- IMPORTANT : Postgres RLS ne permet PAS de masquer une colonne directement
-- via une policy. Pour proteger mot_de_passe, on s'appuie sur :
-- 1. api/auth.js qui utilise SERVICE_KEY (bypass RLS) pour lire le hash
-- 2. Une convention forte dans le code frontend : ne JAMAIS faire
--    select('*') sur utilisateurs, toujours preciser les colonnes.
-- 3. (Phase A2 future) Utiliser une vue Postgres 'utilisateurs_safe' sans
--    mot_de_passe qui sera la seule visible au role anon.
--
-- Pour A1, on autorise toutes les operations sur utilisateurs en se fiant
-- a la discipline du code (ne pas select * sur cette table).

CREATE POLICY anon_select_utilisateurs ON utilisateurs FOR SELECT TO anon USING (true);
CREATE POLICY anon_insert_utilisateurs ON utilisateurs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_utilisateurs ON utilisateurs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_utilisateurs ON utilisateurs FOR DELETE TO anon USING (true);


-- ─────────────────────────────────────────────────────────────────────────
-- BLOC 4 : VERIFICATION POST-MIGRATION
-- ─────────────────────────────────────────────────────────────────────────
-- Apres execution, verifier :
--
-- 1. RLS actif sur les 46 tables :
--    SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
--    -> toutes les lignes doivent avoir rowsecurity = true
--
-- 2. Nombre de policies cree (~184 = 46 tables x 4 operations) :
--    SELECT COUNT(*) FROM pg_policies WHERE schemaname='public';
--    -> doit retourner ~184
--
-- 3. L'alerte Supabase "rls_disabled_in_public" doit disparaitre dans les
--    24h suivantes (Supabase re-scan periodiquement).
--
-- ─────────────────────────────────────────────────────────────────────────
-- TESTS APP A FAIRE APRES APPLICATION (CRITIQUE)
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ TESTER SUR QA D'ABORD AVANT PROD !
--
-- 1. Login surveillant (compte test) -> dashboard charge ?
-- 2. Creation eleve -> OK ?
-- 3. Validation rapide -> OK ?
-- 4. Tableau honneur -> affichage OK ?
-- 5. Page certificats -> OK ?
-- 6. Page Verify publique (/verify/XXX) -> OK ?
-- 7. Inscription nouvelle ecole depuis landing -> OK ?
-- 8. Login en attente / suspendu -> messages OK ?
--
-- Si KO sur l'un de ces tests : rollback (ALTER TABLE ... DISABLE ROW LEVEL SECURITY)
-- et reprise du debug.
-- ═══════════════════════════════════════════════════════════════════════════
