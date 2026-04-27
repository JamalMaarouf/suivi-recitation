import React, { useState, useEffect } from 'react';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { getInitiales, joursDepuis, scoreLabel, formatDateCourt , loadBareme, BAREME_DEFAUT, getSensForEleve, calcEtatEleve } from '../lib/helpers';
import { swr } from '../lib/offlineCache';
import { getSouratesForNiveau } from '../lib/sourates';
import { t } from '../lib/i18n';
import OngletCoursEleve from '../components/OngletCoursEleve';
import { trackParentVisite, getDerniereVisiteParent } from '../lib/parentTracking';
import { generateRgpdExport, downloadRgpdExport } from '../lib/rgpdExport';
import { fetchNotificationsParent, marquerToutesLues, marquerLue, fetchPreferences, updatePreferences } from '../lib/notificationsParents';

const IS_SOURATE = (code) => ['5B','5A','2M'].includes(code||'');
const NIVEAU_COLORS = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'};
const NIVEAUX_LABELS = {'5B':'Préscolaire','5A':'Primaire 1-2','2M':'Primaire 3-4','2':'Primaire 5-6','1':'Collège/Lycée'};

function Avatar({ prenom, nom, size=40, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:size*0.35,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

function NiveauBadge({ code }) {
  const c = NIVEAU_COLORS[code||'1']||'#888';
  return <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:c+'18',color:c,border:'0.5px solid '+c+'30'}}>{code}</span>;
}

