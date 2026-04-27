import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import ConfirmModal from '../components/ConfirmModal';
import { fetchAll } from '../lib/fetchAll';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import ExportButtons from '../components/ExportButtons';

const getNiveauColor = (code, niveaux=[]) => niveaux.find(n=>n.code===code)?.couleur || {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[code] || '#888';

export default function MurajaDashboard({ user, navigate, goBack, lang='fr', isMobile }) {
  const [recitations, setRecitations] = useState([]);
  const [validations, setValidations] = useState([]);
  const [eleves, setEleves]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [niveaux, setNiveaux]           = useState([]);
  const [filterNiveau, setFilterNiveau] = useState('tous');
  const [filterPeriode, setFilterPeriode] = useState(30);

  // Edit state
  const [editingSession, setEditingSession]   = useState(null); // session object
  const [editExclus, setEditExclus]           = useState({});   // id→true if removed
  const [editSaving, setEditSaving]           = useState(false);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({ isOpen:false, title:'', message:'', onConfirm:null });
  const showConfirm = (title, message, onConfirm) => setConfirmModal({ isOpen:true, title, message, onConfirm, confirmLabel:lang==='ar'?'حذف':'Supprimer', confirmColor:'#E24B4A' });
  const hideConfirm = () => setConfirmModal(m=>({...m,isOpen:false,onConfirm:null}));

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
    const [{ data: recs }, { data: vals }, { data: elevs }, { data: nivs }] = await Promise.all([
      supabase.from('recitations_sourates')
        .select('id,date_validation,type_recitation,verset_debut,verset_fin,points,is_muraja, eleve:eleve_id(id,prenom,nom,code_niveau), sourate:sourate_id(numero,nom_ar), valideur:valide_par(prenom,nom)')
        .eq('ecole_id', user.ecole_id)
        .eq('is_muraja', true)
        .order('date_validation', { ascending: false })
        .limit(500),
      supabase.from('validations')
        .select('id,date_validation,type_validation,nombre_tomon,tomon_debut,hizb_validation,is_muraja, eleve:eleve_id(id,prenom,nom,code_niveau), valideur:valide_par(prenom,nom)')
        .eq('ecole_id', user.ecole_id)
        .in('type_validation', ['tomon_muraja','hizb_muraja'])
        .order('date_validation', { ascending: false })
        .limit(500),
      supabase.from('eleves').select('id,prenom,nom,code_niveau')
        .eq('ecole_id', user.ecole_id).order('nom'),
      supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
    ]);
    setRecitations(recs || []);
    setValidations(vals || []);
    setEleves(elevs || []);
    setNiveaux(nivs || []);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  // Build flat records list with ids
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - filterPeriode);

  const allMuraja = [
    ...(recitations||[]).map(r => ({
      id: r.id, source: 'sourate',
      date: r.date_validation,
      niveau: r.eleve?.code_niveau || '?',
      eleve: r.eleve,
      contenu: r.sourate?.nom_ar || '?',
      type: r.type_recitation === 'complete' ? (lang==='ar'?'سورة كاملة':'Sourate complète') : (lang==='ar'?'تسلسل':'Séquence'),
      valideur: r.valideur ? `${r.valideur.prenom} ${r.valideur.nom}` : '?',
      valideurId: r.valide_par,
    })),
    ...(validations||[]).map(v => ({
      id: v.id, source: 'hizb',
      date: v.date_validation,
      niveau: v.eleve?.code_niveau || '?',
      eleve: v.eleve,
      contenu: v.type_validation === 'hizb_muraja' ? `Hizb ${v.hizb_validation}` : `Hizb ${v.hizb_validation} — T${v.tomon_debut} ×${v.nombre_tomon}`,
      type: v.type_validation === 'hizb_muraja' ? (lang==='ar'?'حزب كامل':'Hizb complet') : (lang==='ar'?'ثُمن':'Tomon'),
      valideur: v.valideur ? `${v.valideur.prenom} ${v.valideur.nom}` : '?',
      valideurId: v.valide_par,
    })),
  ]
  .filter(m => new Date(m.date) >= cutoff)
  .filter(m => filterNiveau === 'tous' || m.niveau === filterNiveau)
  .sort((a,b) => new Date(b.date) - new Date(a.date));

  // Group into sessions
  const sessions = {};
  allMuraja.forEach(m => {
    const dateKey = m.date.slice(0,10);
    const key = `${dateKey}|${m.contenu}|${m.niveau}|${m.valideur}`;
    if (!sessions[key]) sessions[key] = {
      key, date: dateKey, contenu: m.contenu, type: m.type,
      niveau: m.niveau, valideur: m.valideur, valideurId: m.valideurId,
      color: getNiveauColor(m.niveau, niveaux), source: m.source,
      records: [], eleves: [],
    };
    sessions[key].records.push({ id: m.id, source: m.source });
    if (m.eleve) sessions[key].eleves.push(m.eleve);
  });
  const sessionList = Object.values(sessions).sort((a,b) => b.date.localeCompare(a.date));

  // Stats per niveau
  const statsByNiveau = niveaux.map(n => {
    const items = allMuraja.filter(m => m.niveau === n.code);
    const totalEleves = eleves.filter(e => e.code_niveau === n.code).length;
    const uniqueEleves = new Set(items.map(m => m.eleve?.id).filter(Boolean)).size;
    const color = n.couleur || getNiveauColor(n.code, niveaux);
    return { niveau:n.code, label:n.nom, nb:items.length, uniqueEleves, totalEleves, taux: totalEleves>0?Math.round(uniqueEleves/totalEleves*100):0, color };
  }).filter(s => s.totalEleves > 0);

  const absenteesParNiveau = filterNiveau !== 'tous' ? eleves.filter(e => {
    if (e.code_niveau !== filterNiveau) return false;
    return !allMuraja.some(m => m.eleve?.id === e.id);
  }) : [];
  const niveauxCodes = niveaux.map(n => n.code);

  // ── DELETE session ──
  const handleDelete = (session) => {
    const label = `${session.contenu} — ${session.date} (${session.eleves.length} ${lang==='ar'?'طالب':'élève(s)'})`;
    showConfirm(
      lang==='ar'?'حذف المراجعة الجماعية':'Supprimer la muraja\u02bca',
      (lang==='ar'?'هل تريد حذف:':'Supprimer :') + ' ' + label + ' ?',
      async () => {
        const souIds = session.records.filter(r=>r.source==='sourate').map(r=>r.id);
        const valIds = session.records.filter(r=>r.source==='hizb').map(r=>r.id);
        if (souIds.length) await supabase.from('recitations_sourates').delete().in('id', souIds);
        if (valIds.length) await supabase.from('validations').delete().in('id', valIds);
        hideConfirm();
        await loadData();
      }
    );
  };

  // ── EDIT session : toggle eleves ──
  const startEdit = (session) => {
    setEditingSession(session);
    setEditExclus({});
  };

  const toggleEditExclu = (eleveId) => setEditExclus(prev => ({...prev, [eleveId]: !prev[eleveId]}));

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    setEditSaving(true);
    // Delete records for excluded eleves
    const toDelete = editingSession.records.filter(r => {
      const eleve = editingSession.eleves.find(e => {
        const rec = allMuraja.find(m => m.id === r.id && m.source === r.source);
        return rec?.eleve?.id && editExclus[rec.eleve.id];
      });
      return !!eleve;
    });
    // Simpler: re-fetch records with eleve_id and delete those matching excluded
    const excludedIds = Object.keys(editExclus).filter(id => editExclus[id]);
    if (excludedIds.length > 0) {
      const souIds = (recitations||[]).filter(r =>
        editingSession.records.some(rec=>rec.id===r.id&&rec.source==='sourate') &&
        excludedIds.includes(String(r.eleve?.id))
      ).map(r=>r.id);
      const valIds = (validations||[]).filter(v =>
        editingSession.records.some(rec=>rec.id===v.id&&rec.source==='hizb') &&
        excludedIds.includes(String(v.eleve?.id))
      ).map(v=>v.id);
      if (souIds.length) await supabase.from('recitations_sourates').delete().in('id', souIds);
      if (valIds.length) await supabase.from('validations').delete().in('id', valIds);
    }
    setEditSaving(false);
    setEditingSession(null);
    setEditExclus({});
    await loadData();
  };

  // ── Eleves du niveau pour edit (add eleves) ──
  const elevesDuNiveau = editingSession ? eleves.filter(e => e.code_niveau === editingSession.niveau) : [];
  const elevesDejaInclus = editingSession ? new Set(editingSession.eleves.map(e=>e.id)) : new Set();

  // ── Préparer les données d'export ──
  const prepareExportSessions = () => {
    return sessionList.map(sess => {
      const niveau = niveaux.find(n => n.code === sess.niveau);
      return {
        date: sess.date,
        contenu: sess.contenu,
        niveau: niveau?.nom || sess.niveau,
        niveau_couleur: sess.color,
        valideur: sess.valideur || '—',
        nbEleves: sess.eleves.length,
        eleves: sess.eleves.map(e => `${e.prenom || ''} ${e.nom || ''}`.trim()).join(', '),
      };
    });
  };

  // ── Export PDF ──
  const handleExportPDF = async () => {
    if (sessionList.length === 0) return;
    const sessionsData = prepareExportSessions();
    const totalParticipations = sessionList.reduce((s, sess) => s + sess.eleves.length, 0);
    try {
      await openPDF('rapport_muraja', {
        ecole: { nom: user?.ecole?.nom || '' },
        filtrePeriode: filterPeriode,
        filtreNiveau: filterNiveau === 'tous' ? null : filterNiveau,
        stats: {
          totalSessions: sessionList.length,
          totalEleves: totalParticipations,
          parNiveau: statsByNiveau,
        },
        sessions: sessionsData,
      }, lang);
    } catch (err) {
      alert((lang === 'ar' ? 'خطأ PDF : ' : 'Erreur PDF : ') + err.message);
    }
  };

  // ── Export Excel ──
  const handleExportExcel = async () => {
    if (sessionList.length === 0) return;
    const headers = [
      '#',
      lang === 'ar' ? 'التاريخ' : 'Date',
      lang === 'ar' ? 'المحتوى' : 'Contenu',
      lang === 'ar' ? 'المستوى' : 'Niveau',
      lang === 'ar' ? 'المُقيّم' : 'Valideur',
      lang === 'ar' ? 'عدد الطلاب' : 'Nb élèves',
      lang === 'ar' ? 'الطلاب' : 'Élèves',
    ];
    const rows = prepareExportSessions().map((s, i) => [
      i + 1,
      s.date,
      s.contenu,
      s.niveau,
      s.valideur,
      s.nbEleves,
      s.eleves,
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      await exportExcelSimple(
        `muraja_${dateStr}.xlsx`,
        [headers, ...rows],
        lang === 'ar' ? 'المراجعات' : 'Muraja',
      );
    } catch (err) {
      alert((lang === 'ar' ? 'خطأ Excel : ' : 'Erreur Excel : ') + err.message);
    }
  };

  if (loading) return <div style={{padding:'2rem',textAlign:'center'}}><div className="loading">...</div></div>;

  return (
    <div style={{paddingBottom: isMobile ? 80 : 0, padding: isMobile ? 0 : '1rem',maxWidth:800,margin:'0 auto',background: isMobile ? '#f5f5f0' : 'transparent',minHeight: isMobile ? '100vh' : 'auto'}}>
      {isMobile ? (
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 16px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}></button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>📖 {lang==='ar'?'المراجعة الجماعية':"Muraja'a"}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.75)'}}>{lang==='ar'?'تتبع المراجعات الجماعية':'Suivi des révisions collectives'}</div>
            </div>
            <button onClick={()=>navigate('muraja')}
              style={{background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'8px 14px',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0,whiteSpace:'nowrap'}}>
              + {lang==='ar'?'جديد':'Nouveau'}
            </button>
          </div>
          {/* Filtres mobiles */}
          <div style={{display:'flex',gap:6}}>
            <select value={filterNiveau} onChange={e=>setFilterNiveau(e.target.value)}
              style={{flex:1,padding:'8px 10px',borderRadius:10,border:'none',fontSize:12,fontFamily:'inherit',background:'rgba(255,255,255,0.2)',color:'#fff',outline:'none'}}>
              <option value="tous" style={{color:'#333'}}>{lang==='ar'?'كل المستويات':'Tous niveaux'}</option>
              {niveaux.map(n=><option key={n.code} value={n.code} style={{color:'#333'}}>{n.code} — {n.nom}</option>)}
            </select>
            <select value={filterPeriode} onChange={e=>setFilterPeriode(parseInt(e.target.value))}
              style={{flex:1,padding:'8px 10px',borderRadius:10,border:'none',fontSize:12,fontFamily:'inherit',background:'rgba(255,255,255,0.2)',color:'#fff',outline:'none'}}>
              <option value={7} style={{color:'#333'}}>7j</option>
              <option value={30} style={{color:'#333'}}>30j</option>
              <option value={90} style={{color:'#333'}}>3 {lang==='ar'?'أشهر':'mois'}</option>
              <option value={365} style={{color:'#333'}}>{lang==='ar'?'سنة':'1 an'}</option>
            </select>
            <button onClick={loadData} style={{padding:'8px 12px',background:'rgba(255,255,255,0.2)',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',flexShrink:0,fontSize:14}}>🔄</button>
          </div>
          {/* Export mobile */}
          {sessionList.length > 0 && (
            <div style={{display:'flex',gap:6,marginTop:8}}>
              <button onClick={handleExportPDF}
                style={{flex:1,background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>
                📄 PDF
              </button>
              <button onClick={handleExportExcel}
                style={{flex:1,background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit'}}>
                📊 Excel
              </button>
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Header PC */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',gap:12,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:200}}>
          <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}></button>
          <div style={{fontSize:20,fontWeight:800,color:'#1a1a1a'}}>
            📖 {lang==='ar'?'المراجعة الجماعية':"Muraja'a"}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>navigate('muraja')}
            style={{padding:'7px 14px',background:'#085041',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            + {lang==='ar'?'مراجعة جديدة':'Nouvelle'}
          </button>
          {sessionList.length > 0 && (
            <ExportButtons
              onPDF={handleExportPDF}
              onExcel={handleExportExcel}
              lang={lang}
              variant="inline"
              compact
            />
          )}
        </div>
      </div>
      {/* Filters PC */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <select className="field-select" style={{flex:1,minWidth:120}} value={filterNiveau} onChange={e=>setFilterNiveau(e.target.value)}>
          <option value="tous">{lang==='ar'?'جميع المستويات':'Tous les niveaux'}</option>
          {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
        </select>
        <select className="field-select" style={{flex:1,minWidth:120}} value={filterPeriode} onChange={e=>setFilterPeriode(parseInt(e.target.value))}>
          <option value={7}>{lang==='ar'?'آخر 7 أيام':'7 derniers jours'}</option>
          <option value={30}>{lang==='ar'?'آخر 30 يوم':'30 derniers jours'}</option>
          <option value={90}>{lang==='ar'?'آخر 3 أشهر':'3 derniers mois'}</option>
          <option value={365}>{lang==='ar'?'آخر سنة':'Dernière année'}</option>
        </select>
        <button onClick={loadData} style={{padding:'6px 14px',background:'#E1F5EE',color:'#085041',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer'}}>🔄</button>
      </div>
      </>
      )}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:20}}>
        {statsByNiveau.map(s=>(
          <div key={s.niveau} style={{background:`${s.color}10`,border:`1.5px solid ${s.color}30`,borderRadius:12,padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:16,fontWeight:800,color:s.color,marginBottom:4}}>{s.niveau}</div>
            <div style={{fontSize:22,fontWeight:800,color:'#1a1a1a'}}>{s.nb}</div>
            <div style={{fontSize:10,color:'#888',marginBottom:6}}>{lang==='ar'?'استظهار':'entrées'}</div>
            <div style={{height:6,borderRadius:3,background:'#e0e0d8',overflow:'hidden',marginBottom:4}}>
              <div style={{height:'100%',width:`${s.taux}%`,background:s.color,borderRadius:3}}/>
            </div>
            <div style={{fontSize:10,color:s.color,fontWeight:600}}>{s.uniqueEleves}/{s.totalEleves} ({s.taux}%)</div>
          </div>
        ))}
      </div>

      {/* Absentees */}
      {absenteesParNiveau.length>0&&(
        <div style={{background:'#FFF3CD',border:'1.5px solid #FFECB5',borderRadius:12,padding:'12px',marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#856404',marginBottom:8}}>
            ⚠️ {lang==='ar'?'لم يشاركوا في أي مراجعة:':'Sans muraja\u02bca sur cette période :'}
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {absenteesParNiveau.map(e=>(
              <span key={e.id} style={{padding:'3px 8px',background:'#fff',borderRadius:10,fontSize:12,color:'#856404',border:'1px solid #FFECB5'}}>{e.prenom} {e.nom}</span>
            ))}
          </div>
        </div>
      )}

      {/* Session list */}
      <div style={{fontSize:14,fontWeight:600,marginBottom:10,color:'#333'}}>
        📋 {lang==='ar'?'سجل المراجعات':'Historique des muraja\u02bca'} ({sessionList.length})
      </div>

      {sessionList.length===0?(
        <div style={{textAlign:'center',color:'#aaa',padding:'2rem',background:'#fafaf8',borderRadius:12}}>
          {lang==='ar'?'لا توجد مراجعات في هذه الفترة':'Aucune muraja\u02bca enregistrée sur cette période'}
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {sessionList.map((s,i)=>{
            const nc = s.color;
            const isEditing = editingSession?.key === s.key;
            return (
              <div key={i} style={{background:'#fff',border:`1.5px solid ${isEditing?nc:nc+'20'}`,borderRadius:12,padding:'12px 14px',transition:'border 0.2s'}}>
                {/* Header row */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <span style={{padding:'2px 8px',borderRadius:8,background:`${nc}20`,color:nc,fontWeight:700,fontSize:12}}>{s.niveau}</span>
                  <span style={{fontWeight:700,fontSize:14,flex:1}}>{s.contenu}</span>
                  <span style={{padding:'2px 8px',borderRadius:8,background:'#FFF3CD',color:'#856404',fontSize:11,fontWeight:600}}>📖 {s.type}</span>
                  {/* Action buttons */}
                  {user.role==='surveillant'&&!isEditing&&(
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>startEdit(s)} style={{padding:'3px 8px',background:'#E6F1FB',color:'#378ADD',border:'0.5px solid #378ADD30',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏️</button>
                      <button onClick={()=>handleDelete(s)} style={{padding:'3px 8px',background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>🗑</button>
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div style={{display:'flex',gap:16,fontSize:11,color:'#888',marginBottom:8}}>
                  <span>📅 {new Date(s.date).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{weekday:'long',day:'numeric',month:'long'})}</span>
                  <span>👤 {s.valideur}</span>
                  <span style={{color:nc,fontWeight:600}}>👥 {s.eleves.length} {lang==='ar'?'طالب':'élève(s)'}</span>
                </div>

                {/* Normal view: eleve badges */}
                {!isEditing&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {s.eleves.map((e,j)=>(
                      <span key={j} style={{padding:'2px 8px',background:`${nc}10`,borderRadius:10,fontSize:11,color:'#444',border:`1px solid ${nc}20`}}>
                        {e.prenom} {e.nom}
                      </span>
                    ))}
                  </div>
                )}

                {/* Edit mode */}
                {isEditing&&(
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:'#378ADD',marginBottom:8}}>
                      ✏️ {lang==='ar'?'تعديل قائمة الطلاب — انقر لاستثناء/إضافة طالب':'Modifier les élèves — cliquer pour exclure/inclure'}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:250,overflowY:'auto',marginBottom:10}}>
                      {elevesDuNiveau.map(e=>{
                        const inclus = elevesDejaInclus.has(e.id);
                        const exclu  = editExclus[e.id];
                        const present = inclus && !exclu;
                        return (
                          <div key={e.id} onClick={()=>{ if(inclus) toggleEditExclu(e.id); }}
                            style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',borderRadius:8,cursor:inclus?'pointer':'default',
                              background:!inclus?'#f5f5f0':exclu?'#FCEBEB':'#E1F5EE',
                              border:`1px solid ${!inclus?'#e0e0d8':exclu?'#E24B4A30':'#1D9E7530'}`}}>
                            <div style={{width:18,height:18,borderRadius:4,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                              background:!inclus?'#e0e0d8':exclu?'#E24B4A':'#1D9E75',color:'#fff',fontSize:10}}>
                              {!inclus?'—':exclu?'✕':'✓'}
                            </div>
                            <span style={{flex:1,fontSize:13,fontWeight:present?600:400,
                              color:!inclus?'#bbb':exclu?'#E24B4A':'#1D9E75',
                              textDecoration:exclu?'line-through':'none'}}>
                              {e.prenom} {e.nom}
                            </span>
                            {!inclus&&<span style={{fontSize:10,color:'#bbb'}}>{lang==='ar'?'غير مسجل':'non inclus'}</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>{setEditingSession(null);setEditExclus({});}} className="back-link" style={{fontSize:12}}>
                        {lang==='ar'?'إلغاء':'Annuler'}
                      </button>
                      <button onClick={handleSaveEdit} disabled={editSaving}
                        style={{flex:1,padding:'8px',background:editSaving?'#ccc':'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontWeight:600,cursor:'pointer',fontSize:13}}>
                        {editSaving?'...':(lang==='ar'?'✓ حفظ التعديلات':'✓ Sauvegarder')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message}
        onConfirm={confirmModal.onConfirm} onCancel={hideConfirm}
        confirmLabel={confirmModal.confirmLabel} confirmColor={confirmModal.confirmColor} lang={lang}/>
    </div>
  );
}
