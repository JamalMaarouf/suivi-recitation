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
    } else if (type === 'liste_certificats') {
      html = generateListeCertificats(data, lang);
    } else if (type === 'liste_notes') {
      html = generateListeNotes(data, lang);
    } else if (type === 'certificat') {
      html = generateCertificat(data, lang);
    } else if (type === 'certificat_examen') {
      html = generateCertificatExamen(data, lang);
    } else if (type === 'fiche_eleve') {
      html = generateFicheEleve(data, lang);
    } else if (type === 'rapport_assiduite') {
      html = generateRapportAssiduite(data, lang);
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

function generateListeCertificats(data, lang) {
  const { ecole, certificats = [], titre } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const rows = certificats.map((c, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i + 1}</td>
      <td style="font-weight:700">${c.prenom || ''} ${c.nom || ''}</td>
      <td>${c.eleve_id_ecole || '—'}</td>
      <td><span class="badge" style="background:${c.couleur || '#085041'}20;color:${c.couleur || '#085041'}">${c.code_niveau || '—'}</span></td>
      <td style="direction:rtl;font-family:'Tajawal',Arial,sans-serif;font-weight:700">${c.jalon || '—'}</td>
      <td>${c.instituteur || '—'}</td>
      <td>${c.date_obtention ? new Date(c.date_obtention).toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR') : '—'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre || 'Liste certificats'}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">🏅 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre || (isAr ? 'قائمة الشهادات' : 'Liste des certificats')} — ${certificats.length} ${isAr ? 'شهادة' : 'certificat(s)'}</div>
      </div>
      <div style="font-size:12px;color:#888">${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
    </div>
    <table>
      <thead><tr>
        <th style="width:40px">#</th>
        <th>${isAr ? 'الاسم' : 'Élève'}</th>
        <th>${isAr ? 'الرقم' : 'N°'}</th>
        <th>${isAr ? 'المستوى' : 'Niveau'}</th>
        <th>${isAr ? 'الشهادة' : 'Jalon / Certificat'}</th>
        <th>${isAr ? 'الأستاذ' : 'Instituteur'}</th>
        <th>${isAr ? 'تاريخ الحصول' : 'Date obtention'}</th>
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

function generateCertificatExamen(data, lang) {
  const { eleve, examen, niveau, ecole, resultat } = data || {};
  if (!eleve || !examen || !resultat) return '<html><body>Données manquantes</body></html>';

  const d = new Date(resultat.date_examen || resultat.created_at || new Date());
  const date = `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'long' })} ${d.getFullYear()}`;
  const ecolNom = ecole?.nom || 'École Coranique';
  const niveauNom = niveau ? `${niveau.code} — ${niveau.nom}` : (eleve.code_niveau || '');
  const score = resultat.score;
  const scoreColor = score >= 90 ? '#1D9E75' : score >= 70 ? '#378ADD' : '#EF9F27';

  return `<!DOCTYPE html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="UTF-8"><title>Certificat ${eleve.prenom} ${eleve.nom}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800;900&display=swap');
    @page { size: A4 landscape; margin: 0; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Tajawal',Arial,sans-serif; background:#f0f0ec; }
    .cert {
      width: 1122px; height: 794px;
      margin: 0 auto; background: #fff;
      border: 6px solid #1D9E75; position: relative;
      overflow: hidden;
    }
    .inner-border { position:absolute; inset:12px; border:1.5px solid #1D9E7560; pointer-events:none; }
    .bg { position:absolute; inset:0; background:linear-gradient(135deg,#f9fff9 0%,#fff 50%,#f0f8f0 100%); }
    .content { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:30px 60px; }
    .header { text-align:center; border-bottom:2px solid #1D9E75; width:100%; padding-bottom:16px; }
    .ecole-nom { font-size:14px; color:#888; font-weight:600; margin-bottom:4px; }
    .title-ar { font-size:38px; font-weight:800; color:#085041; direction:rtl; }
    .title-fr { font-size:12px; color:#aaa; letter-spacing:3px; font-weight:600; }
    .body { text-align:center; flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
    .medal { font-size:60px; line-height:1; }
    .line-ar { font-size:16px; color:#666; direction:rtl; }
    .name { font-size:34px; font-weight:800; color:#085041; direction:rtl; border-bottom:2px solid #1D9E75; padding-bottom:4px; }
    .examen { font-size:22px; font-weight:700; color:#1D9E75; border:2px solid #1D9E75; border-radius:10px; padding:6px 24px; background:#E1F5EE; direction:rtl; }
    .details { width:100%; background:#f9f9f6; border-radius:12px; padding:14px 24px; display:flex; justify-content:space-around; align-items:center; margin:10px 0; }
    .detail-label { font-size:10px; color:#aaa; letter-spacing:1px; text-transform:uppercase; unicode-bidi:plaintext; }
    .detail-value { font-size:16px; font-weight:700; color:#1a1a1a; }
    .score-value { font-size:32px; font-weight:800; color:${scoreColor}; }
    .separator { width:1px; height:40px; background:#e0e0d8; }
    .note { font-style:italic; color:#888; font-size:13px; text-align:center; direction:rtl; }
    .footer { width:100%; display:flex; justify-content:space-between; align-items:flex-end; padding-top:10px; border-top:1px solid #e0e0d8; }
    .date-edit { font-size:12px; color:#aaa; direction:rtl; }
    .sign { text-align:center; }
    .sign-line { width:200px; border-bottom:1.5px solid #333; margin-bottom:6px; }
    .sign-label { font-size:11px; color:#666; direction:rtl; }
    @media print {
      body { background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .cert { border-color:#1D9E75; box-shadow:none; }
      .no-print { display:none; }
    }
  </style></head>
  <body>
  <div class="no-print" style="position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px;">
    <button onclick="window.print()" style="padding:10px 20px;background:#1D9E75;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:'Tajawal',Arial,sans-serif;font-weight:700;">
      🖨️ ${lang === 'ar' ? 'طباعة / تحميل PDF' : 'Imprimer / Télécharger PDF'}
    </button>
    <button onclick="window.close()" style="padding:10px 16px;background:#f0f0ec;color:#666;border:none;border-radius:8px;font-size:14px;cursor:pointer;">✕</button>
  </div>
  <div class="cert">
    <div class="inner-border"></div>
    <div class="bg"></div>
    <div class="content">
      <div class="header">
        <div class="ecole-nom">${ecolNom}</div>
        <div class="title-ar">شهادة نجاح</div>
        <div class="title-fr">CERTIFICAT DE RÉUSSITE</div>
      </div>
      <div class="body">
        <div class="medal">🏅</div>
        <div class="line-ar">يُشهد بأن الطالب / الطالبة</div>
        <div class="name">${eleve.prenom} ${eleve.nom}</div>
        <div class="line-ar">قد اجتاز بنجاح امتحان</div>
        <div class="examen">${examen.nom}</div>
      </div>
      <div class="details">
        <div>
          <div class="detail-label">المستوى · Niveau</div>
          <div class="detail-value">${niveauNom}</div>
        </div>
        <div class="separator"></div>
        <div>
          <div class="detail-label">النقاط · Score</div>
          <div class="score-value">${score}%</div>
        </div>
        <div class="separator"></div>
        <div>
          <div class="detail-label">التاريخ · Date</div>
          <div class="detail-value">${date}</div>
        </div>
      </div>
      ${resultat.notes_examinateur ? `<div class="note">"${resultat.notes_examinateur}"</div>` : ''}
      <div class="footer">
        <div class="date-edit">أصدر بتاريخ: ${date}</div>
        <div class="sign">
          <div class="sign-line"></div>
          <div class="sign-label">توقيع المشرف العام · Signature du Surveillant</div>
        </div>
      </div>
    </div>
  </div>
  </body></html>`;
}

function generateListeNotes(data, lang) {
  const { ecole, eleves = [], titre, periodeLabel } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  // Top 3 en surbrillance (or, argent, bronze)
  const medalColors = ['#EF9F27', '#C0C0C0', '#CD7F32'];

  const rows = eleves.map((e, i) => {
    const rang = i + 1;
    const medal = rang <= 3 ? medalColors[rang - 1] : null;
    return `
      <tr>
        <td style="text-align:center;font-weight:700;color:${medal || '#888'};font-size:14px">
          ${rang <= 3 ? '🏅' : ''} ${rang}
        </td>
        <td style="font-weight:700">${e.prenom || ''} ${e.nom || ''}</td>
        <td>${e.eleve_id_ecole || '—'}</td>
        <td><span class="badge" style="background:${e.couleur || '#085041'}20;color:${e.couleur || '#085041'}">${e.code_niveau || '—'}</span></td>
        <td>${e.instituteur || '—'}</td>
        <td style="text-align:center;color:#085041;font-weight:700;font-size:14px">${(e.points || 0).toLocaleString()}</td>
        <td style="text-align:center;color:#888">${e.tomon || 0}</td>
        <td style="text-align:center;color:#888">${e.hizb || 0}</td>
      </tr>
    `;
  }).join('');

  const totalPts = eleves.reduce((s, e) => s + (e.points || 0), 0);
  const moyennePts = eleves.length > 0 ? Math.round(totalPts / eleves.length) : 0;

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre || 'Liste des notes'}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">⭐ ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre || (isAr ? 'قائمة النقاط' : 'Classement des points')} — ${periodeLabel || ''}</div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px">${eleves.length} ${isAr ? 'طالب' : 'élève(s)'}</div>
      </div>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="kpi-val">${eleves.length}</div><div class="kpi-lbl">${isAr ? 'طلاب' : 'Élèves'}</div></div>
      <div class="kpi"><div class="kpi-val">${totalPts.toLocaleString()}</div><div class="kpi-lbl">${isAr ? 'مجموع النقاط' : 'Total points'}</div></div>
      <div class="kpi"><div class="kpi-val">${moyennePts.toLocaleString()}</div><div class="kpi-lbl">${isAr ? 'المعدل' : 'Moyenne / élève'}</div></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:60px;text-align:center">#</th>
        <th>${isAr ? 'الطالب' : 'Élève'}</th>
        <th>${isAr ? 'الرقم' : 'N°'}</th>
        <th>${isAr ? 'المستوى' : 'Niveau'}</th>
        <th>${isAr ? 'الأستاذ' : 'Instituteur'}</th>
        <th style="text-align:center">${isAr ? 'النقاط' : 'Points'}</th>
        <th style="text-align:center">${isAr ? 'الثُّمنات' : 'Tomon'}</th>
        <th style="text-align:center">${isAr ? 'الأحزاب' : 'Hizb'}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">${ecole?.nom || ''} · ${isAr ? 'سري — للاستخدام الداخلي' : 'Confidentiel — Usage interne'}</div>
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════
// RAPPORT ASSIDUITÉ (élèves OU instituteurs)
// ══════════════════════════════════════════════════════════════════════
function generateRapportAssiduite(data, lang) {
  const {
    ecole,
    cible = 'eleves',              // 'eleves' | 'instituteurs'
    periodeLabel,
    dateDebut, dateFin,
    filtreNiveau,
    seuilRisque = 80,
    seuilParfait = 100,
    stats = {},
    rows = [],                     // lignes détaillées
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const estInst = cible === 'instituteurs';

  const titre = estInst
    ? (isAr ? 'تقرير حضور المؤطرين' : 'Rapport Assiduité — Instituteurs')
    : (isAr ? 'تقرير حضور الطلاب' : 'Rapport Assiduité — Élèves');

  // Fonction de coloration du taux
  const tauxColor = (t) => {
    if (t === null || t === undefined) return '#888';
    if (t >= seuilParfait) return '#1D9E75';
    if (t < seuilRisque) return '#E24B4A';
    return '#EF9F27';
  };
  const tauxBg = (t) => {
    if (t === null || t === undefined) return '#f5f5f0';
    if (t >= seuilParfait) return '#E1F5EE';
    if (t < seuilRisque) return '#FCEBEB';
    return '#FAEEDA';
  };

  const rowsHtml = rows.map((r, i) => {
    const t = r.taux;
    const tDisplay = t === null || t === undefined ? '—' : `${t}%`;
    return `
      <tr>
        <td style="text-align:center;color:#888">${i + 1}</td>
        <td style="font-weight:700">${r.prenom || ''} ${r.nom || ''}</td>
        <td>${r.id_ecole || '—'}</td>
        ${estInst ? '' : `<td><span class="badge" style="background:${r.couleur || '#085041'}20;color:${r.couleur || '#085041'}">${r.code_niveau || '—'}</span></td>`}
        <td style="text-align:center">${r.attendues || 0}</td>
        <td style="text-align:center;color:#1D9E75;font-weight:700">${r.presentes || 0}</td>
        <td style="text-align:center;color:#E24B4A;font-weight:700">${r.absences || 0}</td>
        <td style="text-align:center">
          <span style="padding:3px 10px;border-radius:10px;background:${tauxBg(t)};color:${tauxColor(t)};font-weight:700">
            ${tDisplay}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">${estInst ? '👨‍🏫' : '📅'} ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre}${periodeLabel ? ' — ' + periodeLabel : ''}</div>
        ${dateDebut && dateFin ? `<div class="subtitle" style="margin-top:4px">${isAr ? 'من' : 'Du'} ${dateDebut} ${isAr ? 'إلى' : 'au'} ${dateFin}</div>` : ''}
        ${filtreNiveau ? `<div class="subtitle" style="margin-top:4px">${isAr ? 'المستوى' : 'Niveau'} : ${filtreNiveau}</div>` : ''}
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px">${rows.length} ${estInst ? (isAr ? 'مؤطر' : 'instituteur(s)') : (isAr ? 'طالب' : 'élève(s)')}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi">
        <div class="kpi-val">${stats.tauxGlobal || 0}%</div>
        <div class="kpi-lbl">${isAr ? 'نسبة الحضور' : 'Taux de présence'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#1D9E75">${stats.nbParfaits || 0}</div>
        <div class="kpi-lbl">${isAr ? 'حضور كامل' : 'Assiduité parfaite'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#E24B4A">${stats.nbRisque || 0}</div>
        <div class="kpi-lbl">${isAr ? 'تحت العتبة' : 'En alerte'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${stats.totalAttendues || 0}</div>
        <div class="kpi-lbl">${isAr ? 'الحصص المتوقعة' : 'Séances attendues'}</div>
      </div>
    </div>

    <div class="section-title">${isAr ? 'تفاصيل الحضور' : 'Détail par personne'}</div>

    <table>
      <thead>
        <tr>
          <th style="width:50px;text-align:center">#</th>
          <th>${estInst ? (isAr ? 'المؤطر' : 'Instituteur') : (isAr ? 'الطالب' : 'Élève')}</th>
          <th>${isAr ? 'الرقم' : 'N°'}</th>
          ${estInst ? '' : `<th>${isAr ? 'المستوى' : 'Niveau'}</th>`}
          <th style="text-align:center">${isAr ? 'المتوقع' : 'Attendues'}</th>
          <th style="text-align:center">${isAr ? 'حاضر' : 'Présentes'}</th>
          <th style="text-align:center">${isAr ? 'غائب' : 'Absences'}</th>
          <th style="text-align:center">${isAr ? 'النسبة' : 'Taux'}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div style="margin-top:16px;padding:12px;background:#f9f9f6;border-radius:8px;font-size:11px;color:#666">
      <strong>${isAr ? 'العتبات المطبقة' : 'Seuils appliqués'} :</strong>
      ${isAr ? 'تحت' : 'Sous'} <span style="color:#E24B4A;font-weight:700">${seuilRisque}%</span> = ${isAr ? 'تحت العتبة' : 'En alerte'} ·
      ${seuilParfait}%+ = <span style="color:#1D9E75;font-weight:700">${isAr ? 'ممتاز' : 'Parfait'}</span>
    </div>

    <div class="footer">
      ${ecole?.nom || ''} · ${isAr ? 'سري — للاستخدام الداخلي' : 'Confidentiel — Usage interne'}
    </div>
  </div>
  </body></html>`;
}
