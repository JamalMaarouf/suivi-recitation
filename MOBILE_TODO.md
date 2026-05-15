# 📱 MOBILE_TODO — Écarts à traiter en Phase 5

> Fichier vivant. Enrichi au fur et à mesure des phases 1-4 (focus desktop).
> Sera traité intégralement en **Phase 5 : Alignement Mobile**, puis supprimé.

---

## Phase 1 — Sécurité critique

### 1.1 Lecture seule impersonification
- [ ] Vérifier que tous les boutons d'écriture sont désactivés en mode impersonification sur **mobile** (vues compactes, bottom sheets, FAB, etc.)
- [ ] Vérifier que `ImpersonationBanner` reste bien visible sur mobile en haut

### 1.2 Soft-delete élèves & parents
- [ ] Vérifier que les listes mobile (ElevesMobile, GestionParents mobile) filtrent bien `deleted_at IS NULL`
- [ ] Recyclage des éléments supprimés : interface super-admin sur mobile (peut-être à reporter sine die si pas critique mobile)

---

## Phase 2 — Performance

### Lazy loading
- [ ] Vérifier que le lazy split n'a pas cassé la navigation mobile

### Requêtes optimisées
- [ ] S'assurer que les requêtes optimisées desktop bénéficient aussi mobile (logique partagée normalement)

---

## Phase 3 — Polish UX (gros chantier d'écarts attendus)

### Menus & Navbar
- [ ] **À lister par Jamal** : différences menus Gestion entre desktop et mobile
- [ ] **À lister par Jamal** : différences Navbar entre desktop et mobile
- [ ] Footer mobile : refléter les changements desktop si applicable

### Pages avec divergences potentielles
- [ ] Gestion (3 onglets) : variantes mobile/desktop différentes
- [ ] Finance : 4 onglets desktop, à vérifier mobile
- [ ] DashboardDirection : section RGPD ajoutée récemment, à vérifier mobile
- [ ] SuperAdminDashboard : 4 onglets dont Audit, à vérifier mobile

### Composants partagés à harmoniser
- [ ] ExportButtons : rendu mobile vs desktop
- [ ] GlobalSearch : FAB mobile OK ; vérifier après refactos
- [ ] Toasts : positionnement mobile

---

## Phase 4 — Documentation

### Manuels
- [ ] Manuel surveillant : ajouter section "Différences mobile" si nécessaire
- [ ] Screenshots : prévoir versions desktop ET mobile pour les manuels

---

## Notes générales

- Le portail parent mobile a été refait en bottom sheets lors de P.A.1. C'est la nouvelle référence.
- Le mode kiosk mobile fonctionne bien.
- L'offline queue / NetworkBanner est testée mobile + desktop.

### Pull-to-refresh sur Assiduité (retiré J2 sprint 12j)

Le bloc pull-to-refresh qui était dans `src/pages/Assiduite.js` (commenté "Phase 2 Sprint 4") **n'a jamais fonctionné en Prod** : `loadData` n'existait pas dans la scope du composant top-level, et l'import `usePullToRefresh` était absent. Code mort-né, supprimé dans le commit J2 (page Assiduité cassée par `ReferenceError`).

**Si réintroduction souhaitée plus tard** : refactor propre nécessaire car :
1. La page Assiduité a un early return pour le mode kiosque/mobile, donc le hook doit être placé AVANT ce return (règle des hooks React)
2. `useAssiduiteData` (le hook qui contient `loadData` réel) est appelé dans les sous-composants `SaisieKiosque` et `SaisieDesktop`, pas dans `Assiduite` top-level
3. Vu que le mode mobile est un **kiosque tactile**, le pull-to-refresh peut être contre-intuitif (un parent tire l'écran par erreur). À questionner avant d'ajouter.

---

## Futur — Droits étendus instituteur (noté J2 sprint 12j)

**Demande Jamal** : à terme, l'instituteur doit pouvoir **paramétrer les cours** (créer un cours, définir ses axes), pas seulement valider/suivre.

**État actuel (J2 sprint 12j)** :
- `cours` / `SuiviCours` : surveillant + instituteur ✅ (déjà OK)
- `cours_validation` : surveillant + instituteur ✅ (déjà OK)
- `gestion_cours` : surveillant uniquement ❌ (à étendre à instituteur)
- `cours_axes` : surveillant uniquement ❌ (à étendre à instituteur)

**Décision J2** : noté, **pas implémenté maintenant**. Sera traité dans un sprint dédié "droits étendus instituteur" (post-landing).

**Risque à valider avant impl** :
- Un instituteur pourrait-il créer des cours qui s'appliquent à TOUS les élèves de l'école ? (probablement oui, donc à scoper)
- Conflits possibles si 2 instituteurs créent des cours en parallèle
