import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

// Génère et ouvre le certificat dans un nouvel onglet
export async function genererCertificatPDF({ resultat, eleve, examen, niveau, ecole }) {
  try {
    const res = await fetch('/api/certificat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultat, eleve, examen, niveau, ecole }),
    });
    if (!res.ok) throw new Error('Erreur serveur ' + res.status);
    const html = await res.text();
    // Ouvrir dans un nouvel onglet pour impression
    const win = window.open('', '_blank');
    if (!win) throw new Error('Popups bloqués — autorisez les popups pour ce site');
    win.document.write(html);
    win.document.close();
    return true;
  } catch (err) {
    console.error('Certificat error:', err);
    // Fallback : générer le HTML directement sans API
    try {
      const html = buildCertificatHTMLClient({ resultat, eleve, examen, niveau, ecole });
      const win = window.open('', '_blank');
      if (!win) { alert('Autorisez les popups pour générer le certificat'); return false; }
      win.document.write(html);
      win.document.close();
      return true;
    } catch(e) {
      return false;
    }
  }
}

// Génération côté client (fallback si API indisponible)
function buildCertificatHTMLClient({ resultat, eleve, examen, niveau, ecole }) {
  const date = new Date(resultat.date_examen || resultat.created_at)
    .toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  const scoreColor = resultat.score >= 90 ? '#1D9E75' : resultat.score >= 70 ? '#378ADD' : '#EF9F27';
  const niveauNom  = niveau ? niveau.code + ' — ' + niveau.nom : (eleve.code_niveau || '');
  const ecolNom    = ecole?.nom || 'École Coranique';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>شهادة نجاح — ${eleve.prenom} ${eleve.nom}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Tajawal',Arial,sans-serif;background:#f5f0e8;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .cert{background:#fff;width:794px;min-height:560px;border:3px solid #1D9E75;border-radius:16px;padding:40px 50px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.12)}
  .cert::before{content:'';position:absolute;inset:8px;border:1.5px solid #1D9E7540;border-radius:12px;pointer-events:none}
  .header{text-align:center;border-bottom:2px solid #1D9E75;padding-bottom:20px;margin-bottom:24px}
  .ecole-nom{font-size:15px;color:#666;font-weight:600;margin-bottom:6px}
  .title-ar{font-size:32px;font-weight:800;color:#085041;margin-bottom:4px}
  .title-fr{font-size:14px;color:#888;font-weight:600;letter-spacing:2px;text-transform:uppercase}
  .medaille{font-size:56px;text-align:center;margin:20px 0 16px}
  .texte-principal{text-align:center;font-size:16px;color:#444;line-height:1.8;margin-bottom:24px}
  .nom-eleve{display:block;font-size:28px;font-weight:800;color:#085041;margin:8px 0}
  .examen-nom{display:inline-block;font-size:20px;font-weight:700;color:#1D9E75;padding:4px 16px;border:2px solid #1D9E75;border-radius:8px;margin:8px 0}
  .details{display:flex;justify-content:space-around;margin:24px 0;padding:16px;background:#f9f9f6;border-radius:12px}
  .detail-label{font-size:11px;color:#999;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px}
  .detail-value{font-size:18px;font-weight:700;color:#1a1a1a}
  .score-value{font-size:28px;font-weight:800;color:${scoreColor}}
  .footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:32px;padding-top:20px;border-top:1px solid #e0e0d8}
  .sig-line{width:160px;border-bottom:1.5px solid #333;margin-bottom:6px}
  .sig-label{font-size:12px;color:#666}
  @media print{body{background:none;padding:0}.cert{box-shadow:none;border-radius:0}.print-btn{display:none}}
</style>
</head>
<body>
<div class="cert">
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
    <br><span class="examen-nom">${examen.nom}</span>
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
  ${resultat.notes_examinateur ? '<div style="text-align:center;font-style:italic;color:#666;font-size:13px;margin-bottom:16px;">"' + resultat.notes_examinateur + '"</div>' : ''}
  <div class="footer">
    <div style="font-size:13px;color:#888">أصدر بتاريخ: ${date}</div>
    <div class="signature">
      <div class="sig-line"></div>
      <div class="sig-label">توقيع المشرف العام · Signature</div>
    </div>
  </div>
</div>
<div style="text-align:center;margin-top:20px" class="print-btn">
  <button onclick="window.print()" style="padding:12px 28px;background:#1D9E75;color:#fff;border:none;border-radius:10px;font-size:15px;cursor:pointer;font-family:'Tajawal',Arial">
    🖨️ طباعة الشهادة · Imprimer
  </button>
</div>
</body></html>`;
}

// Bouton de téléchargement du certificat (utilisé dans ResultatsExamens)
export default function BoutonCertificat({ resultat, eleves, examens, niveaux, ecole, lang='fr' }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!resultat || resultat.statut !== 'reussi') return null;

  const eleve  = eleves.find(e => e.id === resultat.eleve_id);
  const examen = examens.find(e => e.id === resultat.examen_id);
  const niveau = niveaux.find(n => n.id === examen?.niveau_id);
  if (!eleve || !examen) return null;

  const telecharger = async () => {
    setLoading(true);
    const ok = await genererCertificatPDF({ resultat, eleve, examen, niveau, ecole });
    setLoading(false);
    if (ok) toast.success(lang==='ar'?'✅ تم تنزيل الشهادة':'✅ Certificat téléchargé !');
    else    toast.error(lang==='ar'?'خطأ في إنشاء الشهادة':'Erreur lors de la génération');
  };

  return (
    <button onClick={telecharger} disabled={loading}
      style={{padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',
        background:loading?'#ccc':'#1D9E75',color:'#fff',fontSize:11,
        fontWeight:600,fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
      {loading?'...':'📄'} {lang==='ar'?'شهادة':'Certificat'}
    </button>
  );
}
