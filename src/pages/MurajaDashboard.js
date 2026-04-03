import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

const NIVEAU_COLORS = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };
const NIVEAUX = ['5B','5A','2M','2','1'];

export default function MurajaDashboard({ user, navigate, goBack, lang='fr' }) {
  const [recitations, setRecitations] = useState([]);  // is_muraja sourates
  const [validations, setValidations] = useState([]);  // is_muraja tomon/hizb
  const [eleves, setEleves]           = useState([]);
  const [sourates, setSourates]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filterNiveau, setFilterNiveau] = useState('tous');
  const [filterPeriode, setFilterPeriode] = useState(30); // days

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: recs }, { data: vals }, { data: elevs }, { data: sdb }] = await Promise.all([
      supabase.from('recitations_sourates')
        .select('*, eleve:eleve_id(id,prenom,nom,code_niveau), sourate:sourate_id(numero,nom_ar), valideur:valide_par(prenom,nom)')
        .eq('is_muraja', true)
        .order('date_validation', { ascending: false })
        .limit(500),
      supabase.from('validations')
        .select('*, eleve:eleve_id(id,prenom,nom,code_niveau), valideur:valide_par(prenom,nom)')
        .in('type_validation', ['tomon_muraja','hizb_muraja'])
        .order('date_validation', { ascending: false })
        .limit(500),
      supabase.from('eleves').select('id,prenom,nom,code_niveau'),
      supabase.from('sourates').select('id,numero,nom_ar'),
    ]);
    setRecitations(recs || []);
    setValidations(vals || []);
    setEleves(elevs || []);
    setSourates(sdb || []);
    setLoading(false);
  };

  // Merge all murajaʼa records
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - filterPeriode);

  const allMuraja = [
    ...(recitations || []).map(r => ({
      id: r.id,
      date: r.date_validation,
      niveau: r.eleve?.code_niveau || '?',
      eleve: r.eleve,
      contenu: r.sourate?.nom_ar || '?',
      type: r.type_recitation === 'complete' ? (lang==='ar'?'سورة كاملة':'Sourate complète') : (lang==='ar'?'تسلسل':'Séquence'),
      valideur: r.valideur ? `${r.valideur.prenom} ${r.valideur.nom}` : '?',
      source: 'sourate',
    })),
    ...(validations || []).map(v => ({
      id: v.id,
      date: v.date_validation,
      niveau: v.eleve?.code_niveau || '?',
      eleve: v.eleve,
      contenu: v.type_validation === 'hizb_muraja' ? `Hizb ${v.hizb_validation}` : `Hizb ${v.hizb_validation} — T${v.tomon_debut} ×${v.nombre_tomon}`,
      type: v.type_validation === 'hizb_muraja' ? (lang==='ar'?'حزب كامل':'Hizb complet') : (lang==='ar'?'ثُمن':'Tomon'),
      valideur: v.valideur ? `${v.valideur.prenom} ${v.valideur.nom}` : '?',
      source: 'hizb',
    })),
  ]
  .filter(m => new Date(m.date) >= cutoff)
  .filter(m => filterNiveau === 'tous' || m.niveau === filterNiveau)
  .sort((a,b) => new Date(b.date) - new Date(a.date));

  // Group by session (date + contenu + valideur)
  const sessions = {};
  allMuraja.forEach(m => {
    const dateKey = m.date.slice(0,10);
    const key = `${dateKey}|${m.contenu}|${m.niveau}|${m.valideur}`;
    if (!sessions[key]) sessions[key] = { date: dateKey, contenu: m.contenu, type: m.type, niveau: m.niveau, valideur: m.valideur, eleves: [], color: NIVEAU_COLORS[m.niveau]||'#888' };
    if (m.eleve) sessions[key].eleves.push(m.eleve);
  });
  const sessionList = Object.values(sessions).sort((a,b) => b.date.localeCompare(a.date));

  // Stats per niveau
  const statsByNiveau = NIVEAUX.map(n => {
    const items = allMuraja.filter(m => m.niveau === n);
    const totalEleves = eleves.filter(e => e.code_niveau === n).length;
    const uniqueEleves = new Set(items.map(m => m.eleve?.id).filter(Boolean)).size;
    return { niveau: n, nb: items.length, uniqueEleves, totalEleves, taux: totalEleves > 0 ? Math.round(uniqueEleves/totalEleves*100) : 0, color: NIVEAU_COLORS[n] };
  }).filter(s => s.totalEleves > 0);

  // Absentees per niveau (élèves qui n'ont aucune murajaʼa dans la période)
  const absenteesParNiveau = filterNiveau !== 'tous' ? eleves.filter(e => {
    if (e.code_niveau !== filterNiveau) return false;
    return !allMuraja.some(m => m.eleve?.id === e.id);
  }) : [];

  if (loading) return <div style={{padding:'2rem',textAlign:'center'}}><div className="loading">...</div></div>;

  return (
    <div style={{padding:'1rem',maxWidth:800,margin:'0 auto'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:'1.2rem'}}>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>← {t(lang,'retour')}</button>
        <div style={{fontSize:17,fontWeight:700,color:'#085041'}}>
          📊 {lang==='ar'?'لوحة تتبع المراجعة الجماعية':"Tableau de bord Muraja'a"}
        </div>
        <button onClick={()=>navigate('muraja')} style={{marginLeft:'auto',padding:'6px 14px',background:'#085041',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
          + {lang==='ar'?'مراجعة جديدة':"Nouvelle murajaʼa"}
        </button>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <select className="field-select" style={{flex:1,minWidth:120}} value={filterNiveau} onChange={e=>setFilterNiveau(e.target.value)}>
          <option value="tous">{lang==='ar'?'جميع المستويات':'Tous les niveaux'}</option>
          {NIVEAUX.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <select className="field-select" style={{flex:1,minWidth:120}} value={filterPeriode} onChange={e=>setFilterPeriode(parseInt(e.target.value))}>
          <option value={7}>{lang==='ar'?'آخر 7 أيام':'7 derniers jours'}</option>
          <option value={30}>{lang==='ar'?'آخر 30 يوم':'30 derniers jours'}</option>
          <option value={90}>{lang==='ar'?'آخر 3 أشهر':'3 derniers mois'}</option>
          <option value={365}>{lang==='ar'?'آخر سنة':'Dernière année'}</option>
        </select>
        <button onClick={loadData} style={{padding:'6px 14px',background:'#E1F5EE',color:'#085041',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer'}}>
          🔄
        </button>
      </div>

      {/* Stats par niveau */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:20}}>
        {statsByNiveau.map(s=>(
          <div key={s.niveau} style={{background:`${s.color}10`,border:`1.5px solid ${s.color}30`,borderRadius:12,padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:16,fontWeight:800,color:s.color,marginBottom:4}}>{s.niveau}</div>
            <div style={{fontSize:22,fontWeight:800,color:'#1a1a1a'}}>{s.nb}</div>
            <div style={{fontSize:10,color:'#888',marginBottom:6}}>{lang==='ar'?'استظهار':'entrées'}</div>
            {/* Participation bar */}
            <div style={{height:6,borderRadius:3,background:'#e0e0d8',overflow:'hidden',marginBottom:4}}>
              <div style={{height:'100%',width:`${s.taux}%`,background:s.color,borderRadius:3}}/>
            </div>
            <div style={{fontSize:10,color:s.color,fontWeight:600}}>
              {s.uniqueEleves}/{s.totalEleves} {lang==='ar'?'طالب شارك':'participé'} ({s.taux}%)
            </div>
          </div>
        ))}
      </div>

      {/* Absentees warning */}
      {absenteesParNiveau.length > 0 && (
        <div style={{background:'#FFF3CD',border:'1.5px solid #FFECB5',borderRadius:12,padding:'12px',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#856404',marginBottom:8}}>
            ⚠️ {lang==='ar'?'لم يشاركوا في أي مراجعة خلال هذه الفترة:':'Aucune muraja\'a enregistrée pour cette période :'}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {absenteesParNiveau.map(e=>(
              <span key={e.id} style={{padding:'3px 8px',background:'#fff',borderRadius:10,fontSize:12,color:'#856404',border:'1px solid #FFECB5'}}>
                {e.prenom} {e.nom}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sessions list */}
      <div style={{fontSize:14,fontWeight:600,marginBottom:10,color:'#333'}}>
        📋 {lang==='ar'?'سجل المراجعات الجماعية':'Historique des muraja\'a'} ({sessionList.length})
      </div>

      {sessionList.length === 0 ? (
        <div style={{textAlign:'center',color:'#aaa',padding:'2rem',background:'#fafaf8',borderRadius:12}}>
          {lang==='ar'?'لا توجد مراجعات جماعية في هذه الفترة':"Aucune murajaʼa enregistrée sur cette période"}
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {sessionList.map((s,i)=>{
            const nc = s.color;
            return (
              <div key={i} style={{background:'#fff',border:`1.5px solid ${nc}20`,borderRadius:12,padding:'12px 14px'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <span style={{padding:'2px 8px',borderRadius:8,background:`${nc}20`,color:nc,fontWeight:700,fontSize:12}}>{s.niveau}</span>
                  <span style={{fontWeight:700,fontSize:14,flex:1}}>{s.contenu}</span>
                  <span style={{padding:'2px 8px',borderRadius:8,background:'#FFF3CD',color:'#856404',fontSize:11,fontWeight:600}}>
                    📖 {s.type}
                  </span>
                </div>
                <div style={{display:'flex',gap:16,fontSize:11,color:'#888',marginBottom:8}}>
                  <span>📅 {new Date(s.date).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{weekday:'long',day:'numeric',month:'long'})}</span>
                  <span>👤 {s.valideur}</span>
                  <span style={{color:nc,fontWeight:600}}>👥 {s.eleves.length} {lang==='ar'?'طالب':'élève(s)'}</span>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {s.eleves.map((e,j)=>(
                    <span key={j} style={{padding:'2px 8px',background:`${nc}10`,borderRadius:10,fontSize:11,color:'#444',border:`1px solid ${nc}20`}}>
                      {e.prenom} {e.nom}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
