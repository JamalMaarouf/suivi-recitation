import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TABLES = [
  'ecoles', 'utilisateurs', 'eleves', 'validations',
  'recitations_sourates', 'apprentissages', 'objectifs_globaux',
  'cotisations', 'depenses', 'parents', 'parent_eleve',
  'passages_niveau', 'exceptions_recitation', 'exceptions_hizb', 'sourates',
]

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
  const resendKey = Deno.env.get('RESEND_API_KEY') as string
  const backupEmail = Deno.env.get('BACKUP_EMAIL') as string
  const backupSecret = Deno.env.get('BACKUP_SECRET') as string

  // Auth check - accept header OR query param
  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret')
  const authHeader = req.headers.get('authorization') || ''
  const headerSecret = authHeader.replace('Bearer ', '')

  // If BACKUP_SECRET is set, verify it
  if (backupSecret) {
    if (querySecret !== backupSecret && headerSecret !== backupSecret) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        debug: {
          query_secret_provided: !!querySecret,
          header_secret_provided: !!headerSecret,
          secret_length: backupSecret.length,
        }
      }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const startTime = Date.now()
  const now = new Date()
  const dateFilename = now.toISOString().split('T')[0]
  const dateLabel = now.toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const results = await Promise.all(TABLES.map(async (table) => {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(50000)
      if (error) return { table, count: 0, error: error.message, data: [] }
      return { table, count: data ? data.length : 0, data: data || [] }
    } catch(e) {
      return { table, count: 0, error: String(e), data: [] }
    }
  }))

  const totalRecords = results.reduce((s, r) => s + r.count, 0)
  const backup = {
    metadata: {
      version: '1.0',
      created_at: now.toISOString(),
      tables: results.map(r => ({ table: r.table, count: r.count, error: r.error || null })),
      total_records: totalRecords,
      duration_ms: Date.now() - startTime,
    },
    data: Object.fromEntries(results.map(r => [r.table, r.data])),
  }

  const jsonStr = JSON.stringify(backup, null, 2)
  const sizeKB = (new TextEncoder().encode(jsonStr).length / 1024).toFixed(1)

  let tableRows = ''
  for (const r of results) {
    tableRows += '<tr>'
    tableRows += '<td style="padding:4px 12px;border-bottom:1px solid #f0f0ec;">' + r.table + '</td>'
    tableRows += '<td style="padding:4px 12px;border-bottom:1px solid #f0f0ec;text-align:right;font-weight:600;">' + r.count + '</td>'
    const statusColor = r.error ? '#E24B4A' : '#1D9E75'
    const statusText = r.error ? r.error : 'OK'
    tableRows += '<td style="padding:4px 12px;border-bottom:1px solid #f0f0ec;color:' + statusColor + ';">' + statusText + '</td>'
    tableRows += '</tr>'
  }

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
    + '<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">'
    + '<div style="background:linear-gradient(135deg,#085041,#1D9E75);padding:24px;border-radius:12px;margin-bottom:20px;">'
    + '<h1 style="color:#fff;margin:0;font-size:20px;">Backup automatique</h1>'
    + '<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">' + dateLabel + '</p>'
    + '</div>'
    + '<div style="background:#E1F5EE;border-radius:8px;padding:16px;margin-bottom:16px;">'
    + '<strong style="font-size:28px;color:#085041;">' + totalRecords.toLocaleString() + '</strong>'
    + '<span style="color:#888;font-size:13px;"> enregistrements - ' + sizeKB + ' KB</span>'
    + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">'
    + '<thead><tr style="background:#f5f5f0;">'
    + '<th style="padding:8px 12px;text-align:left;">Table</th>'
    + '<th style="padding:8px 12px;text-align:right;">Lignes</th>'
    + '<th style="padding:8px 12px;text-align:left;">Statut</th>'
    + '</tr></thead>'
    + '<tbody>' + tableRows + '</tbody>'
    + '</table>'
    + '<p style="font-size:12px;color:#888;">Fichier JSON joint : backup-' + dateFilename + '.json</p>'
    + '</body></html>'

  const encoder = new TextEncoder()
  const jsonBytes = encoder.encode(jsonStr)
  let binary = ''
  for (let i = 0; i < jsonBytes.length; i++) {
    binary += String.fromCharCode(jsonBytes[i])
  }
  const base64Json = btoa(binary)

  let emailSent = false
  let emailError = null

  if (resendKey && backupEmail) {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + resendKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Suivi Recitation <onboarding@resend.dev>',
        to: backupEmail,
        subject: 'Backup ' + dateFilename + ' - ' + totalRecords + ' enregistrements',
        html: html,
        attachments: [{
          filename: 'backup-' + dateFilename + '.json',
          content: base64Json,
        }],
      }),
    })
    const emailData = await emailRes.json()
    emailSent = emailRes.ok
    if (!emailRes.ok) emailError = emailData
  }

  return new Response(JSON.stringify({
    success: true,
    total_records: totalRecords,
    size_kb: sizeKB,
    email_sent: emailSent,
    email_error: emailError,
    tables: results.map(r => ({ table: r.table, count: r.count, error: r.error || null })),
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
