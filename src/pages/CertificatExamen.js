import React, { useState } from 'react';
import { useToast } from '../lib/toast';

// Génère un PDF en capturant un HTML rendu (supporte l'arabe)
export async function genererCertificatPDF({ resultat, eleve, examen, niveau, ecole }) {
  try {
    const jspdfModule    = await import('jspdf');
    const h2cModule      = await import('html2canvas');
    const jsPDF          = jspdfModule.jsPDF || jspdfModule.default?.jsPDF || jspdfModule.default;
    const html2canvasFn  = h2cModule.default || h2cModule;

    const date = new Date(resultat.date_examen || resultat.created_at)
      .toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    const ecolNom   = ecole?.nom || 'École Coranique';
    const niveauNom = niveau ? `${niveau.code} — ${niveau.nom}` : (eleve.code_niveau || '');
    const score     = resultat.score;
    const scoreColor = score >= 90 ? '#1D9E75' : score >= 70 ? '#378ADD' : '#EF9F27';

    // Créer un div caché avec le certificat HTML
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1122px;height:794px;z-index:-1;';
    container.innerHTML = `
      <div id="cert-render" style="
        width:1122px; height:794px; background:#fff;
        font-family:'Tajawal',Arial,sans-serif;
        border:6px solid #1D9E75; border-radius:0; position:relative;
        padding:0; overflow:hidden; box-sizing:border-box;
      ">
        <!-- Bordure intérieure -->
        <div style="position:absolute;inset:12px;border:1.5px solid #1D9E7560;pointer-events:none;"></div>

        <!-- Fond décoratif -->
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,#f9fff9 0%,#fff 50%,#f0f8f0 100%);"></div>

        <!-- Contenu -->
        <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:30px 60px;">

          <!-- Header -->
          <div style="text-align:center;border-bottom:2px solid #1D9E75;width:100%;padding-bottom:16px;">
            <div style="font-size:14px;color:#888;font-weight:600;margin-bottom:4px;">${ecolNom}</div>
            <div style="font-size:38px;font-weight:800;color:#085041;direction:rtl;font-family:'Tajawal',Arial;">شهادة نجاح</div>
            <div style="font-size:12px;color:#aaa;letter-spacing:3px;font-weight:600;">CERTIFICAT DE RÉUSSITE</div>
          </div>

          <!-- Corps -->
          <div style="text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
            <div style="font-size:60px;line-height:1;">🏅</div>

            <div style="font-size:16px;color:#666;direction:rtl;font-family:'Tajawal',Arial;">
              يُشهد بأن الطالب / الطالبة
            </div>

            <div style="font-size:34px;font-weight:800;color:#085041;direction:rtl;font-family:'Tajawal',Arial;
              border-bottom:2px solid #1D9E75;padding-bottom:4px;">
              ${eleve.prenom} ${eleve.nom}
            </div>

            <div style="font-size:16px;color:#666;direction:rtl;font-family:'Tajawal',Arial;">
              قد اجتاز بنجاح امتحان
            </div>

            <div style="font-size:22px;font-weight:700;color:#1D9E75;
              border:2px solid #1D9E75;border-radius:10px;
              padding:6px 24px;background:#E1F5EE;
              direction:rtl;font-family:'Tajawal',Arial;">
              ${examen.nom}
            </div>
          </div>

          <!-- Détails -->
          <div style="width:100%;background:#f9f9f6;border-radius:12px;padding:14px 24px;
            display:flex;justify-content:space-around;align-items:center;margin:10px 0;">
            <div style="text-align:center;">
              <div style="font-size:10px;color:#aaa;letter-spacing:1px;text-transform:uppercase;direction:rtl;font-family:'Tajawal',Arial;">المستوى · Niveau</div>
              <div style="font-size:16px;font-weight:700;color:#1a1a1a;">${niveauNom}</div>
            </div>
            <div style="width:1px;height:40px;background:#e0e0d8;"></div>
            <div style="text-align:center;">
              <div style="font-size:10px;color:#aaa;letter-spacing:1px;text-transform:uppercase;direction:rtl;font-family:'Tajawal',Arial;">النقاط · Score</div>
              <div style="font-size:32px;font-weight:800;color:${scoreColor};">${score}%</div>
            </div>
            <div style="width:1px;height:40px;background:#e0e0d8;"></div>
            <div style="text-align:center;">
              <div style="font-size:10px;color:#aaa;letter-spacing:1px;text-transform:uppercase;direction:rtl;font-family:'Tajawal',Arial;">التاريخ · Date</div>
              <div style="font-size:16px;font-weight:700;color:#1a1a1a;">${date}</div>
            </div>
          </div>

          ${resultat.notes_examinateur ? `
          <div style="font-style:italic;color:#888;font-size:13px;text-align:center;font-family:'Tajawal',Arial;direction:rtl;">
            "${resultat.notes_examinateur}"
          </div>` : ''}

          <!-- Footer -->
          <div style="width:100%;display:flex;justify-content:space-between;align-items:flex-end;padding-top:10px;border-top:1px solid #e0e0d8;">
            <div style="font-size:12px;color:#aaa;direction:rtl;font-family:'Tajawal',Arial;">
              أصدر بتاريخ: ${date}
            </div>
            <div style="text-align:center;">
              <div style="width:200px;border-bottom:1.5px solid #333;margin-bottom:6px;"></div>
              <div style="font-size:11px;color:#666;direction:rtl;font-family:'Tajawal',Arial;">
                توقيع المشرف العام · Signature du Surveillant
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    // Attendre que la police se charge
    await document.fonts.ready;

    // Capturer en image
    const canvas = await html2canvasFn(container.querySelector('#cert-render'), {
      scale: 2,
      useCORS: true,
      backgroundColor: '#fff',
      width: 1122,
      height: 794,
    });

    document.body.removeChild(container);

    // Convertir en PDF A4 paysage
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    doc.addImage(imgData, 'JPEG', 0, 0, 297, 210);

    const filename = `certificat_${eleve.prenom}_${eleve.nom}_${examen.nom}`
      .replace(/\s+/g,'_').replace(/[^\w-]/g,'') + '.pdf';
    doc.save(filename);
    return true;

  } catch (err) {
    console.error('Certificat PDF error:', err);
    return false;
  }
}

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
    if (ok) toast.success(lang==='ar'?'✅ تم تنزيل الشهادة PDF':'✅ Certificat PDF téléchargé !');
    else    toast.error(lang==='ar'?'خطأ في إنشاء الشهادة':'Erreur génération certificat');
  };

  return (
    <button onClick={telecharger} disabled={loading}
      style={{padding:'4px 10px',borderRadius:20,border:'none',cursor:'pointer',
        background:loading?'#ccc':'#1D9E75',color:'#fff',fontSize:11,
        fontWeight:600,fontFamily:'inherit'}}>
      {loading?'⏳':'📄 PDF'}
    </button>
  );
}
