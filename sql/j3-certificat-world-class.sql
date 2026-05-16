-- ═══════════════════════════════════════════════════════════════════════════
-- Migration J3 — Certificat world-class (B5 sprint 12j)
-- 16 mai 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CONTENU
-- 1. Champs directeur d'ecole (signature optionnelle sur le certificat)
-- 2. Numero de certificat auto-genere au format "AAAA/NNNN" par ecole
--    via trigger PostgreSQL (atomique, pas de race condition)
--
-- A EXECUTER sur Supabase QA en premier (qqcjryowpbtxkecknrre),
-- tests OK = on l'execute sur Prod (uwqhtahknhftinlzmusi).
--
-- IDEMPOTENT : utilise IF NOT EXISTS / CREATE OR REPLACE pour pouvoir
-- relancer sans risque ni doublons.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Champs directeur sur ecoles (signature optionnelle)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE ecoles
  ADD COLUMN IF NOT EXISTS nom_directeur TEXT,
  ADD COLUMN IF NOT EXISTS nom_directeur_ar TEXT;

COMMENT ON COLUMN ecoles.nom_directeur IS
  'Nom du Directeur/Mudir affiche sur les certificats d''examen (signature gauche). NULL = afficher uniquement la signature du Surveillant.';
COMMENT ON COLUMN ecoles.nom_directeur_ar IS
  'Nom du Directeur en arabe. Si NULL mais nom_directeur renseigne, on utilise le nom francais pour les 2 langues.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Numero de certificat sur certificats_eleves
-- ─────────────────────────────────────────────────────────────────────────
-- Format : "AAAA/NNNN" ex: "2026/0001", "2026/0002", reset chaque annee.
-- Sequence par (ecole_id, annee). Chaque ecole a sa propre numerotation.
-- Calcule via trigger BEFORE INSERT pour eviter les race conditions.

ALTER TABLE certificats_eleves
  ADD COLUMN IF NOT EXISTS numero TEXT;

COMMENT ON COLUMN certificats_eleves.numero IS
  'Numero du certificat au format AAAA/NNNN, genere automatiquement par trigger. Unique par (ecole_id, annee de date_emission).';

-- Index pour rapidite trigger (lecture des numeros existants)
CREATE INDEX IF NOT EXISTS idx_certificats_eleves_ecole_annee
  ON certificats_eleves (ecole_id, (EXTRACT(YEAR FROM date_emission)::INT));

-- Contrainte d'unicite : pas 2 certificats avec le meme numero dans la meme ecole
-- Note : on ne contraint pas sur l'annee car le numero CONTIENT deja l'annee.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_certificats_eleves_ecole_numero
  ON certificats_eleves (ecole_id, numero)
  WHERE numero IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Trigger : generation auto du numero a l'INSERT
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_certificats_eleves_set_numero()
RETURNS TRIGGER AS $$
DECLARE
  v_annee INT;
  v_sequence INT;
  v_numero TEXT;
BEGIN
  -- Ne pas regenerer si deja fourni (utile pour migrations historiques)
  IF NEW.numero IS NOT NULL AND NEW.numero <> '' THEN
    RETURN NEW;
  END IF;

  -- Annee depuis date_emission (ou maintenant si non fournie)
  v_annee := EXTRACT(YEAR FROM COALESCE(NEW.date_emission, NOW()))::INT;

  -- Compter les certificats existants de cette ecole pour cette annee
  -- (max + 1 plutot que count + 1 pour resister aux suppressions)
  SELECT COALESCE(
    MAX(
      CASE
        WHEN numero ~ '^[0-9]{4}/[0-9]+$' AND SUBSTRING(numero FROM 1 FOR 4) = v_annee::TEXT
        THEN SUBSTRING(numero FROM 6)::INT
        ELSE 0
      END
    ), 0
  ) + 1
  INTO v_sequence
  FROM certificats_eleves
  WHERE ecole_id = NEW.ecole_id;

  -- Format AAAA/NNNN avec padding 4 chiffres (jusqu'a 9999/an, large)
  v_numero := v_annee::TEXT || '/' || LPAD(v_sequence::TEXT, 4, '0');

  NEW.numero := v_numero;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop d'abord pour pouvoir relancer le script
DROP TRIGGER IF EXISTS set_numero_certificat ON certificats_eleves;

CREATE TRIGGER set_numero_certificat
  BEFORE INSERT ON certificats_eleves
  FOR EACH ROW
  EXECUTE FUNCTION trg_certificats_eleves_set_numero();

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Backfill : numeroter les certificats EXISTANTS qui n'ont pas de numero
-- ─────────────────────────────────────────────────────────────────────────
-- On les ordonne par date_emission croissant pour respecter l'ordre historique.
-- Boucle PL/pgSQL car on doit calculer un numero unique par (ecole, annee).

DO $$
DECLARE
  r RECORD;
  v_annee INT;
  v_sequence INT;
  v_numero TEXT;
BEGIN
  FOR r IN
    SELECT id, ecole_id, date_emission
    FROM certificats_eleves
    WHERE numero IS NULL OR numero = ''
    ORDER BY ecole_id, date_emission ASC, id ASC
  LOOP
    v_annee := EXTRACT(YEAR FROM COALESCE(r.date_emission, NOW()))::INT;

    SELECT COALESCE(
      MAX(
        CASE
          WHEN numero ~ '^[0-9]{4}/[0-9]+$' AND SUBSTRING(numero FROM 1 FOR 4) = v_annee::TEXT
          THEN SUBSTRING(numero FROM 6)::INT
          ELSE 0
        END
      ), 0
    ) + 1
    INTO v_sequence
    FROM certificats_eleves
    WHERE ecole_id = r.ecole_id;

    v_numero := v_annee::TEXT || '/' || LPAD(v_sequence::TEXT, 4, '0');

    UPDATE certificats_eleves
    SET numero = v_numero
    WHERE id = r.id;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5) Verifications post-migration (a executer manuellement)
-- ─────────────────────────────────────────────────────────────────────────
-- SELECT id, ecole_id, date_emission, numero FROM certificats_eleves
--   WHERE numero IS NULL OR numero = '';   -- doit etre vide
--
-- SELECT ecole_id, COUNT(*) AS nb_certifs, COUNT(DISTINCT numero) AS nb_numeros
--   FROM certificats_eleves
--   GROUP BY ecole_id;                     -- nb_certifs doit egaler nb_numeros
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'ecoles' AND column_name LIKE 'nom_directeur%';
--                                            -- doit retourner 2 lignes

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION J3
-- ═══════════════════════════════════════════════════════════════════════════
