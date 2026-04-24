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
    } else if (type === 'rapport_cours') {
      html = generateRapportCours(data, lang);
    } else if (type === 'rapport_parents') {
      html = generateRapportParents(data, lang);
    } else if (type === 'rapport_examens') {
      html = generateRapportExamens(data, lang);
    } else if (type === 'rapport_muraja') {
      html = generateRapportMuraja(data, lang);
    } else if (type === 'rapport_honneur') {
      html = generateRapportHonneur(data, lang);
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

// ══════════════════════════════════════════════════════════════════════
// RAPPORT COURS DE FOND
// Tableau cours × niveau avec progression (axes validés / total)
// ══════════════════════════════════════════════════════════════════════
function generateRapportCours(data, lang) {
  const {
    ecole,
    stats = {},
    rows = [],   // [{cours_nom, cours_categorie, niveau_nom, niveau_couleur, total, valides, pct}]
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const titre = isAr ? 'تقرير الدروس' : 'Rapport Cours de fond';

  // Couleur du taux selon progression
  const pctColor = (p) => {
    if (p >= 100) return '#1D9E75';
    if (p >= 70) return '#EF9F27';
    if (p >= 30) return '#378ADD';
    return '#E24B4A';
  };
  const pctBg = (p) => {
    if (p >= 100) return '#E1F5EE';
    if (p >= 70) return '#FAEEDA';
    if (p >= 30) return '#E6F1FB';
    return '#FCEBEB';
  };

  // Groupement par cours pour un affichage plus lisible
  const groupes = {};
  rows.forEach(r => {
    const key = r.cours_nom || '—';
    if (!groupes[key]) {
      groupes[key] = { categorie: r.cours_categorie, niveaux: [] };
    }
    groupes[key].niveaux.push(r);
  });

  const sections = Object.keys(groupes).map(coursNom => {
    const g = groupes[coursNom];
    const rowsHtml = g.niveaux.map((r, i) => {
      return `
        <tr>
          <td style="text-align:center;color:#888">${i + 1}</td>
          <td>
            <span class="badge" style="background:${r.niveau_couleur || '#085041'}20;color:${r.niveau_couleur || '#085041'}">
              ${r.niveau_nom || r.code_niveau || '—'}
            </span>
          </td>
          <td style="text-align:center">${r.valides || 0} / ${r.total || 0}</td>
          <td style="text-align:center">
            <span style="padding:3px 10px;border-radius:10px;background:${pctBg(r.pct)};color:${pctColor(r.pct)};font-weight:700">
              ${r.pct || 0}%
            </span>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section-title">${coursNom}${g.categorie ? ` <span style="color:#888;font-weight:400;font-size:12px">· ${g.categorie}</span>` : ''}</div>
      <table style="margin-bottom:20px">
        <thead>
          <tr>
            <th style="width:50px;text-align:center">#</th>
            <th>${isAr ? 'المستوى' : 'Niveau'}</th>
            <th style="text-align:center">${isAr ? 'محاور مُتحقق' : 'Axes validés'}</th>
            <th style="text-align:center">${isAr ? 'التقدم' : 'Progression'}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">📚 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre}</div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px">${Object.keys(groupes).length} ${isAr ? 'درس' : 'cours'} · ${rows.length} ${isAr ? 'زوج' : 'couple(s)'}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi">
        <div class="kpi-val">${stats.nbCours || 0}</div>
        <div class="kpi-lbl">${isAr ? 'الدروس' : 'Cours'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${stats.nbLiaisons || 0}</div>
        <div class="kpi-lbl">${isAr ? 'أزواج درس/مستوى' : 'Couples cours × niveau'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#1D9E75">${stats.totalValides || 0}/${stats.totalAxes || 0}</div>
        <div class="kpi-lbl">${isAr ? 'محاور مُتحقق منها' : 'Axes validés'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#EF9F27">${stats.pctMoyen || 0}%</div>
        <div class="kpi-lbl">${isAr ? 'التقدم الإجمالي' : 'Progression moyenne'}</div>
      </div>
    </div>

    ${sections}

    <div class="footer">
      ${ecole?.nom || ''} · ${isAr ? 'سري — للاستخدام الداخلي' : 'Confidentiel — Usage interne'}
    </div>
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════
// RAPPORT TRACKING PARENTS
// Liste des parents avec statut d'activite (Actif/Peu actif/Inactif/Jamais).
// Meme colonnes que l'export CSV pour coherence, en version PDF imprimable.
// ══════════════════════════════════════════════════════════════════════
function generateRapportParents(data, lang) {
  const {
    ecole,
    filtreStatut = 'tous',
    filtreNiveau = '',
    stats = {},
    rows = [],
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const titre = isAr ? 'تقرير متابعة الأولياء' : 'Rapport Tracking Parents';

  // Couleur/emoji par statut
  const statutInfo = (s) => ({
    actif:     { emoji: '🟢', label: isAr ? 'نشط' : 'Actif',       color: '#1D9E75', bg: '#E1F5EE' },
    peu_actif: { emoji: '🟡', label: isAr ? 'قليل' : 'Peu actif',   color: '#EF9F27', bg: '#FAEEDA' },
    inactif:   { emoji: '🔴', label: isAr ? 'غير نشط' : 'Inactif', color: '#E24B4A', bg: '#FCEBEB' },
    jamais:    { emoji: '⚪', label: isAr ? 'لم يزر' : 'Jamais',    color: '#888',    bg: '#f5f5f0' },
  }[s] || { emoji: '⚪', label: '—', color: '#888', bg: '#f5f5f0' });

  const joursLabel = (j) => {
    if (j === null || j === undefined) return isAr ? 'لم يزر قط' : 'Jamais venu';
    if (j === 0) return isAr ? 'اليوم' : 'Aujourd\'hui';
    if (j === 1) return isAr ? 'أمس' : 'Hier';
    return isAr ? `منذ ${j} يوم` : `Il y a ${j} j`;
  };

  const filtreStatutLabel = {
    tous: isAr ? 'جميع الأولياء' : 'Tous les parents',
    actif: isAr ? 'الأولياء النشطون' : 'Parents actifs',
    peu_actif: isAr ? 'قليلو النشاط' : 'Parents peu actifs',
    inactif: isAr ? 'غير النشطين' : 'Parents inactifs',
    jamais: isAr ? 'لم يزوروا قط' : 'Jamais venus',
  }[filtreStatut] || '';

  const rowsHtml = rows.map((r, i) => {
    const si = statutInfo(r.statut);
    return `
      <tr>
        <td style="text-align:center;color:#888">${i + 1}</td>
        <td style="text-align:center;font-size:16px">${si.emoji}</td>
        <td style="font-weight:700">${r.parent_nom || '—'}</td>
        <td>${r.enfant_nom || '—'}</td>
        <td>
          <span class="badge" style="background:${r.niveau_couleur || '#085041'}20;color:${r.niveau_couleur || '#085041'}">
            ${r.niveau_nom || '—'}
          </span>
        </td>
        <td style="font-family:monospace;font-size:11px">${r.telephone || '—'}</td>
        <td style="text-align:center">
          <span style="padding:2px 8px;border-radius:10px;background:${si.bg};color:${si.color};font-weight:700;font-size:11px">
            ${si.label}
          </span>
        </td>
        <td style="font-size:11px">${joursLabel(r.joursEcoules)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">👨‍👩‍👧 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre} — ${filtreStatutLabel}</div>
        ${filtreNiveau ? `<div class="subtitle" style="margin-top:4px">${isAr ? 'المستوى' : 'Niveau'} : ${filtreNiveau}</div>` : ''}
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px">${rows.length} ${isAr ? 'ولي' : 'parent(s)'}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi">
        <div class="kpi-val" style="color:#1D9E75">${stats.actif || 0}</div>
        <div class="kpi-lbl">🟢 ${isAr ? 'نشط' : 'Actifs'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#EF9F27">${stats.peu_actif || 0}</div>
        <div class="kpi-lbl">🟡 ${isAr ? 'قليل النشاط' : 'Peu actifs'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#E24B4A">${stats.inactif || 0}</div>
        <div class="kpi-lbl">🔴 ${isAr ? 'غير نشط' : 'Inactifs'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#888">${stats.jamais || 0}</div>
        <div class="kpi-lbl">⚪ ${isAr ? 'لم يزر' : 'Jamais venus'}</div>
      </div>
    </div>

    <div class="section-title">${isAr ? 'قائمة الأولياء' : 'Liste des parents'}</div>
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center">#</th>
          <th style="width:40px"></th>
          <th>${isAr ? 'الولي' : 'Parent'}</th>
          <th>${isAr ? 'الطالب' : 'Enfant'}</th>
          <th>${isAr ? 'المستوى' : 'Niveau'}</th>
          <th>${isAr ? 'الهاتف' : 'Téléphone'}</th>
          <th style="text-align:center">${isAr ? 'الحالة' : 'Statut'}</th>
          <th>${isAr ? 'آخر زيارة' : 'Dernière visite'}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div style="margin-top:16px;padding:12px;background:#f9f9f6;border-radius:8px;font-size:11px;color:#666;line-height:1.6">
      <strong>💡 ${isAr ? 'توصية' : 'Action recommandée'} :</strong><br>
      ${isAr
        ? 'اتصل بالأولياء ذوي الحالة 🔴 غير نشط و ⚪ لم يزر لتحديث حسابهم وإطلاعهم شفويا على تقدم أبنائهم'
        : 'Contacter les parents 🔴 inactifs et ⚪ jamais venus pour les informer oralement de la progression de leurs enfants'}
    </div>

    <div class="footer">
      ${ecole?.nom || ''} · ${isAr ? 'سري — للاستخدام الداخلي' : 'Confidentiel — Usage interne'}
    </div>
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════
// RAPPORT RÉSULTATS EXAMENS
// Vue globale des résultats d'examens (toutes sessions confondues ou filtrée)
// ══════════════════════════════════════════════════════════════════════
function generateRapportExamens(data, lang) {
  const {
    ecole,
    stats = {},
    rows = [],   // [{eleve_nom, code_niveau, niveau_couleur, examen_nom, score, statut, date}]
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const titre = isAr ? 'تقرير نتائج الامتحانات' : 'Rapport Résultats d\'examens';

  const statutInfo = (s) => ({
    reussi:  { emoji: '✅', label: isAr ? 'ناجح' : 'Réussi',      color: '#1D9E75', bg: '#E1F5EE' },
    echoue:  { emoji: '❌', label: isAr ? 'راسب' : 'Échoué',      color: '#E24B4A', bg: '#FCEBEB' },
    encours: { emoji: '⏳', label: isAr ? 'قيد الإنجاز' : 'En cours', color: '#EF9F27', bg: '#FAEEDA' },
  }[s] || { emoji: '—', label: '—', color: '#888', bg: '#f5f5f0' });

  const rowsHtml = rows.map((r, i) => {
    const si = statutInfo(r.statut);
    return `
      <tr>
        <td style="text-align:center;color:#888">${i + 1}</td>
        <td style="font-weight:700">${r.eleve_nom || '—'}</td>
        <td>
          <span class="badge" style="background:${r.niveau_couleur || '#085041'}20;color:${r.niveau_couleur || '#085041'}">
            ${r.code_niveau || '—'}
          </span>
        </td>
        <td>${r.examen_nom || '—'}</td>
        <td style="text-align:center;font-weight:700;color:${si.color}">${r.score || 0}%</td>
        <td style="text-align:center">
          <span style="padding:2px 10px;border-radius:10px;background:${si.bg};color:${si.color};font-weight:700;font-size:11px">
            ${si.emoji} ${si.label}
          </span>
        </td>
        <td style="font-size:11px">${r.date || '—'}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">🏅 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre}</div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px">${rows.length} ${isAr ? 'نتيجة' : 'résultat(s)'}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi">
        <div class="kpi-val" style="color:#1D9E75">${stats.nbReussis || 0}</div>
        <div class="kpi-lbl">✅ ${isAr ? 'ناجح' : 'Réussis'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#E24B4A">${stats.nbEchoues || 0}</div>
        <div class="kpi-lbl">❌ ${isAr ? 'راسب' : 'Échoués'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#EF9F27">${stats.nbEnCours || 0}</div>
        <div class="kpi-lbl">⏳ ${isAr ? 'قيد الإنجاز' : 'En cours'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${stats.moyenneScore || 0}%</div>
        <div class="kpi-lbl">${isAr ? 'المعدل' : 'Moyenne'}</div>
      </div>
    </div>

    <div class="section-title">${isAr ? 'تفاصيل النتائج' : 'Détail des résultats'}</div>
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center">#</th>
          <th>${isAr ? 'الطالب' : 'Élève'}</th>
          <th>${isAr ? 'المستوى' : 'Niveau'}</th>
          <th>${isAr ? 'الامتحان' : 'Examen'}</th>
          <th style="text-align:center">${isAr ? 'النتيجة' : 'Score'}</th>
          <th style="text-align:center">${isAr ? 'الحالة' : 'Statut'}</th>
          <th>${isAr ? 'التاريخ' : 'Date'}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div class="footer">
      ${ecole?.nom || ''} · ${isAr ? 'سري — للاستخدام الداخلي' : 'Confidentiel — Usage interne'}
    </div>
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════
// RAPPORT MURAJA'A — sessions de révision collective
// Tableau des sessions groupées par date avec contenu, niveau,
// valideur et liste des élèves participants. Inclut des stats par niveau.
// ══════════════════════════════════════════════════════════════════════
function generateRapportMuraja(data, lang) {
  const {
    ecole,
    filtrePeriode,
    filtreNiveau,
    stats = {},       // { totalSessions, totalEleves, parNiveau: [{niveau, label, nb, uniqueEleves, totalEleves, taux, color}] }
    sessions = [],    // [{date, contenu, niveau, niveau_couleur, valideur, nbEleves, eleves: 'nom1, nom2...'}]
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const titre = isAr ? 'تقرير المراجعات الجماعية' : 'Rapport Muraja\'a collectives';

  // Tableau stats par niveau
  const statsHtml = (stats.parNiveau || []).map((s, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i+1}</td>
      <td><span class="badge" style="background:${s.color}20;color:${s.color}">${s.label || s.niveau}</span></td>
      <td style="text-align:center">${s.nb}</td>
      <td style="text-align:center">${s.uniqueEleves} / ${s.totalEleves}</td>
      <td style="text-align:center">
        <span style="padding:3px 10px;border-radius:10px;background:${s.taux>=75?'#E1F5EE':s.taux>=50?'#FAEEDA':'#FCEBEB'};color:${s.taux>=75?'#1D9E75':s.taux>=50?'#EF9F27':'#E24B4A'};font-weight:700">${s.taux}%</span>
      </td>
    </tr>
  `).join('');

  // Tableau des sessions
  const sessionsHtml = sessions.map((sess, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i+1}</td>
      <td style="font-size:11px">${sess.date || '—'}</td>
      <td style="font-weight:700">${sess.contenu || '—'}</td>
      <td>
        <span class="badge" style="background:${sess.niveau_couleur || '#085041'}20;color:${sess.niveau_couleur || '#085041'}">${sess.niveau || '—'}</span>
      </td>
      <td style="font-size:11px">${sess.valideur || '—'}</td>
      <td style="text-align:center;font-weight:700">${sess.nbEleves || 0}</td>
      <td style="font-size:10px;color:#555;max-width:200px">${sess.eleves || '—'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">🔄 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre}</div>
        <div class="subtitle" style="margin-top:4px">
          ${filtrePeriode ? `${isAr ? 'الفترة' : 'Période'} : ${filtrePeriode} ${isAr ? 'يوم' : 'jours'}` : ''}
          ${filtreNiveau && filtreNiveau !== 'tous' ? ` · ${isAr ? 'المستوى' : 'Niveau'} : ${filtreNiveau}` : ''}
        </div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px">${sessions.length} ${isAr ? 'جلسة' : 'session(s)'}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi">
        <div class="kpi-val">${stats.totalSessions || 0}</div>
        <div class="kpi-lbl">${isAr ? 'إجمالي الجلسات' : 'Sessions'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#1D9E75">${stats.totalEleves || 0}</div>
        <div class="kpi-lbl">${isAr ? 'إجمالي المشاركات' : 'Participations'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#EF9F27">${(stats.parNiveau || []).length}</div>
        <div class="kpi-lbl">${isAr ? 'مستوى نشط' : 'Niveaux actifs'}</div>
      </div>
    </div>

    ${(stats.parNiveau || []).length > 0 ? `
    <div class="section-title">${isAr ? 'إحصائيات حسب المستوى' : 'Statistiques par niveau'}</div>
    <table style="margin-bottom:20px">
      <thead>
        <tr>
          <th style="width:40px;text-align:center">#</th>
          <th>${isAr ? 'المستوى' : 'Niveau'}</th>
          <th style="text-align:center">${isAr ? 'عدد الجلسات' : 'Nb sessions'}</th>
          <th style="text-align:center">${isAr ? 'الطلاب المشاركون' : 'Élèves participants'}</th>
          <th style="text-align:center">${isAr ? 'نسبة المشاركة' : 'Taux couverture'}</th>
        </tr>
      </thead>
      <tbody>${statsHtml}</tbody>
    </table>
    ` : ''}

    <div class="section-title">${isAr ? 'تفاصيل الجلسات' : 'Détail des sessions'}</div>
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center">#</th>
          <th>${isAr ? 'التاريخ' : 'Date'}</th>
          <th>${isAr ? 'المحتوى' : 'Contenu'}</th>
          <th>${isAr ? 'المستوى' : 'Niveau'}</th>
          <th>${isAr ? 'المُقيّم' : 'Valideur'}</th>
          <th style="text-align:center">${isAr ? 'العدد' : 'Nb'}</th>
          <th>${isAr ? 'الطلاب' : 'Élèves'}</th>
        </tr>
      </thead>
      <tbody>${sessionsHtml}</tbody>
    </table>

    <div class="footer">
      ${ecole?.nom || ''} · ${isAr ? 'سري — للاستخدام الداخلي' : 'Confidentiel — Usage interne'}
    </div>
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════
// RAPPORT TABLEAU D'HONNEUR — format cérémonieux type diplôme
// Affiche top 3 en médaillons + liste des suivants
// Adapté à l'impression A4 pour affichage mural école
// ══════════════════════════════════════════════════════════════════════
function generateRapportHonneur(data, lang) {
  const {
    ecole,
    periodeLabel,
    vueLabel = '',  // 'Global' ou nom du niveau
    eleves = [],    // [{rang, prenom, nom, code_niveau, niveau_couleur, points, tomon, hizb}]
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const titre = isAr ? 'لوحة الشرف' : 'Tableau d\'honneur';

  const top3 = eleves.slice(0, 3);
  const suivants = eleves.slice(3);
  const medals = ['🥇', '🥈', '🥉'];
  const podiumColors = ['#EF9F27', '#B0B0B0', '#CD7F32'];
  const podiumBg = ['#FFF8E7', '#F5F5F5', '#FAEED9'];

  // Rendu podium top 3
  const podiumHtml = top3.length > 0 ? `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:24px 0 30px">
      ${top3.map((el, i) => `
        <div style="background:${podiumBg[i]};border:3px solid ${podiumColors[i]};border-radius:16px;padding:20px 12px;text-align:center;${i===0?'transform:scale(1.08)':''}">
          <div style="font-size:48px;line-height:1">${medals[i]}</div>
          <div style="font-size:${i===0?26:22}px;font-weight:900;color:${podiumColors[i]};margin:8px 0 4px">#${i+1}</div>
          <div style="font-size:${i===0?15:13}px;font-weight:800;color:#1a1a1a;margin-bottom:4px">
            ${el.prenom || ''} ${el.nom || ''}
          </div>
          <div style="display:inline-block;padding:2px 10px;border-radius:12px;background:${el.niveau_couleur || '#085041'}20;color:${el.niveau_couleur || '#085041'};font-size:11px;font-weight:700;margin-bottom:8px">
            ${el.code_niveau || '—'}
          </div>
          <div style="font-size:${i===0?22:18}px;font-weight:900;color:${podiumColors[i]}">
            ${el.points || 0} <span style="font-size:11px;font-weight:600">${isAr?'نقطة':'pts'}</span>
          </div>
          <div style="font-size:10px;color:#666;margin-top:4px">
            ${el.tomon || 0} ${isAr?'ثُمن':'tomon'} · ${el.hizb || 0} ${isAr?'حزب':'hizb'}
          </div>
        </div>
      `).join('')}
    </div>
  ` : `
    <div style="padding:30px;text-align:center;color:#888;font-style:italic">
      ${isAr ? 'لا توجد نتائج لهذه الفترة' : 'Aucun résultat pour cette période'}
    </div>
  `;

  // Liste des suivants (rang 4+)
  const suivantsHtml = suivants.length > 0 ? `
    <div class="section-title" style="margin-top:24px">${isAr ? 'التصنيف الكامل' : 'Classement complet'}</div>
    <table>
      <thead>
        <tr>
          <th style="width:60px;text-align:center">${isAr ? 'الرتبة' : 'Rang'}</th>
          <th>${isAr ? 'الطالب' : 'Élève'}</th>
          <th>${isAr ? 'المستوى' : 'Niveau'}</th>
          <th style="text-align:center">${isAr ? 'النقاط' : 'Points'}</th>
          <th style="text-align:center">${isAr ? 'ثُمن' : 'Tomon'}</th>
          <th style="text-align:center">${isAr ? 'حزب' : 'Hizb'}</th>
        </tr>
      </thead>
      <tbody>
        ${suivants.map(el => `
          <tr>
            <td style="text-align:center;font-weight:800;color:#888">#${el.rang}</td>
            <td style="font-weight:700">${el.prenom || ''} ${el.nom || ''}</td>
            <td>
              <span class="badge" style="background:${el.niveau_couleur || '#085041'}20;color:${el.niveau_couleur || '#085041'}">
                ${el.code_niveau || '—'}
              </span>
            </td>
            <td style="text-align:center;font-weight:700;color:#378ADD">${el.points || 0}</td>
            <td style="text-align:center">${el.tomon || 0}</td>
            <td style="text-align:center">${el.hizb || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre}</title>${baseStyles()}
  <style>
    .honneur-page {
      max-width: 800px;
      margin: 0 auto;
      padding: 30px;
      background: linear-gradient(135deg, #FFFAEF 0%, #FFF5DC 100%);
      border: 6px double #EF9F27;
      border-radius: 20px;
      position: relative;
    }
    .honneur-header {
      text-align: center;
      padding: 20px 0 10px;
      border-bottom: 2px dashed #EF9F27;
      margin-bottom: 20px;
    }
    .honneur-title {
      font-size: 36px;
      font-weight: 900;
      color: #085041;
      letter-spacing: 1px;
      margin: 0;
    }
    .honneur-subtitle {
      font-size: 15px;
      color: #EF9F27;
      font-weight: 700;
      margin-top: 6px;
      letter-spacing: 0.5px;
    }
    .honneur-ecole {
      font-size: 13px;
      color: #666;
      margin-top: 4px;
    }
    .honneur-decor {
      font-size: 32px;
      margin: 10px 0;
    }
  </style>
  </head>
  <body>
  ${printButton(lang)}
  <div class="honneur-page">
    <div class="honneur-header">
      <div class="honneur-decor">🏆 ⭐ 🏆</div>
      <div class="honneur-title">${titre}</div>
      <div class="honneur-subtitle">${periodeLabel || ''}${vueLabel ? ' · ' + vueLabel : ''}</div>
      <div class="honneur-ecole">${ecole?.nom || ''}</div>
      <div style="font-size:11px;color:#999;margin-top:6px">${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
    </div>

    ${podiumHtml}

    ${suivantsHtml}

    <div style="margin-top:30px;padding:16px;background:rgba(239,159,39,0.08);border-radius:12px;text-align:center;font-size:12px;color:#666;font-style:italic">
      ${isAr
        ? '✨ بارك الله في جهودكم — استمروا في طريق التميز'
        : '✨ Félicitations pour votre travail — continuez sur la voie de l\'excellence'}
    </div>

    <div class="footer" style="margin-top:20px;border-top:1px dashed #EF9F27;padding-top:10px;text-align:center;font-size:10px;color:#888">
      ${ecole?.nom || ''} · ${isAr ? 'لوحة الشرف' : 'Tableau d\'honneur'} · ${eleves.length} ${isAr ? 'طالب' : 'élève(s)'}
    </div>
  </div>
  </body></html>`;
}
