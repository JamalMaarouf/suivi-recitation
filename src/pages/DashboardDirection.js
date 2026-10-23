import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { t } from '../lib/i18n';
import { BAREME_DEFAUT, loadBareme, calcPointsPeriode, loadAnneeActiveAvecPeriodes, formatPeriodeCourte, detecterPeriodeEnCours } from '../lib/helpers';
import { fetchAll } from '../lib/fetchAll';
import { openPDF } from '../lib/pdf';
import { exportExcel } from '../lib/excel';
import ExportButtons from '../components/ExportButtons';
import PeriodeSelectorHybride from '../components/PeriodeSelectorHybride';
import PageHeader from '../components/PageHeader';
import StatsCard from '../components/StatsCard';
import { usePullToRefresh, PullToRefreshIndicator } from '../lib/usePullToRefresh';
import { MobileHeader, HeaderMenu, actionsExport, KpiGrid, KpiTile, LevelBadge, C } from '../components/ui';
import { LayoutDashboard, Users, Activity, BookOpen, BookOpenCheck, Award, GraduationCap, CircleAlert, TriangleAlert } from 'lucide-react';

// ─── Couleurs par niveau ───────────────────────────────────────────────────
const NC = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };
const getNc = (niveaux, code) =>
  (niveaux||[]).find(n=>n.code===code)?.couleur || NC[code] || '#888';

// ─── Composants UI ────────────────────────────────────────────────────────
// KpiCard local supprime (charte mobile oct 2026) : la branche mobile utilise KpiTile (components/ui).

