// ═══════════════════════════════════════════════════════════════════════════
// PageVerification — Page publique de vérification d'un certificat
// ═══════════════════════════════════════════════════════════════════════════
//
// Accessible via URL : /verify/:numero (ex: /verify/2026%2F0006)
// Aucun login requis. La page :
//   1. Décode le numéro depuis l'URL
//   2. Fetch le certificat depuis Supabase (avec ses relations)
//   3. Affiche soit la confirmation soit un message d'erreur
//   4. Permet de re-télécharger le PDF
//
// Sécurité : pas d'infos sensibles affichées (téléphone parent, notes
// internes, ID parents, etc.). Juste les infos publiques du certificat.
//
// Note : ce composant est monté AVANT le gating d'authentification dans
// App.js, ce qui le rend accessible aux utilisateurs anonymes.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { openPDF } from '../lib/pdf';

export default function PageVerification({ numero, lang = 'fr', setLang }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const isAr = lang === 'ar';

  useEffect(() => {
    let active = true;
    const fetchCertificat = async () => {
      if (!numero) {
        setError('NO_NUMERO');
        setLoading(false);
        return;
      }
      try {
        // Fetch certificat par numero
        const { data: cert, error: certErr } = await supabase
          .from('certificats_eleves')
          .select('id, numero, type_certificat, date_emission, titre, description, eleve_id, ecole_id, jalon_id, examen_id_source, resultat_examen_id_source')
          .eq('numero', numero)
          .maybeSingle();

        if (!active) return;

        if (certErr || !cert) {
          setError('NOT_FOUND');
          setLoading(false);
          return;
        }

        // Fetch parallele : eleve + ecole + (jalon ou examen + resultat)
        const promises = [
          supabase.from('eleves').select('id, prenom, nom, code_niveau').eq('id', cert.eleve_id).maybeSingle(),
          supabase.from('ecoles').select('id, nom, nom_ar, ville, pays, nom_directeur, nom_directeur_ar').eq('id', cert.ecole_id).maybeSingle(),
        ];
        if (cert.jalon_id) {
          promises.push(supabase.from('jalons').select('id, nom, nom_ar').eq('id', cert.jalon_id).maybeSingle());
        }
        if (cert.examen_id_source) {
          promises.push(supabase.from('examens').select('id, nom').eq('id', cert.examen_id_source).maybeSingle());
        }
        if (cert.resultat_examen_id_source) {
          promises.push(supabase.from('resultats_examens').select('id, score, date_examen, notes_examinateur').eq('id', cert.resultat_examen_id_source).maybeSingle());
        }

        const results = await Promise.all(promises);
        if (!active) return;

        const eleve = results[0]?.data;
        const ecole = results[1]?.data;
        let jalon = null, examen = null, resultat = null;
        let idx = 2;
        if (cert.jalon_id) { jalon = results[idx]?.data; idx++; }
        if (cert.examen_id_source) { examen = results[idx]?.data; idx++; }
        if (cert.resultat_examen_id_source) { resultat = results[idx]?.data; idx++; }

        // Fetch niveau si on a un eleve avec code_niveau
        let niveau = null;
        if (eleve?.code_niveau && cert.ecole_id) {
          const { data: niv } = await supabase
            .from('niveaux').select('id, code, nom').eq('ecole_id', cert.ecole_id).eq('code', eleve.code_niveau).maybeSingle();
          niveau = niv;
        }

        setData({ cert, eleve, ecole, jalon, examen, resultat, niveau });
        setLoading(false);
      } catch (err) {
        if (!active) return;
        console.error('[PageVerification] fetch error:', err);
        setError('FETCH_ERROR');
        setLoading(false);
      }
    };
    fetchCertificat();
    return () => { active = false; };
  }, [numero]);

  const handleDownloadPDF = async () => {
    if (!data || downloading) return;
    setDownloading(true);
    try {
      const { cert, eleve, ecole, jalon, examen, resultat, niveau } = data;
      const isExamen = !!cert.resultat_examen_id_source;
      if (isExamen && examen && resultat) {
        // Pour les certificats d'examen, on a besoin du contenu calculé
        // Ici on simplifie : on passe directement l'API examen sans contenu
        // (sera affiché sans la zone "CONTENU" - acceptable pour la vérif)
        await openPDF('certificat_examen', {
          resultat: {
            score: resultat.score,
            date_examen: resultat.date_examen,
            created_at: cert.date_emission,
            notes_examinateur: resultat.notes_examinateur,
          },
          eleve: { prenom: eleve?.prenom || '', nom: eleve?.nom || '', code_niveau: eleve?.code_niveau || '' },
          examen: { nom: examen.nom || cert.titre },
          niveau: niveau ? { code: niveau.code, nom: niveau.nom } : null,
          ecole: {
            nom: ecole?.nom || '', nom_ar: ecole?.nom_ar || '',
            ville: ecole?.ville || '', pays: ecole?.pays || '',
            nom_directeur: ecole?.nom_directeur || '', nom_directeur_ar: ecole?.nom_directeur_ar || '',
          },
          contenu: { ar: '', fr: '' },
          numero: cert.numero,
        }, lang);
      } else {
        // Certificat de jalon
        await openPDF('certificat', {
          eleve: { prenom: eleve?.prenom || '', nom: eleve?.nom || '', code_niveau: eleve?.code_niveau || '' },
          jalon: jalon ? { nom: jalon.nom, nom_ar: jalon.nom_ar } : { nom: cert.titre, nom_ar: cert.description },
          date: cert.date_emission,
          ecole: {
            nom: ecole?.nom || '', nom_ar: ecole?.nom_ar || '',
            ville: ecole?.ville || '', pays: ecole?.pays || '',
            nom_directeur: ecole?.nom_directeur || '', nom_directeur_ar: ecole?.nom_directeur_ar || '',
          },
          niveau: niveau ? { code: niveau.code, nom: niveau.nom } : null,
          numero: cert.numero,
        }, lang);
      }
    } catch (err) {
      console.error('[PageVerification] download error:', err);
      alert(isAr ? 'خطأ في تحميل الشهادة' : 'Erreur lors du téléchargement');
    }
    setDownloading(false);
  };

  // ─── STYLES PARTAGÉS ───
  const pageStyle = {
    minHeight: '100vh', background: '#f5f5f0',
    fontFamily: "'Tajawal', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '20px 16px 40px', direction: isAr ? 'rtl' : 'ltr',
  };
  const cardStyle = {
    background: '#fff', borderRadius: 18, maxWidth: 560, width: '100%',
    boxShadow: '0 8px 30px rgba(8, 80, 65, 0.08)',
    overflow: 'hidden',
  };

  // ─── LANG SWITCHER (en haut) ───
  const langSwitcher = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
      {[{ c: 'fr', l: 'FR' }, { c: 'ar', l: 'AR' }].map(o => (
        <button key={o.c} onClick={() => setLang && setLang(o.c)}
          style={{
            padding: '5px 12px', border: `1.5px solid ${lang === o.c ? '#1D9E75' : '#e0e0d8'}`,
            borderRadius: 8, background: lang === o.c ? '#E1F5EE' : '#fff',
            fontSize: 12, fontWeight: lang === o.c ? 700 : 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          {o.l}
        </button>
      ))}
    </div>
  );

  // ─── ÉTAT : LOADING ───
  if (loading) {
    return (
      <div style={pageStyle}>
        {langSwitcher}
        <div style={cardStyle}>
          <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 14 }}>
              {isAr ? 'جاري التحقق...' : 'Vérification en cours...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── ÉTAT : NON TROUVÉ ou ERREUR ───
  if (error || !data) {
    const errorMessages = {
      NOT_FOUND: { fr: "Aucun certificat ne correspond à ce numéro", ar: 'لا توجد شهادة بهذا الرقم' },
      NO_NUMERO: { fr: "Numéro de certificat manquant dans l'URL", ar: 'رقم الشهادة مفقود' },
      FETCH_ERROR: { fr: "Erreur lors de la vérification", ar: 'خطأ في التحقق' },
    };
    const msg = errorMessages[error] || errorMessages.NOT_FOUND;
    return (
      <div style={pageStyle}>
        {langSwitcher}
        <div style={cardStyle}>
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E24B4A', marginBottom: 12 }}>
              {isAr ? 'شهادة غير موجودة' : 'Certificat introuvable'}
            </h1>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5 }}>
              {isAr ? msg.ar : msg.fr}
            </p>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 24, fontFamily: 'monospace' }}>
              N° : {numero || '—'}
            </div>
          </div>
          <div style={{ background: '#f9f9f6', padding: '16px 24px', borderTop: '1px solid #e0e0d8',
            fontSize: 12, color: '#888', textAlign: 'center' }}>
            {isAr
              ? 'إذا كنت تعتقد أن هذا الرقم صحيح، تواصل مع المدرسة المُصدِرة.'
              : "Si vous pensez que ce numéro est correct, contactez l'école émettrice."}
          </div>
        </div>
      </div>
    );
  }

  // ─── ÉTAT : SUCCESS ───
  const { cert, eleve, ecole, jalon, examen, resultat, niveau } = data;
  const isExamen = !!cert.resultat_examen_id_source;
  const dateEmis = new Date(cert.date_emission || new Date()).toLocaleDateString(
    isAr ? 'ar-MA' : 'fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Nom école avec préfixe intelligent (même logique que api/pdf.js)
  const PREFIXE_AR = 'المدرسة القرآنية';
  const rawNomAr = ecole?.nom_ar || ecole?.nom || '';
  let nomEcoleAr;
  if (!rawNomAr) nomEcoleAr = 'مدرسة قرآنية';
  else if (rawNomAr.includes('مدرسة') || rawNomAr.includes('المدرسة')) nomEcoleAr = rawNomAr;
  else nomEcoleAr = `${PREFIXE_AR} ${rawNomAr}`;

  const titreCertif = isExamen ? (examen?.nom || cert.titre) : (jalon?.nom_ar || jalon?.nom || cert.titre);
  const score = resultat?.score;
  const scoreColor = score >= 90 ? '#1D9E75' : score >= 70 ? '#378ADD' : '#EF9F27';
  const scoreBg = score >= 90 ? '#E1F5EE' : score >= 70 ? '#E6F1FB' : '#FAEEDA';

  const rowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 0', borderBottom: '1px solid #f0f0ec', gap: 12,
  };
  const labelStyle = { fontSize: 12, color: '#888', fontWeight: 600, letterSpacing: 0.3 };
  const valueStyle = { fontSize: 15, color: '#1a1a1a', fontWeight: 600, textAlign: isAr ? 'left' : 'right' };

  return (
    <div style={pageStyle}>
      {langSwitcher}

      <div style={cardStyle}>
        {/* ─── BANNIÈRE SUCCESS ─── */}
        <div style={{
          background: 'linear-gradient(135deg, #085041 0%, #1D9E75 100%)',
          padding: '28px 24px', textAlign: 'center', color: '#fff',
        }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, fontFamily: "'Amiri', serif" }}>
            {isAr ? 'شهادة موثقة' : 'Certificat authentique'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, letterSpacing: 0.5 }}>
            {isAr
              ? 'تم التحقق من صحة هذه الشهادة'
              : 'Ce certificat a été vérifié avec succès'}
          </div>
        </div>

        {/* ─── DÉTAILS ─── */}
        <div style={{ padding: '8px 24px 24px' }}>
          {/* Nom élève (en gros) */}
          <div style={{ textAlign: 'center', padding: '18px 0 14px', borderBottom: '1.5px solid #e0e0d8' }}>
            <div style={{ fontSize: 11, color: '#888', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>
              {isAr ? 'الطالب' : 'ÉLÈVE'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#085041', direction: 'rtl' }}>
              {eleve ? `${eleve.prenom} ${eleve.nom}` : '—'}
            </div>
          </div>

          {/* Titre certif */}
          <div style={rowStyle}>
            <div style={labelStyle}>
              {isExamen ? (isAr ? 'الامتحان' : 'EXAMEN') : (isAr ? 'الشهادة' : 'CERTIFICAT')}
            </div>
            <div style={valueStyle}>{titreCertif || '—'}</div>
          </div>

          {/* Niveau */}
          {(niveau || eleve?.code_niveau) && (
            <div style={rowStyle}>
              <div style={labelStyle}>{isAr ? 'المستوى' : 'NIVEAU'}</div>
              <div style={valueStyle}>
                {niveau ? `${niveau.nom} (${niveau.code})` : eleve.code_niveau}
              </div>
            </div>
          )}

          {/* Score (uniquement examens) */}
          {isExamen && score !== undefined && score !== null && (
            <div style={rowStyle}>
              <div style={labelStyle}>{isAr ? 'النتيجة' : 'SCORE'}</div>
              <div style={{
                background: scoreBg, color: scoreColor,
                border: `2px solid ${scoreColor}`,
                width: 56, height: 56, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 17,
              }}>
                {score}%
              </div>
            </div>
          )}

          {/* Date émission */}
          <div style={rowStyle}>
            <div style={labelStyle}>{isAr ? 'تاريخ الإصدار' : 'DATE D\'ÉMISSION'}</div>
            <div style={valueStyle}>{dateEmis}</div>
          </div>

          {/* École */}
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <div style={labelStyle}>{isAr ? 'المدرسة' : 'ÉCOLE'}</div>
            <div style={{ ...valueStyle, direction: 'rtl', maxWidth: '60%' }}>
              {nomEcoleAr}
              {ecole?.ville && <div style={{ fontSize: 11, color: '#888', fontWeight: 500, marginTop: 2 }}>
                {ecole.ville}{ecole.pays ? `, ${ecole.pays}` : ''}
              </div>}
            </div>
          </div>

          {/* Numéro certif (pied) */}
          <div style={{
            marginTop: 18, padding: '12px 16px', background: '#f9f9f6',
            borderRadius: 10, textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: '#aaa', letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>
              {isAr ? 'رقم الشهادة' : 'NUMÉRO DE CERTIFICAT'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#085041', fontFamily: 'monospace' }}>
              {cert.numero}
            </div>
          </div>

          {/* Bouton télécharger PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            style={{
              width: '100%', padding: 14, marginTop: 18,
              background: downloading ? '#ccc' : '#085041', color: '#fff',
              border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 700, cursor: downloading ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}>
            {downloading ? '⏳ ...' : (isAr ? '📄 عرض الشهادة الكاملة' : '📄 Voir le certificat complet')}
          </button>
        </div>
      </div>

      {/* ─── FOOTER : MENTION APPLI ─── */}
      <div style={{ marginTop: 24, fontSize: 11, color: '#888', textAlign: 'center', maxWidth: 480, lineHeight: 1.6 }}>
        {isAr
          ? 'تم إصدار هذه الشهادة عبر تطبيق متابعة التحفيظ.'
          : "Ce certificat a été émis via l'application Suivi Récitation."}
        <br/>
        <a href="https://suivi-recitation.vercel.app" style={{ color: '#1D9E75', textDecoration: 'none', fontWeight: 600 }}>
          suivi-recitation.vercel.app
        </a>
      </div>
    </div>
  );
}
