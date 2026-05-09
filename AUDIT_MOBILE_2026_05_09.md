# 📱 AUDIT MOBILE — Phase 2

**Date** : 9 mai 2026  
**Périmètre Vague 1** : 8 pages les plus utilisées par le surveillant  
**Statut** : Vague 1 terminée — Vagues suivantes à programmer

---

## 🎯 Objectif Phase 2

Une **vraie application mobile classe mondiale**, pas une copie PC sur petit écran.

### Best practices visées
- Bottom tab bar (zone du pouce), 3-5 tabs max
- Cibles tactiles ≥ 44×44px
- Skeleton loaders au lieu de spinners
- Optimistic UI (déjà en place)
- Pull-to-refresh
- Cartes empilées au lieu de tableaux denses
- Hiérarchie visuelle simplifiée
- États clairs (Empty / Error / Loading / Success)
- RTL natif (déjà en place ✅)
- Mode hors ligne robuste (déjà en place ✅)

---

## 📋 VAGUE 1 — 8 pages les plus utilisées (TERMINÉE)

### 1️⃣ Dashboard mobile

#### ✅ Ce qui est bien
- Header gradient + cercles décoratifs
- KPIs row (4 stats) avec backdrop-blur
- Score école dans une card en gradient
- Alertes contextuelles cliquables
- Navigation 3 colonnes avec icônes colorées
- Podium top 3
- Padding bottom 80px (anticipation tab bar)

#### ⚠️ À améliorer
- 🎯 **CRITIQUE** : Pas de bottom tab bar
- 🎯 **CRITIQUE** : 17 modules dans la grid (trop !)
- ⚠️ KPIs trop denses
- ⚠️ Pas de pull-to-refresh
- ✨ Pas d'haptic feedback

---

### 2️⃣ EnregistrerRecitation mobile

