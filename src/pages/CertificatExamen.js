import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

// Génère et télécharge un certificat PDF via une API serverless
export async function genererCertificatPDF({ resultat, eleve, examen, niveau, ecole }) {
  try {
    const res = await fetch('/api/certificat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resultat, eleve, examen, niveau, ecole }),
    });
    if (!res.ok) throw new Error('Erreur serveur');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `certificat_${eleve.prenom}_${eleve.nom}_${examen.nom}.pdf`.replace(/\s+/g,'_');
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Certificat error:', err);
    return false;
  }
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