function SectionTitle({ icon, title, sub }) {
  return (
    <div style={{marginBottom:16,marginTop:28}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:18}}>{icon}</span>
        <span style={{fontSize:16,fontWeight:800,color:'#085041'}}>{title}</span>
      </div>
      {sub&&<div style={{fontSize:12,color:'#888',marginTop:2,marginLeft:26}}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, colorKey='color', valKey='val', labelKey='label', maxVal }) {
  const max = maxVal || Math.max(...(data||[]).map(d=>d[valKey]||0), 1);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {(data||[]).map((d,i) => (
        <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:80,fontSize:11,color:'#555',textAlign:'right',flexShrink:0,
            fontFamily:"'Tajawal',Arial,sans-serif",direction:'rtl'}}>
            {d[labelKey]}
          </div>
          <div style={{flex:1,background:'#f0f0ec',borderRadius:6,overflow:'hidden',height:22}}>
            <div style={{
              width:`${max>0?(d[valKey]||0)/max*100:0}%`,
              background:d[colorKey]||'#1D9E75',
              height:'100%',borderRadius:6,
              transition:'width 0.5s ease',
              display:'flex',alignItems:'center',paddingLeft:6,
              minWidth: d[valKey]>0 ? 30 : 0,
            }}>
              {d[valKey]>0&&<span style={{fontSize:11,color:'#fff',fontWeight:700}}>{d[valKey]}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniSparkline({ values, color='#1D9E75', height=40 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 120, h = height;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{display:'block'}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={pts.split(' ').pop().split(',')[0]}
              cy={pts.split(' ').pop().split(',')[1]}
              r="3" fill={color}/>
    </svg>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────
export default function DashboardDirection({ user, navigate, goBack, lang='fr', isMobile=false }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [eleves, setEleves] = useState([]);
  const [validations, setValidations] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [certificats, setCertificats] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [passages, setPassages] = useState([]);
  const [ecole, setEcole] = useState(null);
  // FIX (oct 2026) : bareme complet {unites, ensembles, examens, jalons} (avant : aplati sur unites)
  const [bareme, setBareme] = useState({ unites:{...BAREME_DEFAUT}, examens:{}, ensembles:{}, jalons:{} });
  const [pointsEvts, setPointsEvts] = useState([]); // FIX (oct 2026) : points_eleves (examens) pour le Top
  const [periode, setPeriode] = useState('mois'); // 'mois' | 'bdd_<id>' | 'annee_scolaire' | 'custom'
  const [periodesBDD, setPeriodesBDD] = useState([]);
  const [anneeActive, setAnneeActive] = useState(null);
  const [showPeriodeDropdown, setShowPeriodeDropdown] = useState(false); // (legacy, plus utilise mais on garde pour compat)
  // Etape 14 v2 - Dates custom
  const [customDebut, setCustomDebut] = useState('');
  const [customFin, setCustomFin] = useState('');
  const [activeSection, setActiveSection] = useState('overview');

  // RGPD audit (P2.1) : logs RGPD filtrés sur l'école uniquement
  const [rgpdLogs, setRgpdLogs] = useState([]);
  const [showRgpdSection, setShowRgpdSection] = useState(false);
  const isAr = lang === 'ar';

  useEffect(() => { loadData(); }, []);

  // Etape 14 v2 - Charger l'annee active + ses periodes typees (T, S)
  // L'annee scolaire (annees_scolaires) sert directement comme bouton 'Annee' :
  // pas besoin de creer une periode type='annee' redondante.
  useEffect(() => {
    if (!user?.ecole_id) return;
    loadAnneeActiveAvecPeriodes(supabase, user.ecole_id).then(({ annee, periodes }) => {
      setAnneeActive(annee);
      // Periodes typees : trimestres et semestres uniquement (pas 'libre' ni 'annee' redondante)
      setPeriodesBDD(periodes.filter(p => p.type === 'trimestre' || p.type === 'semestre'));
    });
  }, [user?.ecole_id]);

  // Nettoyage diagnostic : supprime les console.log temporaires

  // ─── P2.1 : Chargement des logs RGPD quand la section s'ouvre ──
  useEffect(() => {
    if (showRgpdSection && user?.ecole_id) {
      loadRgpdLogs();
    }
    // eslint-disable-next-line
  }, [showRgpdSection]);

  const loadRgpdLogs = async () => {
    try {
      const [logsRes, usersRes] = await Promise.all([
        supabase.from('exports_rgpd')
          .select('*')
          .eq('ecole_id', user.ecole_id)
          .order('exported_at', { ascending: false })
          .limit(100),
        supabase.from('utilisateurs')
          .select('id,prenom,nom,role')
          .eq('ecole_id', user.ecole_id),
      ]);
      const usersMap = {};
      (usersRes.data || []).forEach(u => { usersMap[u.id] = u; });
      const enriched = (logsRes.data || []).map(log => ({
        ...log,
        _user_nom: usersMap[log.user_id]
          ? `${usersMap[log.user_id].prenom || ''} ${usersMap[log.user_id].nom || ''}`.trim()
          : '—',
      }));
      setRgpdLogs(enriched);
    } catch (err) {
      console.error('[DashboardDirection RGPD] load error:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // FIX (oct 2026) : bareme complet (calcPointsPeriode a besoin de ensembles/jalons)
      loadBareme(supabase, user.ecole_id).then(b => { if (b) setBareme(b); });
      const [
        { data: ev }, { data: iv }, { data: vv }, { data: nv },
        { data: cv }, { data: rv }, { data: pv }, { data: ecv }, { data: pev }
      ] = await Promise.all([
        supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id).is('suspendu_at', null).order('nom'),
        supabase.from('utilisateurs').select('id,prenom,nom,role').eq('ecole_id', user.ecole_id).eq('role','instituteur'),
        fetchAll(supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,date_validation,valide_par,ecole_id,ensemble_id').eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false})).then(data=>({data})), // FIX (oct 2026) : ensemble_id pour calcPointsPeriode
        supabase.from('niveaux').select('*').eq('ecole_id', user.ecole_id).order('ordre'),
        supabase.from('certificats_eleves').select('id,eleve_id,jalon_id,date_emission').eq('ecole_id', user.ecole_id).limit(500),
        // FIX (oct 2026) : points + is_muraja pour le Top (calcPointsPeriode)
        fetchAll(supabase.from('recitations_sourates').select('id,eleve_id,date_validation,type_recitation,is_muraja,points').eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false})).then(data=>({data})),
        // FIX (oct 2026) : colonnes niveau_avant/niveau_apres inexistantes -> requete en erreur, 0 passage affiche
        supabase.from('passages_niveau').select('*').eq('ecole_id', user.ecole_id).limit(500),
        supabase.from('ecoles').select('*').eq('id', user.ecole_id).single(),
        // FIX (oct 2026) : points_eleves (examens) pour un Top coherent avec la liste des notes
        fetchAll(supabase.from('points_eleves').select('id,eleve_id,type_event,points,date_event').eq('ecole_id', user.ecole_id)).then(data=>({data})),
      ]);
      setEleves(ev||[]);
      setInstituteurs(iv||[]);
      setValidations(vv||[]);
      setNiveaux(nv||[]);
      // FIX (oct 2026) : mapper date_emission -> date_obtention attendu par calcPointsPeriode
      setCertificats((cv||[]).map(c => ({ ...c, date_obtention: c.date_emission })));
      setPointsEvts(pev||[]);
      setRecitations(rv||[]);
      setPassages(pv||[]);
      setEcole(ecv);
    } catch(err) {
      console.error('[DashboardDirection] loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Calcul période ──────────────────────────────────────────────────────
  // Etape 14 v2 - Mois (auto) ou periode BDD (typee, bornes fixes)
  const { periodeDebut, periodeFin } = useMemo(() => {
    const now = new Date();
    if (periode === 'mois') {
      return {
        periodeDebut: new Date(now.getFullYear(), now.getMonth(), 1),
        periodeFin: now,
      };
    }
    // 'annee_scolaire' = utilise directement les dates de l'annee active
    if (periode === 'annee_scolaire' && anneeActive) {
      return {
        periodeDebut: new Date(anneeActive.date_debut),
        // FIX (oct 2026) : inclure toute la derniere journee (avant : minuit UTC -> dernier jour exclu)
        periodeFin: new Date(anneeActive.date_fin + 'T23:59:59'),
      };
    }
    // 'custom' = dates saisies par l'utilisateur (Etape 14 v2)
    if (periode === 'custom' && customDebut && customFin) {
      return {
        periodeDebut: new Date(customDebut),
        periodeFin: new Date(customFin + 'T23:59:59'),
      };
    }
    if (periode && periode.startsWith('bdd_')) {
      const id = periode.substring(4);
      const p = periodesBDD.find(x => x.id === id);
      if (p) {
        return {
          periodeDebut: new Date(p.date_debut),
          // FIX (oct 2026) : inclure toute la derniere journee
          periodeFin: new Date(p.date_fin + 'T23:59:59'),
        };
      }
    }
    // Fallback : mois
    return {
      periodeDebut: new Date(now.getFullYear(), now.getMonth(), 1),
      periodeFin: now,
    };
  }, [periode, periodesBDD, anneeActive, customDebut, customFin]);

  const valsFiltered = useMemo(() =>
    (validations||[]).filter(v => {
      const d = new Date(v.date_validation);
      return d >= periodeDebut && d <= periodeFin;
    }),
  [validations, periodeDebut, periodeFin]);

  // FIX (oct 2026) : recitations de sourates de la periode (comptent dans l'activite)
  const recsFiltered = useMemo(() =>
    (recitations||[]).filter(r => {
      const d = new Date(r.date_validation);
      return d >= periodeDebut && d <= periodeFin;
    }),
  [recitations, periodeDebut, periodeFin]);

  // ─── KPIs globaux ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    // FIX (oct 2026) : actifs = validations OU recitations de sourates, restreint aux eleves
    // non suspendus (eleves deja filtre) pour que le taux ne depasse pas la population.
    const idsEleves = new Set((eleves||[]).map(e=>e.id));
    const elevesActifs = new Set([...valsFiltered.map(v=>v.eleve_id), ...recsFiltered.map(r=>r.eleve_id)].filter(id=>idsEleves.has(id)));
    const totalTomon = valsFiltered.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+(v.nombre_tomon||0),0);
    const totalHizb = valsFiltered.filter(v=>v.type_validation==='hizb_complet').length;
    const tauxActivite = eleves.length > 0 ? Math.round(elevesActifs.size/eleves.length*100) : 0;
    const totalCerts = (certificats||[]).filter(c=>{
      const d = new Date(c.date_emission);
      return d >= periodeDebut && d <= periodeFin;
    }).length;
    const totalPassages = (passages||[]).filter(p=>{
      const d = new Date(p.date_passage || p.created_at);
      return d >= periodeDebut && d <= periodeFin;
    }).length;
    return { elevesActifs:elevesActifs.size, totalEleves:eleves.length, totalTomon, totalHizb,
      tauxActivite, totalCerts, totalPassages, totalSeances: valsFiltered.length };
  }, [valsFiltered, recsFiltered, eleves, certificats, passages, periodeDebut, periodeFin]);

  // ─── Stats par niveau ────────────────────────────────────────────────────
  const statsByNiveau = useMemo(() => {
    return (niveaux||[]).map(niv => {
      const elevesNiv = (eleves||[]).filter(e=>e.code_niveau===niv.code);
      const valsNiv = valsFiltered.filter(v=>elevesNiv.some(e=>e.id===v.eleve_id));
      const actifs = new Set(valsNiv.map(v=>v.eleve_id));
      const tomon = valsNiv.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+(v.nombre_tomon||0),0);
      const hizb = valsNiv.filter(v=>v.type_validation==='hizb_complet').length;
      return {
        code: niv.code, nom: niv.nom, color: niv.couleur||NC[niv.code]||'#888',
        total: elevesNiv.length, actifs: actifs.size,
        taux: elevesNiv.length>0?Math.round(actifs.size/elevesNiv.length*100):0,
        tomon, hizb, seances: valsNiv.length,
      };
    }).filter(s=>s.total>0);
  }, [niveaux, eleves, valsFiltered]);

  // ─── Stats par instituteur ───────────────────────────────────────────────
  const statsByInst = useMemo(() => {
    return (instituteurs||[]).map(inst => {
      const valsInst = valsFiltered.filter(v=>v.valide_par===inst.id);
      const elevesInst = (eleves||[]).filter(e=>e.instituteur_referent_id===inst.id);
      const actifs = new Set(valsInst.map(v=>v.eleve_id));
      const tomon = valsInst.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+(v.nombre_tomon||0),0);
      return {
        id: inst.id, nom: `${inst.prenom} ${inst.nom}`,
        nbEleves: elevesInst.length, actifs: actifs.size,
        seances: valsInst.length, tomon,
        moy: actifs.size>0?Math.round(tomon/actifs.size*10)/10:0,
      };
    }).sort((a,b)=>b.seances-a.seances).filter(s=>s.nbEleves>0);
  }, [instituteurs, eleves, valsFiltered]);

  // ─── Évolution mensuelle ─────────────────────────────────────────────────
  const evolutionMensuelle = useMemo(() => {
    const months = {};
    const now = new Date();
    // Initialise 6 derniers mois
    for (let i=5; i>=0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[key] = { label: d.toLocaleDateString(isAr?'ar-MA':'fr-FR',{month:'short'}), tomon:0, eleves:new Set() };
    }
    (validations||[]).forEach(v => {
      const d = new Date(v.date_validation);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (months[key]) {
        if (v.type_validation==='tomon') months[key].tomon += (v.nombre_tomon||0);
        months[key].eleves.add(v.eleve_id);
      }
    });
    return Object.values(months).map(m=>({...m, eleves:m.eleves.size}));
  }, [validations, isAr]);

  // ─── Top élèves ──────────────────────────────────────────────────────────
  // FIX (oct 2026) : classement calcule avec calcPointsPeriode (validations + recitations
  // de sourates + certificats + examens, bareme complet) sur la meme periode, et
  // uniquement sur les eleves actifs (eleves est deja filtre suspendu_at null).
  // Avant : formule locale tomon/hizb sur toutes les validations (suspendus inclus,
  // eleves sourates a 0). On garde 10 lignes pour le PDF, l'ecran affiche le Top 5.
  const classementPeriode = useMemo(() => {
    const group = (arr) => {
      const m = new Map();
      (arr||[]).forEach(x => { if (!m.has(x.eleve_id)) m.set(x.eleve_id, []); m.get(x.eleve_id).push(x); });
      return m;
    };
    const valsBy = group(validations), recsBy = group(recitations), certsBy = group(certificats), evtsBy = group(pointsEvts);
    return (eleves||[])
      .map(e => {
        const r = calcPointsPeriode(valsBy.get(e.id)||[], periodeDebut, periodeFin, bareme,
          evtsBy.get(e.id)||[], recsBy.get(e.id)||[], certsBy.get(e.id)||[]);
        return { id:e.id, prenom:e.prenom||'?', nom:e.nom||'?', code_niveau:e.code_niveau,
          pts:r.total, tomon:r.tomonPeriode||0, hizb:r.hizbsPeriode||0 };
      })
      .filter(x => x.pts > 0)
      .sort((a,b)=>b.pts-a.pts)
      .slice(0,10);
  }, [validations, recitations, certificats, pointsEvts, eleves, bareme, periodeDebut, periodeFin]);
  const topEleves = useMemo(() => classementPeriode.slice(0,5), [classementPeriode]);

  // ─── Alertes ────────────────────────────────────────────────────────────
  const alertes = useMemo(() => {
    const alerts = [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-21);
    // FIX (oct 2026) : derniere activite = max(validations, recitations de sourates)
    // (avant : les eleves en sourates apparaissaient toujours inactifs)
    const derniere = new Map();
    [...(validations||[]), ...(recitations||[])].forEach(x => {
      const d = new Date(x.date_validation);
      const cur = derniere.get(x.eleve_id);
      if (!cur || d > cur) derniere.set(x.eleve_id, d);
    });
    const inactifs = (eleves||[]).filter(e => {
      const last = derniere.get(e.id);
      return !last || last < cutoff;
    });
    if (inactifs.length > 0)
      alerts.push({ type:'warning', icon:'⚠️', msg: `${inactifs.length} élève(s) sans validation depuis 3+ semaines` });
    if (kpis.tauxActivite < 50)
      alerts.push({ type:'danger', icon:'🔴', msg: `Taux d'activité faible : ${kpis.tauxActivite}%` });
    if (kpis.totalCerts > 0)
      alerts.push({ type:'success', icon:'🏅', msg: `${kpis.totalCerts} certificat(s) obtenu(s) sur la période` });
    if (kpis.totalPassages > 0)
      alerts.push({ type:'info', icon:'🎓', msg: `${kpis.totalPassages} passage(s) de niveau réalisé(s)` });
    return alerts;
  }, [eleves, validations, recitations, kpis]);

  // Etape 14 v2 - PERIODES dynamiques pour Dashboard Direction
  // Pattern hybride : [Ce mois] [T en cours] [Année active] + dropdown "Plus"
  const trimestresBDD = periodesBDD.filter(p => p.type === 'trimestre');
  const semestresBDD  = periodesBDD.filter(p => p.type === 'semestre');
  const trimestreEnCours = detecterPeriodeEnCours(trimestresBDD);

  // 3 boutons rapides + Dropdown "Plus"
  const boutonsRapides = [
    { key:'mois', label:isAr?'الشهر الحالي':'Ce mois' },
    ...(trimestreEnCours ? [{ key:'bdd_'+trimestreEnCours.id, label: formatPeriodeCourte(trimestreEnCours, lang, true) }] : []),
    // Etape 14 v2 - L'annee scolaire active sert directement comme bouton 'Annee'
    // (pas besoin de creer une periode type='annee' redondante)
    ...(anneeActive ? [{ key:'annee_scolaire', label: anneeActive.nom }] : []),
  ];

  // Items dropdown (toutes les periodes BDD sauf celles deja en bouton rapide)
  const idsRapides = boutonsRapides.map(b => b.key);
  const dropdownItems = [
    // Recent
    { groupe: isAr?'حديث':'Récent', items: [
      { key:'mois', label:isAr?'الشهر الحالي':'Ce mois (calendaire)' },
    ].filter(item => !idsRapides.includes(item.key)) },
    // Trimestres
    { groupe: isAr?'الفصول الدراسية':'Trimestres', items:
      trimestresBDD.map(p => ({ key:'bdd_'+p.id, label: formatPeriodeCourte(p, lang, true) }))
        .filter(item => !idsRapides.includes(item.key))
    },
    // Bilans
    { groupe: isAr?'الحصيلة':'Bilans', items:
      semestresBDD.map(p => ({ key:'bdd_'+p.id, label: formatPeriodeCourte(p, lang, true) }))
        .filter(item => !idsRapides.includes(item.key))
    },
  ].filter(g => g.items.length > 0);

  // Liste plate pour determiner le label de la periode active
  const allOptions = [
    ...boutonsRapides,
    ...dropdownItems.flatMap(g => g.items),
  ];
  const periodeLabel = allOptions.find(o => o.key === periode)?.label || (isAr?'الشهر الحالي':'Ce mois');

  // ── Préparation des données Top 10 avec points ──
  const top10AvecPoints = useMemo(() => {
    // FIX (oct 2026) : vrai Top 10 (avant : topEleves deja coupe a 5) + champs reels
    return classementPeriode.slice(0, 10).map((el, i) => {
      const niveau = niveaux.find(n => n.code === el.code_niveau);
      return {
        rang: i + 1,
        prenom: el.prenom || '',
        nom: el.nom || '',
        code_niveau: el.code_niveau || '',
        niveau_couleur: niveau?.couleur || getNc(niveaux, el.code_niveau),
        points: el.pts || 0, // FIX (oct 2026) : le champ s'appelle pts (el.points n'existait pas -> 0)
        tomon: el.tomon || 0,
        hizb: el.hizb || 0,
      };
    });
  }, [classementPeriode, niveaux]);

  // ── Export PDF (3 pages: KPIs/évol, niveaux/insts, top 10) ──
  const handleExportPDF = async () => {
    try {
      await openPDF('rapport_direction', {
        ecole: { nom: ecole?.nom || '' },
        periodeLabel,
        kpis,
        parNiveau: statsByNiveau,
        parInstituteur: statsByInst,
        evolution: evolutionMensuelle,
        topEleves: top10AvecPoints,
      }, lang);
    } catch (err) {
      console.error('Erreur PDF direction:', err);
      toast.error((isAr ? 'خطأ PDF : ' : 'Erreur PDF : ') + err.message);
    }
  };

  // ── Export Excel multi-feuilles (4 onglets) ──
  const handleExportExcel = async () => {
    // Feuille 1 : KPIs
    const sheetKPIs = {
      name: isAr ? 'المؤشرات' : 'KPIs',
      rows: [
        [isAr ? 'المؤشر' : 'Indicateur', isAr ? 'القيمة' : 'Valeur'],
        [isAr ? 'الفترة' : 'Période', periodeLabel],
        [isAr ? 'إجمالي الطلاب' : 'Total élèves', kpis.totalEleves || 0],
        [isAr ? 'الطلاب النشطون' : 'Élèves actifs', kpis.elevesActifs || 0],
        [isAr ? 'نسبة النشاط %' : 'Taux d\'activité %', kpis.tauxActivite || 0],
        [isAr ? 'ثُمنات محققة' : 'Tomon validés', kpis.totalTomon || 0],
        [isAr ? 'أحزاب كاملة' : 'Hizb complets', kpis.totalHizb || 0],
        [isAr ? 'جلسات' : 'Séances', kpis.totalSeances || 0],
        [isAr ? 'شهادات' : 'Certificats', kpis.totalCerts || 0],
        [isAr ? 'اجتيازات مستوى' : 'Passages niveau', kpis.totalPassages || 0],
      ],
    };

    // Feuille 2 : Par niveau
    const sheetNiveaux = {
      name: isAr ? 'المستويات' : 'Niveaux',
      rows: [
        [
          isAr ? 'الرمز' : 'Code',
          isAr ? 'الاسم' : 'Nom',
          isAr ? 'العدد' : 'Total',
          isAr ? 'نشط' : 'Actifs',
          isAr ? 'النسبة %' : 'Taux %',
          isAr ? 'ثُمن' : 'Tomon',
          isAr ? 'حزب' : 'Hizb',
          isAr ? 'جلسات' : 'Séances',
        ],
        ...statsByNiveau.map(n => [
          n.code, n.nom || '', n.total, n.actifs, n.taux, n.tomon, n.hizb, n.seances,
        ]),
      ],
    };

    // Feuille 3 : Par instituteur
    const sheetInst = {
      name: isAr ? 'المؤطرون' : 'Instituteurs',
      rows: [
        [
          isAr ? 'الاسم' : 'Nom',
          isAr ? 'طلاب مُتَبَنَّون' : 'Élèves référents',
          isAr ? 'نشط' : 'Actifs',
          isAr ? 'جلسات' : 'Séances',
          isAr ? 'ثُمن' : 'Tomon',
          isAr ? 'معدل ثُمن/طالب' : 'Moy tomon/élève',
        ],
        ...statsByInst.map(inst => [
          inst.nom, inst.nbEleves, inst.actifs, inst.seances, inst.tomon, inst.moy || 0,
        ]),
      ],
    };

    // Feuille 4 : Évolution mensuelle
    const sheetEvolution = {
      name: isAr ? 'التطور' : 'Evolution',
      rows: [
        [
          isAr ? 'الشهر' : 'Mois',
          isAr ? 'ثُمنات محققة' : 'Tomon validés',
          isAr ? 'طلاب نشطون' : 'Élèves actifs',
        ],
        ...evolutionMensuelle.map(m => [m.label || '', m.tomon || 0, m.eleves || 0]),
      ],
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      await exportExcel(
        `direction_${periode}_${dateStr}.xlsx`,
        [sheetKPIs, sheetNiveaux, sheetInst, sheetEvolution],
      );
    } catch (err) {
      console.error('Erreur Excel direction:', err);
      toast.error((isAr ? 'خطأ Excel : ' : 'Erreur Excel : ') + err.message);
    }
  };

  // Pull-to-refresh (Phase 2 Sprint 5)
  const {
    pullDistance, isRefreshing, isThreshold,
    onTouchStart, onTouchMove, onTouchEnd,
  } = usePullToRefresh(loadData);

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:16}}>
      <div style={{fontSize:32}}>📊</div>
      <div style={{color:'#085041',fontWeight:700}}>{isAr?'جاري تحميل التقرير...':'Chargement du tableau de bord...'}</div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // MOBILE
  // ──────────────────────────────────────────────────────────────────────────
  // F11 (oct 2026) : section Audit RGPD partagee PC + mobile (avant : PC seulement).
  const sectionRgpd = (
    <div style={{marginTop:24,background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,overflow:'hidden'}}>
      <div onClick={()=>setShowRgpdSection(!showRgpdSection)}
        style={{padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',
          background:showRgpdSection?'#F0EEFF':'#fff',borderBottom:showRgpdSection?'0.5px solid #e0e0d8':'none'}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:'#534AB7',display:'flex',alignItems:'center',gap:8}}>
            🔐 {isAr?'سجل تصدير البيانات (RGPD)':'Registre des exports RGPD'}
          </div>
          <div style={{fontSize:11,color:'#888',marginTop:3}}>
            {isAr?'من طلب تحميل بياناته الشخصية ومتى':'Qui a téléchargé ses données personnelles et quand'}
          </div>
        </div>
        <span style={{fontSize:14,color:'#888',transform:showRgpdSection?'rotate(90deg)':'none',transition:'transform 0.2s'}}>▸</span>
      </div>

      {showRgpdSection && (
        <div style={{padding:'14px 18px'}}>
          <div style={{background:'#F0EEFF',border:'0.5px solid #534AB720',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:11,color:'#4A3F9E',lineHeight:1.5}}>
            📋 {isAr
              ? 'قائمة تصديرات البيانات الشخصية لمدرستك. الأولياء يمكنهم الحصول على ملف ببياناتهم وبيانات أبنائهم وفقاً للمادة 20 من RGPD.'
              : 'Liste des exports de données personnelles effectués dans votre école. Les parents peuvent récupérer un fichier avec leurs données et celles de leurs enfants (art. 20 RGPD).'}
          </div>

          {rgpdLogs.length === 0 ? (
            <div style={{textAlign:'center',padding:'30px 20px',color:'#888',fontSize:13,background:'#fafaf7',borderRadius:10,border:'0.5px dashed #e0e0d8'}}>
              ✨ {isAr?'لم يطلب أحد تصدير بياناته بعد':'Aucun export effectué pour le moment'}
            </div>
          ) : (
            <>
              <div style={{fontSize:11,color:'#888',marginBottom:8}}>
                {rgpdLogs.length} {isAr?'تصدير على آخر 100':'export(s) sur les 100 derniers'}
              </div>
              <div style={{maxHeight:400,overflowY:'auto',overflowX:'auto',border:'0.5px solid #e0e0d8',borderRadius:8}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead style={{position:'sticky',top:0,background:'#f5f5f0',zIndex:1}}>
                    <tr style={{borderBottom:'0.5px solid #e0e0d8'}}>
                      <th style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:'#888',fontSize:10}}>{isAr?'التاريخ':'Date'}</th>
                      <th style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:'#888',fontSize:10}}>{isAr?'المستخدم':'Utilisateur'}</th>
                      <th style={{padding:'8px 10px',textAlign:'left',fontWeight:700,color:'#888',fontSize:10}}>{isAr?'الدور':'Rôle'}</th>
                      <th style={{padding:'8px 10px',textAlign:'center',fontWeight:700,color:'#888',fontSize:10}}>{isAr?'النطاق':'Scope'}</th>
                      <th style={{padding:'8px 10px',textAlign:'center',fontWeight:700,color:'#888',fontSize:10}}>{isAr?'الحجم':'Volumes'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rgpdLogs.map(log => {
                      const d = new Date(log.exported_at);
                      const dateStr = d.toLocaleDateString(isAr?'ar-MA':'fr-FR') + ' ' + d.toLocaleTimeString(isAr?'ar-MA':'fr-FR',{hour:'2-digit',minute:'2-digit'});
                      const scopeLabel = log.export_scope === 'self_plus_children'
                        ? (isAr?'ذاتي + أبناء':'Soi + enfants')
                        : (isAr?'ذاتي':'Soi');
                      const scopeColor = log.export_scope === 'self_plus_children' ? '#378ADD' : '#888';
                      const roleBg = {
                        parent:'#FAEEDA', instituteur:'#E6F1FB',
                        surveillant:'#E1F5EE', super_admin:'#F0EEFF'
                      }[log.export_role] || '#f5f5f0';
                      const roleColor = {
                        parent:'#EF9F27', instituteur:'#378ADD',
                        surveillant:'#1D9E75', super_admin:'#534AB7'
                      }[log.export_role] || '#666';
                      const roleLabelAr = {
                        parent:'ولي', instituteur:'مؤطر',
                        surveillant:'مراقب', super_admin:'مشرف'
                      }[log.export_role] || log.export_role;
                      return (
                        <tr key={log.id} style={{borderBottom:'0.5px solid #f0f0ec'}}>
                          <td style={{padding:'8px 10px',whiteSpace:'nowrap',fontSize:11}}>{dateStr}</td>
                          <td style={{padding:'8px 10px',fontWeight:600,fontSize:12}}>{log._user_nom}</td>
                          <td style={{padding:'8px 10px'}}>
                            <span style={{padding:'2px 7px',borderRadius:7,background:roleBg,color:roleColor,fontWeight:700,fontSize:10}}>
                              {isAr ? roleLabelAr : log.export_role}
                            </span>
                          </td>
                          <td style={{padding:'8px 10px',textAlign:'center'}}>
                            <span style={{fontSize:10,color:scopeColor,fontWeight:600}}>{scopeLabel}</span>
                          </td>
                          <td style={{padding:'8px 10px',textAlign:'center',fontSize:11,color:'#666'}}>
                            {log.nb_enfants > 0 && <span>{log.nb_enfants}👤 </span>}
                            {log.nb_validations > 0 && <span>{log.nb_validations}⭐ </span>}
                            {log.nb_certificats > 0 && <span>{log.nb_certificats}🏅</span>}
                            {!log.nb_enfants && !log.nb_validations && !log.nb_certificats && '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          isThreshold={isThreshold}
          lang={lang}
        />
        {/* Header */}
        <MobileHeader
          title={isAr?'لوحة القيادة':'Tableau de bord direction'}
          subtitle={ecole?.nom||''}
          icon={LayoutDashboard}
          onBack={()=>goBack?goBack():navigate('dashboard')}
          lang={lang}
          actions={
            /* Export mobile */
            <HeaderMenu lang={lang} actions={actionsExport({ onPDF: handleExportPDF, onExcel: handleExportExcel, lang })} />
          }>
          {/* Sélecteur période - Etape 14 v2 - Composant hybride */}
          <div>
            <PeriodeSelectorHybride
              boutonsRapides={boutonsRapides}
              dropdownItems={dropdownItems}
              allowCustom={true}
              periode={periode}
              setPeriode={setPeriode}
              dateDebut={customDebut}
              dateFin={customFin}
              setDateDebut={setCustomDebut}
              setDateFin={setCustomFin}
              lang={lang}
              variant="dark"
            />
          </div>
          {periodesBDD.length === 0 && !anneeActive && (
            <div style={{padding:'6px 10px',background:'rgba(255,180,80,0.15)',border:'1px solid rgba(255,180,80,0.3)',borderRadius:8,fontSize:10,color:'rgba(255,255,255,0.9)'}}>
              💡 {isAr?'لم تقم بإعداد سنة دراسية. الفترات (T1، S1...) في الإدارة > الفترات':'Pas d\'année scolaire active. Configurez vos périodes dans Gestion → Périodes'}
            </div>
          )}
        </MobileHeader>

        <div style={{padding:'12px'}}>
          {/* Alertes — charte mobile : icone lucide selon le type (meme message) */}
          {alertes.length>0&&(
            <div style={{marginBottom:14}}>
              {alertes.map((a,i)=>{
                const col = a.type==='danger'?C.crit:a.type==='warning'?C.warn:a.type==='success'?C.good:C.info;
                const Ic = a.type==='danger'?CircleAlert:a.type==='warning'?TriangleAlert:a.type==='success'?Award:GraduationCap;
                return (
                  <div key={i} style={{background:C.surface,borderRadius:10,padding:'10px 12px',marginBottom:6,
                    display:'flex',gap:8,alignItems:'flex-start',border:`1px solid ${C.line}`,
                    borderInlineStart:`3px solid ${col}`}}>
                    <Ic size={16} color={col} style={{flexShrink:0,marginTop:1}} />
                    <span style={{fontSize:12,color:C.text}}>{a.msg}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* KPIs — charte mobile : tuiles communes */}
          <div style={{marginBottom:16}}>
            <KpiGrid cols={2}>
              <KpiTile icon={Users} tone="brand" value={kpis.elevesActifs} label={isAr?'طالب نشط':'Élèves actifs'}
                hint={`/ ${kpis.totalEleves} total`} />
              <KpiTile icon={Activity} value={`${kpis.tauxActivite}%`} label={isAr?'نسبة النشاط':'Taux activité'}
                tone={kpis.tauxActivite>=70?'good':kpis.tauxActivite>=50?'warn':'crit'} />
              <KpiTile icon={BookOpen} tone="neutral" value={kpis.totalTomon} label={isAr?'ثُمن مُستظهَر':'Tomon validés'} />
              <KpiTile icon={BookOpenCheck} tone="neutral" value={kpis.totalHizb} label={isAr?'حزب مكتمل':'Hizb complets'} />
              <KpiTile icon={Award} tone="neutral" value={kpis.totalCerts} label={isAr?'شهادة':'Certificats'} />
              <KpiTile icon={GraduationCap} tone="neutral" value={kpis.totalPassages} label={isAr?'انتقال مستوى':'Passages niveau'} />
            </KpiGrid>
          </div>

          {/* Évolution mensuelle */}
          <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>
              {isAr?'التطور الشهري (الثُّمنات)':'Évolution mensuelle (tomon)'}
            </div>
            <BarChart data={evolutionMensuelle.map(m=>({label:m.label,val:m.tomon,color:'#1D9E75'}))}/>
          </div>

          {/* Par niveau */}
          <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>
              {isAr?'الأداء حسب المستوى':'Performance par niveau'}
            </div>
            {statsByNiveau.map(s=>(
              <div key={s.code} style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${C.line}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <LevelBadge code={s.code} color={s.color} />
                  <span style={{fontSize:11,color:C.muted}}>{s.actifs}/{s.total} actifs</span>
                </div>
                <div style={{background:C.bg,borderRadius:6,height:8,overflow:'hidden'}}>
                  <div style={{width:`${s.taux}%`,background:s.color,height:'100%',borderRadius:6}}/>
                </div>
                <div style={{display:'flex',gap:12,marginTop:6}}>
                  <span style={{fontSize:11,color:C.muted}}>{s.tomon} tomon</span>
                  <span style={{fontSize:11,color:C.muted}}>{s.hizb} hizb</span>
                  <span style={{fontSize:11,marginInlineStart:'auto',fontWeight:700,color:C.text}}>{s.taux}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Top élèves */}
          <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>
              {isAr?'أفضل الطلاب':'Top 5 élèves'}
            </div>
            {topEleves.map((e,i)=>{
              const nc = getNc(niveaux, e.code_niveau);
              return (
                <div key={e.id} onClick={()=>navigate('fiche',eleves.find(el=>el.id===e.id))}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',minHeight:44,
                    borderBottom:`1px solid ${C.line}`,cursor:'pointer'}}>
                  {/* Medailles de classement conservees */}
                  <div style={{width:28,height:28,borderRadius:'50%',
                    background:i<3?'transparent':C.bg,border:i<3?'none':`1px solid ${C.line}`,
                    color:C.muted,display:'flex',alignItems:'center',justifyContent:'center',
                    fontWeight:700,fontSize:i<3?18:12,flexShrink:0}}>
                    {i<3?['🥇','🥈','🥉'][i]:i+1}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:C.text}}>{e.prenom} {e.nom}</div>
                    <div style={{marginTop:2}}><LevelBadge code={e.code_niveau} color={nc} /></div>
                  </div>
                  <div style={{fontSize:16,fontWeight:700,color:C.brand}}>{e.pts}<span style={{fontSize:10,color:C.muted}}> pts</span></div>
                </div>
              );
            })}
          </div>

          {/* Par instituteur */}
          {statsByInst.length>0&&(
            <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:'14px',marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>
                {isAr?'الأداء حسب الأستاذ':'Performance par instituteur'}
              </div>
              {statsByInst.map(s=>(
                <div key={s.id} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.line}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.text}}>{s.nom}</span>
                    <span style={{fontSize:12,color:C.brand,fontWeight:700}}>{s.seances} séances</span>
                  </div>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:C.muted}}>{s.nbEleves} élèves</span>
                    <span style={{fontSize:11,color:C.muted}}>{s.tomon} tomon</span>
                    <span style={{fontSize:11,color:C.muted}}>moy {s.moy}/élève</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{padding:'0 12px'}}>{sectionRgpd}</div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DESKTOP
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{maxWidth:1100,margin:'0 auto',padding:'0 1rem 2rem'}}>
      {/* Header — variant 'hero' (titre 22px vert, h1 sémantique) */}
      <PageHeader
        title="Tableau de bord direction"
        titleAr="لوحة قيادة المدير"
        icon="📊"
        subtitle={`${ecole?.nom || ''}${ecole?.nom ? ' — ' : ''}${isAr ? 'نظرة شاملة على أداء المدرسة' : "Vue analytique de l'école"}`}
        onBack={() => goBack ? goBack() : navigate('dashboard')}
        lang={lang}
        variant="hero"
        actions={
          <ExportButtons
            onPDF={handleExportPDF}
            onExcel={handleExportExcel}
            lang={lang}
            variant="inline"
            compact
          />
        }
      />

      {/* Sélecteur période - Etape 14 v2 - Composant hybride */}
      <div style={{display:'flex',justifyContent:'center',marginBottom:'1.25rem',flexDirection:'column',alignItems:'center',gap:6}}>
        <PeriodeSelectorHybride
          boutonsRapides={boutonsRapides}
          dropdownItems={dropdownItems}
          allowCustom={true}
          periode={periode}
          setPeriode={setPeriode}
          dateDebut={customDebut}
          dateFin={customFin}
          setDateDebut={setCustomDebut}
          setDateFin={setCustomFin}
          lang={lang}
          variant="default"
        />
        {periodesBDD.length === 0 && !anneeActive && (
          <div style={{padding:'6px 12px',background:'#FFF8EC',border:'1px solid #EF9F2730',borderRadius:8,fontSize:11,color:'#7B5800',display:'flex',alignItems:'center',gap:6}}>
            💡 {isAr?'لم تقم بإعداد سنة دراسية بعد':'Pas d\'année scolaire active'}
            — {isAr?'الإدارة > الفترات':'Gestion → Périodes'}
          </div>
        )}
      </div>

      {/* Alertes */}
      {alertes.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10,marginBottom:'1.5rem'}}>
          {alertes.map((a,i)=>(
            <div key={i} style={{background:'#fff',borderRadius:10,padding:'12px 14px',
              display:'flex',gap:10,alignItems:'flex-start',
              borderLeft:`3px solid ${a.type==='danger'?'#E24B4A':a.type==='warning'?'#EF9F27':a.type==='success'?'#1D9E75':'#378ADD'}`}}>
              <span style={{fontSize:16}}>{a.icon}</span>
              <span style={{fontSize:12,color:'#444',lineHeight:1.4}}>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:'1.5rem'}}>
        <StatsCard icon="👥" value={kpis.elevesActifs}        label={isAr?'طالب نشط':'Élèves actifs'}
          color="green" subtitle={`/ ${kpis.totalEleves}`} />
        <StatsCard icon="📈" value={`${kpis.tauxActivite}%`}  label={isAr?'نسبة النشاط':'Taux activité'}
          color={kpis.tauxActivite>=70 ? 'green' : kpis.tauxActivite>=50 ? 'amber' : 'red'} />
        <StatsCard icon="📅" value={kpis.totalSeances}        label={isAr?'جلسة':'Séances'}     color="blue"   />
        <StatsCard icon="📖" value={kpis.totalTomon}          label={isAr?'ثُمن':'Tomon'}        color="blue"   />
        <StatsCard icon="⭐" value={kpis.totalHizb}           label={isAr?'حزب':'Hizb'}          color="purple" />
        <StatsCard icon="🏅" value={kpis.totalCerts}          label={isAr?'شهادة':'Certificats'} color="amber"  />
      </div>

      {/* 2 colonnes principales */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',marginBottom:'1.5rem'}}>

        {/* Évolution mensuelle */}
        <div className="card">
          <SectionTitle icon="📅" title={isAr?'التطور الشهري':'Évolution mensuelle'}
            sub={isAr?'آخر 6 أشهر':'6 derniers mois'}/>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:'#888',marginBottom:6}}>{isAr?'الثُّمنات':'Tomon validés'}</div>
            <BarChart data={evolutionMensuelle.map(m=>({label:m.label,val:m.tomon,color:'#1D9E75'}))}/>
          </div>
          <div>
            <div style={{fontSize:11,color:'#888',marginBottom:6}}>{isAr?'الطلاب النشطون':'Élèves actifs'}</div>
            <BarChart data={evolutionMensuelle.map(m=>({label:m.label,val:m.eleves,color:'#378ADD'}))}/>
          </div>
          <div style={{marginTop:12,display:'flex',gap:16,borderTop:'0.5px solid #f0f0ec',paddingTop:12}}>
            <div style={{fontSize:11,color:'#888'}}>📈 {isAr?'تطور الثُّمنات':'Tendance tomon'}</div>
            <MiniSparkline values={evolutionMensuelle.map(m=>m.tomon)} color="#1D9E75"/>
          </div>
        </div>

        {/* Par niveau */}
        <div className="card">
          <SectionTitle icon="🎯" title={isAr?'الأداء حسب المستوى':'Performance par niveau'}/>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:'1px solid #f0f0ec'}}>
                <th style={{textAlign:'right',padding:'6px 8px',color:'#888',fontWeight:600}}>{isAr?'المستوى':'Niveau'}</th>
                <th style={{textAlign:'center',padding:'6px 4px',color:'#888',fontWeight:600}}>{isAr?'الطلاب':'Élèves'}</th>
                <th style={{textAlign:'center',padding:'6px 4px',color:'#888',fontWeight:600}}>{isAr?'النشاط':'Activité'}</th>
                <th style={{textAlign:'center',padding:'6px 4px',color:'#888',fontWeight:600}}>{isAr?'الثُّمنات':'Tomon'}</th>
                <th style={{textAlign:'center',padding:'6px 4px',color:'#888',fontWeight:600}}>{isAr?'الأحزاب':'Hizb'}</th>
              </tr>
            </thead>
            <tbody>
              {statsByNiveau.map(s=>(
                <tr key={s.code} style={{borderBottom:'0.5px solid #f9f9f6'}}>
                  <td style={{padding:'8px'}}>
                    <span style={{background:`${s.color}20`,color:s.color,padding:'2px 8px',borderRadius:8,fontSize:11,fontWeight:700}}>
                      {s.code}
                    </span>
                    <span style={{fontSize:11,color:'#888',marginLeft:6}}>{s.nom}</span>
                  </td>
                  <td style={{textAlign:'center',padding:'8px 4px',fontSize:12,fontWeight:700,color:s.color}}>
                    {s.total}
                  </td>
                  <td style={{textAlign:'center',padding:'8px 4px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}>
                      <div style={{width:40,height:6,background:'#f0f0ec',borderRadius:3,overflow:'hidden'}}>
                        <div style={{width:`${s.taux}%`,background:s.color,height:'100%',borderRadius:3}}/>
                      </div>
                      <span style={{fontSize:11,color:s.taux>=70?'#085041':s.taux>=50?'#EF9F27':'#E24B4A',fontWeight:600}}>{s.taux}%</span>
                    </div>
                  </td>
                  <td style={{textAlign:'center',padding:'8px 4px',fontSize:12,color:'#378ADD',fontWeight:600}}>{s.tomon}</td>
                  <td style={{textAlign:'center',padding:'8px 4px',fontSize:12,color:'#534AB7',fontWeight:600}}>{s.hizb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2 colonnes bas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>

        {/* Top élèves */}
        <div className="card">
          <SectionTitle icon="🏆" title={isAr?'أفضل الطلاب':'Top 5 élèves'} sub={isAr?'حسب النقاط':'par points sur la période'}/>
          {topEleves.length===0
            ? <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>
                {isAr?'لا توجد بيانات للفترة المحددة':'Aucune donnée pour cette période'}
              </div>
            : topEleves.map((e,i)=>{
                const nc = getNc(niveaux, e.code_niveau);
                return (
                  <div key={e.id} onClick={()=>navigate('fiche',eleves.find(el=>el.id===e.id))}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',
                      borderBottom:'0.5px solid #f5f5f0',cursor:'pointer'}}
                    onMouseEnter={ev=>ev.currentTarget.style.background='#f9f9f6'}
                    onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
                    <div style={{width:32,height:32,borderRadius:'50%',flexShrink:0,
                      background:i<3?['#EF9F27','#C0C0C0','#C4763B'][i]:`${nc}20`,
                      color:i<3?'#fff':nc,display:'flex',alignItems:'center',justifyContent:'center',
                      fontWeight:800,fontSize:14}}>
                      {i<3?['🥇','🥈','🥉'][i]:i+1}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13}}>{e.prenom} {e.nom}</div>
                      <div style={{fontSize:11,color:'#888'}}>{e.code_niveau}</div>
                    </div>
                    <div style={{fontSize:18,fontWeight:800,color:'#1D9E75',flexShrink:0}}>
                      {e.pts}<span style={{fontSize:11,color:'#888',fontWeight:400}}> pts</span>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* Par instituteur */}
        <div className="card">
          <SectionTitle icon="👨‍🏫" title={isAr?'الأداء حسب الأستاذ':'Performance par instituteur'}/>
          {statsByInst.length===0
            ? <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>
                {isAr?'لا يوجد أساتذة مرتبطون':'Aucun instituteur avec des données'}
              </div>
            : <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #f0f0ec'}}>
                    <th style={{textAlign:'right',padding:'6px',color:'#888',fontWeight:600}}>{isAr?'الأستاذ':'Instituteur'}</th>
                    <th style={{textAlign:'center',padding:'6px 4px',color:'#888',fontWeight:600}}>{isAr?'الطلاب':'Élèves'}</th>
                    <th style={{textAlign:'center',padding:'6px 4px',color:'#888',fontWeight:600}}>{isAr?'الجلسات':'Séances'}</th>
                    <th style={{textAlign:'center',padding:'6px 4px',color:'#888',fontWeight:600}}>{isAr?'الثُّمنات':'Tomon'}</th>
                    <th style={{textAlign:'center',padding:'6px 4px',color:'#888',fontWeight:600}}>{isAr?'المعدل':'Moy/él.'}</th>
                  </tr>
                </thead>
                <tbody>
                  {statsByInst.map(s=>(
                    <tr key={s.id} style={{borderBottom:'0.5px solid #f9f9f6'}}>
                      <td style={{padding:'8px',fontWeight:600,fontSize:12}}>{s.nom}</td>
                      <td style={{textAlign:'center',padding:'8px 4px',color:'#378ADD',fontWeight:700}}>{s.nbEleves}</td>
                      <td style={{textAlign:'center',padding:'8px 4px',color:'#085041',fontWeight:700}}>{s.seances}</td>
                      <td style={{textAlign:'center',padding:'8px 4px',color:'#534AB7',fontWeight:700}}>{s.tomon}</td>
                      <td style={{textAlign:'center',padding:'8px 4px'}}>
                        <span style={{background:s.moy>=5?'#E1F5EE':s.moy>=2?'#FEF3DA':'#FCEAEA',
                          color:s.moy>=5?'#085041':s.moy>=2?'#EF9F27':'#E24B4A',
                          padding:'2px 7px',borderRadius:8,fontSize:11,fontWeight:700}}>
                          {s.moy}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        {/* ═══ P2.1 : Section Audit RGPD (scope école) ═══ */}
        {sectionRgpd}
      </div>
    </div>
  );
}
