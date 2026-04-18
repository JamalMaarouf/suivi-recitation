import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { getSouratesForNiveau } from '../lib/sourates';

const NIVEAU_COLORS = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };
const getNiveauColor = (code, niveaux=[]) => niveaux.find(n=>n.code===code)?.couleur || NIVEAU_COLORS[code] || '#888';

const NIVEAUX = [
  { code: '5B', label: 'Préscolaire (5B)',  labelAr: 'تمهيدي (5B)',        type: 'sourate' },
  { code: '5A', label: 'Primaire 1-2 (5A)', labelAr: 'ابتدائي 1-2 (5A)',   type: 'sourate' },
  { code: '2M', label: 'Primaire 3-4 (2M)', labelAr: 'ابتدائي 3-4 (2M)',   type: 'sourate' },
  { code: '2',  label: 'Primaire 5-6 (2)',  labelAr: 'ابتدائي 5-6 (2)',    type: 'hizb' },
  { code: '1',  label: 'Collège/Lycée (1)', labelAr: 'إعدادي/ثانوي (1)',   type: 'hizb' },
];

export default function ValidationCollective({ user, navigate, goBack, lang='fr', isMobile }) {
  const [step, setStep]             = useState(1);
  const [niveauxDB, setNiveauxDB]    = useState([]);
  const [selectedNiveau, setSelectedNiveau] = useState(null);
  const [typeRecitation, setTypeRecitation] = useState('');
  const [selectedSourate, setSelectedSourate] = useState(null);
  const [selectedHizb, setSelectedHizb]   = useState(1);
  const [selectedTomon, setSelectedTomon] = useState(1);
  const [nombreTomon, setNombreTomon]     = useState(1);
  const [versetDebut, setVersetDebut]     = useState('');
  const [versetFin, setVersetFin]         = useState('');
  // Step 3 exclusion
  const [toutLeNiveau, setToutLeNiveau]   = useState(true);
  const [eleves, setEleves]               = useState([]);
  const [exclus, setExclus]               = useState({});   // id → true if excluded
  const [souratesDB, setSouratesDB]       = useState([]);
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [msg, setMsg]                     = useState(null);
  const [done, setDone]                   = useState(false);
  const [resultats, setResultats]         = useState([]);
  // États spécifiques au bloc mobile
  const [filterNiveau, setFilterNiveau]   = useState('tous');
  const [selectedEleves, setSelectedEleves] = useState([]);

  const niveauInfo = niveauxDB.find(n => n.code === selectedNiveau);
  const isSourate  = niveauInfo?.type === 'sourate';
  const color      = getNiveauColor(selectedNiveau, niveauxDB);
  const sourates   = selectedNiveau ? getSouratesForNiveau(selectedNiveau) : [];

  useEffect(() => {
    supabase.from('sourates').select('id,numero').then(({ data }) => {
      if (data) setSouratesDB(data);
    });
    // Charger les niveaux dynamiques
    supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id', user.ecole_id).order('ordre')
      .then(({ data }) => { if (data) setNiveauxDB(data); });
  }, []);

  useEffect(() => {
    if (selectedNiveau) loadEleves();
  }, [selectedNiveau]);

  const loadEleves = async () => {
    setLoading(true);
    try {
    const { data } = await supabase
      .from('eleves').select('id,prenom,nom,eleve_id_ecole,code_niveau')
      .eq('ecole_id', user.ecole_id).eq('code_niveau', selectedNiveau).order('nom');
    setEleves(data || []);
    setExclus({});
    setLoading(false);
    } catch (e) {
      console.error('[ValidationCollective.js] Erreur chargement:', e);
      setLoading(false);
    }
  };

  const toggleExclu = (id) => setExclus(prev => ({ ...prev, [id]: !prev[id] }));

  const elevesRetenus  = eleves.filter(e => !exclus[e.id]);
  const nbExclus       = eleves.filter(e =>  exclus[e.id]).length;

  const getDbSourateId = (numero) => souratesDB.find(x => x.numero === numero)?.id || null;

  const canProceedStep2 = () => {
    if (!typeRecitation) return false;
    if (isSourate) {
      if (!selectedSourate) return false;
      if (typeRecitation === 'sequence') return versetDebut && versetFin && parseInt(versetFin) >= parseInt(versetDebut);
      return true;
    }
    if (typeRecitation === 'tomon')       return nombreTomon >= 1;
    if (typeRecitation === 'hizb_complet') return selectedHizb >= 1;
    return false;
  };

  const handleValider = async () => {
    setSaving(true); setMsg(null);
    const now    = new Date().toISOString();
    const cibles = toutLeNiveau ? eleves : elevesRetenus;
    try {
      const inserts_rec = [];
      const inserts_val = [];
      for (const e of cibles) {
        if (isSourate) {
          inserts_rec.push({
            eleve_id: e.id,
            ecole_id: user.ecole_id,
            sourate_id: getDbSourateId(selectedSourate.numero),
            type_recitation: typeRecitation,
            verset_debut: typeRecitation === 'sequence' ? parseInt(versetDebut) : null,
            verset_fin:   typeRecitation === 'sequence' ? parseInt(versetFin)   : null,
            valide_par: user.id,
            date_validation: now,
            points: typeRecitation === 'complete' ? 20 : 5,
            is_muraja: true,
          });
        } else {
          inserts_val.push({
            eleve_id: e.id,
            ecole_id: user.ecole_id,
            valide_par: user.id,
            nombre_tomon: typeRecitation === 'tomon' ? parseInt(nombreTomon) : 0,
            type_validation: typeRecitation === 'tomon' ? 'tomon_muraja' : 'hizb_muraja',
            date_validation: now,
            tomon_debut:    typeRecitation === 'tomon' ? parseInt(selectedTomon) : null,
            hizb_validation: typeRecitation === 'hizb_complet' ? parseInt(selectedHizb) : null,
            is_muraja: true,
          });
        }
      }
      const errors = [];
      if (inserts_rec.length) { const { error } = await supabase.from('recitations_sourates').insert(inserts_rec); if (error) errors.push(error.message); }
      if (inserts_val.length) { const { error } = await supabase.from('validations').insert(inserts_val); if (error) errors.push(error.message); }
      if (errors.length) { setMsg({ type:'error', text: errors.join(' | ') }); }
      else { setResultats(cibles); setDone(true); }
    } catch(err) { setMsg({ type:'error', text: err.message }); }
    setSaving(false);
  };

  const resetForm = () => {
    setStep(1); setSelectedNiveau(null); setTypeRecitation('');
    setSelectedSourate(null); setSelectedHizb(1); setSelectedTomon(1);
    setNombreTomon(1); setVersetDebut(''); setVersetFin('');
    setToutLeNiveau(true); setExclus({}); setDone(false); setResultats([]); setMsg(null);
  };

  // ─── SUCCESS ───
  if (done) return (
    <div style={{padding:'1.5rem',maxWidth:600,margin:'0 auto'}}>
      <div style={{background:'#E1F5EE',borderRadius:16,padding:'2rem',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>✅</div>
        <div style={{fontSize:18,fontWeight:700,color:'#085041',marginBottom:8}}>
          {lang==='ar' ? 'تم تسجيل المراجعة الجماعية' : "Muraja'a collective enregistrée !"}
        </div>
        <div style={{fontSize:14,color:'#1D9E75',marginBottom:16}}>
          {resultats.length} {lang==='ar'?'طالب':'élève(s)'} · {
            isSourate ? selectedSourate?.nom_ar
            : typeRecitation==='tomon' ? `${nombreTomon} Tomon — Hizb ${selectedHizb}` : `Hizb ${selectedHizb} كامل`
          }
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center',marginBottom:16}}>
          {resultats.map(e=>(
            <span key={e.id} style={{padding:'3px 10px',background:'#fff',borderRadius:20,fontSize:12,fontWeight:600,color:'#085041',border:'1px solid #9FE1CB'}}>
              {e.prenom} {e.nom}
            </span>
          ))}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button onClick={resetForm} style={{padding:'10px 20px',background:'#085041',color:'#fff',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer'}}>
            {lang==='ar' ? '+ مراجعة جديدة' : "+ Nouvelle murajaʼa"}
          </button>
          <button onClick={()=>navigate('muraja_dashboard')} style={{padding:'10px 20px',background:'#085041',color:'#fff',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer'}}>
            📊 {lang==='ar' ? 'لوحة المراجعات' : 'Tableau de bord'}
          </button>
          <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">
            {lang==='ar'?'رجوع':'← Retour'}
          </button>
        </div>
      </div>
    </div>
  );

  // ─── STEPS INDICATOR ───
  const STEPS = [
    {n:1, label:lang==='ar'?'المستوى':'Niveau'},
    {n:2, label:lang==='ar'?'المحتوى':'Contenu'},
    {n:3, label:lang==='ar'?'تأكيد':'Confirmer'},
  ];

  // Variable calculée pour le bloc mobile
  const niveauxMobile = ['tous', ...niveauxDB.map(n=>n.code)];
  const elevesFiltres = filterNiveau === 'tous' ? eleves : eleves.filter(e => e.code_niveau === filterNiveau);

  if (isMobile) {
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')} style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1, fontSize:17, fontWeight:800, color:'#fff'}}>
              📖 {lang==='ar'?'مراجعة جماعية':"Murajaʼa collective"}
            </div>
            <button onClick={()=>navigate('muraja_dashboard')}
              style={{background:'rgba(255,255,255,0.22)',color:'#fff',border:'1px solid rgba(255,255,255,0.25)',borderRadius:8,
                padding:'6px 10px',fontSize:12,cursor:'pointer',fontWeight:600}}>
              📊
            </button>
          </div>
        </div>
        {msg&&<div style={{margin:'8px 12px',padding:'10px 14px',borderRadius:10,fontSize:13,
          background:msg.type==='success'?'#E1F5EE':'#FCEBEB',
          color:msg.type==='success'?'#085041':'#E24B4A'}}>{msg.text}</div>}
        <div style={{padding:'12px'}}>
          {/* Elèves selection */}
          {step===1&&(
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'#444',marginBottom:12}}>
                {lang==='ar'?'اختر الطلاب':'Sélectionner les élèves'}
              </div>
              {/* Niveau filter */}
              <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:12,scrollbarWidth:'none'}}>
                {niveauxMobile.map(n=>(
                  <div key={n} onClick={()=>setFilterNiveau(n)}
                    style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,flexShrink:0,cursor:'pointer',
                      background:filterNiveau===n?'#1D9E75':'#f0f0ec',color:filterNiveau===n?'#fff':'#666'}}>
                    {n==='tous'?(lang==='ar'?'الكل':'Tous'):n}
                  </div>
                ))}
              </div>
              {/* Select all button */}
              <button onClick={()=>setSelectedEleves(elevesFiltres.map(e=>e.id))}
                style={{width:'100%',padding:'12px',background:'#085041',color:'#fff',border:'none',
                  borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:12}}>
                {lang==='ar'?'تحديد الكل':'Tout sélectionner'} ({elevesFiltres.length})
              </button>
              {(elevesFiltres||[]).map(e=>{
                const sel = selectedEleves.includes(e.id);
                const nc=getNiveauColor(e.code_niveau, niveauxDB);
                return(
                  <div key={e.id} onClick={()=>setSelectedEleves(prev=>sel?prev.filter(id=>id!==e.id):[...prev,e.id])}
                    style={{background:sel?`${nc}08`:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,
                      border:sel?`2px solid ${nc}`:'0.5px solid #e0e0d8',
                      display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                    <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${sel?nc:'#ccc'}`,
                      background:sel?nc:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {sel&&<span style={{color:'#fff',fontSize:14,fontWeight:800}}>✓</span>}
                    </div>
                    <div style={{width:36,height:36,borderRadius:'50%',background:`${nc}20`,color:nc,
                      display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,flexShrink:0}}>
                      {(e.prenom[0]||'?')+(e.nom[0]||'?')}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14}}>{e.prenom} {e.nom}</div>
                      <span style={{padding:'1px 7px',borderRadius:8,background:`${nc}20`,color:nc,fontSize:11,fontWeight:700}}>{e.code_niveau||'?'}</span>
                    </div>
                  </div>
                );
              })}
              {selectedEleves.length>0&&(
                <button onClick={()=>setStep(2)}
                  style={{position:'sticky',bottom:88,width:'100%',padding:'16px',background:'#1D9E75',color:'#fff',
                    border:'none',borderRadius:14,fontSize:16,fontWeight:800,cursor:'pointer',fontFamily:'inherit',marginTop:12}}>
                  {lang==='ar'?`التالي (${selectedEleves.length} طالب)`:`Suivant (${selectedEleves.length} élève${selectedEleves.length>1?'s':''})`}
                </button>
              )}
            </div>
          )}
          {/* Step 2 - Type */}
          {step===2&&(
            <div>
              <div style={{background:'#E1F5EE',borderRadius:12,padding:'12px 14px',marginBottom:16,
                display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700,fontSize:14,color:'#fff'}}>{selectedEleves.length} {lang==='ar'?'طالب':'élève(s)'}</span>
                <button onClick={()=>setStep(1)}
                  style={{background:'none',border:'none',cursor:'pointer',color:'#1D9E75',fontSize:13,fontWeight:600}}>
                  ✏️ {lang==='ar'?'تعديل':'Modifier'}
                </button>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'#444',marginBottom:12}}>
                {lang==='ar'?'نوع المراجعة':'Type de révision'}
              </div>
              {[
                {type:'tomon',label:lang==='ar'?'ثُمن':'Tomon',pts:10,color:'#1D9E75',bg:'#E1F5EE'},
                {type:'hizb',label:lang==='ar'?'حزب كامل':'Hizb complet',pts:100,color:'#EF9F27',bg:'#FAEEDA'},
              ].map(opt=>(
                <div key={opt.type} onClick={()=>setTypeRecitation(opt.type)}
                  style={{padding:'18px 16px',background:typeRecitation===opt.type?opt.bg:'#fff',
                    border:typeRecitation===opt.type?`2px solid ${opt.color}`:'0.5px solid #e0e0d8',
                    borderRadius:14,marginBottom:12,cursor:'pointer',
                    display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:700,color:opt.color}}>{opt.label}</div>
                    <div style={{fontSize:12,color:'#888',marginTop:2}}>+{opt.pts} pts / élève</div>
                  </div>
                  {typeRecitation===opt.type&&<span style={{fontSize:22,color:opt.color}}>✓</span>}
                </div>
              ))}
              {typeRecitation&&(
                <button onClick={soumettre} disabled={saving}
                  style={{width:'100%',padding:'18px',background:saving?'#ccc':'#085041',color:'#fff',
                    border:'none',borderRadius:14,fontSize:17,fontWeight:800,cursor:'pointer',fontFamily:'inherit',marginTop:8}}>
                  {saving?'...':(lang==='ar'?'✓ تسجيل المراجعة':'✓ Valider la révision')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:'1rem',maxWidth:700,margin:'0 auto'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}></button>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>navigate('muraja_dashboard')}
            style={{padding:'8px 16px',background:'#085041',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            📊 {lang==='ar'?'لوحة المراجعات':'Tableau de bord'}
          </button>
        </div>
      </div>

      {/* Title + Steps */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem',marginBottom:'1.5rem'}}>
        <div style={{fontSize:18,fontWeight:800,color:'#085041',marginBottom:'1rem',textAlign:'center'}}>
          📖 {lang==='ar' ? 'مراجعة جماعية' : "Muraja'a collective"}
        </div>
        <div style={{display:'flex',gap:6}}>
          {STEPS.map(s=>(
            <div key={s.n} onClick={()=>step>s.n&&setStep(s.n)}
              style={{flex:1,padding:'8px 4px',borderRadius:10,textAlign:'center',fontSize:12,
                fontWeight: step>=s.n?700:400,
                background: step===s.n?'#085041':step>s.n?'#E1F5EE':'#f5f5f0',
                color: step===s.n?'#fff':step>s.n?'#1D9E75':'#aaa',
                cursor: step>s.n?'pointer':'default',
                transition:'all 0.2s'}}>
              {step>s.n?'✓ ':''}{s.label}
            </div>
          ))}
        </div>
      </div>

      {msg&&<div style={{padding:'10px 14px',borderRadius:10,background:msg.type==='error'?'#FCEBEB':'#E1F5EE',color:msg.type==='error'?'#E24B4A':'#085041',marginBottom:14,fontSize:13,fontWeight:500,border:`0.5px solid ${msg.type==='error'?'#E24B4A30':'#1D9E7530'}`}}>{msg.text}</div>}

      {/* ── STEP 1 : Niveau ── */}
      {step===1&&(
        <div>
          <div style={{fontSize:13,fontWeight:600,color:'#888',marginBottom:10,textAlign:'center'}}>
            {lang==='ar' ? 'اختر المستوى الدراسي' : 'Choisissez le niveau'}
          </div>
          {/* Affiche niveaux DB ou fallback hardcodé pendant le chargement */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {(niveauxDB.length > 0 ? niveauxDB : NIVEAUX.map(n=>({...n,nom:n.label}))).map(n=>{
              const nc=getNiveauColor(n.code, niveauxDB);
              return (
                <div key={n.code} onClick={()=>{setSelectedNiveau(n.code);setStep(2);}}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:12,
                    border:`1.5px solid ${nc}30`,background:`${nc}08`,cursor:'pointer',transition:'all 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background=`${nc}18`;e.currentTarget.style.borderColor=`${nc}60`;}}
                  onMouseLeave={e=>{e.currentTarget.style.background=`${nc}08`;e.currentTarget.style.borderColor=`${nc}30`;}}>
                  <div style={{width:40,height:40,borderRadius:10,background:`${nc}20`,color:nc,
                    display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,flexShrink:0}}>
                    {n.code}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:'#1a1a1a'}}>{n.nom}</div>
                    <div style={{fontSize:10,color:nc,marginTop:2,fontWeight:500}}>
                      {n.type==='sourate'?(lang==='ar'?'📖 سور':'📖 Sourates'):(lang==='ar'?'📗 أثمان':'📗 Hizb')}
                    </div>
                  </div>
                  <span style={{color:`${nc}80`,fontSize:16}}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 2 : Contenu ── */}
      {step===2&&niveauInfo&&(
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
            <span style={{padding:'3px 10px',borderRadius:10,background:`${color}20`,color,fontWeight:700}}>{selectedNiveau}</span>
            <span style={{fontSize:14,fontWeight:600}}>{lang==='ar'?'ما الذي تمت مراجعته؟':"Qu'est-ce qui a été récité ?"}</span>
          </div>

          {isSourate?(
            <>
              <div style={{display:'flex',gap:8,marginBottom:16}}>
                {[
                  {val:'sequence', labelFr:'Séquence (partielle)',  labelAr:'تسلسل (أجزاء)'},
                  {val:'complete', labelFr:'Sourate complète',      labelAr:'سورة كاملة'},
                ].map(tp=>(
                  <div key={tp.val} onClick={()=>setTypeRecitation(tp.val)}
                    style={{flex:1,padding:'10px',borderRadius:10,textAlign:'center',cursor:'pointer',
                      border:`2px solid ${typeRecitation===tp.val?color:'#e0e0d8'}`,
                      background:typeRecitation===tp.val?`${color}12`:'#fff',
                      fontWeight:typeRecitation===tp.val?700:400,
                      color:typeRecitation===tp.val?color:'#555',fontSize:13}}>
                    {lang==='ar'?tp.labelAr:tp.labelFr}
                  </div>
                ))}
              </div>
              <div className="field-group" style={{marginBottom:12}}>
                <label className="field-lbl">{lang==='ar'?'السورة المستظهَرة':'Sourate récitée'}</label>
                <select className="field-select" value={selectedSourate?.numero||''} onChange={e=>{
                  const s=sourates.find(x=>x.numero===parseInt(e.target.value));
                  setSelectedSourate(s||null);
                }}>
                  <option value="">{lang==='ar'?'— اختر سورة —':'— Choisir une sourate —'}</option>
                  {sourates.map(s=><option key={s.numero} value={s.numero}>{s.nom_ar}</option>)}
                </select>
              </div>
              {typeRecitation==='sequence'&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'من الآية':'Verset début'}</label>
                    <input className="field-input" type="number" min="1" value={versetDebut} onChange={e=>setVersetDebut(e.target.value)}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'إلى الآية':'Verset fin'}</label>
                    <input className="field-input" type="number" min="1" value={versetFin} onChange={e=>setVersetFin(e.target.value)}/>
                  </div>
                </div>
              )}
            </>
          ):(
            <>
              <div style={{display:'flex',gap:8,marginBottom:16}}>
                {[
                  {val:'tomon',       labelFr:'Tomon (révision)',  labelAr:'ثُمن (مراجعة)'},
                  {val:'hizb_complet',labelFr:'Hizb complet',      labelAr:'حزب كامل'},
                ].map(tp=>(
                  <div key={tp.val} onClick={()=>setTypeRecitation(tp.val)}
                    style={{flex:1,padding:'10px',borderRadius:10,textAlign:'center',cursor:'pointer',
                      border:`2px solid ${typeRecitation===tp.val?color:'#e0e0d8'}`,
                      background:typeRecitation===tp.val?`${color}12`:'#fff',
                      fontWeight:typeRecitation===tp.val?700:400,
                      color:typeRecitation===tp.val?color:'#555',fontSize:13}}>
                    {lang==='ar'?tp.labelAr:tp.labelFr}
                  </div>
                ))}
              </div>
              {typeRecitation==='tomon'&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم الحزب':'Numéro Hizb'}</label>
                    <input className="field-input" type="number" min="1" max="60" value={selectedHizb} onChange={e=>setSelectedHizb(parseInt(e.target.value)||1)}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم الثُّمن':'Tomon n°'}</label>
                    <select className="field-select" value={selectedTomon} onChange={e=>setSelectedTomon(parseInt(e.target.value))}>
                      {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>T{n}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'عدد الأثمان':'Nb Tomon'}</label>
                    <select className="field-select" value={nombreTomon} onChange={e=>setNombreTomon(parseInt(e.target.value))}>
                      {[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {typeRecitation==='hizb_complet'&&(
                <div className="field-group">
                  <label className="field-lbl">{lang==='ar'?'رقم الحزب المستظهَر':'Numéro du Hizb récité'}</label>
                  <input className="field-input" type="number" min="1" max="60" value={selectedHizb} onChange={e=>setSelectedHizb(parseInt(e.target.value)||1)}/>
                </div>
              )}
            </>
          )}
          <div style={{display:'flex',gap:10,marginTop:20}}>
            <button onClick={()=>setStep(1)} style={{background:'#f5f5f0',border:'1px solid #d0d0c8',borderRadius:10,padding:'8px 14px',color:'#374151',fontSize:16,cursor:'pointer',fontFamily:"inherit",fontWeight:600}}>←</button>
            <button onClick={()=>setStep(3)} disabled={!canProceedStep2()}
              style={{flex:1,padding:'10px',background:canProceedStep2()?'#085041':'#ccc',color:'#fff',border:'none',borderRadius:10,fontWeight:600,cursor:canProceedStep2()?'pointer':'default'}}>
              {lang==='ar'?'التالي: التأكيد ←':'Suivant : Confirmation →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 : Confirmation + Exclusions ── */}
      {step===3&&(
        <div>
          {/* Récap contenu */}
          <div style={{background:`${color}08`,border:`1.5px solid ${color}30`,borderRadius:14,padding:'1rem',marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color,marginBottom:8}}>
              📋 {lang==='ar'?'ملخص الاستظهار':'Récapitulatif'}
            </div>
            <div style={{display:'grid',gap:6,fontSize:13}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'#888'}}>{lang==='ar'?'المستوى':'Niveau'}</span>
                <span style={{fontWeight:600}}>{selectedNiveau} — {lang==='ar'?niveauInfo?.labelAr:niveauInfo?.label}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'#888'}}>{lang==='ar'?'النوع':'Type'}</span>
                <span style={{fontWeight:600}}>
                  {isSourate
                    ?(typeRecitation==='complete'?(lang==='ar'?'سورة كاملة':'Sourate complète'):(lang==='ar'?'تسلسل':'Séquence'))
                    :(typeRecitation==='hizb_complet'?(lang==='ar'?'حزب كامل':'Hizb complet'):(lang==='ar'?'ثُمن':'Tomon'))}
                </span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'#888'}}>{lang==='ar'?'المحتوى':'Contenu'}</span>
                <span style={{fontWeight:600}}>
                  {isSourate
                    ?(selectedSourate?.nom_ar+(typeRecitation==='sequence'?` (${lang==='ar'?'آية':'v.'} ${versetDebut}–${versetFin})`:''))
                    :(typeRecitation==='tomon'?`Hizb ${selectedHizb} — T${selectedTomon} ×${nombreTomon}`:`Hizb ${selectedHizb}`)}
                </span>
              </div>
            </div>
          </div>

          {/* Question : tout le niveau ou exclusions ? */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:10,color:'#333'}}>
              {lang==='ar'?'هل المراجعة تشمل جميع طلاب المستوى؟':'Cette muraja\u2019a concerne-t-elle tout le niveau ?'}
            </div>
            <div style={{display:'flex',gap:10,marginBottom:12}}>
              <div onClick={()=>{setToutLeNiveau(true);setExclus({});}}
                style={{flex:1,padding:'12px',borderRadius:12,textAlign:'center',cursor:'pointer',
                  border:`2px solid ${toutLeNiveau?color:'#e0e0d8'}`,
                  background:toutLeNiveau?`${color}12`:'#fff',
                  fontWeight:toutLeNiveau?700:400,color:toutLeNiveau?color:'#555'}}>
                <div style={{fontSize:20,marginBottom:4}}>✅</div>
                <div style={{fontSize:13}}>{lang==='ar'?'نعم، جميع الطلاب':'Oui, tout le niveau'}</div>
                {!loading&&<div style={{fontSize:11,color:'#888',marginTop:2}}>{eleves.length} {lang==='ar'?'طالب':'élève(s)'}</div>}
              </div>
              <div onClick={()=>setToutLeNiveau(false)}
                style={{flex:1,padding:'12px',borderRadius:12,textAlign:'center',cursor:'pointer',
                  border:`2px solid ${!toutLeNiveau?'#E24B4A':'#e0e0d8'}`,
                  background:!toutLeNiveau?'#FCEBEB':'#fff',
                  fontWeight:!toutLeNiveau?700:400,color:!toutLeNiveau?'#E24B4A':'#555'}}>
                <div style={{fontSize:20,marginBottom:4}}>⚠️</div>
                <div style={{fontSize:13}}>{lang==='ar'?'لا، هناك استثناءات':'Non, avec exclusions'}</div>
                {!toutLeNiveau&&nbExclus>0&&<div style={{fontSize:11,color:'#E24B4A',marginTop:2}}>{nbExclus} {lang==='ar'?'مستثنى':'exclu(s)'}</div>}
              </div>
            </div>

            {/* Liste d'exclusion — visible seulement si "avec exclusions" */}
            {!toutLeNiveau&&(
              <div style={{border:'1.5px solid #E24B4A30',borderRadius:12,padding:'12px',background:'#fff'}}>
                <div style={{fontSize:13,fontWeight:600,color:'#E24B4A',marginBottom:10}}>
                  {lang==='ar'?'اختر الطلاب المستثنين (غائبون أو غير معنيين):':'Cochez les élèves à exclure (absents ou non concernés) :'}
                </div>
                {loading?(
                  <div style={{textAlign:'center',color:'#aaa',padding:'1rem'}}>...</div>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:280,overflowY:'auto'}}>
                    {eleves.map(e=>(
                      <div key={e.id} onClick={()=>toggleExclu(e.id)}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,cursor:'pointer',
                          background:exclus[e.id]?'#FCEBEB':'#fafaf8',
                          border:`1px solid ${exclus[e.id]?'#E24B4A30':'#f0f0ec'}`}}>
                        <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${exclus[e.id]?'#E24B4A':'#ccc'}`,
                          background:exclus[e.id]?'#E24B4A':'#fff',
                          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          {exclus[e.id]&&<span style={{color:'#fff',fontSize:11}}>✕</span>}
                        </div>
                        <span style={{flex:1,fontSize:13,fontWeight:exclus[e.id]?600:400,
                          color:exclus[e.id]?'#E24B4A':'#333',
                          textDecoration:exclus[e.id]?'line-through':'none'}}>
                          {e.prenom} {e.nom}
                        </span>
                        {e.eleve_id_ecole&&<span style={{fontSize:11,color:'#aaa'}}>#{e.eleve_id_ecole}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{marginTop:10,padding:'8px 10px',borderRadius:8,background:'#f5f5f0',fontSize:12,color:'#555',display:'flex',justifyContent:'space-between'}}>
                  <span>{lang==='ar'?'الطلاب المعنيون:':'Élèves concernés :'} <strong style={{color}}>{elevesRetenus.length}</strong></span>
                  <span>{lang==='ar'?'المستثنون:':'Exclus :'} <strong style={{color:'#E24B4A'}}>{nbExclus}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Note murajaʼa */}
          <div style={{padding:'10px 14px',borderRadius:10,background:'#FFF3CD',border:'0.5px solid #FFECB5',fontSize:12,color:'#856404',marginBottom:16,display:'flex',gap:8,alignItems:'flex-start'}}>
            <span>ℹ️</span>
            <span>{lang==='ar'
              ?'هذه المراجعة الجماعية تُضاف إلى رصيد كل طالب كمراجعة ولن تغير موضعه في التقدم الفردي.'
              :"Cette murajaʼa sera enregistrée comme révision. Elle n'affecte pas la progression individuelle."}</span>
          </div>

          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setStep(2)} style={{background:'#f5f5f0',border:'1px solid #d0d0c8',borderRadius:10,padding:'8px 14px',color:'#374151',fontSize:16,cursor:'pointer',fontFamily:"inherit",fontWeight:600}}>←</button>
            <button onClick={handleValider} disabled={saving||(!toutLeNiveau&&elevesRetenus.length===0)}
              style={{flex:1,padding:'12px',
                background:saving||(!toutLeNiveau&&elevesRetenus.length===0)?'#ccc':'#1D9E75',
                color:'#fff',border:'none',borderRadius:10,fontWeight:700,fontSize:14,
                cursor:saving?'default':'pointer'}}>
              {saving?'...':(lang==='ar'
                ?`✓ تأكيد المراجعة الجماعية (${toutLeNiveau?eleves.length:elevesRetenus.length} طالب)`
                :`✓ Confirmer la murajaʼa (${toutLeNiveau?eleves.length:elevesRetenus.length} élève(s))`)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
