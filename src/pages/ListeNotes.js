import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { calcEtatEleve, calcPointsPeriode, loadBareme, BAREME_DEFAUT, getSensForEleve, loadAnneeActiveAvecPeriodes, formatPeriodeCourte, detecterPeriodeEnCours} from '../lib/helpers';
import PeriodeSelectorHybride from '../components/PeriodeSelectorHybride';
import { t } from '../lib/i18n';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import { fetchAll } from '../lib/fetchAll';
import ExportButtons from '../components/ExportButtons';
import PageHeader from '../components/PageHeader';
import { usePullToRefresh, PullToRefreshIndicator } from '../lib/usePullToRefresh';
import { MobileHeader, HeaderMenu, actionsExport, ListRow, Avatar, LevelBadge, EmptyState, C } from '../components/ui';
import { Star } from 'lucide-react';
import { correspondRecherche } from '../lib/recherche';
import useEtatMemorise from '../lib/useEtatMemorise';

export default function ListeNotes({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [eleves, setEleves] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [pointsEvts, setPointsEvts] = useState([]);
  const [allRecitations, setAllRecitations] = useState([]);
  const [allCertificats, setAllCertificats] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [bareme, setBareme] = useState({ unites:{...BAREME_DEFAUT}, examens:{}, ensembles:{}, jalons:{} });
  const [loading, setLoading] = useState(true);
  const [genPdf, setGenPdf] = useState(false);

  // Filtres
  const [searchNum, setSearchNum] = useEtatMemorise(`notes:${user?.ecole_id}:searchNum`, '');
  const [filtreNiveau, setFiltreNiveau] = useEtatMemorise(`notes:${user?.ecole_id}:filtreNiveau`, '');
  const [filtreInst, setFiltreInst] = useEtatMemorise(`notes:${user?.ecole_id}:filtreInst`, '');
  const [dateDebut, setDateDebut] = useEtatMemorise(`notes:${user?.ecole_id}:dateDebut`, '');
  const [dateFin, setDateFin] = useEtatMemorise(`notes:${user?.ecole_id}:dateFin`, '');
  const [periode, setPeriode] = useEtatMemorise(`notes:${user?.ecole_id}:periode`, 'total');
  const [periodesBDD, setPeriodesBDD] = useState([]); // Etape 14 v2 - trimestres + semestres
  const [anneeActive, setAnneeActive] = useState(null); // Etape 14 v2

  useEffect(() => { loadData(); }, []);

  // Etape 14 v2 - Charger annee active + ses periodes typees (T, S)
  useEffect(() => {
    if (!user?.ecole_id) return;
    loadAnneeActiveAvecPeriodes(supabase, user.ecole_id).then(({ annee, periodes }) => {
      setAnneeActive(annee);
      setPeriodesBDD(periodes.filter(p => p.type === 'trimestre' || p.type === 'semestre'));
    });
  }, [user?.ecole_id]);

  const loadData = async () => {
    setLoading(true);
    try {
    // FIX-BAREME (sep 2026) : charger AUSSI recitations_sourates et certificats
    // pour que les eleves recitant en sourates aient enfin leurs points comptes.
    const [{ data: el }, { data: vd }, { data: pe }, { data: inst }, { data: niv }, { data: rs }, { data: cert }] = await Promise.all([
      // FIX (oct 2026) : exclure les eleves suspendus du classement
      supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole,hizb_depart,tomon_depart,instituteur_referent_id').eq('ecole_id', user.ecole_id).is('suspendu_at', null).order('nom'),
      fetchAll(supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,date_validation,ensemble_id,is_muraja').eq('ecole_id', user.ecole_id)).then(data=>({data})),
      // FIX (oct 2026) : pagination (>1000 lignes tronquees sinon)
      fetchAll(supabase.from('points_eleves').select('*').eq('ecole_id', user.ecole_id).order('created_at', {ascending:false})).then(data=>({data})),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
      supabase.from('niveaux').select('id,code,nom,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
      fetchAll(supabase.from('recitations_sourates').select('id,eleve_id,type_recitation,is_muraja,points,date_validation').eq('ecole_id', user.ecole_id)).then(data=>({data})),
      // FIX (oct 2026) : la colonne s'appelle date_emission (date_obtention n'existe pas -> select en erreur -> 0 pt certificat)
      supabase.from('certificats_eleves').select('id,eleve_id,jalon_id,date_emission,created_at').eq('ecole_id', user.ecole_id),
    ]);
    setEleves(el || []);
    setAllValidations(vd || []);
    setPointsEvts(pe || []);
    setInstituteurs(inst || []);
    setNiveaux(niv || []);
    setAllRecitations(rs || []);
    // FIX (oct 2026) : mapper date_emission -> date_obtention attendu par calcPointsPeriode
    setAllCertificats((cert || []).map(c => ({ ...c, date_obtention: c.date_emission })));
    const b = await loadBareme(supabase, user.ecole_id);
    setBareme(b);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const getPeriodeDates = () => {
    const now = new Date();
    if (periode === 'total') return { debut: new Date('2000-01-01'), fin: now };
    if (periode === 'semaine') return { debut: new Date(now.getTime()-7*86400000), fin: now };
    if (periode === 'mois') return { debut: new Date(now.getFullYear(),now.getMonth(),1), fin: now };
    // Etape 14 v2 - Annee scolaire active
    if (periode === 'annee_scolaire' && anneeActive) {
      return { debut: new Date(anneeActive.date_debut), fin: new Date(anneeActive.date_fin+'T23:59:59') };
    }
    // Etape 14 v2 - Periode BDD typee
    if (periode && typeof periode === 'string' && periode.startsWith('bdd_')) {
      const id = periode.substring(4);
      const p = periodesBDD.find(x => x.id === id);
      if (p) return { debut: new Date(p.date_debut), fin: new Date(p.date_fin+'T23:59:59') };
    }
    if (periode === 'custom' && dateDebut && dateFin) return { debut: new Date(dateDebut), fin: new Date(dateFin+'T23:59:59') };
    return { debut: new Date('2000-01-01'), fin: now };
  };

  const elevesAvecPts = useMemo(() => {
    const { debut, fin } = getPeriodeDates();
    // Index O(1) au lieu de filtrer n fois
    const valsByEleve = new Map();
    allValidations.forEach(v => {
      if (!valsByEleve.has(v.eleve_id)) valsByEleve.set(v.eleve_id, []);
      valsByEleve.get(v.eleve_id).push(v);
    });
    const evtsByEleve = new Map();
    pointsEvts.forEach(p => {
      if (!evtsByEleve.has(p.eleve_id)) evtsByEleve.set(p.eleve_id, []);
      evtsByEleve.get(p.eleve_id).push(p);
    });
    // FIX-BAREME (sep 2026) : idem pour recitations + certificats
    const recsByEleve = new Map();
    allRecitations.forEach(r => {
      if (!recsByEleve.has(r.eleve_id)) recsByEleve.set(r.eleve_id, []);
      recsByEleve.get(r.eleve_id).push(r);
    });
    const certsByEleve = new Map();
    allCertificats.forEach(c => {
      if (!certsByEleve.has(c.eleve_id)) certsByEleve.set(c.eleve_id, []);
      certsByEleve.get(c.eleve_id).push(c);
    });
    const instById = new Map(instituteurs.map(i => [i.id, i]));

    return eleves.map(el => {
      const vals = valsByEleve.get(el.id) || [];
      const evts = evtsByEleve.get(el.id) || [];
      const recs = recsByEleve.get(el.id) || [];
      const certs = certsByEleve.get(el.id) || [];
      const pts = calcPointsPeriode(vals, debut, fin, bareme, evts, recs, certs);
      const inst = instById.get(el.instituteur_referent_id);
      return { ...el, pts, instNom: inst ? `${inst.prenom} ${inst.nom}` : '—' };
    }).sort((a, b) => b.pts.total - a.pts.total);
  }, [eleves, allValidations, pointsEvts, allRecitations, allCertificats, bareme, periode, dateDebut, dateFin, periodesBDD, anneeActive]);

  const filtered = elevesAvecPts.filter(el => {
    if (searchNum && !correspondRecherche(searchNum, el.prenom, el.nom, el.eleve_id_ecole)) return false;
    if (filtreNiveau && el.code_niveau !== filtreNiveau) return false;
    if (filtreInst && el.instituteur_referent_id !== filtreInst) return false;
    return true;
  });

  const getNivColor = (code) => niveaux.find(n=>n.code===code)?.couleur || '#888';

  // Colonnes communes ecran / PDF / Excel (oct 2026). Avant : les exports lisaient
  // details.nbTomon (champ inexistant -> toujours 0) et ignoraient sourates/ensembles.
  const colonnesNotes = (pts) => ({
    // FIX (oct 2026) : les sourates en muraja ne sont pas des sourates memorisees (leurs points restent dans le total)
    tomonSourates: (pts?.tomonPeriode||0) + (pts?.nbSouratesCompletes||0),
    hizb: pts?.hizbsPeriode || 0,
    ensembles: pts?.nbEnsemblesComplets || 0,
    ptsExamens: pts?.ptsExamens || 0,
    ptsCertificats: pts?.ptsCertificats || 0,
  });

  // ── PDF export ─────────────────────────────────────────────
  const handlePdfExport = async () => {
    if (genPdf || filtered.length === 0) return;
    setGenPdf(true);
    try {
      const periodeLabel = getPeriodeLabel();
      const elevesData = filtered.map(el => ({
        prenom: el.prenom || '',
        nom: el.nom || '',
        eleve_id_ecole: el.eleve_id_ecole || '',
        code_niveau: el.code_niveau || '',
        couleur: getNivColor(el.code_niveau),
        instituteur: el.instNom || '—',
        points: el.pts?.total || 0,
        ...colonnesNotes(el.pts),
      }));
      await openPDF('liste_notes', {
        ecole: { nom: user?.ecole?.nom || '' },
        titre: lang === 'ar' ? 'قائمة النقاط' : 'Classement des points',
        periodeLabel,
        eleves: elevesData,
      }, lang);
    } catch (err) {
      console.error('PDF liste notes:', err);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + err.message);
    }
    setGenPdf(false);
  };

  // ── Excel export ──────────────────────────────────────────
  const handleExcelExport = async () => {
    if (filtered.length === 0) return;
    const periodeLabel = getPeriodeLabel();
    const headers = [
      '#',
      lang === 'ar' ? 'الاسم' : 'Prénom',
      lang === 'ar' ? 'اللقب' : 'Nom',
      lang === 'ar' ? 'الرقم' : 'N° Élève',
      lang === 'ar' ? 'المستوى' : 'Niveau',
      lang === 'ar' ? 'الأستاذ' : 'Instituteur',
      lang === 'ar' ? 'النقاط' : 'Points',
      lang === 'ar' ? 'الأثمان/السور' : 'Tomon/Sourates',
      lang === 'ar' ? 'الأحزاب' : 'Hizb',
      lang === 'ar' ? 'المجموعات' : 'Ensembles',
      lang === 'ar' ? 'الامتحانات' : 'Examens (pts)',
      lang === 'ar' ? 'الشهادات' : 'Certificats (pts)',
    ];
    const rows = filtered.map((el, i) => {
      const c = colonnesNotes(el.pts);
      return [
        i + 1,
        el.prenom || '',
        el.nom || '',
        el.eleve_id_ecole || '',
        niveaux.find(n => n.code === el.code_niveau)?.nom || el.code_niveau || '',
        el.instNom || '',
        el.pts?.total || 0,
        c.tomonSourates, c.hizb, c.ensembles, c.ptsExamens, c.ptsCertificats,
      ];
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `notes_${periode}_${dateStr}.xlsx`;
    try {
      await exportExcelSimple(
        filename,
        [headers, ...rows],
        lang === 'ar' ? 'النقاط' : 'Notes',
      );
    } catch (err) {
      toast.error((lang === 'ar' ? 'خطأ Excel : ' : 'Erreur Excel : ') + err.message);
    }
  };

  // Etape 14 v2 - PERIODES gere par PeriodeSelectorHybride (voir plus bas)

  // Helper pour recuperer le label de la periode active (utile pour exports)
  const getPeriodeLabel = () => {
    const isAr = lang === 'ar';
    if (periode === 'total')   return isAr?'منذ البداية':'Depuis le début';
    if (periode === 'semaine') return isAr?'الأسبوع':'Semaine';
    if (periode === 'mois')    return isAr?'الشهر':'Ce mois';
    if (periode === 'custom')  return isAr?'فترة محددة':'Période personnalisée';
    if (periode === 'annee_scolaire' && anneeActive) return anneeActive.nom;
    if (periode && periode.startsWith('bdd_')) {
      const p = periodesBDD.find(x => x.id === periode.substring(4));
      if (p) return formatPeriodeCourte(p, lang, true);
    }
    return '';
  };

  // Pull-to-refresh (Phase 2 mobile)
  const {
    pullDistance, isRefreshing, isThreshold,
    onTouchStart, onTouchMove, onTouchEnd,
  } = usePullToRefresh(loadData);

  return (
    <div style={{ padding: isMobile?'0':'1.5rem', paddingBottom:80, background: isMobile?'#f5f5f0':'transparent', minHeight: isMobile?'100vh':'auto' }}
      {...(isMobile ? { onTouchStart, onTouchMove, onTouchEnd } : {})}>
      {isMobile && (
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          isThreshold={isThreshold}
          lang={lang}
        />
      )}
      {isMobile ? (
        <>
        <MobileHeader
          title={lang==='ar'?'قائمة النقاط':'Notes & Points'}
          subtitle={`${filtered.length} ${lang==='ar'?'طالب':'élève(s)'}`}
          icon={Star}
          onBack={()=>goBack?goBack():navigate('dashboard')}
          lang={lang}
          actions={
            <HeaderMenu lang={lang} actions={[
              ...actionsExport({ onPDF: handlePdfExport, lang, disabled: genPdf||filtered.length===0 }),
              ...actionsExport({ onExcel: handleExcelExport, lang, disabled: filtered.length===0 }),
            ]} />
          }
        />
        <div style={{height:12}}/>
        </>
      ) : (
      <PageHeader
        title="Liste des notes"
        titleAr="قائمة النقاط"
        icon="⭐"
        subtitle={`${filtered.length} ${lang==='ar'?'طالب':'élève(s)'}`}
        onBack={() => goBack ? goBack() : navigate('dashboard')}
        lang={lang}
        actions={
          <ExportButtons
            onPDF={handlePdfExport}
            onExcel={handleExcelExport}
            lang={lang}
            variant="inline"
            compact
            disabled={genPdf || filtered.length === 0}
          />
        }
      />
      )}

      {/* M4 — Wrapper padding mobile (avant : contenu touchait les bords) */}
      <div style={{padding: isMobile?'0 12px':0}}>

      {/* Sélecteur période - Etape 14 v2 - Composant hybride */}
      {(() => {
        // Boutons rapides Liste Notes : [Total] [Ce mois] [T en cours]
        const isAr = lang === 'ar';
        const trimestresBDD = periodesBDD.filter(p => p.type === 'trimestre');
        const semestresBDD = periodesBDD.filter(p => p.type === 'semestre');
        const trimestreEnCours = detecterPeriodeEnCours(trimestresBDD);
        const boutonsRapides = [
          { key:'total', label:isAr?'منذ البداية':'Depuis le début' },
          { key:'mois', label:isAr?'الشهر':'Ce mois' },
          ...(trimestreEnCours ? [{ key:'bdd_'+trimestreEnCours.id, label: formatPeriodeCourte(trimestreEnCours, lang, true) }] : []),
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
          { groupe: isAr?'الحصيلة':'Bilans', items: [
            ...semestresBDD.map(p => ({ key:'bdd_'+p.id, label: formatPeriodeCourte(p, lang, true) })),
            ...(anneeActive ? [{ key:'annee_scolaire', label: anneeActive.nom }] : []),
          ].filter(item => !idsRapides.includes(item.key)) },
        ].filter(g => g.items.length > 0);
        return (
          <div style={{marginBottom:'1rem'}}>
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
                  ? 'لم تقم بإعداد سنة دراسية. يمكنك ذلك في الإدارة > الفترات'
                  : 'Aucune année scolaire active. Configurez-en une dans Gestion → Périodes'}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filtres */}
      <div className="card" style={{ marginBottom:'1.25rem', margin: isMobile?'0 0 12px':'', borderRadius: isMobile?12:undefined }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
          <input className="field-input" placeholder={(isMobile?'':'🔍 ')+(lang==='ar'?'رقم أو اسم الطالب':'N° ou nom élève')}
            value={searchNum} onChange={e=>setSearchNum(e.target.value)} />
          <select className="field-select" value={filtreNiveau} onChange={e=>setFiltreNiveau(e.target.value)}>
            <option value="">{lang==='ar'?'كل المستويات':'Tous les niveaux'}</option>
            {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
          </select>
          <select className="field-select" value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}>
            <option value="">{lang==='ar'?'كل الأساتذة':'Tous les instituteurs'}</option>
            {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div>
          <style>{`@keyframes skelPulse{0%,100%{opacity:1}50%{opacity:0.55}}`}</style>
          {[0,1,2,3,4,5,6,7].map(i => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10,
              padding: isMobile ? '14px' : '10px 14px',
              background:'#fff',
              borderRadius: isMobile ? 14 : 0,
              marginBottom: isMobile ? 8 : 0,
              borderBottom: isMobile ? 'none' : '1px solid #eee',
              animation:'skelPulse 1.2s ease-in-out infinite'
            }}>
              {isMobile ? (
                <>
                  <div style={{width:42, height:42, background:'#e5e5df', borderRadius:'50%', flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{width:'70%', height:14, background:'#e5e5df', borderRadius:4, marginBottom:6}} />
                    <div style={{width:'45%', height:11, background:'#ececec', borderRadius:4}} />
                  </div>
                  <div style={{width:50, height:24, background:'#e5e5df', borderRadius:6, flexShrink:0}} />
                </>
              ) : (
                <>
                  <div style={{width:28, height:16, background:'#e5e5df', borderRadius:4}} />
                  <div style={{flex:1, height:16, background:'#e5e5df', borderRadius:4}} />
                  <div style={{width:60, height:16, background:'#e5e5df', borderRadius:4}} />
                  <div style={{width:40, height:16, background:'#e5e5df', borderRadius:4}} />
                </>
              )}
            </div>
          ))}
        </div>
      ) : isMobile ? (
        // ─────────────────────────────────────────────────────────
        // MOBILE — Cartes empilées (Phase 2 refonte)
        // Anti-pattern précédent : tableau 9 colonnes illisible
        // Nouveau : nom + niveau en haut, total points en gros à droite,
        // décomposition Tomon/Hizb/Examens/Certs en ligne discrète
        // ─────────────────────────────────────────────────────────
        <div>
          {filtered.length === 0 && (
            <div style={{background:C.surface, borderRadius:12, border:`1px solid ${C.line}`}}>
              <EmptyState icon={Star} title={lang==='ar'?'لا توجد بيانات':'Aucune donnée'} />
            </div>
          )}
          {(filtered||[]).map((el, idx) => {
            const nc = getNivColor(el.code_niveau);
            const rank = idx + 1;
            const isPodium = rank <= 3;
            const podiumIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
            // Charte mobile (oct 2026) : ligne de liste ; medaille de classement conservee sur l'avatar
            const details = [
              el.eleve_id_ecole ? `#${el.eleve_id_ecole}` : null,
              el.instNom,
            ].filter(Boolean).join(' · ');
            // Idem bureau : on somme tomons + sourates pour couvrir hizb/sourate
            const decomposition = [
              `${lang==='ar'?'الأثمان/السور':'Tomon/Sour.'} ${(el.pts.tomonPeriode||0) + (el.pts.nbSouratesCompletes||0)}`,
              `${lang==='ar'?'الأحزاب':'Hizb'} ${el.pts.hizbsPeriode||0}`,
              // Ajout : ensembles pour les eleves sourate (0 si non applicable)
              (el.pts.nbEnsemblesComplets||0) > 0 ? `${lang==='ar'?'المجموعات':'Ens.'} ${el.pts.nbEnsemblesComplets}` : null,
              `${lang==='ar'?'الامتحانات':'Exam.'} ${el.pts.ptsExamens||0}`,
              `${lang==='ar'?'الشهادات':'Cert.'} ${el.pts.ptsCertificats||0}`,
            ].filter(Boolean).join(' · ');
            return (
              <div key={el.id} style={{marginBottom:8}}>
                <ListRow lang={lang}
                  leading={
                    <div style={{flexShrink:0, position:'relative'}}>
                      <Avatar prenom={el.prenom} nom={el.nom} color={nc} />
                      {isPodium && (
                        <div style={{position:'absolute', top:-4, insetInlineEnd:-4, fontSize:16, lineHeight:1}}>{podiumIcon}</div>
                      )}
                    </div>
                  }
                  title={`${el.prenom} ${el.nom}`}
                  subtitle={details}
                  meta={
                    <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
                      <LevelBadge code={el.code_niveau} color={nc} />
                      <span style={{fontSize:11, color:C.muted}}>{decomposition}</span>
                    </div>
                  }
                  value={el.pts.total.toLocaleString()}
                  valueLabel={lang==='ar'?'نقطة':'pts'}
                  valueTone="brand"
                  onClick={()=>navigate('fiche',el)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{lang==='ar'?'الطالب':'Élève'}</th>
                <th>{lang==='ar'?'المستوى':'Niveau'}</th>
                <th>{lang==='ar'?'الأستاذ':'Instituteur'}</th>
                <th>{lang==='ar'?'الأثمان/السور':'Tomon/Sourates'}</th>
                <th>{lang==='ar'?'الأحزاب':'Hizb'}</th>
                {/* AJOUT (oct 2026) : colonne Ensembles pour que les points d'ensembles
                    completes (ptsBonusEnsembles) soient visibles. Masquee si personne
                    n'en a (eleves purement hizbs), affichee des qu'un eleve en a. */}
                <th>{lang==='ar'?'المجموعات':'Ensembles'}</th>
                <th>{lang==='ar'?'الامتحانات':'Examens'}</th>
                <th>{lang==='ar'?'الشهادات':'Certs'}</th>
                <th style={{color:'#378ADD'}}>{lang==='ar'?'المجموع':'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="empty">{lang==='ar'?'لا توجد بيانات':'Aucune donnée'}</td></tr>
              )}
              {(filtered||[]).map((el, idx) => {
                const nc = getNivColor(el.code_niveau);
                return (
                  <tr key={el.id} className="clickable" onClick={()=>navigate('fiche',el)}>
                    <td style={{color:'#aaa',fontSize:12}}>{idx+1}</td>
                    <td>
                      <div style={{fontWeight:600,fontSize:13}}>{el.prenom} {el.nom}</div>
                      <div style={{fontSize:10,color:'#aaa'}}>{lang==='ar'?'رقم':'N°'} {el.eleve_id_ecole}</div>
                    </td>
                    <td><span style={{padding:'2px 6px',borderRadius:8,fontSize:10,fontWeight:700,background:nc+'18',color:nc}}>{el.code_niveau}</span></td>
                    <td style={{fontSize:11,color:'#888'}}>{el.instNom}</td>
                    <td style={{textAlign:'center'}}>
                      {/* BUG-FIX AFFICHAGE SOURATES (oct 2026) : la colonne "Thamanes/Sourates"
                          affichait tomonPeriode seul -> 0 pour les eleves recitant en sourates
                          alors que leurs ptsSourates etaient bien dans le total. On somme ici
                          tomons + sourates (completes + muraja) pour couvrir les deux cas.
                          Pour un eleve hizb : nbSouratesCompletes=0, donc comportement inchange.
                          Pour un eleve sourate : tomonPeriode=0, donc on affiche les sourates. */}
                      <span style={{fontWeight:700,color:'#378ADD'}}>{(el.pts.tomonPeriode||0) + (el.pts.nbSouratesCompletes||0)}</span>
                      {((el.pts.ptsTomon||0) + (el.pts.ptsSourates||0)) > 0 && (
                        <div style={{fontSize:9,color:'#aaa'}}>+{(el.pts.ptsTomon||0) + (el.pts.ptsSourates||0)} {lang==='ar'?'ن':'pts'}</div>
                      )}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#085041'}}>{el.pts.hizbsPeriode}</span>
                      {el.pts.ptsHizb>0 && <div style={{fontSize:9,color:'#aaa'}}>+{el.pts.ptsHizb} {lang==='ar'?'ن':'pts'}</div>}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#D85A30'}}>{el.pts.nbEnsemblesComplets||0}</span>
                      {(el.pts.ptsEnsembles||el.pts.ptsBonusEnsembles||0)>0 && (
                        <div style={{fontSize:9,color:'#aaa'}}>+{el.pts.ptsEnsembles||el.pts.ptsBonusEnsembles||0} {lang==='ar'?'ن':'pts'}</div>
                      )}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#EF9F27'}}>{el.pts.ptsExamens||0}</span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#D85A30'}}>{el.pts.ptsCertificats||0}</span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontSize:15,fontWeight:800,color:'#378ADD'}}>{el.pts.total.toLocaleString()}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
