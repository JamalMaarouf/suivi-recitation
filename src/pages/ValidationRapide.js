import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { withRetryToast } from '../lib/retry';
import { invalidateMany } from '../lib/cache';
import { enqueueOrRun } from '../lib/offlineQueue';
import { swr } from '../lib/offlineCache';
import { calcEtatEleve, calcEtatEleveAvecBlocs, getInitiales, scoreLabel, motivationMsg, verifierEtCreerCertificats, isSourateNiveauDyn, loadBareme, BAREME_DEFAUT, getSensForEleve, verifierBlocageExamen, verifierBlocageEnsemble, validerEnsemble, calculerPointsSourate, ptsValidation, numerosSouratesAcquises, ordonnerSouratesProgramme, depuisDebutNiveau} from '../lib/helpers';
import { notifierParents } from '../lib/notificationsParents';
import { getSouratesForNiveau } from '../lib/sourates';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';
import PageHeader from '../components/PageHeader';
import { MobileHeader } from '../components/ui';
import { Zap } from 'lucide-react';
import { correspondRecherche } from '../lib/recherche';

export default function ValidationRapide({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [eleves, setEleves] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [recitationsSourates, setRecitationsSourates] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [etat, setEtat] = useState(null);
  const [blocageExamen, setBlocageExamen] = useState(null); // {nom, id, ...} ou null
  const [blocagesEnsemble, setBlocagesEnsemble] = useState([]); // ensembles termines mais non valides
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const [nbTomon, setNbTomon] = useState(1); // nombre de tomons à valider
  const [bareme, setBareme] = useState(null); // barème de l'école
  const [ensemblesData, setEnsemblesData] = useState([]); // pour calcul priorité mode 3
  const [programmeNiveau, setProgrammeNiveau] = useState([]); // hizbs ou sourates du programme
  const [programmeCharge, setProgrammeCharge] = useState(false); // true quand chargement terminé
  // FIX (oct 2026) : selection fiable -> on ignore les reponses d'un eleve deselectionne
  // et on bloque la validation tant que programme + blocage examen ne sont pas verifies.
  const selectIdRef = useRef(null);
  const [selectionPrete, setSelectionPrete] = useState(false);
  const tomonVerrouRef = useRef(false);
  // FIX (oct 2026, retour test Hizb 36-40) : derniere verification de blocage examen lancee.
  // Apres un Hizb/tomon valide, la verification tourne en arriere-plan (plusieurs allers-retours) ;
  // pendant ce temps on pouvait valider des tomons du Hizb suivant. Toute nouvelle validation
  // attend maintenant le resultat de cette verification.
  const blocagePromiseRef = useRef(null);
  const blocageCourantRef = useRef(null);
  // PERF/UX (oct 2026) : programmes de tous les niveaux gardes en memoire (charges une fois),
  // eleve « pret » expose en ref + promesse (un appui pendant le chargement est execute
  // automatiquement des que l'eleve est pret, au lieu du message « chargement en cours »),
  // et etat « preparation » pour un retour visuel immediat sur le bouton.
  const programmesParCodeRef = useRef(new Map());
  const selectionPreteRef = useRef(false);
  const pretRef = useRef({ promise: Promise.resolve(), resolve: null });
  const [preparation, setPreparation] = useState(false);
  const validerTomonRef = useRef(null);
  const validerHizbRef = useRef(null);
  const validerSourateRef = useRef(null);
  const blocagesEnsembleRef = useRef([]);
  const sourateVerrouRef = useRef(false);
  const ensembleVerrouRef = useRef(false);
  const [currentSourateState, setCurrentSourateState] = useState(null); // calculé après chargement
  const [sourateSelectionnee, setSourateSelectionnee] = useState(null); // sourate choisie
  const [typeRec, setTypeRec] = useState('complete'); // 'complete' ou 'sequence'
  const [versetDebut, setVersetDebut] = useState('');
  const [versetFin, setVersetFin] = useState('');
  const [ecoleConfig, setEcoleConfig] = useState(null);

  const searchRef = useRef();

  useEffect(() => { loadData(); setTimeout(() => searchRef.current?.focus(), 200); }, []);

  // PERF (oct 2026) : des que les niveaux sont connus, charger en UNE requete les programmes de
  // tous les niveaux et prechauffer les parametres de blocage (examens) : la selection d'un eleve
  // n'a plus a les attendre.
  const prechargeFaitRef = useRef(false);
  useEffect(() => {
    if (prechargeFaitRef.current || !niveaux || niveaux.length === 0) return;
    prechargeFaitRef.current = true;
    (async () => {
      try {
        const progs = await fetchAll(supabase.from('programmes')
          .select('niveau_id,reference_id,ordre,bloc_numero,bloc_nom,bloc_sens,type_contenu')
          .eq('ecole_id', user.ecole_id).order('ordre'));
        const parNiveau = new Map();
        (progs || []).forEach(p => { if (!parNiveau.has(p.niveau_id)) parNiveau.set(p.niveau_id, []); parNiveau.get(p.niveau_id).push(p); });
        niveaux.forEach(n => {
          if (!programmesParCodeRef.current.has(n.code)) {
            const lignes = (parNiveau.get(n.id) || []).slice().sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
            programmesParCodeRef.current.set(n.code, lignes.map(({ niveau_id, ...r }) => r));
          }
        });
      } catch (e) { /* on chargera a la demande */ }
      niveaux.forEach(n => {
        verifierBlocageExamen(supabase, { eleve: { id: '__prechauffe__', code_niveau: n.code, hizb_depart: 0, sourates_acquises: 0 },
          ecole_id: user.ecole_id, validations: [], recitations: [] }).catch(() => {});
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveaux]);

  const loadData = async () => {
    const ecoleId = user.ecole_id;
    // SWR : affichage immédiat depuis cache IndexedDB + refresh réseau en tâche de fond
    // Chaque swr() appelle onUpdate 1 ou 2 fois : cache puis réseau
    await Promise.all([
      swr(
        `vr_eleves_${ecoleId}`,
        () => supabase.from('eleves').select('*').eq('ecole_id', ecoleId).is('suspendu_at', null).order('nom'),
        (data) => { if (data) setEleves(data); }
      ).catch(()=>{}),
      swr(
        `vr_validations_${ecoleId}`,
        () => fetchAll(supabase.from('validations').select('*').eq('ecole_id', ecoleId)),
        (data) => { if (data) setAllValidations(data); }
      ).catch(()=>{}),
      swr(
        `vr_niveaux_${ecoleId}`,
        () => supabase.from('niveaux').select('id,code,nom,type,couleur,sens_recitation').eq('ecole_id', ecoleId),
        (data) => { if (data) setNiveaux(data); }
      ).catch(()=>{}),
      swr(
        `vr_sourates`,
        () => supabase.from('sourates').select('*'),
        (data) => { if (data) setSouratesDB(data); }
      ).catch(()=>{}),
      swr(
        `vr_ecole_${ecoleId}`,
        () => supabase.from('ecoles').select('sens_recitation_defaut').eq('id', ecoleId).maybeSingle(),
        (data) => { if (data) setEcoleConfig(data); }
      ).catch(()=>{}),
    ]);
    const b = await loadBareme(supabase, ecoleId);
    setBareme(b);
    // Charger les ensembles pour calculer la priorite Mode 3 > Mode 1
    supabase.from('ensembles_sourates').select('id,nom,niveau_id,sourates_ids').eq('ecole_id', ecoleId)
      .then(({data}) => setEnsemblesData(data || []));
    setLoading(false);
  };

  // PERF (mai 2026) : useMemo evite de recalculer le filtre a chaque
  // re-render du composant (ex : changement d'un autre state non lie).
  // Sans memo, taper dans la recherche sur une liste de 100+ eleves
  // donnait une sensation de saccade. Avec memo, filtre instantane.
  const filteredEleves = useMemo(() => {
    if (search.length === 0) return [];
    return eleves
      .filter(e => correspondRecherche(search, `${e.prenom} ${e.nom} ${e.eleve_id_ecole || ''}`))
      .slice(0, 6);
  }, [search, eleves]);

  // PERF (mai 2026) : index 'eleve_id -> validations[]' pour lookup O(1)
  // au lieu de allValidations.filter() a chaque selection d'eleve.
  // Sur une ecole avec 50+ eleves et 1000+ validations cumulees, la
  // selection d'un eleve passe d'environ 50ms a < 1ms.
  const validationsByEleveId = useMemo(() => {
    const map = new Map();
    for (const v of allValidations) {
      const eid = v.eleve_id;
      if (!map.has(eid)) map.set(eid, []);
      map.get(eid).push(v);
    }
    return map;
  }, [allValidations]);

  // Helper reutilisable : verifie le blocage examen ET ensemble pour l'eleve courant
  // et met a jour les states. Retourne true si bloque examen, false sinon.
  const checkBlocageExamenEleve = (eleve, vals, recs, estCourant) => {
    const suivi = { fini: false };
    suivi.p = checkBlocageExamenEleveInterne(eleve, vals, recs, estCourant).finally(() => { suivi.fini = true; });
    blocagePromiseRef.current = suivi;
    return suivi.p;
  };
  // Attend la derniere verification en cours ; renvoie l'examen bloquant ou null
  const attendreVerifBlocage = async () => {
    const suivi = blocagePromiseRef.current;
    if (suivi && !suivi.fini) {
      setPreparation(true);
      try { await suivi.p; } catch (e) { /* */ } finally { setPreparation(false); }
    }
    return blocageCourantRef.current;
  };
  // Un appui pendant le chargement de l'eleve : on attend qu'il soit pret puis on relance
  // l'action avec l'etat a jour (renvoie false si l'eleve a change entre-temps).
  const attendreSelection = async () => {
    if (selectionPreteRef.current) return true;
    const id = selectIdRef.current;
    setPreparation(true);
    try { await pretRef.current.promise; } catch (e) { /* */ } finally { setPreparation(false); }
    return selectIdRef.current === id && selectionPreteRef.current;
  };
  const marquerPret = (ok) => {
    selectionPreteRef.current = ok;
    setSelectionPrete(ok);
    if (ok && pretRef.current.resolve) pretRef.current.resolve();
  };
  // Programme du niveau : memoire d'abord, sinon 1 requete (puis memorise)
  const chargerProgramme = async (code) => {
    if (programmesParCodeRef.current.has(code)) return programmesParCodeRef.current.get(code);
    let nivId = (niveaux || []).find(n => n.code === code)?.id;
    if (!nivId) {
      const { data: niv } = await supabase.from('niveaux').select('id').eq('code', code).eq('ecole_id', user.ecole_id).maybeSingle();
      nivId = niv?.id;
    }
    if (!nivId) return null;
    const { data: prog, error } = await supabase.from('programmes').select('reference_id,ordre,bloc_numero,bloc_nom,bloc_sens,type_contenu')
      .eq('niveau_id', nivId).eq('ecole_id', user.ecole_id).order('ordre');
    if (error) return [];
    programmesParCodeRef.current.set(code, prog || []);
    return prog || [];
  };
  const checkBlocageExamenEleveInterne = async (eleve, vals, recs, estCourant) => {
    try {
      const blocage = await verifierBlocageExamen(supabase, {
        eleve, ecole_id: user.ecole_id,
        validations: vals || [], recitations: recs || [],
      });
      if (estCourant && !estCourant()) return false; // FIX (oct 2026) : eleve change entre-temps
      blocageCourantRef.current = blocage || null;
      setBlocageExamen(blocage); // null si pas de blocage, objet sinon

      // Detection blocage ensemble (niveaux sourates uniquement)
      try {
        const niveauEleve = (niveaux || []).find(n => n.code === eleve?.code_niveau);
        if (niveauEleve && niveauEleve.type === 'sourate') {
          const blocagesEns = await verifierBlocageEnsemble(supabase, {
            eleve_id: eleve.id,
            ecole_id: user.ecole_id,
            niveau_id: niveauEleve.id,
            niveau_type: niveauEleve.type,
          });
          if (estCourant && !estCourant()) return !!blocage;
          blocagesEnsembleRef.current = blocagesEns || [];
          setBlocagesEnsemble(blocagesEns || []);
        } else {
          blocagesEnsembleRef.current = [];
          setBlocagesEnsemble([]);
        }
      } catch (e) { /* reseau instable */ }

      return !!blocage;
    } catch (e) {
      console.warn('[verif blocage examen]', e);
      blocageCourantRef.current = null;
      setBlocageExamen(null); setBlocagesEnsemble([]);
      setBlocagesEnsemble([]);
      return false;
    }
  };

  // FIX (oct 2026) : sourate en cours = 1re sourate du programme (dans le sens du niveau) ni
  // acquise avant le suivi ni deja recitee completement. Meme regle que l'ecran Recitation de
  // sourates (avant : tri toujours descendant et acquis comptes par position dans le programme).
  const listeSouratesEleve = (eleveObj, progData, souratesList) => {
    const sensS = getSensForEleve(eleveObj, niveaux, ecoleConfig);
    const progNums = new Set((progData || [])
      .map(p => (souratesList || []).find(x => String(x.id) === String(p.reference_id))?.numero)
      .filter(Boolean));
    return {
      ordre: ordonnerSouratesProgramme(souratesList || [], progNums, sensS),
      acquis: numerosSouratesAcquises(eleveObj?.sourates_acquises, sensS),
    };
  };
  const calcSourateCourante = (eleveObj, progData, souratesList, recs) => {
    const { ordre, acquis } = listeSouratesEleve(eleveObj, progData, souratesList);
    const faites = new Set(depuisDebutNiveau(recs || [], eleveObj).filter(r => r.type_recitation === 'complete' && !r.is_muraja).map(r => r.sourate_id));
    return ordre.find(sr => !acquis.has(sr.numero) && !faites.has(sr.id)) || null;
  };

  const selectEleve = async (e) => {
    // PERF/UX (oct 2026) : affichage immediat avec le programme deja en memoire, puis UNE seule
    // vague de requetes en parallele (eleve frais, ses validations, ses recitations si niveau
    // sourates, programme si absent). Avant : 4 a 5 allers-retours l'un apres l'autre.
    selectIdRef.current = e.id;
    const estCourant = () => selectIdRef.current === e.id;
    let resoudre; const promesse = new Promise(r => { resoudre = r; });
    pretRef.current = { promise: promesse, resolve: resoudre };
    marquerPret(false);
    setSelectedEleve(e);
    blocageCourantRef.current = null; blocagePromiseRef.current = null; blocagesEnsembleRef.current = [];
    setBlocageExamen(null); setBlocagesEnsemble([]);
    const valsLocales = validationsByEleveId.get(e.id) || [];
    const progCache = programmesParCodeRef.current.get(e.code_niveau);
    setProgrammeNiveau(progCache || []);
    setProgrammeCharge(!!progCache);
    setEtat(calcEtatEleveAvecBlocs(valsLocales, e, progCache || [], getSensForEleve(e, niveaux, ecoleConfig), bareme));
    setSearch('');
    setNbTomon(1);
    setSourateSelectionnee(null);
    setTypeRec('complete');
    setVersetDebut(''); setVersetFin('');

    const estSourateNiv = (code) => niveaux.some(n => n.code === code && n.type === 'sourate') || isSourateNiveauDyn(code, niveaux);
    let freshEleve = e, valsFinales = valsLocales, recitationsLocal = [];
    try {
      const [rFresh, rVals, rRecs, progData] = await Promise.all([
        supabase.from('eleves').select('*').eq('id', e.id).maybeSingle(),
        supabase.from('validations').select('*').eq('eleve_id', e.id).eq('ecole_id', user.ecole_id),
        estSourateNiv(e.code_niveau)
          ? supabase.from('recitations_sourates').select('*').eq('eleve_id', e.id).eq('ecole_id', user.ecole_id)
          : Promise.resolve({ data: [] }),
        progCache ? Promise.resolve(progCache) : chargerProgramme(e.code_niveau).catch(() => null),
      ]);
      if (!estCourant()) return;
      freshEleve = (rFresh && rFresh.data) || e;

      // Validations fraiches de l'eleve (une autre tablette a pu valider entre-temps) ;
      // on garde les validations optimistes encore en cours d'envoi.
      if (rVals && !rVals.error && Array.isArray(rVals.data)) {
        let optimistes = [];
        setAllValidations(prev => {
          optimistes = prev.filter(v => v.eleve_id === e.id && v._optimistic);
          return [...prev.filter(v => v.eleve_id !== e.id), ...rVals.data, ...optimistes];
        });
        valsFinales = [...rVals.data, ...valsLocales.filter(v => v._optimistic)];
      }

      // Programme : celui du niveau frais (si le niveau a change, on recharge)
      let progFinal = progData || [];
      if (freshEleve.code_niveau !== e.code_niveau) progFinal = (await chargerProgramme(freshEleve.code_niveau).catch(() => null)) || [];
      if (!estCourant()) return;
      if (freshEleve !== e) setSelectedEleve(freshEleve);
      setProgrammeNiveau(progFinal);
      setEtat(calcEtatEleveAvecBlocs(valsFinales, freshEleve, progFinal, getSensForEleve(freshEleve, niveaux, ecoleConfig), bareme));
      setProgrammeCharge(true);

      // Niveau sourates : sourate en cours (liste des sourates deja chargee a l'ouverture)
      if (estSourateNiv(freshEleve.code_niveau)) {
        let recs = (rRecs && rRecs.data) || [];
        if (freshEleve.code_niveau !== e.code_niveau && !estSourateNiv(e.code_niveau)) {
          const r2 = await supabase.from('recitations_sourates').select('*').eq('eleve_id', e.id).eq('ecole_id', user.ecole_id);
          recs = (r2 && r2.data) || [];
        }
        let souratesLocal = souratesDB;
        if (!souratesLocal || souratesLocal.length === 0) {
          const { data: sf } = await supabase.from('sourates').select('*');
          souratesLocal = sf || [];
          setSouratesDB(souratesLocal);
        }
        if (!estCourant()) return;
        // FIX (oct 2026) : la muraja (revision) ne compte pas dans la progression
        recitationsLocal = depuisDebutNiveau(recs.filter(r => !r.is_muraja), freshEleve); // + depuis le debut du niveau
        setRecitationsSourates(recitationsLocal);
        if (souratesLocal.length > 0) setCurrentSourateState(calcSourateCourante(freshEleve, progFinal, souratesLocal, recitationsLocal));
      } else {
        setRecitationsSourates([]);
      }
    } catch (err) {
      // Reseau instable : on continue avec les donnees locales (comme avant)
      console.warn('[selectEleve]', err);
      if (!estCourant()) return;
      setProgrammeCharge(true);
    }

    // Verification du blocage examen (parametres deja en memoire -> en general aucun appel reseau)
    await checkBlocageExamenEleve(freshEleve, valsFinales, recitationsLocal, estCourant);
    if (estCourant()) marquerPret(true);
  };

  const estSourate = selectedEleve ? isSourateNiveauDyn(selectedEleve.code_niveau, niveaux) : false;

  // Calculer la sourate en cours — même logique que RecitationSourate
  const getDbId = (numero) => souratesDB.find(s => s.numero === numero)?.id;
  const isCompleteNum = (numero) => {
    const dbId = getDbId(numero);
    return dbId ? recitationsSourates.some(r => r.sourate_id === dbId && r.type_recitation === 'complete') : false;
  };

  const currentSourate = programmeCharge ? currentSourateState : null;

  // Vérifier si l'élève a un programme défini
  // Pour sourates : programmeNiveau chargé depuis DB (table programmes)
  // Pour hizbs : hizb_depart défini et > 0
  // Pas de programme = chargement terminé ET programmeNiveau vide
  const aucunProgramme = (() => {
    if (!selectedEleve) return false;
    if (!programmeCharge) return false; // attendre fin du chargement
    if (estSourate) {
      return programmeNiveau.length === 0;
    } else {
      const hd = selectedEleve.hizb_depart;
      return hd === null || hd === undefined;
    }
  })();

  // Vérifier si c'est le dernier hizb du programme (pas forcément Hizb 1)
  const estDernierHizb = (() => {
    if (estSourate || !etat) return false;
    if (programmeNiveau.length === 0) return etat.hizbEnCours === 1; // fallback
    // Programme hizb : reference_id = numéro du hizb, trié par ordre
    // En desc : dernier hizb = plus petit numero. En asc : dernier hizb = plus grand numero.
    const sensEl = selectedEleve ? getSensForEleve(selectedEleve, niveaux, ecoleConfig) : 'desc';
    const hizbsProg = programmeNiveau.map(p => parseInt(p.reference_id)).filter(n => !isNaN(n));
    if (hizbsProg.length === 0) return etat.hizbEnCours === 1;
    const dernierHizb = sensEl === 'asc' ? Math.max(...hizbsProg) : Math.min(...hizbsProg);
    return etat.hizbEnCours === dernierHizb;
  })();

  // Vérifier si c'est la dernière sourate du programme
  const estDerniereSourate = (() => {
    if (!estSourate || !selectedEleve || !currentSourate) return false;
    // FIX (oct 2026) : meme liste que la sourate en cours (programme + sens + acquis)
    const { ordre, acquis } = listeSouratesEleve(selectedEleve, programmeNiveau, souratesDB);
    const restantes = ordre.filter(sr =>
      !acquis.has(sr.numero) && sr.numero !== currentSourate.numero && !isCompleteNum(sr.numero));
    return restantes.length === 0;
  })();

  // Valider N tomons
  const validerTomon = async () => {
    if (!selectedEleve || !etat || saving || etat.enAttenteHizbComplet) return;
    // Appui pendant le chargement : on attend l'eleve puis on relance avec l'etat a jour
    if (!selectionPreteRef.current) { if (await attendreSelection()) validerTomonRef.current?.(); return; }
    // FIX (oct 2026) : anti double-tap (le bouton est libere des l'affichage optimiste)
    if (tomonVerrouRef.current) return;
    tomonVerrouRef.current = true;
    setTimeout(() => { tomonVerrouRef.current = false; }, 900);
    // Attendre la verification de blocage lancee par la validation precedente (voir blocagePromiseRef)
    const blocageAttendu = await attendreVerifBlocage();
    if (blocageAttendu && !blocageExamen) {
      toast.error(
        lang === 'ar'
          ? `⛔ امتحان مطلوب: "${blocageAttendu.examen?.nom || ''}" قبل المتابعة`
          : `⛔ Examen requis : "${blocageAttendu.examen?.nom || ''}" avant de continuer`,
        { duration: 5000 }
      );
      return;
    }
    // Verification blocage examen avant validation (s'applique aussi aux tomons)
    if (blocageExamen) {
      toast.error(
        lang === 'ar'
          ? `⛔ امتحان مطلوب: "${blocageExamen.examen?.nom || blocageExamen.nom || ''}" قبل المتابعة`
          : `⛔ Examen requis : "${blocageExamen.examen?.nom || blocageExamen.nom || ''}" avant de continuer`,
        { duration: 5000 }
      );
      return;
    }
    setSaving(true);
    try {
    const payload = {
      eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
      nombre_tomon: nbTomon, type_validation: 'tomon',
      date_validation: new Date().toISOString(),
      tomon_debut: etat.prochainTomon, hizb_validation: etat.hizbEnCours
    };

    // === FIX L2 + Q2=A - OPTIMISTIC UI ===
    // 1. Ajout IMMEDIAT au state local + recalcul etat
    // 2. UI a jour INSTANTANEMENT (bouton libere)
    // 3. INSERT BDD en background (rollback si erreur)
    const optimisticVal = {
      id: `temp-${Date.now()}`,
      ...payload,
      _optimistic: true,
    };
    const newValsOpt = [...allValidations, optimisticVal];
    setAllValidations(newValsOpt);
    const sensEl = getSensForEleve(selectedEleve, niveaux, ecoleConfig);
    const valsEleveOpt = newValsOpt.filter(v => v.eleve_id === selectedEleve.id);
    setEtat(calcEtatEleveAvecBlocs(valsEleveOpt, selectedEleve, programmeNiveau, sensEl, bareme));

    // Affichage flash + reset IMMEDIATS
    const ptsParTomon = bareme?.unites?.tomon || 0;
    const pts = nbTomon * ptsParTomon;
    setFlash({ msg: `✓ ${nbTomon} ثمن · الحزب ${etat.hizbEnCours}`, color: '#1D9E75', pts });
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* */ }
    setTimeout(() => setFlash(null), 2500);
    setSessionLog(prev => [{
      eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
      detail: `${nbTomon} ثمن · الحزب ${etat.hizbEnCours}`, pts,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }, ...prev.slice(0, 9)]);
    setNbTomon(1);
    setSaving(false); // Liberer le bouton IMMEDIATEMENT

    // === BLOCAGE EXAMEN AFFICHE IMMEDIATEMENT (oct 2026) ===
    // On lance verifierBlocageExamen EN PARALLELE avec l'INSERT BDD, en utilisant
    // les validations OPTIMISTES (sans attendre le round-trip BDD).
    // Avant : la verif se faisait apres l'INSERT -> delai de 500ms-2s avant que le
    // bandeau rouge "Examen requis" apparaisse. Maintenant : <500ms.
    checkBlocageExamenEleve(selectedEleve, valsEleveOpt, recitationsSourates).catch(() => {});

    // === INSERT BDD + ROLLBACK SI ERREUR (background) ===
    const res = await enqueueOrRun(supabase, 'validations', 'insert', payload, user.ecole_id);
    const error = res.error;
    const wasQueued = res.status === 'queued';

    if (wasQueued) {
      toast.success(lang === 'ar'
        ? '✓ تم الحفظ (مزامنة تلقائية)'
        : '✓ Enregistré (sync auto)');
    }

    if (error) {
      // ROLLBACK : retirer la ligne optimiste + refresh BDD
      toast.error(lang === 'ar'
        ? `❌ خطأ في الحفظ : ${error.message}`
        : `❌ Erreur d'enregistrement : ${error.message}`,
        { duration: 4000 });
      const { data: refreshVals } = await supabase.from('validations').select('*')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', selectedEleve.id);
      if (refreshVals) {
        // Mettre a jour allValidations (remplace l'optimiste par les vraies donnees)
        setAllValidations(prev => [
          ...prev.filter(v => v.eleve_id !== selectedEleve.id),
          ...refreshVals,
        ]);
        setEtat(calcEtatEleveAvecBlocs(refreshVals, selectedEleve, programmeNiveau, sensEl, bareme));
      }
      return;
    }

    // === SUCCES - Refresh BDD en background + verif blocage ===
    invalidateMany(['validations', 'recitations_sourates_min', `validations_${selectedEleve.id}`, `recitations_eleve_${selectedEleve.id}`], user.ecole_id);
    if (!wasQueued) {
      (async () => {
        try {
          const { data: newVals } = await supabase.from('validations').select('*')
            .eq('ecole_id', user.ecole_id).eq('eleve_id', selectedEleve.id);
          const valsData = newVals || [];
          // Mise a jour allValidations avec les VRAIES donnees BDD
          setAllValidations(prev => [
            ...prev.filter(v => v.eleve_id !== selectedEleve.id),
            ...valsData,
          ]);
          // Verif blocage en background (non suivie : la verif optimiste fait deja foi)
          await checkBlocageExamenEleveInterne(selectedEleve, valsData, recitationsSourates);
        } catch (e) {
          console.warn('[validerTomon background]', e);
        }
      })();
    }
    } catch (err) {
      console.error('[validerTomon] ERREUR INATTENDUE', err);
      toast.error(lang === 'ar' ? `❌ خطأ : ${err.message}` : `❌ Erreur : ${err.message}`, { duration: 5000 });
    } finally {
      setSaving(false); // Garde-fou : toujours liberer le bouton
    }
  };

  // Valider hizb complet
  const validerHizb = async () => {
    if (!selectedEleve || !etat || saving || !etat.enAttenteHizbComplet) return;
    if (!selectionPreteRef.current) { if (await attendreSelection()) validerHizbRef.current?.(); return; }
    // Attendre la verification de blocage lancee par la validation precedente
    const blocageAttenduH = await attendreVerifBlocage();
    if (blocageAttenduH && !blocageExamen) {
      toast.error(
        lang === 'ar'
          ? `⛔ امتحان مطلوب: "${blocageAttenduH.examen?.nom || ''}" قبل المتابعة`
          : `⛔ Examen requis : "${blocageAttenduH.examen?.nom || ''}" avant de continuer`,
        { duration: 5000 }
      );
      return;
    }
    // Verification blocage examen avant validation
    if (blocageExamen) {
      toast.error(
        lang === 'ar'
          ? `⛔ امتحان مطلوب: "${blocageExamen.examen?.nom || blocageExamen.nom || ''}" قبل المتابعة`
          : `⛔ Examen requis : "${blocageExamen.examen?.nom || blocageExamen.nom || ''}" avant de continuer`,
        { duration: 5000 }
      );
      return;
    }
    setSaving(true);
    const payload = {
      eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
      nombre_tomon: 0, type_validation: 'hizb_complet',
      date_validation: new Date().toISOString(), hizb_valide: etat.hizbEnCours
    };

    // === FIX L2 + Q2=A - OPTIMISTIC UI ===
    const optimisticVal = {
      id: `temp-${Date.now()}`,
      ...payload,
      _optimistic: true,
    };
    const newValsOpt = [...allValidations, optimisticVal];
    setAllValidations(newValsOpt);
    const sensEl = getSensForEleve(selectedEleve, niveaux, ecoleConfig);
    const valsEleveOpt = newValsOpt.filter(v => v.eleve_id === selectedEleve.id);
    setEtat(calcEtatEleveAvecBlocs(valsEleveOpt, selectedEleve, programmeNiveau, sensEl, bareme));

    // Affichage flash IMMEDIAT
    const ptsHizb = bareme?.unites?.hizb_complet || 0;
    setFlash({ msg: `🎉 الحزب ${etat.hizbEnCours} مكتمل !`, color: '#EF9F27', pts: ptsHizb });
    try { if (navigator.vibrate) navigator.vibrate([25, 40, 25]); } catch (e) { /* */ }
    setTimeout(() => setFlash(null), 2500);
    setSessionLog(prev => [{
      eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
      detail: `الحزب ${etat.hizbEnCours} مكتمل`, pts: ptsHizb,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }, ...prev.slice(0, 9)]);
    const hizbValide = etat.hizbEnCours;
    setSaving(false); // Liberer le bouton IMMEDIATEMENT

    // === BLOCAGE EXAMEN AFFICHE IMMEDIATEMENT (oct 2026) ===
    // Verif en parallele avec l'INSERT BDD en utilisant les validations optimistes.
    checkBlocageExamenEleve(selectedEleve, valsEleveOpt, recitationsSourates).catch(() => {});

    // === INSERT BDD + ROLLBACK SI ERREUR (background) ===
    const res = await enqueueOrRun(supabase, 'validations', 'insert', payload, user.ecole_id);
    const error = res.error;
    const wasQueued = res.status === 'queued';

    if (wasQueued) {
      toast.success(lang === 'ar' ? '✓ تم الحفظ (مزامنة تلقائية)' : '✓ Enregistré (sync auto)');
    }

    if (error) {
      toast.error(lang === 'ar'
        ? `❌ خطأ في الحفظ : ${error.message}`
        : `❌ Erreur d'enregistrement : ${error.message}`,
        { duration: 4000 });
      const { data: refreshVals } = await supabase.from('validations').select('*')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', selectedEleve.id);
      if (refreshVals) {
        setAllValidations(prev => [
          ...prev.filter(v => v.eleve_id !== selectedEleve.id),
          ...refreshVals,
        ]);
        setEtat(calcEtatEleveAvecBlocs(refreshVals, selectedEleve, programmeNiveau, sensEl, bareme));
      }
      return;
    }

    invalidateMany(['validations', 'recitations_sourates_min', `validations_${selectedEleve.id}`, `recitations_eleve_${selectedEleve.id}`], user.ecole_id);

    // === SUCCES - BACKGROUND : refresh BDD + blocage + certificats + notifs parents ===
    if (!wasQueued) {
      (async () => {
        try {
          const { data: newVals } = await supabase.from('validations').select('*')
            .eq('ecole_id', user.ecole_id).eq('eleve_id', selectedEleve.id);
          const valsData = newVals || [];
          // Mise a jour avec VRAIES donnees BDD
          setAllValidations(prev => [
            ...prev.filter(v => v.eleve_id !== selectedEleve.id),
            ...valsData,
          ]);
          await checkBlocageExamenEleveInterne(selectedEleve, valsData, recitationsSourates);
          const nouveauxCerts = await verifierEtCreerCertificats(supabase, {
            eleve: selectedEleve, ecole_id: user.ecole_id, valide_par: user.id,
            validations: valsData, recitations: [],
          });
          if (nouveauxCerts && nouveauxCerts.length > 0) {
            setTimeout(() => setFlash({ msg: `🏅 ${(nouveauxCerts||[]).map(c => c.nom_certificat).join(', ')} !`, color: '#EF9F27', pts: 0 }), 600);
            setTimeout(() => setFlash(null), 4500);
            for (const c of nouveauxCerts) {
              notifierParents({
                type: 'certificat_obtenu',
                eleve: { id: selectedEleve.id, prenom: selectedEleve.prenom, nom: selectedEleve.nom, ecole_id: user.ecole_id },
                donnees: { certificat_nom: c.nom_certificat, certificat_nom_ar: c.nom_certificat_ar || null, jalon_id: c.jalon_id || null, date: c.date_obtention },
              }).catch(e => console.warn('[notif cert express] async error', e));
            }
          }
          notifierParents({
            type: 'hizb_complet',
            eleve: { id: selectedEleve.id, prenom: selectedEleve.prenom, nom: selectedEleve.nom, ecole_id: user.ecole_id },
            donnees: { hizb_num: hizbValide, date: new Date().toISOString() },
          }).catch(e => console.warn('[notif hizb express] async error', e));
        } catch (e) {
          console.warn('[validerHizb background]', e);
        }
      })();
    }
  };

  // Valider une sourate (complète ou séquence)
  const validerSourate = async () => {
    if (!selectedEleve || saving || !sourateSelectionnee) return;
    if (!selectionPreteRef.current) { if (await attendreSelection()) validerSourateRef.current?.(); return; }
    // FIX (oct 2026) : sans bareme charge, la recitation serait enregistree a 0 pt definitivement
    if (!bareme) { toast.info(lang==='ar'?'جاري تحميل سلم النقاط…':'Chargement du barème en cours, réessayez dans un instant'); return; }
    if (typeRec === 'sequence' && (!versetDebut || !versetFin)) return;
    // Attendre la verification lancee par la validation precedente (examen + ensemble)
    if (sourateVerrouRef.current) return;
    sourateVerrouRef.current = true;
    setTimeout(() => { sourateVerrouRef.current = false; }, 900);
    const blocageAttenduS = await attendreVerifBlocage();
    if (blocageAttenduS && !blocageExamen) {
      toast.error(
        lang === 'ar'
          ? `⛔ امتحان مطلوب: "${blocageAttenduS.examen?.nom || ''}" قبل المتابعة`
          : `⛔ Examen requis : "${blocageAttenduS.examen?.nom || ''}" avant de continuer`,
        { duration: 5000 }
      );
      return;
    }
    const blocagesEnsembleCourants = blocagesEnsembleRef.current || [];
    // Verification blocage examen avant validation (s'applique aussi aux sourates)
    if (blocageExamen) {
      toast.error(
        lang === 'ar'
          ? `⛔ امتحان مطلوب: "${blocageExamen.examen?.nom || blocageExamen.nom || ''}" قبل المتابعة`
          : `⛔ Examen requis : "${blocageExamen.examen?.nom || blocageExamen.nom || ''}" avant de continuer`,
        { duration: 5000 }
      );
      return;
    }

    // Blocage dur ensemble : si un ensemble est en attente de validation,
    // bloquer toute nouvelle sourate hors de cet ensemble (re-recitation OK)
    if (blocagesEnsembleCourants.length > 0) {
      const sourateIdLocal = souratesDB.find(s => s.numero === sourateSelectionnee.numero)?.id;
      const dansEnsembleBloque = blocagesEnsembleCourants.some(b =>
        (b.ensemble.sourates_ids || []).includes(sourateIdLocal)
      );
      if (!dansEnsembleBloque) {
        const ensembleNoms = blocagesEnsembleCourants.map(b => b.ensemble.nom).join(', ');
        toast.error(lang === 'ar'
          ? `🔒 يجب اعتماد المجموعة "${ensembleNoms}" أولاً قبل المتابعة`
          : `🔒 Validez d'abord l'ensemble "${ensembleNoms}" avant de continuer`,
          { duration: 5000 });
        return;
      }
    }

    // === FIX B4b - Protection anti-doublon (cote JS) ===
    if (typeRec === 'complete') {
      const sourateIdLocal = souratesDB.find(s => s.numero === sourateSelectionnee.numero)?.id;
      if (sourateIdLocal) {
        const dejaValidee = recitationsSourates.some(r =>
          r.sourate_id === sourateIdLocal &&
          r.type_recitation === 'complete' &&
          r.eleve_id === selectedEleve.id
        );
        if (dejaValidee) {
          toast.error(lang === 'ar'
            ? `⚠️ السورة ${sourateSelectionnee.nom_ar} مُسجَّلة من قبل لهذا الطالب`
            : `⚠️ Sourate ${sourateSelectionnee.nom_ar} déjà validée pour cet élève`,
            { duration: 4000 });
          const { data: refreshRecs } = await supabase.from('recitations_sourates')
            .select('*').eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id);
          if (refreshRecs) setRecitationsSourates(refreshRecs.filter(r => !r.is_muraja));
          setSourateSelectionnee(null);
          return;
        }
      }
    }
    setSaving(true);

    // Trouver l'id Supabase par numero
    let sourateId = souratesDB.find(s => s.numero === sourateSelectionnee.numero)?.id;
    if (!sourateId) {
      const { data: freshSour } = await supabase.from('sourates')
        .select('id,numero').eq('numero', sourateSelectionnee.numero).single();
      sourateId = freshSour?.id;
    }
    if (!sourateId) { setSaving(false); return; }

    // Calcul priorite Mode 3 > Mode 1 : note specifique pour cette sourate dans
    // un ensemble paramétré, sinon note generique
    const calcPts = calculerPointsSourate(sourateId, bareme, ensemblesData, typeRec);
    const pts = calcPts.points;

    // === FIX L1 + Q2=A - OPTIMISTIC UI ===
    // 1. Ajout IMMEDIAT au state local (avant l'INSERT BDD)
    // 2. Calcul SOURATE SUIVANTE IMMEDIAT (avant l'INSERT BDD)
    // 3. INSERT BDD en arriere-plan (rollback si erreur)
    // Resultat : tout s'actualise INSTANTANEMENT au clic Valider.
    const optimisticRec = {
      id: `temp-${Date.now()}`,
      eleve_id: selectedEleve.id,
      ecole_id: user.ecole_id,
      sourate_id: sourateId,
      type_recitation: typeRec,
      verset_debut: typeRec === 'sequence' ? parseInt(versetDebut) : null,
      verset_fin: typeRec === 'sequence' ? parseInt(versetFin) : null,
      date_validation: new Date().toISOString(),
      points: pts,
      _optimistic: true,
    };
    const optimisticRecs = [...recitationsSourates, optimisticRec];
    setRecitationsSourates(optimisticRecs);

    // Calcul sourate suivante avec donnees OPTIMISTES (instantane)
    setCurrentSourateState(calcSourateCourante(selectedEleve, programmeNiveau, souratesDB, optimisticRecs));

    // Affichage flash + reset selection IMMEDIATS
    const detail = typeRec === 'complete'
      ? sourateSelectionnee.nom_ar
      : `${sourateSelectionnee.nom_ar} (V.${versetDebut}→${versetFin})`;
    setFlash({ msg: `✓ ${detail}`, color: typeRec === 'complete' ? '#EF9F27' : '#1D9E75', pts });
    setTimeout(() => setFlash(null), 2500);
    setSessionLog(prev => [{
      eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`, detail, pts,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }, ...prev.slice(0, 9)]);
    setSourateSelectionnee(null); setTypeRec('complete');
    setVersetDebut(''); setVersetFin('');
    setSaving(false); // Liberer le bouton IMMEDIATEMENT (UI optimiste a jour)

    // FIX (oct 2026, sourates) : toute la suite (insertion, relecture, verification examen ET
    // ensemble) est « suivie » : un appui suivant attend son resultat avant d'enregistrer
    // (comme pour les Hizb). Avant : la sourate suivante pouvait passer pendant la verification.
    const suite = async () => {

      // === BLOCAGE EXAMEN AFFICHE IMMEDIATEMENT (oct 2026) ===
      // Verif en parallele avec l'INSERT BDD en utilisant les recitations optimistes
      // (les validations hizb/tomon ne changent pas ici, on passe l'etat courant).
      // La verif post-INSERT (ci-dessous) reste SYNCHRONE pour empecher la course condition.
      const valsEleveOpt = allValidations.filter(v => v.eleve_id === selectedEleve.id);
      checkBlocageExamenEleveInterne(selectedEleve, valsEleveOpt, optimisticRecs).catch(() => {});

      // === INSERT BDD + ROLLBACK SI ERREUR (background) ===
      const res = await enqueueOrRun(supabase, 'recitations_sourates', 'insert', {
        eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
        sourate_id: sourateId, type_recitation: typeRec,
        verset_debut: typeRec === 'sequence' ? parseInt(versetDebut) : null,
        verset_fin: typeRec === 'sequence' ? parseInt(versetFin) : null,
        date_validation: new Date().toISOString(), points: pts,
      }, user.ecole_id);
      const error = res.error;
      const wasQueued = res.status === 'queued';

      if (wasQueued) {
        toast.success(lang === 'ar' ? '✓ تم الحفظ (مزامنة تلقائية)' : '✓ Enregistré (sync auto)');
      }

      if (error) {
        // ROLLBACK : retirer la ligne optimiste + refresh BDD
        const isDuplicate = error.code === '23505' || /duplicate|unique/i.test(error.message || '');
        if (isDuplicate) {
          toast.error(lang === 'ar'
            ? `⚠️ السورة مُسجَّلة من قبل (تم منع التكرار)`
            : `⚠️ Sourate déjà validée (doublon évité)`,
            { duration: 4000 });
        } else {
          toast.error(lang === 'ar'
            ? `❌ خطأ في الحفظ : ${error.message}`
            : `❌ Erreur d'enregistrement : ${error.message}`,
            { duration: 4000 });
        }
        // Refresh BDD pour aligner l'UI
        const { data: refreshRecs } = await supabase.from('recitations_sourates')
          .select('*').eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id);
        if (refreshRecs) {
          setRecitationsSourates((refreshRecs || []).filter(r => !r.is_muraja));
          // Recalculer sourate suivante avec donnees REELLES
          setCurrentSourateState(calcSourateCourante(selectedEleve, programmeNiveau, souratesDB, refreshRecs));
        }
        return;
      }

      // === SUCCES - Refresh BDD pour remplacer l'optimistic id par le vrai ===
      // checkBlocageExamenEleve fait SYNCHRONEMENT pour empecher l'eleve de valider
      // une sourate de plus avant que le blocage soit reflete dans l'UI.
      // (Sinon course condition : l'eleve clique 2x rapidement et passe-outre le blocage)
      try {
        const [recsResult, valsResult] = await Promise.all([
          supabase.from('recitations_sourates').select('*').eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id),
          supabase.from('validations').select('*').eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id),
        ]);
        const newRecsData = (recsResult.data || []).filter(r => !r.is_muraja); // FIX (oct 2026) : muraja exclue
        const valsData = valsResult.data || [];
        setRecitationsSourates(newRecsData);

        // SYNCHRONE : verifier blocage AVANT de rendre la main au surveillant
        await checkBlocageExamenEleveInterne(selectedEleve, valsData, newRecsData);

        // Certificats en background (non bloquant pour l'UI)
        (async () => {
          try {
            const nouveauxCertsSourate = await verifierEtCreerCertificats(supabase, {
              eleve: selectedEleve, ecole_id: user.ecole_id, valide_par: user.id,
              validations: valsData, recitations: newRecsData,
            });
            if (nouveauxCertsSourate.length > 0) {
              setTimeout(() => setFlash({ msg: `🏅 ${(nouveauxCertsSourate||[]).map(c => c.nom_certificat_ar||c.nom_certificat).join(', ')} !`, color: '#EF9F27', pts: 0 }), 600);
              setTimeout(() => setFlash(null), 4500);
            }
          } catch (e) {
            console.warn('[validerSourate certs background]', e);
          }
        })();
      } catch (e) {
        console.warn('[validerSourate post-insert]', e);
      }
    };
    const suivi = { fini: false };
    suivi.p = suite().finally(() => { suivi.fini = true; });
    blocagePromiseRef.current = suivi;
    await suivi.p;
  };

  const sl = selectedEleve && etat ? scoreLabel(etat.points.total, lang) : null;
  const nc = selectedEleve ? ({ '5B': '#534AB7', '5A': '#378ADD', '2M': '#1D9E75', '2': '#EF9F27', '1': '#E24B4A' }[selectedEleve.code_niveau] || '#888') : '#888';

  // ── PC ───────────────────────────────────────────────────────────
  // Toujours la derniere version des actions (pour relancer apres une attente de chargement)
  validerTomonRef.current = validerTomon;
  validerHizbRef.current = validerHizb;
  validerSourateRef.current = validerSourate;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: isMobile?80:0, background: isMobile?'#f5f5f0':'transparent', minHeight: isMobile?'100vh':'auto' }}>
      {/* Flash */}
      {flash && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 999,
          background: flash.color, color: '#fff', padding: '12px 28px', borderRadius: 14,
          fontSize: 14, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          textAlign: 'center', minWidth: 260 }}>
          {flash.msg}
          {flash.pts > 0 && <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>+{flash.pts} {t(lang, 'pts_abrev')}</div>}
        </div>
      )}

      {/* Header */}
      {isMobile ? (
        <MobileHeader
          title={lang==='ar'?'استظهار سريع':'Validation express'}
          subtitle={lang==='ar'?'ابحث وسجّل بنقرتين':'Trouvez et validez en 2 clics'}
          icon={Zap}
          onBack={()=>goBack?goBack():navigate('dashboard')}
          lang={lang}
        />
      ) : (
        <div style={{ padding:'1rem 0 0' }}>
          <PageHeader
            title="Validation express"
            titleAr="تسجيل سريع"
            icon="⚡"
            subtitle={lang === 'ar' ? 'ابحث عن طالب وسجّل استظهاره بنقرتين' : 'Trouvez un élève et validez en 2 clics'}
            onBack={() => goBack ? goBack() : navigate('dashboard')}
            lang={lang}
          />
        </div>
      )}

      {/* Barre de recherche */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', padding: isMobile?'0 12px':0 }}>
        <input ref={searchRef} className="field-input"
          style={{ fontSize: 15, padding: '13px 16px 13px 44px' }}
          placeholder={`🔍 ${lang === 'ar' ? 'ابحث بالاسم أو رقم التعريف...' : 'Nom ou numéro élève...'}`}
          value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
        {filteredEleves.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
            border: '0.5px solid #e0e0d8', borderRadius: '0 0 14px 14px', zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {(filteredEleves||[]).map(e => {
              const vals = validationsByEleveId.get(e.id) || [];
              const sensEl = getSensForEleve(e, niveaux, ecoleConfig);
              // BUG-FIX POINTS (oct 2026) : passer bareme pour afficher les vrais
              // points dans la liste de recherche. On garde eleve=null et
              // programmeNiveau=null : programmeNiveau en state ici correspond
              // a l'eleve selectionne precedent, pas forcement a `e`. L'ancienne
              // logique mono-bloc reste donc utilisee pour le dropdown.
              const et = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart, sensEl, e, null, bareme);
              const isSour = isSourateNiveauDyn(e.code_niveau, niveaux);
              const nivColor = ({ '5B': '#534AB7', '5A': '#378ADD', '2M': '#1D9E75', '2': '#EF9F27', '1': '#E24B4A' }[e.code_niveau] || '#888');
              return (
                <div key={e.id} onTouchEnd={()=>selectEleve(e)} onClick={() => selectEleve(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    cursor: 'pointer', borderBottom: '0.5px solid #f0f0ec' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = '#f9f9f6'}
                  onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${nivColor}20`,
                    color: nivColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    {getInitiales(e.prenom, e.nom)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>
                      <span style={{ padding: '1px 6px', borderRadius: 6, background: `${nivColor}15`, color: nivColor, fontWeight: 700, marginLeft: 4 }}>{e.code_niveau}</span>
                      {isSour ? ` · ${lang === 'ar' ? 'سور' : 'Sourates'}` : ` · ${lang === 'ar' ? 'الحزب' : 'Hizb'} ${et.hizbEnCours} · ${lang === 'ar' ? 'ث' : 'T'}.${et.prochainTomon || '—'}`}
                    </div>
                  </div>
                  <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zone de validation */}
      {selectedEleve && etat && (
        <div style={{ background: '#fff', borderRadius: 18, border: `2px solid ${nc}30`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem' }}>

          {/* Header élève */}
          <div style={{ background: `linear-gradient(135deg,#085041,#1D9E75)`, padding: '16px 20px',
            borderBottom: `1px solid ${nc}20`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg,#085041,#1D9E75)`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 16, flexShrink: 0, boxShadow: `0 3px 10px ${nc}40` }}>
              {getInitiales(selectedEleve.prenom, selectedEleve.nom)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{selectedEleve.prenom} {selectedEleve.nom}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                <span style={{ padding: '1px 8px', borderRadius: 8, background: `${nc}15`, color: nc, fontWeight: 700, marginLeft: 6 }}>{selectedEleve.code_niveau}</span>
                {!estSourate && ` · الحزب ${etat.hizbEnCours} · ${etat.tomonDansHizbActuel}/8 ثمن`}
                {` · ${etat.points.total.toLocaleString()} ${t(lang, 'pts_abrev')}`}
              </div>
            </div>
            <button onClick={() => { setSelectedEleve(null); setEtat(null); setBlocageExamen(null); setTimeout(() => searchRef.current?.focus(), 100); }}
              style={{ width: 30, height: 30, borderRadius: '50%', background: '#f5f5f0', border: 'none',
                fontSize: 14, cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>

          {/* ── BANDEAU BLOCAGE EXAMEN ── */}
          {blocageExamen && (
            <div style={{ background:'linear-gradient(135deg,#FFF3E0,#FCEBEB)', borderBottom:'2px solid #E24B4A',
              padding:'14px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ fontSize:28, flexShrink:0 }}>🔒</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#7F1D1D', marginBottom:3 }}>
                  {lang==='ar'?'امتحان مطلوب قبل المتابعة':'Examen requis avant de continuer'}
                </div>
                <div style={{ fontSize:12, color:'#7F1D1D', lineHeight:1.5 }}>
                  {lang==='ar'
                    ? `يجب اجتياز الامتحان "${blocageExamen.examen?.nom||blocageExamen.nom||''}" بنجاح قبل تسجيل أي تلاوة جديدة.`
                    : `Vous devez faire passer et valider l'examen "${blocageExamen.examen?.nom||blocageExamen.nom||''}" avant de pouvoir enregistrer une nouvelle récitation pour cet élève.`}
                </div>
              </div>
              <button onClick={()=>navigate('resultats_examens', {eleve:selectedEleve, blocage:blocageExamen})}
                style={{ background:'#E24B4A', color:'#fff', border:'none', borderRadius:10,
                  padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                {lang==='ar'?'إلى الامتحانات ←':'→ Vers les examens'}
              </button>
            </div>
          )}

          {/* ── BANDEAU BLOCAGES ENSEMBLE (niveaux sourates) ── */}
          {blocagesEnsemble.length > 0 && blocagesEnsemble.map((b, idx) => {
            // Cas A deja couvert par le bandeau examen si actif
            if (b.cas === 'A' && blocageExamen) return null;
            return (
              <div key={`ens-${idx}`} style={{
                background: b.cas === 'A' ? 'linear-gradient(135deg,#FFF3E0,#FCEBEB)' : 'linear-gradient(135deg,#EEEDFE,#F5F0FE)',
                borderBottom: `2px solid ${b.cas === 'A' ? '#E24B4A' : '#534AB7'}`,
                padding:'14px 20px', display:'flex', alignItems:'center', gap:14,
              }}>
                <div style={{ fontSize:28, flexShrink:0 }}>{b.cas === 'A' ? '📝' : '📦'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color: b.cas === 'A' ? '#7F1D1D' : '#3a3387', marginBottom:3 }}>
                    {b.cas === 'A'
                      ? (lang==='ar'?'مجموعة مكتملة - امتحان مطلوب':'Ensemble complété - Examen requis')
                      : (lang==='ar'?'مجموعة مكتملة - يرجى الاعتماد':'Ensemble complété - Validation requise')}
                  </div>
                  <div style={{ fontSize:12, color: b.cas === 'A' ? '#7F1D1D' : '#534AB7', lineHeight:1.5 }}>
                    {b.cas === 'A'
                      ? (lang==='ar'
                          ? `أنهى التلميذ المجموعة "${b.ensemble.nom}". يجب اجتياز الامتحان "${b.examen.nom}".`
                          : `L'élève a terminé l'ensemble "${b.ensemble.nom}". L'examen "${b.examen.nom}" est requis.`)
                      : (lang==='ar'
                          ? `أنهى التلميذ كل سور المجموعة "${b.ensemble.nom}". يرجى الاستماع لاستظهارها كاملة ثم اعتمادها.`
                          : `L'élève a terminé toutes les sourates de "${b.ensemble.nom}". Écoutez la récitation complète puis validez.`)}
                  </div>
                </div>
                {b.cas === 'A' ? (
                  <button onClick={()=>navigate('resultats_examens', {eleve:selectedEleve, blocage:{examen:b.examen}})}
                    style={{ background:'#E24B4A', color:'#fff', border:'none', borderRadius:10,
                      padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                    {lang==='ar'?'إلى الامتحانات ←':'→ Vers les examens'}
                  </button>
                ) : (
                  <button onClick={async ()=>{
                      if (ensembleVerrouRef.current) return; // FIX (oct 2026) : anti double appui
                      if (!window.confirm(lang==='ar' ? 'تأكيد اعتماد المجموعة ؟' : "Confirmer la validation de l'ensemble ?")) return;
                      ensembleVerrouRef.current = true;
                      let res;
                      try {
                        res = await validerEnsemble(supabase, {
                          eleve_id: selectedEleve.id,
                          ecole_id: user.ecole_id,
                          ensemble_id: b.ensemble.id,
                          valide_par: user.id,
                        });
                      } finally { ensembleVerrouRef.current = false; }
                      if (res?.error) {
                        toast.error(lang==='ar' ? 'خطأ في الاعتماد' : 'Erreur lors de la validation');
                        return;
                      }
                      toast.success(lang==='ar'
                        ? `✅ تم اعتماد "${b.ensemble.nom}"`
                        : `✅ "${b.ensemble.nom}" validé`);
                      blocagesEnsembleRef.current = (blocagesEnsembleRef.current || []).filter(x => x.ensemble.id !== b.ensemble.id);
                      setBlocagesEnsemble(prev => prev.filter((_, i) => i !== idx));
                    }}
                    style={{ background:'#534AB7', color:'#fff', border:'none', borderRadius:10,
                      padding:'9px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                    ✓ {lang==='ar' ? 'اعتماد':"Valider"}
                  </button>
                )}
              </div>
            );
          })}

          <div style={{ padding: '20px' }}>
            {/* ── Pas de programme ── */}
            {aucunProgramme && (
              <div style={{ textAlign:'center', padding:'1.5rem', background:'#FCEBEB',
                borderRadius:12, border:'1px solid #E24B4A20' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#E24B4A', marginBottom:4 }}>
                  {lang==='ar'?'لا يوجد برنامج لهذا الطالب':'Aucun programme défini pour cet élève'}
                </div>
                <div style={{ fontSize:12, color:'#888' }}>
                  {lang==='ar'?'يرجى إعداد البرنامج من الإدارة  المستويات':'Configurez le programme dans الإدارة → المستويات'}
                </div>
              </div>
            )}
            {/* ── Élève HIZB ── */}
            {!estSourate && !aucunProgramme && (
              <>
                {etat.enAttenteHizbComplet ? (
                  /* Validation hizb complet */
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: '#FAEEDA', borderRadius: 12, padding: '14px', marginBottom: 16,
                      fontSize: 14, color: '#633806', fontWeight: 600 }}>
                      🎉 {lang === 'ar' ? `الحزب ${etat.hizbEnCours} مكتمل — انتظار التصحيح` : `Hizb ${etat.hizbEnCours} complet — en attente de validation`}
                    </div>
                    <button onClick={validerHizb} disabled={saving || preparation || !!blocageExamen} aria-busy={preparation}
                      style={{ width: '100%', padding: '16px', background: blocageExamen ? '#E9E5DF' : saving ? '#ccc' : preparation ? 'linear-gradient(135deg,#0B5A45cc,#1D9E75cc)' : 'linear-gradient(135deg,#085041,#1D9E75)',
                        color: blocageExamen ? '#8A5A00' : '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 3px 12px rgba(239,159,39,0.4)', fontFamily: 'inherit' }}>
                      {blocageExamen ? (lang === 'ar' ? '🔒 امتحان مطلوب قبل المتابعة' : '🔒 Examen requis avant de continuer') : (saving || preparation) ? (lang === 'ar' ? '⏳ جارٍ التسجيل…' : '⏳ Enregistrement…') : `✓ ${lang === 'ar' ? `تصحيح الحزب ${etat.hizbEnCours}` : `Valider Hizb ${etat.hizbEnCours}`}${(bareme?.unites?.hizb_complet||0)>0?` (+${bareme.unites.hizb_complet} ${t(lang,'pts_abrev')})`:''}`}
                    </button>
                  </div>
                ) : (
                  /* Validation tomons */
                  <div>
                    {/* Avertissement dernier hizb */}
                    {estDernierHizb && (
                      <div style={{ background:'#FAEEDA', borderRadius:10, padding:'10px 14px',
                        marginBottom:12, fontSize:12, color:'#633806', textAlign:'center', fontWeight:600 }}>
                        ⚠️ {lang==='ar'
                          ? 'هذا آخر حزب في البرنامج — تأكد من صحة الاستظهار قبل التسجيل'
                          : 'Dernier hizb du programme — vérifiez avant de valider'}
                      </div>
                    )}

                    {/* Barre progression hizb */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginBottom: 6 }}>
                        <span>{lang === 'ar' ? `الحزب ${etat.hizbEnCours}` : `Hizb ${etat.hizbEnCours}`}</span>
                        <span>{etat.tomonDansHizbActuel}/8 {lang === 'ar' ? 'ثمن' : 'tomon'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <div key={n} style={{ flex: 1, height: 8, borderRadius: 3,
                            background: n <= etat.tomonDansHizbActuel ? nc : '#e8e8e0' }} />
                        ))}
                      </div>
                    </div>

                    {/* Prochain tomon info */}
                    <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 13, color: '#666' }}>
                      {lang === 'ar' ? `الثمن التالي : ث.${etat.prochainTomon} من الحزب ${etat.hizbEnCours}` : `Prochain : T.${etat.prochainTomon} — Hizb ${etat.hizbEnCours}`}
                    </div>

                    {/* Sélecteur nombre de tomons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                      background: '#f9f9f6', borderRadius: 12, padding: '12px 16px' }}>
                      <span style={{ fontSize: 13, color: '#666', flex: 1 }}>
                        {lang === 'ar' ? 'عدد الأثمان المستظهرة:' : 'Nombre de tomons :'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => setNbTomon(Math.max(1, nbTomon - 1))}
                          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${nc}40`,
                            background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: nc }}>−</button>
                        <span style={{ fontSize: 22, fontWeight: 900, color: nc, minWidth: 32, textAlign: 'center' }}>{nbTomon}</span>
                        <button onClick={() => setNbTomon(Math.min(etat.tomonRestants, nbTomon + 1))}
                          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${nc}40`,
                            background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: nc }}>+</button>
                      </div>
                      <span style={{ fontSize: 12, color: '#aaa' }}>+{ptsValidation({ type_validation: 'tomon', nombre_tomon: nbTomon }, bareme)} {t(lang, 'pts_abrev')}</span>
                    </div>

                    {/* Bouton valider */}
                    <button onClick={validerTomon} disabled={saving || preparation || !!blocageExamen} aria-busy={preparation}
                      style={{ width: '100%', padding: '15px', background: blocageExamen ? '#E9E5DF' : saving ? '#ccc' : preparation ? `linear-gradient(135deg,#0B5A45cc,#1D9E75cc)` : `linear-gradient(135deg,#085041,#1D9E75)`,
                        color: blocageExamen ? '#8A5A00' : '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800,
                        cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                        boxShadow: (saving || blocageExamen) ? 'none' : `0 3px 12px ${nc}40`, transition: 'all 0.15s' }}>
                      {blocageExamen ? (lang === 'ar' ? '🔒 امتحان مطلوب قبل المتابعة' : '🔒 Examen requis avant de continuer') : (saving || preparation) ? (lang === 'ar' ? '⏳ جارٍ التسجيل…' : '⏳ Enregistrement…') : `✓ ${lang === 'ar' ? `تسجيل ${nbTomon} ثمن` : `Valider ${nbTomon} tomon${nbTomon > 1 ? 's' : ''}`}`}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Élève SOURATES — affiche la sourate en cours directement ── */}
            {estSourate && !sourateSelectionnee && !aucunProgramme && (
              <div>
                {currentSourate ? (
                  <>
                    {/* Info sourate en cours */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14,
                      padding:'12px 14px', background:`${nc}08`, borderRadius:12, border:`1px solid ${nc}20` }}>
                      <div style={{ lineHeight:1.2, flex:1 }}>
                        <div style={{ fontSize:11, color:'#aaa', marginBottom:3 }}>
                          {lang==='ar'?'السورة في الدور:':'Sourate en cours :'}
                        </div>
                        <div style={{ fontSize:17, fontWeight:900, color:'#1a1a1a', direction:'rtl' }}>
                          {currentSourate.nom_ar}
                        </div>
                        <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>
                          {lang==='ar'?'رقم':'N°'} {currentSourate.numero} · {currentSourate.nb_versets} {lang==='ar'?'آية':'versets'}
                        </div>
                      </div>
                      <div style={{ width:44, height:44, borderRadius:10, background:`${nc}15`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:16, fontWeight:900, color:nc, flexShrink:0 }}>
                        {currentSourate.numero}
                      </div>
                    </div>

                {/* Avertissement dernière sourate */}
                {estDerniereSourate && (
                  <div style={{ background:'#FAEEDA', borderRadius:10, padding:'10px 14px',
                    marginBottom:12, fontSize:12, color:'#633806', textAlign:'center', fontWeight:600 }}>
                    ⚠️ {lang==='ar'
                      ? 'هذه آخر سورة في البرنامج — تأكد من صحة الاستظهار قبل التسجيل'
                      : 'Dernière sourate du programme — vérifiez avant de valider'}
                  </div>
                )}

                    {/* Choix : complète ou séquence */}
                    <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                      {[
                        { val:'complete', label:lang==='ar'?'كاملة':'Complète', pts:bareme?.unites?.sourate||0, icon:'🎯' },
                        { val:'sequence', label:lang==='ar'?'مقطع':'Séquence', pts:bareme?.unites?.sequence_sourate||0, icon:'📌' },
                      ].map(opt => (
                        <button key={opt.val} onClick={() => { setTypeRec(opt.val); setSourateSelectionnee(currentSourate); }}
                          style={{ flex:1, padding:'12px 8px', borderRadius:12, cursor:'pointer',
                            border:`2px solid ${nc}30`, background:`${nc}08`,
                            fontFamily:'inherit', transition:'all 0.15s' }}
                          onMouseEnter={ev=>{ev.currentTarget.style.background=`${nc}15`;ev.currentTarget.style.border=`2px solid ${nc}60`;}}
                          onMouseLeave={ev=>{ev.currentTarget.style.background=`${nc}08`;ev.currentTarget.style.border=`2px solid ${nc}30`;}}>
                          <div style={{ fontSize:20, marginBottom:4 }}>{opt.icon}</div>
                          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>{opt.label}</div>
                          {opt.pts > 0 && <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>+{opt.pts} {t(lang,'pts_abrev')}</div>}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign:'center', padding:'2rem' }}>
                    {souratesDB.length === 0 ? (
                      <div style={{ color:'#aaa', fontSize:13 }}>...</div>
                    ) : (
                      <>
                        <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#085041' }}>
                          {lang==='ar'?'أحسنت! تم الانتهاء من جميع سور البرنامج':'Programme complété !'}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Confirmation sourate ── */}
            {estSourate && sourateSelectionnee && !aucunProgramme && (
              <div>
                {/* Sourate sélectionnée */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  background: `${nc}12`, borderRadius: 12, marginBottom: 14,
                  border: `1.5px solid ${nc}30` }}>
                  <span style={{ fontSize: 11, color: nc, fontWeight: 700, background: `${nc}20`,
                    padding: '2px 8px', borderRadius: 8 }}>{sourateSelectionnee.numero}</span>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#1a1a1a', direction: 'rtl' }}>
                    {sourateSelectionnee.nom_ar}
                  </span>
                  <button onClick={() => setSourateSelectionnee(null)}
                    style={{ fontSize: 13, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Type : complète ou séquence */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { val: 'complete', label: lang==='ar'?'كاملة':'Complète', pts: bareme?.unites?.sourate || 0, icon: '🎯' },
                    { val: 'sequence', label: lang==='ar'?'مقطع':'Séquence', pts: bareme?.unites?.sequence_sourate || 0, icon: '📌' },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setTypeRec(opt.val)}
                      style={{ flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                        border: `2px solid ${typeRec === opt.val ? nc : '#e0e0d8'}`,
                        background: typeRec === opt.val ? `${nc}12` : '#f9f9f6',
                        fontFamily: 'inherit', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: 16 }}>{opt.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: typeRec === opt.val ? nc : '#555' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>+{opt.pts} {t(lang, 'pts_abrev')}</div>
                    </button>
                  ))}
                </div>

                {/* Versets si séquence */}
                {typeRec === 'sequence' && (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <label className="field-lbl">{lang==='ar'?'من الآية':'Verset début'}</label>
                      <input className="field-input" type="number" min="1" max={sourateSelectionnee.nb_versets}
                        value={versetDebut} onChange={e => setVersetDebut(e.target.value)}
                        placeholder="1" style={{ textAlign: 'center' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="field-lbl">{lang==='ar'?'إلى الآية':'Verset fin'}</label>
                      <input className="field-input" type="number" min="1" max={sourateSelectionnee.nb_versets}
                        value={versetFin} onChange={e => setVersetFin(e.target.value)}
                        placeholder={String(sourateSelectionnee.nb_versets)} style={{ textAlign: 'center' }} />
                    </div>
                  </div>
                )}

                {/* Bouton valider */}
                <button onClick={validerSourate} aria-busy={preparation}
                  disabled={saving || preparation || !!blocageExamen || (typeRec === 'sequence' && (!versetDebut || !versetFin))}
                  style={{ width: '100%', padding: '15px',
                    background: blocageExamen ? '#E9E5DF' : (saving || (typeRec === 'sequence' && (!versetDebut || !versetFin)))
                      ? '#e0e0d8' : `linear-gradient(135deg,#085041,#1D9E75)`,
                    color: blocageExamen ? '#8A5A00' : (saving || (typeRec === 'sequence' && (!versetDebut || !versetFin))) ? '#aaa' : '#fff',
                    border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: saving ? 'none' : `0 3px 12px ${nc}40` }}>
                  {blocageExamen ? (lang === 'ar' ? '🔒 امتحان مطلوب قبل المتابعة' : '🔒 Examen requis avant de continuer') : (saving || preparation) ? (lang === 'ar' ? '⏳ جارٍ التسجيل…' : '⏳ Enregistrement…') : `✓ ${lang==='ar'?'تسجيل':'Valider'} ${typeRec==='complete'?(lang==='ar'?'السورة كاملة':'sourate complète'):(lang==='ar'?'المقطع':'la séquence')}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* État vide */}
      {!selectedEleve && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#bbb' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#888', marginBottom: 6 }}>
            {lang === 'ar' ? 'تسجيل سريع' : 'Validation express'}
          </div>
          <div style={{ fontSize: 13 }}>
            {lang === 'ar' ? 'ابحث عن طالب وسجّل استظهاره بنقرتين' : 'Recherchez un élève et validez en 2 clics'}
          </div>
        </div>
      )}

      {/* Journal de session */}
      {sessionLog.length > 0 && (
        <>
          <div className="section-label">{lang === 'ar' ? 'سجل الجلسة' : 'Journal de session'} ({sessionLog.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessionLog.map((log, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#bbb', minWidth: 40 }}>{log.time}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{log.eleve}</span>
                  <span style={{ fontSize: 12, color: '#888' }}> — {log.detail}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75' }}>+{log.pts} {t(lang, 'pts_abrev')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
