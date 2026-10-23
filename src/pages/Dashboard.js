import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getCachedSWR } from '../lib/cache';
import { fetchAll } from '../lib/fetchAll';
import { calcEtatEleve, isSourateNiveauDyn, niveauTraduit, calcStats, formatDate, formatDateCourt, isInactif, joursDepuis, getInitiales, scoreLabel, loadBareme, BAREME_DEFAUT, getSensForEleve, calcPointsPeriode} from '../lib/helpers';
import { t } from '../lib/i18n';
import ExportButtons from '../components/ExportButtons';
import { HeaderMenu, actionsExport, KpiTile, KpiGrid } from '../components/ui';
import { AlertOctagon, AlertTriangle, Hourglass, TrendingDown, Rocket, Award, Bell, Sparkles, BookCheck, Activity, CalendarDays } from 'lucide-react';
// Charte mobile (oct 2026) : icones des alertes intelligentes
const ICONE_ALERTE = { stagnation: TrendingDown, rapide: Rocket, hizb_bloque: Hourglass };
import { usePullToRefresh, PullToRefreshIndicator } from '../lib/usePullToRefresh';

const C = { green:'#1D9E75',greenBg:'#E1F5EE',blue:'#378ADD',blueBg:'#E6F1FB',amber:'#EF9F27',amberBg:'#FAEEDA',red:'#E24B4A',redBg:'#FCEBEB',border:'#e0e0d8',muted:'#888',dark:'#1a1a1a' };
// Couleurs niveaux — fallback sur des valeurs par défaut si niveaux pas encore chargés
const NIVEAU_COLORS_FALLBACK = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };
const getNiveauColor = (code, niveaux) => {
  if (niveaux && niveaux.length > 0) return niveaux.find(n=>n.code===code)?.couleur || '#888';
  return NIVEAU_COLORS_FALLBACK[code] || '#888';
};
function NiveauBadge({ code, niveaux=[] }) {
  const c = getNiveauColor(code||'', niveaux||[]) || '#888';
  return code ? <span style={{padding:'1px 6px',borderRadius:10,fontSize:9,fontWeight:700,background:c+'18',color:c,border:`0.5px solid ${c}40`}}>{code}</span> : null;
}
function Avatar({ prenom, nom, size=36, bg=C.greenBg, color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}
function Medaille({ idx }) {
  const colors=['#EF9F27','#B0B0B0','#CD7F32'];
  if(idx>2) return <span style={{fontSize:11,color:'#bbb',width:22,display:'inline-block',textAlign:'center'}}>{idx+1}</span>;
  return <div style={{width:22,height:22,borderRadius:'50%',background:colors[idx],display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',fontWeight:700,flexShrink:0}}>{idx+1}</div>;
}
function Bar8({ done, color=C.green }) {
  return <div style={{display:'flex',gap:2}}>{[1,2,3,4,5,6,7,8].map(n=><div key={n} style={{flex:1,height:5,borderRadius:2,background:n<=done?color:'#e8e8e0'}}/>)}</div>;
}

function calcAlertes(eleves, allValidations, lang) {
  const alertes = [];
  const maintenant = new Date();
  const semaineDerniere = new Date(maintenant); semaineDerniere.setDate(maintenant.getDate()-7);
  const deuxSemaines = new Date(maintenant); deuxSemaines.setDate(maintenant.getDate()-14);
  eleves.forEach(e => {
    const vals = allValidations.filter(v => v.eleve_id === e.id);
    const valsSemaine = vals.filter(v => new Date(v.date_validation) >= semaineDerniere);
    const valsPrec = vals.filter(v => new Date(v.date_validation) >= deuxSemaines && new Date(v.date_validation) < semaineDerniere);
    const tomonS = valsSemaine.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
    const tomonP = valsPrec.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
    const joursSans = joursDepuis(vals[0]?.date_validation);
    if (tomonS===0 && tomonP>0) alertes.push({ type:'stagnation', eleve:e, msg:`${e.prenom} ${e.nom} — ${lang==='ar'?'لا استظهار هذا الأسبوع':'Aucune récitation cette semaine'}`, color:C.red, bg:C.redBg, icon:'📉' });
    if (tomonS>=6) alertes.push({ type:'rapide', eleve:e, msg:`${e.prenom} ${e.nom} — ${lang==='ar'?`أداء ممتاز: ${tomonS} أثمان`:`Excellente semaine — ${tomonS} Tomon`}`, color:C.green, bg:C.greenBg, icon:'🚀' });
    if (e.etat.enAttenteHizbComplet && joursSans>7) alertes.push({ type:'hizb_bloque', eleve:e, msg:`${e.prenom} ${e.nom} — ${lang==='ar'?`الحزب ${e.etat.hizbEnCours} في انتظار التصحيح منذ ${joursSans} يوم`:`Hizb ${e.etat.hizbEnCours} en attente depuis ${joursSans} jours`}`, color:C.amber, bg:C.amberBg, icon:'⏳' });
  });
  return alertes.sort((a,b)=>({stagnation:0,hizb_bloque:1,rapide:2}[a.type]||3)-({stagnation:0,hizb_bloque:1,rapide:2}[b.type]||3));
}

export default function Dashboard({ user, navigate, goBack, lang, isMobile=false }) {
  const [niveaux, setNiveaux] = useState([]);
  const [ecoleConfig, setEcoleConfig] = useState(null);
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('general');
  const [stats, setStats] = useState({});
  const [bareme, setBareme] = useState({...BAREME_DEFAUT});
  const [exportMsg, setExportMsg] = useState('');
  const [selectedEleves, setSelectedEleves] = useState([]);
  const [searchEleve, setSearchEleve] = useState('');
  const [filtreInst, setFiltreInst] = useState('tous');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [filtreNiveau, setFiltreNiveau] = useState('tous');
  const [tri, setTri] = useState('points_desc');

  useEffect(() => { loadData(); }, []);

  // Au retour online après une sync offline, invalider le cache et recharger
  useEffect(() => {
    const handler = () => {
      // Le cache est déjà invalidé par les callers, mais par prudence :
      loadData();
    };
    window.addEventListener('offline-synced', handler);
    return () => window.removeEventListener('offline-synced', handler);
  }, []);

  // Transforme les données brutes en format d'affichage
  // Optimisé O(n+m) au lieu de O(n*m) via Map
  // BUG-FIX POINTS (oct 2026) : parametre `bar` ajoute pour passer le bareme a calcEtatEleve.
  // Ajout (oct 2026) : pe (points_eleves) et certs (certificats_eleves) pour que le
  // total des eleves sourate inclue examens + certificats, comme ListeNotes.
  const buildElevesData = (ed, id, vd, rd, nv, ec, bar, pe, certs) => {
    // Index des validations par eleve_id pour un lookup O(1) au lieu de filtrer n fois
    const valsByEleve = new Map();
    (vd||[]).forEach(v => {
      if (!valsByEleve.has(v.eleve_id)) valsByEleve.set(v.eleve_id, []);
      valsByEleve.get(v.eleve_id).push(v);
    });
    const instById = new Map((id||[]).map(i => [i.id, i]));

    const recSouratesMap = {};
    const recSouratesCountMap = {};
    (rd||[]).forEach(r => {
      if (!recSouratesMap[r.eleve_id]) recSouratesMap[r.eleve_id] = r.date_validation;
      if (r.type_recitation === 'complete' && !r.is_muraja) { // FIX (oct 2026) : muraja exclue
        recSouratesCountMap[r.eleve_id] = (recSouratesCountMap[r.eleve_id]||0)+1;
      }
    });

    // BUG-FIX POINTS SOURATES DASHBOARD (oct 2026) : calcEtatEleve.points.total ne
    // compte que les tomons/hizbs. Pour un eleve sourate, cela donne toujours 0,
    // alors que son score reel = sourates + ensembles valides + (certificats/examens
    // non charges ici). On enrichit donc etat.points.total pour les eleves sourate
    // avec les points des recitations_sourates et des ensembles valides.
    const recsByEleve = new Map();
    (rd||[]).forEach(r => {
      if (!recsByEleve.has(r.eleve_id)) recsByEleve.set(r.eleve_id, []);
      recsByEleve.get(r.eleve_id).push(r);
    });
    // FIX (oct 2026) : lignes par eleve pour calcPointsPeriode (dates par defaut si absentes)
    const DEBUT_TOUT = new Date('1990-01-01'), FIN_TOUT = new Date('2100-01-01');
    const peByEleve = new Map();
    (pe||[]).forEach(e => {
      if (!peByEleve.has(e.eleve_id)) peByEleve.set(e.eleve_id, []);
      peByEleve.get(e.eleve_id).push({ ...e, date_event: e.date_event || '2000-01-01T12:00:00' });
    });
    const certsByEleve = new Map();
    (certs||[]).forEach(c => {
      if (!certsByEleve.has(c.eleve_id)) certsByEleve.set(c.eleve_id, []);
      certsByEleve.get(c.eleve_id).push({ ...c, date_obtention: c.date_emission || c.created_at || '2000-01-01T12:00:00' });
    });

    return (ed||[]).map(eleve => {
      const vals = valsByEleve.get(eleve.id) || [];
      const sensE = getSensForEleve(eleve, nv, ec);
      const etat = calcEtatEleve(vals, eleve.hizb_depart, eleve.tomon_depart, sensE, eleve, null, bar);
      // FIX (oct 2026) : total Dashboard = acquis anterieurs + calcul de reference depuis
      // le suivi (calcPointsPeriode : tomon, hizb, muraja, ensembles, sourates, examens,
      // certificats), pour TOUS les eleves. Avant, un eleve hizb n'avait ni muraja, ni
      // examens, ni certificats -> l'ecart avec Notes n'etait pas seulement les acquis.
      if (etat && etat.points) {
        const recsEleve = recsByEleve.get(eleve.id) || [];
        const peEleve = (peByEleve.get(eleve.id) || []);
        const certsEleve = (certsByEleve.get(eleve.id) || []);
        const suivi = calcPointsPeriode(vals, DEBUT_TOUT, FIN_TOUT, bar, peEleve, recsEleve, certsEleve);
        etat.points.ptsDepuisSuivi = suivi.total;
        etat.points.total = (etat.points.ptsAcquisTotal || 0) + suivi.total;
      }
      const derniereHizb = vals[0]?.date_validation||null;
      const derniereSourate = recSouratesMap[eleve.id]||null;
      const derniere = derniereHizb && derniereSourate
        ? (new Date(derniereHizb) > new Date(derniereSourate) ? derniereHizb : derniereSourate)
        : (derniereHizb || derniereSourate);
      const inst = instById.get(eleve.instituteur_referent_id);
      return {...eleve,etat,derniere,jours:joursDepuis(derniere),instituteurNom:inst?`${inst.prenom} ${inst.nom}`:'—',instituteur:inst,inactif:isInactif(derniere),recSouratesCount:recSouratesCountMap[eleve.id]||0};
    });
  };

  // Applique les données chargées au state
  // BUG-FIX POINTS (oct 2026) : parametre `bar` ajoute pour passer le bareme.
  const applyData = (ed, id, vd, rd, nv, ec, bar, pe, certs) => {
    const elevesData = buildElevesData(ed, id, vd, rd, nv, ec, bar, pe, certs);
    setNiveaux(nv||[]);
    if (ec !== undefined) setEcoleConfig(ec);
    setEleves(elevesData);
    setInstituteurs(id||[]);
    setAllValidations(vd||[]);
    setStats(calcStats(vd||[]));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // BUG-FIX POINTS (oct 2026) : on await loadBareme en parallele des autres chargements
      // pour pouvoir passer le bareme a calcEtatEleve des le premier rendu.
      // Avant : loadBareme etait fire-and-forget -> calcEtatEleve toujours sans bareme -> 0 pts.

      // OPTIM Phase 2 : rendu progressif
      // Étape 1 : RPC pré-calculée (~200ms) → affichage rapide des stats de base
      // Étape 2 : données détaillées (~1-2s) → recalcul précis en remplacement

      const rpcPromise = supabase.rpc('get_eleves_stats', { p_ecole_id: user.ecole_id })
        .then(res => (!res.error && Array.isArray(res.data)) ? res.data : null)
        .catch(() => null);

      const baremePromise = loadBareme(supabase, user.ecole_id).catch(() => null);

      const [rpcEleves, id, nv, baremeData] = await Promise.all([
        rpcPromise,
        getCachedSWR('instituteurs', user.ecole_id,
          () => supabase.from('utilisateurs').select('id,prenom,nom,role').eq('role','instituteur').eq('ecole_id', user.ecole_id)),
        getCachedSWR('niveaux', user.ecole_id,
          () => supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id', user.ecole_id).order('ordre')),
        baremePromise,
      ]);
      // Memoriser le bareme pour le state ET pour un usage immediat ci-dessous
      const baremeLocal = baremeData || {...BAREME_DEFAUT};
      if (baremeData) setBareme(baremeData);

      // Affichage rapide avec données RPC si disponibles
      if (rpcEleves) {
        const instById = new Map((id||[]).map(i => [i.id, i]));
        const elevesFromRpc = rpcEleves.map(r => {
          const inst = instById.get(r.instituteur_referent_id);
          const derniere = r.derniere_validation && r.derniere_recitation
            ? (new Date(r.derniere_validation) > new Date(r.derniere_recitation) ? r.derniere_validation : r.derniere_recitation)
            : (r.derniere_validation || r.derniere_recitation);
          const fakeVals = r.tomon_cumul > 0
            ? [{ type_validation: 'tomon', nombre_tomon: r.tomon_cumul, date_validation: r.derniere_validation || new Date().toISOString() }]
            : [];
          const sensE = getSensForEleve({ code_niveau: r.code_niveau }, nv, ecoleConfig);
          const etat = calcEtatEleve(fakeVals, r.hizb_depart, r.tomon_depart, sensE, null, null, baremeLocal);
          etat.hizbsComplets = new Set();
          for (let i = 0; i < (r.hizb_complets_count || 0); i++) etat.hizbsComplets.add(i);
          // Eleves sourate : la RPC ne fournit ni points de recitations ni ensembles.
          // On marque les points "en cours" pour afficher "…" au lieu d'un faux 0,
          // jusqu'a ce que buildElevesData (donnees completes) remplace l'etat.
          if (isSourateNiveauDyn(r.code_niveau, nv||[])) etat._ptsPending = true;
          return {
            id: r.eleve_id,
            prenom: r.prenom, nom: r.nom,
            code_niveau: r.code_niveau, niveau: r.niveau,
            hizb_depart: r.hizb_depart, tomon_depart: r.tomon_depart,
            sourates_acquises: r.sourates_acquises,
            instituteur_referent_id: r.instituteur_referent_id,
            eleve_id_ecole: r.eleve_id_ecole,
            ecole_id: user.ecole_id,
            etat, derniere,
            jours: joursDepuis(derniere),
            instituteurNom: inst ? `${inst.prenom} ${inst.nom}` : '—',
            instituteur: inst,
            inactif: isInactif(derniere),
            recSouratesCount: r.recitations_completes_count || 0,
          };
        });
        setNiveaux(nv || []);
        setInstituteurs(id || []);
        setEleves(elevesFromRpc);
        setLoading(false); // Affichage immédiat
      }

      // Charger les validations détaillées en arrière-plan
      const [edRes, vd, rd, ecRes, peData, certsData] = await Promise.all([
        // FIX (mai 2026) : select('*') au lieu d'une liste explicite tronquee.
        // ValidationRapide utilise select('*') et la recherche par eleve_id_ecole
        // fonctionne. La liste explicite oubliait colonnes -> bug filtre Dashboard.
        // select('*') garantit que tout est present (eleve_id_ecole, etc.)
        supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id).is('suspendu_at', null).order('nom'),
        getCachedSWR('validations', user.ecole_id,
          // BUG-FIX POINTS ENSEMBLES (oct 2026) : ajout de `ensemble_id` pour que
          // buildElevesData puisse sommer les points d'ensembles valides (type_validation
          // = 'ensemble_valide') via bareme.ensembles[ensemble_id].
          () => fetchAll(supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,tomon_debut,date_validation,valide_par,ecole_id,ensemble_id,valideur:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false}))),
        getCachedSWR('recitations_sourates_min', user.ecole_id,
          // BUG-FIX POINTS DASHBOARD (oct 2026) : ajout de `points` au select pour que
          // buildElevesData puisse sommer ptsSourates. Sans ca, r.points etait undefined
          // -> ptsSourates=0 -> eleves sourate affichaient 0ن meme avec recitations faites.
          () => fetchAll(supabase.from('recitations_sourates').select('eleve_id,date_validation,type_recitation,points,is_muraja').eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false}))),
        supabase.from('ecoles').select('sens_recitation_defaut').eq('id', user.ecole_id).maybeSingle(),
        // Ajout (oct 2026) : examens + certificats pour le total des eleves sourate.
        // En cas d'echec : [] -> total identique a avant (pas de blocage du Dashboard).
        supabase.from('points_eleves').select('eleve_id,type_event,points,date_event').eq('ecole_id', user.ecole_id)
          .then(r => r.data || []).catch(() => []),
        supabase.from('certificats_eleves').select('eleve_id,jalon_id,date_emission').eq('ecole_id', user.ecole_id)
          .then(r => r.data || []).catch(() => []),
      ]);


      // Recalcul précis avec toutes les données (remplace l'affichage RPC)
      // BUG-FIX POINTS (oct 2026) : passer baremeLocal pour avoir les vrais points.
      applyData(edRes.data || [], id, vd, rd, nv, ecRes?.data || null, baremeLocal, peData, certsData);

      if (!rpcEleves) setLoading(false);
    } catch (e) {
      console.error('[Dashboard.js] Erreur chargement:', e);
      setLoading(false);
    }
  };

  const alertes = useMemo(() => calcAlertes(eleves, allValidations, lang), [eleves, allValidations, lang]);
  const [certifNotifs, setCertifNotifs] = useState([]);
  const [showAttenteMobile, setShowAttenteMobile] = useState(false); // F3 (oct 2026)

  useEffect(() => {
    if (!user || !eleves.length) return;
    // Charger jalons actifs + certificats déjà émis pour détecter ceux en attente
    const checkCertifs = async () => {
      // PERF (oct 2026) : avant, une requete PAR eleve et PAR jalon (ensemble / examen), en serie
      // (des centaines d'allers-retours avec une vraie ecole). Maintenant quelques requetes
      // groupees, lancees en parallele ; le resultat (liste des certificats a delivrer) est identique.
      const { data: jalons } = await supabase.from('jalons').select('*').eq('ecole_id', user.ecole_id).eq('actif', true);
      if (!jalons || jalons.length === 0) return;
      const idsEnsembles = [...new Set(jalons.filter(j => j.type_jalon === 'ensemble_sourates' && j.ensemble_id).map(j => j.ensemble_id))];
      const idsExamens = [...new Set(jalons.filter(j => j.type_jalon === 'examen' && j.examen_id).map(j => j.examen_id))];
      const [{ data: certsEmis }, recitations, ensRes, reussis] = await Promise.all([
        supabase.from('certificats_eleves').select('eleve_id,jalon_id').eq('ecole_id', user.ecole_id),
        fetchAll(supabase.from('recitations_sourates').select('eleve_id,sourate_id,type_recitation,complete,is_muraja').eq('ecole_id', user.ecole_id)),
        idsEnsembles.length ? supabase.from('ensembles_sourates').select('id,sourates_ids').in('id', idsEnsembles) : Promise.resolve({ data: [] }),
        idsExamens.length ? fetchAll(supabase.from('resultats_examens').select('eleve_id,examen_id').in('examen_id', idsExamens).eq('statut','reussi')) : Promise.resolve([]),
      ]);
      const emis = new Set((certsEmis||[]).map(c => c.eleve_id+'_'+c.jalon_id));
      const ensParId = Object.fromEntries(((ensRes && ensRes.data) || []).map(e => [e.id, e]));
      const examReussi = new Set((reussis || []).map(r => r.eleve_id+'_'+r.examen_id));
      const notifs = [];
      for (const eleve of eleves) {
        for (const jalon of jalons) {
          if (emis.has(eleve.id+'_'+jalon.id)) continue;
          let atteint = false;
          if (jalon.type_jalon === 'hizb') {
            const required = jalon.hizb_ids || [];
            atteint = required.length > 0 && required.every(h => eleve.etat.hizbsComplets.has(Number(h)));
          } else if (jalon.type_jalon === 'ensemble_sourates' && jalon.ensemble_id) {
            const ens = ensParId[jalon.ensemble_id];
            if (ens && ens.sourates_ids && ens.sourates_ids.length > 0) {
              const srecs = (recitations||[]).filter(r=>r.eleve_id===eleve.id && (r.type_recitation==='complete'||r.complete) && !r.is_muraja);
              const sComplets = new Set(srecs.map(r=>r.sourate_id));
              atteint = ens.sourates_ids.every(sid => sComplets.has(sid));
            }
          } else if (jalon.type_jalon === 'examen' && jalon.examen_id) {
            atteint = examReussi.has(eleve.id+'_'+jalon.examen_id);
          }
          if (atteint) notifs.push({ eleve, jalon });
        }
      }
      if (!annule) setCertifNotifs(notifs);
    };
    // PERF (oct 2026) : lance 1,2 s apres l'affichage et annule si on quitte l'accueil avant
    // (ex. clic sur un eleve) : ces requetes (dont toutes les recitations de l'ecole) ne
    // concurrencent plus le chargement de la fiche eleve. La carte « Certificats a delivrer »
    // apparait simplement un instant apres le reste de l'accueil.
    let annule = false;
    const minuteur = setTimeout(() => { if (!annule) checkCertifs().catch(() => {}); }, 1200);
    return () => { annule = true; clearTimeout(minuteur); };
  }, [eleves, user]);
  const totalPoints = eleves.reduce((s,e)=>s+e.etat.points.total,0);
  const totalTomon = eleves.reduce((s,e)=>s+e.etat.tomonCumul,0);
  const totalHizb = eleves.reduce((s,e)=>s+e.etat.hizbsComplets.size,0);
  const nbInactifs = eleves.filter(e=>e.inactif).length;
  const nbAttente = eleves.filter(e=>e.etat.enAttenteHizbComplet).length;
  const nbActifsSemaine = eleves.filter(e=>e.jours!=null&&e.jours<=7).length;

  // Préchargement au survol : quand la souris passe sur un élève, on précharge
  // ses validations et récitations en arrière-plan. Quand l'utilisateur clique,
  // les données sont déjà dans le cache SWR → affichage quasi instantané.
  const prefetchedRef = React.useRef(new Set());
  const prefetchEleve = (eleveId) => {
    if (!eleveId || prefetchedRef.current.has(eleveId)) return;
    prefetchedRef.current.add(eleveId);
    // Fire-and-forget : on utilise les mêmes clés de cache que FicheEleve
    getCachedSWR(`validations_${eleveId}`, user.ecole_id,
      () => fetchAll(supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).eq('eleve_id', eleveId).order('date_validation',{ascending:false}))
    ).catch(()=>{});
    getCachedSWR(`recitations_eleve_${eleveId}`, user.ecole_id,
      () => fetchAll(supabase.from('recitations_sourates').select('id,type_recitation,sourate_id,verset_debut,verset_fin,date_validation,valide_par,points,is_muraja,sourate:sourate_id(nom_ar,numero),valideur:valide_par(prenom,nom)').eq('ecole_id', user.ecole_id).eq('eleve_id', eleveId))
    ).catch(()=>{});
  };
  const tauxSemaine = eleves.length>0 ? Math.round(nbActifsSemaine/eleves.length*100) : 0;
  const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);

  const recapMois = useMemo(() => {
    const vMois = allValidations.filter(v=>new Date(v.date_validation)>=debutMois);
    return { nbRecit: vMois.length, mois: new Date().toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{month:'long'}) };
  }, [allValidations, eleves]);

  const elevesFiltres = useMemo(() => {
    let list = [...eleves];
    if(searchEleve) list=list.filter(e=>`${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(searchEleve.toLowerCase()));
    if(filtreInst!=='tous') list=list.filter(e=>e.instituteur_referent_id===filtreInst);
    if(filtreStatut==='actifs') list=list.filter(e=>!e.inactif);
    if(filtreStatut==='inactifs') list=list.filter(e=>e.inactif);
    if(filtreStatut==='attente') list=list.filter(e=>e.etat.enAttenteHizbComplet);
    if(filtreNiveau!=='tous') list=list.filter(e=>e.niveau===filtreNiveau);
    switch(tri){
      case 'points_desc': list.sort((a,b)=>b.etat.points.total-a.etat.points.total); break;
      case 'points_asc': list.sort((a,b)=>a.etat.points.total-b.etat.points.total); break;
      case 'hizb_desc': list.sort((a,b)=>b.etat.hizbEnCours-a.etat.hizbEnCours); break;
      case 'hizb_asc': list.sort((a,b)=>a.etat.hizbEnCours-b.etat.hizbEnCours); break;
      case 'nom_asc': list.sort((a,b)=>a.nom.localeCompare(b.nom)); break;
      case 'inactif': list.sort((a,b)=>(b.jours||0)-(a.jours||0)); break;
      case 'recente': list.sort((a,b)=>new Date(b.derniere||0)-new Date(a.derniere||0)); break;
      default: break;
    }
    return list;
  }, [eleves,searchEleve,filtreInst,filtreStatut,filtreNiveau,tri]);

  const statsInst = useMemo(() => instituteurs.map(inst => {
    const ei = eleves.filter(e=>e.instituteur_referent_id===inst.id);
    return {...inst,nbEleves:ei.length,totalPoints:ei.reduce((s,e)=>s+e.etat.points.total,0),totalTomon:ei.reduce((s,e)=>s+e.etat.tomonCumul,0),totalHizb:ei.reduce((s,e)=>s+e.etat.hizbsComplets.size,0),nbInactifs:ei.filter(e=>e.inactif).length,nbAttente:ei.filter(e=>e.etat.enAttenteHizbComplet).length,meilleur:[...ei].sort((a,b)=>b.etat.points.total-a.etat.points.total)[0]||null};
  }), [instituteurs,eleves]);

  const exportExcel = () => {
    const rang=[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total);
    const rows=[['#',t(lang,'prenom'),t(lang,'nom_label'),t(lang,'niveau'),t(lang,'referent'),t(lang,'hizb_en_cours'),t(lang,'tomon_valides'),lang==='ar'?'مجموع الثُّمن':'Total Tomon',lang==='ar'?'الأحزاب المكتملة':'Hizb complets',t(lang,'pts_label'),t(lang,'statut')],
      ...rang.map((e,idx)=>[idx+1,e.prenom,e.nom,e.niveau,e.instituteurNom,e.etat.hizbEnCours,e.etat.tomonDansHizbActuel,e.etat.tomonCumul,e.etat.hizbsComplets.size,e.etat.points.total,e.etat.enAttenteHizbComplet?t(lang,'attente_hizb'):e.inactif?t(lang,'inactif'):t(lang,'actif')])];
    const csv='\uFEFF'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); a.download=`suivi-${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.csv`; a.click();
    setExportMsg('✓'); setTimeout(()=>setExportMsg(''),2000);
  };
  // [RGPD 4.3] Ancienne fonction backupJSON retiree : elle exportait TOUS les
  // eleves + TOUTES les validations + TOUS les utilisateurs de l'ecole, ce qui
  // n'etait pas conforme RGPD (art. 20 : chacun ne peut exporter QUE ses propres
  // donnees). Remplacee par l'export RGPD individuel dans les profils.
  const tabs = [{key:'general',icon:'🏠',labelKey:'vue_generale'},{key:'eleves',icon:'👥',labelKey:'eleves'},{key:'instituteurs',icon:'👨‍🏫',labelKey:'instituteurs'},...(user.role==='surveillant'?[{key:'rapport',icon:'📊',labelKey:'rapport_tab'}]:[])];

  // BUG-FIX (oct 2026) : hook appele avant le return mobile (il l'etait apres ->
  // violation des regles des hooks, crash au passage du seuil 768 px).
  const {
    pullDistance, isRefreshing, isThreshold,
    onTouchStart, onTouchMove, onTouchEnd,
  } = usePullToRefresh(loadData);

  if (isMobile) {
    const podium = [...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).slice(0,3);
    const inactifs30 = eleves.filter(e=>e.jours!=null&&e.jours>30);
    const inactifs14 = eleves.filter(e=>e.jours!=null&&e.jours>14&&e.jours<=30);
    const sansRecit  = eleves.filter(e=>e.jours==null);
    // ─── Modules supprimes du Dashboard (Phase 2 - Dashboard pure synthese) ──
    // Les 17 modules sont desormais accessibles via la page ModulesMobile
    // qui s'ouvre depuis le tab "Plus" de la bottom tab bar.
    // Voir src/pages/ModulesMobile.js pour la configuration des sections.

    const podiumColors = ['#EF9F27','#B0B0B0','#CD7F32'];
    const podiumBg     = ['#FAEEDA','#f5f5f0','#f9f3ec'];
    const podiumH      = [80,60,44];
    const podiumOrder  = [1,0,2];

    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} isThreshold={isThreshold} lang={lang} />

        {/* ── HEADER GRADIENT ── */}
        <div style={{background:'linear-gradient(135deg,#064e3b 0%,#085041 40%,#1D9E75 100%)',
          padding:'calc(44px + env(safe-area-inset-top, 0px)) 18px 20px', position:'sticky', top:-16, zIndex:100, overflow:'hidden',
          margin:'-16px -16px 0' /* pleine largeur (annule le padding de main) */}}>
          {/* cercles décoratifs */}
          <div style={{position:'absolute',top:-30,right:-30,width:120,height:120,
            borderRadius:'50%',background:'rgba(255,255,255,0.06)'}}/>
          <div style={{position:'absolute',bottom:-20,left:-20,width:80,height:80,
            borderRadius:'50%',background:'rgba(255,255,255,0.04)'}}/>

          <div style={{fontSize:13,color:'rgba(255,255,255,0.75)',marginBottom:2,position:'relative'}}>
            {lang==='ar'?'مرحباً':'Bonjour'} {user.prenom}
          </div>
          <div style={{fontSize:21,fontWeight:800,color:'#fff',marginBottom:16,position:'relative',
            display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <span>{lang==='ar'?'لوحة التحكم':'Tableau de bord'}</span>
            {/* F6 (oct 2026) : export Excel aussi sur mobile (surveillant, comme le PC) */}
            {user.role==='surveillant' && (
              <HeaderMenu lang={lang} actions={actionsExport({ onExcel: exportExcel, lang })} />
            )}
          </div>

          {/* KPIs row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,position:'relative'}}>
            {[
              {val:eleves.length,        lbl:lang==='ar'?'طالب':'Élèves'},
              {val:eleves.filter(e=>!e.inactif).length, lbl:lang==='ar'?'نشيط':'Actifs'},
              {val:nbInactifs,           lbl:lang==='ar'?'غير نشيط':'Inactifs', warn:nbInactifs>0},
              {val:instituteurs.length,  lbl:lang==='ar'?'أستاذ':'Profs'},
            ].map((k,i)=>(
              <div key={i} style={{background:'rgba(255,255,255,0.15)',borderRadius:12,
                padding:'10px 8px',textAlign:'center',backdropFilter:'blur(4px)'}}>
                <div style={{fontSize:22,fontWeight:800,color:k.warn?'#FAEEDA':'#fff'}}>{k.val}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.72)',marginTop:2}}>{k.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {loading ? <div style={{textAlign:'center',padding:'3rem',color:'#888'}}>...</div> : (<>

          {/* ── SCORE ÉCOLE ── */}
          <div style={{margin:'12px 12px 0',background:'linear-gradient(135deg,#085041,#1D9E75)',
            borderRadius:16,padding:'16px 18px',color:'#fff'}}>
            <div style={{fontSize:9,opacity:0.65,textTransform:'uppercase',letterSpacing:'2px',marginBottom:2}}>
              {t(lang,'score_ecole')}
            </div>
            <div style={{fontSize:38,fontWeight:800,letterSpacing:'-1.5px',lineHeight:1}}>
              {totalPoints.toLocaleString()}
            </div>
            <div style={{display:'flex',gap:20,marginTop:10}}>
              {[
                {v:totalTomon,          l:t(lang,'tomon_abrev')},
                {v:totalHizb,           l:t(lang,'hizb_abrev')},
                {v:tauxSemaine+'%',     l:lang==='ar'?'نشاط':'Activité'},
                {v:recapMois.nbRecit,   l:lang==='ar'?'هذا الشهر':'Ce mois'},
              ].map(k=>(
                <div key={k.l}>
                  <div style={{fontSize:16,fontWeight:700}}>{k.v}</div>
                  <div style={{fontSize:10,opacity:0.7}}>{k.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ALERTES ── */}
          <div style={{padding:'10px 12px 0'}}>
            {inactifs30.length>0&&(
              <div onClick={()=>navigate('inactifs')}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                  background:'#FCEBEB',borderRadius:12,marginBottom:8,cursor:'pointer',
                  border:'0.5px solid #E24B4A30'}}>
                <AlertOctagon size={20} color="#A32D2D" style={{flexShrink:0}} />
                <div style={{flex:1,fontSize:13,fontWeight:700,color:'#A32D2D'}}>
                  {inactifs30.length} {lang==='ar'?'طالب غائب +30 يوم':'inactif(s) depuis +30 jours'}
                </div>
                <span style={{color:'#E24B4A',fontSize:16}}>›</span>
              </div>
            )}
            {nbAttente>0&&(<>
              {/* F3 (oct 2026) : renvoyait vers 'inactifs' (qui ne liste pas ces eleves).
                  Deplie la liste ; chaque eleve ouvre l'enregistrement, comme sur PC. */}
              <div onClick={()=>setShowAttenteMobile(v=>!v)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                  background:'#FAEEDA',borderRadius:12,marginBottom:8,cursor:'pointer',
                  border:'0.5px solid #EF9F2730'}}>
                <Hourglass size={20} color="#B26A00" style={{flexShrink:0}} />
                <div style={{flex:1,fontSize:13,fontWeight:700,color:'#633806'}}>
                  {nbAttente} {lang==='ar'?'في انتظار تصحيح الحزب':'en attente validation Hizb'}
                </div>
                <span style={{color:'#EF9F27',fontSize:16}}>{showAttenteMobile?'▾':'›'}</span>
              </div>
              {showAttenteMobile && eleves.filter(e=>e.etat.enAttenteHizbComplet).map(e=>(
                <div key={e.id} onClick={()=>navigate('enregistrer',e)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',margin:'0 0 6px 12px',
                    background:'#fff',border:'0.5px solid #EF9F2740',borderRadius:10,cursor:'pointer'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#412402'}}>{e.prenom} {e.nom}</div>
                    <div style={{fontSize:11,color:'#854F0B'}}>Hizb {e.etat.hizbEnCours} · {e.instituteurNom}</div>
                  </div>
                  <span style={{fontSize:10,background:'#EF9F27',color:'#fff',borderRadius:20,padding:'2px 8px',fontWeight:600}}>{t(lang,'valider')}</span>
                </div>
              ))}
            </>)}
            {inactifs14.length>0&&!inactifs30.length&&(
              <div onClick={()=>navigate('inactifs')}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
                  background:'#FFF3CD',borderRadius:12,marginBottom:8,cursor:'pointer',
                  border:'0.5px solid #EF9F2730'}}>
                <AlertTriangle size={20} color="#856404" style={{flexShrink:0}} />
                <div style={{flex:1,fontSize:13,fontWeight:700,color:'#856404'}}>
                  {inactifs14.length} {lang==='ar'?'طالب غائب 14-30 يوم':'inactif(s) depuis 14-30 jours'}
                </div>
                <span style={{color:'#EF9F27',fontSize:16}}>›</span>
              </div>
            )}
          </div>

          {/* F3 (oct 2026) : certificats a delivrer + alertes intelligentes, comme sur PC */}
          {certifNotifs.length>0&&(
            <div style={{padding:'12px 12px 4px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>
                <Award size={14} style={{verticalAlign:'-2px',marginInlineEnd:6}} />{lang==='ar'?'شهادات في انتظار التسليم':'Certificats à délivrer'} ({certifNotifs.length})
              </div>
              {certifNotifs.map((n,i)=>(
                <div key={i} onClick={()=>navigate('fiche',n.eleve)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'11px 12px',marginBottom:6,
                    background:'#FAEEDA',borderLeft:'4px solid #EF9F27',borderRadius:'0 12px 12px 0',cursor:'pointer'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#085041'}}>{n.eleve.prenom} {n.eleve.nom}</div>
                    <div style={{fontSize:11,color:'#B26A00',marginTop:1}}>{lang==='ar'?'مستحق:':'Certificat :'} {n.jalon.nom}</div>
                  </div>
                  <span style={{fontSize:11,color:'#EF9F27',fontWeight:600}}>{lang==='ar'?'تسليم ←':'Délivrer →'}</span>
                </div>
              ))}
            </div>
          )}
          {alertes.length>0&&(
            <div style={{padding:'12px 12px 4px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>
                <Bell size={14} style={{verticalAlign:'-2px',marginInlineEnd:6}} />{t(lang,'alertes')} ({alertes.length})
              </div>
              {alertes.slice(0,5).map((a,i)=>(
                <div key={i} onClick={()=>navigate('fiche',a.eleve)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',marginBottom:6,
                    background:a.bg,borderLeft:`4px solid ${a.color}`,borderRadius:'0 10px 10px 0',cursor:'pointer'}}>
                  {(() => { const Ic = ICONE_ALERTE[a.type]; return Ic ? <Ic size={18} color={a.color} style={{flexShrink:0}} /> : <span style={{fontSize:16}}>{a.icon}</span>; })()}
                  <span style={{fontSize:12.5,color:a.color,flex:1}}>{a.msg}</span>
                  <span style={{fontSize:11,color:a.color,opacity:0.6}}>›</span>
                </div>
              ))}
            </div>
          )}

          {/* ── NAVIGATION DEPLACEE VERS LA PAGE ModulesMobile (Phase 2 - Dashboard pure synthese) ──
              Les modules sont desormais accessibles via le tab 'Plus' de la bottom tab bar.
              Le Dashboard se concentre uniquement sur l'INFORMATION (KPIs, alertes, podium, activites). */}

          {/* ── STATS SEMAINE ── */}
          <div style={{padding:'12px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
              letterSpacing:'1px',marginBottom:10}}>
              {lang==='ar'?'إحصائيات الأسبوع':'Cette semaine'}
            </div>
            {/* Charte : tuiles neutres, la couleur ne porte que sur le chiffre */}
            <KpiGrid>
              <KpiTile value={stats.tomonSemaine||0} label={t(lang,'tomon_semaine')} tone="brand" icon={Sparkles} />
              <KpiTile value={stats.hizbsCompletsMois||0} label={t(lang,'hizb_ce_mois')} tone="info" icon={BookCheck} />
              <KpiTile value={tauxSemaine+'%'} label={lang==='ar'?'نسبة النشاط':'Taux activité'} tone="neutral" icon={Activity} />
              <KpiTile value={recapMois.nbRecit} label={lang==='ar'?'استظهارات الشهر':'Récit. ce mois'} tone="gold" icon={CalendarDays} />
            </KpiGrid>
          </div>

          {/* ── PODIUM TOP 3 ── */}
          {podium.length>=2&&(
            <div style={{padding:'12px 12px 4px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
                letterSpacing:'1px',marginBottom:10}}>
                {lang==='ar'?'المتصدرون':'Classement'}
              </div>
              <div style={{background:'#fff',borderRadius:16,padding:'16px 12px 12px',
                border:'0.5px solid #e0e0d8'}}>
                <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:6}}>
                  {podiumOrder.map(rank=>{
                    const e=podium[rank]; if(!e) return null;
                    return(
                      <div key={e.id} onClick={()=>navigate('fiche',e)} onMouseEnter={()=>prefetchEleve(e.id)} onTouchStart={()=>prefetchEleve(e.id)}
                        style={{flex:1,display:'flex',flexDirection:'column',
                          alignItems:'center',cursor:'pointer'}}>
                        {rank===0&&<div style={{fontSize:18,marginBottom:4}}>👑</div>}
                        <div style={{width:rank===0?46:38,height:rank===0?46:38,borderRadius:'50%',
                          background:podiumBg[rank],display:'flex',alignItems:'center',
                          justifyContent:'center',fontWeight:700,fontSize:rank===0?14:12,
                          color:podiumColors[rank],border:`1.5px solid ${podiumColors[rank]}40`,
                          marginBottom:6}}>
                          {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                        </div>
                        <div style={{fontSize:11,fontWeight:600,textAlign:'center',
                          color:'#1a1a1a',maxWidth:80,overflow:'hidden',
                          textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {e.prenom}
                        </div>
                        <div style={{fontSize:rank===0?13:11,fontWeight:700,
                          color:podiumColors[rank],marginTop:2}}>
                          {e.etat.points.total.toLocaleString()}
                        </div>
                        <div style={{width:'100%',height:podiumH[rank],marginTop:6,
                          background:podiumBg[rank],borderRadius:'8px 8px 0 0',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          border:`0.5px solid ${podiumColors[rank]}30`}}>
                          <span style={{fontSize:rank===0?28:22,fontWeight:800,
                            color:podiumColors[rank],opacity:0.7}}>
                            {rank+1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div onClick={()=>navigate('honneur')}
                  style={{marginTop:12,textAlign:'center',padding:'8px',
                    background:'#f5f5f0',borderRadius:10,fontSize:12,
                    fontWeight:600,color:'#085041',cursor:'pointer'}}>
                  🏆 {lang==='ar'?'عرض الترتيب الكامل':'Voir classement complet'}
                </div>
              </div>
            </div>
          )}

          {/* ── ACTIVITÉ RÉCENTE ── */}
          <div style={{padding:'12px 12px 4px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
              letterSpacing:'1px',marginBottom:10}}>
              {lang==='ar'?'آخر الاستظهارات':'Activité récente'}
            </div>
            {allValidations.slice(0,5).map(v=>{
              const el=eleves.find(e=>e.id===v.eleve_id);
              const nc=getNiveauColor(el?.code_niveau||'1', niveaux||[])||'#888';
              return(
                <div key={v.id} onClick={()=>el&&navigate('fiche',el)}
                  style={{background:'#fff',borderRadius:12,padding:'11px 14px',
                    marginBottom:8,border:'0.5px solid #e0e0d8',
                    display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <div style={{width:38,height:38,borderRadius:'50%',background:`${nc}20`,
                    color:nc,display:'flex',alignItems:'center',justifyContent:'center',
                    fontWeight:700,fontSize:13,flexShrink:0}}>
                    {el?((el.prenom||'?')[0])+((el.nom||'?')[0]):'?'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13}}>
                      {el?`${el.prenom} ${el.nom}`:'—'}
                    </div>
                    <div style={{fontSize:11,color:'#888',marginTop:1}}>
                      {formatDateCourt(v.date_validation)}
                    </div>
                  </div>
                  <div>
                    {v.type_validation==='hizb_complet'
                      ? <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',
                          borderRadius:20,background:'#E1F5EE',color:'#085041'}}>
                          Hizb ✓
                        </span>
                      : <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',
                          borderRadius:20,background:'#E6F1FB',color:'#0C447C'}}>
                          {v.nombre_tomon} {t(lang,'tomon_abrev')}
                        </span>
                    }
                  </div>
                </div>
              );
            })}
            {allValidations.length===0&&(
              <div style={{textAlign:'center',color:'#aaa',padding:'1.5rem',
                background:'#fff',borderRadius:12,fontSize:13}}>
                {t(lang,'aucune_activite')}
              </div>
            )}
          </div>

          {/* ── ÉLÈVES À RELANCER ── */}
          {eleves.filter(e=>e.inactif).length>0&&(
            <div style={{padding:'12px 12px 16px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',
                letterSpacing:'1px',marginBottom:10}}>
                {lang==='ar'?'يحتاجون متابعة':'À relancer'}
              </div>
              {[...eleves].filter(e=>e.inactif)
                .sort((a,b)=>(b.jours||0)-(a.jours||0)).slice(0,4).map(e=>(
                <div key={e.id} onClick={()=>navigate('fiche',e)} onMouseEnter={()=>prefetchEleve(e.id)} onTouchStart={()=>prefetchEleve(e.id)}
                  style={{background:'#fff',borderRadius:12,padding:'11px 14px',
                    marginBottom:8,border:`0.5px solid ${e.jours>30?'#E24B4A30':'#EF9F2730'}`,
                    display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <div style={{width:38,height:38,borderRadius:'50%',
                    background:e.jours>30?'#FCEBEB':'#FAEEDA',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontWeight:700,fontSize:13,
                    color:e.jours>30?'#E24B4A':'#EF9F27',flexShrink:0}}>
                    {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13}}>{e.prenom} {e.nom}</div>
                    <div style={{fontSize:11,color:'#888'}}>{e.instituteurNom}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,
                    color:e.jours>30?'#E24B4A':'#EF9F27'}}>
                    {e.jours!=null?`${e.jours}j`:'∞'}
                  </div>
                </div>
              ))}
              {eleves.filter(e=>e.inactif).length>4&&(
                <div onClick={()=>navigate('inactifs')}
                  style={{textAlign:'center',padding:'10px',background:'#f5f5f0',
                    borderRadius:10,fontSize:12,fontWeight:600,color:'#666',cursor:'pointer'}}>
                  {lang==='ar'?'عرض الكل':'Voir tous'} ({eleves.filter(e=>e.inactif).length})
                </div>
              )}
            </div>
          )}

        </>)}
      </div>
    );
  }



  return (
    <div
      {...(isMobile ? { onTouchStart, onTouchMove, onTouchEnd } : {})}>
      {isMobile && (
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          isThreshold={isThreshold}
          lang={lang}
        />
      )}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:20,fontWeight:700}}>{t(lang,tabs.find(tb=>tb.key===vue)?.labelKey||'tableau_de_bord')}</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          {exportMsg&&<span style={{fontSize:12,color:C.green,fontWeight:600}}>{exportMsg}</span>}
          {user.role==='surveillant'&&<>
            <ExportButtons
              onExcel={exportExcel}
              lang={lang}
              variant="inline"
              compact
            />
          </>}
          <button onClick={()=>navigate('honneur')} style={{padding:'6px 10px',background:C.green,color:'#fff',border:'none',borderRadius:8,fontSize:11,cursor:'pointer',fontWeight:600}}>🏆 {t(lang,'honneur')}</button>
          <button onClick={()=>navigate('comparaison')} style={{padding:'6px 10px',border:`0.5px solid ${C.border}`,borderRadius:8,background:'#fff',fontSize:11,cursor:'pointer'}}>📈 {t(lang,'comparer')}</button>
          {user.role==='surveillant'&&<button onClick={()=>navigate('dashboard_direction')} style={{padding:'6px 10px',background:'#085041',color:'#fff',border:'none',borderRadius:8,fontSize:11,cursor:'pointer',fontWeight:600}}>📊 {lang==='ar'?'لوحة القيادة':'Direction'}</button>}
        </div>
      </div>
      <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3,marginBottom:'1.25rem',width:'fit-content',flexWrap:'wrap'}}>
        {tabs.map(tb=><div key={tb.key} onClick={()=>setVue(tb.key)} style={{padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:vue===tb.key?700:400,cursor:'pointer',background:vue===tb.key?'#fff':'transparent',color:vue===tb.key?C.dark:C.muted,border:vue===tb.key?`0.5px solid ${C.border}`:'none',transition:'all 0.15s',whiteSpace:'nowrap'}}>{tb.icon} {t(lang,tb.labelKey)}</div>)}
      </div>
      {loading&&<div className="loading">...</div>}
      {!loading&&vue==='general'&&(
        <>
          <div style={{background:'linear-gradient(135deg,#085041 0%,#1D9E75 100%)',borderRadius:16,padding:'1.5rem',marginBottom:'1.25rem',color:'#fff',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',right:-20,top:-20,width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.05)'}}/>
            <div style={{fontSize:10,opacity:0.7,textTransform:'uppercase',letterSpacing:'2px',marginBottom:6}}>{t(lang,'score_ecole')}</div>
            <div style={{fontSize:44,fontWeight:800,letterSpacing:'-2px',lineHeight:1}}>{totalPoints.toLocaleString()}</div>
            <div style={{fontSize:12,opacity:0.7,marginTop:4,marginBottom:14}}>{t(lang,'points_cumules')}</div>
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
              {[{v:totalTomon,l:t(lang,'tomon_recites')},{v:totalHizb,l:t(lang,'hizb_complets')},{v:eleves.length,l:t(lang,'eleves')},{v:instituteurs.length,l:t(lang,'instituteurs')}].map(k=>(
                <div key={k.l}><div style={{fontSize:20,fontWeight:700}}>{k.v}</div><div style={{fontSize:11,opacity:0.65}}>{k.l}</div></div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#fff',borderRadius:10,marginBottom:8,border:'0.5px solid '+C.border}}>
            <div style={{flex:1}}><span style={{fontSize:12,color:C.muted}}>{lang==='ar'?'شهر ':'Mois de '}{recapMois.mois} — </span><span style={{fontSize:12,fontWeight:600,color:C.green}}>{recapMois.nbRecit} {lang==='ar'?'استظهار':'récitations'}</span></div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{fontSize:11,color:C.muted}}>{lang==='ar'?'نشاط الأسبوع':'Actifs semaine'}</div>
              <div style={{padding:'3px 10px',borderRadius:20,background:tauxSemaine>=70?C.greenBg:tauxSemaine>=40?C.amberBg:C.redBg,color:tauxSemaine>=70?C.green:tauxSemaine>=40?C.amber:C.red,fontSize:13,fontWeight:700}}>{tauxSemaine}%</div>
            </div>
          </div>
          <div>
            {eleves.filter(e=>e.jours!=null&&e.jours>30).length>0&&(<div onClick={()=>navigate('inactifs')} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#FCEBEB',borderRadius:12,marginBottom:8,cursor:'pointer',border:'1.5px solid #E24B4A30'}}><span style={{fontSize:20}}>🚨</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:'#E24B4A'}}>{eleves.filter(e=>e.jours!=null&&e.jours>30).length} {lang==='ar'?'طالب غائب أكثر من 30 يوماً':'élève(s) inactif(s) depuis +30 jours'}</div><div style={{fontSize:11,color:'#E24B4A',opacity:0.7}}>{lang==='ar'?'انقر لعرض القائمة':'Cliquer pour voir la liste'}</div></div><span style={{fontSize:11,color:'#E24B4A',fontWeight:600}}>›</span></div>)}
            {eleves.filter(e=>e.jours!=null&&e.jours>14&&e.jours<=30).length>0&&(<div onClick={()=>navigate('inactifs')} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#FFF3CD',borderRadius:12,marginBottom:8,cursor:'pointer',border:'1.5px solid #EF9F2730'}}><span style={{fontSize:20}}>⚠️</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:'#856404'}}>{eleves.filter(e=>e.jours!=null&&e.jours>14&&e.jours<=30).length} {lang==='ar'?'طالب غائب 14-30 يوماً':'élève(s) inactif(s) depuis 14-30 jours'}</div></div><span style={{fontSize:11,color:'#856404',fontWeight:600}}>›</span></div>)}
            {eleves.filter(e=>e.jours==null).length>0&&(<div onClick={()=>navigate('inactifs')} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#F0EEFF',borderRadius:12,marginBottom:8,cursor:'pointer',border:'1.5px solid #534AB730'}}><span style={{fontSize:20}}>📋</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:'#534AB7'}}>{eleves.filter(e=>e.jours==null).length} {lang==='ar'?'طالب لم يستظهر بعد':'élève(s) sans aucune récitation'}</div></div><span style={{fontSize:11,color:'#534AB7',fontWeight:600}}>›</span></div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:'1.25rem'}}>
            {[{val:stats.tomonSemaine||0,lbl:t(lang,'tomon_semaine'),color:C.green},{val:stats.hizbsCompletsMois||0,lbl:t(lang,'hizb_ce_mois'),color:C.blue},{val:nbAttente,lbl:t(lang,'attente_hizb'),color:C.amber},{val:nbInactifs,lbl:t(lang,'inactifs'),color:C.red}].map((k,i)=>(
              <div key={i} style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:12,padding:'12px',borderTop:`3px solid ${k.color}`}}>
                <div style={{fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4}}>{k.lbl}</div>
              </div>
            ))}
          </div>
          {certifNotifs.length>0&&(
            <div style={{marginBottom:'1.25rem'}}>
              <div className="section-label section-label--gold">
                <span style={{fontSize:14}}>🏅</span>
                {lang==='ar'?'شهادات في انتظار التسليم':'Certificats à délivrer'} ({certifNotifs.length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {certifNotifs.map((n,i)=>(
                  <div key={i} onClick={()=>navigate('fiche',n.eleve)} onMouseEnter={()=>prefetchEleve(n.eleve.id)} onTouchStart={()=>prefetchEleve(n.eleve.id)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                      background:'#FAEEDA',borderLeft:'4px solid #EF9F27',
                      borderRadius:'0 12px 12px 0',cursor:'pointer'}}>
                    <span style={{fontSize:20}}>🏅</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#085041'}}>
                        {n.eleve.prenom} {n.eleve.nom}
                      </div>
                      <div style={{fontSize:11,color:'#EF9F27',marginTop:1}}>
                        {lang==='ar'?'مستحق:':'Certificat:'} {n.jalon.nom}
                      </div>
                    </div>
                    <span style={{fontSize:11,color:'#EF9F27',fontWeight:600}}>
                      {lang==='ar'?'تسليم ←':'Délivrer →'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {alertes.length>0&&(<><div className="section-label section-label--amber"><span style={{fontSize:14}}>🔔</span>{t(lang,'alertes')} ({alertes.length})</div><div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:'1.25rem'}}>{alertes.slice(0,5).map((a,i)=>(<div key={i} onClick={()=>navigate('fiche',a.eleve)} onMouseEnter={()=>prefetchEleve(a.eleve.id)} onTouchStart={()=>prefetchEleve(a.eleve.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:a.bg,borderLeft:`4px solid ${a.color}`,borderRadius:'0 10px 10px 0',cursor:'pointer'}}><span style={{fontSize:18}}>{a.icon}</span><span style={{fontSize:13,color:a.color,flex:1}}>{a.msg}</span><span style={{fontSize:11,color:a.color,opacity:0.6}}>›</span></div>))}</div></>)}
          <div className="section-label section-label--gold"><span style={{fontSize:14}}>🏆</span>{t(lang,'podium')}</div>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:14,marginBottom:'1.5rem',padding:'8px 0 0'}}>
            {[1,0,2].map(rank=>{
              const e=[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total)[rank];
              if(!e) return null;
              // J7 polish : couleurs vives or/argent/bronze + gradients + ombres
              // Or vif (#EF9F27 + #FFC55A), Argent (#9E9E9E + #C8C8C8), Bronze (#CD7F32 + #E8A55F)
              const pc = ['#D48717','#7A7A7A','#A36422']; // Texte/bordure foncé
              const pcLight = ['#EF9F27','#9E9E9E','#CD7F32']; // Couleur principale
              const pbGrad = [
                'linear-gradient(180deg,#FFE7B5 0%,#FAC775 100%)',  // or doré profond
                'linear-gradient(180deg,#EEEEEE 0%,#C8C8C8 100%)',  // argent métallique
                'linear-gradient(180deg,#F0CD9F 0%,#D6985B 100%)',  // bronze cuivré
              ];
              const pbSoft = ['#FFF5E0','#F5F5F5','#FCEDD8']; // pour fond avatar
              const ph = [150, 110, 88]; // 1ère vraiment dominante (150px vs 110/88)
              const medals = ['🥇','🥈','🥉'];
              return(
                <div key={e.id} onClick={()=>navigate('fiche',e)} onMouseEnter={()=>prefetchEleve(e.id)} onTouchStart={()=>prefetchEleve(e.id)}
                  style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',maxWidth:170}}>
                  {rank===0&&<div style={{fontSize:24,marginBottom:4,lineHeight:1}}>👑</div>}
                  <Avatar prenom={e.prenom} nom={e.nom} size={rank===0?54:44} bg={pbSoft[rank]} color={pcLight[rank]}/>
                  <div style={{fontSize:rank===0?13:12,fontWeight:700,marginTop:6,textAlign:'center',color:'#1a1a1a'}}>{e.prenom} {e.nom}</div>
                  <div style={{fontSize:rank===0?15:13,fontWeight:800,color:pc[rank],margin:'3px 0 8px'}}>{e.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</div>
                  <div style={{
                    width:'100%',height:ph[rank],
                    background:pbGrad[rank],
                    border:`1.5px solid ${pcLight[rank]}`,
                    borderRadius:'10px 10px 0 0',
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,
                    boxShadow:rank===0?`0 4px 14px ${pcLight[rank]}55`:`0 2px 8px ${pcLight[rank]}30`,
                    position:'relative',
                  }}>
                    <span style={{fontSize:rank===0?30:22,lineHeight:1}}>{medals[rank]}</span>
                    <span style={{fontSize:rank===0?38:30,fontWeight:900,color:'#fff',
                      textShadow:`0 1px 3px ${pc[rank]}90`,lineHeight:1}}>{rank+1}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
            <div><div className="section-label section-label--red"><span style={{fontSize:14}}>📞</span>{t(lang,'a_relancer')}</div>{eleves.filter(e=>e.inactif).length===0?<div style={{padding:'1rem',background:C.greenBg,borderRadius:10,fontSize:13,color:'#085041',textAlign:'center'}}>{t(lang,'tous_actifs')}</div>:(<div style={{display:'flex',flexDirection:'column',gap:6}}>{[...eleves].filter(e=>e.inactif).sort((a,b)=>(b.jours||0)-(a.jours||0)).slice(0,5).map(e=>(<div key={e.id} onClick={()=>navigate('fiche',e)} onMouseEnter={()=>prefetchEleve(e.id)} onTouchStart={()=>prefetchEleve(e.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:e.jours>30?C.redBg:C.amberBg,borderRadius:10,cursor:'pointer'}}><Avatar prenom={e.prenom} nom={e.nom} size={30} bg="transparent" color={e.jours>30?C.red:'#633806'}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:e.jours>30?C.red:'#412402'}}>{e.prenom} {e.nom}</div><div style={{fontSize:11,color:e.jours>30?'#A32D2D':'#854F0B',opacity:0.8}}>{e.instituteurNom}</div></div><div style={{fontSize:13,fontWeight:700,color:e.jours>30?C.red:'#633806'}}>{e.jours!=null?`${e.jours} ${t(lang,'jour')}`:'∞'}</div></div>))}</div>)}</div>
            <div><div className="section-label section-label--amber"><span style={{fontSize:14}}>⏳</span>{t(lang,'attente_hizb')}</div>{nbAttente===0?<div style={{padding:'1rem',background:C.greenBg,borderRadius:10,fontSize:13,color:'#085041',textAlign:'center'}}>{t(lang,'aucun_attente')}</div>:(<div style={{display:'flex',flexDirection:'column',gap:6}}>{eleves.filter(e=>e.etat.enAttenteHizbComplet).map(e=>(<div key={e.id} onClick={()=>navigate('enregistrer',e)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:C.amberBg,border:`0.5px solid ${C.amber}40`,borderRadius:10,cursor:'pointer'}}><Avatar prenom={e.prenom} nom={e.nom} size={30} bg="#FAC775" color="#412402"/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:'#412402'}}>{e.prenom} {e.nom}</div><div style={{fontSize:11,color:'#854F0B'}}>Hizb {e.etat.hizbEnCours} · {e.instituteurNom}</div></div><span style={{fontSize:10,background:C.amber,color:'#fff',borderRadius:20,padding:'2px 8px',fontWeight:600}}>{t(lang,'valider')}</span></div>))}</div>)}</div>
          </div>
          <div className="section-label section-label--blue"><span style={{fontSize:14}}>📊</span>{t(lang,'activite_recente')}</div>
          <div className="table-wrap"><table><thead><tr><th style={{width:'18%'}}>{lang==='ar'?'التاريخ':'Date'}</th><th style={{width:'28%'}}>{t(lang,'eleve')}</th><th style={{width:'30%'}}>{lang==='ar'?'الاستظهار':'Validation'}</th><th style={{width:'24%'}}>{t(lang,'valide_par')}</th></tr></thead><tbody>{allValidations.slice(0,8).length===0&&<tr><td colSpan={4} className="empty">{t(lang,'aucune_activite')}</td></tr>}{allValidations.slice(0,8).map(v=>{const e=eleves.find(el=>el.id===v.eleve_id);return(<tr key={v.id} className={e?'clickable':''} onClick={()=>e&&navigate('fiche',e)}><td style={{fontSize:12,color:C.muted}}>{formatDateCourt(v.date_validation)}</td><td>{e?<div style={{display:'flex',alignItems:'center',gap:6}}><Avatar prenom={e.prenom} nom={e.nom} size={22}/><span style={{fontSize:13}}>{e.prenom} {e.nom}</span></div>:'—'}</td><td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb {v.hizb_valide} {lang==='ar'?'مكتمل':'complet'}</span>:<span className="badge badge-blue">{v.nombre_tomon} {t(lang,'tomon_abrev')}{v.tomon_debut?` (T.${v.tomon_debut}→${v.tomon_debut+v.nombre_tomon-1})`:''}</span>}</td><td style={{fontSize:12,color:C.muted}}>{v.valideur?`${v.valideur.prenom} ${v.valideur.nom}`:'—'}</td></tr>);})}</tbody></table></div>
        </>
      )}
      {!loading&&vue==='eleves'&&(
        <>
          {selectedEleves.length>0&&(<div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:C.blueBg,border:`0.5px solid ${C.blue}`,borderRadius:10,marginBottom:'1rem'}}><span style={{fontSize:12,color:'#0C447C'}}>{selectedEleves.length} {t(lang,'eleves')}</span><button onClick={()=>navigate('comparaison',selectedEleves)} style={{padding:'4px 12px',background:C.blue,color:'#fff',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',marginLeft:'auto'}}>📈 {t(lang,'comparer')}</button><button onClick={()=>setSelectedEleves([])} style={{padding:'4px 10px',border:`0.5px solid ${C.border}`,borderRadius:6,background:'#fff',fontSize:11,cursor:'pointer'}}>✕</button></div>)}
          <div style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
              <input className="field-input" style={{flex:2,minWidth:160}} placeholder={t(lang,'rechercher_eleve')} value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}/>
              <select className="field-select" style={{flex:1,minWidth:130}} value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}><option value="tous">{t(lang,'tous_instituteurs')}</option>{instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}</select>
              <select className="field-select" style={{flex:1,minWidth:110}} value={filtreStatut} onChange={e=>setFiltreStatut(e.target.value)}><option value="tous">{t(lang,'tous_statuts')}</option><option value="actifs">{t(lang,'actifs')}</option><option value="inactifs">{t(lang,'inactifs_filter')}</option><option value="attente">{t(lang,'attente_filter')}</option></select>
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {[['points_desc',t(lang,'tri_score_desc')],['points_asc',t(lang,'tri_score_asc')],['hizb_desc',t(lang,'tri_hizb_desc')],['hizb_asc',t(lang,'tri_hizb_asc')],['nom_asc',t(lang,'tri_nom')],['recente',t(lang,'tri_recente')],['inactif',t(lang,'tri_inactif')]].map(([k,l])=>(
                <div key={k} onClick={()=>setTri(k)} style={{padding:'4px 12px',borderRadius:20,fontSize:11,cursor:'pointer',background:tri===k?C.greenBg:'#f5f5f0',color:tri===k?'#085041':C.muted,border:`0.5px solid ${tri===k?C.green:C.border}`,fontWeight:tri===k?500:400}}>{l}</div>
              ))}
              {/* J7 polish : compteur visuellement detache des chips de tri.
                  borderInlineStart se traduit automatiquement en border-left (LTR)
                  ou border-right (RTL). paddingInlineStart pareil. */}
              <div style={{marginInlineStart:'auto',display:'flex',alignItems:'center',gap:6,
                paddingInlineStart:12,borderInlineStart:`1px solid ${C.border}`,fontSize:11,color:C.muted}}>
                <span style={{fontSize:14}}>👥</span>
                <strong style={{color:C.dark,fontWeight:700}}>{elevesFiltres.length}</strong>
                <span>{t(lang,'eleves')}</span>
              </div>
            </div>
          </div>
          {elevesFiltres.length===0?<div className="empty">{t(lang,'aucun_eleve')}</div>:(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
              {elevesFiltres.map(eleve=>{
                const rang=[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).findIndex(e=>e.id===eleve.id)+1;
                const sl=scoreLabel(eleve.etat.points.total);
                const isSelected=selectedEleves.find(s=>s.id===eleve.id);
                return(
                  <div key={eleve.id} style={{background:'#fff',border:`${isSelected?'2px':'0.5px'} solid ${isSelected?C.blue:eleve.etat.enAttenteHizbComplet?C.amber:eleve.inactif?C.red:C.border}`,borderRadius:14,padding:'1.25rem',cursor:'pointer',transition:'transform 0.15s',position:'relative'}}>
                    <div onClick={e=>{e.stopPropagation();const isS=selectedEleves.find(s=>s.id===eleve.id);if(isS)setSelectedEleves((selectedEleves||[]).filter(s=>s.id!==eleve.id));else if(selectedEleves.length<6)setSelectedEleves([...selectedEleves,eleve]);}} style={{position:'absolute',top:10,left:10,width:18,height:18,borderRadius:4,border:`1.5px solid ${isSelected?C.blue:C.border}`,background:isSelected?C.blue:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>{isSelected&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}</div>
                    <div onClick={()=>navigate('fiche',eleve)} onMouseEnter={()=>prefetchEleve(eleve.id)} onTouchStart={()=>prefetchEleve(eleve.id)}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12,paddingLeft:24}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <Avatar prenom={eleve.prenom} nom={eleve.nom} size={42} bg={sl.bg} color={sl.color}/>
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}><div style={{fontSize:14,fontWeight:600}}>{eleve.prenom} {eleve.nom}</div><NiveauBadge code={eleve.code_niveau} niveaux={niveaux}/></div>
                            <div style={{fontSize:11,color:C.muted}}>{eleve.instituteurNom}</div>
                            <span style={{padding:'1px 8px',borderRadius:20,fontSize:10,fontWeight:500,background:sl.bg,color:sl.color}}>{sl.label}</span>
                          </div>
                        </div>
                        <Medaille idx={rang-1}/>
                      </div>
                      <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:10}}>
                        {(() => {
                          // HOMOGENEISATION (oct 2026) : afficher les POINTS en grand pour
                          // tous les eleves (hizb comme sourate), tant qu'il y en a.
                          // Avant : les eleves sourate affichaient le nb de sourates, les
                          // hizb affichaient les points -> incoherent.
                          // Fallback (points==0) : nb sourates OU nb hizbs complets.
                          const isSourate = isSourateNiveauDyn(eleve.code_niveau, niveaux);
                          const points = eleve.etat.points.total || 0;
                          const hizbComplets = eleve.etat.hizbsComplets?.size || 0;
                          if (eleve.etat._ptsPending) {
                            return (<>
                              <span style={{fontSize:28,fontWeight:800,color:'#ccc',letterSpacing:'-1px'}}>…</span>
                              <span style={{fontSize:12,color:C.muted}}>{t(lang,'pts_abrev')}</span>
                            </>);
                          }
                          if (points > 0) {
                            return (<>
                              <span style={{fontSize:28,fontWeight:800,color:sl.color,letterSpacing:'-1px'}}>
                                {points.toLocaleString()}
                              </span>
                              <span style={{fontSize:12,color:C.muted}}>{t(lang,'pts_abrev')}</span>
                            </>);
                          }
                          // Fallback si pas de points : compteur alternatif
                          if (isSourate) {
                            return (<>
                              <span style={{fontSize:28,fontWeight:800,color:sl.color,letterSpacing:'-1px'}}>
                                {eleve.recSouratesCount.toLocaleString()}
                              </span>
                              <span style={{fontSize:12,color:C.muted}}>
                                {lang==='ar'?'سورة':'sour.'}
                              </span>
                            </>);
                          }
                          if (hizbComplets > 0) {
                            return (<>
                              <span style={{fontSize:28,fontWeight:800,color:sl.color,letterSpacing:'-1px'}}>
                                {hizbComplets}
                              </span>
                              <span style={{fontSize:12,color:C.muted}}>
                                {lang==='ar'?'حزب مكتمل':'Hizb complet'}{hizbComplets>1?(lang==='ar'?'':'s'):''}
                              </span>
                            </>);
                          }
                          return (<>
                            <span style={{fontSize:28,fontWeight:800,color:sl.color,letterSpacing:'-1px'}}>
                              {points.toLocaleString()}
                            </span>
                            <span style={{fontSize:12,color:C.muted}}>{t(lang,'pts_abrev')}</span>
                          </>);
                        })()}
                      </div>
                      {isSourateNiveauDyn(eleve.code_niveau,niveaux)?(
                        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>
                          {eleve.recSouratesCount} {lang==='ar'?'سورة مكتملة':'sourates'} · {eleve.etat._ptsPending ? '…' : (eleve.etat.points.total||0)} {t(lang,'pts_abrev')}
                        </div>
                      ):(
                        <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Hizb {eleve.etat.hizbEnCours} · {eleve.etat.tomonCumul} {t(lang,'tomon_abrev')} · {eleve.etat.hizbsComplets.size} {t(lang,'hizb_abrev')}</div>
                      )}
                      {!isSourateNiveauDyn(eleve.code_niveau,niveaux)&&<Bar8 done={eleve.etat.tomonDansHizbActuel} color={eleve.etat.enAttenteHizbComplet?C.amber:C.green}/>}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                        <div style={{fontSize:11,color:C.muted}}>{eleve.derniere?formatDateCourt(eleve.derniere):t(lang,'jamais')}</div>
                        {eleve.etat.enAttenteHizbComplet?<span className="badge badge-amber" style={{fontSize:9}}>{t(lang,'en_attente')}</span>:eleve.inactif?<span className="badge badge-alert" style={{fontSize:9}}>{eleve.jours}{t(lang,'jours')}</span>:<span className="badge badge-green" style={{fontSize:9}}>{t(lang,'actif')}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {!loading&&vue==='instituteurs'&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
          {statsInst.sort((a,b)=>b.totalPoints-a.totalPoints).map((inst,idx)=>(
            <div key={inst.id} style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:14,padding:'1.25rem',cursor:'pointer'}} onClick={()=>navigate('profil_instituteur',inst)}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}><Avatar prenom={inst.prenom} nom={inst.nom} size={48}/><div style={{flex:1}}><div style={{fontSize:15,fontWeight:600}}>{inst.prenom} {inst.nom}</div><div style={{fontSize:11,color:C.muted}}>{inst.nbEleves} {t(lang,'eleves_referents')} · {t(lang,'voir_profil')}</div></div><Medaille idx={idx}/></div>
              <div style={{background:C.greenBg,borderRadius:10,padding:'12px',marginBottom:12,textAlign:'center'}}><div style={{fontSize:10,color:'#0F6E56',textTransform:'uppercase',letterSpacing:'1px',marginBottom:2}}>{t(lang,'score_groupe')}</div><div style={{fontSize:30,fontWeight:800,color:'#085041',letterSpacing:'-1px'}}>{inst.totalPoints.toLocaleString()}</div></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:12}}>{[{l:t(lang,'tomon_abrev'),v:inst.totalTomon,bg:C.blueBg,c:'#0C447C'},{l:t(lang,'hizb_abrev'),v:inst.totalHizb,bg:C.greenBg,c:'#085041'},{l:t(lang,'inactifs_filter'),v:inst.nbInactifs,bg:inst.nbInactifs>0?C.redBg:'#f9f9f6',c:inst.nbInactifs>0?'#A32D2D':'#bbb'},{l:t(lang,'en_attente'),v:inst.nbAttente,bg:inst.nbAttente>0?C.amberBg:'#f9f9f6',c:inst.nbAttente>0?'#633806':'#bbb'}].map(s=>(<div key={s.l} style={{background:s.bg,borderRadius:8,padding:'8px 4px',textAlign:'center'}}><div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:s.c,opacity:0.8}}>{s.l}</div></div>))}</div>
              {inst.meilleur&&<div style={{borderTop:`0.5px solid ${C.border}`,paddingTop:10}}><div style={{fontSize:10,color:C.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:'1px'}}>{t(lang,'meilleur_eleve')}</div><div onClick={e=>{e.stopPropagation();navigate('fiche',inst.meilleur);}} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><Avatar prenom={inst.meilleur.prenom} nom={inst.meilleur.nom} size={28} bg="#FAEEDA" color="#412402"/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:500}}>{inst.meilleur.prenom} {inst.meilleur.nom}</div><div style={{fontSize:11,color:C.muted}}>Hizb {inst.meilleur.etat.hizbEnCours} · {inst.meilleur.etat.points.total.toLocaleString()} {t(lang,'pts_abrev')}</div></div></div></div>}
            </div>
          ))}
        </div>
      )}
      {!loading&&vue==='rapport'&&user.role==='surveillant'&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:8,marginBottom:'1.5rem'}}>{[{val:totalPoints.toLocaleString(),lbl:t(lang,'score_total'),color:C.green},{val:stats.hizbsCompletsMois||0,lbl:t(lang,'hizb_ce_mois'),color:C.blue},{val:stats.tomonSemaine||0,lbl:t(lang,'tomon_semaine'),color:C.amber},{val:stats.recitationsMois||0,lbl:t(lang,'recitations_ce_mois'),color:C.muted}].map((k,i)=>(<div key={i} style={{background:'#fff',border:`0.5px solid ${C.border}`,borderRadius:12,padding:'14px',borderTop:`3px solid ${k.color}`}}><div style={{fontSize:22,fontWeight:700,color:k.color}}>{k.val}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{k.lbl}</div></div>))}</div>
          <div className="section-label">{t(lang,'classement_complet')}</div>
          <div className="table-wrap" style={{marginBottom:'1.5rem'}}><table><thead><tr><th style={{width:'5%'}}>#</th><th style={{width:'22%'}}>{t(lang,'eleve')}</th><th style={{width:'14%'}}>{t(lang,'niveau')}</th><th style={{width:'15%'}}>{t(lang,'referent')}</th><th style={{width:'10%'}}>{t(lang,'hizb_en_cours')}</th><th style={{width:'8%'}}>{t(lang,'tomon_abrev')}</th><th style={{width:'10%'}}>{t(lang,'hizb_complets')}</th><th style={{width:'16%'}}>{t(lang,'score_total')}</th></tr></thead><tbody>{[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).map((e,idx)=>{const sl=scoreLabel(e.etat.points.total);return(<tr key={e.id} className="clickable" onClick={()=>navigate('fiche',e)} onMouseEnter={()=>prefetchEleve(e.id)} onTouchStart={()=>prefetchEleve(e.id)}><td><Medaille idx={idx}/></td><td><div style={{display:'flex',alignItems:'center',gap:6}}><Avatar prenom={e.prenom} nom={e.nom} size={24}/><span style={{fontSize:13}}>{e.prenom} {e.nom}</span></div></td><td><span className={`badge ${['Avancé','Advanced','متقدم'].some(v=>v.toLowerCase()===e.niveau?.toLowerCase())?'badge-green':['Intermédiaire','Intermediate','متوسط'].some(v=>v.toLowerCase()===e.niveau?.toLowerCase())?'badge-blue':'badge-amber'}`} style={{fontSize:10}}>{niveauTraduit(e.niveau,lang,t)}</span></td><td style={{fontSize:11,color:C.muted}}>{e.instituteurNom}</td><td style={{fontSize:12}}>Hizb {e.etat.hizbEnCours}</td><td><span className="badge badge-blue" style={{fontSize:10}}>{e.etat.tomonCumul}</span></td><td><span className="badge badge-green" style={{fontSize:10}}>{e.etat.hizbsComplets.size}</span></td><td><span style={{fontSize:13,fontWeight:700,color:sl.color}}>{e.etat.points.total.toLocaleString()}</span></td></tr>);})}</tbody></table></div>
        </>
      )}
    </div>
  );
}
