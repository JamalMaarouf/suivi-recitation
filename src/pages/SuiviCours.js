import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import ExportButtons from '../components/ExportButtons';
import PageHeader from '../components/PageHeader';
import { useToast } from '../lib/toast';

// ══════════════════════════════════════════════════════════════════════
// PAGE SUIVI COURS — hub principal
//
// Liste tous les cours de l'école et affiche leur avancement agrégé par
// niveau. Clic sur un couple cours × niveau → vue de validation détaillée
// (étape 5 - à venir).
//
// Accès : surveillant + instituteur.
// ══════════════════════════════════════════════════════════════════════

export default function SuiviCours({ user, navigate, goBack, lang, isMobile }) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [cours, setCours] = useState([]);       // cours actifs
  const [niveaux, setNiveaux] = useState([]);   // niveaux de l'école
  const [liaisons, setLiaisons] = useState([]); // cours × niveaux
  const [axes, setAxes] = useState([]);         // tous les axes (pour compter)
  const [validations, setValidations] = useState([]);  // validations existantes

  // ─── Chargement initial ────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    const [coursRes, niveauxRes, liaisonsRes] = await Promise.all([
      supabase.from('cours')
        .select('id, nom_ar, nom_fr, nom_en, categorie, description, annee_estimee, ordre')
        .eq('ecole_id', user.ecole_id)
        .eq('actif', true)
        .order('ordre', { ascending: true }),
      supabase.from('niveaux')
        .select('id, code, nom, couleur, ordre')
        .eq('ecole_id', user.ecole_id)
        .order('ordre', { ascending: true }),
      supabase.from('cours_niveaux')
        .select('cours_id, code_niveau'),
    ]);
    const coursList = coursRes.data || [];
    setCours(coursList);
    setNiveaux(niveauxRes.data || []);
    setLiaisons(liaisonsRes.data || []);

    if (coursList.length > 0) {
      const coursIds = coursList.map(c => c.id);
      const [axesRes, valRes] = await Promise.all([
        supabase.from('cours_axes')
          .select('id, cours_id')
          .in('cours_id', coursIds),
        supabase.from('cours_validations')
          .select('axe_id, code_niveau, qualite')
          .eq('ecole_id', user.ecole_id),
      ]);
      setAxes(axesRes.data || []);
      setValidations(valRes.data || []);
    }
    setLoading(false);
  };
  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, []);

  // Filtrer les liaisons selon les cours/niveaux existants
  const liaisonsValides = useMemo(() => {
    const coursSet = new Set(cours.map(c => c.id));
    const nivSet = new Set(niveaux.map(n => n.code));
    return liaisons.filter(l => coursSet.has(l.cours_id) && nivSet.has(l.code_niveau));
  }, [liaisons, cours, niveaux]);

  // ─── Calcul des stats par cours × niveau ────────────────────
  // Pour chaque liaison, on compte : nb axes total, nb validés
  const statsFor = (coursId, codeNiveau) => {
    const axesCours = axes.filter(a => a.cours_id === coursId);
    const total = axesCours.length;
    if (total === 0) return { total: 0, valides: 0, pct: 0 };
    const axesIds = new Set(axesCours.map(a => a.id));
    const valides = validations.filter(v =>
      v.code_niveau === codeNiveau && axesIds.has(v.axe_id)
    ).length;
    return {
      total,
      valides,
      pct: Math.round((valides / total) * 100),
    };
  };

  // Libellé multi-langue
  const nomAffiche = (c) => {
    if (lang === 'ar') return c.nom_ar;
    if (lang === 'en') return c.nom_en || c.nom_fr || c.nom_ar;
    return c.nom_fr || c.nom_ar;
  };

  // Map niveau par code pour couleur/nom
  const niveauByCode = useMemo(() => {
    const m = {};
    niveaux.forEach(n => { m[n.code] = n; });
    return m;
  }, [niveaux]);

  // Groupement des liaisons par cours pour l'affichage
  const liaisonsByCoursId = useMemo(() => {
    const m = {};
    liaisonsValides.forEach(l => {
      if (!m[l.cours_id]) m[l.cours_id] = [];
      m[l.cours_id].push(l.code_niveau);
    });
    return m;
  }, [liaisonsValides]);

  // Stats globales : % moyen de progression
  const statsGlobales = useMemo(() => {
    let totalAxes = 0, totalValides = 0, totalCoursNiveaux = 0;
    liaisonsValides.forEach(l => {
      const s = statsFor(l.cours_id, l.code_niveau);
      totalAxes += s.total;
      totalValides += s.valides;
      if (s.total > 0) totalCoursNiveaux++;
    });
    return {
      nbCours: cours.length,
      nbLiaisons: liaisonsValides.length,
      totalAxes,
      totalValides,
      pctMoyen: totalAxes > 0 ? Math.round((totalValides / totalAxes) * 100) : 0,
    };
    // eslint-disable-next-line
  }, [cours, liaisonsValides, axes, validations]);

  // ─── Préparer les données d'export ─────────────────────────
  // Retourne 1 ligne par couple (cours, niveau) avec stats
  const prepareExportRows = () => {
    const list = [];
    cours.forEach(c => {
      const codesNiveaux = liaisonsByCoursId[c.id] || [];
      codesNiveaux
        .map(code => niveauByCode[code])
        .filter(Boolean)
        .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        .forEach(n => {
          const s = statsFor(c.id, n.code);
          list.push({
            cours_id: c.id,
            cours_nom: nomAffiche(c),
            cours_categorie: c.categorie || '',
            code_niveau: n.code,
            niveau_nom: n.nom,
            niveau_couleur: n.couleur,
            total: s.total,
            valides: s.valides,
            pct: s.pct,
          });
        });
    });
    return list;
  };

  // ─── Export PDF ────────────────────────────────────────────
  const exportCoursPDF = async () => {
    const rows = prepareExportRows();
    try {
      await openPDF('rapport_cours', {
        ecole: { nom: user.ecole_nom || '' },
        stats: statsGlobales,
        rows,
      }, lang);
    } catch (err) {
      alert('Erreur PDF : ' + err.message);
    }
  };

  // ─── Export Excel ──────────────────────────────────────────
  const exportCoursExcel = async () => {
    const rows = prepareExportRows();
    const headers = [
      '#',
      lang === 'ar' ? 'الدرس' : 'Cours',
      lang === 'ar' ? 'الفئة' : 'Catégorie',
      lang === 'ar' ? 'المستوى' : 'Niveau',
      lang === 'ar' ? 'عدد المحاور' : 'Total axes',
      lang === 'ar' ? 'مُتحقق منها' : 'Axes validés',
      lang === 'ar' ? 'التقدم %' : 'Progression %',
      lang === 'ar' ? 'الحالة' : 'Statut',
    ];
    const dataRows = rows.map((r, i) => {
      const statut = r.pct >= 100
        ? (lang === 'ar' ? 'مكتمل' : 'Complet')
        : r.pct >= 70
          ? (lang === 'ar' ? 'متقدم' : 'Avancé')
          : r.pct >= 30
            ? (lang === 'ar' ? 'جاري' : 'En cours')
            : (lang === 'ar' ? 'ناشئ' : 'Débutant');
      return [
        i + 1,
        r.cours_nom || '',
        r.cours_categorie || '',
        r.niveau_nom || '',
        r.total,
        r.valides,
        r.pct,
        statut,
      ];
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      await exportExcelSimple(
        `cours_progression_${dateStr}.xlsx`,
        [headers, ...dataRows],
        lang === 'ar' ? 'تقدم الدروس' : 'Progression cours',
      );
    } catch (err) {
      alert('Erreur Excel : ' + err.message);
    }
  };

  return (
    <div style={{ background: isMobile ? '#f5f5f0' : 'transparent', minHeight: isMobile ? '100vh' : 'auto', paddingBottom: 80 }}>

      {/* Header */}
      {isMobile ? (
        <div style={{
          background: 'linear-gradient(135deg, #0C447C, #378ADD)',
          color: '#fff', padding: '48px 16px 14px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => goBack ? goBack() : navigate('dashboard')}
              style={{
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10,
                padding: 0, flexShrink: 0, color: '#fff', fontSize: 18, cursor: 'pointer',
              }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                📚 {lang === 'ar' ? 'الدروس' : 'Cours'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {lang === 'ar' ? 'متابعة تقدم الدروس حسب المستوى' : 'Suivi de la progression des cours par niveau'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <PageHeader
            title="Cours"
            titleAr="الدروس"
            icon="📚"
            subtitle={lang === 'ar' ? 'متابعة تقدم الدروس حسب المستوى' : 'Suivi de la progression des cours par niveau'}
            onBack={() => goBack ? goBack() : navigate('dashboard')}
            lang={lang}
            actions={!loading && cours.length > 0 && statsGlobales.nbLiaisons > 0 && (
              <ExportButtons
                onPDF={exportCoursPDF}
                onExcel={exportCoursExcel}
                lang={lang}
                variant="inline"
                compact
              />
            )}
          />
        </div>
      )}

      {/* Contenu */}
      <div style={{ padding: isMobile ? '14px' : '0 1.5rem' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
          </div>
        ) : cours.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center', color: '#888',
            background: '#fff', borderRadius: 12, border: '1px dashed #ccc',
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              {lang === 'ar' ? 'لا توجد دروس بعد' : 'Aucun cours configuré'}
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>
              {lang === 'ar'
                ? 'ابدأ بإضافة دروس من قسم الإدارة'
                : 'Commence par créer des cours depuis la page Gestion'}
            </div>
            {user.role === 'surveillant' && (
              <button onClick={() => navigate('gestion_cours')}
                style={{
                  padding: '10px 18px', background: '#0C447C', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {lang === 'ar' ? '⚙️ إعداد الدروس' : '⚙️ Configurer les cours'}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* KPIs globaux */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: isMobile ? 8 : 10, marginBottom: 14,
            }}>
              <StatCard label={lang === 'ar' ? 'الدروس' : 'Cours'} value={statsGlobales.nbCours} color="#0C447C" bg="#E6F1FB" />
              <StatCard label={lang === 'ar' ? 'أزواج درس/مستوى' : 'Couples cours × niveau'} value={statsGlobales.nbLiaisons} color="#534AB7" bg="#EDE9FE" />
              <StatCard label={lang === 'ar' ? 'محاور مُتحقق منها' : 'Axes validés'} value={`${statsGlobales.totalValides}/${statsGlobales.totalAxes}`} color="#1D9E75" bg="#E1F5EE" />
              <StatCard label={lang === 'ar' ? 'التقدم الإجمالي' : 'Progression moyenne'} value={`${statsGlobales.pctMoyen}%`} color="#EF9F27" bg="#FAEEDA" />
            </div>

            {/* Liste des cours */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cours.map(c => {
                const codesNiveaux = liaisonsByCoursId[c.id] || [];
                // Trier par ordre du niveau
                const niveauxAssignes = codesNiveaux
                  .map(code => niveauByCode[code])
                  .filter(Boolean)
                  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

                return (
                  <div key={c.id} style={{
                    background: '#fff', borderRadius: 14, padding: 16,
                    border: '1px solid #e0e0d8',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    {/* Entête cours */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 13,
                        background: '#E6F1FB', color: '#0C447C',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, flexShrink: 0,
                      }}>📚</div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                          {nomAffiche(c)}
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {c.categorie && <span>📂 {c.categorie}</span>}
                          <span>📝 {axes.filter(a => a.cours_id === c.id).length} {lang === 'ar' ? 'محور' : 'axe(s)'}</span>
                          {c.annee_estimee && (
                            <span>⏱ {c.annee_estimee} {lang === 'ar' ? 'سنة' : 'an(s)'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Liste des niveaux avec leur progression */}
                    {niveauxAssignes.length === 0 ? (
                      <div style={{
                        padding: 12, background: '#f9f9f5', borderRadius: 8,
                        fontSize: 11, color: '#888', textAlign: 'center',
                      }}>
                        {lang === 'ar' ? 'لا توجد مستويات مرتبطة' : 'Aucun niveau assigné'}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {niveauxAssignes.map(n => {
                          const s = statsFor(c.id, n.code);
                          const couleur = n.couleur || '#888';
                          return (
                            <div key={n.code}
                              onClick={() => {
                                if (s.total === 0) {
                                  toast.info(lang === 'ar'
                                    ? 'لا توجد محاور في هذا الدرس بعد'
                                    : 'Aucun axe dans ce cours pour le moment');
                                  return;
                                }
                                navigate('cours_validation', { coursId: c.id, codeNiveau: n.code });
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 12px',
                                background: '#f9f9f5', borderRadius: 10,
                                border: '1px solid #e0e0d8',
                                cursor: s.total > 0 ? 'pointer' : 'default',
                                transition: 'all 0.1s',
                              }}
                              onMouseEnter={e => {
                                if (s.total > 0) {
                                  e.currentTarget.style.background = '#fff';
                                  e.currentTarget.style.borderColor = couleur;
                                }
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#f9f9f5';
                                e.currentTarget.style.borderColor = '#e0e0d8';
                              }}>
                              {/* Pastille niveau */}
                              <div style={{
                                padding: '4px 10px',
                                background: `${couleur}20`, color: couleur,
                                borderRadius: 12, fontSize: 11, fontWeight: 700,
                                border: `1px solid ${couleur}40`,
                                flexShrink: 0, minWidth: 60, textAlign: 'center',
                              }}>{n.nom}</div>

                              {/* Barre de progression */}
                              <div style={{ flex: 1, minWidth: 100 }}>
                                <div style={{
                                  height: 6, background: '#e8e8e2', borderRadius: 999,
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    width: `${s.pct}%`, height: '100%',
                                    background: s.pct === 100 ? '#1D9E75'
                                      : s.pct >= 50 ? '#378ADD'
                                      : s.pct > 0 ? '#EF9F27'
                                      : '#ccc',
                                    transition: 'width 0.3s',
                                  }} />
                                </div>
                                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                                  {s.total === 0
                                    ? (lang === 'ar' ? 'لا محاور بعد' : 'Aucun axe')
                                    : `${s.valides}/${s.total} ${lang === 'ar' ? 'محور' : 'axe(s)'} · ${s.pct}%`}
                                </div>
                              </div>

                              {/* Flèche ou stats */}
                              {s.total > 0 && (
                                <div style={{
                                  fontSize: 18, color: '#bbb',
                                  flexShrink: 0,
                                }}>›</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Mini stat card (utilisée localement)
// ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg }) {
  return (
    <div style={{
      background: bg || '#fff', borderRadius: 10, padding: '10px 12px',
      border: `1px solid ${color}30`,
    }}>
      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