#### ✅ Ce qui est bien
- Header gradient cohérent
- Carte élève avec avatar
- Progress bar Hizb (8 barres)
- États clairs (loading / pas d'élève / Hizb attente / OK)

#### ⚠️ À améliorer
- 🎯 **CRITIQUE** : Pas de skeleton loader (juste "⏳ Chargement...")
- 🎯 **CRITIQUE** : Tailles tactiles à vérifier (boutons step)
- ⚠️ Pas de feedback haptic/sonore sur validation
- ⚠️ Pas de confirmation 2 étapes pour Hizb complet
- ✨ Pas de mode main droite/gauche

---

### 3️⃣ ValidationRapide mobile

#### ✅ Ce qui est bien
- Header sticky
- Padding bottom 80px

#### ⚠️ À améliorer
- 🎯 **CRITIQUE** : Pas de différenciation forte mobile/PC (paddings adaptés mais structure desktop)
- 🎯 **CRITIQUE** : Densité d'info trop élevée pour validation rapide
- ⚠️ Pas de batch actions claires (sticky bar "X sélectionnés")
- ⚠️ Tabs Hizb/Sourate à transformer en segmented control

---

### 4️⃣ ListeNotes mobile

#### ✅ Ce qui est bien
- Header gradient sticky
- Boutons export PDF / Excel intégrés
- 💀 **Skeleton loader** déjà en place (pattern à généraliser)
- Filtres compacts

#### ⚠️ À améliorer
- 🚨 **CRITIQUE** : **Tableau 9 colonnes sur mobile** — anti-pattern absolu
- 🚨 **CRITIQUE** : Pas de hiérarchie élève (nom + total en gros)
- ⚠️ Filtres en grid auto-fill (mieux empilé sur mobile)
- ✨ Pas d'indicateur de tri

---

### 5️⃣ ElevesMobile (mobile-only)

#### ✅ Ce qui est bien
- Header gradient sticky avec recherche intégrée
- Cartes élève bien designées (avatar coloré, hiérarchie)
- Chips de niveaux colorés sélectionnables
- Recherche temps réel
- Boutons action édit/supprimer
- Formulaire d'ajout en grid 2 colonnes
- Toasts inline pour feedback

#### ⚠️ À améliorer
- ⚠️ Pas de bouton "+" flottant (FAB standard mobile)
- ⚠️ Pas de skeleton loader (juste "...")
- ⚠️ Boutons action 7×9px de padding (trop petits, < 44×44)
- ✨ Pas de swipe actions
- ✨ Pas de groupement par niveau (avec headers sticky)

---

### 6️⃣ FicheEleve mobile

#### ✅ Ce qui est bien
- Header gradient sticky avec avatar implicite, nom, niveau, action principale
- Score banner (gros chiffre coloré)
- BadgeStatutParent intégré
- Tabs scrollables horizontalement

#### ⚠️ À améliorer
- 🚨 **CRITIQUE** : **10 onglets scrollables** (Aperçu/Progression/Historique/Muraja/Objectifs/Examens/Certificats/Assiduité/Cours/Notes) — beaucoup trop
- 🚨 **CRITIQUE** : Onglets non-discoverable (cachés à droite)
- ⚠️ Score peut être plus impactant (graphique mini, tendance)
- ✨ Pas de pull-to-refresh

---

### 7️⃣ ListeCertificats mobile

#### ✅ Ce qui est bien
- Header sticky avec gradient + recherche + boutons export
- Recherche intégrée au header
- Filtres en chips horizontaux scrollables
- Bouton "✕" pour reset filtres
- Cartes empilées avec icône 🏅
- RTL pour nom arabe certif

#### ⚠️ À améliorer
- ⚠️ Pas de skeleton loader
- ⚠️ Filtres en `<select>` natifs dans des chips (incohérence visuelle)
- ✨ Pas d'action rapide sur la carte (voir cert / télécharger)
- ✨ Pas de groupement par date

---

### 8️⃣ GestionExamens mobile

#### ✅ Ce qui est bien
- Header sticky très complet (titre + Ajouter + chips niveau + recherche + export)
- Chips de filtres niveau colorées
- Cartes examens avec icône métier (🔒/📢)
- 3 actions claires en bas (Modifier / Activer / Supprimer)
- Export PDF / Excel intégré

#### 🚨 BUG VISUEL TROUVÉ
- **Ligne 670** : `color:'#fff'` sur fond blanc → **texte du contenu invisible !**

#### ⚠️ À améliorer
- 🚨 **BUG** : `color:'#fff'` ligne 670 — fix immédiat
- ⚠️ 3 boutons toujours visibles (Activer/Supprimer pourraient être en menu •••)
- ⚠️ Pas de skeleton loader
- ✨ Pas de tri (par date/niveau/nom)

---

## 📊 SYNTHÈSE GLOBALE — VAGUE 1

### 🚨 Critiques absolus à traiter en priorité

| # | Page | Problème |
|---|---|---|
| 1 | **ListeNotes mobile** | Tableau 9 colonnes → refonte cartes URGENTE |
| 2 | **FicheEleve mobile** | 10 onglets → réduire ou repenser |
| 3 | **GestionExamens mobile** | BUG `color:'#fff'` ligne 670 → fix immédiat |

### ⚠️ Important (qualité classe mondiale)

| # | Sujet | Concerne |
|---|---|---|
| 4 | Pas de bottom tab bar | Toute l'app |
| 5 | Skeleton loaders absents | EnregistrerRecitation, ElevesMobile, FicheEleve, ListeCertificats, GestionExamens |
| 6 | Cibles tactiles < 44×44px | ElevesMobile, certains chips |
| 7 | Pas de pull-to-refresh | Aucune page n'en a |
| 8 | Pas de FAB | ElevesMobile (bouton + flottant manquant) |
| 9 | Densité d'information | Dashboard 17 modules, ValidationRapide |

### ✨ Nice-to-have

| # | Sujet | Bénéfice |
|---|---|---|
| 10 | Haptic feedback | Vibration sur actions importantes |
| 11 | Swipe actions sur listes | Style iOS Mail |
| 12 | Groupement sectionné | Listes longues |
| 13 | Animations subtiles | Micro-interactions |
| 14 | Mode main droite/gauche | Surveillant en cours |

---

## 📋 VAGUE 2 — Pages restantes à auditer (À PROGRAMMER)

### Pages identifiées à auditer

#### Pages métier secondaires
- `RecitationSourate` — récitation par sourate (ajout récent jour 3)
- `ResultatsExamens` — résultats examens
- `Calendrier` — calendrier événements
- `Seance` — séance individuelle
- `MurajaDashboard` — muraja collective
- `TableauHonneur` — top élèves
- `RapportMensuel` — rapport mensuel
- `HistoriqueSeances` — historique
- `Comparaison` — comparer élèves
- `Assiduite` — assiduité
- `SuiviCours` — suivi cours
- `SuiviParents` — suivi parents
- `ElevesInactifs` — élèves inactifs

#### Pages de gestion
- `Gestion` (page hub)
- `GestionNiveaux` — gestion niveaux
- `GestionEnsembles` — gestion ensembles
- `GestionBlocs` — gestion blocs
- `GestionObjectifs` — gestion objectifs
- `GestionCours` — gestion cours
- `GestionCoursAxes` — gestion axes cours
- `GestionParents` — gestion parents
- `GestionTarifs` — gestion tarifs
- `GestionAssiduite` — gestion assiduité

#### Pages financières
- `Finance` — gestion financière

#### Pages parents / portail
- `PortailParent` — portail parent
- `FicheSourate` — fiche sourate

#### Pages utilitaires
- `Login` — connexion
- `InscriptionEcole` — inscription école
- `ImportMasse` — import en masse
- `ProfilInstituteur` — profil
- `Dashboard` (déjà partiellement audité)
- `DashboardDirection` — dashboard direction
- `CertificatExamen` — vue certificat examen
- `CoursValidation` — validation cours
- `ListeCertificats` (déjà fait — vague 1)

### Méthode pour vague 2
Mêmes critères d'audit que vague 1 :
- ✅ Ce qui est bien
- ⚠️ À améliorer (par priorité)
- 🚨 Bugs visuels trouvés
- 🎯 Niveau d'impact

---

## 🚀 Plan d'attaque proposé

### Étape 1 — Fixes urgents Vague 1 (PROCHAINE ÉTAPE)
1. Bug `color:'#fff'` GestionExamens ligne 670
2. Refonte ListeNotes mobile (tableau → cartes)
3. Refonte FicheEleve onglets (10 → 5 + Plus)

### Étape 2 — Sujets transversaux
4. **Bottom tab bar** (changement de feeling immédiat)
5. **Skeleton loaders** généralisés
6. **Pull-to-refresh**
7. Cibles tactiles 44×44 minimum

### Étape 3 — Vague 2 audit
8. Auditer les ~30 pages restantes (par lots de 5)
9. Synthétiser et prioriser

### Étape 4 — Refonte Vague 2
10. Traiter les critiques identifiés
11. Améliorer les important

### Étape 5 — Polish
12. Nice-to-have : haptic, swipe, animations

---

## 📝 Notes / décisions

- **Périmètre Phase 2** : mobile uniquement (PC est en Phase 1, déjà clôturée)
- **Pas de copie PC** : design pensé mobile-first
- **Validation Jamal explicite** avant chaque chantier
- **Workflow** : QA → tests → Prod → merge

---

*Document généré le 9 mai 2026 — Suivi Récitation Phase 2*
