import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, calcPointsPeriode, loadBareme, BAREME_DEFAUT, getSensForEleve} from '../lib/helpers';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import PageHeader from '../components/PageHeader';
import MobileSkeletonList from '../components/MobileSkeletonList';
import { usePullToRefresh, PullToRefreshIndicator } from '../lib/usePullToRefresh';

export default function TableauHonneur({ user, navigate, goBack, lang='fr', isMobile }) {
  const [eleves, setEleves] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('global');
  const [periodeId, setPeriodeId] = useState('semaine');
  const [niveauxDyn, setNiveauxDyn] = useState([]);
  const [bareme, setBareme] = useState({...BAREME_DEFAUT});
  // J7 polish : 2 modes d'affichage du Tableau d'honneur
  //   - 'light' (defaut) : coherent avec le reste de l'app, fond clair
  //   - 'tv'             : mode presentation en salle (projection ecran),
  //                        fond fonce, ambiance ceremonie de remise de prix
  // Persistance choix utilisateur via localStorage
  const [displayMode, setDisplayMode] = useState(() => {
    try {
      return localStorage.getItem('honneur_mode') || 'light';
    } catch { return 'light'; }
  });
  const setMode = (m) => {
    setDisplayMode(m);
    try { localStorage.setItem('honneur_mode', m); } catch {}
  };
  const isTV = displayMode === 'tv';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    loadBareme(supabase, user.ecole_id).then(b => setBareme(b));
    // Etape 14 - Charger l'annee active pour filtrer les periodes
    const { data: anneeActive } = await supabase.from('annees_scolaires')
      .select('id').eq('ecole_id', user.ecole_id).eq('statut', 'active').maybeSingle();
    const periodesQuery = anneeActive
      ? supabase.from('periodes_notes').select('*').eq('annee_scolaire_id', anneeActive.id).eq('actif', true).order('date_debut')
      : supabase.from('periodes_notes').select('*').eq('ecole_id', user.ecole_id).eq('actif', true).order('date_debut'); // fallback
    const [{ data: ed }, { data: vd }, { data: pd }, { data: nv }, { data: pe }, { data: ec }] = await Promise.all([
      supabase.from('eleves').select('id,prenom,nom,code_niveau,niveau,hizb_depart,tomon_depart,ecole_id').eq('ecole_id', user.ecole_id).order('nom'),
      fetchAll(supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,date_validation').eq('ecole_id', user.ecole_id)).then(data=>({data})),
      periodesQuery,
      supabase.from('niveaux').select('id,code,nom,couleur,sens_recitation').eq('ecole_id', user.ecole_id).order('ordre'),
      supabase.from('points_eleves').select('*').eq('ecole_id', user.ecole_id).order('created_at', {ascending:false}),
      supabase.from('ecoles').select('sens_recitation_defaut').eq('id', user.ecole_id).maybeSingle(),
    ]);
    const elevesData = (ed||[]).map(e => {
      const vals = (vd||[]).filter(v => v.eleve_id === e.id);
      const sensE = getSensForEleve(e, nv, ec);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart, sensE);
      const evts = (pe||[]).filter(p=>p.eleve_id===e.id);
      return { ...e, etat, validations: vals, pointsEvenements: evts };
    });
    setEleves(elevesData);
    setAllValidations(vd||[]);
    setPeriodes(pd||[]);
    setNiveauxDyn(nv||[]);
    setLoading(false);
  };

  // Calcul des points selon période sélectionnée
  const getPointsPeriode = (eleve) => {
    const now = new Date();
    if (periodeId === 'semaine') {
      const d = new Date(now); d.setDate(now.getDate() - 7);
      return calcPointsPeriode(eleve.validations, d, now, bareme, eleve.pointsEvenements);
    }
    if (periodeId === 'mois') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return calcPointsPeriode(eleve.validations, d, now, bareme, eleve.pointsEvenements);
    }
    if (periodeId === 'trimestre') {
      const d = new Date(now); d.setMonth(now.getMonth() - 3); d.setDate(1);
      return calcPointsPeriode(eleve.validations, d, now, bareme, eleve.pointsEvenements);
    }
    const p = periodes.find(x => x.id === periodeId);
    if (p) return calcPointsPeriode(eleve.validations, p.date_debut, p.date_fin, bareme, eleve.pointsEvenements);
    return calcPointsPeriode(eleve.validations, new Date(0), now, bareme, eleve.pointsEvenements);
  };

  const PERIODES_FIXES = [
    { id: 'semaine', label: lang==='ar'?'الأسبوع':'Semaine' },
    { id: 'mois',    label: lang==='ar'?'الشهر':'Mois' },
    { id: 'trimestre', label: lang==='ar'?'الفصل (3 أشهر)':'Trimestre' },
  ];

  const elevesClasses = useMemo(() => {
    const filtered = vue === 'global' ? eleves : eleves.filter(e => e.code_niveau === vue);
    return [...filtered]
      .map(e => ({ ...e, ptsPeriode: getPointsPeriode(e) }))
      .sort((a, b) => b.ptsPeriode.total - a.ptsPeriode.total)
      .filter(e => e.ptsPeriode.total > 0 || periodeId === 'global');
  }, [eleves, vue, periodeId, periodes]);

  const medals = ['🥇','🥈','🥉'];
  const podiumColors = ['#EF9F27','#B0B0B0','#CD7F32'];
  const podiumBg = ['#FAEEDA','#f5f5f0','#f9f3ec'];

  const niveauxVues = niveauxDyn.length > 0
    ? niveauxDyn.map(n => ({ code: n.code, label: n.nom, color: n.couleur || '#888' }))
    : [
        {code:'5B',label:'5B',color:'#534AB7'},{code:'5A',label:'5A',color:'#378ADD'},
        {code:'2M',label:'2M',color:'#1D9E75'},{code:'2',label:'2',color:'#EF9F27'},
        {code:'1',label:'1',color:'#E24B4A'},
      ];

  const periodeLabel = () => {
    const f = PERIODES_FIXES.find(p => p.id === periodeId);
    if (f) return f.label;
    const p = periodes.find(x => x.id === periodeId);
    return p ? (p.nom_ar || p.nom) : '';
  };

  const vueLabelText = () => {
    if (vue === 'global') return lang === 'ar' ? 'جميع المستويات' : 'Tous niveaux';
    const n = niveauxVues.find(x => x.code === vue);
    return n ? n.label : vue;
  };

  // ── Export PDF (tableau d'honneur cérémonieux) ──
  const handleExportPDF = async () => {
    if (elevesClasses.length === 0) return;
    const elevesData = elevesClasses.map((el, i) => ({
      rang: i + 1,
      prenom: el.prenom || '',
      nom: el.nom || '',
      code_niveau: el.code_niveau || '',
      niveau_couleur: niveauxVues.find(n => n.code === el.code_niveau)?.color || '#888',
      points: el.ptsPeriode?.total || 0,
      tomon: el.ptsPeriode?.details?.nbTomon || 0,
      hizb: el.ptsPeriode?.details?.nbHizb || 0,
    }));
    try {
      await openPDF('rapport_honneur', {
        ecole: { nom: user?.ecole?.nom || '' },
        periodeLabel: periodeLabel(),
        vueLabel: vueLabelText(),
        eleves: elevesData,
      }, lang);
    } catch (err) {
      alert((lang === 'ar' ? 'خطأ PDF : ' : 'Erreur PDF : ') + err.message);
    }
  };

  // ── Export Excel ──
  const handleExportExcel = async () => {
    if (elevesClasses.length === 0) return;
    const headers = [
      lang === 'ar' ? 'الرتبة' : 'Rang',
      lang === 'ar' ? 'الاسم' : 'Prénom',
      lang === 'ar' ? 'اللقب' : 'Nom',
      lang === 'ar' ? 'المستوى' : 'Niveau',
      lang === 'ar' ? 'النقاط' : 'Points',
      lang === 'ar' ? 'الثُّمنات' : 'Tomon',
      lang === 'ar' ? 'الأحزاب' : 'Hizb',
    ];
    const rows = elevesClasses.map((el, i) => [
      i + 1,
      el.prenom || '',
      el.nom || '',
      el.code_niveau || '',
      el.ptsPeriode?.total || 0,
      el.ptsPeriode?.details?.nbTomon || 0,
      el.ptsPeriode?.details?.nbHizb || 0,
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      await exportExcelSimple(
        `honneur_${periodeId}_${dateStr}.xlsx`,
        [headers, ...rows],
        lang === 'ar' ? 'لوحة الشرف' : 'Tableau honneur',
      );
    } catch (err) {
      alert((lang === 'ar' ? 'خطأ Excel : ' : 'Erreur Excel : ') + err.message);
    }
  };


  // Pull-to-refresh (Phase 2 Sprint 4)
  const {
    pullDistance, isRefreshing, isThreshold,
    onTouchStart, onTouchMove, onTouchEnd,
  } = usePullToRefresh(loadData);

  // J7 polish : theme centralise selon le mode (light/tv).
  // Objet T = palette + utilitaires pour generer les styles dynamiquement.
  // En light : couleurs cohrent avec le reste de l'app (#f5f5f0 fond, vert principal)
  // En TV    : ambiance ceremonie (degrade vert tres fonce, accents or vif)
  const T = isTV ? {
    bg: 'linear-gradient(135deg,#0A1F1C 0%,#0d2a23 60%,#0A1F1C 100%)',
    fgPrimary: '#fff',
    fgSecondary: '#9FE1CB',
    fgMuted: '#5DCAA5',
    fgDim: '#3a6657',
    chipBg: 'rgba(255,255,255,0.08)',
    chipBgActive: '#378ADD',
    chipBorder: 'rgba(255,255,255,0.15)',
    chipFg: '#9FE1CB',
    chipFgActive: '#fff',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    accentGold: '#FFD700',  // or eclatant (TV)
    pdfBg: 'rgba(226,75,74,0.2)', pdfBorder: 'rgba(226,75,74,0.4)', pdfFg: '#FCA5A4',
    excelBg: 'rgba(29,158,117,0.2)', excelBorder: 'rgba(29,158,117,0.4)', excelFg: '#5DCAA5',
    toggleBg: 'rgba(239,159,39,0.15)',
    toggleBorder: 'rgba(239,159,39,0.4)',
    toggleFg: '#FFD700',
  } : {
    bg: '#f5f5f0',
    fgPrimary: '#1a1a1a',
    fgSecondary: '#666',
    fgMuted: '#888',
    fgDim: '#aaa',
    chipBg: '#fff',
    chipBgActive: '#378ADD',
    chipBorder: '#e0e0d8',
    chipFg: '#666',
    chipFgActive: '#fff',
    cardBg: '#fff',
    cardBorder: '#e0e0d8',
    accentGold: '#EF9F27',
    pdfBg: '#FCEBEB', pdfBorder: '#E24B4A', pdfFg: '#E24B4A',
    excelBg: '#E1F5EE', excelBorder: '#1D9E75', excelFg: '#1D9E75',
    toggleBg: '#FAEEDA',
    toggleBorder: '#EF9F27',
    toggleFg: '#854F0B',
  };

  // Bouton toggle mode (light <-> TV)
  const ModeToggle = (
    <button onClick={()=>setMode(isTV ? 'light' : 'tv')}
      title={isTV ? (lang==='ar'?'الوضع العادي':'Mode normal') : (lang==='ar'?'وضع العرض':'Mode présentation')}
      style={{
        background:T.toggleBg,border:`1px solid ${T.toggleBorder}`,borderRadius:10,
        padding: isMobile?'0 12px':'7px 11px',
        height: isMobile?44:undefined,
        color:T.toggleFg,fontSize:isMobile?16:12,fontWeight:700,
        cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',
        display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
      {isTV ? '☀️' : '📺'}{!isMobile && ' '}{!isMobile && (isTV
        ? (lang==='ar'?'عادي':'Normal')
        : (lang==='ar'?'عرض':'Présentation'))}
    </button>
  );

  return (
    <div style={{minHeight:'100vh',background:T.bg,padding:'1.5rem 1rem',paddingBottom:80,
      transition:'background 0.3s ease'}}
      {...(isMobile ? { onTouchStart, onTouchMove, onTouchEnd } : {})}>
      {isMobile && (
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          isThreshold={isThreshold}
          lang={lang}
        />
      )}
      {/* Sticky header — variant adapte au mode */}
      <PageHeader
        title={t(lang, 'tableau_honneur')}
        icon="🏆"
        subtitle={periodeLabel()}
        onBack={() => goBack ? goBack() : navigate('dashboard')}
        lang={lang}
        variant={isTV ? "dark" : "default"}
        isMobile={isMobile}
        actions={
          <>
            {ModeToggle}
            <button onClick={handleExportPDF}
              disabled={elevesClasses.length === 0}
              title={lang==='ar'?'تصدير PDF':'Exporter PDF'}
              aria-label={lang==='ar'?'تصدير PDF':'Exporter PDF'}
              style={{background:T.pdfBg,border:`1px solid ${T.pdfBorder}`,borderRadius:10,
                padding: isMobile?'0 12px':'7px 11px',
                height: isMobile?44:undefined,
                color:T.pdfFg,fontSize:isMobile?16:12,fontWeight:700,
                cursor:elevesClasses.length===0?'default':'pointer',
                opacity:elevesClasses.length===0?0.4:1,fontFamily:'inherit',whiteSpace:'nowrap',
                display:'flex',alignItems:'center',justifyContent:'center'}}>
              📄{!isMobile && ' PDF'}
            </button>
            <button onClick={handleExportExcel}
              disabled={elevesClasses.length === 0}
              title={lang==='ar'?'تصدير Excel':'Exporter Excel'}
              aria-label={lang==='ar'?'تصدير Excel':'Exporter Excel'}
              style={{background:T.excelBg,border:`1px solid ${T.excelBorder}`,borderRadius:10,
                padding: isMobile?'0 12px':'7px 11px',
                height: isMobile?44:undefined,
                color:T.excelFg,fontSize:isMobile?16:12,fontWeight:700,
                cursor:elevesClasses.length===0?'default':'pointer',
                opacity:elevesClasses.length===0?0.4:1,fontFamily:'inherit',whiteSpace:'nowrap',
                display:'flex',alignItems:'center',justifyContent:'center'}}>
              📊{!isMobile && ' Excel'}
            </button>
          </>
        }
      />

      {/* Sélecteur période */}
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:11,color:T.fgMuted,marginBottom:6,textAlign:'center',fontWeight:600}}>
          {lang==='ar'?'الفترة':'Période'}
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
          {PERIODES_FIXES.map(p => (
            <div key={p.id} onClick={()=>setPeriodeId(p.id)}
              style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:periodeId===p.id?700:400,
                background:periodeId===p.id?T.chipBgActive:T.chipBg,
                color:periodeId===p.id?T.chipFgActive:T.chipFg,
                border:'1px solid '+(periodeId===p.id?T.chipBgActive:T.chipBorder)}}>
              {p.label}
            </div>
          ))}
          {periodes.map(p => (
            <div key={p.id} onClick={()=>setPeriodeId(p.id)}
              style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:periodeId===p.id?700:400,
                background:periodeId===p.id?'#534AB7':T.chipBg,
                color:periodeId===p.id?'#fff':T.chipFg,
                border:'1px solid '+(periodeId===p.id?'#534AB7':T.chipBorder),
                direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>
              {p.nom_ar||p.nom}
            </div>
          ))}
        </div>
      </div>

      {/* Sélecteur niveau */}
      <div style={{display:'flex',gap:6,marginBottom:'1.5rem',flexWrap:'wrap',justifyContent:'center'}}>
        <div onClick={()=>setVue('global')}
          style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:vue==='global'?700:400,
            background:vue==='global'?'#1D9E75':T.chipBg,
            color:vue==='global'?'#fff':T.chipFg,
            border:'1px solid '+(vue==='global'?'#1D9E75':T.chipBorder)}}>
          🌍 {lang==='ar'?'الكل':'Global'}
        </div>
        {niveauxVues.map(n => (
          <div key={n.code} onClick={()=>setVue(n.code)}
            style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:vue===n.code?700:400,
              background:vue===n.code?n.color:T.chipBg,
              color:vue===n.code?'#fff':T.chipFg,
              border:'1px solid '+(vue===n.code?n.color:T.chipBorder)}}>
            {n.label}
          </div>
        ))}
      </div>

      {loading ? <MobileSkeletonList type="card-with-avatar" count={6} padding="12px" /> : (
        <>
          {elevesClasses.length === 0 ? (
            <div style={{textAlign:'center',color:T.fgDim,padding:'3rem',fontSize:14}}>
              {lang==='ar'?'لا توجد استظهارات في هذه الفترة':'Aucune récitation sur cette période'}
            </div>
          ) : (
            <>
              {/* Podium */}
              {elevesClasses.length >= 3 && (
                <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:14,marginBottom:'2.5rem',padding:'8px 0 0'}}>
                  {[1,0,2].map(rank => {
                    const e = elevesClasses[rank];
                    if (!e) return null;
                    // Couleurs podium adaptees au mode
                    // En TV : couleurs vives or/argent/bronze sur fond fonce -> halo lumineux
                    // En light : meme contraste que le podium du Dashboard (gradient metallique)
                    const pc = ['#EF9F27','#9E9E9E','#CD7F32']; // text/border
                    const pbGrad = isTV ? [
                      'linear-gradient(180deg,#FFD700 0%,#F0A500 100%)',
                      'linear-gradient(180deg,#E5E5E5 0%,#A0A0A0 100%)',
                      'linear-gradient(180deg,#D6985B 0%,#A36422 100%)',
                    ] : [
                      'linear-gradient(180deg,#FFE7B5 0%,#FAC775 100%)',
                      'linear-gradient(180deg,#EEEEEE 0%,#C8C8C8 100%)',
                      'linear-gradient(180deg,#F0CD9F 0%,#D6985B 100%)',
                    ];
                    const ph = [150, 110, 88];
                    const medals = ['🥇','🥈','🥉'];
                    return (
                      <div key={e.id} onClick={()=>navigate('fiche',e)}
                        style={{flex:1,maxWidth:170,display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer'}}>
                        {rank===0 && <div style={{fontSize:28,marginBottom:4,lineHeight:1,
                          filter:isTV?'drop-shadow(0 0 12px rgba(255,215,0,0.5))':'none'}}>👑</div>}
                        <div style={{width:rank===0?58:46,height:rank===0?58:46,borderRadius:'50%',
                          background:isTV?'rgba(255,255,255,0.1)':'#fff',
                          border:`2px solid ${pc[rank]}`,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontWeight:800,fontSize:rank===0?20:16,color:pc[rank],
                          boxShadow:isTV?`0 0 16px ${pc[rank]}80`:`0 2px 8px ${pc[rank]}30`}}>
                          {getInitiales(e.prenom,e.nom)}
                        </div>
                        <div style={{fontSize:rank===0?14:12,fontWeight:700,
                          color:T.fgPrimary,marginTop:8,textAlign:'center'}}>
                          {e.prenom} {e.nom}
                        </div>
                        <div style={{fontSize:rank===0?17:14,fontWeight:800,color:pc[rank],margin:'4px 0 8px'}}>
                          {e.ptsPeriode.total.toLocaleString()} {t(lang,'pts_abrev')}
                        </div>
                        <div style={{fontSize:10,color:T.fgMuted,marginBottom:6}}>
                          {e.ptsPeriode.tomonPeriode} {t(lang,'tomon_abrev')} · {e.ptsPeriode.hizbsPeriode} {t(lang,'hizb_abrev')}
                        </div>
                        <div style={{width:'100%',height:ph[rank],
                          background:pbGrad[rank],
                          border:`1.5px solid ${pc[rank]}`,
                          borderRadius:'10px 10px 0 0',
                          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,
                          boxShadow:isTV
                            ? `0 0 ${rank===0?24:16}px ${pc[rank]}90, inset 0 0 20px rgba(255,255,255,0.15)`
                            : `0 ${rank===0?4:2}px ${rank===0?14:8}px ${pc[rank]}${rank===0?'55':'30'}`}}>
                          <span style={{fontSize:rank===0?32:24,lineHeight:1}}>{medals[rank]}</span>
                          <span style={{fontSize:rank===0?40:32,fontWeight:900,color:'#fff',
                            textShadow:`0 1px 3px ${pc[rank]}cc, 0 0 8px ${pc[rank]}80`,lineHeight:1}}>
                            {rank+1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Classement complet */}
              <div style={{maxWidth:600,margin:'0 auto'}}>
                {elevesClasses.map((e,idx) => {
                  const sl = scoreLabel(e.ptsPeriode.total);
                  return (
                    <div key={e.id} onClick={()=>navigate('fiche',e)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                        background:T.cardBg,border:`0.5px solid ${T.cardBorder}`,
                        borderRadius:12,marginBottom:8,cursor:'pointer'}}>
                      <div style={{fontSize:18,minWidth:32,textAlign:'center'}}>
                        {medals[idx] || <span style={{color:T.fgDim,fontSize:13,fontWeight:700}}>{idx+1}</span>}
                      </div>
                      <div style={{width:38,height:38,borderRadius:'50%',
                        background:isTV?'rgba(255,255,255,0.1)':'#f5f5f0',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontWeight:700,fontSize:14,color:isTV?'#9FE1CB':'#1D9E75',flexShrink:0}}>
                        {getInitiales(e.prenom,e.nom)}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:600,color:T.fgPrimary}}>{e.prenom} {e.nom}</div>
                        <div style={{fontSize:11,color:T.fgMuted,marginTop:2}}>
                          {e.ptsPeriode.tomonPeriode} {t(lang,'tomon_abrev')}
                          {e.ptsPeriode.hizbsPeriode > 0 && ` · ${e.ptsPeriode.hizbsPeriode} ${t(lang,'hizb_abrev')} ✓`}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:16,fontWeight:800,color:T.accentGold}}>{e.ptsPeriode.total.toLocaleString()}</div>
                        <div style={{fontSize:10,color:T.fgDim}}>{t(lang,'pts_abrev')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
