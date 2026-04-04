
-- ============================================================
-- PHASE 2 : Migration Multi-École
-- À exécuter UNE SEULE FOIS dans Supabase SQL Editor
-- ============================================================

-- 1. TABLE ECOLES
CREATE TABLE IF NOT EXISTS ecoles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom             text NOT NULL,
  ville           text,
  pays            text DEFAULT 'Maroc',
  telephone       text,
  email           text,
  code_acces      text UNIQUE,          -- code généré pour l'école
  statut          text DEFAULT 'en_attente', -- 'en_attente' | 'active' | 'suspendue'
  valide_par      uuid REFERENCES utilisateurs(id),
  date_validation timestamptz,
  note_admin      text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE ecoles DISABLE ROW LEVEL SECURITY;

-- 2. AJOUTER ecole_id SUR TOUTES LES TABLES EXISTANTES
ALTER TABLE utilisateurs      ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE eleves            ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE validations       ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE recitations_sourates ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE apprentissages    ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE objectifs_globaux ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE cotisations       ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE depenses          ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE parents           ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE passages_niveau   ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE exceptions_recitation ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);
ALTER TABLE exceptions_hizb   ADD COLUMN IF NOT EXISTS ecole_id uuid REFERENCES ecoles(id);

-- 3. AJOUTER role super_admin + statut_compte SUR utilisateurs
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS statut_compte text DEFAULT 'actif';
-- role existant : 'instituteur' | 'surveillant' → on ajoute 'super_admin'

-- 4. CRÉER L'ÉCOLE DE TEST (avec les données actuelles)
INSERT INTO ecoles (nom, ville, pays, statut, code_acces)
VALUES ('École de test', 'Casablanca', 'Maroc', 'active', 'ECOLE-TEST-001')
ON CONFLICT (code_acces) DO NOTHING;

-- 5. RATTACHER TOUTE LA DATA EXISTANTE À L'ÉCOLE DE TEST
DO $$
DECLARE
  ecole_test_id uuid;
BEGIN
  SELECT id INTO ecole_test_id FROM ecoles WHERE code_acces = 'ECOLE-TEST-001';

  UPDATE utilisateurs           SET ecole_id = ecole_test_id WHERE ecole_id IS NULL AND role != 'super_admin';
  UPDATE eleves                 SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE validations            SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE recitations_sourates   SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE apprentissages         SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE objectifs_globaux      SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE cotisations            SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE depenses               SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE parents                SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE passages_niveau        SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE exceptions_recitation  SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;
  UPDATE exceptions_hizb        SET ecole_id = ecole_test_id WHERE ecole_id IS NULL;

  -- Rattacher l'école de test à son surveillant (compte admin)
  UPDATE ecoles 
  SET valide_par = (SELECT id FROM utilisateurs WHERE identifiant = 'admin' LIMIT 1),
      date_validation = now()
  WHERE code_acces = 'ECOLE-TEST-001';

  -- Mettre à jour ecole_id du surveillant admin sur l'école de test
  UPDATE utilisateurs 
  SET ecole_id = ecole_test_id
  WHERE identifiant = 'admin';

END $$;

-- 6. CRÉER LE COMPTE SUPER ADMIN
INSERT INTO utilisateurs (prenom, nom, identifiant, mot_de_passe, role, statut_compte)
VALUES ('Super', 'Admin', 'superadmin', 'superadmin123', 'super_admin', 'actif')
ON CONFLICT (identifiant) DO UPDATE SET role = 'super_admin', statut_compte = 'actif';

-- 7. VÉRIFICATION FINALE
SELECT 'Écoles créées:' as info, count(*) as nb FROM ecoles
UNION ALL
SELECT 'Utilisateurs migrés:', count(*) FROM utilisateurs WHERE ecole_id IS NOT NULL
UNION ALL
SELECT 'Élèves migrés:', count(*) FROM eleves WHERE ecole_id IS NOT NULL
UNION ALL
SELECT 'Super admins:', count(*) FROM utilisateurs WHERE role = 'super_admin';
