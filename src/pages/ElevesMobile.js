import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isSourateNiveauDyn } from '../lib/helpers';

export default function ElevesMobile({ user, navigate, goBack, lang='ar' }) {
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('tous');
  const [showForm, setShowForm] = useState(false);
  const [editEleve, setEditEleve] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgType, setMsgType] = useState('');

  const emptyForm = { prenom:'', nom:'', niveau:'Débutant', code_niveau:'', eleve_id_ecole:'',
    instituteur_referent_id:'', hizb_depart:0, tomon_depart:1, sourates_acquises:0, telephone:'', date_inscription:'' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
    const [{ data: ed }, { data: id }, { data: niv }] = await Promise.all([
      supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id).limit(500).order('nom').order('nom'),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
      supabase.from('niveaux').select('id,code,nom,couleur,type').eq('ecole_id', user.ecole_id).order('ordre'),
    ]);
    setEleves(ed || []);
    setInstituteurs(id || []);
    setNiveaux(niv || []);
    // Set default code_niveau to first niveau
    if (niv && niv.length > 0) {
      setForm(f => f.code_niveau ? f : { ...f, code_niveau: niv[0].code });
    }
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const showMsg = (type, text) => {
    setMsgType(type); setMsgText(text);
    setTimeout(() => setMsgText(''), 4000);
  };

  const getNiveauColor = (code) =>
    niveaux.find(n=>n.code===code)?.couleur ||
    {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[code] || '#888';

  const startAdd = () => {
    const defaultCode = niveaux[0]?.code || '1';
    setForm({ ...emptyForm, code_niveau: defaultCode });
    setEditEleve(null);
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const startEdit = (e) => {
    setForm({ prenom:e.prenom||'', nom:e.nom||'', niveau:e.niveau||'Débutant',
      code_niveau:e.code_niveau||'', eleve_id_ecole:e.eleve_id_ecole||'',
      instituteur_referent_id:e.instituteur_referent_id||'',
      hizb_depart:e.hizb_depart||0, tomon_depart:e.tomon_depart||1,
      sourates_acquises:e.sourates_acquises||0,
      telephone:e.telephone||'', date_inscription:e.date_inscription||'' });
    setEditEleve(e);
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const handleSave = async () => {
    if (!form.prenom?.trim()) return showMsg('error', lang==='ar'?'الاسم إلزامي':'Prénom obligatoire');
    if (!form.nom?.trim()) return showMsg('error', lang==='ar'?'اللقب إلزامي':'Nom obligatoire');
    if (!form.eleve_id_ecole?.trim()) return showMsg('error', lang==='ar'?'رقم التعريف إلزامي':'ID élève obligatoire');
    if (!form.instituteur_referent_id) return showMsg('error', lang==='ar'?'اختر الأستاذ المرجع':'Choisir un instituteur');
    setSaving(true);
    const payload = {
      prenom: form.prenom.trim(), nom: form.nom.trim(), niveau: form.niveau,
      code_niveau: form.code_niveau, ecole_id: user.ecole_id,
      eleve_id_ecole: form.eleve_id_ecole.trim(),
      instituteur_referent_id: form.instituteur_referent_id,
      hizb_depart: parseInt(form.hizb_depart)||0,
      tomon_depart: parseInt(form.tomon_depart)||1,
      sourates_acquises: parseInt(form.sourates_acquises)||0,
      telephone: form.telephone?.trim()||null,
      date_inscription: form.date_inscription||null,
    };
    if (editEleve) {
      const { error } = await supabase.from('eleves').update(payload).eq('id', editEleve.id);
      if (error) { showMsg('error', error.message); setSaving(false); return; }
      showMsg('success', lang==='ar'?'✅ تم تحديث الطالب':'✅ Élève mis à jour');
    } else {
      // Check duplicate
      const { data: ex } = await supabase.from('eleves').select('id')
        .eq('eleve_id_ecole', form.eleve_id_ecole.trim()).eq('ecole_id', user.ecole_id).maybeSingle();
      if (ex) { showMsg('error', lang==='ar'?'رقم التعريف مستخدم مسبقاً':'ID élève déjà utilisé'); setSaving(false); return; }
      const { error } = await supabase.from('eleves').insert(payload);
      if (error) { showMsg('error', error.message); setSaving(false); return; }
      showMsg('success', lang==='ar'?'✅ تم إضافة الطالب':'✅ Élève ajouté');
    }
    setSaving(false);
    setShowForm(false);
    setEditEleve(null);
    setForm({ ...emptyForm, code_niveau: niveaux[0]?.code||'' });
    loadData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm(lang==='ar'?'هل أنت متأكد من حذف الطالب؟':'Confirmer la suppression ?')) return;
    await supabase.from('eleves').delete().eq('id', id);
    loadData();
  };

  const elevesFiltres = eleves.filter(e => {
    const matchSearch = !search || `${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(search.toLowerCase());
    const matchNiveau = filtreNiveau === 'tous' || e.code_niveau === filtreNiveau;
    return matchSearch && matchNiveau;
  });

  const isSour = (code) => niveaux.find(n=>n.code===code)?.type === 'sourate' || ['5B','5A','2M'].includes(code||'');
  const niveauLabel = (e) => {
    const v = e.niveau;
    if (v==='Avancé'||v==='متقدم') return { label:lang==='ar'?'متقدم':'Avancé', color:'#085041' };
    if (v==='Intermédiaire'||v==='متوسط') return { label:lang==='ar'?'متوسط':'Interm.', color:'#378ADD' };
    return { label:lang==='ar'?'مبتدئ':'Débutant', color:'#EF9F27' };
  };

  return (
    <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>

      {/* ── HEADER ── */}
      <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)', padding:'48px 16px 16px', position:'sticky', top:0, zIndex:100}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')}
            style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:10, padding:'8px 12px', color:'#fff', fontSize:16, cursor:'pointer'}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:18, fontWeight:800, color:'#fff'}}>👥 {lang==='ar'?'الطلاب':'Élèves'}</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.75)'}}>{eleves.length} {lang==='ar'?'طالب مسجل':'inscrits'}</div>
          </div>
          {user.role==='surveillant' && (
            <button onClick={showForm ? ()=>{ setShowForm(false); setEditEleve(null); } : startAdd}
              style={{background:'rgba(255,255,255,0.25)',
                border:'1px solid rgba(255,255,255,0.3)', borderRadius:10, padding:'8px 14px',
                color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
              {showForm ? '✕' : `+ ${lang==='ar'?'إضافة':'Ajouter'}`}
            </button>
          )}
        </div>
        {/* Barre de recherche */}
        {!showForm && (
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={lang==='ar'?'🔍 بحث عن طالب...':'🔍 Rechercher...'}
            style={{width:'100%', padding:'10px 14px', borderRadius:12, border:'none', fontSize:14,
              fontFamily:'inherit', boxSizing:'border-box', background:'rgba(255,255,255,0.15)',
              color:'#fff', outline:'none'}}/>
        )}
      </div>

      {/* ── MESSAGE ── */}
      {msgText && (
        <div style={{margin:'10px 12px 0', padding:'10px 14px', borderRadius:10, fontSize:13,
          background: msgType==='error'?'#FCEBEB':'#E1F5EE',
          color: msgType==='error'?'#E24B4A':'#085041', fontWeight:500}}>
          {msgText}
        </div>
      )}

      {/* ── FORMULAIRE ── */}
      {showForm && (
        <div style={{background:'#fff', margin:'12px', borderRadius:16, padding:'16px',
          border:`1.5px solid ${editEleve?'#378ADD':'#1D9E75'}`}}>
          <div style={{fontSize:15, fontWeight:700, color:'#085041', marginBottom:14}}>
            {editEleve ? (lang==='ar'?'✏️ تعديل الطالب':'✏️ Modifier') : (lang==='ar'?'👤 إضافة طالب':'👤 Nouvel élève')}
          </div>

          {/* Prénom + Nom */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:2}}>
            {[{l:lang==='ar'?'الاسم *':'Prénom *',k:'prenom'},{l:lang==='ar'?'اللقب *':'Nom *',k:'nom'}].map(f=>(
              <div key={f.k} style={{marginBottom:10}}>
                <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{f.l}</label>
                <input style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                  value={form[f.k]} onChange={e=>setForm(x=>({...x,[f.k]:e.target.value}))} placeholder={f.l.replace(' *','')}/>
              </div>
            ))}
          </div>

          {/* Niveau scolaire — chips */}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'المستوى الدراسي *':'Niveau scolaire *'}</label>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {niveaux.map(n => {
                const nc = n.couleur || getNiveauColor(n.code);
                const sel = form.code_niveau === n.code;
                return (
                  <div key={n.code} onClick={()=>setForm(x=>({...x,code_niveau:n.code}))}
                    style={{padding:'7px 13px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:sel?700:400,
                      background:sel?nc:'#f5f5f0', color:sel?'#fff':'#666',
                      border:`1.5px solid ${sel?nc:'#e0e0d8'}`}}>
                    {n.code}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ID + Référent */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:2}}>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{lang==='ar'?'رقم التعريف *':'ID élève *'}</label>
              <input style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                value={form.eleve_id_ecole} onChange={e=>setForm(x=>({...x,eleve_id_ecole:e.target.value}))} placeholder="001"/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{lang==='ar'?'الأستاذ *':'Référent *'}</label>
              <select style={{width:'100%',padding:'11px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:12,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
                value={form.instituteur_referent_id} onChange={e=>setForm(x=>({...x,instituteur_referent_id:e.target.value}))}>
                <option value="">—</option>
                {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
              </select>
            </div>
          </div>

          {/* Téléphone + Date */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:2}}>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{lang==='ar'?'هاتف الولي':'Tél. parent'}</label>
              <input type="tel" style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                value={form.telephone} onChange={e=>setForm(x=>({...x,telephone:e.target.value}))} placeholder="06XXXXXXXX"/>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{lang==='ar'?'تاريخ التسجيل':'Inscription'}</label>
              <input type="date" style={{width:'100%',padding:'11px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:12,fontFamily:'inherit',boxSizing:'border-box'}}
                value={form.date_inscription} onChange={e=>setForm(x=>({...x,date_inscription:e.target.value}))}/>
            </div>
          </div>

          {/* Hizb/Tomon si niveau hizb */}
          {!isSour(form.code_niveau) && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
              {[{l:lang==='ar'?'حزب الانطلاق':'Hizb départ',k:'hizb_depart',max:60},{l:'Tomon',k:'tomon_depart',max:8}].map(f=>(
                <div key={f.k}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:4}}>{f.l}</label>
                  <input type="number" min="0" max={f.max}
                    style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={form[f.k]} onChange={e=>setForm(x=>({...x,[f.k]:e.target.value}))}/>
                </div>
              ))}
            </div>
          )}

          {/* Boutons */}
          <div style={{display:'flex', gap:8, marginTop:4}}>
            <button onClick={()=>{setShowForm(false);setEditEleve(null);setForm({...emptyForm,code_niveau:niveaux[0]?.code||''});}}
              style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              {lang==='ar'?'إلغاء':'Annuler'}
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{flex:2,padding:'13px',background:editEleve?'#378ADD':'#1D9E75',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              {saving?'...':(editEleve?(lang==='ar'?'تحديث ✓':'Mettre à jour ✓'):(lang==='ar'?'حفظ':'Enregistrer'))}
            </button>
          </div>
        </div>
      )}

      {/* ── FILTRES NIVEAUX ── */}
      {!showForm && (
        <div style={{display:'flex', gap:6, overflowX:'auto', padding:'10px 12px', scrollbarWidth:'none', background:'#fff', borderBottom:'0.5px solid #e0e0d8'}}>
          {['tous', ...niveaux.map(n=>n.code)].map(code => {
            const nc = code==='tous' ? '#085041' : getNiveauColor(code);
            const sel = filtreNiveau===code;
            return (
              <div key={code} onClick={()=>setFiltreNiveau(code)}
                style={{padding:'5px 14px', borderRadius:20, fontSize:11, fontWeight:600, flexShrink:0, cursor:'pointer',
                  background:sel?nc:'#f0f0ec', color:sel?'#fff':'#666', border:`1.5px solid ${sel?nc:'transparent'}`}}>
                {code==='tous'?(lang==='ar'?'الكل':'Tous'):code}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LISTE ── */}
      {!showForm && (
        <>
          <div style={{padding:'8px 14px', fontSize:11, color:'#888'}}>
            {elevesFiltres.length} {lang==='ar'?'طالب':'élève(s)'}
          </div>
          {loading ? (
            <div style={{textAlign:'center', padding:'3rem', color:'#888'}}>...</div>
          ) : elevesFiltres.length===0 ? (
            <div style={{textAlign:'center', padding:'3rem', color:'#aaa', fontSize:13}}>
              <div style={{fontSize:36, marginBottom:8}}>👥</div>
              <div>{lang==='ar'?'لا يوجد طلاب':'Aucun élève'}</div>
            </div>
          ) : (
            <div style={{padding:'0 12px'}}>
              {elevesFiltres.map(e => {
                const nc = getNiveauColor(e.code_niveau);
                const inst = instituteurs.find(i=>i.id===e.instituteur_referent_id);
                const nl = niveauLabel(e);
                return (
                  <div key={e.id} style={{background:'#fff', borderRadius:14, padding:'12px 14px', marginBottom:8,
                    border:'0.5px solid #e0e0d8', display:'flex', alignItems:'center', gap:10,
                    boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                    {/* Avatar */}
                    <div onClick={()=>navigate('fiche',e)}
                      style={{width:42,height:42,borderRadius:'50%',background:`${nc}20`,color:nc,
                        display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0,cursor:'pointer'}}>
                      {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                    </div>
                    {/* Info */}
                    <div onClick={()=>navigate('fiche',e)} style={{flex:1, minWidth:0, cursor:'pointer'}}>
                      <div style={{fontWeight:700, fontSize:13}}>{e.prenom} {e.nom}</div>
                      <div style={{display:'flex', gap:5, marginTop:2, alignItems:'center', flexWrap:'wrap'}}>
                        <span style={{padding:'1px 6px',borderRadius:10,fontSize:10,fontWeight:700,background:`${nc}20`,color:nc}}>{e.code_niveau||'?'}</span>
                        <span style={{fontSize:10,fontWeight:500,color:nl.color}}>{nl.label}</span>
                        {e.eleve_id_ecole&&<span style={{fontSize:10,color:'#bbb'}}>#{e.eleve_id_ecole}</span>}
                      </div>
                      <div style={{display:'flex', gap:8, marginTop:2, fontSize:10, color:'#888', flexWrap:'wrap'}}>
                        {inst&&<span>👨‍🏫 {inst.prenom} {inst.nom}</span>}
                        {isSour(e.code_niveau)
                          ? <span style={{color:'#1D9E75',fontWeight:600}}>📖 {e.sourates_acquises||0}</span>
                          : <span>H.{e.hizb_depart} T.{e.tomon_depart}</span>}
                        {e.telephone&&<span>📞 {e.telephone}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    {user.role==='surveillant' && (
                      <div style={{display:'flex', gap:5, flexShrink:0}}>
                        <button onClick={()=>startEdit(e)}
                          style={{background:'#E6F1FB',color:'#378ADD',border:'none',borderRadius:8,padding:'7px 9px',fontSize:12,cursor:'pointer'}}>✏️</button>
                        <button onClick={()=>handleDelete(e.id)}
                          style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,padding:'7px 9px',fontSize:12,cursor:'pointer'}}>🗑</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