export default function PortailParent({ parent, navigate, goBack, lang='fr', onLogout, isMobile }) {
  const { toast } = useToast();
  const [enfants, setEnfants] = useState([]);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [validations, setValidations] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [objectifs, setObjectifs] = useState([]);
  const [cotisations, setCotisations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [niveauxEcole, setNiveauxEcole] = useState([]);
  const [ecoleConfig, setEcoleConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cacheAge, setCacheAge] = useState(null); // null = données fraîches, sinon âge en ms
  const [bareme, setBareme] = React.useState({...BAREME_DEFAUT});
  const [onglet, setOnglet] = useState('progression');
  const [showChangeMdp, setShowChangeMdp] = useState(false);
  // RGPD (itération 4.3) : modale d'info + état loading pour l'export
  const [showRgpdModal, setShowRgpdModal] = useState(false);
  const [rgpdLoading, setRgpdLoading] = useState(false);
  // P2.2 : historique des exports RGPD du parent lui-même
  const [rgpdHistorique, setRgpdHistorique] = useState([]);
  // Notifications parents (A.1)
  const [showNotifsPanel, setShowNotifsPanel] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifsNonLues, setNotifsNonLues] = useState(0);
  const [showPrefsNotifs, setShowPrefsNotifs] = useState(false);
  const [prefsNotifs, setPrefsNotifs] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [emailParent, setEmailParent] = useState(parent.email || '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const changerMotDePasse = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) return toast.error(lang==='ar'?'يرجى ملء جميع الحقول':'Remplissez tous les champs');
    if (newPwd !== confirmPwd) return toast.error(lang==='ar'?'كلمتا المرور غير متطابقتين':'Les mots de passe ne correspondent pas');
    if (newPwd.length < 4) return toast.error(lang==='ar'?'كلمة المرور قصيرة جداً':'Mot de passe trop court');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', user_id: parent.id, old_password: oldPwd, new_password: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || 'Erreur');
      toast.success(lang==='ar'?'✅ تم تغيير كلمة المرور':'✅ Mot de passe modifié');
      setShowChangeMdp(false); setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch(e) { toast.error('Erreur réseau'); }
  };

  // ─── RGPD : export JSON des données personnelles (art. 20) ────
  // Scope parent = 'self_plus_children' (ses données + celles de ses enfants)
  // Le helper journalise automatiquement dans exports_rgpd (audit).
  const handleRgpdExport = async () => {
    setRgpdLoading(true);
    try {
      const { json, stats, fileName } = await generateRgpdExport(
        parent,
        'self_plus_children'
      );
      downloadRgpdExport(json, fileName);
      toast.success(
        lang==='ar'
          ? `✅ تم تحميل ملف (${stats.nb_enfants} طفل، ${stats.nb_validations} استظهار)`
          : `✅ Fichier téléchargé (${stats.nb_enfants} enfant(s), ${stats.nb_validations} validation(s))`
      );
      setShowRgpdModal(false);
      // Recharger l'historique pour voir le nouvel export
      loadRgpdHistorique();
    } catch (err) {
      console.error('[RGPD] Export error:', err);
      toast.error((lang==='ar'?'خطأ : ':'Erreur : ') + (err.message || 'unknown'));
    }
    setRgpdLoading(false);
  };

  // ─── P2.2 : Charger l'historique des exports du parent ────────
  const loadRgpdHistorique = async () => {
    if (!parent?.id) return;
    try {
      const { data } = await supabase
        .from('exports_rgpd')
        .select('id,exported_at,export_scope,nb_enfants,nb_validations,nb_certificats,file_size_bytes')
        .eq('user_id', parent.id)
        .order('exported_at', { ascending: false })
        .limit(20);
      setRgpdHistorique(data || []);
    } catch (err) {
      console.warn('[RGPD historique] load error:', err);
    }
  };

  // Charger l'historique chaque fois qu'on ouvre la modale
  useEffect(() => {
    if (showRgpdModal) loadRgpdHistorique();
    // eslint-disable-next-line
  }, [showRgpdModal]);

  // ─── A.1 : Notifications parents — chargement & actions ───────
  const loadNotifs = async () => {
    if (!parent?.id) return;
    const { data, nonLues } = await fetchNotificationsParent(parent.id, 20);
    setNotifs(data);
    setNotifsNonLues(nonLues);
  };

  const handleOpenNotifsPanel = async () => {
    setShowNotifsPanel(true);
    await loadNotifs();
  };

  const handleMarkAllRead = async () => {
    await marquerToutesLues(parent.id);
    await loadNotifs();
  };

  const handleClickNotif = async (notif) => {
    if (!notif.lue) {
      await marquerLue(notif.id);
      await loadNotifs();
    }
    // Naviguer vers l'enfant concerné si applicable
    if (notif.eleve_id) {
      const enfantConcerne = enfants.find(e => e.id === notif.eleve_id);
      if (enfantConcerne) {
        setSelectedEnfant(enfantConcerne);
        setShowNotifsPanel(false);
      }
    }
  };

  const loadPrefsNotifs = async () => {
    if (!parent?.id) return;
    const p = await fetchPreferences(parent.id);
    setPrefsNotifs(p);
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    const { success } = await updatePreferences(parent.id, prefsNotifs);
    setSavingPrefs(false);
    if (success) {
      toast.success(lang === 'ar' ? '✅ تم حفظ التفضيلات' : '✅ Préférences enregistrées');
      setShowPrefsNotifs(false);
    } else {
      toast.error(lang === 'ar' ? 'خطأ' : 'Erreur');
    }
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    const email = emailParent.trim() || null;
    // Validation basique
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(lang === 'ar' ? 'عنوان بريد غير صحيح' : 'Email invalide');
      setSavingEmail(false);
      return;
    }
    const { error } = await supabase
      .from('utilisateurs')
      .update({ email })
      .eq('id', parent.id);
    setSavingEmail(false);
    if (error) {
      toast.error(lang === 'ar' ? 'خطأ في الحفظ' : 'Erreur de sauvegarde');
    } else {
      toast.success(lang === 'ar' ? '✅ تم الحفظ' : '✅ Email enregistré');
    }
  };

  // Charger notifs au montage et toutes les 60s
  useEffect(() => {
    if (!parent?.id) return;
    loadNotifs();
    const interval = setInterval(loadNotifs, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [parent?.id]);

  // Charger préférences quand modale s'ouvre
  useEffect(() => {
    if (showPrefsNotifs) loadPrefsNotifs();
    // eslint-disable-next-line
  }, [showPrefsNotifs]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (enfants.length>0 && !selectedEnfant) setSelectedEnfant(enfants[0]); }, [enfants]);

  // ─── TRACKING DES VISITES PARENT ─────────────────────────────
  // Se déclenche à chaque fois que le parent change d'enfant ou d'onglet.
  // Non bloquant : l'UX du parent n'est jamais impactée par une erreur.
  const [derniereVisite, setDerniereVisite] = useState(null);
  useEffect(() => {
    if (!selectedEnfant?.id || !parent?.id || !parent?.ecole_id) return;
    trackParentVisite(parent.id, selectedEnfant.id, parent.ecole_id, onglet);
    // eslint-disable-next-line
  }, [selectedEnfant?.id, onglet]);
  // Charger la dernière visite quand on change d'enfant (pour affichage)
  useEffect(() => {
    if (!selectedEnfant?.id || !parent?.id) { setDerniereVisite(null); return; }
    getDerniereVisiteParent(parent.id, selectedEnfant.id).then(setDerniereVisite);
    // eslint-disable-next-line
  }, [selectedEnfant?.id]);

  const loadData = async () => {
    loadBareme(supabase, parent.ecole_id).then(b=>setBareme({...BAREME_DEFAUT,...b.unites}));
    setLoading(true);
    const ecoleId = parent.ecole_id;
    const parentId = parent.id;

    try {
      // 1) Charger les enfants liés avec SWR
      let elevesData = [];
      await swr(
        `pp_links_${parentId}`,
        () => supabase.from('parent_eleve').select('eleve_id, eleve:eleve_id(*)').eq('parent_id', parentId),
        (data, meta) => {
          if (data) {
            elevesData = (data||[]).map(l => l.eleve).filter(Boolean);
            setEnfants(elevesData);
            if (meta?.fromCache && meta?.age_ms) setCacheAge(meta.age_ms);
            else if (!meta?.fromCache) setCacheAge(null);
          }
        }
      ).catch(() => {});

      if (elevesData.length > 0) {
        const ids = elevesData.map(e => e.id);
        const idsKey = ids.sort().join('_').substring(0, 100); // clé unique par combinaison d'enfants

        // 2) Charger toutes les données enfants en parallèle avec SWR
        await Promise.all([
          swr(
            `pp_validations_${idsKey}`,
            () => supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').in('eleve_id', ids).order('date_validation',{ascending:false}),
            (data) => { if (data) setValidations(data); }
          ).catch(()=>{}),
          swr(
            `pp_recitations_${idsKey}`,
            () => supabase.from('recitations_sourates').select('*, valideur:valide_par(prenom,nom)').in('eleve_id', ids).order('date_validation',{ascending:false}),
            (data) => { if (data) setRecitations(data); }
          ).catch(()=>{}),
          swr(
            `pp_objectifs`,
            () => supabase.from('objectifs_globaux').select('*').limit(100),
            (data) => { if (data) setObjectifs(data); }
          ).catch(()=>{}),
          swr(
            `pp_cotisations_${idsKey}`,
            () => supabase.from('cotisations').select('*').in('eleve_id', ids).order('date_paiement',{ascending:false}),
            (data) => { if (data) setCotisations(data); }
          ).catch(()=>{}),
          swr(
            `pp_sourates`,
            () => supabase.from('sourates').select('*'),
            (data) => { if (data) setSouratesDB(data); }
          ).catch(()=>{}),
          swr(
            `pp_niveaux_${ecoleId}`,
            () => supabase.from('niveaux').select('id,code,sens_recitation').eq('ecole_id', ecoleId),
            (data) => { if (data) setNiveauxEcole(data); }
          ).catch(()=>{}),
          swr(
            `pp_ecole_${ecoleId}`,
            () => supabase.from('ecoles').select('sens_recitation_defaut').eq('id', ecoleId).maybeSingle(),
            (data) => { if (data) setEcoleConfig(data); }
          ).catch(()=>{}),
        ]);
      }
    } catch(e) {
      console.error('[PortailParent] Erreur chargement:', e);
      // Pas de toast.error : en offline c'est normal que ça échoue, les données du cache sont déjà affichées
    }
    setLoading(false);
  };

  if (loading) return <div className="loading">...</div>;
  if (enfants.length === 0) return (
    <div style={{padding:'3rem',textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:'1rem'}}>👶</div>
      <div style={{fontSize:15,color:'#888',marginBottom:'1.5rem'}}>{lang==='ar'?'لا يوجد طلاب مرتبطون بحسابك':'Aucun enfant lié à votre compte'}</div>
      <button onClick={onLogout} style={{padding:'10px 24px',borderRadius:10,background:'#E24B4A',color:'#fff',border:'none',cursor:'pointer',fontWeight:600,fontSize:14}}>
        🚪 {lang==='ar'?'تسجيل الخروج':'Déconnexion'}
      </button>
    </div>
  );

  const eleve = selectedEnfant;
  if (!eleve) return null;

  const isSourate = IS_SOURATE(eleve?.code_niveau||'');
  const nc = NIVEAU_COLORS[eleve?.code_niveau||'1']||'#888';
  const sl = scoreLabel(0);

  // Stats pour l'élève sélectionné
  const vE = validations.filter(v=>v.eleve_id===eleve.id);
  const rE = recitations.filter(r=>r.eleve_id===eleve.id);
  const cotE = cotisations.filter(c=>c.eleve_id===eleve.id);

  // Générer les mois manquants comme impayés virtuels
  const cotEAvecManquants = (() => {
    if (!eleve) return cotE;
    const debut = new Date(eleve.created_at || '2024-09-01');
    debut.setDate(1); debut.setHours(0,0,0,0);
    const fin = new Date(); fin.setDate(1); fin.setHours(0,0,0,0);
    const moisExistants = new Set(cotE.map(c => c.periode || c.mois_concerne || ''));
    const result = [...cotE];
    const d = new Date(debut);
    while (d <= fin) {
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR', {month:'long', year:'numeric'});
      if (!moisExistants.has(key) && !moisExistants.has(label)) {
        result.push({ id:'virtual_'+key, eleve_id: eleve.id, statut:'non_paye', montant:0, periode:key, mois_concerne:key, date_paiement:null, note:null, _virtuel:true });
      }
      d.setMonth(d.getMonth()+1);
    }
    return result.sort((a,b) => (b.periode||'').localeCompare(a.periode||''));
  })();

  const tomon = vE.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
  const hizb = vE.filter(v=>v.type_validation==='hizb_complet').length;
  const souratesCompletes = rE.filter(r=>r.type_recitation==='complete').length;
  const sequences = rE.filter(r=>r.type_recitation==='sequence').length;
  const pts = tomon*(bareme.tomon || 0)+hizb*(bareme.hizb_complet || 0)+rE.reduce((s,r)=>s+(r.points||0),0);

  // Dernière activité
  const allActivity = [...vE,...rE].sort((a,b)=>new Date(b.date_validation)-new Date(a.date_validation));
  const derniere = allActivity[0]?.date_validation||null;
  const joursInactif = joursDepuis(derniere);

  // Activité 7 derniers jours
  const debutSemaine = new Date(); debutSemaine.setDate(debutSemaine.getDate()-7);
  const actifSemaine = allActivity.filter(x=>new Date(x.date_validation)>=debutSemaine).length;

  // Objectifs actifs pour cet élève
  const now = new Date();
  const objActifs = objectifs.filter(o => {
    const debut = new Date(o.date_debut); const fin = new Date(o.date_fin);
    if (now < debut || now > fin) return false;
    if (o.type_cible==='eleve') return o.eleve_id===eleve.id;
    if (o.type_cible==='niveau') return o.code_niveau===(eleve.code_niveau||'1');
    return false;
  });

  // Sourate actuelle
  let sourateActuelle = null;
  if (isSourate) {
    const souratesNiveau = getSouratesForNiveau(eleve.code_niveau);
    const sorted = [...souratesNiveau].sort((a,b)=>b.numero-a.numero);
    const souratesAcq = parseInt(eleve.sourates_acquises)||0;
    const souratesCompletesSet = new Set(rE.filter(r=>r.type_recitation==='complete').map(r=>r.sourate_id));
    const idx = sorted.findIndex((s,i) => {
      if (i < souratesAcq) return false;
      const dbS = souratesDB.find(x=>x.numero===s.numero);
      return dbS ? !souratesCompletesSet.has(dbS.id) : false;
    });
    sourateActuelle = idx >= 0 ? sorted[idx] : null;
  }

  const onglets = [
    { key:'progression', label:'Progression',     labelAr:'التقدم',        icon:'📈' },
    { key:'recitations', label:'Récitations',      labelAr:'الاستظهارات',     icon:'📖' },
    { key:'cours',       label:'Cours',            labelAr:'الدروس',         icon:'📚' },
    { key:'objectifs',   label:'Objectifs',        labelAr:'الأهداف',       icon:'🎯' },
    { key:'cotisations', label:'Cotisations',      labelAr:'الاشتراكات',    icon:'💰' },
  ];

  if (isMobile) {
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        {/* Mobile header */}
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)', padding:'48px 16px 20px', position:'sticky', top:0, zIndex:100}}>
          {/* Barre d'actions mobile : notifs + MDP + RGPD + logout */}
          <div style={{display:'flex',gap:6,justifyContent:'flex-end',marginBottom:10,flexWrap:'wrap'}}>
            <button onClick={handleOpenNotifsPanel}
              title={lang==='ar'?'الإشعارات':'Notifications'}
              style={{position:'relative',padding:'6px 10px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,fontSize:13,cursor:'pointer'}}>
              🔔
              {notifsNonLues > 0 && (
                <span style={{position:'absolute',top:-5,right:-5,minWidth:18,height:18,padding:'0 5px',background:'#E24B4A',color:'#fff',borderRadius:9,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #085041'}}>
                  {notifsNonLues > 9 ? '9+' : notifsNonLues}
                </span>
              )}
            </button>
            <button onClick={()=>setShowChangeMdp(v=>!v)}
              title={lang==='ar'?'كلمة المرور':'Mot de passe'}
              style={{padding:'6px 10px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,fontSize:13,cursor:'pointer'}}>
              🔑
            </button>
            <button onClick={()=>setShowRgpdModal(true)}
              title={lang==='ar'?'بياناتي':'Mes données'}
              style={{padding:'6px 10px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,fontSize:13,cursor:'pointer'}}>
              📦
            </button>
            <button onClick={onLogout}
              title={lang==='ar'?'تسجيل الخروج':'Déconnexion'}
              style={{padding:'6px 10px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,fontSize:13,cursor:'pointer'}}>
              🚪
            </button>
          </div>

          <div style={{fontSize:13, color:'rgba(255,255,255,0.8)', marginBottom:4}}>
            {lang==='ar'?'مرحباً':'Bonjour'}, <strong>{parent.prenom} {parent.nom}</strong>
          </div>
          {/* Bandeau discret : dernière visite + message inspirant */}
          {derniereVisite !== null && (
            <BannerDerniereVisite derniereVisite={derniereVisite} lang={lang} mobile />
          )}
          {/* Child selector */}
          {enfants.length > 1 && (
            <div style={{display:'flex', gap:8, overflowX:'auto', marginTop:10, scrollbarWidth:'none'}}>
              {enfants.map(e=>(
                <div key={e.id} onClick={()=>{setSelectedEnfant(e);setOnglet('progression');}}
                  style={{display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:20,
                    flexShrink:0, cursor:'pointer',
                    background: selectedEnfant?.id===e.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                    border: `1.5px solid ${selectedEnfant?.id===e.id ? '#fff' : 'rgba(255,255,255,0.2)'}`}}>
                  <span style={{fontSize:14, color:'#fff', fontWeight:700}}>{e.prenom}</span>
                </div>
              ))}
            </div>
          )}
          {/* Enfant sélectionné */}
          {eleve && (
            <div style={{marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontSize:20, fontWeight:800, color:'#fff'}}>{eleve.prenom} {eleve.nom}</div>
                <div style={{fontSize:13, color:'rgba(255,255,255,0.8)', marginTop:2}}>
                  {NIVEAUX_LABELS[eleve.code_niveau] || eleve.code_niveau}
                </div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:32, fontWeight:800, color:'#fff'}}>{pts.toLocaleString()}</div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.7)'}}>points</div>
              </div>
            </div>
          )}
          {/* Onglets */}
          <div style={{display:'flex', gap:0, marginTop:14, background:'rgba(0,0,0,0.2)', borderRadius:10, padding:3}}>
            {onglets.map(o=>(
              <div key={o.key} onClick={()=>setOnglet(o.key)}
                style={{flex:1, padding:'8px 4px', borderRadius:8, textAlign:'center', fontSize:11, fontWeight:600,
                  cursor:'pointer', background:onglet===o.key?'rgba(255,255,255,0.25)':'transparent',
                  color:'#fff'}}>
                {o.icon}
              </div>
            ))}
          </div>
        </div>

        {loading ? <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div> : (
          <div style={{padding:'12px'}}>
            {/* Progression */}
            {/* Bandeau alerte mobile */}
            {cotEAvecManquants.filter(x=>x.statut==='non_paye'||x.statut==='partiel').length > 0 && (
              <div onClick={()=>setOnglet('cotisations')} style={{background:'#FCEBEB',border:'2px solid #E24B4A',borderRadius:12,padding:'12px',marginBottom:8,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:22}}>🔴</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#E24B4A'}}>{lang==='ar'?'اشتراكات غير مدفوعة':'Cotisations impayées'}</div>
                  <div style={{fontSize:11,color:'#E24B4A',opacity:0.8}}>{cotEAvecManquants.filter(x=>x.statut==='non_paye'||x.statut==='partiel').length} {lang==='ar'?'شهر — انقر للتفاصيل':'mois — Voir détail'}</div>
                </div>
                <span style={{color:'#E24B4A'}}>←</span>
              </div>
            )}
            {onglet==='progression' && pts && (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:12}}>
                  {[
                    {label:lang==='ar'?'الثُّمنات':'Tomon validés',val:tomon,color:'#1D9E75',bg:'#E1F5EE'},
                    {label:lang==='ar'?'الأحزاب':'Hizb complets',val:hizb,color:'#534AB7',bg:'#F0EEFF'},
                    {label:lang==='ar'?'السور':'Sourates',val:souratesCompletes,color:'#378ADD',bg:'#E6F1FB'},
                    {label:lang==='ar'?'النقاط':'Points',val:pts.toLocaleString(),color:'#EF9F27',bg:'#FAEEDA'},
                  ].map((k,i)=>(
                    <div key={i} style={{background:k.bg,borderRadius:12,padding:'14px',textAlign:'center',border:`0.5px solid ${k.color}20`}}>
                      <div style={{fontSize:24,fontWeight:800,color:k.color}}>{k.val}</div>
                      <div style={{fontSize:11,color:k.color,marginTop:4,opacity:0.8}}>{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Récitations */}
            {onglet==='recitations' && (
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#888',marginBottom:8}}>
                  {lang==='ar'?'آخر الاستظهارات':'Dernières récitations'}
                </div>
                {validations.slice(0,20).map(v=>(
                  <div key={v.id} style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,
                    border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:'#1D9E75',flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13}}>
                        {v.type_validation==='hizb_complet'?'Hizb complet':`T.${v.tomon_debut} ×${v.nombre_tomon}`}
                      </div>
                      <div style={{fontSize:11,color:'#888'}}>{new Date(v.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</div>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:'#1D9E75'}}>+{v.type_validation==='hizb_complet'?(bareme.hizb_complet || 0):v.nombre_tomon*(bareme.tomon || 0)} pts</span>
                  </div>
                ))}
                {validations.length===0&&<div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>Aucune récitation</div>}
              </div>
            )}
            {/* Cotisations */}
            {onglet==='cotisations' && (
              <div>

                {cotEAvecManquants.map(cot=>{
                  const STATUTS={paye:{ic:'✅',color:'#1D9E75',bg:'#E1F5EE',lbl:'Payé',lblAr:'مدفوع'},partiel:{ic:'⚠️',color:'#EF9F27',bg:'#FAEEDA',lbl:'Partiel',lblAr:'جزئي'},non_paye:{ic:'❌',color:'#E24B4A',bg:'#FCEBEB',lbl:'Non payé',lblAr:'غير مدفوع'},exonere:{ic:'🎁',color:'#888',bg:'#f5f5f0',lbl:'Exonéré',lblAr:'معفى'}};
                  const st=STATUTS[cot.statut]||STATUTS.paye;
                  return(
                  <div key={cot.id} style={{background:st.bg,borderRadius:12,padding:'12px 14px',marginBottom:8,border:`1.5px solid ${st.color}30`,display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:20}}>{st.ic}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:st.color}}>{cot.periode||cot.mois_concerne||'—'}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>{cot.date_paiement?new Date(cot.date_paiement).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR'):'—'}{cot.note?' · '+cot.note:''}</div>
                    </div>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:15,fontWeight:800,color:st.color}}>{parseFloat(cot.montant||0).toLocaleString()} MAD</div>
                      <div style={{fontSize:10,padding:'2px 6px',borderRadius:8,background:st.color+'20',color:st.color,fontWeight:600,textAlign:'center',marginTop:2}}>{lang==='ar'?st.lblAr:st.lbl}</div>
                    </div>
                  </div>
                );})}
                {cotEAvecManquants.length===0&&<div style={{textAlign:'center',color:'#aaa',padding:'2rem',fontSize:13}}>{lang==='ar'?'لا توجد اشتراكات مسجلة':'Aucune cotisation enregistrée'}</div>}
              </div>
            )}
            {/* Objectifs */}
            {onglet==='objectifs' && (
              <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>
                {lang==='ar'?'الأهداف قريباً':'Objectifs bientôt disponibles'}
              </div>
            )}
            {/* Cours */}
            {onglet==='cours' && selectedEnfant && (
              <OngletCoursEleve eleve={selectedEnfant} lang={lang} isMobile={true} />
            )}
          </div>
        )}

        {/* ═══ OVERLAYS MOBILE — plein écran en bottom sheet ═══ */}

        {/* Panneau notifications mobile */}
        {showNotifsPanel && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'flex-end'}}
            onClick={()=>setShowNotifsPanel(false)}>
            <div onClick={e=>e.stopPropagation()}
              style={{width:'100%',maxHeight:'85vh',background:'#fff',borderRadius:'18px 18px 0 0',padding:'16px',overflow:'auto'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <div style={{fontSize:16,fontWeight:700,color:'#173404'}}>
                  🔔 {lang==='ar'?'الإشعارات':'Notifications'}
                  {notifsNonLues > 0 && (
                    <span style={{marginLeft:8,fontSize:11,background:'#E24B4A',color:'#fff',padding:'2px 8px',borderRadius:10}}>
                      {notifsNonLues}
                    </span>
                  )}
                </div>
                <div style={{display:'flex',gap:6}}>
                  {notifsNonLues > 0 && (
                    <button onClick={handleMarkAllRead}
                      style={{padding:'6px 12px',background:'#E1F5EE',color:'#1D9E75',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      ✓ {lang==='ar'?'الكل':'Tout lire'}
                    </button>
                  )}
                  <button onClick={()=>setShowPrefsNotifs(true)}
                    style={{padding:'6px 10px',background:'#f5f5f0',border:'none',borderRadius:6,cursor:'pointer',fontSize:13}}>
                    ⚙️
                  </button>
                  <button onClick={()=>setShowNotifsPanel(false)}
                    style={{padding:'6px 10px',background:'#f5f5f0',border:'none',borderRadius:6,cursor:'pointer',fontSize:13}}>
                    ✕
                  </button>
                </div>
              </div>
              {notifs.length === 0 ? (
                <div style={{padding:'30px 20px',textAlign:'center',fontSize:13,color:'#888'}}>
                  {lang==='ar'?'✨ لا توجد إشعارات':'✨ Aucune notification pour le moment'}
                </div>
              ) : (
                <div>
                  {notifs.map(n => {
                    const titre = lang==='ar' ? (n.titre_ar || n.titre_fr) : n.titre_fr;
                    const corps = lang==='ar' ? (n.corps_ar || n.corps_fr) : n.corps_fr;
                    const d = new Date(n.created_at);
                    const isToday = d.toDateString() === new Date().toDateString();
                    const dateStr = isToday
                      ? d.toLocaleTimeString(lang==='ar'?'ar-MA':'fr-FR',{hour:'2-digit',minute:'2-digit'})
                      : d.toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR');
                    return (
                      <div key={n.id} onClick={()=>handleClickNotif(n)}
                        style={{padding:'12px',borderRadius:10,marginBottom:8,
                          background: n.lue ? '#f9f9f6' : '#FEF9E7',
                          border: n.lue ? '0.5px solid #e0e0d8' : '1px solid #FBBF24',
                          cursor:'pointer'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                          <div style={{fontSize:13,fontWeight: n.lue ? 500 : 700,color:'#173404',flex:1}}>{titre}</div>
                          <div style={{fontSize:10,color:'#888',flexShrink:0,marginLeft:6}}>{dateStr}</div>
                        </div>
                        <div style={{fontSize:12,color:'#444',lineHeight:1.4}}>{corps}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modale préférences notifs mobile */}
        {showPrefsNotifs && prefsNotifs && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:250,display:'flex',alignItems:'flex-end'}}
            onClick={()=>setShowPrefsNotifs(false)}>
            <div onClick={e=>e.stopPropagation()}
              style={{width:'100%',maxHeight:'85vh',background:'#fff',borderRadius:'18px 18px 0 0',padding:'16px',overflow:'auto'}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:10,color:'#173404'}}>
                ⚙️ {lang==='ar'?'تفضيلات الإشعارات':'Préférences notifications'}
              </div>
              <div style={{fontSize:11.5,color:'#666',marginBottom:14,lineHeight:1.5}}>
                {lang==='ar'
                  ? 'ستظهر الإشعارات في هذه البوابة. إذا أضفت عنوان بريد، ستتلقى نسخة أيضًا.'
                  : 'Notifications visibles dans ce portail. Ajoutez un email pour recevoir aussi une copie.'}
              </div>
              {[
                { key:'notif_hizb_complet', labelFr:'Validation d\'un Hizb', labelAr:'تأكيد حفظ حزب', icon:'🎉' },
                { key:'notif_certificat',   labelFr:'Obtention d\'un certificat', labelAr:'الحصول على شهادة', icon:'🏅' },
                { key:'notif_inactivite',   labelFr:'Alerte inactivité (>14j)', labelAr:'تنبيه عدم النشاط', icon:'⚠️' },
              ].map(t => (
                <label key={t.key} style={{display:'flex',alignItems:'center',gap:10,padding:'10px',borderRadius:8,background:'#f9f9f6',marginBottom:6,cursor:'pointer'}}>
                  <input type="checkbox"
                    checked={prefsNotifs[t.key] !== false}
                    onChange={e => setPrefsNotifs({...prefsNotifs, [t.key]: e.target.checked})}
                    style={{width:18,height:18,cursor:'pointer',accentColor:'#1D9E75'}} />
                  <span style={{fontSize:13,flex:1,color:'#173404'}}>
                    {t.icon} {lang==='ar' ? t.labelAr : t.labelFr}
                  </span>
                </label>
              ))}
              <div style={{marginTop:14,padding:12,background:'#f9f9f6',borderRadius:10}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:6,color:'#173404'}}>
                  📧 {lang==='ar'?'البريد (اختياري)':'Email (optionnel)'}
                </div>
                <div style={{fontSize:11,color:'#666',marginBottom:8,lineHeight:1.5}}>
                  {lang==='ar'?'بدون بريد، ستستمر في رؤية الإشعارات هنا.':'Sans email, les notifications restent visibles ici.'}
                </div>
                <div style={{display:'flex',gap:6,marginBottom:8}}>
                  <input type="email" value={emailParent} onChange={e=>setEmailParent(e.target.value)}
                    placeholder="parent@email.com"
                    style={{flex:1,padding:'9px 10px',borderRadius:6,border:'1px solid #e0e0d8',fontSize:13}}/>
                  <button onClick={handleSaveEmail} disabled={savingEmail}
                    style={{padding:'9px 14px',background:savingEmail?'#999':'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:savingEmail?'default':'pointer'}}>
                    {savingEmail ? '...' : 'OK'}
                  </button>
                </div>
                {emailParent && (
                  <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',color:'#173404'}}>
                    <input type="checkbox"
                      checked={prefsNotifs.canal_email !== false}
                      onChange={e => setPrefsNotifs({...prefsNotifs, canal_email: e.target.checked})}
                      style={{width:16,height:16,cursor:'pointer',accentColor:'#1D9E75'}} />
                    <span>{lang==='ar'?'تلقي نسخة بالبريد':'Recevoir aussi par email'}</span>
                  </label>
                )}
              </div>
              <div style={{display:'flex',gap:6,marginTop:14}}>
                <button onClick={handleSavePrefs} disabled={savingPrefs}
                  style={{flex:1,padding:'12px',background:savingPrefs?'#999':'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:savingPrefs?'default':'pointer',fontSize:13}}>
                  {savingPrefs ? '⏳' : (lang==='ar'?'💾 حفظ':'💾 Enregistrer')}
                </button>
                <button onClick={()=>setShowPrefsNotifs(false)} disabled={savingPrefs}
                  style={{padding:'12px 16px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:8,cursor:savingPrefs?'default':'pointer',fontSize:13}}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modale changement MDP mobile */}
        {showChangeMdp && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'flex-end'}}
            onClick={()=>setShowChangeMdp(false)}>
            <div onClick={e=>e.stopPropagation()}
              style={{width:'100%',background:'#fff',borderRadius:'18px 18px 0 0',padding:'16px'}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:'#173404'}}>
                🔑 {lang==='ar'?'تغيير كلمة المرور':'Changer le mot de passe'}
              </div>
              <input type="password" placeholder={lang==='ar'?'كلمة المرور الحالية':'Mot de passe actuel'}
                value={oldPwd} onChange={e=>setOldPwd(e.target.value)}
                style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e0e0d8',marginBottom:8,fontSize:13,boxSizing:'border-box'}}/>
              <input type="password" placeholder={lang==='ar'?'كلمة المرور الجديدة':'Nouveau mot de passe'}
                value={newPwd} onChange={e=>setNewPwd(e.target.value)}
                style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e0e0d8',marginBottom:8,fontSize:13,boxSizing:'border-box'}}/>
              <input type="password" placeholder={lang==='ar'?'تأكيد كلمة المرور':'Confirmer le mot de passe'}
                value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)}
                style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e0e0d8',marginBottom:12,fontSize:13,boxSizing:'border-box'}}/>
              <div style={{display:'flex',gap:6}}>
                <button onClick={changerMotDePasse}
                  style={{flex:1,padding:'12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:13}}>
                  {lang==='ar'?'تحديث':'Mettre à jour'}
                </button>
                <button onClick={()=>{setShowChangeMdp(false);setOldPwd('');setNewPwd('');setConfirmPwd('');}}
                  style={{padding:'12px 16px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:8,cursor:'pointer',fontSize:13}}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modale RGPD mobile */}
        {showRgpdModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,display:'flex',alignItems:'flex-end'}}
            onClick={()=>!rgpdLoading && setShowRgpdModal(false)}>
            <div onClick={e=>e.stopPropagation()}
              style={{width:'100%',maxHeight:'85vh',background:'#fff',borderRadius:'18px 18px 0 0',padding:'16px',overflow:'auto'}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:6,color:'#173404'}}>
                📦 {lang==='ar'?'تصدير بياناتي':'Exporter mes données'}
              </div>
              <div style={{fontSize:12,color:'#666',marginBottom:14,lineHeight:1.5}}>
                {lang==='ar'
                  ? 'تنزيل نسخة كاملة من بياناتك وبيانات أبنائك (JSON).'
                  : 'Télécharger une copie complète de vos données et celles de vos enfants (JSON).'}
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={handleRgpdExport} disabled={rgpdLoading}
                  style={{flex:1,padding:'12px',background:rgpdLoading?'#999':'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:rgpdLoading?'default':'pointer',fontSize:13}}>
                  {rgpdLoading
                    ? (lang==='ar'?'⏳ ...':'⏳ Génération...')
                    : (lang==='ar'?'📥 تحميل':'📥 Télécharger')}
                </button>
                <button onClick={()=>setShowRgpdModal(false)} disabled={rgpdLoading}
                  style={{padding:'12px 16px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:8,cursor:rgpdLoading?'default':'pointer',fontSize:13}}>
                  ✕
                </button>
              </div>
              {rgpdHistorique.length > 0 && (
                <div style={{marginTop:14,padding:12,background:'#f9f9f6',borderRadius:10}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:6,color:'#173404'}}>
                    📋 {lang==='ar'?'تاريخ التصديرات':'Historique des exports'}
                  </div>
                  {rgpdHistorique.slice(0,5).map(h => (
                    <div key={h.id} style={{fontSize:11,color:'#666',padding:'4px 0',borderBottom:'0.5px solid #e0e0d8'}}>
                      {new Date(h.exported_at).toLocaleString(lang==='ar'?'ar-MA':'fr-FR')}
                      {' · '}
                      {h.nb_enfants ? `${h.nb_enfants} enf.` : ''}
                      {h.nb_validations ? ` · ${h.nb_validations} val.` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header parent */}
      <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem',color:'#fff'}}>
        <div style={{fontSize:12,opacity:0.8,marginBottom:4}}>
          {lang==='ar'?'مرحباً':lang==='en'?'Welcome':'Bonjour'}, <strong>{parent.prenom} {parent.nom}</strong>
        </div>
        <div style={{fontSize:11,opacity:0.7}}>متابعة التحفيظ</div>
        {/* Bandeau : dernière visite + message inspirant */}
        {derniereVisite !== null && (
          <BannerDerniereVisite derniereVisite={derniereVisite} lang={lang} mobile={false} />
        )}
        <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
          <button onClick={()=>setShowChangeMdp(true)}
            style={{padding:'6px 16px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.4)',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            🔑 {lang==='ar'?'تغيير كلمة المرور':'Changer MDP'}
          </button>
          <button onClick={()=>setShowRgpdModal(true)}
            title={lang==='ar'?'تصدير بياناتك الشخصية وفقًا للRGPD':'Export de vos données personnelles (RGPD)'}
            style={{padding:'6px 16px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.4)',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            📦 {lang==='ar'?'بياناتي':'Mes données'}
          </button>
          <button onClick={handleOpenNotifsPanel}
            title={lang==='ar'?'الإشعارات':'Notifications'}
            style={{position:'relative',padding:'6px 16px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.4)',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            🔔 {lang==='ar'?'الإشعارات':'Notifs'}
            {notifsNonLues > 0 && (
              <span style={{position:'absolute',top:-5,right:-5,minWidth:18,height:18,padding:'0 5px',background:'#E24B4A',color:'#fff',borderRadius:9,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #085041'}}>
                {notifsNonLues > 9 ? '9+' : notifsNonLues}
              </span>
            )}
          </button>
          <button onClick={onLogout}
            style={{padding:'6px 16px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.4)',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            🚪 {lang==='ar'?'تسجيل الخروج':'Déconnexion'}
          </button>
        </div>
        {showChangeMdp && (
          <div style={{marginTop:12,background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'1rem'}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#fff'}}>🔑 {lang==='ar'?'تغيير كلمة المرور':'Changer le mot de passe'}</div>
            <input type="password" placeholder={lang==='ar'?'كلمة المرور الحالية':'Mot de passe actuel'} value={oldPwd} onChange={e=>setOldPwd(e.target.value)}
              style={{width:'100%',padding:'8px',borderRadius:6,border:'none',marginBottom:6,fontSize:13}}/>
            <input type="password" placeholder={lang==='ar'?'كلمة المرور الجديدة':'Nouveau mot de passe'} value={newPwd} onChange={e=>setNewPwd(e.target.value)}
              style={{width:'100%',padding:'8px',borderRadius:6,border:'none',marginBottom:6,fontSize:13}}/>
            <input type="password" placeholder={lang==='ar'?'تأكيد كلمة المرور':'Confirmer'} value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)}
              style={{width:'100%',padding:'8px',borderRadius:6,border:'none',marginBottom:8,fontSize:13}}/>
            <div style={{display:'flex',gap:6}}>
              <button onClick={changerMotDePasse} style={{flex:1,padding:'8px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer',fontSize:13}}>
                ✓ {lang==='ar'?'حفظ':'Enregistrer'}
              </button>
              <button onClick={()=>{setShowChangeMdp(false);setOldPwd('');setNewPwd('');setConfirmPwd('');}}
                style={{padding:'8px 12px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:13}}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Modale RGPD : info + confirmation avant téléchargement */}
        {showRgpdModal && (
          <div style={{marginTop:12,background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'1rem',fontSize:12,color:'#fff',lineHeight:1.55}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>
              📦 {lang==='ar'?'تصدير بياناتي الشخصية':'Exporter mes données personnelles'}
            </div>
            <div style={{marginBottom:10,fontSize:11.5,opacity:0.92}}>
              {lang==='ar'
                ? 'وفقاً للمادة 20 من النظام الأوروبي لحماية البيانات (RGPD) والقانون المغربي 09-08، يمكنك تحميل جميع البيانات الشخصية المتعلقة بك والمتعلقة بأبنائك، في صيغة JSON منظمة.'
                : 'Conformément à l\'article 20 du RGPD et à la loi marocaine 09-08, vous pouvez télécharger à tout moment l\'ensemble des données personnelles vous concernant ainsi que celles concernant vos enfants mineurs, dans un format JSON structuré.'}
            </div>
            <div style={{marginBottom:10,padding:'8px 10px',background:'rgba(255,255,255,0.1)',borderRadius:8,fontSize:11}}>
              <div style={{fontWeight:700,marginBottom:4}}>
                {lang==='ar'?'ما المُدرَج في هذا الملف :':'Contenu du fichier :'}
              </div>
              <div style={{opacity:0.9}}>
                • {lang==='ar'?'بيانات الاتصال الخاصة بك':'Vos données de contact'}<br/>
                • {lang==='ar'?'معلومات كل طفل من أطفالك':'Informations de chacun de vos enfants'}<br/>
                • {lang==='ar'?'جميع الاستظهارات والأحزاب المنجزة':'Toutes les validations et hizb réalisés'}<br/>
                • {lang==='ar'?'الشهادات المحصل عليها':'Certificats obtenus'}<br/>
                • {lang==='ar'?'سجل زياراتك للبوابة':'Historique de vos consultations'}
              </div>
            </div>
            <div style={{fontSize:10.5,opacity:0.75,marginBottom:12,fontStyle:'italic'}}>
              🔒 {lang==='ar'
                ? 'سيتم تسجيل هذا التصدير في سجل المراجعة (قانون إلزامي).'
                : 'Ce téléchargement sera journalisé dans le registre d\'audit (obligation légale).'}
            </div>

            {/* P2.2 : Historique de mes exports (transparence) */}
            {rgpdHistorique.length > 0 && (
              <div style={{marginBottom:12,padding:'8px 10px',background:'rgba(0,0,0,0.15)',borderRadius:8}}>
                <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>
                  📋 {lang==='ar'?'تاريخ تصديراتك':'Historique de vos exports'}
                </div>
                <div style={{maxHeight:110,overflowY:'auto',fontSize:10,opacity:0.92,lineHeight:1.6}}>
                  {rgpdHistorique.slice(0, 10).map((h, i) => {
                    const d = new Date(h.exported_at);
                    const dateStr = d.toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')
                      + ' ' + d.toLocaleTimeString(lang==='ar'?'ar-MA':'fr-FR',{hour:'2-digit',minute:'2-digit'});
                    return (
                      <div key={h.id} style={{display:'flex',justifyContent:'space-between',padding:'2px 0',borderTop:i===0?'none':'0.5px solid rgba(255,255,255,0.15)'}}>
                        <span>{dateStr}</span>
                        <span style={{opacity:0.8}}>
                          {h.nb_enfants > 0 && `${h.nb_enfants}👤 `}
                          {h.nb_validations > 0 && `${h.nb_validations}⭐`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {rgpdHistorique.length > 10 && (
                  <div style={{fontSize:9,opacity:0.65,marginTop:4,fontStyle:'italic'}}>
                    {lang==='ar'?`+${rgpdHistorique.length - 10} قديمة`:`+${rgpdHistorique.length - 10} plus anciens`}
                  </div>
                )}
              </div>
            )}

            <div style={{display:'flex',gap:6}}>
              <button onClick={handleRgpdExport} disabled={rgpdLoading}
                style={{flex:1,padding:'10px',background:rgpdLoading?'#999':'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontWeight:700,cursor:rgpdLoading?'default':'pointer',fontSize:13}}>
                {rgpdLoading
                  ? (lang==='ar'?'⏳ جاري التصدير...':'⏳ Génération...')
                  : (lang==='ar'?'📥 تحميل الملف':'📥 Télécharger le fichier')}
              </button>
              <button onClick={()=>setShowRgpdModal(false)} disabled={rgpdLoading}
                style={{padding:'10px 14px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'none',borderRadius:6,cursor:rgpdLoading?'default':'pointer',fontSize:13}}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* A.1 : Panneau notifications parents (liste inline dans header vert) */}
        {showNotifsPanel && (
          <div style={{marginTop:12,background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'14px',color:'#fff'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:700}}>
                🔔 {lang==='ar'?'الإشعارات':'Notifications'}
                {notifsNonLues > 0 && (
                  <span style={{marginLeft:8,fontSize:11,background:'#E24B4A',padding:'2px 8px',borderRadius:10}}>
                    {notifsNonLues} {lang==='ar'?'غير مقروء':'non lu(s)'}
                  </span>
                )}
              </div>
              <div style={{display:'flex',gap:6}}>
                {notifsNonLues > 0 && (
                  <button onClick={handleMarkAllRead}
                    style={{padding:'4px 10px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                    ✓ {lang==='ar'?'قراءة الكل':'Tout lire'}
                  </button>
                )}
                <button onClick={()=>setShowPrefsNotifs(true)}
                  title={lang==='ar'?'التفضيلات':'Préférences'}
                  style={{padding:'4px 10px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:6,fontSize:11,cursor:'pointer'}}>
                  ⚙️
                </button>
                <button onClick={()=>setShowNotifsPanel(false)}
                  style={{padding:'4px 10px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:6,fontSize:11,cursor:'pointer'}}>
                  ✕
                </button>
              </div>
            </div>

            {notifs.length === 0 ? (
              <div style={{padding:'20px',textAlign:'center',fontSize:12,opacity:0.8}}>
                {lang==='ar'?'✨ لا توجد إشعارات':'✨ Aucune notification pour le moment'}
              </div>
            ) : (
              <div style={{maxHeight:340,overflowY:'auto'}}>
                {notifs.map(n => {
                  const titre = lang==='ar' ? (n.titre_ar || n.titre_fr) : n.titre_fr;
                  const corps = lang==='ar' ? (n.corps_ar || n.corps_fr) : n.corps_fr;
                  const d = new Date(n.created_at);
                  const isToday = d.toDateString() === new Date().toDateString();
                  const dateStr = isToday
                    ? d.toLocaleTimeString(lang==='ar'?'ar-MA':'fr-FR',{hour:'2-digit',minute:'2-digit'})
                    : d.toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR');
                  return (
                    <div key={n.id}
                      onClick={()=>handleClickNotif(n)}
                      style={{
                        padding:'10px 12px',
                        borderRadius:8,
                        marginBottom:6,
                        background: n.lue ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)',
                        cursor:'pointer',
                        borderLeft: n.lue ? 'none' : '3px solid #FBBF24',
                      }}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                        <div style={{fontSize:12.5,fontWeight: n.lue ? 500 : 700}}>
                          {titre}
                        </div>
                        <div style={{fontSize:10,opacity:0.7,flexShrink:0,marginLeft:8}}>
                          {dateStr}
                        </div>
                      </div>
                      <div style={{fontSize:11.5,opacity:0.92,lineHeight:1.4}}>
                        {corps}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* A.1 : Modale préférences notifications */}
        {showPrefsNotifs && prefsNotifs && (
          <div style={{marginTop:12,background:'rgba(0,0,0,0.25)',borderRadius:10,padding:'16px',color:'#fff'}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>
              ⚙️ {lang==='ar'?'تفضيلات الإشعارات':'Préférences de notifications'}
            </div>
            <div style={{fontSize:11.5,opacity:0.85,marginBottom:14,lineHeight:1.5}}>
              {lang==='ar'
                ? 'اختر الأحداث التي تريد أن نعلمك بها. ستظهر الإشعارات في هذه البوابة. إذا أضفت عنوان بريد إلكتروني، ستتلقى نسخة بالبريد أيضًا.'
                : 'Choisissez les événements pour lesquels vous souhaitez être notifié. Les notifications apparaissent dans ce portail. Si vous renseignez un email, vous recevrez aussi une copie par email.'}
            </div>

            {/* Types de notifs */}
            {[
              { key:'notif_hizb_complet', labelFr:'Validation d\'un Hizb par mon enfant', labelAr:'تأكيد حفظ حزب', icon:'🎉' },
              { key:'notif_certificat',   labelFr:'Obtention d\'un certificat',          labelAr:'الحصول على شهادة',  icon:'🏅' },
              { key:'notif_inactivite',   labelFr:'Alerte inactivité (>14 jours)',      labelAr:'تنبيه عدم النشاط',   icon:'⚠️' },
            ].map(t => (
              <label key={t.key} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.08)',marginBottom:6,cursor:'pointer'}}>
                <input type="checkbox"
                  checked={prefsNotifs[t.key] !== false}
                  onChange={e => setPrefsNotifs({...prefsNotifs, [t.key]: e.target.checked})}
                  style={{width:16,height:16,cursor:'pointer',accentColor:'#1D9E75'}} />
                <span style={{fontSize:13,flex:1}}>
                  {t.icon} {lang==='ar' ? t.labelAr : t.labelFr}
                </span>
              </label>
            ))}

            {/* Email + toggle canal_email */}
            <div style={{marginTop:14,padding:'12px',background:'rgba(255,255,255,0.08)',borderRadius:8}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>
                📧 {lang==='ar'?'البريد الإلكتروني (اختياري)':'Email (optionnel)'}
              </div>
              <div style={{fontSize:10.5,opacity:0.75,marginBottom:8,lineHeight:1.5}}>
                {lang==='ar'
                  ? 'إذا لم يكن لديك بريد، ستستمر في رؤية الإشعارات هنا.'
                  : 'Sans email, vous continuerez à voir les notifications ici. Utilisez WhatsApp ou le portail si l\'email n\'est pas pratique.'}
              </div>
              <div style={{display:'flex',gap:6,marginBottom:8}}>
                <input type="email"
                  value={emailParent}
                  onChange={e=>setEmailParent(e.target.value)}
                  placeholder={lang==='ar'?'exemple@email.com':'exemple@email.com'}
                  style={{flex:1,padding:'8px 10px',borderRadius:6,border:'none',fontSize:13}}/>
                <button onClick={handleSaveEmail} disabled={savingEmail}
                  style={{padding:'8px 14px',background:savingEmail?'#999':'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:savingEmail?'default':'pointer'}}>
                  {savingEmail ? '...' : (lang==='ar'?'حفظ':'OK')}
                </button>
              </div>
              {emailParent && (
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:11.5,cursor:'pointer'}}>
                  <input type="checkbox"
                    checked={prefsNotifs.canal_email !== false}
                    onChange={e => setPrefsNotifs({...prefsNotifs, canal_email: e.target.checked})}
                    style={{width:14,height:14,cursor:'pointer',accentColor:'#1D9E75'}} />
                  <span>{lang==='ar'?'تلقي نسخة بالبريد الإلكتروني':'Recevoir aussi une copie par email'}</span>
                </label>
              )}
            </div>

            <div style={{display:'flex',gap:6,marginTop:14}}>
              <button onClick={handleSavePrefs} disabled={savingPrefs}
                style={{flex:1,padding:'10px',background:savingPrefs?'#999':'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontWeight:700,cursor:savingPrefs?'default':'pointer',fontSize:13}}>
                {savingPrefs ? '⏳ ...' : (lang==='ar'?'💾 حفظ التفضيلات':'💾 Enregistrer')}
              </button>
              <button onClick={()=>setShowPrefsNotifs(false)} disabled={savingPrefs}
                style={{padding:'10px 14px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'none',borderRadius:6,cursor:savingPrefs?'default':'pointer',fontSize:13}}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Indicateur fraîcheur du cache (mode hors ligne) */}
      {cacheAge !== null && cacheAge > 60000 && (() => {
        // Formater l'âge en lisible
        const mins = Math.floor(cacheAge / 60000);
        const hrs = Math.floor(mins / 60);
        const days = Math.floor(hrs / 24);
        let ageLabel;
        if (days >= 1) ageLabel = lang==='ar' ? `${days} يوم` : `${days} jour${days>1?'s':''}`;
        else if (hrs >= 1) ageLabel = lang==='ar' ? `${hrs} ساعة` : `${hrs} heure${hrs>1?'s':''}`;
        else ageLabel = lang==='ar' ? `${mins} دقيقة` : `${mins} min`;
        return (
          <div style={{background:'#FAEEDA',border:'0.5px solid #EF9F27',borderRadius:10,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#633806',display:'flex',alignItems:'center',gap:8}}>
            <span>📡</span>
            <span>
              {lang==='ar'
                ? `وضع عدم الاتصال · آخر تحديث: منذ ${ageLabel}`
                : `Mode hors ligne · Dernière mise à jour : il y a ${ageLabel}`}
            </span>
          </div>
        );
      })()}

      {/* Sélecteur enfant (si plusieurs) */}
      {enfants.length > 1 && (
        <div style={{display:'flex',gap:8,marginBottom:'1rem',flexWrap:'wrap'}}>
          {enfants.map(e=>(
            <div key={e.id} onClick={()=>{setSelectedEnfant(e);setOnglet('progression');}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:12,cursor:'pointer',
                border:'1.5px solid '+(selectedEnfant?.id===e.id?nc:'#e0e0d8'),
                background:selectedEnfant?.id===e.id?nc+'10':'#fff'}}>
              <Avatar prenom={e.prenom} nom={e.nom} size={32} bg={nc+'20'} color={nc}/>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:selectedEnfant?.id===e.id?nc:'#1a1a1a'}}>{e.prenom} {e.nom}</div>
                <NiveauBadge code={e.code_niveau}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Carte élève */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1rem',display:'flex',alignItems:'center',gap:14}}>
        <Avatar prenom={eleve.prenom} nom={eleve.nom} size={52} bg={nc+'18'} color={nc}/>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:18,fontWeight:700}}>{eleve.prenom} {eleve.nom}</span>
            <NiveauBadge code={eleve.code_niveau}/>
            {eleve.eleve_id_ecole&&<span style={{fontSize:11,color:'#bbb'}}>#{eleve.eleve_id_ecole}</span>}
          </div>
          <div style={{fontSize:12,color:'#888',marginTop:4}}>
            {isSourate
              ? (sourateActuelle?<span>{lang==='ar'?'السورة الحالية:':'En cours: '}<strong style={{fontFamily:"'Tajawal',Arial"}}>{sourateActuelle.nom_ar}</strong></span>:<span>{lang==='ar'?'أتم البرنامج 🎉':'Programme terminé 🎉'}</span>)
              : `Hizb ${eleve.hizb_depart||1} · T.${eleve.tomon_depart||1}`
            }
          </div>
          <div style={{fontSize:11,color:joursInactif>14?'#E24B4A':'#888',marginTop:2}}>
            {derniere
              ? (lang==='ar'?'آخر استظهار: ':'Dernière récitation: ')+new Date(derniere).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'numeric',month:'long',year:'numeric'})
              : (lang==='ar'?'لم يبدأ بعد':'Pas encore commencé')}
          </div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:800,color:nc}}>{pts.toLocaleString()}</div>
          <div style={{fontSize:11,color:'#888'}}>pts</div>
        </div>
      </div>

      {/* KPI rapides */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:'1rem'}}>
        {(isSourate?[
          {val:souratesCompletes,lbl:lang==='ar'?'سور مكتملة':'Sourates',color:'#1D9E75',bg:'#E1F5EE'},
          {val:sequences,lbl:lang==='ar'?'مقاطع':'Séquences',color:'#378ADD',bg:'#E6F1FB'},
          {val:actifSemaine,lbl:lang==='ar'?'نشاط 7 أيام':'7 derniers jours',color:'#EF9F27',bg:'#FAEEDA'},
          {val:pts,lbl:lang==='ar'?'النقاط':'Points',color:'#534AB7',bg:'#EEEDFE'},
        ]:[
          {val:tomon,lbl:'Tomon',color:'#378ADD',bg:'#E6F1FB'},
          {val:hizb,lbl:'Hizb',color:'#EF9F27',bg:'#FAEEDA'},
          {val:actifSemaine,lbl:lang==='ar'?'نشاط 7 أيام':'7 derniers jours',color:'#1D9E75',bg:'#E1F5EE'},
          {val:pts,lbl:lang==='ar'?'النقاط':'Points',color:'#534AB7',bg:'#EEEDFE'},
        ]).map(k=>(
          <div key={k.lbl} style={{background:k.bg,borderRadius:10,padding:'10px',textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,color:k.color}}>{k.val}</div>
            <div style={{fontSize:10,color:k.color,opacity:0.8}}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{display:'flex',gap:4,background:'#f0f0ec',borderRadius:12,padding:4,marginBottom:'1rem'}}>
        {onglets.map(o=>(
          <div key={o.key} onClick={()=>setOnglet(o.key)}
            style={{flex:1,padding:'7px 8px',borderRadius:8,fontSize:11,fontWeight:onglet===o.key?600:400,cursor:'pointer',textAlign:'center',
              background:onglet===o.key?'#fff':'transparent',color:onglet===o.key?'#085041':'#888',
              border:onglet===o.key?'0.5px solid #e0e0d8':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:3}}>
            <span>{o.icon}</span><span>{lang==='ar'?o.labelAr:o.label}</span>
          </div>
        ))}
      </div>

      {/* BANDEAU ALERTE COTISATIONS - visible sur toutes les pages */}
      {cotEAvecManquants.filter(x=>x.statut==='non_paye'||x.statut==='partiel').length > 0 && (
        <div onClick={()=>setOnglet('cotisations')} style={{
          background:'#FCEBEB',border:'2px solid #E24B4A',borderRadius:12,
          padding:'14px 16px',marginBottom:'1rem',cursor:'pointer',
          display:'flex',alignItems:'center',gap:12,
          boxShadow:'0 2px 8px #E24B4A20',transition:'all 0.2s'
        }}>
          <span style={{fontSize:28}}>🔴</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:14,color:'#E24B4A'}}>
              {lang==='ar'?'لديك اشتراكات غير مدفوعة':'Vous avez des cotisations impayées'}
            </div>
            <div style={{fontSize:12,color:'#E24B4A',opacity:0.85,marginTop:3}}>
              {cotEAvecManquants.filter(x=>x.statut==='non_paye'||x.statut==='partiel').length} {lang==='ar'?'شهر غير مسوى — انقر للتفاصيل':'mois non réglé(s) — Cliquez pour voir le détail'}
            </div>
          </div>
          <span style={{fontSize:18,color:'#E24B4A'}}>←</span>
        </div>
      )}

      {/* PROGRESSION */}
      {onglet==='progression'&&(
        <>
          {/* Barre de progression globale */}
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem',marginBottom:'1rem'}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{lang==='ar'?'التقدم العام':'Progression générale'}</div>
            {isSourate?(()=>{
              const souratesNiveau = getSouratesForNiveau(eleve.code_niveau);
              const total = souratesNiveau.length;
              const acq = parseInt(eleve.sourates_acquises)||0;
              const pct = Math.round((acq+souratesCompletes)/total*100);
              return(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:6}}>
                    <span>{acq+souratesCompletes}/{total} {lang==='ar'?'سورة':'sourates'}</span>
                    <span style={{fontWeight:700,color:nc}}>{pct}%</span>
                  </div>
                  <div style={{height:14,background:'#e8e8e0',borderRadius:7,overflow:'hidden'}}>
                    <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,#1D9E75,#5DCAA5)',borderRadius:7,transition:'width 0.5s'}}/>
                  </div>
                  <div style={{fontSize:11,color:'#888',marginTop:6}}>
                    {lang==='ar'?'المكتسبات السابقة:':'Acquis antérieurs:'} <strong>{acq}</strong> · {lang==='ar'?'منذ المتابعة:':'Depuis le suivi:'} <strong>{souratesCompletes}</strong>
                  </div>
                </div>
              );
            })():(()=>{
              // Le total à mémoriser dépend du sens :
              // desc : de hizb_depart jusqu'à Hizb 1 = (hizb_depart*8) - (tomon_depart-1)
              // asc  : de hizb_depart jusqu'à Hizb 60 = ((60-hizb_depart+1)*8) - (tomon_depart-1)
              const sensE = getSensForEleve(eleve, niveauxEcole, ecoleConfig);
              const hD = eleve.hizb_depart || (sensE === 'asc' ? 1 : 60);
              const tD = eleve.tomon_depart || 1;
              const totalTomon = sensE === 'asc'
                ? (60 - hD + 1) * 8 - (tD - 1)
                : hD * 8 - (tD - 1);
              const pct = Math.min(100, Math.round(tomon/Math.max(totalTomon,1)*100));
              return(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:6}}>
                    <span>{tomon} Tomon · {hizb} Hizb complets</span>
                    <span style={{fontWeight:700,color:nc}}>{pct}%</span>
                  </div>
                  <div style={{height:14,background:'#e8e8e0',borderRadius:7,overflow:'hidden'}}>
                    <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,#EF9F27,#F5C56E)',borderRadius:7}}/>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Activité récente */}
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem'}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{lang==='ar'?'النشاط الأخير':'Activité récente'}</div>
            {allActivity.slice(0,6).map((item,i)=>{
              const isSR = !!item.type_recitation;
              const sourate = isSR ? souratesDB.find(s=>s.id===item.sourate_id) : null;
              const pts2 = isSR?(item.points || 0):(item.type_validation==='hizb_complet'?(bareme.hizb_complet || 0):item.nombre_tomon*(bareme.tomon || 0));
              return(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'0.5px solid #f0f0ec'}}>
                  <div style={{width:36,height:36,borderRadius:8,background:isSR?'#E1F5EE':'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                    {isSR?'📖':'🎯'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:500}}>
                      {isSR?(item.type_recitation==='complete'?(sourate?sourate.nom_ar:'Sourate complète'):('V.'+item.verset_debut+'→'+item.verset_fin)):(item.type_validation==='hizb_complet'?'Hizb '+item.hizb_valide:item.nombre_tomon+' Tomon')}
                    </div>
                    <div style={{fontSize:11,color:'#888'}}>{new Date(item.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'numeric',month:'short'})}</div>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>+{pts2}</span>
                </div>
              );
            })}
            {allActivity.length===0&&<div className="empty">{lang==='ar'?'لا نشاط بعد':'Aucune activité'}</div>}
          </div>
        </>
      )}

      {/* RÉCITATIONS */}
      {onglet==='recitations'&&(
        <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem'}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{lang==='ar'?'سجل الاستظهارات':'Historique des récitations'} ({allActivity.length})</div>
          {allActivity.length===0?<div className="empty">{lang==='ar'?'لا استظهارات بعد':'Aucune récitation'}</div>:(
            <div className="table-wrap">
              <table><thead><tr>
                <th>{lang==='ar'?'التاريخ':'Date'}</th>
                <th>{lang==='ar'?'النوع':'Type'}</th>
                <th>{lang==='ar'?'التفاصيل':'Détails'}</th>
                <th>{lang==='ar'?'صحح بواسطة':'Validé par'}</th>
                <th>pts</th>
              </tr></thead>
              <tbody>
                {allActivity.map((item,i)=>{
                  const isSR = !!item.type_recitation;
                  const sourate = isSR ? souratesDB.find(s=>s.id===item.sourate_id) : null;
                  const pts2 = isSR?(item.points || 0):(item.type_validation==='hizb_complet'?(bareme.hizb_complet || 0):item.nombre_tomon*(bareme.tomon || 0));
                  return(
                    <tr key={i}>
                      <td style={{fontSize:11,color:'#888'}}>{new Date(item.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</td>
                      <td>{isSR?(item.type_recitation==='complete'?<span className="badge badge-green">{lang==='ar'?'سورة كاملة':'Complète'}</span>:<span className="badge badge-blue">{lang==='ar'?'مقطع':'Séquence'}</span>):(item.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb ✓</span>:<span className="badge badge-blue">Tomon</span>)}</td>
                      <td style={{fontFamily:"'Tajawal',Arial",fontSize:12}}>{isSR?(sourate?sourate.nom_ar:('V.'+item.verset_debut+'→'+item.verset_fin)):(item.type_validation==='hizb_complet'?'Hizb '+item.hizb_valide:item.nombre_tomon+' T.')}</td>
                      <td style={{fontSize:11,color:'#888'}}>{item.valideur?item.valideur.prenom+' '+item.valideur.nom:'—'}</td>
                      <td><span style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>+{pts2}</span></td>
                    </tr>
                  );
                })}
              </tbody></table>
            </div>
          )}
        </div>
      )}

      {/* OBJECTIFS */}
      {onglet==='objectifs'&&(
        <div>
          {objActifs.length===0?<div className="empty">{lang==='ar'?'لا أهداف نشطة حالياً':'Aucun objectif actif'}</div>:(
            objActifs.map(obj=>{
              // Calculate achievement
              let realise = 0;
              if (obj.metrique==='tomon') realise=tomon;
              else if (obj.metrique==='hizb') realise=hizb;
              else if (obj.metrique==='sourate') realise=souratesCompletes;
              else if (obj.metrique==='sequence') realise=sequences;
              else if (obj.metrique==='points') realise=pts;
              const pct = Math.min(100, Math.round(realise/obj.valeur_cible*100));
              const color = pct>=100?'#1D9E75':pct>=60?'#EF9F27':'#E24B4A';
              const daysLeft = Math.max(0,Math.ceil((new Date(obj.date_fin)-now)/(1000*60*60*24)));
              return(
                <div key={obj.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem',marginBottom:'1rem'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600}}>{obj.titre||(lang==='ar'?'هدف':'Objectif')}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>
                        {new Date(obj.date_debut).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} → {new Date(obj.date_fin).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
                      </div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:24,fontWeight:800,color}}>{pct}%</div>
                      <div style={{fontSize:10,color:'#888'}}>{realise}/{obj.valeur_cible}</div>
                    </div>
                  </div>
                  <div style={{height:12,background:'#e8e8e0',borderRadius:6,overflow:'hidden',marginBottom:6}}>
                    <div style={{height:'100%',width:pct+'%',background:color,borderRadius:6,transition:'width 0.5s'}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888'}}>
                    <span>{pct>=100?'🎉 '+(lang==='ar'?'تم تحقيق الهدف!':'Objectif atteint !'):daysLeft+' '+(lang==='ar'?'يوم متبقي':'jours restants')}</span>
                    <span>{lang==='ar'?'المتبقي:':'Restant:'} {Math.max(0,obj.valeur_cible-realise)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* COTISATIONS */}
      {onglet==='cotisations'&&(
        <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem'}}>

          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>
            💰 {lang==='ar'?'الاشتراكات':'Cotisations'}
            <span style={{fontSize:12,color:'#1D9E75',marginRight:8,marginLeft:8,fontWeight:700}}>
              {lang==='ar'?'المجموع:':'Total: '}{cotEAvecManquants.filter(c=>c.statut!=='exonere'&&!c._virtuel).reduce((s,c)=>s+parseFloat(c.montant||0),0).toLocaleString()} MAD
            </span>
          </div>
          {cotEAvecManquants.length===0?<div className="empty">{lang==='ar'?'لا اشتراكات مسجلة':'Aucune cotisation'}</div>:(
            cotEAvecManquants.map((cot,i)=>{
              const STATUTS_P = {paye:{label:'Payé',labelAr:'مدفوع',color:'#1D9E75',bg:'#E1F5EE',ic:'✅'},partiel:{label:'Partiel',labelAr:'جزئي',color:'#EF9F27',bg:'#FAEEDA',ic:'⚠️'},non_paye:{label:'Non payé',labelAr:'غير مدفوع',color:'#E24B4A',bg:'#FCEBEB',ic:'❌'},exonere:{label:'Exonéré',labelAr:'معفى',color:'#888',bg:'#f5f5f0',ic:'🎁'}};
              const st = STATUTS_P[cot.statut]||STATUTS_P.non_paye;
              return(
                <div key={cot.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'0.5px solid #f0f0ec',background:cot._virtuel?st.bg:'transparent',borderRadius:cot._virtuel?8:0,padding:cot._virtuel?'10px 8px':'10px 0',marginBottom:cot._virtuel?4:0}}>
                  <span style={{fontSize:16}}>{st.ic}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:st.color}}>{cot.periode||cot.mois_concerne||'—'}</div>
                    <div style={{fontSize:11,color:'#888'}}>{cot.date_paiement?new Date(cot.date_paiement).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR'):(lang==='ar'?'لم يُدفع بعد':'Non payé')}{cot.note?' · '+cot.note:''}</div>
                  </div>
                  <div style={{textAlign:'left'}}>
                    <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:st.bg,color:st.color}}>{lang==='ar'?st.labelAr:st.label}</span>
                    {!cot._virtuel&&<div style={{fontSize:14,fontWeight:800,color:st.color,marginTop:2}}>{parseFloat(cot.montant||0).toLocaleString()} MAD</div>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      {/* Cours */}
      {onglet==='cours' && selectedEnfant && (
        <OngletCoursEleve eleve={selectedEnfant} lang={lang} isMobile={false} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// BANNER DERNIÈRE VISITE + MESSAGE INSPIRANT
// Affiche à chaque parent un message adapté selon sa fréquence :
// - 1ère visite   : "Bienvenue sur votre espace"
// - ≤ 7j          : "Merci de suivre la progression 🌟"
// - 8-30j         : "Ravi de vous revoir !"
// - > 30j         : "Nous sommes ravis de vous revoir !"
// ══════════════════════════════════════════════════════════════════════
function BannerDerniereVisite({ derniereVisite, lang, mobile }) {
  // derniereVisite = null → jamais venu (1ère visite réelle)
  // derniereVisite = {joursEcoules: N}

  let msg;
  let dateInfo = '';
  const j = derniereVisite?.joursEcoules;

  if (!derniereVisite) {
    // Première visite jamais
    msg = lang === 'ar'
      ? '🌟 مرحبا بكم في فضائكم. نحن سعداء باهتمامكم بابنكم'
      : lang === 'en'
        ? '🌟 Welcome to your space. Thank you for caring about your child\'s progress'
        : '🌟 Bienvenue sur votre espace. Ravis que vous suiviez la progression de votre enfant';
  } else if (j === 0 || j === 1) {
    msg = lang === 'ar' ? '🌟 شكرا لمتابعتكم المنتظمة لتقدم ابنكم' : '🌟 Merci de suivre régulièrement la progression de votre enfant';
    dateInfo = j === 0
      ? (lang === 'ar' ? 'آخر زيارة: اليوم' : 'Dernière visite : aujourd\'hui')
      : (lang === 'ar' ? 'آخر زيارة: أمس' : 'Dernière visite : hier');
  } else if (j <= 7) {
    msg = lang === 'ar' ? '🌟 شكرا لمتابعتكم المنتظمة' : '🌟 Merci de votre suivi régulier';
    dateInfo = lang === 'ar'
      ? `آخر زيارة: منذ ${j} أيام`
      : `Dernière visite : il y a ${j} jour${j > 1 ? 's' : ''}`;
  } else if (j <= 30) {
    msg = lang === 'ar' ? '👋 سعداء برؤيتكم من جديد' : '👋 Ravis de vous revoir';
    dateInfo = lang === 'ar'
      ? `آخر زيارة: منذ ${j} يوما`
      : `Dernière visite : il y a ${j} jours`;
  } else {
    // > 30 jours : message chaleureux, pas culpabilisant
    msg = lang === 'ar' ? '💚 سعداء جدا برؤيتكم من جديد! إليكم آخر الأخبار' : '💚 Très heureux de vous revoir ! Voici les dernières nouvelles';
    dateInfo = lang === 'ar'
      ? `آخر زيارة: منذ ${j} يوما`
      : `Dernière visite : il y a ${j} jours`;
  }

  return (
    <div style={{
      marginTop: mobile ? 8 : 10,
      padding: mobile ? '8px 12px' : '8px 14px',
      background: 'rgba(255,255,255,0.15)',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: 10,
      fontSize: mobile ? 11 : 12,
      color: 'rgba(255,255,255,0.95)',
      lineHeight: 1.45,
    }}>
      <div style={{ fontWeight: 600 }}>{msg}</div>
      {dateInfo && (
        <div style={{ fontSize: mobile ? 10 : 11, opacity: 0.75, marginTop: 3 }}>
          📅 {dateInfo}
        </div>
      )}
    </div>
  );
}
