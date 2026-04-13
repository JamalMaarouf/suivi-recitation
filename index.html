# Backup Automatique Gratuit — Guide complet

## Architecture
```
cron-job.org (gratuit) → minuit chaque nuit
    → appelle votre Supabase Edge Function
        → exporte toutes les tables
            → envoie JSON par email (Resend)
```

---

## Étape 1 — Déployer la Edge Function Supabase

### 1a. Installer Supabase CLI
```bash
npm install -g supabase
```

### 1b. Se connecter à votre projet
```bash
supabase login
supabase link --project-ref uwqhtahknhftinlzmusi
```

### 1c. Configurer les secrets de la fonction
```bash
supabase secrets set BACKUP_SECRET=backup-secret-2025
supabase secrets set RESEND_API_KEY=re_votreclé
supabase secrets set BACKUP_EMAIL=votre@email.com
```
> SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont automatiquement disponibles

### 1d. Déployer la fonction
```bash
supabase functions deploy backup
```

### 1e. Récupérer l'URL de la fonction
L'URL sera : `https://uwqhtahknhftinlzmusi.supabase.co/functions/v1/backup`

---

## Étape 2 — Configurer cron-job.org

1. Allez sur **[cron-job.org](https://cron-job.org)** → créez un compte gratuit
2. Cliquez **"Create cronjob"**
3. Remplissez :
   - **URL** : `https://uwqhtahknhftinlzmusi.supabase.co/functions/v1/backup`
   - **Execution schedule** : `Every day at 00:00` (minuit)
   - **Request method** : GET
   - **Headers** : ajoutez `Authorization: Bearer backup-secret-2025`
4. Cliquez **Save**

---

## Étape 3 — Tester

Dans cron-job.org → cliquez **"Run now"** sur votre job.
Vous devriez recevoir l'email dans les 30 secondes.

---

## Résumé des coûts
| Service | Plan | Coût |
|---------|------|------|
| Supabase Edge Functions | Free (500K invocations/mois) | 0€ |
| cron-job.org | Free | 0€ |
| Resend | Free (3000 emails/mois) | 0€ |
| **Total** | | **0€/mois** |

