import React, { useState } from 'react';
import { useToast } from '../lib/toast';

// Génère un vrai PDF téléchargeable via jsPDF (chargé dynamiquement)
export async function genererCertificatPDF({ resultat, eleve, examen, niveau, ecole }) {
  try {
    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const W = 297, H = 210; // A4 paysage

    const date = new Date(resultat.date_examen || resultat.created_at)
      .toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    const ecolNom   = ecole?.nom || 'École Coranique';
    const niveauNom = niveau ? `${niveau.code} — ${niveau.nom}` : (eleve.code_niveau || '');
    const score     = resultat.score;
    const scoreColor = score >= 90 ? [29,158,117] : score >= 70 ? [55,138,221] : [239,159,39];

    // ── Fond ──
    doc.setFillColor(245, 240, 232);
    doc.rect(0, 0, W, H, 'F');

    // ── Bordure extérieure ──
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(3);
    doc.rect(6, 6, W-12, H-12);

    // ── Bordure intérieure ──
    doc.setLineWidth(0.8);
    doc.setDrawColor(29, 158, 117, 0.4);
    doc.rect(10, 10, W-20, H-20);

    // ── En-tête ──
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(15, 14, W-30, 32, 4, 4, 'F');

    // Nom école
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(11);
    doc.text(ecolNom, W/2, 22, { align:'center' });

    // Titre arabe
    doc.setTextColor(8, 80, 65);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('شهادة نجاح', W/2, 33, { align:'center' });

    // Titre français
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('CERTIFICAT DE RÉUSSITE', W/2, 40, { align:'center' });

    // ── Médaille ──
    doc.setFontSize(28);
    doc.text('🏅', W/2, 60, { align:'center' });

    // ── Texte principal ──
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(13);
    doc.setFont(undefined, 'normal');
    doc.text('يُشهد بأن الطالب / الطالبة', W/2, 74, { align:'center' });

    // Nom élève
    doc.setTextColor(8, 80, 65);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(`${eleve.prenom} ${eleve.nom}`, W/2, 86, { align:'center' });

    // Ligne décorative sous le nom
    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(1);
    const nomWidth = doc.getTextWidth(`${eleve.prenom} ${eleve.nom}`);
    doc.line(W/2 - nomWidth/2, 88, W/2 + nomWidth/2, 88);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(13);
    doc.setFont(undefined, 'normal');
    doc.text('قد اجتاز بنجاح امتحان', W/2, 97, { align:'center' });

    // Nom examen dans un encadré
    doc.setDrawColor(29, 158, 117);
    doc.setFillColor(225, 245, 238);
    doc.setLineWidth(1);
    const examWidth = Math.max(60, doc.getTextWidth(examen.nom) + 16);
    doc.roundedRect(W/2 - examWidth/2, 100, examWidth, 12, 3, 3, 'FD');
    doc.setTextColor(8, 80, 65);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(examen.nom, W/2, 108, { align:'center' });

    // ── Détails (3 colonnes) ──
    doc.setFillColor(249, 249, 246);
    doc.roundedRect(20, 120, W-40, 26, 4, 4, 'F');

    // Col 1 — Niveau
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('المستوى · NIVEAU', 65, 128, { align:'center' });
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(niveauNom, 65, 137, { align:'center' });

    // Col 2 — Score
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('النقاط · SCORE', W/2, 128, { align:'center' });
    doc.setTextColor(...scoreColor);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`${score}%`, W/2, 138, { align:'center' });

    // Col 3 — Date
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('التاريخ · DATE', W-65, 128, { align:'center' });
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(date, W-65, 137, { align:'center' });

    // ── Observations ──
    if (resultat.notes_examinateur) {
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      doc.text(`"${resultat.notes_examinateur}"`, W/2, 153, { align:'center' });
    }

    // ── Signature ──
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.5);
    doc.line(W-90, 170, W-30, 170);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('توقيع المشرف العام · Signature du Surveillant', W-60, 175, { align:'center' });

    // Date émission
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(8);
    doc.text(`أصدر بتاريخ: ${date}`, 30, 175);

    // ── Sauvegarder ──
    const filename = `certificat_${eleve.prenom}_${eleve.nom}_${examen.nom}`
      .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') + '.pdf';
    doc.save(filename);
    return true;

  } catch (err) {
    console.error('Certificat PDF error:', err);
    return false;
  }
}

// Bouton de téléchargement du certificat
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
      {loading?'...':'📄 PDF'}
    </button>
  );
}
