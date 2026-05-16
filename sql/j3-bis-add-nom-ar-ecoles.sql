-- ═══════════════════════════════════════════════════════════════════════════
-- Migration J3-bis — Ajout colonne nom_ar pour ecoles
-- Sprint 12j J3 — 16 mai 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CONTEXTE
-- Le certificat refondu (B5) doit afficher le nom de l'ecole en arabe
-- en titre principal avec le prefixe "المدرسة القرآنية". Le code lisait
-- ecole.nom_ar qui n'existait pas en BDD -> resultat : fallback generique.
--
-- Cette migration ajoute la colonne nom_ar a la table ecoles, identique
-- au pattern utilise pour les autres entites (niveaux, jalons, periodes,
-- sourates, cours, etc. qui ont toutes un champ nom_ar).
--
-- A EXECUTER sur Supabase QA en premier (qqcjryowpbtxkecknrre),
-- puis sur Prod (uwqhtahknhftinlzmusi) au release.
--
-- IDEMPOTENT : utilise IF NOT EXISTS, peut etre relance.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE ecoles
  ADD COLUMN IF NOT EXISTS nom_ar TEXT;

COMMENT ON COLUMN ecoles.nom_ar IS
  'Nom de l''ecole en arabe (ex: "مدرسة الفلاح"). Affiche en titre principal sur les certificats. Si NULL, le nom francais est utilise comme fallback avec le prefixe "المدرسة القرآنية".';
