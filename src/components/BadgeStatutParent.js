import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ══════════════════════════════════════════════════════════════════════
// BADGE STATUT PARENT — pour la fiche élève (côté surveillant)
//
// Affiche en 1 coup d'œil si le parent de l'élève consulte le portail :
//   🟢 Actif / 🟡 Peu actif / 🔴 Inactif / ⚪ Jamais
//
// Clic sur le badge → popup détail avec :
//   - Nom du parent + téléphone cliquable
//   - Date dernière visite
//   - Onglets qu'il a consultés
//   - Nb consultations total
//
// Utilisé dans : FicheEleve.js (mobile + desktop)
// ══════════════════════════════════════════════════════════════════════

export default function BadgeStatutParent({ eleve, lang, compact }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);  // { parent, visites, joursEcoules, statut }
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    if (!eleve?.id || !eleve?.ecole_id) { setLoading(false); return; }
    loadData();
    // eslint-disable-next-line
  }, [eleve?.id]);

  const loadData = async () => {
    setLoading(true);

    // 1. Seuils école
    const { data: ecoleData } = await supabase.from('ecoles')
      .select('seuil_parent_actif_jours, seuil_parent_peu_actif_jours')
      .eq('id', eleve.ecole_id).maybeSingle();
    const seuilActif = ecoleData?.seuil_parent_actif_jours ?? 7;
    const seuilPeuActif = ecoleData?.seuil_parent_peu_actif_jours ?? 30;

    // 2. Trouver le parent lié à cet élève (table parent_eleve)
    const { data: liaison } = await supabase.from('parent_eleve')
      .select('parent_id')
      .eq('eleve_id', eleve.id)
      .maybeSingle();

    if (!liaison?.parent_id) {
      setData({ parent: null, visites: [], joursEcoules: null, statut: 'aucun_parent' });
      setLoading(false);
      return;
    }

    // 3. Infos parent + toutes ses visites pour cet enfant
    const [parentRes, visitesRes] = await Promise.all([
      supabase.from('utilisateurs')
        .select('id, prenom, nom, identifiant, telephone')
        .eq('id', liaison.parent_id).maybeSingle(),
      supabase.from('parents_visites')
        .select('date_visite, onglets_visites, nb_consultations')
        .eq('parent_id', liaison.parent_id)
        .eq('eleve_id', eleve.id)
        .order('date_visite', { ascending: false }),
    ]);

    const visites = visitesRes.data || [];
    const derniere = visites[0];

    // 4. Calcul jours écoulés + statut
    let joursEcoules = null, statut = 'jamais';
    if (derniere) {
      const now = new Date();
      const today = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`);
      const dv = new Date(derniere.date_visite + 'T00:00:00');
      joursEcoules = Math.floor((today - dv) / (1000 * 60 * 60 * 24));
      if (joursEcoules <= seuilActif) statut = 'actif';
      else if (joursEcoules <= seuilPeuActif) statut = 'peu_actif';
      else statut = 'inactif';
    }

    setData({
      parent: parentRes.data,
      visites,
      joursEcoules,
      statut,
      nbVisitesJours: visites.length,
      nbConsultTotal: visites.reduce((s, v) => s + (v.nb_consultations || 0), 0),
    });
    setLoading(false);
  };

  if (loading) return null;  // silencieux pendant chargement
  if (!data || data.statut === 'aucun_parent') return null;  // pas de parent lié = on n'affiche rien

  const statutInfo = {
    actif:     { emoji: '🟢', label: lang === 'ar' ? 'نشط' : 'Actif',        color: '#1D9E75', bg: '#E1F5EE' },
    peu_actif: { emoji: '🟡', label: lang === 'ar' ? 'قليل' : 'Peu actif',   color: '#EF9F27', bg: '#FAEEDA' },
    inactif:   { emoji: '🔴', label: lang === 'ar' ? 'غير نشط' : 'Inactif',  color: '#E24B4A', bg: '#FCEBEB' },
    jamais:    { emoji: '⚪', label: lang === 'ar' ? 'لم يزر' : 'Jamais',     color: '#888',    bg: '#f5f5f0' },
  }[data.statut];

  const joursLabel = () => {
    if (data.joursEcoules === null) return lang === 'ar' ? 'لم يزر قط' : 'Jamais venu';
    if (data.joursEcoules === 0) return lang === 'ar' ? 'اليوم' : 'Aujourd\'hui';
    if (data.joursEcoules === 1) return lang === 'ar' ? 'أمس' : 'Hier';
    return lang === 'ar' ? `منذ ${data.joursEcoules} يوم` : `Il y a ${data.joursEcoules} j`;
  };

  const ongletLabel = (o) => ({
    progression: lang === 'ar' ? 'التقدم' : 'Progression',
    recitations: lang === 'ar' ? 'الاستظهارات' : 'Récitations',
    cours:       lang === 'ar' ? 'الدروس' : 'Cours',
    objectifs:   lang === 'ar' ? 'الأهداف' : 'Objectifs',
    cotisations: lang === 'ar' ? 'الاشتراكات' : 'Cotisations',
  }[o] || o);

  // Union des onglets consultés
  const ongletsSet = new Set();
  data.visites.forEach(v => (v.onglets_visites || []).forEach(o => ongletsSet.add(o)));
  const onglets = Array.from(ongletsSet);

  return (
    <>
      {/* Le badge compact */}
      <button
        onClick={() => setPopupOpen(true)}
        title={lang === 'ar' ? 'حالة الولي' : 'Statut du parent'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: compact ? '2px 8px' : '3px 10px',
          background: statutInfo.bg,
          border: `1px solid ${statutInfo.color}40`,
          borderRadius: 999,
          cursor: 'pointer', fontFamily: 'inherit',
          color: statutInfo.color,
          fontSize: compact ? 10 : 11, fontWeight: 700,
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = `0 2px 6px ${statutInfo.color}30`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <span style={{ fontSize: compact ? 11 : 13 }}>{statutInfo.emoji}</span>
        {!compact && <span>{lang === 'ar' ? 'ولي:' : 'Parent :'} {statutInfo.label}</span>}
      </button>

      {/* Popup détail */}
      {popupOpen && (
        <div onClick={() => setPopupOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16,
              padding: 22, maxWidth: 440, width: '100%',
              maxHeight: '88vh', overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: statutInfo.bg, color: statutInfo.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, flexShrink: 0,
              }}>{statutInfo.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>
                  {data.parent ? `${data.parent.prenom} ${data.parent.nom}` : (lang === 'ar' ? 'ولي' : 'Parent')}
                </div>
                <div style={{ fontSize: 12, color: statutInfo.color, fontWeight: 700, marginTop: 2 }}>
                  {statutInfo.label} · {joursLabel()}
                </div>
              </div>
              <button onClick={() => setPopupOpen(false)}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: '#f5f5f0', color: '#666', border: 'none',
                  fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
                }}>✕</button>
            </div>

            {/* Contact */}
            {data.parent && (
              <div style={{ marginBottom: 14 }}>
                {data.parent.telephone ? (
                  <a href={`tel:${data.parent.telephone}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', background: '#1D9E75', color: '#fff',
                      border: 'none', borderRadius: 12, textDecoration: 'none',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      width: '100%', boxSizing: 'border-box',
                    }}>
                    <span style={{ fontSize: 22 }}>📞</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 500 }}>
                        {lang === 'ar' ? 'اتصل' : 'Appeler'}
                      </div>
                      <div>{data.parent.telephone}</div>
                    </div>
                  </a>
                ) : (
                  <div style={{
                    padding: '10px 14px', background: '#FAEEDA', color: '#633806',
                    borderRadius: 10, fontSize: 12, textAlign: 'center',
                  }}>
                    ⚠️ {lang === 'ar' ? 'لا يوجد رقم هاتف مسجل' : 'Aucun téléphone enregistré'}
                  </div>
                )}
                {data.parent.identifiant && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 6, textAlign: 'center' }}>
                    🆔 {data.parent.identifiant}
                  </div>
                )}
              </div>
            )}

            {/* Stats consultation */}
            {data.statut !== 'jamais' && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: 8, marginBottom: 14,
              }}>
                <MiniInfo
                  label={lang === 'ar' ? 'أيام الزيارة' : 'Jours visités'}
                  value={data.nbVisitesJours}
                  color="#378ADD"
                />
                <MiniInfo
                  label={lang === 'ar' ? 'الاستشارات' : 'Consultations'}
                  value={data.nbConsultTotal}
                  color="#534AB7"
                />
              </div>
            )}

            {/* Onglets consultés */}
            {onglets.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 6 }}>
                  📑 {lang === 'ar' ? 'ما يطلع عليه' : 'Ce qu\'il consulte'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {onglets.map(o => (
                    <span key={o} style={{
                      padding: '3px 10px', background: '#E6F1FB', color: '#0C447C',
                      borderRadius: 12, fontSize: 10, fontWeight: 700,
                    }}>{ongletLabel(o)}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Message action selon statut */}
            <div style={{
              padding: 12, borderRadius: 10,
              background: statutInfo.bg, color: statutInfo.color,
              fontSize: 11, fontWeight: 600, textAlign: 'center',
              lineHeight: 1.5,
            }}>
              {data.statut === 'actif' && (lang === 'ar'
                ? '✨ هذا الولي يتابع بانتظام، أحسن الله عمله'
                : '✨ Ce parent suit régulièrement, excellent !')}
              {data.statut === 'peu_actif' && (lang === 'ar'
                ? '💡 يمكن تذكيره بتسجيل الدخول إلى المنصة'
                : '💡 Tu peux l\'encourager à se reconnecter')}
              {data.statut === 'inactif' && (lang === 'ar'
                ? '📞 ينصح بالاتصال به لإبلاغه بأخبار ابنه'
                : '📞 Un appel pour l\'informer est recommandé')}
              {data.statut === 'jamais' && (lang === 'ar'
                ? '❗ لم يسجل الدخول قط. يستحسن الاتصال والتوضيح'
                : '❗ Jamais connecté. Un appel explicatif serait utile')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MiniInfo({ label, value, color }) {
  return (
    <div style={{
      padding: '8px 10px',
      background: `${color}10`,
      border: `1px solid ${color}30`,
      borderRadius: 8,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: '#888', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
