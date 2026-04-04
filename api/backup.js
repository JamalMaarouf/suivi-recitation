// Vercel Serverless Function - Backup automatique
// Utilise l'API REST Supabase directement (sans SDK) pour éviter les problèmes de fetch

const { Resend } = require('resend');

const TABLES = [
  'ecoles', 'utilisateurs', 'eleves', 'validations',
  'recitations_sourates', 'apprentissages', 'objectifs_globaux',
  'cotisations', 'depenses', 'parents', 'parent_eleve',
  'passages_niveau', 'exceptions_recitation', 'exceptions_hizb', 'sourates',
];

async function exportTable(supabaseUrl, serviceKey, table) {
  try {
    const url = `${supabaseUrl}/rest/v1/${table}?select=*&limit=50000`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=none',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { table, count: 0, error: `HTTP ${response.status}: ${errText.slice(0, 100)}`, data: [] };
    }

    const data = await response.json();
    return { table, count: Array.isArray(data) ? data.length : 0, data: Array.isArray(data) ? data : [] };
  } catch (err) {
    return { table, count: 0, error: err.message, data: [] };
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const backupEmail = process.env.BACKUP_EMAIL;
  const cronSecret = process.env.CRON_SECRET;

  // Validate env vars
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Missing env vars',
      has_url: !!supabaseUrl,
      has_service_key: !!serviceKey,
      has_resend: !!resendKey,
      has_email: !!backupEmail,
    });
  }

  // Security check
  const authHeader = req.headers['authorization'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && req.query.manual !== 'true') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const dateFilename = now.toISOString().split('T')[0];

  console.log(`[Backup] Starting at ${dateStr}`);

  // Export all tables
  const results = await Promise.all(
    TABLES.map(t => exportTable(supabaseUrl, serviceKey, t))
  );

  const backup = {
    metadata: {
      version: '1.0',
      created_at: now.toISOString(),
      created_at_local: dateStr,
      tables: results.map(r => ({ table: r.table, count: r.count, error: r.error || null })),
      total_records: results.reduce((sum, r) => sum + r.count, 0),
      duration_ms: Date.now() - startTime,
    },
    data: Object.fromEntries(results.map(r => [r.table, r.data])),
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');

  console.log(`[Backup] ${backup.metadata.total_records} records, ${formatSize(sizeBytes)}`);

  // Build email
  const tableRows = results.map(r =>
    `<tr>
      <td style="padding:4px 12px;border-bottom:1px solid #f0f0ec;">${r.table}</td>
      <td style="padding:4px 12px;border-bottom:1px solid #f0f0ec;text-align:right;font-weight:600;">${r.count.toLocaleString()}</td>
      <td style="padding:4px 12px;border-bottom:1px solid #f0f0ec;color:${r.error ? '#E24B4A' : '#1D9E75'};">${r.error || '✓'}</td>
    </tr>`
  ).join('');

  const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:linear-gradient(135deg,#085041,#1D9E75);padding:24px;border-radius:12px;margin-bottom:24px;">
    <h1 style="color:#fff;margin:0;font-size:20px;">📖 Backup Suivi Récitation</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${dateStr}</p>
  </div>
  <div style="background:#E1F5EE;border-radius:8px;padding:16px;margin-bottom:20px;display:flex;gap:24px;flex-wrap:wrap;">
    <div><div style="font-size:24px;font-weight:800;color:#085041;">${backup.metadata.total_records.toLocaleString()}</div><div style="font-size:12px;color:#888;">enregistrements</div></div>
    <div><div style="font-size:24px;font-weight:800;color:#085041;">${formatSize(sizeBytes)}</div><div style="font-size:12px;color:#888;">taille</div></div>
    <div><div style="font-size:24px;font-weight:800;color:#085041;">${(backup.metadata.duration_ms/1000).toFixed(1)}s</div><div style="font-size:12px;color:#888;">durée</div></div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
    <thead><tr style="background:#f5f5f0;">
      <th style="padding:8px 12px;text-align:left;">Table</th>
      <th style="padding:8px 12px;text-align:right;">Enregistrements</th>
      <th style="padding:8px 12px;text-align:left;">Statut</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div style="background:#f5f5f0;border-radius:8px;padding:14px;font-size:12px;color:#888;">
    📎 Fichier JSON joint : <strong>backup-${dateFilename}.json</strong>
  </div>
</body></html>`;

  // Send email
  if (!backupEmail || !resendKey) {
    return res.status(200).json({
      success: true,
      message: 'Backup OK but email not configured',
      metadata: backup.metadata,
      debug: {
        tables_with_data: results.filter(r => r.count > 0).map(r => `${r.table}:${r.count}`),
        tables_error: results.filter(r => r.error).map(r => `${r.table}:${r.error}`),
      }
    });
  }

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: 'Suivi Récitation <onboarding@resend.dev>',
      to: backupEmail,
      subject: `📖 Backup ${dateFilename} — ${backup.metadata.total_records.toLocaleString()} enregistrements`,
      html: emailHtml,
      attachments: [{
        filename: `backup-${dateFilename}.json`,
        content: Buffer.from(jsonStr).toString('base64'),
      }],
    });
    console.log(`[Backup] Email sent to ${backupEmail}`);
  } catch (emailErr) {
    console.error('[Backup] Email error:', emailErr.message);
    return res.status(200).json({
      success: true,
      email_error: emailErr.message,
      metadata: backup.metadata,
    });
  }

  return res.status(200).json({
    success: true,
    metadata: backup.metadata,
    email_sent_to: backupEmail,
    debug: {
      tables_with_data: results.filter(r => r.count > 0).map(r => `${r.table}:${r.count}`),
      tables_error: results.filter(r => r.error).map(r => `${r.table}:${r.error}`),
    }
  });
};
