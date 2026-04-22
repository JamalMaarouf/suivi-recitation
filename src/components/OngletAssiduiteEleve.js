import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ══════════════════════════════════════════════════════════════════════
// ONGLET ASSIDUITÉ DE LA FICHE ÉLÈVE
//
// Affiche pour UN élève :
// - Ses jours souhaités configurés
// - Ses stats d'assiduité sur une période choisie (semaine/mois/.../custom)
// - Ses dates d'absence précises
//
// Seuils lus depuis la table ecoles (paramétrage par école).
// Utilisé dans les 2 rendus de FicheEleve.js (mobile + desktop).
// ══════════════════════════════════════════════════════════════════════

export default function OngletAssiduiteEleve({ eleve, lang, isMobile }) {
  const [presences, setPresences] = useState([]);
  const [joursNonTravailles, setJoursNonTravailles] = useState([]);
  const [seuilRisque, setSeuilRisque] = useState(80);
  const [seuilParfait, setSeuilParfait] = useState(100);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState('mois');  // semaine|mois|trimestre|semestre|annee|custom
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const { debut, fin } = calcBornesPeriode(periode, dateDebut, dateFin);

  // ─── Chargement initial (jours non travaillés + seuils école) ─
  useEffect(() => {
    if (!eleve?.ecole_id) return;
    const load = async () => {
      const [jntRes, ecoleRes] = await Promise.all([
        supabase.from('jours_non_travailles')
          .select('date_debut, date_fin')
          .eq('ecole_id', eleve.ecole_id),
        supabase.from('ecoles')
          .select('seuil_assiduite_risque, seuil_assiduite_parfait')
          .eq('id', eleve.ecole_id)
          .maybeSingle(),
      ]);
      setJoursNonTravailles(jntRes.data || []);
      if (ecoleRes.data) {
        if (typeof ecoleRes.data.seuil_assiduite_risque === 'number') setSeuilRisque(ecoleRes.data.seuil_assiduite_risque);
        if (typeof ecoleRes.data.seuil_assiduite_parfait === 'number') setSeuilParfait(ecoleRes.data.seuil_assiduite_parfait);
      }
    };
    load();
  }, [eleve?.ecole_id]);

  // ─── Chargement des présences de l'élève pour la période ────
  useEffect(() => {
    if (!eleve?.id || !debut || !fin) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase.from('presences')
        .select('date_presence')
        .eq('eleve_id', eleve.id)
        .gte('date_presence', debut)
        .lte('date_presence', fin);
      setPresences(data || []);
      setLoading(false);
    };
    load();
  }, [eleve?.id, debut, fin]);

  // ─── Calcul des stats ────────────────────────────────────────
  const stats = useMemo(() => {
    if (!debut || !fin) return null;
    const jours = Array.isArray(eleve?.jours_souhaites) ? eleve.jours_souhaites : [false,false,false,false,false,false,false];
    const aDesJours = jours.some(j => j === true);
    if (!aDesJours) return { aDesJours: false };

    // Helper ISO local (fix fuseau horaire)
    const isoLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    // Dates non travaillées
    const datesNonTravailles = new Set();
    joursNonTravailles.forEach(p => {
      const d1 = new Date(p.date_debut);
      const d2 = new Date(p.date_fin);
      for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
        datesNonTravailles.add(isoLocal(d));
      }
    });

    const presSet = new Set(presences.map(p => p.date_presence));
    let attendues = 0, presentes = 0;
    const datesAbsences = [];
    const d1 = new Date(debut);
    const d2 = new Date(fin);
    for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
      const iso = isoLocal(d);
      if (datesNonTravailles.has(iso)) continue;
      const mapDayToIdx = [1, 2, 3, 4, 5, 6, 0];  // Dim→1, Lun→2, ..., Sam→0
      const idx = mapDayToIdx[d.getDay()];
      if (!jours[idx]) continue;
      attendues++;
      if (presSet.has(iso)) presentes++;
      else datesAbsences.push(iso);
    }
    return {
      aDesJours: true,
      attendues,
      presentes,
      absences: attendues - presentes,
      taux: attendues > 0 ? Math.round((presentes / attendues) * 100) : null,
      datesAbsences,
    };
  }, [eleve, presences, joursNonTravailles, debut, fin]);

  // ─── Labels jours souhaités ─────────────────────────────────
  const joursLabels = lang === 'ar'
    ? ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة']
    : ['Sam', 'Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const joursSouhaites = Array.isArray(eleve?.jours_souhaites) ? eleve.jours_souhaites : [false,false,false,false,false,false,false];

  // ─── Couleur selon taux ─────────────────────────────────────
  let statutColor = '#888', statutBg = '#f5f5f0', statutEmoji = '—';
  if (stats?.taux !== null && stats?.taux !== undefined) {
    if (stats.taux >= seuilParfait) {
      statutColor = '#1D9E75'; statutBg = '#E1F5EE'; statutEmoji = '🌟';
    } else if (stats.taux >= seuilRisque) {
      statutColor = '#EF9F27'; statutBg = '#FAEEDA'; statutEmoji = '👍';
    } else {
      statutColor = '#E24B4A'; statutBg = '#FCEBEB'; statutEmoji = '⚠️';
    }
  }

  const PERIODES = [
    { id: 'semaine',   label: lang === 'ar' ? 'الأسبوع'      : 'Semaine' },
    { id: 'mois',      label: lang === 'ar' ? 'الشهر'         : 'Mois' },
    { id: 'trimestre', label: lang === 'ar' ? 'الفصل (3 أشهر)': 'Trimestre' },
    { id: 'semestre',  label: lang === 'ar' ? 'النصف (6 أشهر)': 'Semestre' },
    { id: 'annee',     label: lang === 'ar' ? 'السنة'         : 'Année' },
    { id: 'custom',    label: lang === 'ar' ? 'فترة محددة'    : 'Personnalisée' },
  ];

  return (
    <div>
      {/* ─── Jours souhaités ─── */}
      <div style={{
        background: '#E1F5EE',
        border: '1px solid #1D9E7530',
        borderRadius: 12, padding: 14, marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#085041', marginBottom: 8 }}>
          📅 {lang === 'ar' ? 'أيام الحضور المرغوبة' : 'Jours souhaités'}
        </div>
        {joursSouhaites.every(j => !j) ? (
          <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>
            {lang === 'ar'
              ? '⚠️ لم يتم تحديد أي يوم. قم بتعديل الطالب لإضافة الأيام.'
              : '⚠️ Aucun jour déclaré. Modifie l\'élève pour ajouter ses jours.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {joursLabels.map((lbl, idx) => {
              const actif = !!joursSouhaites[idx];
              return (
                <div key={idx} style={{
                  padding: '6px 10px', borderRadius: 8,
                  background: actif ? '#1D9E75' : '#fff',
                  color: actif ? '#fff' : '#bbb',
                  border: actif ? 'none' : '1px solid #e0e0d8',
                  fontSize: 11, fontWeight: 700,
                }}>{lbl}</div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Sélecteur de période ─── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {PERIODES.map(p => {
          const active = periode === p.id;
          return (
            <button key={p.id} onClick={() => setPeriode(p.id)}
              style={{
                padding: '6px 12px', borderRadius: 20,
                border: `1px solid ${active ? '#1D9E75' : '#e0e0d8'}`,
                background: active ? '#E1F5EE' : '#fff',
                color: active ? '#085041' : '#888',
                fontSize: 11, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{p.label}</button>
          );
        })}
      </div>

      {periode === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 12 }} />
          <span style={{ alignSelf: 'center', color: '#888' }}>→</span>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 12 }} />
        </div>
      )}

      {debut && fin && (
        <div style={{ fontSize: 10, color: '#888', marginBottom: 14 }}>
          {lang === 'ar'
            ? `من ${formatDate(debut, lang)} إلى ${formatDate(fin, lang)}`
            : `Du ${formatDate(debut, lang)} au ${formatDate(fin, lang)}`}
        </div>
      )}

      {/* ─── Stats ─── */}
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>
          {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
        </div>
      ) : !stats?.aDesJours ? (
        <div style={{
          padding: 30, textAlign: 'center',
          background: '#FCEBEB', borderRadius: 12,
          border: '1px solid #E24B4A30',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#A32D2D' }}>
            {lang === 'ar'
              ? 'لا يمكن حساب الحضور بدون تحديد الأيام'
              : 'Impossible de calculer sans jours déclarés'}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            {lang === 'ar' ? 'قم بتعديل الطالب لإضافة أيام الحضور' : 'Modifie l\'élève pour ajouter ses jours'}
          </div>
        </div>
      ) : stats.attendues === 0 ? (
        <div style={{
          padding: 30, textAlign: 'center',
          background: '#f5f5f0', borderRadius: 12, border: '1px dashed #ccc',
          color: '#888', fontSize: 13,
        }}>
          {lang === 'ar'
            ? 'لا توجد حصص في هذه الفترة'
            : 'Aucune séance attendue sur cette période'}
        </div>
      ) : (
        <>
          {/* Grande carte synthèse */}
          <div style={{
            background: statutBg,
            border: `2px solid ${statutColor}40`,
            borderRadius: 14, padding: isMobile ? 16 : 20,
            marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ fontSize: isMobile ? 36 : 44, flexShrink: 0 }}>{statutEmoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 2 }}>
                {lang === 'ar' ? 'نسبة الحضور' : 'Taux de présence'}
              </div>
              <div style={{ fontSize: isMobile ? 32 : 38, fontWeight: 800, color: statutColor, lineHeight: 1 }}>
                {stats.taux}%
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                {lang === 'ar'
                  ? `${stats.presentes}/${stats.attendues} حصة · ${stats.absences} غياب`
                  : `${stats.presentes}/${stats.attendues} séances · ${stats.absences} absences`}
              </div>
            </div>
          </div>

          {/* Petites stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
            gap: 8, marginBottom: 12,
          }}>
            <MiniStat label={lang === 'ar' ? 'المتوقع' : 'Attendues'} value={stats.attendues} color="#0C447C" bg="#E6F1FB" />
            <MiniStat label={lang === 'ar' ? 'الحاضر' : 'Présent'}    value={stats.presentes} color="#1D9E75" bg="#E1F5EE" />
            <MiniStat label={lang === 'ar' ? 'غياب'    : 'Absent'}     value={stats.absences}  color="#E24B4A" bg="#FCEBEB" />
          </div>

          {/* Liste dates d'absence */}
          {stats.datesAbsences.length > 0 && (
            <div style={{
              background: '#fff', padding: 12, borderRadius: 12,
              border: '1px solid #e0e0d8',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#A32D2D', marginBottom: 8 }}>
                ❌ {lang === 'ar' ? 'أيام الغياب' : 'Jours d\'absence'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stats.datesAbsences.map(d => (
                  <div key={d} style={{
                    padding: '5px 10px', background: '#FCEBEB', color: '#A32D2D',
                    borderRadius: 6, fontSize: 11, fontWeight: 600,
                  }}>
                    {formatDate(d, lang)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.datesAbsences.length === 0 && stats.presentes > 0 && (
            <div style={{
              background: '#E1F5EE', padding: 14, borderRadius: 12,
              border: '1px solid #1D9E7530', textAlign: 'center',
              color: '#085041', fontSize: 13, fontWeight: 600,
            }}>
              🎉 {lang === 'ar' ? 'لم يتغيب أي يوم!' : 'Aucune absence sur cette période !'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, color, bg }) {
  return (
    <div style={{
      background: bg, padding: 10, borderRadius: 10,
      border: `1px solid ${color}25`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function calcBornesPeriode(periode, customDebut, customFin) {
  const today = new Date();
  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  if (periode === 'custom') return { debut: customDebut || null, fin: customFin || null };
  if (periode === 'semaine') {
    const d = new Date(today);
    const jourSemaine = d.getDay();
    const diffAuSamedi = (jourSemaine + 1) % 7;
    d.setDate(d.getDate() - diffAuSamedi);
    return { debut: iso(d), fin: iso(today) };
  }
  if (periode === 'mois') {
    const debut = new Date(today.getFullYear(), today.getMonth(), 1);
    return { debut: iso(debut), fin: iso(today) };
  }
  if (periode === 'trimestre') {
    const debut = new Date(today); debut.setMonth(debut.getMonth() - 3);
    return { debut: iso(debut), fin: iso(today) };
  }
  if (periode === 'semestre') {
    const debut = new Date(today); debut.setMonth(debut.getMonth() - 6);
    return { debut: iso(debut), fin: iso(today) };
  }
  if (periode === 'annee') {
    const debut = new Date(today.getFullYear(), 0, 1);
    return { debut: iso(debut), fin: iso(today) };
  }
  return { debut: null, fin: null };
}

function formatDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}
