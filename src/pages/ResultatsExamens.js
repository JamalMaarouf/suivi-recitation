import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { loadBareme, enregistrerPointsEvenement, verifierEtCreerCertificats, verifierEtCreerCertificatsExamens, loadAnneeActiveAvecPeriodes, formatPeriodeCourte, detecterPeriodeEnCours } from '../lib/helpers';
import { useToast } from '../lib/toast';
import { t } from '../lib/i18n';
import { openPDF } from '../lib/pdf';
import ExportButtons from '../components/ExportButtons';
import PeriodeSelectorHybride from '../components/PeriodeSelectorHybride';
import PageHeader from '../components/PageHeader';

export default function ResultatsExamens({ user, navigate, goBack, lang='fr', isMobile, data }) {
  const { toast } = useToast();
  const eleveInit  = data?.eleve  || null;
  const blocageInit= data?.blocage|| null;

  const [eleves,    setEleves]    = useState([]);
  const [examens,   setExamens]   = useState([]);
  const [resultats, setResultats] = useState([]);
  const [niveaux,   setNiveaux]   = useState([]);
  const [ensembles, setEnsembles] = useState([]);
  const [souratesDB,setSouratesDB]= useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [ecole, setEcole] = useState(null);
  const [activeTab, setActiveTab] = useState('saisir');
  // Etape 8 - Modale certificats post-examen
  const [showCertifsModal, setShowCertifsModal] = useState(null); // {eleve, examen, certs:[]} ou null

  // Formulaire
  const [searchEleve,    setSearchEleve]    = useState('');
  const [selectedEleve,  setSelectedEleve]  = useState(eleveInit);
  const [selectedExamen, setSelectedExamen] = useState(blocageInit?.examen||null);
  const [examensEleve,   setExamensEleve]   = useState([]);
  const [score,          setScore]          = useState(70);
  const [notes,          setNotes]          = useState('');

  // Filtres saisie
  const [filtreNiveauEleve, setFiltreNiveauEleve] = useState('tous');

  // Filtres registre
  const [filtreNiveau,  setFiltreNiveau]  = useState('tous');
  const [filtreStatut,  setFiltreStatut]  = useState('tous');
  const [filtreExamen,  setFiltreExamen]  = useState('tous');

  // ─── B1 — Refonte Registre ───────────────────────────────────────
  // Sélecteur de période (pattern Dashboard Direction)
  const [anneeActive, setAnneeActive] = useState(null);
  const [periodesBDD, setPeriodesBDD] = useState([]);
  const [periode, setPeriode] = useState('mois');     // 'mois' | 'annee_scolaire' | 'bdd_<id>' | 'custom'
  const [customDebut, setCustomDebut] = useState('');
  const [customFin, setCustomFin] = useState('');
  // Recherche par élève (Q1=B)
  const [searchEleveRegistre, setSearchEleveRegistre] = useState('');
  // Filtres avancés dépliables (les 3 select : niveau/examen/statut)
  const [showFiltresAvances, setShowFiltresAvances] = useState(false);
  // Liste des certificats existants en BDD (pour détecter "Certificat à éditer")
  const [certificatsExistants, setCertificatsExistants] = useState([]);
  // ─────────────────────────────────────────────────────────────────

  useEffect(() => { loadAll(); }, []);

  // B1 — Charger l'année scolaire active + ses périodes (T, S) pour le sélecteur
  useEffect(() => {
    if (!user?.ecole_id) return;
    loadAnneeActiveAvecPeriodes(supabase, user.ecole_id).then(({ annee, periodes }) => {
      setAnneeActive(annee);
      setPeriodesBDD(periodes.filter(p => p.type === 'trimestre' || p.type === 'semestre'));
    });
  }, [user?.ecole_id]);

  const loadAll = async () => {
    setLoading(true);
    try {
    const [{ data:el },{ data:ex },{ data:re },{ data:nv },{ data:en },{ data:sd },{ data:certs }] = await Promise.all([
      supabase.from('eleves').select('id,prenom,nom,code_niveau,niveau,instituteur_referent_id,eleve_id_ecole').eq('ecole_id',user.ecole_id).order('nom'),
      supabase.from('examens').select('*').eq('ecole_id',user.ecole_id).order('nom'),
      supabase.from('resultats_examens').select('*').eq('ecole_id',user.ecole_id).order('created_at',{ascending:false}),
      supabase.from('niveaux').select('id,code,nom,couleur,type').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('ensembles_sourates').select('id,nom,ordre,niveau_id').eq('ecole_id',user.ecole_id),
      supabase.from('sourates').select('id,numero,nom_ar').order('numero'),
      // B1 — certificats existants pour repérer ceux "à éditer"
      supabase.from('certificats_eleves').select('id,resultat_examen_id_source,examen_id_source,eleve_id').eq('ecole_id',user.ecole_id),
    ]);
    const niveauxData = nv||[];
    const examenData  = (ex||[]).map(e=>({ ...e, niveau: niveauxData.find(n=>n.id===e.niveau_id)||null }));
    // Instituteur → ses élèves uniquement / Surveillant → tous
    // Tous les élèves de l'école — instituteur et surveillant ont accès à tous
    const elevesFiltres = (el||[]);
    setEleves(elevesFiltres);
    setExamens(examenData);
    setResultats(re||[]);
    setNiveaux(niveauxData);
    setEnsembles(en||[]);
    setSouratesDB(sd||[]);
    setCertificatsExistants(certs||[]);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
    // Charger les données de l'école
    if (user.ecole_id) {
      const { data: ecoleData } = await supabase.from('ecoles')
        .select('id,nom,ville,pays').eq('id', user.ecole_id).maybeSingle();
      setEcole(ecoleData);
    }
  };

  // Quand on sélectionne un élève → charger ses examens disponibles
  const selectionnerEleve = (eleve) => {
    setSelectedEleve(eleve);
    setSelectedExamen(null);
    setScore(70);
    setNotes('');
    // Trouver l'UUID du niveau via code_niveau
    const niveauId = niveaux.find(n => n.code === eleve.code_niveau)?.id;
    // Examens du niveau de l'élève pas encore réussis
    const exNiveau = niveauId ? examens.filter(e => e.niveau_id === niveauId) : [];
    const dejaReussis = resultats
      .filter(r => r.eleve_id === eleve.id && r.statut === 'reussi')
      .map(r => r.examen_id);
    const disponibles = exNiveau.filter(e => !dejaReussis.includes(e.id));
    setExamensEleve(disponibles);
    setSearchEleve('');
  };

  const sauvegarder = async () => {
    if (saving) return;
    if (!selectedEleve)  return toast.warning(lang==='ar'?'اختر طالباً':'Sélectionnez un élève');
    if (!selectedExamen) return toast.warning(lang==='ar'?'اختر الامتحان':'Sélectionnez un examen');
    setSaving(true);
    const reussi = score >= (selectedExamen.score_minimum || 70);
    // Vérifier si résultat existant → update, sinon insert
    const existant = resultats.find(r=>r.eleve_id===selectedEleve.id&&r.examen_id===selectedExamen.id);
    const payload = {
      examen_id: selectedExamen.id, eleve_id: selectedEleve.id, ecole_id: user.ecole_id,
      date_examen: new Date().toISOString().split('T')[0],
      score: parseInt(score), statut: reussi?'reussi':'echoue',
      notes_examinateur: notes.trim()||null, valide_par: user.id,
    };
    const { error } = existant
      ? await supabase.from('resultats_examens').update(payload).eq('id',existant.id)
      : await supabase.from('resultats_examens').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message||'Erreur'); return; }
    // Si réussi → créditer les points de l'examen + vérifier jalons
    if (reussi) {
      try {
        const bareme = await loadBareme(supabase, user.ecole_id);
        const ptsExamen = bareme.examens?.[selectedExamen.id] || 0;
        if (ptsExamen > 0) {
          await enregistrerPointsEvenement(supabase, {
            eleve_id: selectedEleve.id, ecole_id: user.ecole_id,
            type_event: 'examen', objet_id: selectedExamen.id,
            points: ptsExamen, valide_par: user.id,
          });
        }
        // Vérifier si un jalon est débloqué (Sources A/B/C)
        const { data: valsEleve } = await supabase.from('validations').select('*').eq('eleve_id', selectedEleve.id);
        const { data: recsEleve } = await supabase.from('recitations_sourates').select('*').eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id);
        const nouveauxCertsJalons = await verifierEtCreerCertificats(supabase, {
          eleve: selectedEleve, ecole_id: user.ecole_id, valide_par: user.id,
          validations: valsEleve || [], recitations: recsEleve || [],
        });

        // Etape 8 - Source D : auto-cert post-examen (toujours, meme sans jalon)
        const nouveauxCertsExamens = await verifierEtCreerCertificatsExamens(supabase, {
          eleve: selectedEleve, ecole_id: user.ecole_id, valide_par: user.id,
        });

        // Combiner tous les certificats nouvellement crees
        const tousNouveauxCerts = [...nouveauxCertsJalons, ...nouveauxCertsExamens];

        if (tousNouveauxCerts.length > 0) {
          // Toast immediat pour feedback rapide
          toast.success(lang==='ar'
            ? `🎉 ${tousNouveauxCerts.length} ${tousNouveauxCerts.length===1?'شهادة جديدة':'شهادات جديدة'}`
            : `🎉 ${tousNouveauxCerts.length} nouveau${tousNouveauxCerts.length>1?'x':''} certificat${tousNouveauxCerts.length>1?'s':''}`);
          // Modale avec liste + bouton Editer (s'ouvre apres le toast principal)
          setTimeout(() => {
            setShowCertifsModal({
              eleve: selectedEleve,
              examen: selectedExamen,
              certs: tousNouveauxCerts,
            });
          }, 300);
        }
      } catch(e) { console.error('points examen error:', e); }
    }
    toast.success(reussi
      ? (lang==='ar'?'🎉 تهانينا! نجح الطالب':'🎉 Félicitations ! Examen réussi !')
      : (lang==='ar'?'❌ لم ينجح الطالب. يجب إعادة الامتحان':'❌ Examen non validé. À repasser.'));
    // Reset
    setSelectedEleve(null); setSelectedExamen(null); setScore(70); setNotes('');
    loadAll();
    setActiveTab('registre');
  };

  // ── DONNÉES CALCULÉES ──────────────────────────────────────────
  // filtreNiveauEleve = 'tous' ou code du niveau (ex: '5B')
  const elevesFiltres = eleves.filter(e => {
    const nom = `${e.prenom||''} ${e.nom||''}`.toLowerCase().trim();
    const num = String(e.eleve_id_ecole ?? '').trim();
    const q   = searchEleve.trim();
    const matchNiveau = filtreNiveauEleve==='tous' || e.code_niveau===filtreNiveauEleve;
    if (!q) return matchNiveau;
    const matchNom    = nom.includes(q.toLowerCase());
    const matchNumero = num.includes(q);
    return (matchNom || matchNumero) && matchNiveau;
  });

  // ─── B1 — Calcul de la période active (pattern Dashboard Direction) ──
  const { periodeDebut, periodeFin } = useMemo(() => {
    const now = new Date();
    if (periode === 'mois') {
      return {
        periodeDebut: new Date(now.getFullYear(), now.getMonth(), 1),
        periodeFin: now,
      };
    }
    if (periode === 'annee_scolaire' && anneeActive) {
      return {
        periodeDebut: new Date(anneeActive.date_debut),
        periodeFin: new Date(anneeActive.date_fin),
      };
    }
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
          periodeFin: new Date(p.date_fin),
        };
      }
    }
    // Fallback : ce mois
    return {
      periodeDebut: new Date(now.getFullYear(), now.getMonth(), 1),
      periodeFin: now,
    };
  }, [periode, periodesBDD, anneeActive, customDebut, customFin]);

  // ─── B1 — Set des résultats ayant déjà un certificat émis ────────────
  const resultatsAvecCertif = useMemo(() => {
    const set = new Set();
    (certificatsExistants || []).forEach(c => {
      if (c.resultat_examen_id_source) set.add(c.resultat_examen_id_source);
    });
    return set;
  }, [certificatsExistants]);

  // ─── B1 — Résultats filtrés par PÉRIODE en premier (pour stats + liste) ──
  const resultatsPeriode = useMemo(() =>
    (resultats || []).filter(r => {
      const d = new Date(r.date_examen || r.created_at);
      return d >= periodeDebut && d <= periodeFin;
    }),
    [resultats, periodeDebut, periodeFin]
  );

  // ─── B1 — Stats sur la période (Q5=A) ────────────────────────────────
  const stats = useMemo(() => {
    const total = resultatsPeriode.length;
    const reussis = resultatsPeriode.filter(r => r.statut === 'reussi').length;
    const echoues = resultatsPeriode.filter(r => r.statut === 'echoue').length;
    const aTraiter = resultatsPeriode.filter(r =>
      r.statut === 'reussi' && !resultatsAvecCertif.has(r.id)
    ).length;
    return {
      total,
      reussis,
      echoues,
      aTraiter,
      tauxReussite: total > 0 ? Math.round(reussis / total * 100) : 0,
    };
  }, [resultatsPeriode, resultatsAvecCertif]);

  // ─── B1 — Filtres + tri "À traiter" en premier (Q4=B) ────────────────
  const resultasFiltres = useMemo(() => {
    const q = (searchEleveRegistre || '').trim().toLowerCase();
    const filtered = resultatsPeriode.filter(r => {
      const ex = examens.find(e => e.id === r.examen_id);
      const el = eleves.find(e => e.id === r.eleve_id);
      // Statut spécial 'a_traiter' = réussi sans certif
      if (filtreStatut === 'a_traiter') {
        if (r.statut !== 'reussi' || resultatsAvecCertif.has(r.id)) return false;
      } else if (filtreStatut !== 'tous' && r.statut !== filtreStatut) {
        return false;
      }
      if (filtreNiveau !== 'tous' && ex?.niveau_id !== filtreNiveau) return false;
      if (filtreExamen !== 'tous' && r.examen_id !== filtreExamen) return false;
      if (q) {
        const nom = el ? `${el.prenom} ${el.nom}`.toLowerCase() : '';
        const num = String(el?.eleve_id_ecole || '').toLowerCase();
        if (!nom.includes(q) && !num.includes(q)) return false;
      }
      return true;
    });
    // Tri : "À traiter" d'abord, puis date desc
    return filtered.sort((a, b) => {
      const aTraiterA = a.statut === 'reussi' && !resultatsAvecCertif.has(a.id);
      const aTraiterB = b.statut === 'reussi' && !resultatsAvecCertif.has(b.id);
      if (aTraiterA !== aTraiterB) return aTraiterA ? -1 : 1;
      const dA = new Date(a.date_examen || a.created_at);
      const dB = new Date(b.date_examen || b.created_at);
      return dB - dA;
    });
  }, [resultatsPeriode, examens, eleves, filtreNiveau, filtreStatut, filtreExamen, searchEleveRegistre, resultatsAvecCertif]);

  const nomEleve   = (id) => { const e=eleves.find(x=>x.id===id); return e?`${e.prenom} ${e.nom}`:'?'; };

  const nomExamen  = (id) => examens.find(e=>e.id===id)?.nom||'?';
  const nomNiveau  = (id) => { const n=niveaux.find(x=>x.id===id); return n?`${n.code} — ${n.nom}`:'?'; };
  const couleurNiv = (id) => niveaux.find(n=>n.id===id)?.couleur||'#888';
  const couleurNivCode = (code) => niveaux.find(n=>n.code===code)?.couleur||'#888';
  const nomNiveauCode  = (code) => { const n=niveaux.find(x=>x.code===code); return n?`${n.code} — ${n.nom}`:code||'?'; };

  // ─── B1 — Helpers sélecteur de période (pattern Dashboard Direction) ──
  const trimestresBDD = periodesBDD.filter(p => p.type === 'trimestre');
  const semestresBDD  = periodesBDD.filter(p => p.type === 'semestre');
  const trimestreEnCours = detecterPeriodeEnCours(trimestresBDD);
  const isAr = lang === 'ar';

  const boutonsRapides = [
    { key: 'mois', label: isAr ? 'الشهر الحالي' : 'Ce mois' },
    ...(trimestreEnCours ? [{ key: 'bdd_' + trimestreEnCours.id, label: formatPeriodeCourte(trimestreEnCours, lang, true) }] : []),
    ...(anneeActive ? [{ key: 'annee_scolaire', label: anneeActive.nom }] : []),
  ];
  const idsRapides = boutonsRapides.map(b => b.key);
  const dropdownItems = [
    { groupe: isAr ? 'حديث' : 'Récent', items: [
      { key: 'mois', label: isAr ? 'الشهر الحالي' : 'Ce mois (calendaire)' },
    ].filter(item => !idsRapides.includes(item.key)) },
    { groupe: isAr ? 'الفصول الدراسية' : 'Trimestres', items:
      trimestresBDD.map(p => ({ key: 'bdd_' + p.id, label: formatPeriodeCourte(p, lang, true) }))
        .filter(item => !idsRapides.includes(item.key))
    },
    { groupe: isAr ? 'الحصيلة' : 'Bilans', items:
      semestresBDD.map(p => ({ key: 'bdd_' + p.id, label: formatPeriodeCourte(p, lang, true) }))
        .filter(item => !idsRapides.includes(item.key))
    },
  ].filter(g => g.items.length > 0);

  // ─── B1 — Voir certificat existant : redirige vers menu Certificats ──
  const voirCertificat = (r) => {
    const cert = (certificatsExistants || []).find(c => c.resultat_examen_id_source === r.id);
    if (cert) {
      navigate('liste_certificats', null, { focusCertId: cert.id });
    } else {
      // B3 — Pas encore de cert : passer resultat + examen pour ouverture modale en mode création
      navigate('liste_certificats', null, {
        focusEleveId: r.eleve_id,
        focusResultatId: r.id,
        focusExamenId: r.examen_id,
      });
    }
  };

  const reussi = score >= (selectedExamen?.score_minimum||70);

  // ── ONGLETS ────────────────────────────────────────────────────
  const Tabs = () => (
    <div style={{display:'flex',gap:0,marginBottom:isMobile?0:'1.5rem',
      background:'#f5f5f0',borderRadius:12,padding:4}}>
      {[
        {id:'saisir', ar:'تسجيل نتيجة', fr:'Saisir un résultat', icon:'✍️'},
        {id:'registre', ar:'سجل النتائج', fr:'Registre', icon:'📋'},
      ].map(tab=>(
        <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
          style={{flex:1,padding:'10px 16px',borderRadius:10,border:'none',cursor:'pointer',
            fontFamily:'inherit',fontSize:13,fontWeight:600,transition:'all 0.15s',
            background:activeTab===tab.id?'#fff':'transparent',
            color:activeTab===tab.id?'#085041':'#888',
            boxShadow:activeTab===tab.id?'0 1px 4px rgba(0,0,0,0.08)':'none'}}>
          {tab.icon} {lang==='ar'?tab.ar:tab.fr}
        </button>
      ))}
    </div>
  );

  // ── ONGLET SAISIE ──────────────────────────────────────────────
  // Contenu des onglets — en variables JSX (pas de composants) pour éviter perte de focus
  const tabSaisirJSX = (
    <div>
      {/* Étape 1 — Choisir l'élève */}
      <div style={{background:'#fff',borderRadius:14,padding:'18px',marginBottom:14,
        border:'0.5px solid #e0e0d8'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:12}}>
          {lang==='ar'?'① اختر الطالب':'① Choisir l\'élève'}
          {selectedEleve&&(
            <span style={{marginRight:8,fontSize:12,fontWeight:400,color:'#888'}}>
              — {selectedEleve.prenom} {selectedEleve.nom}
              <button onClick={()=>{setSelectedEleve(null);setSelectedExamen(null);setExamensEleve([]);}}
                style={{marginRight:6,background:'none',border:'none',color:'#E24B4A',
                  cursor:'pointer',fontSize:12}}>✕</button>
            </span>
          )}
        </div>
        {!selectedEleve ? (
          <>
            {/* Filtres rapides par niveau */}
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              <div onClick={()=>setFiltreNiveauEleve('tous')}
                style={{padding:'5px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,
                  background:filtreNiveauEleve==='tous'?'#085041':'#f5f5f0',
                  color:filtreNiveauEleve==='tous'?'#fff':'#666',border:'0.5px solid #e0e0d8'}}>
                {lang==='ar'?'الكل':'Tous'}
              </div>
              {niveaux.map(n=>(
                <div key={n.id} onClick={()=>setFiltreNiveauEleve(n.code)}
                  style={{padding:'5px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,
                    background:filtreNiveauEleve===n.code?n.couleur:'#f5f5f0',
                    color:filtreNiveauEleve===n.code?'#fff':'#666',
                    border:`0.5px solid ${filtreNiveauEleve===n.code?n.couleur:'#e0e0d8'}`}}>
                  {n.code}
                </div>
              ))}
            </div>
            {/* Recherche nom + numéro */}
            <input value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}
              placeholder={lang==='ar'?'🔍 بحث باسم الطالب أو رقمه...':'🔍 Nom ou numéro élève...'}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,
                border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',
                boxSizing:'border-box',marginBottom:8}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:11,color:'#888'}}>
                {elevesFiltres.length} {lang==='ar'?'طالب':'élève(s)'}
              </span>
              {searchEleve&&(
                <button onClick={()=>setSearchEleve('')}
                  style={{fontSize:11,color:'#E24B4A',background:'none',border:'none',cursor:'pointer'}}>
                  ✕ {lang==='ar'?'مسح':'Effacer'}
                </button>
              )}
            </div>
            <div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
              {elevesFiltres.slice(0,20).map(e=>{
                const niv = niveaux.find(n=>n.code===e.code_niveau);
                const nc  = niv?.couleur||'#888';
                return(
                  <div key={e.id} onClick={()=>selectionnerEleve(e)}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                      borderRadius:10,cursor:'pointer',background:'#f5f5f0',
                      border:'0.5px solid #e0e0d8'}}>
                    <div style={{width:34,height:34,borderRadius:8,background:`${nc}20`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontWeight:700,fontSize:13,color:nc,flexShrink:0}}>
                      {(e.prenom||'?')[0]}{(e.nom||'?')[0]}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14}}>{e.prenom} {e.nom}</div>
                      <div style={{fontSize:11,color:'#888',display:'flex',gap:8,alignItems:'center'}}>
                        {e.eleve_id_ecole&&<span style={{padding:'1px 7px',borderRadius:20,background:'#f0f0ec',fontWeight:700,color:'#555'}}>#{e.eleve_id_ecole}</span>}
                        {niv?.code} — {niv?.nom}
                      </div>
                    </div>
                    {/* Badge examen en attente */}
                    {(() => {
                      const niveauId = niveaux.find(n=>n.code===e.code_niveau)?.id;
                      const exNiv = niveauId ? examens.filter(ex=>ex.niveau_id===niveauId) : [];
                      const reuss = resultats.filter(r=>r.eleve_id===e.id&&r.statut==='reussi').map(r=>r.examen_id);
                      const enAttente = exNiv.filter(ex=>!reuss.includes(ex.id)).length;
                      return enAttente>0?(
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,
                          background:'#FCEBEB',color:'#E24B4A',fontWeight:700}}>
                          {enAttente} {lang==='ar'?'امتحان':'exam(s)'}
                        </span>
                      ):null;
                    })()}
                  </div>
                );
              })}
              {elevesFiltres.length===0&&<div style={{textAlign:'center',color:'#aaa',padding:'1rem',fontSize:13}}>
                {lang==='ar'?'لا نتائج':'Aucun résultat'}
              </div>}
            </div>
          </>
        ):(
          // Élève sélectionné — afficher sa carte
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
            borderRadius:12,background:'#E1F5EE',border:'1.5px solid #1D9E75'}}>
            <div style={{width:44,height:44,borderRadius:10,
              background:`${couleurNivCode(selectedEleve.code_niveau)}20`,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontWeight:800,fontSize:16,color:couleurNivCode(selectedEleve.code_niveau)}}>
              {selectedEleve.prenom[0]}{selectedEleve.nom[0]}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:16}}>{selectedEleve.prenom} {selectedEleve.nom}</div>
              <div style={{fontSize:12,color:'#666',display:'flex',gap:8,alignItems:'center'}}>
                {selectedEleve.eleve_id_ecole&&<span style={{padding:'1px 7px',borderRadius:20,background:'rgba(255,255,255,0.4)',fontWeight:700}}>#{selectedEleve.eleve_id_ecole}</span>}
                {nomNiveauCode(selectedEleve.code_niveau)}
              </div>
            </div>
            <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,
              background:'#1D9E75',color:'#fff',fontWeight:600}}>
              {examensEleve.length} {lang==='ar'?'امتحان متاح':'examen(s) disponible(s)'}
            </span>
          </div>
        )}
      </div>

      {/* Étape 2 — Choisir l'examen */}
      {selectedEleve&&(
        <div style={{background:'#fff',borderRadius:14,padding:'18px',marginBottom:14,
          border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:12}}>
            {lang==='ar'?'② اختر الامتحان':'② Choisir l\'examen'}
          </div>
          {examensEleve.length===0?(
            <div style={{textAlign:'center',padding:'1.5rem',background:'#FAEEDA',
              borderRadius:10,color:'#633806',fontSize:13}}>
              {resultats.some(r=>r.eleve_id===selectedEleve.id)
                ? <>🎉 {lang==='ar'?'الطالب أنجز جميع الامتحانات المتاحة!':'Cet élève a complété tous les examens disponibles !'}</>
                : <>
                    ⚠️ {lang==='ar'
                      ?'لا توجد امتحانات محددة لهذا المستوى.'
                      :'Aucun examen configuré pour ce niveau.'}
                    <button onClick={()=>navigate('examens')}
                      style={{display:'block',margin:'8px auto 0',padding:'7px 16px',
                        background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,
                        fontSize:12,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>
                      {lang==='ar'?'إضافة امتحان للمستوى →':'Créer un examen pour ce niveau →'}
                    </button>
                  </>
              }
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {examensEleve.map(ex=>{
                const sel = selectedExamen?.id===ex.id;
                const nc  = couleurNiv(ex.niveau_id);
                return(
                  <div key={ex.id} onClick={()=>{setSelectedExamen(ex);setScore(ex.score_minimum||70);}}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                      borderRadius:12,cursor:'pointer',
                      background:sel?`${nc}10`:'#f5f5f0',
                      border:`1.5px solid ${sel?nc:'#e0e0d8'}`}}>
                    <div style={{fontSize:22}}>{ex.bloquant?'🔒':'📝'}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:sel?700:500,fontSize:14,color:sel?nc:'#333'}}>{ex.nom}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>
                        {lang==='ar'?'النجاح من':'Seuil :'} {ex.score_minimum||70}%
                        {ex.bloquant&&<span style={{marginRight:8,color:'#E24B4A',fontWeight:600}}> · {lang==='ar'?'موقف':'Bloquant'}</span>}
                      </div>
                    </div>
                    {sel&&<span style={{color:nc,fontWeight:700,fontSize:18}}>✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Étape 3 — Score & verdict */}
      {selectedEleve&&selectedExamen&&(
        <div style={{background:'#fff',borderRadius:14,padding:'18px',marginBottom:14,
          border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:16}}>
            {lang==='ar'?'③ النتيجة':'③ Résultat'}
          </div>

          {/* Slider score */}
          <div style={{marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <label style={{fontSize:13,fontWeight:600,color:'#666'}}>
                {lang==='ar'?'النقاط المحصلة':'Score obtenu'}
              </label>
              <span style={{fontSize:24,fontWeight:800,color:reussi?'#1D9E75':'#E24B4A'}}>
                {score}%
              </span>
            </div>
            <input type="range" min="0" max="100" step="5" value={score}
              onChange={e=>setScore(parseInt(e.target.value))}
              style={{width:'100%',accentColor:reussi?'#1D9E75':'#E24B4A'}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#aaa',marginTop:4}}>
              <span>0%</span>
              <span style={{color:'#888'}}>Seuil : {selectedExamen.score_minimum||70}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Verdict */}
          <div style={{padding:'14px 18px',borderRadius:12,marginBottom:16,textAlign:'center',
            background:reussi?'#E1F5EE':'#FCEBEB',
            border:`1.5px solid ${reussi?'#1D9E75':'#E24B4A'}`}}>
            <div style={{fontSize:32,marginBottom:6}}>{reussi?'🎉':'❌'}</div>
            <div style={{fontWeight:700,fontSize:16,color:reussi?'#085041':'#C0392B'}}>
              {reussi
                ?(lang==='ar'?'ناجح — الامتحان مُجتاز':'Réussi — Examen validé !')
                :(lang==='ar'?'لم ينجح — يجب إعادة الامتحان':'Non validé — À repasser')}
            </div>
            {selectedExamen.bloquant&&!reussi&&(
              <div style={{fontSize:12,color:'#E24B4A',marginTop:4}}>
                🔒 {lang==='ar'?'الطالب موقوف حتى اجتياز هذا الامتحان'
                  :'L\'élève reste bloqué jusqu\'à la validation'}
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>
              {lang==='ar'?'ملاحظات المصحح (اختياري)':'Observations (optionnel)'}
            </label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder={lang==='ar'?'ملاحظات حول أداء الطالب...':'Notes sur la prestation de l\'élève...'}
              style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:13,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}}/>
          </div>

          {/* Bouton */}
          <button onClick={sauvegarder} disabled={saving}
            style={{width:'100%',padding:'14px',border:'none',borderRadius:12,
              background:saving?'#ccc':reussi?'#1D9E75':'#E24B4A',
              color:'#fff',fontSize:15,fontWeight:700,cursor:saving?'not-allowed':'pointer',
              fontFamily:'inherit'}}>
            {saving?'...':(reussi
              ?(lang==='ar'?'✅ تسجيل النجاح':'✅ Valider la réussite')
              :(lang==='ar'?'❌ تسجيل الرسوب':'❌ Enregistrer l\'échec'))}
          </button>
        </div>
      )}
    </div>
  );

  const tabRegistreJSX = (
    <div>
      {/* ── B1 — Sélecteur de période (pattern Dashboard Direction) ── */}
      <div style={{marginBottom:16, padding:'12px 14px', background:'#fff',
        borderRadius:12, border:'0.5px solid #e0e0d8'}}>
        <div style={{fontSize:11,color:'#888',marginBottom:8,letterSpacing:0.5,fontWeight:600}}>
          {isAr?'الفترة':'PÉRIODE'}
        </div>
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
      </div>

      {/* ── B1 — Stats : 4 cartes cliquables (filtrent sur la période) ── */}
      <div style={{display:'grid',
        gridTemplateColumns: isMobile?'repeat(2,1fr)':'repeat(4,1fr)',
        gap:10, marginBottom:16}}>
        {[
          {key:'tous',     label:isAr?'المجموع':'Total',           val:stats.total,
            color:'#085041', bg:'#E1F5EE', icon:'📊'},
          {key:'reussi',   label:isAr?'ناجحون':'Réussis',          val:stats.reussis,
            color:'#1D9E75', bg:'#E1F5EE', icon:'✅'},
          {key:'echoue',   label:isAr?'راسبون':'Échoués',          val:stats.echoues,
            color:'#E24B4A', bg:'#FCEBEB', icon:'❌'},
          {key:'a_traiter',label:isAr?'شهادة قيد الإصدار':'À traiter', val:stats.aTraiter,
            color:'#EF9F27', bg:'#FAEEDA', icon:'⚠️'},
        ].map((s)=>{
          const active = filtreStatut===s.key;
          return (
            <div key={s.key} onClick={()=>setFiltreStatut(s.key)}
              style={{background:s.bg, borderRadius:12, padding:'14px 12px',
                textAlign:'center', cursor:'pointer',
                border: active ? `2px solid ${s.color}` : '2px solid transparent',
                transition:'all 0.15s', userSelect:'none'}}>
              <div style={{fontSize:14, marginBottom:2}}>{s.icon}</div>
              <div style={{fontSize:24, fontWeight:800, color:s.color, lineHeight:1}}>{s.val}</div>
              <div style={{fontSize:11, color:s.color, opacity:0.85, marginTop:4, fontWeight:600}}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── B1 — Taux de réussite (info supplémentaire) ── */}
      {stats.total > 0 && (
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14,
          padding:'10px 14px', background:'#E6F1FB', borderRadius:10,
          fontSize:12, color:'#185FA5'}}>
          <span style={{fontSize:16}}>📈</span>
          <span style={{fontWeight:600}}>
            {isAr?'نسبة النجاح':'Taux de réussite'} : <strong>{stats.tauxReussite}%</strong>
          </span>
          <span style={{color:'#888', fontSize:11}}>
            ({stats.reussis} {isAr?'من':'sur'} {stats.total})
          </span>
        </div>
      )}

      {/* ── B1 — Recherche élève + Filtres avancés ── */}
      <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:12}}>
        <input type="text" value={searchEleveRegistre}
          onChange={e=>setSearchEleveRegistre(e.target.value)}
          placeholder={isAr?'🔍 ابحث عن طالب…':'🔍 Rechercher un élève…'}
          style={{flex:1, minWidth:200, padding:'9px 12px', borderRadius:10,
            border:'0.5px solid #e0e0d8', fontSize:13, fontFamily:'inherit',
            outline:'none', background:'#fff'}}/>
        <button onClick={()=>setShowFiltresAvances(v=>!v)}
          style={{padding:'9px 14px', borderRadius:10,
            border:'0.5px solid #e0e0d8',
            background: showFiltresAvances?'#085041':'#fff',
            color: showFiltresAvances?'#fff':'#085041',
            fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer'}}>
          ⚙️ {isAr?'مرشحات':'Filtres'} {showFiltresAvances?'▴':'▾'}
        </button>
        <span style={{fontSize:12, color:'#888'}}>
          {resultasFiltres.length} {isAr?'نتيجة':'résultat(s)'}
        </span>
      </div>

      {showFiltresAvances && (
        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12,
          padding:'12px', background:'#f9f9f6', borderRadius:10}}>
          <select value={filtreNiveau} onChange={e=>setFiltreNiveau(e.target.value)}
            style={{padding:'7px 12px', borderRadius:10, border:'0.5px solid #e0e0d8',
              fontSize:12, fontFamily:'inherit', background:'#fff', outline:'none'}}>
            <option value="tous">{isAr?'كل المستويات':'Tous les niveaux'}</option>
            {niveaux.map(n=><option key={n.id} value={n.id}>{n.code} — {n.nom}</option>)}
          </select>
          <select value={filtreExamen} onChange={e=>setFiltreExamen(e.target.value)}
            style={{padding:'7px 12px', borderRadius:10, border:'0.5px solid #e0e0d8',
              fontSize:12, fontFamily:'inherit', background:'#fff', outline:'none'}}>
            <option value="tous">{isAr?'كل الامتحانات':'Tous les examens'}</option>
            {examens.map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
          {(filtreNiveau!=='tous' || filtreExamen!=='tous' || filtreStatut!=='tous' || searchEleveRegistre) && (
            <button onClick={()=>{
              setFiltreNiveau('tous'); setFiltreExamen('tous');
              setFiltreStatut('tous'); setSearchEleveRegistre('');
            }} style={{padding:'7px 12px', borderRadius:10, border:'0.5px solid #E24B4A40',
              background:'#FCEBEB', color:'#E24B4A', fontSize:12, fontWeight:600,
              fontFamily:'inherit', cursor:'pointer'}}>
              ✕ {isAr?'مسح':'Effacer'}
            </button>
          )}
        </div>
      )}

      {/* ── B1 — Liste résultats ── */}
      {resultasFiltres.length===0 ? (
        <div style={{textAlign:'center', padding:'3rem', color:'#aaa',
          background:'#fff', borderRadius:12, border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:40, marginBottom:10}}>📋</div>
          <div>{isAr?'لا توجد نتائج لهذه الفترة':'Aucun résultat pour cette période'}</div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {resultasFiltres.map(r=>{
            const ex  = examens.find(e=>e.id===r.examen_id);
            const el  = eleves.find(e=>e.id===r.eleve_id);
            const niv = niveaux.find(n => n.id === ex?.niveau_id);
            const nc  = niv?.couleur || '#888';
            const ok  = r.statut==='reussi';
            const aTraiter = ok && !resultatsAvecCertif.has(r.id);
            const certExiste = ok && resultatsAvecCertif.has(r.id);
            return (
              <div key={r.id} style={{background:'#fff', borderRadius:12, padding:'14px 16px',
                border: aTraiter ? '1.5px solid #EF9F27' : `0.5px solid ${ok?'#1D9E7520':'#E24B4A20'}`,
                display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                {/* Verdict */}
                <div style={{width:40, height:40, borderRadius:10, flexShrink:0,
                  background: ok?'#E1F5EE':'#FCEBEB',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20}}>
                  {ok?'✅':'❌'}
                </div>
                {/* Info élève + examen */}
                <div style={{flex:1, minWidth:180}}>
                  <div style={{fontWeight:700, fontSize:14}}>
                    {el ? `${el.prenom} ${el.nom}` : '?'}
                    {el?.eleve_id_ecole && (
                      <span style={{marginLeft:6, padding:'1px 7px', borderRadius:20,
                        background:'#f0f0ec', fontSize:10, color:'#666', fontWeight:600}}>
                        #{el.eleve_id_ecole}
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:12, color:'#666', marginTop:2}}>
                    {ex?.nom || '?'}
                    <span style={{marginRight:6, marginLeft:6, color:'#ddd'}}>·</span>
                    <span style={{padding:'1px 7px', borderRadius:20, fontSize:11,
                      background:`${nc}20`, color:nc, fontWeight:600}}>
                      {niv ? `${niv.code} — ${niv.nom}` : '?'}
                    </span>
                  </div>
                  {r.notes_examinateur && (
                    <div style={{fontSize:11, color:'#888', marginTop:4, fontStyle:'italic'}}>
                      💬 {r.notes_examinateur}
                    </div>
                  )}
                  {/* B1 — Badge "Certificat à éditer" */}
                  {aTraiter && (
                    <div onClick={(e)=>{ e.stopPropagation(); voirCertificat(r); }}
                      style={{display:'inline-flex', alignItems:'center', gap:4,
                        marginTop:6, padding:'3px 10px', borderRadius:20,
                        background:'#FAEEDA', color:'#854F0B', fontSize:11,
                        fontWeight:700, cursor:'pointer', border:'0.5px solid #EF9F2750'}}>
                      ⚠ {isAr?'الشهادة بانتظار التحرير':'Certificat à éditer'}
                    </div>
                  )}
                </div>
                {/* Score + date */}
                <div style={{textAlign:'center', flexShrink:0, minWidth:80}}>
                  <div style={{fontSize:22, fontWeight:800, color:ok?'#1D9E75':'#E24B4A'}}>
                    {r.score}%
                  </div>
                  <div style={{fontSize:10, color:'#aaa', marginTop:2}}>
                    {new Date(r.date_examen||r.created_at).toLocaleDateString(isAr?'ar-MA':'fr-FR')}
                  </div>
                </div>
                {/* B2 — Action unifiée : Éditer le certificat (redirige vers menu Certificats) */}
                {ok && (
                  <div style={{display:'flex', gap:6, flexShrink:0}}>
                    <button onClick={()=>voirCertificat(r)}
                      title={isAr?'تحرير الشهادة':'Éditer le certificat'}
                      style={{padding:'7px 14px', borderRadius:20, border:'none',
                        background: certExiste ? '#085041' : '#EF9F27',
                        color:'#fff', fontSize:11, fontWeight:600,
                        cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                        display:'flex', alignItems:'center', gap:5}}>
                      ✏️ {isAr ? (certExiste?'تحرير':'إصدار')
                                : (certExiste?'Éditer cert.':'Émettre cert.')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── RENDU ──────────────────────────────────────────────────────
  const exportResultatsExcel = async () => {
    if (!window.XLSX) {
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', lang==='ar'?'الطالب':'Élève', lang==='ar'?'المستوى':'Niveau',
       lang==='ar'?'الامتحان':'Examen', lang==='ar'?'النتيجة':'Score',
       lang==='ar'?'الحالة':'Statut', lang==='ar'?'التاريخ':'Date'],
      ...resultats.map((r,i) => {
        const el = eleves.find(e=>e.id===r.eleve_id);
        const ex = examens.find(e=>e.id===r.examen_id);
        return [i+1, el?el.prenom+' '+el.nom:'—', el?.code_niveau||'—',
          ex?.nom||'—', r.score||0,
          r.statut==='reussi'?(lang==='ar'?'ناجح':'Réussi'):r.statut==='echoue'?(lang==='ar'?'راسب':'Échoué'):(lang==='ar'?'معلق':'En cours'),
          r.date_examen?new Date(r.date_examen).toLocaleDateString('fr-FR'):'—'];
      })
    ]);
    ws['!cols']=[{wch:4},{wch:20},{wch:10},{wch:20},{wch:8},{wch:10},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'النتائج':'Résultats');
    XLSX.writeFile(wb, 'resultats_examens_'+new Date().toISOString().split('T')[0]+'.xlsx');
  };

  // Export PDF global de la liste des résultats
  const exportResultatsPDF = async () => {
    if (!resultats || resultats.length === 0) {
      toast.info(lang==='ar'?'لا توجد نتائج للتصدير':'Aucun résultat à exporter');
      return;
    }
    // Couleurs des niveaux (fallback)
    const fallbackCouleurs = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'};
    // Map des niveaux dynamiques si disponibles (par ex. state niveaux)
    const niveauCouleur = (code) => {
      // Si 'niveaux' ou 'niveauxDyn' existe dans le scope, on l'utilise
      // Sinon, fallback sur la map standard
      return fallbackCouleurs[code] || '#888';
    };

    const rows = resultats.map(r => {
      const el = eleves.find(e => e.id === r.eleve_id);
      const ex = examens.find(e => e.id === r.examen_id);
      return {
        eleve_nom: el ? `${el.prenom} ${el.nom}` : '—',
        code_niveau: el?.code_niveau || '—',
        niveau_couleur: niveauCouleur(el?.code_niveau),
        examen_nom: ex?.nom || '—',
        score: r.score || 0,
        statut: r.statut === 'reussi' ? 'reussi' : r.statut === 'echoue' ? 'echoue' : 'encours',
        date: r.date_examen
          ? new Date(r.date_examen).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')
          : '—',
      };
    });

    const nbReussis = resultats.filter(r => r.statut === 'reussi').length;
    const nbEchoues = resultats.filter(r => r.statut === 'echoue').length;
    const nbEnCours = resultats.filter(r => r.statut !== 'reussi' && r.statut !== 'echoue').length;
    const scoresValides = resultats.filter(r => r.score && r.score > 0).map(r => r.score);
    const moyenneScore = scoresValides.length > 0
      ? Math.round(scoresValides.reduce((s, v) => s + v, 0) / scoresValides.length)
      : 0;

    try {
      await openPDF('rapport_examens', {
        ecole: { nom: user?.ecole_nom || '' },
        stats: { nbReussis, nbEchoues, nbEnCours, moyenneScore },
        rows,
      }, lang);
    } catch (err) {
      toast.error('Erreur PDF : ' + err.message);
    }
  };

  const Header = () => {
    // Desktop : PageHeader harmonisé (Phase C)
    if (!isMobile) {
      return (
        <PageHeader
          title="Résultats des examens"
          titleAr="نتائج الامتحانات"
          icon="🏅"
          onBack={() => goBack ? goBack() : navigate('dashboard')}
          lang={lang}
          actions={
            <ExportButtons
              onPDF={exportResultatsPDF}
              onExcel={exportResultatsExcel}
              lang={lang}
              variant="inline"
              compact
            />
          }
        />
      );
    }
    // Mobile : header existant inchangé (Phase E à venir)
    return (
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap',justifyContent:'space-between'}}>
        <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link" style={{marginBottom:0}}>
          ←
        </button>
        <div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>
          🏅 {lang==='ar'?'نتائج الامتحانات':'Résultats'}
        </div>
      </div>
    );
  };

  // Modale post-examen — partagee mobile + desktop
  const certifsModalJSX = showCertifsModal && (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9999,
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={()=>setShowCertifsModal(null)}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:'#fff',borderRadius:16,maxWidth:520,width:'100%',padding:24,
          boxShadow:'0 20px 60px rgba(0,0,0,0.3)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{textAlign:'center',marginBottom:18}}>
          <div style={{fontSize:48,marginBottom:8}}>🎉</div>
          <div style={{fontSize:18,fontWeight:800,color:'#085041',marginBottom:4}}>
            {lang==='ar'?'تهانينا!':'Bravo !'}
          </div>
          <div style={{fontSize:13,color:'#666'}}>
            {lang==='ar'
              ? `حصل ${showCertifsModal.eleve?.prenom||''} ${showCertifsModal.eleve?.nom||''} على ${showCertifsModal.certs.length} ${showCertifsModal.certs.length===1?'شهادة':'شهادات'}`
              : `${showCertifsModal.eleve?.prenom||''} ${showCertifsModal.eleve?.nom||''} a obtenu ${showCertifsModal.certs.length} certificat${showCertifsModal.certs.length>1?'s':''}`}
          </div>
        </div>
        <div style={{maxHeight:240,overflowY:'auto',marginBottom:16}}>
          {showCertifsModal.certs.map((c, i)=>(
            <div key={c.id||i} style={{
              background:'#FFF8EC',border:'1px solid #FFE0B5',borderRadius:10,
              padding:'12px 14px',marginBottom:8,display:'flex',alignItems:'center',gap:10
            }}>
              <div style={{fontSize:24,flexShrink:0}}>🏅</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:'#7B5800'}}>
                  {lang==='ar'?(c.nom_certificat_ar||c.nom_certificat):(c.nom_certificat||c.nom_certificat_ar)}
                </div>
                <div style={{fontSize:11,color:'#a87f33',marginTop:2}}>
                  {c.examen_id_source
                    ? (lang==='ar'?'شهادة تلقائية بعد الامتحان':'Certificat automatique post-examen')
                    : (lang==='ar'?'شهادة مرحلة (مكونة)':'Jalon configuré')}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setShowCertifsModal(null)}
            style={{flex:1,padding:'12px',background:'#f5f5f0',color:'#666',border:'none',
              borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            {lang==='ar'?'لاحقًا':'Plus tard'}
          </button>
          <button onClick={()=>{
            const firstCertId = showCertifsModal.certs[0]?.id;
            setShowCertifsModal(null);
            navigate('liste_certificats', null, { focusCertId: firstCertId });
          }}
            style={{flex:2,padding:'12px',background:'linear-gradient(135deg,#1D9E75,#085041)',
              color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,
              cursor:'pointer',fontFamily:'inherit',boxShadow:'0 2px 8px rgba(8,80,65,0.3)'}}>
            ✏️ {lang==='ar'?'تحرير الآن ←':'Éditer maintenant →'}
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100}}>
          <Header/>
          <Tabs/>
        </div>
        <div style={{padding:'12px'}}>
          {loading
            ? <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.75)'}}>...</div>
            : activeTab==='saisir' ? tabSaisirJSX : tabRegistreJSX}
        </div>
      </div>
      {certifsModalJSX}
      </>
    );
  }

  return (
    <>
    <div>
      <Header/>
      <Tabs/>
      {loading
        ? <div style={{textAlign:'center',padding:'2rem',color:'rgba(255,255,255,0.75)'}}>...</div>
        : activeTab==='saisir' ? tabSaisirJSX : tabRegistreJSX}
    </div>
    {certifsModalJSX}
    </>
  );
}
