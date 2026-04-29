import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { loadAnneeActiveAvecPeriodes, formatPeriodeCourte, detecterPeriodeEnCours } from '../lib/helpers';
import PeriodeSelectorHybride from './PeriodeSelectorHybride';

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
  const [periode, setPeriode] = useState('mois');  // semaine|mois|annee_scolaire|bdd_<id>|custom
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  // Etape 14 - Periodes scolaires depuis BDD (typees ou libres)
  const [periodesBDD, setPeriodesBDD] = useState([]);
  const [anneeActive, setAnneeActive] = useState(null); // Etape 14 v2

  const { debut, fin } = calcBornesPeriode(periode, dateDebut, dateFin, periodesBDD, anneeActive);

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

  // Etape 14 - Charger annee active + ses periodes typees (T, S)
  useEffect(() => {
    if (!eleve?.ecole_id) return;
    loadAnneeActiveAvecPeriodes(supabase, eleve.ecole_id).then(({ annee, periodes }) => {
      setAnneeActive(annee);
      setPeriodesBDD(periodes.filter(p => p.type === 'trimestre' || p.type === 'semestre'));
    });
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
    const datesPresences = [];
    // Compteurs par jour de la semaine et par mois (pour les analyses)
    const absencesParJourSemaine = [0, 0, 0, 0, 0, 0, 0]; // Sam, Dim, Lun, Mar, Mer, Jeu, Ven
    const attenduesParJourSemaine = [0, 0, 0, 0, 0, 0, 0];
    const absencesParMois = {}; // 'YYYY-MM' -> count
    const attenduesParMois = {};

    const d1 = new Date(debut);
    const d2 = new Date(fin);
    for (let d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
      const iso = isoLocal(d);
      if (datesNonTravailles.has(iso)) continue;
      const mapDayToIdx = [1, 2, 3, 4, 5, 6, 0];  // Dim→1, Lun→2, ..., Sam→0
      const idx = mapDayToIdx[d.getDay()];
      if (!jours[idx]) continue;
      attendues++;
      attenduesParJourSemaine[idx]++;
      const moisKey = iso.substring(0, 7); // YYYY-MM
      attenduesParMois[moisKey] = (attenduesParMois[moisKey] || 0) + 1;
      if (presSet.has(iso)) {
        presentes++;
        datesPresences.push(iso);
      } else {
        datesAbsences.push(iso);
        absencesParJourSemaine[idx]++;
        absencesParMois[moisKey] = (absencesParMois[moisKey] || 0) + 1;
      }
    }

    // ─── Detection patterns ─────────────────────────────────────
    // Mois le plus difficile
    let moisPire = null, moisPireNb = 0;
    for (const [m, nb] of Object.entries(absencesParMois)) {
      if (nb > moisPireNb) { moisPire = m; moisPireNb = nb; }
    }
    // Jour de semaine le plus absent
    let jourPireIdx = -1, jourPirePct = 0;
    for (let i = 0; i < 7; i++) {
      if (attenduesParJourSemaine[i] > 0) {
        const pct = absencesParJourSemaine[i] / attenduesParJourSemaine[i];
        if (pct > jourPirePct) { jourPirePct = pct; jourPireIdx = i; }
      }
    }
    // Plus longue serie d'absences consecutives
    const datesAbsTriees = [...datesAbsences].sort();
    let longueurMaxSerie = 0, debutSerie = null, finSerie = null;
    let curLen = 0, curDebut = null, prevDate = null;
    for (const dStr of datesAbsTriees) {
      const cur = new Date(dStr);
      if (prevDate) {
        const diff = (cur - prevDate) / (1000 * 60 * 60 * 24);
        if (diff <= 7) { // tolerance pour weekends/jours non travailles
          curLen++;
        } else {
          if (curLen > longueurMaxSerie) { longueurMaxSerie = curLen; debutSerie = curDebut; finSerie = prevDate; }
          curLen = 1;
          curDebut = cur;
        }
      } else {
        curLen = 1;
        curDebut = cur;
      }
      prevDate = cur;
    }
    if (curLen > longueurMaxSerie) { longueurMaxSerie = curLen; debutSerie = curDebut; finSerie = prevDate; }

    return {
      aDesJours: true,
      attendues,
      presentes,
      absences: attendues - presentes,
      taux: attendues > 0 ? Math.round((presentes / attendues) * 100) : null,
      datesAbsences,
      datesPresences,
      absencesParJourSemaine,
      attenduesParJourSemaine,
      absencesParMois,
      attenduesParMois,
      moisPire,
      moisPireNb,
      jourPireIdx,
      jourPirePct: Math.round(jourPirePct * 100),
      longueurMaxSerie,
      debutSerie: debutSerie ? isoLocal(debutSerie) : null,
      finSerie: finSerie ? isoLocal(finSerie) : null,
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

  // Etape 14 v2 - PERIODES gere par PeriodeSelectorHybride

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

      {/* ─── Sélecteur de période - Etape 14 v2 ─── */}
      {(() => {
        const isAr = lang === 'ar';
        const trimestresBDD = periodesBDD.filter(p => p.type === 'trimestre');
        const semestresBDD = periodesBDD.filter(p => p.type === 'semestre');
        const trimestreEnCours = detecterPeriodeEnCours(trimestresBDD);
        const boutonsRapides = [
          { key:'mois', label:isAr?'الشهر':'Ce mois' },
          ...(trimestreEnCours ? [{ key:'bdd_'+trimestreEnCours.id, label: formatPeriodeCourte(trimestreEnCours, lang, true) }] : []),
          ...(anneeActive ? [{ key:'annee_scolaire', label: anneeActive.nom }] : []),
        ];
        const idsRapides = boutonsRapides.map(b => b.key);
        const dropdownItems = [
          { groupe: isAr?'حديث':'Récent', items: [
            { key:'semaine', label:isAr?'الأسبوع':'Semaine' },
          ].filter(item => !idsRapides.includes(item.key)) },
          { groupe: isAr?'الفصول الدراسية':'Trimestres', items:
            trimestresBDD.map(p => ({ key:'bdd_'+p.id, label: formatPeriodeCourte(p, lang, true) }))
              .filter(item => !idsRapides.includes(item.key))
          },
          { groupe: isAr?'الحصيلة':'Bilans', items:
            semestresBDD.map(p => ({ key:'bdd_'+p.id, label: formatPeriodeCourte(p, lang, true) }))
              .filter(item => !idsRapides.includes(item.key))
          },
        ].filter(g => g.items.length > 0);
        return (
          <div style={{marginBottom:12}}>
            <PeriodeSelectorHybride
              boutonsRapides={boutonsRapides}
              dropdownItems={dropdownItems}
              allowCustom={true}
              periode={periode}
              setPeriode={setPeriode}
              dateDebut={dateDebut}
              dateFin={dateFin}
              setDateDebut={setDateDebut}
              setDateFin={setDateFin}
              lang={lang}
              variant="default"
            />
            {periodesBDD.length === 0 && !anneeActive && (
              <div style={{
                background:'#FFF8EC',border:'1px solid #EF9F2740',borderRadius:8,
                padding:'8px 12px',fontSize:11,color:'#7B5800',marginTop:8,
                display:'flex',alignItems:'center',gap:8,
              }}>
                <span style={{fontSize:14}}>💡</span>
                <span>{isAr
                  ? 'لم تقم بإعداد سنة دراسية بعد. الإدارة > الفترات.'
                  : 'Aucune année scolaire active. Gestion → Périodes.'}</span>
              </div>
            )}
          </div>
        );
      })()}

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

          {/* ─── Bandeau Analyse rapide (Insights) ─── */}
          {stats.absences > 0 && (
            <div style={{
              background: 'linear-gradient(135deg,#FFF8EC,#FAEEDA)',
              border: '1px solid #EF9F2740',
              borderRadius: 12, padding: 14, marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7B5800', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎯 {lang === 'ar' ? 'تحليل سريع' : 'Analyse rapide'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                {stats.moisPire && (
                  <Insight
                    icon="📅"
                    label={lang === 'ar' ? 'الشهر الأصعب' : 'Mois le plus difficile'}
                    value={`${formatMoisCourt(stats.moisPire, lang)} (${stats.moisPireNb})`}
                  />
                )}
                {stats.jourPireIdx >= 0 && stats.jourPirePct >= 30 && (
                  <Insight
                    icon="🔁"
                    label={lang === 'ar' ? 'اليوم الأصعب' : 'Jour le plus absent'}
                    value={`${joursLabels[stats.jourPireIdx]} (${stats.jourPirePct}%)`}
                  />
                )}
                {stats.longueurMaxSerie >= 3 && (
                  <Insight
                    icon="⚠️"
                    label={lang === 'ar' ? 'أطول فترة غياب' : 'Plus longue série'}
                    value={`${stats.longueurMaxSerie} ${lang === 'ar' ? 'غياب' : 'absences'}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* ─── Graphique par jour de la semaine ─── */}
          {stats.absences > 0 && (
            <div style={{
              background: '#fff', padding: 12, borderRadius: 12,
              border: '1px solid #e0e0d8', marginBottom: 12,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>
                📊 {lang === 'ar' ? 'الغياب حسب أيام الأسبوع' : 'Absences par jour de semaine'}
              </div>
              {(() => {
                // Determiner le max pour normalisation
                const maxAbs = Math.max(1, ...stats.absencesParJourSemaine);
                return joursLabels.map((lbl, idx) => {
                  if (stats.attenduesParJourSemaine[idx] === 0) return null; // pas de données
                  const nb = stats.absencesParJourSemaine[idx];
                  const total = stats.attenduesParJourSemaine[idx];
                  const pct = Math.round((nb / total) * 100);
                  const widthPct = Math.round((nb / maxAbs) * 100);
                  const color = pct >= 50 ? '#E24B4A' : pct >= 25 ? '#EF9F27' : '#1D9E75';
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: 11 }}>
                      <div style={{ minWidth: 50, fontWeight: 600, color: '#666' }}>{lbl}</div>
                      <div style={{ flex: 1, background: '#f5f5f0', borderRadius: 4, height: 18, position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          width: `${widthPct}%`, height: '100%', background: color,
                          borderRadius: 4, transition: 'width 0.3s',
                        }}/>
                      </div>
                      <div style={{ minWidth: 60, textAlign: 'right', fontSize: 10, color: '#888' }}>
                        {nb}/{total} ({pct}%)
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* ─── Calendriers visuels mois par mois ─── */}
          {stats.datesAbsences.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#A32D2D', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                ❌ {lang === 'ar' ? 'تقويم الغياب' : 'Vue calendrier'}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 10,
              }}>
                {(() => {
                  // Construire la liste des mois entre debut et fin
                  const moisList = [];
                  const dStart = new Date(debut);
                  const dEnd = new Date(fin);
                  let cur = new Date(dStart.getFullYear(), dStart.getMonth(), 1);
                  while (cur <= dEnd) {
                    const moisKey = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
                    moisList.push({ key: moisKey, year: cur.getFullYear(), month: cur.getMonth() });
                    cur.setMonth(cur.getMonth() + 1);
                  }
                  return moisList.map(m => (
                    <CalendrierMois
                      key={m.key}
                      year={m.year}
                      month={m.month}
                      datesAbsences={stats.datesAbsences}
                      datesPresences={stats.datesPresences}
                      joursSouhaites={joursSouhaites}
                      lang={lang}
                      nbAbsencesMois={stats.absencesParMois[m.key] || 0}
                    />
                  ));
                })()}
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
function calcBornesPeriode(periode, customDebut, customFin, periodesBDD = [], anneeActive = null) {
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
  // Etape 14 v2 - Annee scolaire active
  if (periode === 'annee_scolaire' && anneeActive) {
    return { debut: anneeActive.date_debut, fin: anneeActive.date_fin };
  }
  // Etape 14 - Periodes BDD (typees) : id = 'bdd_<uuid>'
  if (periode && periode.startsWith('bdd_')) {
    const id = periode.substring(4);
    const p = periodesBDD.find(x => x.id === id);
    if (p) return { debut: p.date_debut, fin: p.date_fin };
    return { debut: null, fin: null };
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

function formatMoisCourt(yyyymm, lang) {
  if (!yyyymm) return '';
  const [y, m] = yyyymm.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
    month: 'long', year: 'numeric',
  });
}

// ──────────────────────────────────────────────────────────────
// Composant Insight (carte info dans bandeau Analyse rapide)
// ──────────────────────────────────────────────────────────────
function Insight({ icon, label, value }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '7px 10px',
      border: '0.5px solid #EF9F2730', display: 'flex',
      alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 140,
    }}>
      <div style={{ fontSize: 16 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', marginTop: 1 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Composant CalendrierMois (mini-calendrier visuel)
// ──────────────────────────────────────────────────────────────
function CalendrierMois({ year, month, datesAbsences, datesPresences, joursSouhaites, lang, nbAbsencesMois }) {
  const isAr = lang === 'ar';
  // Premier jour du mois et nombre de jours
  const premierJour = new Date(year, month, 1);
  const dernierJour = new Date(year, month + 1, 0);
  const nbJours = dernierJour.getDate();
  // Jour de la semaine du 1er (0=Dim, 1=Lun, ..., 6=Sam)
  // En convention scolaire arabe : Sam=0, Dim=1, ..., Ven=6
  const mapJsToScolaire = [1, 2, 3, 4, 5, 6, 0]; // index 0=Dim->1, 6=Sam->0
  const decalageDebut = mapJsToScolaire[premierJour.getDay()];

  const setAbs = new Set(datesAbsences);
  const setPres = new Set(datesPresences);

  const isoLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  // Labels jours (ordre Sam, Dim, Lun, Mar, Mer, Jeu, Ven)
  const labelsJours = isAr
    ? ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج']
    : ['S', 'D', 'L', 'M', 'M', 'J', 'V'];

  // Couleur selon nb absences du mois
  const couleurEntete = nbAbsencesMois === 0 ? '#1D9E75'
                       : nbAbsencesMois <= 3 ? '#EF9F27'
                       : '#E24B4A';

  // Construire la grille
  const cases = [];
  // Cases vides au debut
  for (let i = 0; i < decalageDebut; i++) {
    cases.push(<div key={`empty-${i}`} style={{ width: 24, height: 24 }} />);
  }
  // Jours du mois
  for (let jour = 1; jour <= nbJours; jour++) {
    const d = new Date(year, month, jour);
    const iso = isoLocal(d);
    const dayJs = d.getDay();
    const idxScolaire = mapJsToScolaire[dayJs];
    const estJourSouhaite = joursSouhaites[idxScolaire];

    let bg = 'transparent', color = '#ccc', border = 'none', fontWeight = 400;
    let title = '';

    if (setAbs.has(iso)) {
      bg = '#E24B4A'; color = '#fff'; fontWeight = 700;
      title = isAr ? `غائب - ${jour}` : `Absent - ${jour}`;
    } else if (setPres.has(iso)) {
      bg = '#1D9E75'; color = '#fff'; fontWeight = 600;
      title = isAr ? `حاضر - ${jour}` : `Présent - ${jour}`;
    } else if (!estJourSouhaite) {
      // Jour non souhaité (weekend ou jour off)
      bg = 'transparent'; color = '#bbb';
    } else {
      // Jour souhaité mais hors période ou jour non travaillé école
      bg = '#f5f5f0'; color = '#999';
    }

    cases.push(
      <div key={jour} title={title} style={{
        width: 24, height: 24, background: bg, color, borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight, border,
      }}>{jour}</div>
    );
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #e0e0d8', borderRadius: 10,
      padding: 10,
    }}>
      {/* Entête mois */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f0f0ec',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>
          {formatMoisCourt(`${year}-${String(month+1).padStart(2,'0')}`, lang)}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color: couleurEntete,
          background: `${couleurEntete}15`, padding: '2px 8px', borderRadius: 6,
        }}>
          {nbAbsencesMois === 0
            ? (isAr ? '✓ بدون غياب' : '✓ aucune')
            : `${nbAbsencesMois} ${isAr ? 'غياب' : nbAbsencesMois > 1 ? 'absences' : 'absence'}`}
        </div>
      </div>
      {/* Entêtes jours */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 24px)',
        gap: 2, justifyContent: 'center', marginBottom: 4,
      }}>
        {labelsJours.map((l, i) => (
          <div key={i} style={{
            fontSize: 9, fontWeight: 700, color: '#888',
            textAlign: 'center',
          }}>{l}</div>
        ))}
      </div>
      {/* Grille jours */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 24px)',
        gap: 2, justifyContent: 'center',
      }}>
        {cases}
      </div>
      {/* Legende compact */}
      <div style={{
        display: 'flex', gap: 8, marginTop: 8, paddingTop: 6,
        borderTop: '1px solid #f0f0ec', fontSize: 9, color: '#666',
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, background: '#1D9E75', borderRadius: 2 }}/>
          {isAr ? 'حاضر' : 'présent'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, background: '#E24B4A', borderRadius: 2 }}/>
          {isAr ? 'غائب' : 'absent'}
        </span>
      </div>
    </div>
  );
}
