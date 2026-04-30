import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import ConfirmModal from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';

// ══════════════════════════════════════════════════════════════════════
// PAGE VALIDATION AXES D'UN COURS POUR UN NIVEAU
//
// Le surveillant ou l'instituteur voit l'arbre des axes du cours et
// peut valider chaque axe pour le niveau concerné (Q1 option C : par
// défaut pour tout le niveau, avec possibilité d'exceptions élève).
//
// Workflow :
// 1. Vue en arbre avec statut visuel par axe (⚪ ✅ 🔄 ⭐ 💰)
// 2. Clic sur axe non validé → modale de validation
//    - Choix qualité (acquis / à revoir / excellent)
//    - Commentaire (optionnel)
//    - Sélection des exceptions élève (optionnel, pattern Murajaa)
// 3. Clic sur axe validé → popup détail + option dévalider
// ══════════════════════════════════════════════════════════════════════

export default function CoursValidation({ user, navigate, goBack, lang, isMobile, coursValidation }) {
  const { toast } = useToast();
  const coursId = coursValidation?.coursId;
  const codeNiveau = coursValidation?.codeNiveau;

  // ─── State ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [cours, setCours] = useState(null);
  const [niveau, setNiveau] = useState(null);
  const [axes, setAxes] = useState([]);
  const [validations, setValidations] = useState([]);   // validations pour ce niveau
  const [exceptions, setExceptions] = useState([]);     // exceptions associées
  const [eleves, setEleves] = useState([]);             // élèves du niveau

  // Popup validation
  const [axeActif, setAxeActif] = useState(null);       // axe en cours de validation
  const [validationExistante, setValidationExistante] = useState(null);  // si on rouvre un axe déjà validé
  const [validationDetail, setValidationDetail] = useState(null);  // popup lecture seule

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // ─── Chargement initial ────────────────────────────────────
  const loadData = async () => {
    if (!coursId || !codeNiveau) return;
    setLoading(true);
    const [coursRes, niveauRes, axesRes, valRes, elevesRes] = await Promise.all([
      supabase.from('cours')
        .select('id, nom_ar, nom_fr, nom_en, categorie')
        .eq('id', coursId).maybeSingle(),
      supabase.from('niveaux')
        .select('id, code, nom, couleur')
        .eq('ecole_id', user.ecole_id)
        .eq('code', codeNiveau).maybeSingle(),
      supabase.from('cours_axes')
        .select('id, cours_id, parent_axe_id, nom_ar, nom_fr, nom_en, description, ordre, duree_estimee_seances')
        .eq('cours_id', coursId)
        .order('ordre', { ascending: true }),
      supabase.from('cours_validations')
        .select('id, axe_id, code_niveau, valide_par, valide_le, qualite, commentaire')
        .eq('ecole_id', user.ecole_id)
        .eq('code_niveau', codeNiveau),
      supabase.from('eleves')
        .select('id, prenom, nom, eleve_id_ecole, code_niveau')
        .eq('ecole_id', user.ecole_id)
        .eq('code_niveau', codeNiveau)
        .order('nom'),
    ]);
    setCours(coursRes.data || null);
    setNiveau(niveauRes.data || null);
    setAxes(axesRes.data || []);
    const valsList = valRes.data || [];
    setValidations(valsList);
    setEleves(elevesRes.data || []);

    // Charger les exceptions
    if (valsList.length > 0) {
      const { data: excData } = await supabase.from('cours_validations_exceptions')
        .select('id, validation_id, eleve_id, statut, commentaire')
        .in('validation_id', valsList.map(v => v.id));
      setExceptions(excData || []);
    } else {
      setExceptions([]);
    }
    setLoading(false);
  };
  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [coursId, codeNiveau]);

  // ─── Arbre des axes ────────────────────────────────────────
  const tree = useMemo(() => {
    const byParent = {};
    axes.forEach(a => {
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
    return (byParent._root || []).map((r, i) => buildNode(r, `${i + 1}`));
  }, [axes]);

  // ─── Map validations par axe_id pour lookup rapide ─────────
  const validationByAxeId = useMemo(() => {
    const m = {};
    validations.forEach(v => { m[v.axe_id] = v; });
    return m;
  }, [validations]);

  // ─── Nombre d'exceptions par validation pour badge ─────────
  const exceptionsCountByValidation = useMemo(() => {
    const m = {};
    exceptions.forEach(e => {
      m[e.validation_id] = (m[e.validation_id] || 0) + 1;
    });
    return m;
  }, [exceptions]);

  // ─── Stats globales ────────────────────────────────────────
  const stats = useMemo(() => {
    const total = axes.length;
    const validesList = axes.filter(a => validationByAxeId[a.id]);
    const valides = validesList.length;
    const acquis = validesList.filter(a => validationByAxeId[a.id].qualite === 'acquis').length;
    const excellent = validesList.filter(a => validationByAxeId[a.id].qualite === 'excellent').length;
    const aRevoir = validesList.filter(a => validationByAxeId[a.id].qualite === 'a_revoir').length;
    return { total, valides, acquis, excellent, aRevoir, pct: total > 0 ? Math.round((valides / total) * 100) : 0 };
  }, [axes, validationByAxeId]);

  // ─── Ouvrir modale de validation (ajout ou édition) ────────
  const ouvrirValidation = (axe) => {
    const existante = validationByAxeId[axe.id];
    if (existante) {
      // Déjà validé : afficher en lecture seule + option dévalider
      setValidationDetail({ axe, validation: existante });
    } else {
      // Non validé : ouvrir modale de validation
      setAxeActif(axe);
      setValidationExistante(null);
    }
  };

  // ─── Dévalider un axe ──────────────────────────────────────
  const devalider = (validation) => {
    // Fermer d'abord le popup detail pour eviter le conflit z-index
    // entre les 2 modales qui se superposent
    setValidationDetail(null);
    setConfirmModal({
      isOpen: true,
      title: lang === 'ar' ? '↩️ إلغاء التحقق' : '↩️ Dévalider cet axe',
      message: lang === 'ar'
        ? 'سيتم حذف هذه الموافقة و الاستثناءات المرتبطة. هل تريد المتابعة؟'
        : 'La validation et les exceptions associées seront supprimées. Continuer ?',
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, isOpen: false }));
        // Les exceptions sont supprimées en CASCADE par la FK
        const { error } = await supabase.from('cours_validations').delete().eq('id', validation.id);
        if (error) {
          toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
          return;
        }
        toast.success(lang === 'ar' ? '✅ تم إلغاء التحقق' : '✅ Axe dévalidé');
        loadData();
      },
    });
  };

  // ─── Enregistrer une validation (depuis la modale) ─────────
  const enregistrerValidation = async ({ qualite, commentaire, exceptionsElev }) => {
    if (!axeActif) return { ok: false };
    // Upsert : si validation existe → UPDATE, sinon INSERT
    const existing = validationByAxeId[axeActif.id];
    let validationId;
    if (existing) {
      const { error } = await supabase.from('cours_validations')
        .update({ qualite, commentaire, valide_par: user.id, valide_le: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) return { ok: false, error: error.message };
      validationId = existing.id;
      // Supprimer anciennes exceptions
      await supabase.from('cours_validations_exceptions').delete().eq('validation_id', validationId);
    } else {
      const { data, error } = await supabase.from('cours_validations').insert({
        axe_id: axeActif.id,
        code_niveau: codeNiveau,
        ecole_id: user.ecole_id,
        valide_par: user.id,
        qualite,
        commentaire: commentaire || null,
      }).select('id').maybeSingle();
      if (error) return { ok: false, error: error.message };
      validationId = data?.id;
    }
    // Insérer les exceptions
    if (validationId && exceptionsElev && exceptionsElev.length > 0) {
      const { error: excError } = await supabase.from('cours_validations_exceptions').insert(
        exceptionsElev.map(exc => ({
          validation_id: validationId,
          eleve_id: exc.eleve_id,
          statut: exc.statut,
          commentaire: exc.commentaire || null,
        }))
      );
      if (excError) {
        return { ok: false, error: 'Validation OK mais erreur sur exceptions : ' + excError.message };
      }
    }
    toast.success(lang === 'ar' ? '✅ تم التحقق من المحور' : '✅ Axe validé');
    setAxeActif(null);
    loadData();
    return { ok: true };
  };

  // ─── Helpers affichage ─────────────────────────────────────
  const nomAffiche = (a) => {
    if (!a) return '';
    if (lang === 'ar') return a.nom_ar;
    if (lang === 'en') return a.nom_en || a.nom_fr || a.nom_ar;
    return a.nom_fr || a.nom_ar;
  };

  // Statut visuel d'un axe : emoji + couleur
  const statutVisuel = (axe) => {
    const val = validationByAxeId[axe.id];
    if (!val) return { icon: '⚪', color: '#ccc', label: lang === 'ar' ? 'غير مُتحقق' : 'Non validé' };
    switch (val.qualite) {
      case 'excellent': return { icon: '⭐', color: '#EF9F27', label: lang === 'ar' ? 'ممتاز' : 'Excellent' };
      case 'a_revoir':  return { icon: '🔄', color: '#378ADD', label: lang === 'ar' ? 'للمراجعة' : 'À revoir' };
      default:          return { icon: '✅', color: '#1D9E75', label: lang === 'ar' ? 'مكتسب' : 'Acquis' };
    }
  };

  // Timeline : liste des validations triées par date décroissante
  const timeline = useMemo(() => {
    return validations
      .slice()
      .sort((a, b) => new Date(b.valide_le) - new Date(a.valide_le))
      .map(v => ({
        validation: v,
        axe: axes.find(a => a.id === v.axe_id),
      }))
      .filter(t => t.axe);
  }, [validations, axes]);

  // ─── Rendu arbre récursif ──────────────────────────────────
  const renderNode = (node, depth = 0) => {
    const sv = statutVisuel(node);
    const val = validationByAxeId[node.id];
    const nbExceptions = val ? (exceptionsCountByValidation[val.id] || 0) : 0;
    const marge = depth * (isMobile ? 14 : 24);

    return (
      <div key={node.id}>
        <div
          onClick={() => ouvrirValidation(node)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            background: val ? `${sv.color}10` : '#fff',
            border: `1px solid ${val ? sv.color + '40' : '#e0e0d8'}`,
            borderLeft: `4px solid ${sv.color}`,
            borderRadius: 10,
            marginLeft: marge,
            marginBottom: 4,
            cursor: 'pointer',
            transition: 'all 0.1s',
            boxShadow: val ? `0 1px 3px ${sv.color}20` : 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
        >
          <div style={{ fontSize: 22, flexShrink: 0 }}>{sv.icon}</div>
          <div style={{
            minWidth: 42, height: 24, padding: '0 6px',
            borderRadius: 6, background: '#f5f5f0', color: '#666',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, flexShrink: 0,
          }}>{node.path}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: '#1a1a1a',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{nomAffiche(node)}</div>
            {val && (
              <div style={{ fontSize: 10, color: '#888', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: sv.color, fontWeight: 700 }}>{sv.label}</span>
                <span>· {new Date(val.valide_le).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}</span>
                {nbExceptions > 0 && (
                  <span style={{
                    padding: '1px 6px', background: '#FCEBEB', color: '#A32D2D',
                    borderRadius: 4, fontWeight: 700,
                  }}>⚠️ {nbExceptions} {lang === 'ar' ? 'استثناء' : 'exc.'}</span>
                )}
              </div>
            )}
          </div>
        </div>
        {node.enfants.map(e => renderNode(e, depth + 1))}
      </div>
    );
  };

  // Nom cours pour le titre
  const nomCours = cours ? nomAffiche(cours) : '';
  const couleurNiveau = niveau?.couleur || '#0C447C';

  return (
    <div style={{ background: isMobile ? '#f5f5f0' : 'transparent', minHeight: isMobile ? '100vh' : 'auto', paddingBottom: 80 }}>

      {/* Header */}
      {isMobile ? (
        <div style={{
          background: `linear-gradient(135deg, ${couleurNiveau}, ${couleurNiveau}dd)`,
          color: '#fff', padding: '48px 16px 14px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => goBack ? goBack() : navigate('cours')}
              style={{
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10,
                padding: 0, flexShrink: 0, color: '#fff', fontSize: 18, cursor: 'pointer',
              }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                📚 {nomCours}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {lang === 'ar' ? 'المستوى:' : 'Niveau :'} {niveau?.nom || codeNiveau}
                {' · '}
                {stats.valides}/{stats.total} {lang === 'ar' ? 'محور' : 'axes'} ({stats.pct}%)
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <PageHeader
            title={nomCours}
            icon="📚"
            titleSuffix={niveau && (
              <span style={{
                padding: '3px 12px',
                background: `${couleurNiveau}20`, color: couleurNiveau,
                borderRadius: 20, fontSize: 13, fontWeight: 700,
                border: `1px solid ${couleurNiveau}40`,
              }}>{niveau.nom}</span>
            )}
            subtitle={lang === 'ar'
              ? 'انقر على محور للتحقق منه أو لرؤية التفاصيل'
              : 'Clique sur un axe pour le valider ou voir les détails'}
            onBack={() => goBack ? goBack() : navigate('cours')}
            lang={lang}
          />
        </div>
      )}

      <div style={{ padding: isMobile ? '14px' : '0 1.5rem' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
          </div>
        ) : !cours || !niveau ? (
          <div style={{
            padding: 30, textAlign: 'center', color: '#888',
            background: '#fff', borderRadius: 12, border: '1px dashed #ccc',
          }}>
            {lang === 'ar' ? 'البيانات غير موجودة' : 'Données introuvables'}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: isMobile ? 8 : 10, marginBottom: 14,
            }}>
              <Kpi label={lang === 'ar' ? 'الإجمالي' : 'Total'} value={stats.total} color="#0C447C" bg="#E6F1FB" />
              <Kpi label={lang === 'ar' ? 'مُتحقق' : 'Validés'} value={`${stats.valides}/${stats.total}`} color="#1D9E75" bg="#E1F5EE" />
              <Kpi label={lang === 'ar' ? 'ممتاز' : 'Excellent'} value={stats.excellent} color="#EF9F27" bg="#FAEEDA" />
              <Kpi label={lang === 'ar' ? 'للمراجعة' : 'À revoir'} value={stats.aRevoir} color="#378ADD" bg="#E6F1FB" />
            </div>

            {/* Barre progression globale */}
            <div style={{
              background: '#fff', borderRadius: 10, padding: 14,
              marginBottom: 14, border: '1px solid #e0e0d8',
            }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>
                {lang === 'ar' ? 'التقدم الإجمالي' : 'Progression globale'}
              </div>
              <div style={{
                height: 10, background: '#f0f0ec', borderRadius: 999, overflow: 'hidden',
                display: 'flex',
              }}>
                {stats.excellent > 0 && (
                  <div title={`${stats.excellent} excellent`}
                    style={{ width: `${(stats.excellent / stats.total) * 100}%`, background: '#EF9F27' }} />
                )}
                {stats.acquis > 0 && (
                  <div title={`${stats.acquis} acquis`}
                    style={{ width: `${(stats.acquis / stats.total) * 100}%`, background: '#1D9E75' }} />
                )}
                {stats.aRevoir > 0 && (
                  <div title={`${stats.aRevoir} à revoir`}
                    style={{ width: `${(stats.aRevoir / stats.total) * 100}%`, background: '#378ADD' }} />
                )}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 6, textAlign: 'center' }}>
                {stats.valides}/{stats.total} {lang === 'ar' ? 'محور · ' : 'axes · '}
                <strong>{stats.pct}%</strong>
              </div>
            </div>

            {/* Arbre */}
            {tree.length === 0 ? (
              <div style={{
                padding: 30, textAlign: 'center', color: '#888',
                background: '#fff', borderRadius: 12, border: '1px dashed #ccc',
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {lang === 'ar' ? 'لا توجد محاور' : 'Aucun axe dans ce cours'}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                {tree.map(node => renderNode(node, 0))}
              </div>
            )}

            {/* Timeline */}
            {timeline.length > 0 && (
              <div style={{
                background: '#fff', borderRadius: 12, padding: 16,
                border: '1px solid #e0e0d8',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>
                  📜 {lang === 'ar' ? 'آخر التحققات' : 'Historique des validations'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {timeline.slice(0, 10).map(t => {
                    const sv = statutVisuel(t.axe);
                    return (
                      <div key={t.validation.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 10px', background: '#f9f9f5', borderRadius: 8,
                        fontSize: 12,
                      }}>
                        <span style={{ fontSize: 16 }}>{sv.icon}</span>
                        <span style={{ flex: 1, color: '#1a1a1a' }}>
                          {nomAffiche(t.axe)}
                        </span>
                        <span style={{ color: '#888', fontSize: 10 }}>
                          {new Date(t.validation.valide_le).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
                            day: '2-digit', month: 'short',
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modale validation (pattern Murajaa) */}
      {axeActif && (
        <ModaleValidation
          axe={axeActif}
          axeLabel={nomAffiche(axeActif)}
          niveau={niveau}
          eleves={eleves}
          existante={validationExistante}
          onClose={() => setAxeActif(null)}
          onConfirm={enregistrerValidation}
          lang={lang}
          isMobile={isMobile}
        />
      )}

      {/* Popup détail validation */}
      {validationDetail && (
        <PopupDetailValidation
          axe={validationDetail.axe}
          axeLabel={nomAffiche(validationDetail.axe)}
          validation={validationDetail.validation}
          exceptions={exceptions.filter(e => e.validation_id === validationDetail.validation.id)}
          eleves={eleves}
          onClose={() => setValidationDetail(null)}
          onDevalider={() => devalider(validationDetail.validation)}
          onModifier={() => {
            setAxeActif(validationDetail.axe);
            setValidationExistante(validationDetail.validation);
            setValidationDetail(null);
          }}
          lang={lang}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(m => ({ ...m, isOpen: false }))}
        lang={lang}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Kpi mini card
// ──────────────────────────────────────────────────────────────
function Kpi({ label, value, color, bg }) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: '10px 12px',
      border: `1px solid ${color}30`,
    }}>
      <div style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MODALE DE VALIDATION (pattern Murajaa : 3 étapes avec barre segmentée)
// 1. Qualité (acquis / à revoir / excellent) + commentaire
// 2. Tous les élèves OU exceptions
// 3. Si exceptions : recherche + liste à cocher
// ══════════════════════════════════════════════════════════════════════
function ModaleValidation({ axe, axeLabel, niveau, eleves, existante, onClose, onConfirm, lang, isMobile }) {
  // Étapes : 1 = qualité, 2 = mode élèves, 3 = exceptions
  const [etape, setEtape] = useState(1);
  const [qualite, setQualite] = useState(existante?.qualite || 'acquis');
  const [commentaire, setCommentaire] = useState(existante?.commentaire || '');
  // Mode : 'tous' ou 'exceptions'
  const [mode, setMode] = useState('tous');
  // Exceptions : Map eleve_id → { statut, commentaire }
  const [exceptionsMap, setExceptionsMap] = useState({});
  const [recherche, setRecherche] = useState('');
  const [saving, setSaving] = useState(false);

  const elevesFiltres = useMemo(() => {
    if (!recherche.trim()) return eleves;
    const r = recherche.trim().toLowerCase();
    return eleves.filter(e =>
      (e.prenom || '').toLowerCase().includes(r) ||
      (e.nom || '').toLowerCase().includes(r) ||
      (e.eleve_id_ecole || '').toLowerCase().includes(r)
    );
  }, [eleves, recherche]);

  const nbExceptions = Object.keys(exceptionsMap).length;

  const toggleException = (eleve, statut = 'a_revoir') => {
    setExceptionsMap(m => {
      const n = { ...m };
      if (n[eleve.id]) delete n[eleve.id];
      else n[eleve.id] = { statut, commentaire: '' };
      return n;
    });
  };

  const changerStatutException = (eleveId, statut) => {
    setExceptionsMap(m => ({ ...m, [eleveId]: { ...m[eleveId], statut } }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    const exceptionsElev = Object.entries(exceptionsMap).map(([eleve_id, exc]) => ({
      eleve_id,
      statut: exc.statut,
      commentaire: exc.commentaire || null,
    }));
    const res = await onConfirm({ qualite, commentaire, exceptionsElev });
    setSaving(false);
    if (!res.ok) {
      alert(res.error || 'Erreur');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          padding: 24, maxWidth: 560, width: '100%',
          maxHeight: '92vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: '#E1F5EE', color: '#085041',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>✅</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>
              {lang === 'ar' ? 'التحقق من المحور' : 'Valider l\'axe'}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {axeLabel}
            </div>
          </div>
          <button onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: '#f5f5f0', color: '#666', border: 'none',
              fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
              flexShrink: 0,
            }}>✕</button>
        </div>

        {/* Barre 3 étapes */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 4, background: '#f5f5f0', padding: 4, borderRadius: 10,
          marginBottom: 16,
        }}>
          {[
            { n: 1, label: lang === 'ar' ? 'الجودة' : 'Qualité' },
            { n: 2, label: lang === 'ar' ? 'الطلاب' : 'Élèves' },
            { n: 3, label: lang === 'ar' ? 'تأكيد' : 'Confirmer' },
          ].map(s => {
            const active = s.n === etape;
            const done = s.n < etape;
            return (
              <div key={s.n} style={{
                padding: '8px 4px', textAlign: 'center',
                borderRadius: 7,
                background: active ? '#085041' : done ? '#E1F5EE' : 'transparent',
                color: active ? '#fff' : done ? '#085041' : '#888',
                fontSize: 11, fontWeight: 700,
              }}>
                {done ? '✓ ' : ''}{s.label}
              </div>
            );
          })}
        </div>

        {/* ─── ÉTAPE 1 : Qualité + commentaire ─── */}
        {etape === 1 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 8 }}>
              {lang === 'ar' ? 'جودة التحقق' : 'Qualité de la validation'}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, marginBottom: 14,
            }}>
              {[
                { v: 'acquis',    emoji: '✅', label: lang === 'ar' ? 'مكتسب' : 'Acquis', color: '#1D9E75', bg: '#E1F5EE' },
                { v: 'a_revoir',  emoji: '🔄', label: lang === 'ar' ? 'للمراجعة' : 'À revoir', color: '#378ADD', bg: '#E6F1FB' },
                { v: 'excellent', emoji: '⭐', label: lang === 'ar' ? 'ممتاز' : 'Excellent', color: '#EF9F27', bg: '#FAEEDA' },
              ].map(q => {
                const active = qualite === q.v;
                return (
                  <button key={q.v} onClick={() => setQualite(q.v)}
                    style={{
                      padding: '14px 8px',
                      background: active ? q.bg : '#fff',
                      border: `2px solid ${active ? q.color : '#e0e0d8'}`,
                      borderRadius: 12, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{q.emoji}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? q.color : '#666' }}>
                      {q.label}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>
                💬 {lang === 'ar' ? 'تعليق (اختياري)' : 'Commentaire (optionnel)'}
              </label>
              <textarea
                value={commentaire}
                onChange={e => setCommentaire(e.target.value)}
                placeholder={lang === 'ar' ? 'مثلا: فهم جيد، يستحق المراجعة بعد أسبوعين' : 'ex: Bonne compréhension, à revoir dans 2 semaines'}
                rows={2}
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 13,
                  borderRadius: 10, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  resize: 'vertical',
                }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose}
                style={{
                  flex: 1, padding: '12px',
                  background: '#f5f5f0', color: '#666',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {lang === 'ar' ? 'إلغاء' : 'Annuler'}
              </button>
              <button onClick={() => setEtape(2)}
                style={{
                  flex: 2, padding: '12px',
                  background: '#085041', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {lang === 'ar' ? 'التالي →' : 'Suivant →'}
              </button>
            </div>
          </>
        )}

        {/* ─── ÉTAPE 2 : Mode élèves (tous ou exceptions) ─── */}
        {etape === 2 && (
          <>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
              {lang === 'ar'
                ? 'هل التحقق يشمل جميع طلاب المستوى؟'
                : 'Le validation concerne-t-elle tous les élèves du niveau ?'}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 8, marginBottom: 14,
            }}>
              <button onClick={() => { setMode('tous'); setExceptionsMap({}); }}
                style={{
                  padding: '18px 10px', textAlign: 'center',
                  background: mode === 'tous' ? '#E1F5EE' : '#fff',
                  border: `2px solid ${mode === 'tous' ? '#1D9E75' : '#e0e0d8'}`,
                  borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: mode === 'tous' ? '#085041' : '#666' }}>
                  {lang === 'ar' ? 'نعم، جميع الطلاب' : 'Oui, tous les élèves'}
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                  {eleves.length} {lang === 'ar' ? 'طالب' : 'élève(s)'}
                </div>
              </button>
              <button onClick={() => setMode('exceptions')}
                style={{
                  padding: '18px 10px', textAlign: 'center',
                  background: mode === 'exceptions' ? '#FAEEDA' : '#fff',
                  border: `2px solid ${mode === 'exceptions' ? '#EF9F27' : '#e0e0d8'}`,
                  borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: mode === 'exceptions' ? '#633806' : '#666' }}>
                  {lang === 'ar' ? 'لا، هناك استثناءات' : 'Non, des exceptions'}
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                  {lang === 'ar' ? 'اختيار الطلاب' : 'Sélectionner les élèves'}
                </div>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEtape(1)}
                style={{
                  padding: '12px 18px',
                  background: '#f5f5f0', color: '#666',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>← {lang === 'ar' ? 'السابق' : 'Retour'}</button>
              <button onClick={() => setEtape(mode === 'tous' ? 3 : 3)}
                style={{
                  flex: 1, padding: '12px',
                  background: '#085041', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {lang === 'ar' ? 'التالي →' : 'Suivant →'}
              </button>
            </div>
          </>
        )}

        {/* ─── ÉTAPE 3 : Exceptions ou confirmation ─── */}
        {etape === 3 && mode === 'exceptions' && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 8 }}>
              {lang === 'ar' ? 'اختر الطلاب المستثنين' : 'Sélectionne les élèves exceptions'}
            </div>
            <input type="text"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              placeholder={lang === 'ar' ? '🔍 بحث بالاسم أو الرقم' : '🔍 Rechercher par nom ou numéro'}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 13,
                borderRadius: 10, border: '1px solid #e0e0d8',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                marginBottom: 10,
              }} />
            <div style={{
              maxHeight: 240, overflowY: 'auto',
              background: '#f9f9f5', borderRadius: 10,
              border: '1px solid #e0e0d8', marginBottom: 10,
            }}>
              {elevesFiltres.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12 }}>
                  {lang === 'ar' ? 'لا نتائج' : 'Aucun résultat'}
                </div>
              ) : (
                elevesFiltres.map(e => {
                  const exc = exceptionsMap[e.id];
                  return (
                    <div key={e.id} style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid #eee',
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    }}>
                      <div onClick={() => toggleException(e)}
                        style={{
                          width: 20, height: 20, borderRadius: 5,
                          border: `2px solid ${exc ? '#EF9F27' : '#c0c0b8'}`,
                          background: exc ? '#EF9F27' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 13, fontWeight: 800,
                          cursor: 'pointer', flexShrink: 0,
                        }}>{exc && '✓'}</div>
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggleException(e)}>
                        {e.eleve_id_ecole && (
                          <span style={{
                            padding: '1px 6px', background: '#EDE9FE', color: '#534AB7',
                            borderRadius: 4, fontSize: 10, fontWeight: 700, marginRight: 6,
                          }}>{e.eleve_id_ecole}</span>
                        )}
                        <span style={{ fontSize: 13 }}>{e.prenom} {e.nom}</span>
                      </div>
                      {exc && (
                        <select value={exc.statut}
                          onChange={ev => changerStatutException(e.id, ev.target.value)}
                          style={{
                            padding: '4px 6px', fontSize: 11, borderRadius: 6,
                            border: '1px solid #EF9F2740', fontFamily: 'inherit',
                          }}>
                          <option value="a_revoir">🔄 {lang === 'ar' ? 'للمراجعة' : 'À revoir'}</option>
                          <option value="non_acquis">❌ {lang === 'ar' ? 'غير مكتسب' : 'Non acquis'}</option>
                          <option value="absent">⭕ {lang === 'ar' ? 'غائب' : 'Absent'}</option>
                        </select>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10, textAlign: 'right' }}>
              {nbExceptions} {lang === 'ar' ? 'استثناء محدد' : 'exception(s)'} · {eleves.length - nbExceptions} {lang === 'ar' ? 'مكتسب' : 'validé(s)'}
            </div>
          </>
        )}

        {etape === 3 && mode === 'tous' && (
          <div style={{
            padding: 20, background: '#E1F5EE', borderRadius: 10,
            border: '1px solid #1D9E7530', marginBottom: 14,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#085041', marginBottom: 4 }}>
              {lang === 'ar'
                ? `سيتم التحقق من المحور لـ ${eleves.length} طالب`
                : `Validation pour les ${eleves.length} élèves du niveau`}
            </div>
            <div style={{ fontSize: 11, color: '#888' }}>
              {lang === 'ar' ? 'بدون استثناءات' : 'Sans exceptions'}
            </div>
          </div>
        )}

        {etape === 3 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEtape(2)}
              style={{
                padding: '12px 18px',
                background: '#f5f5f0', color: '#666',
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>← {lang === 'ar' ? 'السابق' : 'Retour'}</button>
            <button onClick={handleSubmit} disabled={saving}
              style={{
                flex: 1, padding: '12px',
                background: saving ? '#888' : '#1D9E75',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}>
              {saving ? '...' : `✓ ${lang === 'ar' ? 'تأكيد التحقق' : 'Confirmer la validation'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// POPUP DETAIL VALIDATION (axe déjà validé)
// Lecture seule + boutons Modifier / Dévalider
// ══════════════════════════════════════════════════════════════════════
function PopupDetailValidation({ axe, axeLabel, validation, exceptions, eleves, onClose, onDevalider, onModifier, lang }) {
  const qualiteInfo = {
    acquis:    { emoji: '✅', label: lang === 'ar' ? 'مكتسب' : 'Acquis', color: '#1D9E75' },
    a_revoir:  { emoji: '🔄', label: lang === 'ar' ? 'للمراجعة' : 'À revoir', color: '#378ADD' },
    excellent: { emoji: '⭐', label: lang === 'ar' ? 'ممتاز' : 'Excellent', color: '#EF9F27' },
  }[validation.qualite] || { emoji: '✅', label: 'Acquis', color: '#1D9E75' };

  const exceptionsDetail = exceptions.map(exc => ({
    ...exc,
    eleve: eleves.find(e => e.id === exc.eleve_id),
  })).filter(e => e.eleve);

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          padding: 24, maxWidth: 520, width: '100%',
          maxHeight: '92vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: `${qualiteInfo.color}20`, color: qualiteInfo.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, flexShrink: 0,
          }}>{qualiteInfo.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>
              {axeLabel}
            </div>
            <div style={{ fontSize: 11, color: qualiteInfo.color, fontWeight: 700, marginTop: 2 }}>
              {qualiteInfo.label}
            </div>
          </div>
          <button onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: '#f5f5f0', color: '#666', border: 'none',
              fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
            }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
          📅 {lang === 'ar' ? 'تم التحقق في' : 'Validé le'} {new Date(validation.valide_le).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </div>

        {validation.commentaire && (
          <div style={{
            background: '#f9f9f5', padding: 12, borderRadius: 8,
            marginBottom: 14, fontSize: 12, color: '#555',
            borderLeft: `3px solid ${qualiteInfo.color}`,
          }}>
            💬 {validation.commentaire}
          </div>
        )}

        {exceptionsDetail.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 8 }}>
              ⚠️ {exceptionsDetail.length} {lang === 'ar' ? 'استثناء' : 'exception(s)'}
            </div>
            <div style={{
              background: '#FAEEDA', padding: 10, borderRadius: 8,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {exceptionsDetail.map(e => {
                const statutLabel = {
                  a_revoir:   lang === 'ar' ? 'للمراجعة' : 'À revoir',
                  non_acquis: lang === 'ar' ? 'غير مكتسب' : 'Non acquis',
                  absent:     lang === 'ar' ? 'غائب' : 'Absent',
                }[e.statut] || e.statut;
                return (
                  <div key={e.id} style={{ fontSize: 12, color: '#633806' }}>
                    · <strong>{e.eleve.prenom} {e.eleve.nom}</strong> — {statutLabel}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onDevalider}
            style={{
              flex: 1, padding: '10px',
              background: '#FCEBEB', color: '#A32D2D',
              border: '1px solid #E24B4A30', borderRadius: 10,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ↩️ {lang === 'ar' ? 'إلغاء التحقق' : 'Dévalider'}
          </button>
          <button onClick={onModifier}
            style={{
              flex: 2, padding: '10px',
              background: '#085041', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ✏️ {lang === 'ar' ? 'تعديل' : 'Modifier'}
          </button>
        </div>
      </div>
    </div>
  );
}
