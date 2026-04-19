# 🏗️ Environnements — Quality & Production

Ce document décrit l'architecture des deux environnements de l'application
**متابعة التحفيظ** (Suivi Récitation Coran) et le workflow pour travailler avec.

---

## 📊 Vue d'ensemble

```
┌─ GITHUB (repo unique) ──────────────────────────────────┐
│                                                         │
│   branche main      ──►  PROD                           │
│   branche develop   ──►  QUALITY                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
           │                            │
           ▼                            ▼
   ┌──────────────┐             ┌──────────────┐
   │ Vercel PROD  │             │ Vercel QA    │
   │              │             │              │
   │ suivi-       │             │ suivi-       │
   │ recitation   │             │ recitation-qa│
   │  .vercel.app │             │  .vercel.app │
   └──────┬───────┘             └──────┬───────┘
          │                            │
          ▼                            ▼
   ┌──────────────┐             ┌──────────────┐
   │ Supabase     │             │ Supabase     │
   │ Production   │             │ Quality      │
   │              │             │              │
   │ uwqhtahknh.. │             │ qqcjryowpb.. │
   │              │             │              │
   │ Données      │             │ Données      │
   │ réelles      │             │ de test      │
   └──────────────┘             └──────────────┘
```

**Étanchéité totale** : les deux environnements ne se parlent jamais.
Rien en QA ne peut impacter la Prod, et inversement.

---

## 🔗 URLs et accès

### Production
- **URL live**            : https://suivi-recitation.vercel.app
- **Supabase**            : https://uwqhtahknhftinlzmusi.supabase.co
- **Vercel dashboard**    : https://vercel.com/.../suivi-recitation
- **Super admin identif** : (ton identifiant Prod habituel)
- **Super admin mot de passe** : (ton mot de passe Prod)

### Quality (QA)
- **URL live**            : https://suivi-recitation-qa.vercel.app
- **Supabase**            : https://qqcjryowpbtxkecknrre.supabase.co
- **Vercel dashboard**    : https://vercel.com/.../suivi-recitation-qa
- **Super admin identif** : `superadmin-qa`
- **Super admin mot de passe** : `qatest2026`

### Identification visuelle
La QA affiche un **bandeau orange permanent** en haut avec le message :

> 🧪 ENVIRONNEMENT DE TEST (QUALITY) — Les données ne sont pas réelles ·
> Ne PAS utiliser en production

Si tu ne vois **pas** ce bandeau, tu es en Prod. ⚠️

---

## 🔄 Workflow de développement — cas standard

### Schéma

```
    1. Claude code une feature            (branche develop)
           │
           ▼
    2. Push sur develop                   (GitHub)
           │
           ▼
    3. Vercel déploie automatiquement     (QA)
           │
           ▼
    4. Jamal teste sur QA                 (suivi-recitation-qa.vercel.app)
           │
           ▼
    5. Feature validée ? ──► Oui ──► Étape 6
                          └► Non ──► Claude corrige, retour étape 2
           │
           ▼
    6. Merge develop → main               (GitHub)
           │
           ▼
    7. Vercel déploie automatiquement     (Prod)
           │
           ▼
    8. Feature en Prod                    (suivi-recitation.vercel.app)
```

### Points-clés

- **Rien n'arrive directement en Prod.** Tout passe d'abord par la QA.
- **Le merge develop → main** est une étape de "promotion" explicite.
  Jamal peut donc prendre son temps pour valider avant.
- **Les données sont séparées.** Les écoles, utilisateurs, validations
  créées en QA ne sont pas dans la Prod.

---

## ⚡ Workflow — hotfix urgent en Prod

Cas exceptionnel : bug critique en Prod qu'il faut corriger tout de suite
sans attendre un cycle QA complet.

```
    1. Claude crée une branche hotfix à partir de main
           │
           ▼
    2. Claude corrige et pousse sur main directement
           │
           ▼
    3. Vercel déploie en Prod
           │
           ▼
    4. Jamal valide en Prod
           │
           ▼
    5. Claude rebascule la correction sur develop (synchro)
```

**À utiliser avec parcimonie** — seulement pour les bugs bloquants.

