import React from 'react';
import { supabase } from '../../lib/supabase';


// COMPOSANT JalonsTab — Gestion des jalons/certificats
// ══════════════════════════════════════════════════════
export function JalonsTab({ user, lang, jalons, setJalons, ensembles, examens, newJalon, setNewJalon, savingJalon, setSavingJalon, showMsg, ecoleConfig }) {
  // Defensive defaults : si une prop est undefined (timing useEffect, etc.) on evite le crash
  const ensembesSafe = ensembles || [];
  const examensSafe = examens || [];
  const jalonsSafe = jalons || [];
  const newJalonSafe = newJalon || { nom_ar: '', type_jalon: 'hizb', hizb_ids: [], ensemble_id: '', examen_id: '', condition_obtention: 'cumul' };
  const hizbIdsSafe = newJalonSafe.hizb_ids || [];

  const ajouterJalon = async () => {
    if (!newJalonSafe.nom_ar.trim()) return showMsg('error', lang==='ar'?'اسم الشهادة مطلوب':'Le nom du certificat est obligatoire');
    if (newJalonSafe.type_jalon === 'hizb' && hizbIdsSafe.length === 0) return showMsg('error', lang==='ar'?'اختر الأحزاب المطلوبة':'Sélectionnez au moins un Hizb');
    if (newJalonSafe.type_jalon === 'ensemble_sourates' && !newJalonSafe.ensemble_id) return showMsg('error', lang==='ar'?'اختر مجموعة السور':'Choisissez un ensemble de sourates');
    if (newJalonSafe.type_jalon === 'examen' && !newJalonSafe.examen_id) return showMsg('error', lang==='ar'?'اختر الامتحان':'Choisissez un examen');
    setSavingJalon(true);
    const payload = {
      ecole_id: user.ecole_id,
      nom: newJalonSafe.nom_ar.trim(),
      nom_ar: newJalonSafe.nom_ar.trim(),
      type_jalon: newJalonSafe.type_jalon,
      hizb_ids: newJalonSafe.type_jalon === 'hizb' ? hizbIdsSafe : null,
      ensemble_id: newJalonSafe.type_jalon === 'ensemble_sourates' ? newJalonSafe.ensemble_id : null,
      examen_id: newJalonSafe.type_jalon === 'examen' ? newJalonSafe.examen_id : null,
      condition_obtention: newJalonSafe.condition_obtention || 'cumul',
      examen_final_id: newJalonSafe.condition_obtention === 'cumul_puis_examen' ? (newJalonSafe.examen_final_id||null) : null,
      description_condition: newJalonSafe.description_condition || null,
      actif: true,
    };
    await supabase.from('jalons').insert(payload);
    const { data } = await supabase.from('jalons').select('*').eq('ecole_id', user.ecole_id).order('created_at');
    if (data) setJalons(data);
    setNewJalon({ nom_ar: '', type_jalon: 'hizb', hizb_ids: [], ensemble_id: '', examen_id: '', condition_obtention: 'cumul', examen_final_id: '', description_condition: '' });
    setSavingJalon(false);
    showMsg('success', lang==='ar'?'تمت إضافة المرحلة بنجاح':'Jalon ajouté avec succès');
  };

  const supprimerJalon = async (id) => {
    await supabase.from('jalons').delete().eq('id', id);
    setJalons(prev => prev.filter(j => j.id !== id));
    showMsg('success', lang==='ar'?'تم حذف المرحلة':'Jalon supprimé');
  };

  const toggleActif = async (jalon) => {
    await supabase.from('jalons').update({ actif: !jalon.actif }).eq('id', jalon.id);
    setJalons(prev => prev.map(j => j.id === jalon.id ? {...j, actif: !j.actif} : j));
  };

  const getEnsembleNom = (id) => ensembesSafe.find(e => e.id === id)?.nom || '—';
  const getExamenNom = (id) => examensSafe.find(e => e.id === id)?.nom || '—';
  const typeLabel = (j) => {
    if (j.type_jalon === 'hizb') {
      const ids = j.hizb_ids || [];
      const label = ids.length > 0 ? ids.sort((a,b)=>a-b).join(', ') : '—';
      return lang==='ar' ? `أحزاب محددة: ${label}` : `Hizb spécifiques: ${label}`;
    }
    if (j.type_jalon === 'ensemble_sourates') return lang==='ar' ? `مجموعة: ${getEnsembleNom(j.ensemble_id)}` : `Ensemble: ${getEnsembleNom(j.ensemble_id)}`;
    if (j.type_jalon === 'examen') return lang==='ar' ? `امتحان ناجح: ${getExamenNom(j.examen_id)}` : `Examen réussi: ${getExamenNom(j.examen_id)}`;
    return j.type_jalon;
  };
  const toggleHizb = (n) => {
    const updated = hizbIdsSafe.includes(n) ? hizbIdsSafe.filter(h=>h!==n) : [...hizbIdsSafe, n];
    setNewJalon({...newJalonSafe, hizb_ids: updated});
  };

  return (
    <div>
      <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
        {lang==='ar'?'تكوين المراحل التي تُمنح عندها شهادة للطالب تلقائياً':'Configurez les jalons qui déclenchent automatiquement un certificat'}
      </div>

      {/* Formulaire ajout jalon */}
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="section-label">{lang==='ar'?'إضافة مرحلة جديدة':'Ajouter un jalon'}</div>
        <div className="form-grid">
          <div className="field-group" style={{gridColumn:'1/-1'}}>
            <label className="field-lbl">
              {lang==='ar'?'اسم الشهادة':'Nom du certificat'} <span style={{color:'#E24B4A'}}>*</span>
            </label>
            <input className="field-input" value={newJalon.nom_ar} onChange={e=>setNewJalon({...newJalon,nom_ar:e.target.value})}
              placeholder={lang==='ar'?'مثال: شهادة إتمام الأحزاب المقررة':'Ex: شهادة إتمام الأحزاب المقررة'}
              style={{direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif",fontSize:14}} />
          </div>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'نوع المرحلة':'Type de jalon'} <span style={{color:'#E24B4A'}}>*</span></label>
            <select className="field-select" value={newJalon.type_jalon} onChange={e=>setNewJalon({...newJalon,type_jalon:e.target.value,hizb_ids:[],ensemble_id:'',examen_id:''})}>
              <option value="hizb">{lang==='ar'?'أحزاب محددة':'Hizb spécifiques'}</option>
              <option value="ensemble_sourates">{lang==='ar'?'مجموعة سور مكتملة':'Ensemble de sourates terminé'}</option>
              <option value="examen">{lang==='ar'?'اجتياز امتحان':'Examen réussi'}</option>
            </select>
          </div>
          {/* Condition d'obtention */}
          <div className="field-group" style={{gridColumn:'1/-1'}}>
            <label className="field-lbl">{lang==='ar'?'شرط الحصول على الشهادة':"Condition d'obtention"} <span style={{color:'#E24B4A'}}>*</span></label>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              {[
                {val:'cumul', icon:'📚', label:lang==='ar'?'تراكمي فقط':'Cumulatif seul', desc:lang==='ar'?'يستظهر الطالب حزباً بحزب أو سورة بسورة تلقائياً — الشهادة تُمنح عند اكتمال العدد المطلوب':"L'élève valide progressivement — le certificat est décerné automatiquement au seuil"},
                {val:'cumul_puis_examen', icon:'🎯', label:lang==='ar'?'تراكمي + امتحان ختامي':'Cumulatif + examen final', desc:lang==='ar'?'يستظهر تدريجياً أولاً، ثم يجب اجتياز امتحان رسمي بتلاوة كاملة أمام لجنة للحصول على الشهادة':"Valide progressivement d'abord, puis doit réussir un examen formel en une seule récitation devant jury"},
              ].map(opt=>(
                <div key={opt.val} onClick={()=>setNewJalon({...newJalon,condition_obtention:opt.val})}
                  style={{flex:1,padding:'10px 12px',borderRadius:10,cursor:'pointer',
                    border:`2px solid ${newJalon.condition_obtention===opt.val?'#534AB7':'#e0e0d8'}`,
                    background:newJalon.condition_obtention===opt.val?'#EEEDFE':'#fff'}}>
                  <div style={{fontSize:16,marginBottom:4}}>{opt.icon}</div>
                  <div style={{fontWeight:700,fontSize:12,color:newJalon.condition_obtention===opt.val?'#534AB7':'#333'}}>{opt.label}</div>
                  <div style={{fontSize:10,color:'#888',marginTop:3}}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Si cumul_puis_examen : sélectionner l'examen final */}
          {newJalon.condition_obtention === 'cumul_puis_examen' && (
            <div className="field-group" style={{gridColumn:'1/-1'}}>
              <label className="field-lbl">
                {lang==='ar'?'الامتحان الختامي المطلوب':'Examen final requis'} <span style={{color:'#E24B4A'}}>*</span>
              </label>
              <select className="field-select" value={newJalon.examen_final_id||''} onChange={e=>setNewJalon({...newJalon,examen_final_id:e.target.value})}>
                <option value="">{lang==='ar'?'— اختر الامتحان —':"— Choisir l'examen —"}</option>
                {(examens||[]).map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
              <div style={{fontSize:11,color:'#888',marginTop:4}}>
                {lang==='ar'?'سيُمنح الشهادة فقط عند اجتياز هذا الامتحان بعد اكتمال الاستظهار التراكمي':'Le certificat sera décerné seulement après réussite de cet examen, une fois le cumul complété'}
              </div>
            </div>
          )}

          {newJalon.type_jalon === 'hizb' && (
            <div className="field-group" style={{gridColumn:'1/-1'}}>
              <label className="field-lbl">
                {lang==='ar'?'اختر الأحزاب المطلوبة':'Sélectionnez les Hizb requis'} <span style={{color:'#E24B4A'}}>*</span>
                {hizbIdsSafe.length > 0 && (
                  <span style={{marginRight:8,marginLeft:8,color:'#1D9E75',fontWeight:700}}>
                    ({hizbIdsSafe.length} {lang==='ar'?'محدد':'sélectionné(s)'})
                  </span>
                )}
              </label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3,marginTop:6}}>
                {(() => {
                  const sensEcole = ecoleConfig?.sens_recitation_defaut || 'desc';
                  const hizbList = sensEcole === 'asc'
                    ? Array.from({length:60},(_,i)=>i+1)
                    : Array.from({length:60},(_,i)=>60-i);
                  return hizbList.map(n=>{
                  const sel = hizbIdsSafe.includes(n);
                  return (
                    <div key={n} onClick={()=>toggleHizb(n)}
                      style={{borderRadius:6,padding:'5px 2px',textAlign:'center',cursor:'pointer',fontSize:11,fontWeight:700,
                        background: sel ? '#085041' : '#f0f0ec',
                        color: sel ? '#fff' : '#888',
                        border: `0.5px solid ${sel ? '#085041' : '#e0e0d8'}`,
                        transition:'all 0.1s'}}>
                      {n}
                    </div>
                  );
                });
                })()}
              </div>
              {hizbIdsSafe.length > 0 && (
                <div style={{marginTop:6,fontSize:11,color:'#085041',fontWeight:600}}>
                  {lang==='ar'?'الأحزاب المختارة:':'Hizb sélectionnés:'} {[...hizbIdsSafe].sort((a,b)=>a-b).join(', ')}
                </div>
              )}
            </div>
          )}
          {newJalon.type_jalon === 'ensemble_sourates' && (
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'مجموعة السور':'Ensemble de sourates'} <span style={{color:'#E24B4A'}}>*</span></label>
              <select className="field-select" value={newJalon.ensemble_id} onChange={e=>setNewJalon({...newJalon,ensemble_id:e.target.value})}>
                <option value="">{lang==='ar'?'اختر مجموعة':'Choisir un ensemble'}</option>
                {ensembesSafe.map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
          )}
          {newJalon.type_jalon === 'examen' && (
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'الامتحان':'Examen'} <span style={{color:'#E24B4A'}}>*</span></label>
              <select className="field-select" value={newJalon.examen_id} onChange={e=>setNewJalon({...newJalon,examen_id:e.target.value})}>
                <option value="">{lang==='ar'?'اختر امتحاناً':'Choisir un examen'}</option>
                {(examens||[]).map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={ajouterJalon} disabled={savingJalon}>
          {savingJalon ? '...' : (lang==='ar'?'إضافة المرحلة':'Ajouter le jalon')}
        </button>
      </div>

      {/* Liste des jalons */}
      <div className="section-label">{lang==='ar'?'المراحل المُعرَّفة':'Jalons configurés'} ({jalons.length})</div>
      {jalons.length === 0 ? (
        <div className="empty">{lang==='ar'?'لا توجد مراحل بعد — أضف أول مرحلة أعلاه':'Aucun jalon — ajoutez-en un ci-dessus'}</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {jalons.map(j => (
            <div key={j.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,opacity:j.actif?1:0.5}}>
              <div style={{width:44,height:44,borderRadius:12,background:j.actif?'#FAEEDA':'#f0f0ec',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
                {j.type_jalon==='examen'?'📝':'🏅'}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a',direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{j.nom_ar||j.nom}</div>
                <div style={{fontSize:11,color:'#EF9F27',marginTop:2,fontWeight:600}}>{typeLabel(j)}</div>
                {j.condition_obtention==='cumul_puis_examen'&&j.examen_final_id&&(
                  <div style={{fontSize:10,color:'#534AB7',marginTop:2}}>
                    🎯 {lang==='ar'?'الامتحان الختامي:':'Examen final:'} {(examens||[]).find(e=>e.id===j.examen_final_id)?.nom||'—'}
                  </div>
                )}
                <div style={{fontSize:10,marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                  <span style={{padding:'1px 6px',borderRadius:10,fontSize:9,fontWeight:600,
                    background:j.condition_obtention==='seance_unique'?'#EEEDFE':'#E1F5EE',
                    color:j.condition_obtention==='seance_unique'?'#534AB7':'#085041'}}>
                    {j.condition_obtention==='cumul_puis_examen'?(lang==='ar'?'🎯 تراكمي + امتحان':'🎯 Cumul + examen'):(lang==='ar'?'📚 تراكمي فقط':'📚 Cumulatif seul')}
                  </span>
                </div>
                <div style={{fontSize:10,color:'#bbb',marginTop:2}}>
                  {lang==='ar'?'تاريخ الإنشاء:':'Créé le:'} {j.created_at ? new Date(j.created_at).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>toggleActif(j)}
                  style={{padding:'4px 8px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',
                    background:j.actif?'#E1F5EE':'#f0f0ec',color:j.actif?'#085041':'#888',
                    border:`0.5px solid ${j.actif?'#1D9E7530':'#e0e0d8'}`}}>
                  {j.actif ? (lang==='ar'?'نشط':'Actif') : (lang==='ar'?'غير نشط':'Inactif')}
                </button>
                <button onClick={()=>supprimerJalon(j.id)}
                  style={{padding:'4px 8px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',cursor:'pointer',fontSize:11,fontWeight:600}}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
