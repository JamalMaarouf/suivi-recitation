-- ══════════════════════════════════════════════════════════════════
-- SCRIPT DE NETTOYAGE DB — Suivi Récitation
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Diagnostiquer les données corrompues ────────────────────────
-- Validations avec nombre_tomon = 0 (bug Hizb ancien)
SELECT id, eleve_id, type_validation, nombre_tomon, date_validation
FROM validations
WHERE type_validation = 'tomon' AND nombre_tomon = 0;

-- Récitations sourates sans ecole_id (bug séquence ancien)
SELECT id, eleve_id, sourate_id, date_validation
FROM recitations_sourates
WHERE ecole_id IS NULL;

-- ── 2. Supprimer les lignes corrompues ────────────────────────────
-- ATTENTION : vérifiez d'abord les résultats ci-dessus avant d'exécuter

-- Supprimer validations tomon avec nombre_tomon = 0
DELETE FROM validations
WHERE type_validation = 'tomon' AND nombre_tomon = 0;

-- Supprimer récitations sourates sans ecole_id
DELETE FROM recitations_sourates
WHERE ecole_id IS NULL;

-- ── 3. Vérifier les orphelins ─────────────────────────────────────
-- Validations sans élève correspondant
SELECT v.id, v.eleve_id, v.date_validation
FROM validations v
LEFT JOIN eleves e ON e.id = v.eleve_id
WHERE e.id IS NULL;

-- Récitations sans élève correspondant
SELECT r.id, r.eleve_id, r.date_validation
FROM recitations_sourates r
LEFT JOIN eleves e ON e.id = r.eleve_id
WHERE e.id IS NULL;

-- ── 4. Nettoyer les orphelins si besoin ──────────────────────────
-- (décommenter seulement si les requêtes ci-dessus retournent des lignes)

-- DELETE FROM validations v
-- WHERE NOT EXISTS (SELECT 1 FROM eleves e WHERE e.id = v.eleve_id);

-- DELETE FROM recitations_sourates r
-- WHERE NOT EXISTS (SELECT 1 FROM eleves e WHERE e.id = r.eleve_id);

-- ── 5. Statistiques finales ───────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM eleves)              AS total_eleves,
  (SELECT COUNT(*) FROM validations)         AS total_validations,
  (SELECT COUNT(*) FROM recitations_sourates)AS total_recitations,
  (SELECT COUNT(*) FROM utilisateurs WHERE role='instituteur') AS total_instituteurs,
  (SELECT COUNT(*) FROM utilisateurs WHERE role='parent')      AS total_parents,
  (SELECT COUNT(*) FROM utilisateurs WHERE role='surveillant') AS total_surveillants;
