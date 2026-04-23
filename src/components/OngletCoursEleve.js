import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

// ══════════════════════════════════════════════════════════════════════
// ONGLET COURS DE LA FICHE ÉLÈVE (lecture seule)
//
// Affiche la progression de l'élève sur les cours de son niveau.
// Logique de statut par axe pour UN élève :
//  1. Regarder les validations du niveau pour cet axe
//  2. Si aucune validation → non validé
//  3. Si validation existe → regarder si exception pour CET élève
//     - Si exception → utiliser le statut de l'exception
//       (a_revoir / non_acquis / absent)
//     - Sinon → hérite du statut du niveau (acquis / a_revoir / excellent)
//
// Accessible par : surveillant + instituteur (depuis FicheEleve) + parent
// (depuis son espace, à l'étape 7).
// ══════════════════════════════════════════════════════════════════════

export default function OngletCoursEleve({ eleve, lang, isMobile }) {
  const [loading, setLoading] = useState(true);
  const [cours, setCours] = useState([]);         // cours du niveau
  const [axes, setAxes] = useState([]);           // axes de ces cours
  const [validations, setValidations] = useState([]);  // validations pour son niveau
  const [exceptions, setExceptions] = useState([]);    // ses exceptions individuelles

  // ─── Chargement ─────────────────────────────────────────────
  const loadData = async () => {
    if (!eleve?.code_niveau || !eleve?.ecole_id) { setLoading(false); return; }
    setLoading(true);

    // 1. Trouver les cours assignés à son niveau
    const { data: liaisons } = await supabase.from('cours_niveaux')
      .select('cours_id')
      .eq('code_niveau', eleve.code_niveau);
    const coursIds = (liaisons || []).map(l => l.cours_id);
    if (coursIds.length === 0) {
      setCours([]); setAxes([]); setValidations([]); setExceptions([]);
      setLoading(false);
      return;
    }

    // 2. Charger en parallèle : cours + axes + validations
    const [coursRes, axesRes, valRes] = await Promise.all([
      supabase.from('cours')
        .select('id, nom_ar, nom_fr, nom_en, categorie, annee_estimee, ordre')
        .in('id', coursIds)
        .eq('actif', true)
        .order('ordre', { ascending: true }),
      supabase.from('cours_axes')
        .select('id, cours_id, parent_axe_id, nom_ar, nom_fr, nom_en, ordre, duree_estimee_seances')
        .in('cours_id', coursIds)
        .order('ordre', { ascending: true }),
      supabase.from('cours_validations')
        .select('id, axe_id, qualite, valide_le, commentaire')
        .eq('ecole_id', eleve.ecole_id)
        .eq('code_niveau', eleve.code_niveau),
    ]);
    setCours(coursRes.data || []);
    setAxes(axesRes.data || []);
    const vals = valRes.data || [];
    setValidations(vals);

    // 3. Charger les exceptions POUR CET élève
    if (vals.length > 0) {
      const { data: excData } = await supabase.from('cours_validations_exceptions')
        .select('validation_id, statut, commentaire')
        .in('validation_id', vals.map(v => v.id))
        .eq('eleve_id', eleve.id);
      setExceptions(excData || []);
    } else {
      setExceptions([]);
    }
    setLoading(false);
  };
  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [eleve?.id]);

  // ─── Construction des arbres (1 par cours) ─────────────────
  const treesByCours = useMemo(() => {
    const result = {};
    cours.forEach(c => {
      const axesCours = axes.filter(a => a.cours_id === c.id);
      const byParent = {};
      axesCours.forEach(a => {
        const key = a.parent_axe_id || '_root';
        if (!byParent[key]) byParent[key] = [];
        byParent[key].push(a);
      });
      Object.keys(byParent).forEach(k => {
        byParent[k].sort((a, b) => a.ordre - b.ordre);
      });
      const buildNode = (axe, path) => {
        const enfants = byParent[axe.id] || [];
        return {
          ...axe,
          path,
          enfants: enfants.map((e, i) => buildNode(e, `${path}.${i + 1}`)),
        };
      };
      result[c.id] = (byParent._root || []).map((r, i) => buildNode(r, `${i + 1}`));
    });
    return result;
  }, [cours, axes]);

  // Map validation par axe
  const validationByAxe = useMemo(() => {
    const m = {};
    validations.forEach(v => { m[v.axe_id] = v; });
    return m;
  }, [validations]);
  // Map exception par validation_id
  const exceptionByValidation = useMemo(() => {
    const m = {};
    exceptions.forEach(e => { m[e.validation_id] = e; });
    return m;
  }, [exceptions]);

  // ─── Statut effectif de l'élève pour un axe ────────────────
  // Priorité : exception personnelle > statut du niveau > non validé
  const statutEleve = (axeId) => {
    const val = validationByAxe[axeId];
    if (!val) return { statut: 'non_valide', icon: '⚪', color: '#ccc', label: lang === 'ar' ? 'غير مُتحقق' : 'Non validé' };
    const exc = exceptionByValidation[val.id];
    if (exc) {
      switch (exc.statut) {
        case 'a_revoir':   return { statut: 'a_revoir',   icon: '🔄', color: '#378ADD', label: lang === 'ar' ? 'للمراجعة (استثناء)' : 'À revoir (exception)' };
        case 'non_acquis': return { statut: 'non_acquis', icon: '❌', color: '#E24B4A', label: lang === 'ar' ? 'غير مكتسب (استثناء)' : 'Non acquis (exception)' };
        case 'absent':     return { statut: 'absent',     icon: '⭕', color: '#888',    label: lang === 'ar' ? 'غائب' : 'Absent' };
      }
    }
    switch (val.qualite) {
      case 'excellent': return { statut: 'excellent', icon: '⭐', color: '#EF9F27', label: lang === 'ar' ? 'ممتاز' : 'Excellent' };
      case 'a_revoir':  return { statut: 'a_revoir',  icon: '🔄', color: '#378ADD', label: lang === 'ar' ? 'للمراجعة' : 'À revoir' };
      default:          return { statut: 'acquis',    icon: '✅', color: '#1D9E75', label: lang === 'ar' ? 'مكتسب' : 'Acquis' };
    }
  };

  // ─── Stats par cours (pour l'élève) ────────────────────────
  const statsByCours = useMemo(() => {
    const result = {};
    cours.forEach(c => {
      const axesCours = axes.filter(a => a.cours_id === c.id);
      const total = axesCours.length;
      let acquis = 0, excellent = 0, aRevoir = 0, nonAcquis = 0;
      axesCours.forEach(a => {
        const s = statutEleve(a.id);
        if (s.statut === 'acquis') acquis++;
        else if (s.statut === 'excellent') excellent++;
        else if (s.statut === 'a_revoir') aRevoir++;
        else if (s.statut === 'non_acquis') nonAcquis++;
      });
      // Validés "positifs" = acquis OU excellent (ce qui compte pour la progression)
      const valides = acquis + excellent;
      result[c.id] = {
        total, valides, acquis, excellent, aRevoir, nonAcquis,
        pct: total > 0 ? Math.round((valides / total) * 100) : 0,
      };
    });
    return result;
    // eslint-disable-next-line
  }, [cours, axes, validationByAxe, exceptionByValidation]);

  // ─── Stats globales pour l'élève ───────────────────────────
  const statsGlobales = useMemo(() => {
    let total = 0, valides = 0;
    Object.values(statsByCours).forEach(s => {
      total += s.total;
      valides += s.valides;
    });
    return { total, valides, pct: total > 0 ? Math.round((valides / total) * 100) : 0 };
  }, [statsByCours]);

  // ─── Historique trié par date (axes avec validation + statut eleve) ──
  const historique = useMemo(() => {
    return validations
      .slice()
      .sort((a, b) => new Date(b.valide_le) - new Date(a.valide_le))
      .map(v => {
        const axe = axes.find(a => a.id === v.axe_id);
        if (!axe) return null;
        const c = cours.find(c => c.id === axe.cours_id);
        const s = statutEleve(axe.id);
        return { validation: v, axe, cours: c, statut: s };
      })
      .filter(Boolean)
      .slice(0, 15);
  }, [validations, axes, cours, validationByAxe, exceptionByValidation]);  // eslint-disable-line

  const nomAffiche = (c) => {
    if (!c) return '';
    if (lang === 'ar') return c.nom_ar;
    if (lang === 'en') return c.nom_en || c.nom_fr || c.nom_ar;
    return c.nom_fr || c.nom_ar;
  };

  // ─── Rendu récursif d'un axe ───────────────────────────────
  const renderAxe = (node, depth = 0) => {
    const s = statutEleve(node.id);
    const val = validationByAxe[node.id];
    const exc = val ? exceptionByValidation[val.id] : null;
    const marge = depth * (isMobile ? 12 : 20);

    return (
      <div key={node.id}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: s.statut === 'non_valide' ? '#fff' : `${s.color}10`,
          border: `1px solid ${s.statut === 'non_valide' ? '#e0e0d8' : s.color + '40'}`,
          borderLeft: `3px solid ${s.color}`,
          borderRadius: 8,
          marginLeft: marge,
          marginBottom: 3,
        }}>
          <div style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
          <div style={{
            minWidth: 36, height: 22, padding: '0 6px',
            borderRadius: 5, background: '#f5f5f0', color: '#666',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, flexShrink: 0,
          }}>{node.path}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#1a1a1a',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{nomAffiche(node)}</div>
            {(val || exc) && (
              <div style={{ fontSize: 10, color: '#888', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.label}</span>
                {val && !exc && (
                  <span>· {new Date(val.valide_le).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { day: '2-digit', month: 'short' })}</span>
                )}
                {exc?.commentaire && <span>· 💬 {exc.commentaire}</span>}
              </div>
            )}
          </div>
        </div>
        {node.enfants.map(e => renderAxe(e, depth + 1))}
      </div>
    );
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>{lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}</div>;

  if (cours.length === 0) {
    return (
      <div style={{
        padding: 30, textAlign: 'center', color: '#888',
        background: '#fff', borderRadius: 12, border: '1px dashed #ccc',
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {lang === 'ar' ? 'لا توجد دروس لمستواه' : 'Aucun cours pour son niveau'}
        </div>
        <div style={{ fontSize: 11, color: '#aaa' }}>
          {lang === 'ar'
            ? 'لا يوجد درس مرتبط بمستوى هذا الطالب'
            : 'Aucun cours n\'est assigné au niveau de cet élève'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 10 : 14 }}>

      {/* KPI globaux de l'élève */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: 14,
        marginBottom: 14, border: '1px solid #e0e0d8',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 8 }}>
          📊 {lang === 'ar' ? 'تقدمه الشخصي' : 'Sa progression personnelle'}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, marginBottom: 10,
        }}>
          <MiniStat label={lang === 'ar' ? 'المحاور' : 'Axes'} value={statsGlobales.total} color="#0C447C" />
          <MiniStat label={lang === 'ar' ? 'مكتسب' : 'Validés'} value={statsGlobales.valides} color="#1D9E75" />
          <MiniStat label={lang === 'ar' ? 'التقدم' : 'Progrès'} value={`${statsGlobales.pct}%`} color="#EF9F27" />
        </div>
        {/* Barre globale */}
        <div style={{ height: 8, background: '#f0f0ec', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            width: `${statsGlobales.pct}%`, height: '100%',
            background: statsGlobales.pct === 100 ? '#1D9E75'
              : statsGlobales.pct >= 50 ? '#378ADD'
              : statsGlobales.pct > 0 ? '#EF9F27'
              : '#ccc',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Un bloc par cours */}
      {cours.map(c => {
        const s = statsByCours[c.id] || { total: 0, valides: 0, pct: 0 };
        const tree = treesByCours[c.id] || [];
        return (
          <div key={c.id} style={{
            background: '#fff', borderRadius: 12, padding: 14,
            marginBottom: 12, border: '1px solid #e0e0d8',
          }}>
            {/* Entête cours */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#E6F1FB', color: '#0C447C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>📚</div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                  {nomAffiche(c)}
                </div>
                {c.categorie && (
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                    📂 {c.categorie}
                  </div>
                )}
              </div>
              <div style={{
                padding: '3px 10px',
                background: s.pct === 100 ? '#E1F5EE' : s.pct > 0 ? '#E6F1FB' : '#f5f5f0',
                color: s.pct === 100 ? '#085041' : s.pct > 0 ? '#0C447C' : '#888',
                borderRadius: 12, fontSize: 11, fontWeight: 700,
              }}>
                {s.valides}/{s.total} · {s.pct}%
              </div>
            </div>

            {/* Barre de progression */}
            <div style={{ height: 6, background: '#f0f0ec', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                width: `${s.pct}%`, height: '100%',
                background: s.pct === 100 ? '#1D9E75' : s.pct >= 50 ? '#378ADD' : s.pct > 0 ? '#EF9F27' : '#ccc',
                transition: 'width 0.3s',
              }} />
            </div>

            {/* Arbre des axes */}
            {tree.length === 0 ? (
              <div style={{ padding: 12, fontSize: 11, color: '#aaa', textAlign: 'center', fontStyle: 'italic' }}>
                {lang === 'ar' ? 'لا توجد محاور في هذا الدرس' : 'Aucun axe dans ce cours'}
              </div>
            ) : (
              <div>{tree.map(node => renderAxe(node, 0))}</div>
            )}
          </div>
        );
      })}

      {/* Historique */}
      {historique.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 14,
          border: '1px solid #e0e0d8',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>
            📜 {lang === 'ar' ? 'آخر التحققات' : 'Historique récent'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {historique.map(h => (
              <div key={h.validation.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: '#f9f9f5', borderRadius: 7,
                fontSize: 11,
              }}>
                <span style={{ fontSize: 14 }}>{h.statut.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {nomAffiche(h.axe)}
                  </div>
                  <div style={{ fontSize: 9, color: '#888' }}>
                    {nomAffiche(h.cours)}
                  </div>
                </div>
                <span style={{ color: '#888', fontSize: 9, flexShrink: 0 }}>
                  {new Date(h.validation.valide_le).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
                    day: '2-digit', month: 'short',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Mini stat card
function MiniStat({ label, value, color }) {
  return (
    <div style={{
      padding: '8px 10px', background: `${color}10`,
      border: `1px solid ${color}30`, borderRadius: 8,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: '#888', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
