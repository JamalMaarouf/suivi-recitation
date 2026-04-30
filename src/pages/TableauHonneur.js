import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, calcPointsPeriode, loadBareme, BAREME_DEFAUT, getSensForEleve} from '../lib/helpers';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import PageHeader from '../components/PageHeader';

export default function TableauHonneur({ user, navigate, goBack, lang='fr', isMobile }) {
  const [eleves, setEleves] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('global');
  const [periodeId, setPeriodeId] = useState('semaine');
  const [niveauxDyn, setNiveauxDyn] = useState([]);
  const [bareme, setBareme] = useState({...BAREME_DEFAUT});

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

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0a0a0f 0%,#0d1f1a 100%)',padding:'1.5rem 1rem',paddingBottom:80}}>
      {/* Sticky header — variant 'dark' (gamification) */}
      <PageHeader
        title={t(lang, 'tableau_honneur')}
        icon="🏆"
        subtitle={periodeLabel()}
        onBack={() => goBack ? goBack() : navigate('dashboard')}
        lang={lang}
        variant="dark"
        isMobile={isMobile}
        actions={
          <>
            <button onClick={handleExportPDF}
              disabled={elevesClasses.length === 0}
              title={lang==='ar'?'تصدير PDF':'Exporter PDF'}
              style={{background:'rgba(226,75,74,0.2)',border:'1px solid rgba(226,75,74,0.4)',borderRadius:10,padding:isMobile?'7px 9px':'7px 11px',color:'#FCA5A4',fontSize:12,fontWeight:700,cursor:elevesClasses.length===0?'default':'pointer',opacity:elevesClasses.length===0?0.4:1,fontFamily:'inherit',whiteSpace:'nowrap'}}>
              📄{!isMobile && ' PDF'}
            </button>
            <button onClick={handleExportExcel}
              disabled={elevesClasses.length === 0}
              title={lang==='ar'?'تصدير Excel':'Exporter Excel'}
              style={{background:'rgba(29,158,117,0.2)',border:'1px solid rgba(29,158,117,0.4)',borderRadius:10,padding:isMobile?'7px 9px':'7px 11px',color:'#5DCAA5',fontSize:12,fontWeight:700,cursor:elevesClasses.length===0?'default':'pointer',opacity:elevesClasses.length===0?0.4:1,fontFamily:'inherit',whiteSpace:'nowrap'}}>
              📊{!isMobile && ' Excel'}
            </button>
          </>
        }
      />

      {/* Sélecteur période */}
      <div style={{marginBottom:'1rem'}}>
        <div style={{fontSize:11,color:'#5DCAA5',marginBottom:6,textAlign:'center',fontWeight:600}}>
          {lang==='ar'?'الفترة':'Période'}
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
          {PERIODES_FIXES.map(p => (
            <div key={p.id} onClick={()=>setPeriodeId(p.id)}
              style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:periodeId===p.id?700:400,
                background:periodeId===p.id?'#378ADD':'rgba(255,255,255,0.08)',
                color:periodeId===p.id?'#fff':'#9FE1CB',
                border:'1px solid '+(periodeId===p.id?'#378ADD':'rgba(255,255,255,0.15)')}}>
              {p.label}
            </div>
          ))}
          {periodes.map(p => (
            <div key={p.id} onClick={()=>setPeriodeId(p.id)}
              style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:periodeId===p.id?700:400,
                background:periodeId===p.id?'#534AB7':'rgba(255,255,255,0.08)',
                color:periodeId===p.id?'#fff':'#9FE1CB',
                border:'1px solid '+(periodeId===p.id?'#534AB7':'rgba(255,255,255,0.15)'),
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
            background:vue==='global'?'#1D9E75':'rgba(255,255,255,0.08)',
            color:vue==='global'?'#fff':'#5DCAA5',
            border:'1px solid '+(vue==='global'?'#1D9E75':'rgba(255,255,255,0.15)')}}>
          🌍 {lang==='ar'?'الكل':'Global'}
        </div>
        {niveauxVues.map(n => (
          <div key={n.code} onClick={()=>setVue(n.code)}
            style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:vue===n.code?700:400,
              background:vue===n.code?n.color:'rgba(255,255,255,0.08)',
              color:vue===n.code?'#fff':'#9FE1CB',
              border:'1px solid '+(vue===n.code?n.color:'rgba(255,255,255,0.15)')}}>
            {n.label}
          </div>
        ))}
      </div>

      {loading ? <div style={{color:'#5DCAA5',textAlign:'center',padding:'3rem'}}>...</div> : (
        <>
          {elevesClasses.length === 0 ? (
            <div style={{textAlign:'center',color:'#3a6657',padding:'3rem',fontSize:14}}>
              {lang==='ar'?'لا توجد استظهارات في هذه الفترة':'Aucune récitation sur cette période'}
            </div>
          ) : (
            <>
              {/* Podium */}
              {elevesClasses.length >= 3 && (
                <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:12,marginBottom:'2.5rem'}}>
                  {[1,0,2].map(rank => {
                    const e = elevesClasses[rank];
                    if (!e) return null;
                    return (
                      <div key={e.id} onClick={()=>navigate('fiche',e)} style={{flex:1,maxWidth:160,display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer'}}>
                        {rank===0 && <div style={{fontSize:24,marginBottom:4}}>👑</div>}
                        <div style={{width:rank===0?60:48,height:rank===0?60:48,borderRadius:'50%',background:podiumBg[rank],display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:rank===0?22:18,color:podiumColors[rank]}}>{getInitiales(e.prenom,e.nom)}</div>
                        <div style={{fontSize:rank===0?13:12,fontWeight:600,color:'#fff',marginTop:8,textAlign:'center'}}>{e.prenom} {e.nom}</div>
                        <div style={{fontSize:rank===0?18:15,fontWeight:800,color:podiumColors[rank],margin:'4px 0'}}>{e.ptsPeriode.total.toLocaleString()} {t(lang,'pts_abrev')}</div>
                        <div style={{fontSize:10,color:podiumColors[rank],opacity:0.7}}>{e.ptsPeriode.tomonPeriode} {t(lang,'tomon_abrev')} · {e.ptsPeriode.hizbsPeriode} {t(lang,'hizb_abrev')}</div>
                        <div style={{width:'100%',height:rank===0?120:90,background:podiumBg[rank]+'22',border:`1px solid ${podiumColors[rank]}40`,borderRadius:'8px 8px 0 0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <span style={{fontSize:rank===0?40:30,fontWeight:800,color:podiumColors[rank],opacity:0.6}}>{rank+1}</span>
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
                      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:12,marginBottom:8,cursor:'pointer'}}>
                      <div style={{fontSize:18,minWidth:32,textAlign:'center'}}>
                        {medals[idx] || <span style={{color:'#3a6657',fontSize:13,fontWeight:700}}>{idx+1}</span>}
                      </div>
                      <div style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'#9FE1CB',flexShrink:0}}>{getInitiales(e.prenom,e.nom)}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:600,color:'#fff'}}>{e.prenom} {e.nom}</div>
                        <div style={{fontSize:11,color:'#5DCAA5',marginTop:2}}>
                          {e.ptsPeriode.tomonPeriode} {t(lang,'tomon_abrev')}
                          {e.ptsPeriode.hizbsPeriode > 0 && ` · ${e.ptsPeriode.hizbsPeriode} ${t(lang,'hizb_abrev')} ✓`}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:16,fontWeight:800,color:'#EF9F27'}}>{e.ptsPeriode.total.toLocaleString()}</div>
                        <div style={{fontSize:10,color:'#3a6657'}}>{t(lang,'pts_abrev')}</div>
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
