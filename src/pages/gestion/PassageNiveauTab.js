import React from 'react';
import { supabase } from '../../lib/supabase';
import MobileSkeletonList from '../../components/MobileSkeletonList';


// ══════════════════════════════════════════════════════
// COMPOSANT PassageNiveauTab — Règles de passage de niveau
// ══════════════════════════════════════════════════════
export function PassageNiveauTab({ user, lang, niveaux, showMsg }) {
  const [regles, setRegles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [newRegle, setNewRegle] = React.useState({
    niveau_from: '', niveau_to: '', type_depart: 'continuer',
    hizb_depart_fixe: 0, tomon_depart_fixe: 1, sourates_acquises_fixe: 0, note: ''
  });

  React.useEffect(() => { loadRegles(); }, []);

  const loadRegles = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('regles_passage_niveau')
        .select('*').eq('ecole_id', user.ecole_id).order('created_at');
      setRegles(data || []);
    } catch (e) {
      console.error('[Gestion] Erreur loadRegles:', e);
    } finally {
      setLoading(false);
    }
  };

  const ajouterRegle = async () => {
    if (!newRegle.niveau_from || !newRegle.niveau_to)
      return showMsg('error', lang==='ar'?'اختر المستوى المصدر والهدف':'Choisissez les niveaux source et cible');
    if (newRegle.niveau_from === newRegle.niveau_to)
      return showMsg('error', lang==='ar'?'لا يمكن أن يكون المستويان متطابقين':'Les niveaux ne peuvent pas être identiques');
    setSaving(true);
    const payload = {
      ecole_id: user.ecole_id,
      niveau_from: newRegle.niveau_from,
      niveau_to: newRegle.niveau_to,
      type_depart: newRegle.type_depart,
      hizb_depart_fixe: parseInt(newRegle.hizb_depart_fixe)||0,
      tomon_depart_fixe: parseInt(newRegle.tomon_depart_fixe)||1,
      sourates_acquises_fixe: parseInt(newRegle.sourates_acquises_fixe)||0,
      note: newRegle.note||null,
      actif: true,
    };
    await supabase.from('regles_passage_niveau').insert(payload);
    await loadRegles();
    setNewRegle({ niveau_from:'', niveau_to:'', type_depart:'continuer', hizb_depart_fixe:0, tomon_depart_fixe:1, sourates_acquises_fixe:0, note:'' });
    setSaving(false);
    showMsg('success', lang==='ar'?'تمت إضافة قاعدة الانتقال':'Règle de passage ajoutée');
  };

  const supprimerRegle = async (id) => {
    await supabase.from('regles_passage_niveau').delete().eq('id', id);
    setRegles(prev => prev.filter(r => r.id !== id));
  };

  const toggleActif = async (regle) => {
    await supabase.from('regles_passage_niveau').update({ actif: !regle.actif }).eq('id', regle.id);
    setRegles(prev => prev.map(r => r.id===regle.id ? {...r, actif: !r.actif} : r));
  };

  const getNiveauNom = (code) => niveaux.find(n=>n.code===code)?.nom || code;
  const getNiveauColor = (code) => niveaux.find(n=>n.code===code)?.couleur || '#888';

  const typeDepartLabel = (type) => ({
    'continuer': lang==='ar'?'يستمر من موقعه الحالي':'Continue depuis sa position actuelle',
    'debut': lang==='ar'?'يبدأ من بداية البرنامج':'Repart du début du programme',
    'personnalise': lang==='ar'?'موقع مخصص':'Position personnalisée',
  })[type] || type;

  const typeDepartColor = (type) => ({'continuer':'#1D9E75','debut':'#EF9F27','personnalise':'#534AB7'})[type]||'#888';

  return (
    <div>
      <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
        {lang==='ar'?'حدد قواعد انتقال الطلاب من مستوى إلى آخر وموقع انطلاقهم في البرنامج الجديد':'Définissez les règles de passage entre niveaux et la position de départ dans le nouveau programme'}
      </div>

      {/* Info box */}
      <div style={{background:'#E1F5EE',borderRadius:10,padding:'12px 14px',marginBottom:'1.5rem',fontSize:12,color:'#085041',border:'0.5px solid #1D9E7530'}}>
        <div style={{fontWeight:700,marginBottom:6}}>ℹ️ {lang==='ar'?'كيف يعمل هذا؟':'Comment ça fonctionne ?'}</div>
        <div style={{lineHeight:1.6}}>
          {lang==='ar'
            ?'عند تغيير مستوى طالب، يبحث النظام عن قاعدة مطابقة. إذا وُجدت، يطبق موقع الانطلاق المحدد. إذا لم توجد قاعدة، يستمر الطالب من موقعه الحالي تلقائياً.'
            :"Lors du changement de niveau d'un élève, le système cherche une règle correspondante. Si trouvée, applique le départ configuré. Sinon, l'élève continue depuis sa position actuelle."}
        </div>
      </div>

      {/* Formulaire */}
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="section-label">{lang==='ar'?'إضافة قاعدة انتقال':'Ajouter une règle de passage'}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 20px',marginBottom:14}}>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'المستوى المصدر (من)':'Niveau source (de)'} <span style={{color:'#E24B4A'}}>*</span></label>
            <select className="field-select" value={newRegle.niveau_from} onChange={e=>setNewRegle({...newRegle,niveau_from:e.target.value})}>
              <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
              {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'المستوى الهدف (إلى)':'Niveau cible (vers)'} <span style={{color:'#E24B4A'}}>*</span></label>
            <select className="field-select" value={newRegle.niveau_to} onChange={e=>setNewRegle({...newRegle,niveau_to:e.target.value})}>
              <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
              {niveaux.filter(n=>n.code!==newRegle.niveau_from).map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
            </select>
          </div>
        </div>

        {/* Type de départ */}
        <div className="field-group" style={{marginBottom:14}}>
          <label className="field-lbl">{lang==='ar'?'موقع الانطلاق في البرنامج الجديد':'Position de départ dans le nouveau programme'} <span style={{color:'#E24B4A'}}>*</span></label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:4}}>
            {[
              {val:'continuer', icon:'▶️', label:lang==='ar'?'يستمر من موقعه':'Continue', desc:lang==='ar'?'يبدأ من الحزب/السورة التي وصل إليها':'Repart du Hizb/Sourate où il en était'},
              {val:'debut', icon:'🔄', label:lang==='ar'?'من البداية':'Début', desc:lang==='ar'?'يبدأ من أول الثُّمن أو أول سورة في البرنامج':'Repart du premier Tomon/Sourate du programme'},
              {val:'personnalise', icon:'🎯', label:lang==='ar'?'موقع محدد':'Personnalisé', desc:lang==='ar'?'تحديد موقع البداية يدوياً':'Définir manuellement la position de départ'},
            ].map(opt=>(
              <div key={opt.val} onClick={()=>setNewRegle({...newRegle,type_depart:opt.val})}
                style={{padding:'10px',borderRadius:10,cursor:'pointer',textAlign:'center',
                  border:`2px solid ${newRegle.type_depart===opt.val?typeDepartColor(opt.val):'#e0e0d8'}`,
                  background:newRegle.type_depart===opt.val?typeDepartColor(opt.val)+'15':'#fff'}}>
                <div style={{fontSize:20,marginBottom:4}}>{opt.icon}</div>
                <div style={{fontWeight:700,fontSize:12,color:newRegle.type_depart===opt.val?typeDepartColor(opt.val):'#333'}}>{opt.label}</div>
                <div style={{fontSize:10,color:'#888',marginTop:2}}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Position personnalisée */}
        {newRegle.type_depart==='personnalise' && (() => {
          const cibleType = niveaux.find(n=>n.code===newRegle.niveau_to)?.type;
          return cibleType==='sourate' ? (
            <div className="field-group" style={{marginBottom:14}}>
              <label className="field-lbl">{lang==='ar'?'عدد السور المحفوظة كمكتسبات':'Nb sourates acquises au départ'}</label>
              <input className="field-input" type="number" min="0" value={newRegle.sourates_acquises_fixe}
                onChange={e=>setNewRegle({...newRegle,sourates_acquises_fixe:e.target.value})}/>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 20px',marginBottom:14}}>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'حزب الانطلاق':'Hizb de départ'}</label>
                <input className="field-input" type="number" min="0" max="60" value={newRegle.hizb_depart_fixe}
                  onChange={e=>setNewRegle({...newRegle,hizb_depart_fixe:e.target.value})}/>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'الثُّمن':'Tomon'}</label>
                <select className="field-select" value={newRegle.tomon_depart_fixe} onChange={e=>setNewRegle({...newRegle,tomon_depart_fixe:e.target.value})}>
                  {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{lang==='ar'?'ث':'T'}.{n}</option>)}
                </select>
              </div>
            </div>
          );
        })()}

        <div className="field-group" style={{marginBottom:14}}>
          <label className="field-lbl">{lang==='ar'?'ملاحظة (اختياري)':'Note (optionnelle)'}</label>
          <input className="field-input" value={newRegle.note} onChange={e=>setNewRegle({...newRegle,note:e.target.value})}
            placeholder={lang==='ar'?'مثال: انتقال من الابتدائي إلى الإعدادي':'Ex: Passage du primaire au collège'}/>
        </div>
        <button className="btn-primary" onClick={ajouterRegle} disabled={saving}>
          {saving?'...':(lang==='ar'?'إضافة القاعدة':'Ajouter la règle')}
        </button>
      </div>

      {/* Liste des règles */}
      <div className="section-label">{lang==='ar'?'القواعد المُعرَّفة':'Règles configurées'} ({regles.length})</div>
      {loading ? <MobileSkeletonList type="card-simple" count={4} /> : regles.length===0 ? (
        <div className="empty">{lang==='ar'?'لا توجد قواعد — الانتقال الافتراضي: الطالب يستمر من موقعه':"Aucune règle — comportement par défaut : l'élève continue depuis sa position"}</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {regles.map(r => {
            const fromColor = getNiveauColor(r.niveau_from);
            const toColor = getNiveauColor(r.niveau_to);
            const dColor = typeDepartColor(r.type_depart);
            return (
              <div key={r.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',opacity:r.actif?1:0.5}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <span style={{padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:700,background:fromColor+'20',color:fromColor}}>{r.niveau_from}</span>
                  <span style={{fontSize:16,color:'#888'}}>→</span>
                  <span style={{padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:700,background:toColor+'20',color:toColor}}>{r.niveau_to}</span>
                  <span style={{flex:1}}/>
                  <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:dColor+'15',color:dColor}}>
                    {r.type_depart==='continuer'?'▶️':r.type_depart==='debut'?'🔄':'🎯'} {typeDepartLabel(r.type_depart)}
                  </span>
                </div>
                {r.type_depart==='personnalise'&&(
                  <div style={{fontSize:11,color:'#888',marginBottom:6}}>
                    {niveaux.find(n=>n.code===r.niveau_to)?.type==='sourate'
                      ? `📖 ${lang==='ar'?'السور المحفوظة:':'Sourates acquises:'} ${r.sourates_acquises_fixe}`
                      : `📍 ${lang==='ar'?'الحزب':'Hizb'} ${r.hizb_depart_fixe} · ${lang==='ar'?'ث':'T'}.${r.tomon_depart_fixe}`
                    }
                  </div>
                )}
                {r.note&&<div style={{fontSize:11,color:'#aaa',fontStyle:'italic',marginBottom:6}}>{r.note}</div>}
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>toggleActif(r)}
                    style={{padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:600,cursor:'pointer',
                      background:r.actif?'#E1F5EE':'#f0f0ec',color:r.actif?'#085041':'#888',border:'none'}}>
                    {r.actif?(lang==='ar'?'نشط':'Actif'):(lang==='ar'?'غير نشط':'Inactif')}
                  </button>
                  <button onClick={()=>supprimerRegle(r.id)}
                    style={{padding:'3px 8px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'none',cursor:'pointer',fontSize:10,fontWeight:600}}>
                    🗑 {lang==='ar'?'حذف':'Supprimer'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ── Passage niveau mobile (composant léger) ──
export function MobilePassageNiveauTab({ user, lang, niveaux, showMsg }) {
  const [regles, setRegles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newR, setNewR] = React.useState({niveau_from:'',niveau_to:'',type_depart:'continuer',hizb_depart_fixe:0,tomon_depart_fixe:1,sourates_acquises_fixe:0,note:''});

  React.useEffect(()=>{ loadRegles(); },[]);
  const loadRegles = async()=>{
    setLoading(true);
    const {data}=await supabase.from('regles_passage_niveau').select('*').eq('ecole_id',user.ecole_id).order('created_at');
    setRegles(data||[]); setLoading(false);
  };
  const getNC=(code)=>niveaux.find(n=>n.code===code)?.couleur||{'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[code]||'#888';
  const typLabel=(t)=>({'continuer':lang==='ar'?'▶️ يستمر من موقعه':'▶️ Continue','debut':lang==='ar'?'🔄 من البداية':'🔄 Début','personnalise':lang==='ar'?'🎯 موقع محدد':'🎯 Personnalisé'})[t]||t;
  const typColor=(t)=>({'continuer':'#1D9E75','debut':'#EF9F27','personnalise':'#534AB7'})[t]||'#888';

  return (
    <div>
      {user.role==='surveillant'&&(
        <button onClick={()=>setShowForm(v=>!v)}
          style={{width:'100%',padding:'13px',background:showForm?'#f5f5f0':'#1D9E75',color:showForm?'#666':'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:12}}>
          {showForm?'✕ '+(lang==='ar'?'إلغاء':'Annuler'):'+ '+(lang==='ar'?'إضافة قاعدة':'Ajouter une règle')}
        </button>
      )}
      {showForm&&user.role==='surveillant'&&(
        <div style={{background:'#fff',borderRadius:14,padding:'16px',marginBottom:14,border:'1.5px solid #1D9E75'}}>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>{lang==='ar'?'من مستوى':'De niveau'} *</label>
            <select className="field-select"
              value={newR.niveau_from} onChange={e=>setNewR({...newR,niveau_from:e.target.value})}>
              <option value="">—</option>
              {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>{lang==='ar'?'إلى مستوى':'Vers niveau'} *</label>
            <select className="field-select"
              value={newR.niveau_to} onChange={e=>setNewR({...newR,niveau_to:e.target.value})}>
              <option value="">—</option>
              {niveaux.filter(n=>n.code!==newR.niveau_from).map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
            </select>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'موقع الانطلاق':'Départ'} *</label>
            <div style={{display:'flex',gap:6}}>
              {[{v:'continuer',icon:'▶️',l:lang==='ar'?'يستمر':'Continue'},{v:'debut',icon:'🔄',l:lang==='ar'?'البداية':'Début'},{v:'personnalise',icon:'🎯',l:lang==='ar'?'محدد':'Perso.'}].map(opt=>(
                <div key={opt.v} onClick={()=>setNewR({...newR,type_depart:opt.v})}
                  style={{flex:1,padding:'10px 4px',borderRadius:10,textAlign:'center',cursor:'pointer',
                    border:`2px solid ${newR.type_depart===opt.v?typColor(opt.v):'#e0e0d8'}`,
                    background:newR.type_depart===opt.v?typColor(opt.v)+'15':'#fff'}}>
                  <div style={{fontSize:16}}>{opt.icon}</div>
                  <div style={{fontSize:10,fontWeight:600,color:newR.type_depart===opt.v?typColor(opt.v):'#666',marginTop:2}}>{opt.l}</div>
                </div>
              ))}
            </div>
          </div>
          {newR.type_depart==='personnalise'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div><label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>Hizb</label>
                <input type="number" min="0" max="60" style={{width:'100%',padding:'11px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                  value={newR.hizb_depart_fixe} onChange={e=>setNewR({...newR,hizb_depart_fixe:e.target.value})}/></div>
              <div><label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>Tomon</label>
                <select className="field-select"
                  value={newR.tomon_depart_fixe} onChange={e=>setNewR({...newR,tomon_depart_fixe:e.target.value})}>
                  {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{lang==='ar'?'ث':'T'}.{n}</option>)}
                </select></div>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'ملاحظة':'Note'}</label>
            <input style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
              value={newR.note} onChange={e=>setNewR({...newR,note:e.target.value})} placeholder={lang==='ar'?'سبب القاعدة...':'Ex: Primaire → Collège'}/>
          </div>
          <button onClick={async()=>{
            if(!newR.niveau_from||!newR.niveau_to) return showMsg('error',lang==='ar'?'اختر المستويين':'Choisissez les niveaux');
            setSaving(true);
            await supabase.from('regles_passage_niveau').insert({ecole_id:user.ecole_id,...newR,hizb_depart_fixe:parseInt(newR.hizb_depart_fixe)||0,tomon_depart_fixe:parseInt(newR.tomon_depart_fixe)||1,sourates_acquises_fixe:parseInt(newR.sourates_acquises_fixe)||0,actif:true});
            await loadRegles();
            setNewR({niveau_from:'',niveau_to:'',type_depart:'continuer',hizb_depart_fixe:0,tomon_depart_fixe:1,sourates_acquises_fixe:0,note:''});
            setShowForm(false); setSaving(false);
            showMsg('success',lang==='ar'?'تمت إضافة القاعدة':'Règle ajoutée !');
          }} disabled={saving}
            style={{width:'100%',padding:'13px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            {saving?'...':(lang==='ar'?'حفظ القاعدة':'Enregistrer la règle')}
          </button>
        </div>
      )}
      {loading?<MobileSkeletonList type="card-simple" count={4} />
        :regles.length===0?(
          <div style={{textAlign:'center',padding:'2rem',background:'#fff',borderRadius:12,color:'#aaa'}}>
            <div style={{fontSize:32,marginBottom:8}}>🎓</div>
            <div style={{fontSize:13}}>{lang==='ar'?'لا توجد قواعد بعد':'Aucune règle configurée'}</div>
            <div style={{fontSize:11,marginTop:4,color:'#ccc'}}>{lang==='ar'?'الطالب يستمر من موقعه افتراضياً':'Par défaut : continue depuis sa position'}</div>
          </div>
        ):regles.map(r=>{
          const fc=getNC(r.niveau_from); const tc=getNC(r.niveau_to); const dc=typColor(r.type_depart);
          return(
            <div key={r.id} style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,border:'0.5px solid #e0e0d8',opacity:r.actif?1:0.5}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:fc+'20',color:fc}}>{r.niveau_from}</span>
                <span style={{color:'#aaa'}}>→</span>
                <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:tc+'20',color:tc}}>{r.niveau_to}</span>
                <span style={{flex:1}}/>
                <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:dc+'15',color:dc}}>{typLabel(r.type_depart)}</span>
              </div>
              {r.note&&<div style={{fontSize:11,color:'#aaa',fontStyle:'italic',marginBottom:6}}>{r.note}</div>}
              <div style={{display:'flex',gap:6}}>
                <button onClick={async()=>{await supabase.from('regles_passage_niveau').update({actif:!r.actif}).eq('id',r.id);setRegles(prev=>prev.map(x=>x.id===r.id?{...x,actif:!x.actif}:x));}}
                  style={{padding:'4px 10px',borderRadius:6,fontSize:10,fontWeight:600,cursor:'pointer',border:'none',background:r.actif?'#E1F5EE':'#f0f0ec',color:r.actif?'#085041':'#888'}}>
                  {r.actif?(lang==='ar'?'نشط':'Actif'):(lang==='ar'?'غير نشط':'Inactif')}
                </button>
                <button onClick={async()=>{await supabase.from('regles_passage_niveau').delete().eq('id',r.id);setRegles(prev=>prev.filter(x=>x.id!==r.id));}}
                  style={{padding:'4px 8px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'none',cursor:'pointer',fontSize:11}}>🗑</button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
