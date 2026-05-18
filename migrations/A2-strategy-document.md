# Stratégie A2 — RLS strict avec isolation multi-écoles

## Statut
- **Date démarrage** : 18 mai 2026 (session terminée par pause)
- **Date prévue reprise** : 19 mai 2026 ou plus tard
- **Phase actuelle** : préparation (fonctions Postgres + headers client poussés en QA, policies non encore appliquées)

## Contexte
A1 a activé RLS sur 45 tables avec policies permissives au rôle `anon`.
A2 doit fermer la dernière faille : isolation réelle entre écoles, même pour
un utilisateur authentifié qui tenterait de bypasser via DevTools.

## Décisions validées par Jamal (session 18 mai)
- **Q1=c** : table `utilisateurs` garde policy permissive (bcrypt protège le hash)
- **Q2=oui** : exception pour inscription publique (INSERT ecoles + utilisateurs)
- **Q3=α** : page Verify reste publique sur 7 tables (obscurité par numéro)
- **Pause** : A2 reprend à tête reposée pour cadrage exhaustif des cas particuliers

## Déjà fait en QA
- ✅ Fichier `migrations/security-phase2-A2-block1-functions.sql` créé (fonctions Postgres, pas encore appliqué)
- ✅ Client `src/lib/supabase.js` modifié : envoie headers `x-tartily-ecole` + `x-tartily-parent` automatiquement (inoffensif sans policies)

## Cas particuliers exhaustifs identifiés (CRITIQUES à gérer)

### Workflows ANONYMES (pas de header)
1. **Page Inscription publique** (`/inscription`)
   - SELECT `utilisateurs` (vérif unicité identifiant)
   - INSERT `ecoles`
   - INSERT `utilisateurs`
   - Solution : policies spéciales INSERT autorisé sans header
   
2. **Page Verify certificat** (`/verify/CERT-XXX`)
   - SELECT sur 7 tables : certificats_eleves, eleves, ecoles, niveaux, jalons, examens, resultats_examens
   - Solution Q3=α : policies SELECT publiques sur ces 7 tables

3. **Page Landing** (`/`)
   - Aucune requête Supabase (statique)
   - Pas de problème

4. **Login** (`/login`)
   - Via `/api/auth.js` qui utilise SERVICE_KEY (bypass RLS)
   - Pas de problème

### Workflows AUTHENTIFIÉS
5. **Surveillant connecté**
   - Header `x-tartily-ecole` présent
   - Doit accéder uniquement à son école
   - Toutes les opérations CRUD sur les tables avec ecole_id

6. **Super-admin connecté avec impersonification**
   - Header `x-tartily-ecole` = ecole_id de l'école impersonifiée
   - Comportement identique au surveillant
   - ⚠️ Le wrapper supabase.js bloque déjà les écritures en mode impersonification

7. **Super-admin connecté SANS impersonification (corbeille globale)**
   - Pas d'ecole_id spécifique → header absent ou spécial
   - Doit voir TOUTES les écoles (vue globale)
   - Solution : header spécial `x-tartily-super-admin: true` ? Ou utilise `supabaseRaw` (sans wrapper) ?
   - **À CADRER**

8. **Parent connecté (Portail Parent)**
   - Header `x-tartily-parent` présent
   - Doit accéder aux données de ses enfants (table parent_eleve)
   - Doit pouvoir lire validations, recitations_sourates, cotisations DE ses enfants
   - Ne doit PAS voir d'autres enfants de la même école

## Catégorisation des 45 tables (validée par diagnostic SQL)

### CAT A — 35 tables avec ecole_id (isolation stricte)
```
alertes, annees_scolaires, apprentissages, bareme_notes, blocs_examen,
certificats_eleves, cotisations, cours, cours_validations, depenses,
eleves, ensembles_sourates, examens, exceptions_hizb, exceptions_recitation,
exports_rgpd, jalons, jours_non_travailles, niveaux, objectifs,
objectifs_globaux, parents, passages_niveau, periodes_notes, points_eleves,
presences, programmes, recitations_sourates, regles_passage_niveau,
resultats_examens, seances_instituteurs, sequences_config, utilisateurs (Q1=c exception),
validations
```

### CAT B — 2 tables hybrides (ecole_id + parent_id)
```
notifications_parents (parent peut lire les siennes ; surveillant celles de son école)
parents_visites (idem)
```

