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
      html = await generateCertificat(data, lang);
    } else if (type === 'certificat_examen') {
      html = await generateCertificatExamen(data, lang);
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
    } else if (type === 'rapport_inactifs') {
      html = generateRapportInactifs(data, lang);
    } else if (type === 'rapport_gestion_examens') {
      html = generateRapportGestionExamens(data, lang);
    } else if (type === 'rapport_direction') {
      html = generateRapportDirection(data, lang);
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

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATS (B5 — refonte complète)
// ─────────────────────────────────────────────────────────────────────────────
//
// Architecture :
// - certificatStyles()     : CSS commun (fontes, bordures, étoile khatim, layout A4)
// - certificatHeader(...)  : header bilingue (école + ville/pays + titre)
// - certificatMedaille()   : SVG inline étoile 8 branches (khatim)
// - certificatFooter(...)  : footer (numéro + zone signature généreuse)
// - generateCertificat        : certificat JALON / BLOC (sans score, sans contenu)
// - generateCertificatExamen  : certificat EXAMEN (avec score + contenu Hizb/Sourates)
//
// Style : hybride sobre + touches arabes discrètes (validé Jamal Q2=C)
// Header : nom école AR + transcription FR + ville/pays (validé Jamal Q3=B)
// Médaille : SVG khatim (étoile 8 branches), validé Jamal
//
// REFONTE B5 (J3 sprint 12j) — diplôme académique style officiel marocain :
//   * Police Amiri (Google Fonts) pour le titre arabe principal
//   * Watermark khatim géant 4% opacity en arrière-plan
//   * Motif zellige géométrique en bordure intérieure
//   * Score affiché dans un cercle décoratif
//   * Date au format Hijri + grégorien (systématique)
//   * Numéro certificat AAAA/NNNN (généré par trigger BDD)
//   * QR code de vérification (bas-droite, lien vers /verify/:numero)
//   * Signature configurable : Surveillant seul OU Directeur + Surveillant
// ─────────────────────────────────────────────────────────────────────────────

// ─── HELPER : conversion grégorien → Hijri ───
// Algorithme tabular Umm al-Qura simplifié (precision : ±1 jour, acceptable
// pour un certificat décoratif). Pour précision astronomique, utiliser
// une table Umm al-Qura officielle, mais c'est ~30 KB en plus pour gain
// minime sur un certificat.
function gregorianToHijri(date) {
  const jd = gregorianToJulianDay(date);
  // Constante époque hégirienne : Julian Day du 1er Muharram 1 AH = 1948440
  const daysSinceEpoch = jd - 1948440;
  // Année hégirienne moyenne : 354.367 jours
  const hYear = Math.floor((daysSinceEpoch - 1) / 354.367) + 1;
  const hYearStart = 1948440 + Math.floor((hYear - 1) * 354.367);
  const daysInYear = jd - hYearStart;
  // Mois alternés 30/29 jours, mois 12 (Dhu al-Hijja) = 29 ou 30
  const monthDays = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
  let dayCount = daysInYear;
  let hMonth = 1;
  for (let i = 0; i < 12; i++) {
    if (dayCount < monthDays[i]) break;
    dayCount -= monthDays[i];
    hMonth++;
  }
  const hDay = dayCount + 1;
  return { year: hYear, month: hMonth, day: hDay };
}

function gregorianToJulianDay(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function formatHijriDate(date, isAr) {
  const h = gregorianToHijri(date);
  const moisAr = ['مُحَرَّم', 'صَفَر', 'رَبيع الأوّل', 'رَبيع الثاني', 'جُمادى الأولى',
                  'جُمادى الآخرة', 'رَجَب', 'شَعبان', 'رَمَضان', 'شَوّال',
                  'ذو القَعدة', 'ذو الحِجّة'];
  const moisFr = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
                  'Jumada al-Ula', 'Jumada al-Akhira', 'Rajab', 'Shaban',
                  'Ramadan', 'Shawwal', 'Dhu al-Qida', 'Dhu al-Hijja'];
  if (isAr) {
    return `${h.day} ${moisAr[h.month - 1]} ${h.year} هـ`;
  }
  return `${h.day} ${moisFr[h.month - 1]} ${h.year} H.`;
}

// ─── HELPER : génération QR Code (data URL) ───
// Utilise la lib `qrcode` côté Node. Retourne une dataURL PNG embarquable
// dans <img src="..."/>. Si la génération échoue, retourne null silencieusement
// pour que le certificat ne soit pas bloqué.
async function generateQRCodeDataURL(text) {
  try {
    const QRCode = require('qrcode');
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: { dark: '#085041', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('[QR] Generation failed:', err);
    return null;
  }
}

// ─── HELPER : URL de vérification publique ───
// Base URL = origin du serveur Vercel (auto-detection via env)
function buildVerificationUrl(numero) {
  if (!numero) return null;
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXT_PUBLIC_BASE_URL || 'https://suivi-recitation.vercel.app');
  // Encode le numero (contient un '/' → doit être URL-encodé)
  return `${base}/verify/${encodeURIComponent(numero)}`;
}

// ─── HELPER : motif zellige (bordure géométrique répétée) ───
// SVG inline d'un petit motif géométrique islamique, répété en filet
function zelligeBorder() {
  // Petit motif : étoile à 8 branches + cercle, répétable
  return `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <polygon points="10,2 12,8 18,10 12,12 10,18 8,12 2,10 8,8" fill="#EF9F27" opacity="0.6"/>
    <circle cx="10" cy="10" r="2" fill="#085041" opacity="0.4"/>
  </svg>`;
}

// ─── HELPER : watermark khatim géant central ───
function watermarkKhatim() {
  // Etoile 8 branches géante, 4% opacity, derrière tout le contenu
  return `<svg class="watermark" viewBox="-60 -60 120 120" xmlns="http://www.w3.org/2000/svg">
    <polygon points="0,-50 12,-12 50,0 12,12 0,50 -12,12 -50,0 -12,-12" fill="#085041"/>
    <polygon points="0,-50 12,-12 50,0 12,12 0,50 -12,12 -50,0 -12,-12" transform="rotate(45)" fill="#085041"/>
  </svg>`;
}

function certificatStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');
    @page { size: A4 landscape; margin: 0; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Tajawal',Arial,sans-serif; background:#f0f0ec; }
    .cert { width:1122px; height:794px; margin:0 auto; background:#fff; position:relative; overflow:hidden; }

    /* WATERMARK central — étoile khatim géante très discrète */
    .watermark { position:absolute; top:50%; left:50%; width:380px; height:380px;
      transform:translate(-50%, -50%); opacity:0.025; pointer-events:none; z-index:0; }

    /* Double bordure : verte épaisse + filet doré intérieur */
    .border-outer { position:absolute; inset:20px; border:6px solid #085041; pointer-events:none; z-index:1; }
    .border-inner { position:absolute; inset:34px; border:1px solid #EF9F27; pointer-events:none; z-index:1; }

    /* Filet zellige : bande de motifs géométriques juste sous la bordure dorée */
    .zellige-band { position:absolute; left:50px; right:50px; height:14px; pointer-events:none; z-index:1;
      display:flex; gap:6px; align-items:center; opacity:0.45; overflow:hidden; }
    .zellige-band.top { top:44px; }
    .zellige-band.bottom { bottom:44px; transform:scaleY(-1); }
    .zellige-band > * { flex-shrink:0; }

    /* Coins khatim discrets */
    .corner { position:absolute; width:24px; height:24px; opacity:0.55; pointer-events:none; z-index:2; }
    .corner-tl { top:48px; left:48px; }
    .corner-tr { top:48px; right:48px; }
    .corner-bl { bottom:48px; left:48px; }
    .corner-br { bottom:48px; right:48px; }

    .content { position:absolute; top:78px; bottom:78px; left:60px; right:60px; display:flex; flex-direction:column; align-items:center; z-index:3; }

    /* HEADER */
    .header { width:100%; text-align:center; padding-bottom:16px; border-bottom:1.5px solid #EF9F27; }
    .ecole-ar { font-size:22px; font-weight:700; color:#085041; direction:rtl; font-family:'Tajawal',Arial,sans-serif; }
    .ecole-fr { font-size:13px; color:#888; margin-top:3px; letter-spacing:0.5px; }

    /* TITRE — Amiri pour l'arabe (calligraphie classique) */
    .title-block { margin-top:18px; text-align:center; }
    .title-ar { font-family:'Amiri',serif; font-size:64px; font-weight:700; color:#085041;
      direction:rtl; line-height:1; letter-spacing:2px; }
    .title-fr { font-size:13px; color:#888; letter-spacing:6px; font-weight:600; margin-top:10px; }

    /* CORPS */
    .body { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; gap:8px; padding:6px 0; }
    .medal-svg { width:90px; height:90px; }
    .line-ar { font-size:17px; color:#666; direction:rtl; font-family:'Tajawal',Arial,sans-serif; }
    .name { font-size:38px; font-weight:800; color:#085041; direction:rtl; padding:4px 32px 6px; border-bottom:2px solid #1D9E75; font-family:'Tajawal',Arial,sans-serif; }
    .examen-box { font-size:21px; font-weight:700; color:#1D9E75; border:2px solid #1D9E75; border-radius:10px; padding:6px 26px; background:#E1F5EE; direction:rtl; margin-top:2px; }
    .jalon-box { font-size:23px; font-weight:700; color:#EF9F27; border:2px solid #EF9F27; border-radius:10px; padding:8px 32px; background:#FAEEDA; direction:rtl; margin-top:4px; }

    /* CONTENU (B5) */
    .contenu-block { text-align:center; margin-top:4px; }
    .contenu-label { font-size:11px; color:#aaa; letter-spacing:2px; font-weight:600; }
    .contenu-ar { font-size:17px; font-weight:600; color:#085041; direction:rtl; margin-top:3px; font-family:'Tajawal',Arial,sans-serif; }
    .contenu-fr { font-size:12px; color:#666; margin-top:2px; }

    /* DÉTAILS (3 colonnes) — Score dans un cercle */
    .details { width:100%; background:#f9f9f6; border-radius:10px; padding:14px 24px; display:flex; justify-content:space-around; align-items:center; margin-top:10px; }
    .detail-cell { text-align:center; flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .detail-label { font-size:10px; color:#aaa; letter-spacing:1.5px; font-weight:600; unicode-bidi:plaintext; }
    .detail-value { font-size:15px; font-weight:700; color:#1a1a1a; margin-top:5px; }
    .detail-date { font-size:13px; font-weight:700; color:#1a1a1a; margin-top:5px; line-height:1.3; }
    .detail-date-hijri { font-size:11px; color:#888; margin-top:2px; font-family:'Amiri',serif; direction:rtl; }
    /* Score : pastille circulaire colorée */
    .score-circle { width:72px; height:72px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-top:4px; flex-direction:column; }
    .score-value { font-size:24px; font-weight:800; line-height:1; }
    .score-percent { font-size:11px; font-weight:600; margin-top:-2px; }
    .separator { width:1px; height:48px; background:#e0e0d8; }

    .note { font-style:italic; color:#888; font-size:12px; text-align:center; direction:rtl; margin-top:6px; max-width:760px; font-family:'Tajawal',Arial,sans-serif; }

    /* FOOTER */
    .footer { width:100%; display:flex; justify-content:space-between; align-items:flex-end; padding-top:12px; margin-top:12px; border-top:1px solid #e0e0d8; min-height:96px; gap:16px; }
    .footer-info { display:flex; flex-direction:column; align-items:flex-start; }
    .footer-num { font-size:13px; font-weight:700; color:#085041; letter-spacing:0.5px; }
    .footer-date-emis { font-size:11px; color:#888; margin-top:4px; direction:rtl; font-family:'Tajawal',Arial,sans-serif; }
    .footer-date-emis-fr { font-size:10px; color:#aaa; margin-top:2px; }

    /* QR Code de vérification */
    .qr-block { display:flex; flex-direction:column; align-items:center; gap:4px; }
    .qr-img { width:78px; height:78px; border:1px solid #e0e0d8; padding:3px; background:#fff; border-radius:4px; }
    .qr-label { font-size:8.5px; color:#aaa; letter-spacing:0.5px; text-align:center; }

    /* SIGNATURES */
    .signatures { display:flex; gap:36px; align-items:flex-end; }
    .sign { text-align:center; min-width:200px; padding-top:28px; }
    .sign-line { width:200px; border-bottom:1.5px solid #333; margin:0 auto 6px; }
    .sign-name-ar { font-size:12px; color:#1a1a1a; font-weight:700; direction:rtl; font-family:'Tajawal',Arial,sans-serif; }
    .sign-role-ar { font-size:11px; color:#666; direction:rtl; margin-top:2px; font-family:'Tajawal',Arial,sans-serif; }
    .sign-name-fr { font-size:10px; color:#666; margin-top:2px; }
    .sign-role-fr { font-size:9.5px; color:#aaa; }

    /* IMPRESSION */
    @media print {
      body { background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print, .no-print * { display:none !important; visibility:hidden !important; }
    }
    /* Classe explicite quand on lance window.print() depuis JS (fallback) */
    body.printing .no-print, body.printing .no-print * { display:none !important; visibility:hidden !important; }
  `;
}

function certificatMedaille() {
  // SVG étoile 8 branches (khatim) — vert + or + étoile blanche centrale
  return `<svg class="medal-svg" viewBox="-60 -60 120 120" xmlns="http://www.w3.org/2000/svg">
    <polygon points="0,-50 12,-12 50,0 12,12 0,50 -12,12 -50,0 -12,-12" fill="#085041"/>
    <polygon points="0,-50 12,-12 50,0 12,12 0,50 -12,12 -50,0 -12,-12" transform="rotate(45)" fill="#1D9E75" fill-opacity="0.7"/>
    <circle r="22" fill="#fff" stroke="#085041" stroke-width="1.5"/>
    <circle r="14" fill="#EF9F27"/>
    <text y="5" text-anchor="middle" font-family="serif" font-size="14" font-weight="bold" fill="#fff">★</text>
  </svg>`;
}

function certificatCornerKhatim() {
  // Petit motif khatim pour les 4 coins (étoile 8 branches miniature)
  return `<svg viewBox="-15 -15 30 30" xmlns="http://www.w3.org/2000/svg">
    <polygon points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3" fill="#EF9F27"/>
    <polygon points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3" transform="rotate(45)" fill="#085041" fill-opacity="0.4"/>
  </svg>`;
}

function certificatHeader(ecole, isAr) {
  // Nom école : préférer AR si dispo, sinon nom standard. Localité optionnelle.
  const nomAr = ecole?.nom_ar || ecole?.nom || (isAr ? 'مدرسة قرآنية' : 'École Coranique');
  const nomFr = ecole?.nom || '';
  const ville = ecole?.ville || '';
  const pays = ecole?.pays || '';
  const localite = [ville, pays].filter(Boolean).join(', ');
  // Si on a un nom_ar distinct du nom, on affiche les deux ; sinon on n'affiche qu'une fois
  const showFr = nomFr && nomFr !== nomAr;
  // Construire la 2e ligne proprement : pieces non-vides separees par ' · '
  const pieces = [];
  if (showFr) pieces.push(escapeHtml(nomFr));
  if (localite) pieces.push(escapeHtml(localite));
  const ligne2 = pieces.join(' · ');
  return `
    <div class="header">
      <div class="ecole-ar">${escapeHtml(nomAr)}</div>
      ${ligne2 ? `<div class="ecole-fr">${ligne2}</div>` : ''}
    </div>`;
}

function certificatTitle(isAr) {
  return `
    <div class="title-block">
      <div class="title-ar">شهادة نجاح</div>
      <div class="title-fr">CERTIFICAT DE RÉUSSITE</div>
    </div>`;
}

function certificatFooter(numero, dateStr, dateHijri, qrDataUrl, qrUrl, ecole, isAr) {
  // ─── Bloc info gauche : numéro + date d'émission (FR + Hijri) ───
  const numeroLine = numero
    ? `<div class="footer-num">N° ${escapeHtml(numero)}</div>`
    : '';
  const dateEmisLabel = isAr ? 'أُصدر بتاريخ' : 'Émis le';
  const infoBloc = `
    <div class="footer-info">
      ${numeroLine}
      <div class="footer-date-emis">${dateEmisLabel} : ${escapeHtml(dateStr)}</div>
      ${dateHijri ? `<div class="footer-date-emis-fr">${escapeHtml(dateHijri)}</div>` : ''}
    </div>`;

  // ─── Bloc QR central : code de vérification ───
  const qrBloc = qrDataUrl ? `
    <div class="qr-block">
      <img class="qr-img" src="${qrDataUrl}" alt="QR vérification"/>
      <div class="qr-label">${isAr ? 'تحقّق · Vérifier' : 'Vérifier · تحقّق'}</div>
    </div>` : '<div></div>';

  // ─── Bloc signatures droite : Directeur (optionnel) + Surveillant ───
  const nomDir = (ecole?.nom_directeur || '').trim();
  const nomDirAr = (ecole?.nom_directeur_ar || '').trim() || nomDir; // Fallback FR si AR vide
  const hasDirecteur = !!nomDir;

  const signSurv = `
    <div class="sign">
      <div class="sign-line"></div>
      <div class="sign-name-ar">&nbsp;</div>
      <div class="sign-role-ar">المُشرف</div>
      <div class="sign-role-fr">Surveillant</div>
    </div>`;

  const signDir = hasDirecteur ? `
    <div class="sign">
      <div class="sign-line"></div>
      <div class="sign-name-ar">${escapeHtml(nomDirAr)}</div>
      <div class="sign-role-ar">المُدير</div>
      <div class="sign-name-fr">${escapeHtml(nomDir)}</div>
      <div class="sign-role-fr">Directeur</div>
    </div>` : '';

  const signaturesBloc = `<div class="signatures">${signDir}${signSurv}</div>`;

  return `
    <div class="footer">
      ${infoBloc}
      ${qrBloc}
      ${signaturesBloc}
    </div>`;
}

function certificatPrintBar(isAr) {
  return `
    <div class="no-print" style="position:fixed;top:16px;right:16px;z-index:999;display:flex;gap:8px;">
      <button onclick="(function(){document.body.classList.add('printing');setTimeout(function(){window.print();setTimeout(function(){document.body.classList.remove('printing');},500);},50);})()" style="padding:10px 20px;background:#085041;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:'Tajawal',Arial,sans-serif;font-weight:700;">
        🖨️ ${isAr ? 'طباعة / تحميل PDF' : 'Imprimer / Télécharger PDF'}
      </button>
      <button onclick="window.close()" style="padding:10px 16px;background:#f0f0ec;color:#666;border:none;border-radius:8px;font-size:14px;cursor:pointer;">✕</button>
    </div>
    <script>
      // Robustesse multi-navigateur : ajouter classe printing pendant l'impression
      // (au cas où @media print ne s'applique pas dans l'apercu inline du navigateur)
      window.addEventListener('beforeprint', function(){ document.body.classList.add('printing'); });
      window.addEventListener('afterprint', function(){ document.body.classList.remove('printing'); });
    </script>`;
}

// Helper sécurité : échappe le HTML pour éviter injection / casse de layout
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────────────────────
// generateCertificat — Certificat JALON / BLOC
// Pas de score (jalon = palier franchi, pas un examen)
// Pas de bloc Contenu (le titre du jalon contient déjà l'info)
// ─────────────────────────────────────────────────────────────────────────────
async function generateCertificat(data, lang) {
  const { eleve, jalon, date, ecole, niveau, numero } = data || {};
  const isAr = lang === 'ar';
  if (!eleve) return '<html><body>Données manquantes</body></html>';

  const d = new Date(date || new Date());
  const dateStr = d.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dateHijri = formatHijriDate(d, isAr);
  const niveauTxt = niveau ? `${escapeHtml(niveau.nom || '')}${niveau.code ? ` (${escapeHtml(niveau.code)})` : ''}` : escapeHtml(eleve.code_niveau || '');
  const titreJalon = jalon?.nom_ar || jalon?.nom || '';
  const corner = certificatCornerKhatim();

  // QR code de vérification (genere uniquement si on a un numero)
  const qrUrl = buildVerificationUrl(numero);
  const qrDataUrl = qrUrl ? await generateQRCodeDataURL(qrUrl) : null;

  // Bandes zellige
  const zelligePattern = Array.from({ length: 40 }, () => zelligeBorder()).join('');

  return `<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'fr'}"><head><meta charset="UTF-8"><title>${isAr ? 'شهادة' : 'Certificat'} ${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</title>
  <style>${certificatStyles()}</style></head>
  <body>
  ${certificatPrintBar(isAr)}
  <div class="cert">
    ${watermarkKhatim()}
    <div class="border-outer"></div>
    <div class="border-inner"></div>
    <div class="zellige-band top">${zelligePattern}</div>
    <div class="zellige-band bottom">${zelligePattern}</div>
    <div class="corner corner-tl">${corner}</div>
    <div class="corner corner-tr">${corner}</div>
    <div class="corner corner-bl">${corner}</div>
    <div class="corner corner-br">${corner}</div>
    <div class="content">
      ${certificatHeader(ecole, isAr)}
      ${certificatTitle(isAr)}
      <div class="body">
        ${certificatMedaille()}
        <div class="line-ar">يُشهد بأن الطالب / الطالبة</div>
        <div class="name">${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</div>
        <div class="line-ar">قد أتم بنجاح</div>
        <div class="jalon-box">${escapeHtml(titreJalon)}</div>
      </div>
      <div class="details">
        <div class="detail-cell">
          <div class="detail-label">المستوى · NIVEAU</div>
          <div class="detail-value">${niveauTxt || '—'}</div>
        </div>
        <div class="separator"></div>
        <div class="detail-cell">
          <div class="detail-label">التاريخ · DATE</div>
          <div class="detail-date">${escapeHtml(dateStr)}</div>
          <div class="detail-date-hijri">${escapeHtml(dateHijri)}</div>
        </div>
      </div>
      ${certificatFooter(numero, dateStr, dateHijri, qrDataUrl, qrUrl, ecole, isAr)}
    </div>
  </div>
  </body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateCertificatExamen — Certificat EXAMEN
// Avec score coloré + bloc Contenu (Hizb / Sourates) — ajout B5
// ─────────────────────────────────────────────────────────────────────────────
async function generateCertificatExamen(data, lang) {
  const { eleve, examen, niveau, ecole, resultat, contenu, numero } = data || {};
  if (!eleve || !examen || !resultat) return '<html><body>Données manquantes</body></html>';

  const isAr = lang === 'ar';
  const d = new Date(resultat.date_examen || resultat.created_at || new Date());
  const dateStr = d.toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dateHijri = formatHijriDate(d, isAr);
  const niveauTxt = niveau ? `${escapeHtml(niveau.nom || '')}${niveau.code ? ` (${escapeHtml(niveau.code)})` : ''}` : escapeHtml(eleve.code_niveau || '');
  const score = Number(resultat.score) || 0;
  const scoreColor = score >= 90 ? '#1D9E75' : score >= 70 ? '#378ADD' : '#EF9F27';
  const scoreBg = score >= 90 ? '#E1F5EE' : score >= 70 ? '#E6F1FB' : '#FAEEDA';
  const corner = certificatCornerKhatim();

  // Bloc Contenu (B5) : affiche AR + FR si fourni, sinon masqué
  const contenuBloc = (contenu && (contenu.ar || contenu.fr)) ? `
    <div class="contenu-block">
      <div class="contenu-label">المحتوى · CONTENU</div>
      ${contenu.ar ? `<div class="contenu-ar">${escapeHtml(contenu.ar)}</div>` : ''}
      ${contenu.fr ? `<div class="contenu-fr">${escapeHtml(contenu.fr)}</div>` : ''}
    </div>` : '';

  // QR code de vérification (genere uniquement si on a un numero)
  const qrUrl = buildVerificationUrl(numero);
  const qrDataUrl = qrUrl ? await generateQRCodeDataURL(qrUrl) : null;

  // Bandes zellige (motif géométrique) : 40 répétitions ~ couvre 1040px de large
  const zelligePattern = Array.from({ length: 40 }, () => zelligeBorder()).join('');

  return `<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'fr'}"><head><meta charset="UTF-8"><title>${isAr ? 'شهادة' : 'Certificat'} ${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</title>
  <style>${certificatStyles()}</style></head>
  <body>
  ${certificatPrintBar(isAr)}
  <div class="cert">
    ${watermarkKhatim()}
    <div class="border-outer"></div>
    <div class="border-inner"></div>
    <div class="zellige-band top">${zelligePattern}</div>
    <div class="zellige-band bottom">${zelligePattern}</div>
    <div class="corner corner-tl">${corner}</div>
    <div class="corner corner-tr">${corner}</div>
    <div class="corner corner-bl">${corner}</div>
    <div class="corner corner-br">${corner}</div>
    <div class="content">
      ${certificatHeader(ecole, isAr)}
      ${certificatTitle(isAr)}
      <div class="body">
        ${certificatMedaille()}
        <div class="line-ar">يُشهد بأن الطالب / الطالبة</div>
        <div class="name">${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</div>
        <div class="line-ar">قد اجتاز بنجاح امتحان</div>
        <div class="examen-box">${escapeHtml(examen.nom || '')}</div>
        ${contenuBloc}
      </div>
      <div class="details">
        <div class="detail-cell">
          <div class="detail-label">المستوى · NIVEAU</div>
          <div class="detail-value">${niveauTxt || '—'}</div>
        </div>
        <div class="separator"></div>
        <div class="detail-cell">
          <div class="detail-label">النتيجة · SCORE</div>
          <div class="score-circle" style="background:${scoreBg};border:2px solid ${scoreColor};color:${scoreColor}">
            <div class="score-value">${score}</div>
            <div class="score-percent">%</div>
          </div>
        </div>
        <div class="separator"></div>
        <div class="detail-cell">
          <div class="detail-label">التاريخ · DATE</div>
          <div class="detail-date">${escapeHtml(dateStr)}</div>
          <div class="detail-date-hijri">${escapeHtml(dateHijri)}</div>
        </div>
      </div>
      ${resultat.notes_examinateur ? `<div class="note">"${escapeHtml(resultat.notes_examinateur)}"</div>` : ''}
      ${certificatFooter(numero, dateStr, dateHijri, qrDataUrl, qrUrl, ecole, isAr)}
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

// ══════════════════════════════════════════════════════════════════════
// RAPPORT ÉLÈVES INACTIFS — liste d'alerte avec téléphones parents
// Objectif : permettre au surveillant d'appeler/relancer les familles
// ══════════════════════════════════════════════════════════════════════
function generateRapportInactifs(data, lang) {
  const {
    ecole,
    stats = {},       // { plus30, entre14, jamais }
    rows = [],        // [{prenom, nom, eleve_id_ecole, code_niveau, niveau_couleur, instituteur, derniere, jours, parent_nom, parent_tel}]
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const titre = isAr ? 'تقرير الطلاب غير النشطين' : 'Rapport Élèves inactifs';

  // Catégorisation par urgence
  const categoryColor = (row) => {
    if (row.jours == null) return { bg: '#F0EEFF', color: '#534AB7', label: isAr ? 'لم يستظهر' : 'Sans récit.' };
    if (row.jours > 30)    return { bg: '#FCEBEB', color: '#E24B4A', label: isAr ? 'عاجل' : 'Urgent' };
    return { bg: '#FFF3CD', color: '#856404', label: isAr ? 'تنبيه' : 'Alerte' };
  };

  const joursLabel = (j) => {
    if (j == null) return isAr ? 'لم يستظهر قط' : 'Jamais récité';
    if (j === 0)   return isAr ? 'اليوم' : 'Aujourd\'hui';
    if (j === 1)   return isAr ? 'أمس' : 'Hier';
    return isAr ? `منذ ${j} يوم` : `Il y a ${j} j`;
  };

  const rowsHtml = rows.map((r, i) => {
    const cat = categoryColor(r);
    return `
      <tr>
        <td style="text-align:center;color:#888">${i + 1}</td>
        <td>
          <div style="font-weight:700">${r.prenom || ''} ${r.nom || ''}</div>
          ${r.eleve_id_ecole ? `<div style="font-size:10px;color:#888">N° ${r.eleve_id_ecole}</div>` : ''}
        </td>
        <td>
          <span class="badge" style="background:${r.niveau_couleur || '#085041'}20;color:${r.niveau_couleur || '#085041'}">
            ${r.code_niveau || '—'}
          </span>
        </td>
        <td style="font-size:11px">${r.instituteur || '—'}</td>
        <td style="text-align:center">
          <span style="padding:2px 10px;border-radius:10px;background:${cat.bg};color:${cat.color};font-weight:700;font-size:11px">
            ${cat.label}
          </span>
          <div style="font-size:10px;color:#666;margin-top:3px">${joursLabel(r.jours)}</div>
        </td>
        <td style="font-size:11px">
          ${r.parent_nom ? `<div style="font-weight:600">${r.parent_nom}</div>` : ''}
          ${r.parent_tel ? `<div style="font-family:monospace;color:#378ADD;font-weight:700">📞 ${r.parent_tel}</div>` : `<div style="color:#aaa;font-style:italic">${isAr ? 'بدون' : 'Non renseigné'}</div>`}
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
        <div class="logo">🚨 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre}</div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px">${rows.length} ${isAr ? 'طالب' : 'élève(s)'}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi">
        <div class="kpi-val" style="color:#E24B4A">${stats.plus30 || 0}</div>
        <div class="kpi-lbl">🔴 +30 ${isAr ? 'يوم' : 'jours'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#856404">${stats.entre14 || 0}</div>
        <div class="kpi-lbl">🟡 14-30 ${isAr ? 'يوم' : 'jours'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#534AB7">${stats.jamais || 0}</div>
        <div class="kpi-lbl">⚪ ${isAr ? 'لم يستظهر' : 'Sans récitation'}</div>
      </div>
    </div>

    <div class="section-title">${isAr ? 'قائمة الطلاب للاتصال' : 'Liste des élèves à contacter'}</div>

    ${rows.length === 0 ? `
      <div style="padding:40px;text-align:center;color:#1D9E75;background:#E1F5EE;border-radius:12px;font-weight:700">
        ✓ ${isAr ? 'جميع الطلاب نشطون' : 'Tous les élèves sont actifs'}
      </div>
    ` : `
      <table>
        <thead>
          <tr>
            <th style="width:40px;text-align:center">#</th>
            <th>${isAr ? 'الطالب' : 'Élève'}</th>
            <th>${isAr ? 'المستوى' : 'Niveau'}</th>
            <th>${isAr ? 'الأستاذ' : 'Instituteur'}</th>
            <th style="text-align:center">${isAr ? 'الحالة' : 'Statut'}</th>
            <th>${isAr ? 'الولي + الهاتف' : 'Parent + téléphone'}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `}

    <div style="margin-top:16px;padding:12px;background:#FCEBEB;border-left:4px solid #E24B4A;border-radius:8px;font-size:11px;color:#666;line-height:1.6">
      <strong>💡 ${isAr ? 'توصية' : 'Action recommandée'} :</strong><br>
      ${isAr
        ? 'اتصل بأولياء الطلاب المصنفين 🔴 عاجل لفهم سبب الغياب وإرشادهم. الطلاب ⚪ بدون تلاوة يستحقون اهتماما خاصا.'
        : 'Contacter en priorité les parents des élèves 🔴 Urgents. Les élèves ⚪ Sans récitation n\'ont jamais valide — attention particulière recommandée.'}
    </div>

    <div class="footer">
      ${ecole?.nom || ''} · ${isAr ? 'سري — للاستخدام الداخلي' : 'Confidentiel — Usage interne'}
    </div>
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════
// RAPPORT GESTION EXAMENS — configuration des examens de l'ecole
// Liste technique des examens configures (pas les resultats = different
// de 'rapport_examens')
// ══════════════════════════════════════════════════════════════════════
function generateRapportGestionExamens(data, lang) {
  const {
    ecole,
    filtreNiveau = '',
    rows = [],   // [{nom, description, niveau_nom, niveau_couleur, type_contenu, nb_elements, score_minimum, bloquant, ordre}]
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const titre = isAr ? 'تقرير إعداد الامتحانات' : 'Configuration des examens';

  // Group by niveau pour une lecture plus lisible
  const byNiveau = {};
  rows.forEach(r => {
    const key = r.niveau_nom || '—';
    if (!byNiveau[key]) byNiveau[key] = { couleur: r.niveau_couleur, items: [] };
    byNiveau[key].items.push(r);
  });

  const sections = Object.keys(byNiveau).map(nivNom => {
    const g = byNiveau[nivNom];
    const rowsHtml = g.items
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
      .map((r, i) => `
        <tr>
          <td style="text-align:center;color:#888">${r.ordre || i+1}</td>
          <td style="font-weight:700">${r.nom || '—'}</td>
          <td style="font-size:11px;color:#666;max-width:200px">${r.description || '—'}</td>
          <td style="text-align:center;font-size:11px">
            ${r.type_contenu === 'hizb' ? (isAr ? 'حزب' : 'Hizb')
              : r.type_contenu === 'sourate' ? (isAr ? 'سورة' : 'Sourate')
              : r.type_contenu === 'ensemble' ? (isAr ? 'مجموعة' : 'Ensemble')
              : r.type_contenu || '—'}
          </td>
          <td style="text-align:center">${r.nb_elements || 0}</td>
          <td style="text-align:center;font-weight:700;color:#378ADD">${r.score_minimum || 0}%</td>
          <td style="text-align:center">
            ${r.bloquant
              ? `<span style="padding:2px 8px;border-radius:8px;background:#FCEBEB;color:#E24B4A;font-weight:700;font-size:10px">🔒 ${isAr ? 'حاجز' : 'Bloquant'}</span>`
              : `<span style="padding:2px 8px;border-radius:8px;background:#E1F5EE;color:#1D9E75;font-weight:700;font-size:10px">✓ ${isAr ? 'اختياري' : 'Optionnel'}</span>`
            }
          </td>
        </tr>
      `).join('');

    return `
      <div class="section-title" style="margin-top:20px">
        <span class="badge" style="background:${g.couleur || '#085041'}20;color:${g.couleur || '#085041'}">${nivNom}</span>
        <span style="font-size:11px;color:#888;font-weight:400">· ${g.items.length} ${isAr ? 'امتحان' : 'examen(s)'}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:50px;text-align:center">${isAr ? 'الترتيب' : 'Ordre'}</th>
            <th>${isAr ? 'اسم الامتحان' : 'Nom'}</th>
            <th>${isAr ? 'الوصف' : 'Description'}</th>
            <th style="text-align:center">${isAr ? 'النوع' : 'Type'}</th>
            <th style="text-align:center">${isAr ? 'عدد العناصر' : 'Nb éléments'}</th>
            <th style="text-align:center">${isAr ? 'النجاح' : 'Seuil'}</th>
            <th style="text-align:center">${isAr ? 'النوع' : 'Caractère'}</th>
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
        <div class="logo">📝 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre}</div>
        ${filtreNiveau ? `<div class="subtitle" style="margin-top:4px">${isAr ? 'المستوى' : 'Niveau'} : ${filtreNiveau}</div>` : ''}
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px">${rows.length} ${isAr ? 'امتحان' : 'examen(s)'}</div>
      </div>
    </div>

    ${rows.length === 0 ? `
      <div style="padding:40px;text-align:center;color:#888;font-style:italic">
        ${isAr ? 'لا توجد امتحانات محددة' : 'Aucun examen configuré'}
      </div>
    ` : sections}

    <div style="margin-top:16px;padding:12px;background:#f9f9f6;border-radius:8px;font-size:11px;color:#666;line-height:1.6">
      <strong>ℹ️ ${isAr ? 'معلومة' : 'Information'} :</strong>
      ${isAr
        ? 'الامتحانات <strong>الحاجزة</strong> يجب أن تكون ناجحة لتجاوز مرحلة. الامتحانات <strong>الاختيارية</strong> مفيدة للتقييم ولكن غير لازمة للتقدم.'
        : 'Les examens <strong>bloquants</strong> doivent être réussis pour franchir un cap. Les examens <strong>optionnels</strong> servent à l\'évaluation mais ne bloquent pas la progression.'}
    </div>

    <div class="footer">
      ${ecole?.nom || ''} · ${isAr ? 'وثيقة مرجعية' : 'Document de référence'}
    </div>
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════
// RAPPORT DIRECTION — synthèse stratégique multi-sections
// Document de reference pour conseil d'administration ou bilan direction
// ══════════════════════════════════════════════════════════════════════
function generateRapportDirection(data, lang) {
  const {
    ecole,
    periodeLabel,
    kpis = {},         // { totalEleves, elevesActifs, tauxActivite, totalTomon, totalHizb, totalCerts, totalPassages, totalSeances }
    parNiveau = [],    // [{code, nom, color, total, actifs, taux, tomon, hizb, seances}]
    parInstituteur = [], // [{nom, nbEleves, actifs, seances, tomon, moy}]
    evolution = [],    // [{label, tomon, eleves}]
    topEleves = [],    // [{rang, prenom, nom, code_niveau, niveau_couleur, points, tomon, hizb}]
  } = data || {};
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const titre = isAr ? 'تقرير الإدارة' : 'Rapport de direction';

  // Couleur d'un taux
  const tauxColor = (t) => t >= 80 ? '#1D9E75' : t >= 50 ? '#EF9F27' : '#E24B4A';
  const tauxBg = (t) => t >= 80 ? '#E1F5EE' : t >= 50 ? '#FAEEDA' : '#FCEBEB';

  // Stats par niveau : rendu
  const niveauxHtml = parNiveau.map((n, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i+1}</td>
      <td><span class="badge" style="background:${n.color}20;color:${n.color}">${n.code} — ${n.nom || ''}</span></td>
      <td style="text-align:center;font-weight:700">${n.total}</td>
      <td style="text-align:center;font-weight:700;color:#378ADD">${n.actifs}</td>
      <td style="text-align:center">
        <span style="padding:3px 10px;border-radius:10px;background:${tauxBg(n.taux)};color:${tauxColor(n.taux)};font-weight:700">${n.taux}%</span>
      </td>
      <td style="text-align:center">${n.tomon}</td>
      <td style="text-align:center">${n.hizb}</td>
      <td style="text-align:center">${n.seances}</td>
    </tr>
  `).join('');

  // Stats par instituteur
  const instHtml = parInstituteur.map((inst, i) => `
    <tr>
      <td style="text-align:center;color:#888">${i+1}</td>
      <td style="font-weight:700">${inst.nom}</td>
      <td style="text-align:center">${inst.nbEleves}</td>
      <td style="text-align:center;font-weight:700;color:#378ADD">${inst.actifs}</td>
      <td style="text-align:center;font-weight:700">${inst.seances}</td>
      <td style="text-align:center">${inst.tomon}</td>
      <td style="text-align:center;color:#EF9F27;font-weight:700">${inst.moy || 0}</td>
    </tr>
  `).join('');

  // Évolution : barres horizontales simples
  const maxTomon = Math.max(...evolution.map(e => e.tomon || 0), 1);
  const evolutionHtml = evolution.map(m => {
    const pct = Math.round((m.tomon || 0) / maxTomon * 100);
    return `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
          <span style="font-weight:700">${m.label || '—'}</span>
          <span style="color:#666">${m.tomon || 0} ${isAr ? 'ثُمن' : 'tomon'} · ${m.eleves || 0} ${isAr ? 'طالب' : 'élèves'}</span>
        </div>
        <div style="height:16px;background:#f0f0ec;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#085041,#1D9E75);border-radius:4px"></div>
        </div>
      </div>
    `;
  }).join('');

  // Top élèves : cartes compactes
  const medals = ['🥇', '🥈', '🥉'];
  const topHtml = topEleves.slice(0, 10).map((el, i) => `
    <tr ${i < 3 ? 'style="background:#FFF8E7"' : ''}>
      <td style="text-align:center;font-weight:800">${i < 3 ? medals[i] : '#' + (i+1)}</td>
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
  `).join('');

  return `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8"><title>${titre}</title>${baseStyles()}</head>
  <body>
  ${printButton(lang)}

  <!-- ═══ PAGE 1 : KPIs + ÉVOLUTION ═══ -->
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">📊 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre}${periodeLabel ? ' — ' + periodeLabel : ''}</div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${new Date().toLocaleDateString(isAr ? 'ar-MA' : 'fr-FR')}</div>
        <div style="margin-top:2px;font-weight:700;color:#085041">${isAr ? 'وثيقة تنفيذية' : 'Document exécutif'}</div>
      </div>
    </div>

    <!-- KPIs principaux -->
    <div class="section-title">${isAr ? 'المؤشرات الرئيسية' : 'Indicateurs clés'}</div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi">
        <div class="kpi-val" style="color:#378ADD">${kpis.elevesActifs || 0}<span style="font-size:14px;color:#888"> / ${kpis.totalEleves || 0}</span></div>
        <div class="kpi-lbl">${isAr ? 'طلاب نشطون' : 'Élèves actifs'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:${tauxColor(kpis.tauxActivite || 0)}">${kpis.tauxActivite || 0}%</div>
        <div class="kpi-lbl">${isAr ? 'نسبة النشاط' : 'Taux d\'activité'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#1D9E75">${kpis.totalTomon || 0}</div>
        <div class="kpi-lbl">${isAr ? 'ثُمنات محققة' : 'Tomon validés'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#EF9F27">${kpis.totalHizb || 0}</div>
        <div class="kpi-lbl">${isAr ? 'أحزاب كاملة' : 'Hizb complets'}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="kpi">
        <div class="kpi-val" style="color:#534AB7">${kpis.totalSeances || 0}</div>
        <div class="kpi-lbl">${isAr ? 'جلسات' : 'Séances'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#085041">${kpis.totalCerts || 0}</div>
        <div class="kpi-lbl">${isAr ? 'شهادات' : 'Certificats'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-val" style="color:#EF9F27">${kpis.totalPassages || 0}</div>
        <div class="kpi-lbl">${isAr ? 'اجتيازات مستوى' : 'Passages niveau'}</div>
      </div>
    </div>

    <!-- Évolution 6 mois -->
    ${evolution.length > 0 ? `
      <div class="section-title">${isAr ? 'التطور على 6 أشهر' : 'Évolution 6 derniers mois'}</div>
      <div style="padding:14px;background:#f9f9f6;border-radius:10px">
        ${evolutionHtml}
      </div>
    ` : ''}

    <div class="footer" style="margin-top:20px">
      ${ecole?.nom || ''} · ${isAr ? 'صفحة 1 من 3' : 'Page 1 / 3'}
    </div>
  </div>

  <!-- ═══ PAGE 2 : NIVEAUX + INSTITUTEURS ═══ -->
  <div class="page" style="page-break-before:always">
    <div class="header">
      <div>
        <div class="logo">📊 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre} — ${isAr ? 'أداء المستويات و المؤطرين' : 'Performance niveaux & instituteurs'}</div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${periodeLabel || ''}</div>
      </div>
    </div>

    ${parNiveau.length > 0 ? `
      <div class="section-title">${isAr ? 'التحليل حسب المستوى' : 'Analyse par niveau'}</div>
      <table>
        <thead>
          <tr>
            <th style="width:40px;text-align:center">#</th>
            <th>${isAr ? 'المستوى' : 'Niveau'}</th>
            <th style="text-align:center">${isAr ? 'العدد' : 'Total'}</th>
            <th style="text-align:center">${isAr ? 'نشط' : 'Actifs'}</th>
            <th style="text-align:center">${isAr ? 'النسبة' : 'Taux'}</th>
            <th style="text-align:center">${isAr ? 'ثُمن' : 'Tomon'}</th>
            <th style="text-align:center">${isAr ? 'حزب' : 'Hizb'}</th>
            <th style="text-align:center">${isAr ? 'جلسات' : 'Séances'}</th>
          </tr>
        </thead>
        <tbody>${niveauxHtml}</tbody>
      </table>
    ` : ''}

    ${parInstituteur.length > 0 ? `
      <div class="section-title" style="margin-top:24px">${isAr ? 'أداء المؤطرين' : 'Performance des instituteurs'}</div>
      <table>
        <thead>
          <tr>
            <th style="width:40px;text-align:center">#</th>
            <th>${isAr ? 'المؤطر' : 'Instituteur'}</th>
            <th style="text-align:center">${isAr ? 'طلاب مُتَبَنَّون' : 'Élèves réf.'}</th>
            <th style="text-align:center">${isAr ? 'نشط' : 'Actifs'}</th>
            <th style="text-align:center">${isAr ? 'جلسات' : 'Séances'}</th>
            <th style="text-align:center">${isAr ? 'ثُمن' : 'Tomon'}</th>
            <th style="text-align:center">${isAr ? 'معدل/طالب' : 'Moy/élève'}</th>
          </tr>
        </thead>
        <tbody>${instHtml}</tbody>
      </table>
    ` : ''}

    <div class="footer" style="margin-top:20px">
      ${ecole?.nom || ''} · ${isAr ? 'صفحة 2 من 3' : 'Page 2 / 3'}
    </div>
  </div>

  <!-- ═══ PAGE 3 : TOP ÉLÈVES ═══ -->
  <div class="page" style="page-break-before:always">
    <div class="header">
      <div>
        <div class="logo">📊 ${ecole?.nom || 'École'}</div>
        <div class="subtitle">${titre} — ${isAr ? 'أفضل 10 طلاب' : 'Top 10 élèves'}</div>
      </div>
      <div style="font-size:12px;color:#888;text-align:right">
        <div>${periodeLabel || ''}</div>
      </div>
    </div>

    <div class="section-title">🏆 ${isAr ? 'أفضل 10 طلاب في الفترة' : 'Top 10 des élèves sur la période'}</div>

    ${topEleves.length > 0 ? `
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
        <tbody>${topHtml}</tbody>
      </table>
    ` : `
      <div style="padding:30px;text-align:center;color:#888;font-style:italic">
        ${isAr ? 'لا يوجد طلاب نشطون لهذه الفترة' : 'Aucun élève actif sur cette période'}
      </div>
    `}

    <div style="margin-top:30px;padding:16px;background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;border-radius:12px;font-size:12px;line-height:1.8">
      <strong style="font-size:13px">💎 ${isAr ? 'ملخص الفترة' : 'Synthèse de la période'}</strong><br>
      ${isAr
        ? `خلال هذه الفترة، ${kpis.elevesActifs || 0} طالب نشط من أصل ${kpis.totalEleves || 0} (${kpis.tauxActivite || 0}%). المدرسة حققت ${kpis.totalTomon || 0} ثُمن و ${kpis.totalHizb || 0} حزب كامل، مع ${kpis.totalCerts || 0} شهادة ممنوحة و ${kpis.totalPassages || 0} اجتياز مستوى.`
        : `Sur la période, <strong>${kpis.elevesActifs || 0} élèves actifs</strong> sur ${kpis.totalEleves || 0} inscrits (<strong>${kpis.tauxActivite || 0}%</strong>). L'école a enregistré <strong>${kpis.totalTomon || 0} tomon</strong> et <strong>${kpis.totalHizb || 0} hizb complets</strong>, avec <strong>${kpis.totalCerts || 0} certificats</strong> délivrés et <strong>${kpis.totalPassages || 0} passages de niveau</strong>.`}
    </div>

    <div class="footer" style="margin-top:20px">
      ${ecole?.nom || ''} · ${isAr ? 'صفحة 3 من 3 · وثيقة سرية' : 'Page 3 / 3 · Document confidentiel'}
    </div>
  </div>
  </body></html>`;
}