---

## 🛠️ Commandes Git utiles (pour Claude)

### Travailler sur la QA (flux standard)

```bash
# Se placer sur develop
git checkout develop
git pull origin develop

# Faire les modifs...

# Commit + push sur develop
git add .
git commit -m "feat: description de la feature"
git push origin develop
```

### Promouvoir develop → main (après validation QA)

```bash
git checkout main
git pull origin main
git merge develop --no-ff -m "promote: description"
git push origin main
```

### Hotfix direct en Prod (exception)

```bash
git checkout main
git pull origin main

# Correction...

git add .
git commit -m "hotfix: description"
git push origin main

# Ensuite, reporter la correction sur develop
git checkout develop
git merge main --no-ff -m "chore: sync hotfix"
git push origin develop
```

### Vérifier où on en est

```bash
# Voir sur quelle branche on est
git branch --show-current

# Voir les derniers commits de chaque branche
git log main --oneline -3
git log develop --oneline -3
```

---

## 🔒 Sécurité — règles importantes

### Règle 1 — Vérifier l'environnement avant toute action
Avant d'exécuter un SQL ou de toucher à une variable d'environnement,
**toujours vérifier** sur quel projet on est :
- **Supabase** : nom du projet en haut à gauche + URL (`uwqhtahknh` ou `qqcjryowpb`)
- **Vercel** : nom du projet en haut + URL
- **App** : présence ou absence du bandeau orange QA

### Règle 2 — Les identifiants sont distincts
**Ne jamais utiliser le même mot de passe** pour le super admin Prod et QA.
Si l'un fuite, l'autre reste protégé.

### Règle 3 — La clé `service_role` est secrète
- Elle est stockée uniquement dans **Vercel Environment Variables**
- Elle ne doit **jamais** être dans le code React (le client)
- Elle ne doit **jamais** être partagée en dehors (pas même à Claude)

### Règle 4 — Les backups se font en Prod
Le cron `/api/backup` tourne à 23h UTC en Prod.
La QA n'a pas de backup automatique configuré (données jetables).

---

## 🧪 Que peut-on tester en QA ?

**Oui, à tester en QA** :
- Nouvelles fonctionnalités
- Migrations SQL (ajout de colonnes, nouvelles tables)
- Changements d'UI qui pourraient casser quelque chose
- Nouvelles règles RLS
- Tests de charge / stress tests
- Expérimentations

**Non, à ne jamais faire en QA** :
- Gérer de vraies données d'utilisateurs
- Conserver du contenu personnel à long terme
- Renvoyer des mails aux vraies adresses (la config Resend est Prod)

---

## 📋 Check-list avant promotion QA → Prod

Avant de faire le merge `develop → main`, vérifier :

- [ ] La feature a été testée en QA par Jamal
- [ ] Aucune erreur dans les logs Vercel QA
- [ ] Les migrations SQL (s'il y en a) ont été **aussi** exécutées en Prod
- [ ] Les nouvelles variables d'environnement (s'il y en a) sont ajoutées en Prod
- [ ] Un backup Prod récent existe (fallback au cas où)

---

## 🔧 Troubleshooting

### L'URL QA affiche une erreur 404 ou 500
Vérifier les Runtime Logs Vercel → projet QA → erreur détaillée

### Le bandeau orange QA ne s'affiche pas
Vérifier dans Vercel QA → Settings → Environment Variables :
`REACT_APP_ENV = qa` (minuscules)

### Une nouvelle fonctionnalité marche en QA mais pas en Prod
C'est souvent parce qu'une migration SQL n'a pas été appliquée en Prod.
Exécuter le fichier SQL correspondant sur le projet Supabase Prod.

### Le webhook GitHub → Vercel ne fonctionne plus
Plan de secours : utiliser le Deploy Hook manuel.
Voir le dossier `.vercel/` ou les Settings Git du projet Vercel.

---

## 📅 Historique des itérations

| Date       | Version | Description                              |
|------------|---------|------------------------------------------|
| 2026-04-19 | v1.0    | Création initiale de la QA (Itération 3) |

---

*Document maintenu par Claude (expert IT) et validé par Jamal Maarouf.*
