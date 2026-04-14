-- Ajouter les champs MDP par défaut dans la table ecoles
ALTER TABLE ecoles 
  ADD COLUMN IF NOT EXISTS mdp_defaut_instituteurs TEXT DEFAULT 'ecole2024',
  ADD COLUMN IF NOT EXISTS mdp_defaut_parents TEXT DEFAULT 'parent2024';
