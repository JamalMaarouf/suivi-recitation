-- Migration objectifs v2 — structure simplifiée
-- Objectifs par niveau OU par élève, basés sur le nombre

-- Nouvelle table objectifs
CREATE TABLE IF NOT EXISTS objectifs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ecole_id        uuid NOT NULL REFERENCES ecoles(id) ON DELETE CASCADE,

  -- Cible : niveau OU élève (pas les deux)
  type_cible      text NOT NULL CHECK (type_cible IN ('niveau','eleve')),
  niveau_id       uuid REFERENCES niveaux(id) ON DELETE CASCADE,
  eleve_id        uuid REFERENCES eleves(id)  ON DELETE CASCADE,

  -- Métrique
  metrique        text NOT NULL CHECK (metrique IN ('tomon','hizb','sourate','ensemble')),
  valeur_cible    integer NOT NULL DEFAULT 1,  -- nombre à atteindre

  -- Période
  type_periode    text NOT NULL CHECK (type_periode IN ('semaine','mois','trimestre','semestre','annee','custom')),
  date_debut      date NOT NULL,
  date_fin        date NOT NULL,

  -- Méta
  notes           text,
  actif           boolean DEFAULT true,
  created_by      uuid,
  created_at      timestamp DEFAULT now(),

  -- Contraintes
  CONSTRAINT objectif_cible_check CHECK (
    (type_cible='niveau' AND niveau_id IS NOT NULL AND eleve_id IS NULL) OR
    (type_cible='eleve'  AND eleve_id  IS NOT NULL AND niveau_id IS NULL)
  )
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_objectifs_ecole    ON objectifs(ecole_id);
CREATE INDEX IF NOT EXISTS idx_objectifs_niveau   ON objectifs(niveau_id);
CREATE INDEX IF NOT EXISTS idx_objectifs_eleve    ON objectifs(eleve_id);
CREATE INDEX IF NOT EXISTS idx_objectifs_periode  ON objectifs(date_debut, date_fin);

-- RLS
ALTER TABLE objectifs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "objectifs_ecole" ON objectifs
  USING (ecole_id = (SELECT ecole_id FROM utilisateurs WHERE id = auth.uid()));
