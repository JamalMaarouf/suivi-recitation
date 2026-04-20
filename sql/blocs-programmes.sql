-- ═══════════════════════════════════════════════════════════
-- Migration : Ajout de la notion de BLOCS au sein des programmes
-- ═══════════════════════════════════════════════════════════
-- 
-- Contexte : certaines écoles organisent le programme d'un niveau en
-- plusieurs blocs pédagogiques (ex: Collège 60 Hizb -> 4 blocs de 15 Hizb).
-- Chaque bloc peut avoir son propre nom et son propre sens de récitation
-- (ascendant ou descendant).
--
-- Rétrocompatibilité :
-- - Les programmes existants conservent bloc_numero = 1 (1 seul bloc)
-- - Leur comportement est strictement identique à avant
-- - Les écoles peuvent ensuite reconfigurer leur programme en plusieurs
--   blocs via la page Gestion > Niveaux
--
-- Impact sur les autres tables : AUCUN
-- - validations, eleves, niveaux, utilisateurs : pas touchés
-- - certificats_eleves : pas touché (alimenté plus tard, étape D)
-- ═══════════════════════════════════════════════════════════

-- 1. Ajout des colonnes de blocs
ALTER TABLE programmes 
  ADD COLUMN IF NOT EXISTS bloc_numero INTEGER NOT NULL DEFAULT 1;

ALTER TABLE programmes 
  ADD COLUMN IF NOT EXISTS bloc_nom TEXT;

ALTER TABLE programmes 
  ADD COLUMN IF NOT EXISTS bloc_sens TEXT NOT NULL DEFAULT 'asc' 
  CHECK (bloc_sens IN ('asc', 'desc'));

-- 2. Index pour requêtes efficaces par bloc
CREATE INDEX IF NOT EXISTS idx_programmes_niveau_bloc 
  ON programmes(niveau_id, bloc_numero, ordre);

-- 3. Commentaires pour documentation
COMMENT ON COLUMN programmes.bloc_numero IS 
  'Numéro du bloc pédagogique (1, 2, 3...). Défaut = 1 = programme continu sans blocs.';
COMMENT ON COLUMN programmes.bloc_nom IS 
  'Nom libre du bloc donné par l''école (ex: "Juz Amma"). NULL si pas utilisé.';
COMMENT ON COLUMN programmes.bloc_sens IS 
  'Sens de récitation AU SEIN du bloc : asc (croissant) ou desc (décroissant).';

-- ═══════════════════════════════════════════════════════════
-- Vérification post-migration (à exécuter manuellement)
-- ═══════════════════════════════════════════════════════════
-- SELECT COUNT(*) AS total_lignes,
--        COUNT(DISTINCT bloc_numero) AS nb_blocs_distincts,
--        MIN(bloc_numero) AS min_bloc,
--        MAX(bloc_numero) AS max_bloc
-- FROM programmes;
--
-- Résultat attendu pour une base existante :
--   total_lignes = nombre de lignes (inchangé)
--   nb_blocs_distincts = 1
--   min_bloc = max_bloc = 1
