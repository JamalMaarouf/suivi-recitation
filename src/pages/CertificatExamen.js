import React, { useState } from 'react';
import { useToast } from '../lib/toast';
import { openPDF } from '../lib/pdf';
import { formatContenuExamen } from '../lib/helpers';
import { supabase } from '../lib/supabase';

// Génère un PDF certificat d'examen via l'API serveur
// (remplace l'ancienne implémentation jsPDF + html2canvas de ~400 Ko)
//
// B5 — Refonte template :
// - Nouveau payload "contenu" : { ar, fr } calculé via formatContenuExamen()
//   pour afficher Hizb 60 / الحزب 60 / Juz 'Amma (37 sourates) etc.
// - Header école enrichi : nom_ar + ville + pays (si disponibles en BDD)
export async function genererCertificatPDF({ resultat, eleve, examen, niveau, ecole }, lang = 'fr') {
  try {
    // B5 — Calcul du libellé Contenu en bilingue (AR + FR) côté React,
    // pour que le serveur PDF n'ait pas à requêter Supabase.
    const [contenuAr, contenuFr] = await Promise.all([
      formatContenuExamen(supabase, examen, niveau, 'ar'),
      formatContenuExamen(supabase, examen, niveau, 'fr'),
    ]);

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
      ecole: {
        nom: ecole?.nom || '',
        nom_ar: ecole?.nom_ar || '',
        ville: ecole?.ville || '',
        pays: ecole?.pays || '',
        nom_directeur: ecole?.nom_directeur || '',
        nom_directeur_ar: ecole?.nom_directeur_ar || '',
      },
      contenu: { ar: contenuAr || '', fr: contenuFr || '' },
      // B5 : le numéro vient de certificats_eleves (table dédiée + trigger BDD),
      // pas de resultats_examens. Le caller doit fetch et passer la valeur.
      numero: resultat.numero_certificat || null,
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

    // B5 — Fetch enrichi (1 seul aller-retour groupé via Promise.all)
    //   1. numéro du certificat (table certificats_eleves, lien via resultat_examen_id_source)
    //   2. infos directeur école si non fournies dans la prop ecole
    let numero = null;
    let ecoleEnrichie = ecole;
    try {
      const promises = [
        supabase.from('certificats_eleves')
          .select('numero')
          .eq('resultat_examen_id_source', resultat.id)
          .maybeSingle(),
      ];
      // Fetch directeur uniquement si pas déjà dans la prop ecole
      const needDirecteurFetch = ecole && !('nom_directeur' in ecole);
      const ecoleIdForFetch = resultat.ecole_id || eleve.ecole_id;
      if (needDirecteurFetch && ecoleIdForFetch) {
        promises.push(
          supabase.from('ecoles')
            .select('nom_directeur,nom_directeur_ar')
            .eq('id', ecoleIdForFetch)
            .maybeSingle()
        );
      }
      const results = await Promise.all(promises);
      numero = results[0]?.data?.numero || null;
      if (needDirecteurFetch && results[1]?.data) {
        ecoleEnrichie = { ...ecole, ...results[1].data };
      }
    } catch (err) {
      // On continue sans le numero/directeur plutôt que de bloquer la génération
      console.warn('[Certificat] fetch enrichi partiel:', err);
    }

    // Injecter le numero dans le resultat pour que genererCertificatPDF le voie
    const resultatEnrichi = { ...resultat, numero_certificat: numero };

    const ok = await genererCertificatPDF({ resultat: resultatEnrichi, eleve, examen, niveau, ecole: ecoleEnrichie }, lang);
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
