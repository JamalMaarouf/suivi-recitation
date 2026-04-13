# Configuration du Backup Automatique

## Ce que ça fait
- Chaque nuit à **minuit (heure Maroc)**, Vercel appelle `/api/backup`
- La fonction exporte toutes les tables Supabase en JSON
- Le fichier JSON est envoyé par **email** avec un résumé
- Vous pouvez aussi déclencher un backup **manuellement** depuis le tableau de bord Super Admin

---

## Étape 1 — Créer un compte Resend (gratuit)

1. Allez sur [resend.com](https://resend.com) → **Sign up**
2. Vérifiez votre email
3. Dans le dashboard Resend → **API Keys** → **Create API Key**
4. Copiez la clé (commence par `re_...`)

> Plan gratuit : 3 000 emails/mois, largement suffisant pour 1 email/nuit

---

## Étape 2 — Récupérer la Service Key Supabase

La Service Key a accès complet (bypass RLS) — nécessaire pour exporter toutes les données.

1. Supabase → votre projet → **Settings** → **API**
2. Copiez la **service_role key** (⚠️ ne jamais l'exposer côté client)

---

## Étape 3 — Configurer les variables dans Vercel

Allez sur [vercel.com](https://vercel.com) → votre projet → **Settings** → **Environment Variables**

Ajoutez ces 4 variables (Environment: **Production**) :

| Variable | Valeur |
|----------|--------|
| `SUPABASE_URL` | `https://uwqhtahknhftinlzmusi.supabase.co` |
| `SUPABASE_SERVICE_KEY` | votre service_role key Supabase |
| `RESEND_API_KEY` | votre clé Resend (re_...) |
| `BACKUP_EMAIL` | votre adresse email |
| `CRON_SECRET` | un mot de passe aléatoire (ex: `backup-secret-2025`) |

---

## Étape 4 — Redéployer sur Vercel

Après avoir ajouté les variables, faites un nouveau déploiement :
```
Push sur GitHub → Vercel redéploie automatiquement
```

---

## Étape 5 — Tester le backup

Depuis le tableau de bord **Super Admin** → bouton **💾 Backup maintenant**

Vous devriez recevoir un email avec le fichier JSON en pièce jointe dans les 30 secondes.

---

## Planification automatique

Le fichier `vercel.json` contient :
```json
"crons": [{ "path": "/api/backup", "schedule": "0 0 * * *" }]
```
`0 0 * * *` = chaque jour à **00h00 UTC** = **01h00 heure Maroc** (été) / **00h00 hiver**

Pour changer l'heure, modifiez le cron : `0 22 * * *` = 22h UTC = minuit Maroc.

---

## Format du backup JSON

```json
{
  "metadata": {
    "created_at": "2025-04-04T00:00:00Z",
    "total_records": 1234,
    "tables": [{ "table": "eleves", "count": 45 }, ...]
  },
  "data": {
    "eleves": [...],
    "validations": [...],
    ...
  }
}
```