### CAT C — 1 table parent_id seul
```
parent_eleve (jointure N:N parent-élève, pas d'ecole_id direct)
```

### CAT D — 4 tables racine sans ecole_id (JOIN nécessaire)
```
ecoles (filtre par id = current_ecole_id())
cours_axes (lié à cours via cours_id)
cours_niveaux (lié à cours via cours_id)
cours_validations_exceptions (lié à cours_validations via cours_validation_id)
```

### CAT E — 3 tables référence publique (lecture libre, écriture interdite)
```
sourates
preferences_notifications
sante_systeme
```

### CAT F — 2 tables système (très restreint)
```
audit_log (lecture super_admin uniquement)
purges_rgpd_log (lecture super_admin uniquement)
```

## Plan d'exécution révisé pour demain

### Phase 1 — Cadrage final (30 min)
- Décider du comportement super-admin sans impersonification (CAT spécial ?)
- Cadrer les policies parent_eleve et notifications_parents (CAT B + C)
- Préparer cas de test pour chaque catégorie

### Phase 2 — SQL Bloc 1 (fonctions) sur QA (5 min)
- Appliquer `security-phase2-A2-block1-functions.sql`
- Tester : `SELECT public.current_ecole_id();` doit retourner NULL en SQL Editor

### Phase 3 — Migration policies par CAT (estimé 1h30)
Pour chaque CAT, écrire les policies en pattern :
```sql
USING (
  (current_ecole_id() IS NOT NULL AND ecole_id = current_ecole_id())
  OR
  (current_parent_id() IS NOT NULL AND <condition_parent>)
)
```
- CAT A : 35 tables × 4 policies = 140 policies
- CAT B : 2 tables × 4 policies = 8 policies (pattern hybride)
- CAT C : 1 table × 4 policies = 4 policies
- CAT D : 4 tables × 4 policies = 16 policies (avec JOIN)
- CAT E : 3 tables × policies lecture publique
- CAT F : 2 tables × policies super-admin only
- Exceptions (CAT G) : inscription publique + verify publique

### Phase 4 — Tests QA exhaustifs (45 min)
Cas de test obligatoires :
- [ ] Login surveillant école A → voit ses élèves
- [ ] Login surveillant école A → tente requête `eleves` école B via DevTools → BLOQUÉ
- [ ] Inscription nouvelle école publique → fonctionne (sans header)
- [ ] Page Verify avec numéro valide → affiche le certificat (sans header)
- [ ] Page Verify avec numéro inexistant → erreur normale
- [ ] Parent login → voit ses enfants uniquement
- [ ] Parent login → tente requête autres enfants via DevTools → BLOQUÉ
- [ ] Super-admin sans impersonification → ?
- [ ] Super-admin avec impersonification école A → comportement = surveillant école A

### Phase 5 — Promotion Prod (15 min)
- Si QA OK → migration SQL Prod
- Monitoring 24h post-déploiement

## Risques majeurs identifiés

1. **Casse Portail Parent** : si je rate la policy parent_eleve ou notifications_parents
   → Mitigation : tests dédiés parent avant push Prod

2. **Casse inscription publique** : si les exceptions ne sont pas bien posées
   → Mitigation : test inscription en mode anonyme

3. **Casse page Verify** : si SELECT bloqué sur tables liées
   → Mitigation : test avec un certificat existant

4. **Casse super-admin** : comportement à clarifier
   → Mitigation : tests dédiés avant push Prod

5. **Performance** : 45 tables × 4 policies = 180 policies évaluées à chaque requête
   → Mitigation : `current_ecole_id()` marquée STABLE (cachée par Postgres)

## Rollback prévu

Si quelque chose casse en Prod après application :
```sql
-- Re-installer les policies permissives A1
-- (script de rollback à préparer en parallèle des policies A2)
```

## Notes pour Claude (futur moi)

- **Ne pas oublier** : le wrapper `supabase.js` filtre déjà `deleted_at IS NULL` sur les tables soft-delete. Les policies A2 doivent **coexister** avec ce filtre.
- **Ne pas oublier** : SUPABASE_SERVICE_KEY dans `api/auth.js` bypass TOUS les RLS (donc login fonctionnera toujours).
- **Ne pas oublier** : `consultations_parents` est dans `SYSTEM_TABLES_WHITELIST` du wrapper mais cette table n'existe pas en BDD (à nettoyer plus tard).
