// Génération PDF côté serveur via Vercel Serverless Function
// Utilise HTML → PDF sans Puppeteer (pas disponible sur Vercel Free)
// Solution : retourne le HTML optimisé pour impression, le navigateur génère le PDF

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, data, lang = 'fr' } = req.body || {};

  try {
    let html = '';

    if (type === 'rapport_mensuel') {
      html = generateRapportMensuel(data, lang);
    } else if (type === 'liste_eleves') {
      html = generateListeEleves(data, lang);
    } else if (type === 'certificat') {
      html = generateCertificat(data, lang);
    } else if (type === 'fiche_eleve') {
      html = generateFicheEleve(data, lang);
    } else {
      return res.status(400).json({ error: 'Type non supporté' });
    }

    // Retourner le HTML — le client ouvre dans un nouvel onglet et imprime
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

function baseStyles() {
  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Tajawal',Arial,sans-serif; font-size:13px; color:#1a1a1a; background:#fff; }
      .page { max-width:794px; margin:0 auto; padding:32px 40px; }
      .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #085041; padding-bottom:16px; margin-bottom:24px; }
      .logo { font-size:22px; font-weight:700; color:#085041; }
      .subtitle { font-size:12px; color:#888; }
      table { width:100%; border-collapse:collapse; margin-bottom:16px; }
      th { background:#085041; color:#fff; padding:8px 10px; text-align:right; font-weight:700; font-size:12px; }
      td { padding:7px 10px; border-bottom:0.5px solid #e0e0d8; font-size:12px; }
      tr:nth-child(even) td { background:#f9f9f6; }
      .badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; }
      .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
      .kpi { background:#f5f5f0; border-radius:10px; padding:14px; text-align:center; }
      .kpi-val { font-size:24px; font-weight:700; color:#085041; }
      .kpi-lbl { font-size:11px; color:#888; margin-top:4px; }
      .section-title { font-size:15px; font-weight:700; color:#085041; margin:20px 0 10px; border-right:4px solid #1D9E75; padding-right:10px; }
      .footer { margin-top:32px; padding-top:12px; border-top:0.5px solid #e0e0d8; text-align:center; font-size:11px; color:#aaa; }
      @media print {
        body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .no-print { display:none; }
        .page { padding:16px; }
      }
    </style>
  `;
}

function printButton(lang) {
  return `
    <div class="no-print" style="position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px;">
      <button onclick="window.print()" style="padding:10px 20px;background:#085041;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:'Tajawal',Arial,sans-serif;">
        🖨️ ${lang === 'ar' ? 'طباعة / تحميل PDF' : 'Imprimer / Télécharger PDF'}
      </button>
      <button onclick="window.close()" style="padding:10px 16px;background:#f0f0ec;color:#666;border:none;border-radius:8px;font-size:14px;cursor:pointer;">✕</button>
    </div>
  `;
}

function generateRapportMensuel(data, lang) {
  const { ecole, mois, annee, eleves = [], stats = {} } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const rows = eleves.map(e => `
    <tr>
      <td>${e.prenom} ${e.nom}</td>
      <td>${e.code_niveau || '—'}</td>
      <td style="color:#085041;font-weight:700">${e.pts || 0}</td>
      <td>${e.tomon || 0}</td>
      <td>${e.hizb || 0}</td>
      <td>${e.jours || 0}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>Rapport ${mois}/${annee}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">📖 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${isAr ? 'التقرير الشهري' : 'Rapport mensuel'} — ${mois}/${annee}</div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        ${isAr ? 'تاريخ الطباعة' : 'Généré le'}: ${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${eleves.length}</div><div class="kpi-lbl">${isAr ? 'طالب نشط' : 'Élèves actifs'}</div></div>
      <div class="kpi"><div class="kpi-val">${stats.totalPts || 0}</div><div class="kpi-lbl">${isAr ? 'مجموع النقاط' : 'Total points'}</div></div>
      <div class="kpi"><div class="kpi-val">${stats.totalTomon || 0}</div><div class="kpi-lbl">${isAr ? 'الثُّمنات' : 'Tomon'}</div></div>
      <div class="kpi"><div class="kpi-val">${stats.totalHizb || 0}</div><div class="kpi-lbl">${isAr ? 'الأحزاب' : 'Hizb'}</div></div>
    </div>
    <div class="section-title">${isAr ? 'أداء الطلاب' : 'Performance des élèves'}</div>
    <table>
      <thead><tr>
        <th>${isAr ? 'الطالب' : 'Élève'}</th>
        <th>${isAr ? 'المستوى' : 'Niveau'}</th>
        <th>${isAr ? 'النقاط' : 'Points'}</th>
        <th>${isAr ? 'الثُّمنات' : 'Tomon'}</th>
        <th>${isAr ? 'الأحزاب' : 'Hizb'}</th>
        <th>${isAr ? 'أيام نشطة' : 'Jours actifs'}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">${ecole?.nom || ''} · ${isAr ? 'سري — للاستخدام الداخلي فقط' : 'Confidentiel — Usage interne uniquement'}</div>
  </div>
  </body></html>`;
}

function generateListeEleves(data, lang) {
  const { ecole, eleves = [], titre } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const rows = eleves.map((e, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i + 1}</td>
      <td style="font-weight:700">${e.prenom} ${e.nom}</td>
      <td>${e.eleve_id_ecole || '—'}</td>
      <td><span class="badge" style="background:${e.couleur || '#085041'}20;color:${e.couleur || '#085041'}">${e.code_niveau || '—'}</span></td>
      <td>${e.instituteur || '—'}</td>
      <td>${e.telephone || '—'}</td>
      <td>${e.date_inscription ? new Date(e.date_inscription).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR') : '—'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre || 'Liste élèves'}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">📖 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre || (isAr ? 'قائمة الطلاب' : 'Liste des élèves')} — ${eleves.length} ${isAr ? 'طالب' : 'élève(s)'}</div>
      </div>
      <div style="font-size:12px;color:#888">${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
    </div>
    <table>
      <thead><tr>
        <th style="width:40px">#</th>
        <th>${isAr ? 'الاسم' : 'Nom'}</th>
        <th>${isAr ? 'الرقم' : 'N°'}</th>
        <th>${isAr ? 'المستوى' : 'Niveau'}</th>
        <th>${isAr ? 'الأستاذ' : 'Instituteur'}</th>
        <th>${isAr ? 'الهاتف' : 'Téléphone'}</th>
        <th>${isAr ? 'تاريخ التسجيل' : 'Inscription'}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">${ecole?.nom || ''} · ${isAr ? 'سري' : 'Confidentiel'}</div>
  </div>
  </body></html>`;
}

function generateFicheEleve(data, lang) {
  const { eleve, stats = {}, validations = [], ecole } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  if (!eleve) return '<html><body>Données manquantes</body></html>';

  const recentVals = validations.slice(0, 20).map(v => `
    <tr>
      <td>${v.date_validation ? new Date(v.date_validation).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR') : '—'}</td>
      <td>${v.type_validation === 'hizb_complet' ? (isAr ? 'حزب كامل' : 'Hizb complet') : `${v.nombre_tomon || 0} ${isAr ? 'ثُمن' : 'Tomon'}`}</td>
      <td style="color:#085041;font-weight:700">${v.points || 0} pts</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${eleve.prenom} ${eleve.nom}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">📖 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${isAr ? 'ملف الطالب' : 'Fiche élève'}</div>
      </div>
      <div style="font-size:12px;color:#888">${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
    </div>
    <div style="display:flex;gap:24px;margin-bottom:24px;align-items:flex-start">
      <div style="width:72px;height:72px;border-radius:50%;background:#E1F5EE;color:#085041;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;flex-shrink:0">
        ${(eleve.prenom||'?')[0]}${(eleve.nom||'?')[0]}
      </div>
      <div>
        <div style="font-size:20px;font-weight:700">${eleve.prenom} ${eleve.nom}</div>
        <div style="font-size:13px;color:#888;margin-top:4px">
          ${isAr ? 'الرقم' : 'N°'}: ${eleve.eleve_id_ecole || '—'} · 
          ${isAr ? 'المستوى' : 'Niveau'}: <strong>${eleve.code_niveau || '—'}</strong>
        </div>
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${stats.totalPts || 0}</div><div class="kpi-lbl">${isAr ? 'مجموع النقاط' : 'Total points'}</div></div>
      <div class="kpi"><div class="kpi-val">${stats.tomon || 0}</div><div class="kpi-lbl">${isAr ? 'الثُّمنات' : 'Tomon'}</div></div>
      <div class="kpi"><div class="kpi-val">${stats.hizb || 0}</div><div class="kpi-lbl">${isAr ? 'الأحزاب' : 'Hizb'}</div></div>
      <div class="kpi"><div class="kpi-val">${stats.jours || 0}</div><div class="kpi-lbl">${isAr ? 'أيام نشطة' : 'Jours actifs'}</div></div>
    </div>
    ${recentVals ? `
    <div class="section-title">${isAr ? 'آخر الاستظهارات' : 'Dernières validations'}</div>
    <table>
      <thead><tr>
        <th>${isAr ? 'التاريخ' : 'Date'}</th>
        <th>${isAr ? 'النوع' : 'Type'}</th>
        <th>${isAr ? 'النقاط' : 'Points'}</th>
      </tr></thead>
      <tbody>${recentVals}</tbody>
    </table>` : ''}
    <div class="footer">${ecole?.nom || ''} · ${isAr ? 'سري' : 'Confidentiel'}</div>
  </div>
  </body></html>`;
}

function generateCertificat(data, lang) {
  const { eleve, jalon, date, ecole, directeur } = data || {};
  const isAr = lang === 'ar';

  return `<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><title>Certificat</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Tajawal',Arial,sans-serif; background:#fff; }
    .page { width:794px; height:560px; margin:0 auto; padding:48px 60px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; border:12px solid #085041; position:relative; }
    .inner-border { position:absolute; inset:20px; border:2px solid #EF9F27; pointer-events:none; }
    .icon { font-size:48px; margin-bottom:16px; }
    .title { font-size:28px; font-weight:900; color:#085041; margin-bottom:8px; }
    .subtitle { font-size:14px; color:#888; margin-bottom:32px; }
    .name { font-size:32px; font-weight:700; color:#1a1a1a; margin-bottom:8px; }
    .achievement { font-size:18px; color:#085041; margin-bottom:32px; }
    .jalon { font-size:22px; font-weight:700; color:#EF9F27; margin-bottom:24px; }
    .footer { font-size:12px; color:#888; margin-top:24px; }
    .signature { margin-top:16px; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print { display:none; } }
  </style></head>
  <body>
  <div class="no-print" style="position:fixed;top:16px;right:16px;">
    <button onclick="window.print()" style="padding:10px 20px;background:#085041;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:'Tajawal',Arial">🖨️ ${isAr ? 'طباعة' : 'Imprimer'}</button>
  </div>
  <div class="page">
    <div class="inner-border"></div>
    <div class="icon">🏅</div>
    <div class="title">${isAr ? 'شهادة تقدير' : 'Certificat de réussite'}</div>
    <div class="subtitle">${ecole?.nom || 'École coranique'}</div>
    <div style="font-size:16px;color:#888;margin-bottom:8px">${isAr ? 'يُشهد لـ' : 'Décerné à'}</div>
    <div class="name">${eleve?.prenom || ''} ${eleve?.nom || ''}</div>
    <div class="achievement">${isAr ? 'لإتمام' : 'pour avoir accompli'}</div>
    <div class="jalon">${jalon?.nom_ar || jalon?.nom || ''}</div>
    <div class="footer">
      ${date ? new Date(date).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', {day:'2-digit',month:'long',year:'numeric'}) : ''}
    </div>
    ${directeur ? `<div class="signature">${isAr ? 'المدير' : 'Le directeur'}: ${directeur}</div>` : ''}
  </div>
  </body></html>`;
}
