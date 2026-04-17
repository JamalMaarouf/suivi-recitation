import React, { useState } from 'react';
import { useToast } from '../lib/toast';
import { openPDF } from '../lib/pdf';

// Génère un PDF certificat d'examen via l'API serveur
// (remplace l'ancienne implémentation jsPDF + html2canvas de ~400 Ko)
export async function genererCertificatPDF({ resultat, eleve, examen, niveau, ecole }, lang = 'fr') {
  try {
    await openPDF('certificat_examen', {
      resultat: {
        score: resultat.score,
        date_examen: resultat.date_examen,
        created_at: resultat.created_at,
        notes_examinateur: resultat.notes_examinateur,
      },
      eleve: {
        prenom: eleve.prenom,
        nom: eleve.nom,
        code_niveau: eleve.code_niveau,
      },
      examen: { nom: examen.nom },
      niveau: niveau ? { code: niveau.code, nom: niveau.nom } : null,
      ecole: { nom: ecole?.nom || '' },
    }, lang);
    return true;
  } catch (err) {
    console.error('Certificat PDF error:', err);
    return false;
  }
}

export default function BoutonCertificat({ resultat, eleves, examens, niveaux, ecole, lang = 'fr' }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!resultat || resultat.statut !== 'reussi') return null;
  const eleve = eleves.find(e => e.id === resultat.eleve_id);
  const examen = examens.find(e => e.id === resultat.examen_id);
  const niveau = niveaux.find(n => n.id === examen?.niveau_id);
  if (!eleve || !examen) return null;

  const telecharger = async () => {
    setLoading(true);
    const ok = await genererCertificatPDF({ resultat, eleve, examen, niveau, ecole }, lang);
    setLoading(false);
    if (ok) toast.success(lang === 'ar' ? '✅ تم فتح الشهادة' : '✅ Certificat ouvert');
    else toast.error(lang === 'ar' ? 'خطأ في إنشاء الشهادة' : 'Erreur génération certificat');
  };

  return (
    <button onClick={telecharger} disabled={loading}
      style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
        background: loading ? '#ccc' : '#1D9E75', color: '#fff', fontSize: 11,
        fontWeight: 600, fontFamily: 'inherit' }}>
      {loading ? '⏳' : '📄 PDF'}
    </button>
  );
}
