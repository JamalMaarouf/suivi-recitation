// API Vercel serverless — génération certificat PDF
// Utilise une approche HTML→PDF via jsPDF côté client ou reportlab côté serveur

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { resultat, eleve, examen, niveau, ecole } = req.body;

  try {
    // Générer le PDF avec du HTML/CSS converti
    const html = buildCertificatHTML({ resultat, eleve, examen, niveau, ecole });

    // Retourner le HTML pour impression côté client
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition',
      `inline; filename="certificat_${eleve.prenom}_${eleve.nom}.html"`);
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

function buildCertificatHTML({ resultat, eleve, examen, niveau, ecole }) {
  const date = new Date(resultat.date_examen || resultat.created_at)
    .toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });

  const scoreColor = resultat.score >= 90 ? '#1D9E75' : resultat.score >= 70 ? '#378ADD' : '#EF9F27';
  const niveauNom  = niveau ? `${niveau.code} — ${niveau.nom}` : (eleve.code_niveau || '');
  const ecolNom    = ecole?.nom || 'École Coranique';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>شهادة نجاح — ${eleve.prenom} ${eleve.nom}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Tajawal', Arial, sans-serif;
    background: #f5f0e8;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 20px;
  }
  .cert {
    background: #fff;
    width: 794px; min-height: 560px;
    border: 3px solid #1D9E75;
    border-radius: 16px;
    padding: 40px 50px;
    position: relative;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  }
  .cert::before {
    content: '';
    position: absolute; inset: 8px;
    border: 1.5px solid #1D9E7540;
    border-radius: 12px;
    pointer-events: none;
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #1D9E75;
    padding-bottom: 20px;
    margin-bottom: 24px;
  }
  .ecole-nom { font-size: 15px; color: #666; font-weight: 600; margin-bottom: 6px; }
  .title-ar {
    font-size: 32px; font-weight: 800;
    color: #085041;
    margin-bottom: 4px;
  }
  .title-fr { font-size: 14px; color: #888; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }

  .medaille { font-size: 56px; text-align: center; margin: 20px 0 16px; }

  .texte-principal {
    text-align: center;
    font-size: 16px; color: #444;
    line-height: 1.8;
    margin-bottom: 24px;
  }
  .nom-eleve {
    display: block;
    font-size: 28px; font-weight: 800;
    color: #085041;
    margin: 8px 0;
  }
  .examen-nom {
    display: inline-block;
    font-size: 20px; font-weight: 700;
    color: #1D9E75;
    padding: 4px 16px;
    border: 2px solid #1D9E75;
    border-radius: 8px;
    margin: 8px 0;
  }

  .details {
    display: flex;
    justify-content: space-around;
    margin: 24px 0;
    padding: 16px;
    background: #f9f9f6;
    border-radius: 12px;
  }
  .detail-item { text-align: center; }
  .detail-label { font-size: 11px; color: #999; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .detail-value { font-size: 18px; font-weight: 700; color: #1a1a1a; }
  .score-value { font-size: 28px; font-weight: 800; color: ${scoreColor}; }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid #e0e0d8;
  }
  .date { font-size: 13px; color: #888; }
  .signature { text-align: center; }
  .sig-line { width: 160px; border-bottom: 1.5px solid #333; margin-bottom: 6px; }
  .sig-label { font-size: 12px; color: #666; }

  .decorations {
    position: absolute;
    top: 16px; left: 16px; right: 16px;
    display: flex; justify-content: space-between;
    font-size: 20px; opacity: 0.3;
    pointer-events: none;
  }

  @media print {
    body { background: none; padding: 0; }
    .cert { box-shadow: none; border-radius: 0; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>
<div class="cert">
  <div class="decorations">
    <span>🌿</span>
    <span>🌿</span>
  </div>

  <div class="header">
    <div class="ecole-nom">${ecolNom}</div>
    <div class="title-ar">شهادة نجاح</div>
    <div class="title-fr">Certificat de Réussite</div>
  </div>

  <div class="medaille">🏅</div>

  <div class="texte-principal">
    يُشهد بأن الطالب/الطالبة
    <span class="nom-eleve">${eleve.prenom} ${eleve.nom}</span>
    قد اجتاز بنجاح امتحان
    <br>
    <span class="examen-nom">${examen.nom}</span>
  </div>

  <div class="details">
    <div class="detail-item">
      <div class="detail-label">المستوى · Niveau</div>
      <div class="detail-value">${niveauNom}</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">النقاط · Score</div>
      <div class="score-value">${resultat.score}%</div>
    </div>
    <div class="detail-item">
      <div class="detail-label">التاريخ · Date</div>
      <div class="detail-value">${date}</div>
    </div>
  </div>

  ${resultat.notes_examinateur ? `
  <div style="text-align:center; font-style:italic; color:#666; font-size:13px; margin-bottom:16px;">
    "${resultat.notes_examinateur}"
  </div>` : ''}

  <div class="footer">
    <div class="date">أصدر بتاريخ: ${date}</div>
    <div class="signature">
      <div class="sig-line"></div>
      <div class="sig-label">توقيع المشرف العام · Signature du Surveillant</div>
    </div>
  </div>
</div>

<div style="text-align:center; margin-top:20px;" class="print-btn">
  <button onclick="window.print()" style="padding:12px 28px; background:#1D9E75; color:#fff; border:none; border-radius:10px; font-size:15px; cursor:pointer; font-family:'Tajawal',Arial;">
    🖨️ طباعة الشهادة · Imprimer
  </button>
</div>

</body>
</html>`;
}
