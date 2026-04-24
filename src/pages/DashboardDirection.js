import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { BAREME_DEFAUT, loadBareme } from '../lib/helpers';
import { fetchAll } from '../lib/fetchAll';
import { openPDF } from '../lib/pdf';
import { exportExcel } from '../lib/excel';
import ExportButtons from '../components/ExportButtons';

// ─── Couleurs par niveau ───────────────────────────────────────────────────
const NC = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };
const getNc = (niveaux, code) =>
  (niveaux||[]).find(n=>n.code===code)?.couleur || NC[code] || '#888';

// ─── Composants UI ────────────────────────────────────────────────────────
function KpiCard({ icon, val, label, sub, color='#085041', bg='#E1F5EE', onClick }) {
  return (
    <div onClick={onClick}
      style={{background:bg,borderRadius:14,padding:'16px 14px',cursor:onClick?'pointer':'default',
        border:`0.5px solid ${color}20`,transition:'transform 0.1s'}}
      onMouseEnter={e=>{if(onClick)e.currentTarget.style.transform='scale(1.02)'}}
      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
      <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:800,color,lineHeight:1}}>{val}</div>
      <div style={{fontSize:12,color,opacity:0.8,marginTop:4,fontWeight:600}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:'#888',marginTop:3}}>{sub}</div>}
    </div>
  );
}

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
  const [loading, setLoading] = useState(true);
  const [eleves, setEleves] = useState([]);
  const [validations, setValidations] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [certificats, setCertificats] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [passages, setPassages] = useState([]);
  const [ecole, setEcole] = useState(null);
  const [bareme, setBareme] = useState(BAREME_DEFAUT);
  const [periode, setPeriode] = useState('annee'); // annee | semestre | trimestre | mois
  const [activeSection, setActiveSection] = useState('overview');
  const isAr = lang === 'ar';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      loadBareme(supabase, user.ecole_id).then(b => setBareme({...BAREME_DEFAUT,...(b?.unites||{})}));
      const [
        { data: ev }, { data: iv }, { data: vv }, { data: nv },
        { data: cv }, { data: rv }, { data: pv }, { data: ecv }
      ] = await Promise.all([
        supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id).order('nom'),
        supabase.from('utilisateurs').select('id,prenom,nom,role').eq('ecole_id', user.ecole_id).eq('role','instituteur'),
        fetchAll(supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,date_validation,valide_par,ecole_id').eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false})).then(data=>({data})),
        supabase.from('niveaux').select('*').eq('ecole_id', user.ecole_id).order('ordre'),
        supabase.from('certificats_eleves').select('id,eleve_id,jalon_id,date_obtention').eq('ecole_id', user.ecole_id).limit(500),
        fetchAll(supabase.from('recitations_sourates').select('eleve_id,date_validation,type_recitation').eq('ecole_id', user.ecole_id).order('date_validation',{ascending:false})).then(data=>({data})),
        supabase.from('passages_niveau').select('eleve_id,niveau_avant,niveau_apres,created_at').eq('ecole_id', user.ecole_id).limit(500),
        supabase.from('ecoles').select('*').eq('id', user.ecole_id).single(),
      ]);
      setEleves(ev||[]);
      setInstituteurs(iv||[]);
      setValidations(vv||[]);
      setNiveaux(nv||[]);
      setCertificats(cv||[]);
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
  const periodeDebut = useMemo(() => {
    const now = new Date();
    if (periode === 'mois') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (periode === 'trimestre') return new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
    if (periode === 'semestre') return new Date(now.getFullYear(), now.getMonth()<6?0:6, 1);
    return new Date(now.getFullYear(), 0, 1); // annee
  }, [periode]);

  const valsFiltered = useMemo(() =>
    (validations||[]).filter(v => new Date(v.date_validation) >= periodeDebut),
  [validations, periodeDebut]);

  // ─── KPIs globaux ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const elevesActifs = new Set(valsFiltered.map(v=>v.eleve_id));
    const totalTomon = valsFiltered.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+(v.nombre_tomon||0),0);
    const totalHizb = valsFiltered.filter(v=>v.type_validation==='hizb_complet').length;
    const tauxActivite = eleves.length > 0 ? Math.round(elevesActifs.size/eleves.length*100) : 0;
    const totalCerts = (certificats||[]).filter(c=>new Date(c.date_obtention)>=periodeDebut).length;
    const totalPassages = (passages||[]).filter(p=>new Date(p.created_at)>=periodeDebut).length;
    return { elevesActifs:elevesActifs.size, totalEleves:eleves.length, totalTomon, totalHizb,
      tauxActivite, totalCerts, totalPassages, totalSeances: valsFiltered.length };
  }, [valsFiltered, eleves, certificats, passages, periodeDebut]);

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
  const topEleves = useMemo(() => {
    const pts = {};
    valsFiltered.forEach(v => {
      if (!pts[v.eleve_id]) pts[v.eleve_id] = 0;
      if (v.type_validation==='tomon') pts[v.eleve_id] += (v.nombre_tomon||0) * (bareme?.tomon||1);
      if (v.type_validation==='hizb_complet') pts[v.eleve_id] += bareme?.hizb_complet||8;
    });
    return Object.entries(pts)
      .map(([id, p]) => {
        const e = (eleves||[]).find(el=>el.id===id);
        return { id, prenom:e?.prenom||'?', nom:e?.nom||'?', code_niveau:e?.code_niveau, pts:p };
      })
      .sort((a,b)=>b.pts-a.pts)
      .slice(0,5);
  }, [valsFiltered, eleves, bareme]);

  // ─── Alertes ────────────────────────────────────────────────────────────
  const alertes = useMemo(() => {
    const alerts = [];
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-21);
    const inactifs = (eleves||[]).filter(e => {
      const lastVal = (validations||[]).find(v=>v.eleve_id===e.id);
      return !lastVal || new Date(lastVal.date_validation) < cutoff;
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
  }, [eleves, validations, kpis]);

  const PERIODES = [
    { key:'mois', label:isAr?'الشهر الحالي':'Ce mois' },
    { key:'trimestre', label:isAr?'الفصل':'Trimestre' },
    { key:'semestre', label:isAr?'نصف سنة':'Semestre' },
    { key:'annee', label:isAr?'السنة الكاملة':'Année entière' },
  ];

  const periodeLabel = PERIODES.find(p => p.key === periode)?.label || '';

  // ── Préparation des données Top 10 avec points ──
  const top10AvecPoints = useMemo(() => {
    return topEleves.slice(0, 10).map((el, i) => {
      const niveau = niveaux.find(n => n.code === el.code_niveau);
      return {
        rang: i + 1,
        prenom: el.prenom || '',
        nom: el.nom || '',
        code_niveau: el.code_niveau || '',
        niveau_couleur: niveau?.couleur || getNc(niveaux, el.code_niveau),
        points: el.points || 0,
        tomon: el.tomon || 0,
        hizb: el.hizb || 0,
      };
    });
  }, [topEleves, niveaux]);

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
      alert((isAr ? 'خطأ PDF : ' : 'Erreur PDF : ') + err.message);
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
      alert((isAr ? 'خطأ Excel : ' : 'Erreur Excel : ') + err.message);
    }
  };

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:16}}>
      <div style={{fontSize:32}}>📊</div>
      <div style={{color:'#085041',fontWeight:700}}>{isAr?'جاري تحميل التقرير...':'Chargement du tableau de bord...'}</div>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // MOBILE
  // ──────────────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 16px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>📊 {isAr?'لوحة القيادة':'Tableau de bord direction'}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.75)'}}>{ecole?.nom||''}</div>
            </div>
          </div>
          {/* Sélecteur période */}
          <div style={{display:'flex',gap:6,marginTop:12,overflowX:'auto',paddingBottom:2}}>
            {PERIODES.map(p=>(
              <button key={p.key} onClick={()=>setPeriode(p.key)}
                style={{background:periode===p.key?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.1)',
                  border:`1px solid ${periode===p.key?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.2)'}`,
                  borderRadius:20,padding:'5px 12px',color:'#fff',fontSize:11,fontWeight:periode===p.key?700:400,
                  cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Export mobile */}
          <div style={{display:'flex',gap:6,marginTop:10}}>
            <button onClick={handleExportPDF}
              style={{flex:1,background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>
              📄 PDF
            </button>
            <button onClick={handleExportExcel}
              style={{flex:1,background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>
              📊 Excel
            </button>
          </div>
        </div>

        <div style={{padding:'12px'}}>
          {/* Alertes */}
          {alertes.length>0&&(
            <div style={{marginBottom:14}}>
              {alertes.map((a,i)=>(
                <div key={i} style={{background:'#fff',borderRadius:10,padding:'10px 12px',marginBottom:6,
                  display:'flex',gap:8,alignItems:'flex-start',
                  borderLeft:`3px solid ${a.type==='danger'?'#E24B4A':a.type==='warning'?'#EF9F27':a.type==='success'?'#1D9E75':'#378ADD'}`}}>
                  <span>{a.icon}</span>
                  <span style={{fontSize:12,color:'#444'}}>{a.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:16}}>
            <KpiCard icon="👥" val={kpis.elevesActifs} label={isAr?'طالب نشط':'Élèves actifs'}
              sub={`/ ${kpis.totalEleves} total`} color="#085041" bg="#E1F5EE"/>
            <KpiCard icon="📈" val={`${kpis.tauxActivite}%`} label={isAr?'نسبة النشاط':'Taux activité'}
              color={kpis.tauxActivite>=70?'#085041':kpis.tauxActivite>=50?'#EF9F27':'#E24B4A'}
              bg={kpis.tauxActivite>=70?'#E1F5EE':kpis.tauxActivite>=50?'#FEF3DA':'#FCEAEA'}/>
            <KpiCard icon="📖" val={kpis.totalTomon} label={isAr?'ثُمن مُستظهَر':'Tomon validés'}
              color="#378ADD" bg="#E6F1FB"/>
            <KpiCard icon="⭐" val={kpis.totalHizb} label={isAr?'حزب مكتمل':'Hizb complets'}
              color="#534AB7" bg="#EEEDFE"/>
            <KpiCard icon="🏅" val={kpis.totalCerts} label={isAr?'شهادة':'Certificats'}
              color="#EF9F27" bg="#FEF3DA"/>
            <KpiCard icon="🎓" val={kpis.totalPassages} label={isAr?'انتقال مستوى':'Passages niveau'}
              color="#085041" bg="#E1F5EE"/>
          </div>

          {/* Évolution mensuelle */}
          <div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:12}}>
              📅 {isAr?'التطور الشهري (الثُّمنات)':'Évolution mensuelle (tomon)'}
            </div>
            <BarChart data={evolutionMensuelle.map(m=>({label:m.label,val:m.tomon,color:'#1D9E75'}))}/>
          </div>

          {/* Par niveau */}
          <div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:12}}>
              🎯 {isAr?'الأداء حسب المستوى':'Performance par niveau'}
            </div>
            {statsByNiveau.map(s=>(
              <div key={s.code} style={{marginBottom:12,paddingBottom:12,borderBottom:'0.5px solid #f0f0ec'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{background:`${s.color}20`,color:s.color,padding:'2px 8px',borderRadius:8,fontSize:12,fontWeight:700}}>
                    {s.code}
                  </span>
                  <span style={{fontSize:11,color:'#888'}}>{s.actifs}/{s.total} actifs</span>
                </div>
                <div style={{background:'#f5f5f0',borderRadius:6,height:8,overflow:'hidden'}}>
                  <div style={{width:`${s.taux}%`,background:s.color,height:'100%',borderRadius:6}}/>
                </div>
                <div style={{display:'flex',gap:12,marginTop:6}}>
                  <span style={{fontSize:11,color:'#555'}}>📖 {s.tomon} tomon</span>
                  <span style={{fontSize:11,color:'#555'}}>⭐ {s.hizb} hizb</span>
                  <span style={{fontSize:11,color:'#555',marginLeft:'auto',fontWeight:700,color:s.color}}>{s.taux}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Top élèves */}
          <div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:12}}>
              🏆 {isAr?'أفضل الطلاب':'Top 5 élèves'}
            </div>
            {topEleves.map((e,i)=>{
              const nc = getNc(niveaux, e.code_niveau);
              return (
                <div key={e.id} onClick={()=>navigate('fiche',eleves.find(el=>el.id===e.id))}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',
                    borderBottom:'0.5px solid #f5f5f0',cursor:'pointer'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',
                    background:i<3?['#EF9F27','#888','#C4763B'][i]:`${nc}20`,
                    color:i<3?'#fff':nc,display:'flex',alignItems:'center',justifyContent:'center',
                    fontWeight:800,fontSize:13,flexShrink:0}}>
                    {i<3?['🥇','🥈','🥉'][i]:i+1}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700}}>{e.prenom} {e.nom}</div>
                    <div style={{fontSize:11,color:'#888'}}>{e.code_niveau}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:'#1D9E75'}}>{e.pts}<span style={{fontSize:10,color:'#888'}}> pts</span></div>
                </div>
              );
            })}
          </div>

          {/* Par instituteur */}
          {statsByInst.length>0&&(
            <div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:12}}>
                👨‍🏫 {isAr?'الأداء حسب الأستاذ':'Performance par instituteur'}
              </div>
              {statsByInst.map(s=>(
                <div key={s.id} style={{marginBottom:10,paddingBottom:10,borderBottom:'0.5px solid #f5f5f0'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600}}>{s.nom}</span>
                    <span style={{fontSize:12,color:'#085041',fontWeight:700}}>{s.seances} séances</span>
                  </div>
                  <div style={{display:'flex',gap:10}}>
                    <span style={{fontSize:11,color:'#888'}}>👥 {s.nbEleves} élèves</span>
                    <span style={{fontSize:11,color:'#888'}}>📖 {s.tomon} tomon</span>
                    <span style={{fontSize:11,color:'#888'}}>⚡ moy {s.moy}/élève</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DESKTOP
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{maxWidth:1100,margin:'0 auto',padding:'0 1rem 2rem'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#085041',margin:0}}>
            📊 {isAr?'لوحة قيادة المدير':'Tableau de bord direction'}
          </h1>
          <p style={{color:'#888',fontSize:13,margin:'4px 0 0'}}>{ecole?.nom} — {isAr?'نظرة شاملة على أداء المدرسة':'Vue analytique de l\'école'}</p>
        </div>
        {/* Sélecteur période */}
        <div style={{display:'flex',gap:6,background:'#f5f5f0',borderRadius:10,padding:4}}>
          {PERIODES.map(p=>(
            <button key={p.key} onClick={()=>setPeriode(p.key)}
              style={{background:periode===p.key?'#fff':'transparent',
                border:'none',borderRadius:8,padding:'6px 14px',fontSize:12,
                fontWeight:periode===p.key?700:400,color:periode===p.key?'#085041':'#888',
                cursor:'pointer',transition:'all 0.15s',
                boxShadow:periode===p.key?'0 1px 4px rgba(0,0,0,0.1)':'none'}}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export buttons */}
      <div style={{marginBottom:'1.25rem'}}>
        <ExportButtons
          onPDF={handleExportPDF}
          onExcel={handleExportExcel}
          lang={lang}
          variant="inline"
        />
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
        <KpiCard icon="👥" val={kpis.elevesActifs} label={isAr?'طالب نشط':'Élèves actifs'}
          sub={`/ ${kpis.totalEleves}`} color="#085041" bg="#E1F5EE"/>
        <KpiCard icon="📈" val={`${kpis.tauxActivite}%`} label={isAr?'نسبة النشاط':'Taux activité'}
          color={kpis.tauxActivite>=70?'#085041':kpis.tauxActivite>=50?'#EF9F27':'#E24B4A'}
          bg={kpis.tauxActivite>=70?'#E1F5EE':kpis.tauxActivite>=50?'#FEF3DA':'#FCEAEA'}/>
        <KpiCard icon="📅" val={kpis.totalSeances} label={isAr?'جلسة':'Séances'}
          color="#378ADD" bg="#E6F1FB"/>
        <KpiCard icon="📖" val={kpis.totalTomon} label={isAr?'ثُمن':'Tomon'}
          color="#378ADD" bg="#E6F1FB"/>
        <KpiCard icon="⭐" val={kpis.totalHizb} label={isAr?'حزب':'Hizb'}
          color="#534AB7" bg="#EEEDFE"/>
        <KpiCard icon="🏅" val={kpis.totalCerts} label={isAr?'شهادة':'Certificats'}
          color="#EF9F27" bg="#FEF3DA"/>
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
      </div>
    </div>
  );
}
