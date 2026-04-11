import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

export default function ResultatsExamens({ user, navigate, goBack, lang='fr', isMobile, data }) {
  const { toast } = useToast();
  // data peut contenir { eleve, blocage } passé depuis EnregistrerRecitation
  const eleveInit = data?.eleve || null;
  const blocageInit = data?.blocage || null;

  const [eleves,   setEleves]   = useState([]);
  const [examens,  setExamens]  = useState([]);
  const [resultats,setResultats]= useState([]);
  const [niveaux,  setNiveaux]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [activeTab, setActiveTab]= useState('saisir'); // 'saisir' | 'historique'

  // Formulaire saisie résultat
  const [selectedEleve,  setSelectedEleve]  = useState(eleveInit);
  const [selectedExamen, setSelectedExamen] = useState(blocageInit?.examen || null);
  const [score, setScore]     = useState(0);
  const [notes, setNotes]     = useState('');
  const [searchEleve, setSearchEleve] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data:ed },{ data:exd },{ data:rd },{ data:nd }] = await Promise.all([
      supabase.from('eleves').select('id,prenom,nom,code_niveau,niveau_id').eq('ecole_id',user.ecole_id).order('nom'),
      supabase.from('examens').select('id,nom,score_minimum,niveau_id,bloquant').eq('ecole_id',user.ecole_id).order('nom'),
      supabase.from('resultats_examens')
        .select('*, eleve:eleve_id(prenom,nom,code_niveau), examen:examen_id(nom,score_minimum)')
        .eq('ecole_id',user.ecole_id).order('created_at',{ascending:false}).limit(50),
      supabase.from('niveaux').select('id,code,nom,couleur').eq('ecole_id',user.ecole_id),
    ]);
    setEleves(ed||[]);
    setExamens(exd||[]);
    setResultats(rd||[]);
    setNiveaux(nd||[]);
    setLoading(false);
  };

  const sauvegarder = async () => {
    if (!selectedEleve) return toast.warning(lang==='ar'?'اختر طالباً':'Sélectionnez un élève');
    if (!selectedExamen) return toast.warning(lang==='ar'?'اختر الامتحان':'Sélectionnez un examen');
    setSaving(true);
    const reussi = score >= (selectedExamen.score_minimum || 0);
    const { error } = await supabase.from('resultats_examens').insert({
      examen_id: selectedExamen.id,
      eleve_id: selectedEleve.id,
      ecole_id: user.ecole_id,
      date_examen: new Date().toISOString().split('T')[0],
      score: parseInt(score),
      statut: reussi ? 'reussi' : 'echoue',
      notes_examinateur: notes.trim() || null,
      valide_par: user.id,
    });
    setSaving(false);
    if (error) {
      if (error.code === '23505') toast.warning(lang==='ar'?'نتيجة موجودة لهذا اليوم':'Résultat déjà enregistré pour aujourd\'hui');
      else toast.error(error.message||'Erreur');
      return;
    }
    toast.success(reussi
      ? (lang==='ar'?`🎉 ${selectedEleve.prenom} نجح في الامتحان !`:`🎉 ${selectedEleve.prenom} a réussi l'examen !`)
      : (lang==='ar'?`${selectedEleve.prenom} لم ينجح — إعادة الامتحان مطلوب`:`${selectedEleve.prenom} n'a pas réussi — nouvel examen requis`));
    setScore(0); setNotes(''); setSelectedExamen(null);
    if (!eleveInit) setSelectedEleve(null);
    loadData();
    setActiveTab('historique');
  };

  const elevesFiltres = eleves.filter(e =>
    !searchEleve || `${e.prenom} ${e.nom}`.toLowerCase().includes(searchEleve.toLowerCase())
  );

  const NIVEAU_COLORS = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'};
  const nc = (code) => {
    const n = niveaux.find(x=>x.code===code);
    return n?.couleur || NIVEAU_COLORS[code] || '#888';
  };

  return (
    <div style={isMobile?{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}:{}}>
      {/* Header */}
      <div style={isMobile?{background:'#fff',padding:'14px 16px 0',borderBottom:'0.5px solid #e0e0d8',position:'sticky',top:0,zIndex:100}:{marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:isMobile?22:14,color:'#085041',padding:0,fontFamily:'inherit',fontWeight:600}}>
            {isMobile?'←':'← Retour'}
          </button>
          <div style={{flex:1,fontSize:isMobile?17:20,fontWeight:isMobile?800:700,color:'#085041'}}>
            🏅 {lang==='ar'?'نتائج الامتحانات':'Résultats examens'}
          </div>
        </div>
        {/* Tabs */}
        <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3,marginBottom:isMobile?0:0}}>
          {[['saisir',lang==='ar'?'تسجيل نتيجة':'Saisir résultat'],
            ['historique',lang==='ar'?'السجل':'Historique']
          ].map(([k,l])=>(
            <div key={k} onClick={()=>setActiveTab(k)}
              style={{flex:1,padding:'8px 4px',borderRadius:8,textAlign:'center',fontSize:12,fontWeight:600,cursor:'pointer',
                background:activeTab===k?'#fff':'transparent',color:activeTab===k?'#1a1a1a':'#888'}}>
              {l}
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:isMobile?'12px':'0',marginTop:isMobile?0:'0'}}>

        {/* ── SAISIR RÉSULTAT ── */}
        {activeTab==='saisir'&&(
          <div>
            {/* Info blocage si venu depuis EnregistrerRecitation */}
            {blocageInit&&(
              <div style={{background:'#FAEEDA',borderRadius:12,padding:'12px 14px',marginBottom:14,border:'1.5px solid #EF9F2730'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#633806',marginBottom:4}}>
                  📝 {lang==='ar'?'امتحان مطلوب':'Examen requis'}
                </div>
                <div style={{fontSize:12,color:'#854F0B'}}>
                  {lang==='ar'?blocageInit.message_ar:blocageInit.message_fr}
                </div>
              </div>
            )}

            {/* Sélection élève (si pas passé en param) */}
            {!eleveInit&&(
              <div style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:12,border:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:10}}>
                  {lang==='ar'?'1. اختر الطالب':'1. Choisir l\'élève'}
                </div>
                <input style={{width:'100%',padding:'11px 13px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box',marginBottom:10}}
                  placeholder={lang==='ar'?'بحث...':'Rechercher...'}
                  value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}/>
                <div style={{maxHeight:200,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
                  {elevesFiltres.map(e=>{
                    const c = nc(e.code_niveau);
                    const sel = selectedEleve?.id===e.id;
                    return(
                      <div key={e.id} onClick={()=>{setSelectedEleve(e);setSelectedExamen(null);}}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,cursor:'pointer',
                          background:sel?`${c}10`:'#f5f5f0',border:`1.5px solid ${sel?c:'#e0e0d8'}`}}>
                        <div style={{width:34,height:34,borderRadius:'50%',background:`${c}20`,color:c,
                          display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0}}>
                          {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600}}>{e.prenom} {e.nom}</div>
                          <span style={{fontSize:11,padding:'1px 6px',borderRadius:8,background:`${c}20`,color:c,fontWeight:700}}>{e.code_niveau||'?'}</span>
                        </div>
                        {sel&&<span style={{color:c,fontSize:16}}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Élève sélectionné */}
            {selectedEleve&&eleveInit&&(
              <div style={{background:'#E1F5EE',borderRadius:12,padding:'12px 14px',marginBottom:12,
                display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:40,height:40,borderRadius:'50%',background:'#9FE1CB',
                  display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'#085041',flexShrink:0}}>
                  {((selectedEleve.prenom||'?')[0])+((selectedEleve.nom||'?')[0])}
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:'#085041'}}>{selectedEleve.prenom} {selectedEleve.nom}</div>
                  <div style={{fontSize:12,color:'#0F6E56'}}>{selectedEleve.code_niveau}</div>
                </div>
              </div>
            )}

            {/* Sélection examen */}
            {selectedEleve&&(
              <div style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:12,border:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:10}}>
                  {lang==='ar'?'2. اختر الامتحان':'2. Choisir l\'examen'}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {examens.map(ex=>{
                    const sel = selectedExamen?.id===ex.id;
                    return(
                      <div key={ex.id} onClick={()=>setSelectedExamen(ex)}
                        style={{padding:'11px 14px',borderRadius:10,cursor:'pointer',
                          background:sel?'#FAEEDA':'#f5f5f0',
                          border:`1.5px solid ${sel?'#EF9F27':'#e0e0d8'}`}}>
                        <div style={{fontSize:13,fontWeight:sel?700:500,color:sel?'#633806':'#666'}}>{ex.nom}</div>
                        <div style={{fontSize:11,color:'#888',marginTop:2}}>
                          {lang==='ar'?'النقاط الدنيا للنجاح':'Score min:'} {ex.score_minimum}%
                          {ex.bloquant&&<span style={{marginLeft:8,color:'#E24B4A'}}>🔒 {lang==='ar'?'موقف':'Bloquant'}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Score + Notes */}
            {selectedEleve&&selectedExamen&&(
              <div style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:12,border:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#085041',marginBottom:14}}>
                  {lang==='ar'?'3. تسجيل النتيجة':'3. Saisir le résultat'}
                </div>

                {/* Score slider */}
                <div style={{marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666'}}>{lang==='ar'?'النقاط':'Score'}</label>
                    <div style={{fontSize:28,fontWeight:800,
                      color:score>=(selectedExamen.score_minimum||0)?'#1D9E75':'#E24B4A'}}>
                      {score}%
                    </div>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={score}
                    onChange={e=>setScore(parseInt(e.target.value))}
                    style={{width:'100%',accentColor:score>=(selectedExamen.score_minimum||0)?'#1D9E75':'#E24B4A'}}/>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#aaa',marginTop:4}}>
                    <span>0%</span>
                    <span style={{color:'#888'}}>Min: {selectedExamen.score_minimum}%</span>
                    <span>100%</span>
                  </div>
                  {/* Verdict */}
                  <div style={{marginTop:10,padding:'10px 14px',borderRadius:10,textAlign:'center',
                    background:score>=(selectedExamen.score_minimum||0)?'#E1F5EE':'#FCEBEB',
                    border:`1.5px solid ${score>=(selectedExamen.score_minimum||0)?'#1D9E7530':'#E24B4A30'}`}}>
                    <div style={{fontSize:20,marginBottom:4}}>
                      {score>=(selectedExamen.score_minimum||0)?'🎉':'😔'}
                    </div>
                    <div style={{fontSize:14,fontWeight:700,
                      color:score>=(selectedExamen.score_minimum||0)?'#085041':'#A32D2D'}}>
                      {score>=(selectedExamen.score_minimum||0)
                        ?(lang==='ar'?'ناجح — يمكن الاستمرار':'Réussi — peut continuer')
                        :(lang==='ar'?'لم ينجح — إعادة الامتحان':'Échoué — nouvel examen requis')}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
                    {lang==='ar'?'ملاحظات (اختياري)':'Notes (optionnel)'}
                  </label>
                  <textarea style={{width:'100%',padding:'11px 13px',borderRadius:10,border:'0.5px solid #e0e0d8',
                    fontSize:14,fontFamily:'inherit',boxSizing:'border-box',resize:'none',minHeight:70}}
                    value={notes} onChange={e=>setNotes(e.target.value)}
                    placeholder={lang==='ar'?'ملاحظات المراقب...':'Observations de l\'examinateur...'}/>
                </div>

                <button onClick={sauvegarder} disabled={saving}
                  style={{width:'100%',padding:'14px',background:saving?'#ccc':'#1D9E75',color:'#fff',border:'none',
                    borderRadius:12,fontSize:15,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                  {saving?'...':(lang==='ar'?'حفظ النتيجة':'Enregistrer le résultat')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORIQUE ── */}
        {activeTab==='historique'&&(
          <div>
            {loading&&<div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>}
            {!loading&&resultats.length===0&&(
              <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:36,marginBottom:10}}>🏅</div>
                <div style={{fontSize:14}}>{lang==='ar'?'لا توجد نتائج بعد':'Aucun résultat enregistré'}</div>
              </div>
            )}
            {!loading&&resultats.map(r=>{
              const reussi = r.statut==='reussi';
              const c = nc(r.eleve?.code_niveau);
              return(
                <div key={r.id} style={{background:'#fff',borderRadius:12,padding:'13px 14px',marginBottom:8,
                  border:`0.5px solid ${reussi?'#1D9E7520':'#E24B4A20'}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{fontSize:22,flexShrink:0}}>{reussi?'🎉':'😔'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14}}>
                        {r.eleve?.prenom} {r.eleve?.nom}
                      </div>
                      <div style={{fontSize:12,color:'#888',marginTop:2}}>{r.examen?.nom}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:20,fontWeight:800,color:reussi?'#1D9E75':'#E24B4A'}}>{r.score}%</div>
                      <div style={{fontSize:10,color:'#888'}}>
                        {new Date(r.date_examen).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}
                      </div>
                    </div>
                  </div>
                  {r.notes_examinateur&&(
                    <div style={{marginTop:8,fontSize:12,color:'#888',fontStyle:'italic',
                      paddingTop:8,borderTop:'0.5px solid #f0f0ec'}}>
                      {r.notes_examinateur}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
