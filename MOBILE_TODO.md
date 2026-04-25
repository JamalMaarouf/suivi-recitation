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
