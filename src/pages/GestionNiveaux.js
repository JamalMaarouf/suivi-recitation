import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

const COULEURS_PRESET = [
  '#534AB7','#378ADD','#1D9E75','#EF9F27','#E24B4A',
  '#D85A30','#085041','#0C447C','#633806','#888'
];

export default function GestionNiveaux({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux, setNiveaux]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [confirmModal, setConfirmModal] = useState({isOpen:false});

  const emptyForm = { code:'', nom:'', type:'hizb', couleur:'#1D9E75', ordre:1 };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('niveaux')
      .select('*')
      .eq('ecole_id', user.ecole_id)
      .order('ordre');
    setNiveaux(data || []);
    setLoading(false);
  };

  const startEdit = (n) => {
    setEditing(n.id);
    setForm({ code: n.code, nom: n.nom, type: n.type, couleur: n.couleur, ordre: n.ordre });
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ ...emptyForm, ordre: (niveaux.length + 1) });
    setShowForm(false);
  };

  const save = async () => {
    if (!form.code.trim()) return toast.warning(lang==='ar'?'الرمز إلزامي':'Le code est obligatoire');
    if (!form.nom.trim())  return toast.warning(lang==='ar'?'الاسم إلزامي':'Le nom est obligatoire');
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      nom: form.nom.trim(),
      type: form.type,
      couleur: form.couleur,
      ordre: parseInt(form.ordre) || 1,
      ecole_id: user.ecole_id,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('niveaux').update(payload).eq('id', editing));
    } else {
      ({ error } = await supabase.from('niveaux').insert(payload));
    }
    setSaving(false);
    if (error) {
      if (error.code === '23505') toast.error(lang==='ar'?'هذا الرمز موجود بالفعل':'Ce code existe déjà');
      else toast.error(error.message || 'Erreur');
      return;
    }
    toast.success(editing
      ? (lang==='ar'?'✅ تم تحديث المستوى':'✅ Niveau modifié !')
      : (lang==='ar'?'✅ تم إضافة المستوى':'✅ Niveau ajouté !'));
    resetForm();
    loadData();
  };

  const toggleActif = async (n) => {
    await supabase.from('niveaux').update({ actif: !n.actif }).eq('id', n.id);
    loadData();
  };

  const supprimer = (n) => {
    setConfirmModal({
      isOpen: true,
      title: lang==='ar'?'حذف المستوى':'Supprimer le niveau',
      message: (lang==='ar'?'هل تريد حذف المستوى ':'Supprimer le niveau ') + n.nom + ' (' + n.code + ') ?',
      onConfirm: async () => {
        const { error } = await supabase.from('niveaux').delete().eq('id', n.id);
        if (error) toast.error(lang==='ar'?'لا يمكن الحذف — هناك طلاب مرتبطون':'Impossible — des élèves utilisent ce niveau');
        else { toast.success(lang==='ar'?'تم الحذف':'Niveau supprimé'); loadData(); }
        setConfirmModal({isOpen:false});
      }
    });
  };

  const moveUp = async (n, idx) => {
    if (idx === 0) return;
    const prev = niveaux[idx - 1];
    await supabase.from('niveaux').update({ ordre: n.ordre }).eq('id', prev.id);
    await supabase.from('niveaux').update({ ordre: prev.ordre }).eq('id', n.id);
    loadData();
  };

  const moveDown = async (n, idx) => {
    if (idx === niveaux.length - 1) return;
    const next = niveaux[idx + 1];
    await supabase.from('niveaux').update({ ordre: n.ordre }).eq('id', next.id);
    await supabase.from('niveaux').update({ ordre: next.ordre }).eq('id', n.id);
    loadData();
  };

  // ── MOBILE ──────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        {/* Header */}
        <div style={{background:'#fff', padding:'14px 16px 0', borderBottom:'0.5px solid #e0e0d8', position:'sticky', top:0, zIndex:100}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#085041',padding:0}}>←</button>
            <div style={{flex:1, fontSize:17, fontWeight:800, color:'#085041'}}>
              📚 {lang==='ar'?'المستويات':'Niveaux'}
            </div>
            <button onClick={()=>{setEditing(null);setForm({...emptyForm,ordre:niveaux.length+1});setShowForm(v=>!v);}}
              style={{background:showForm&&!editing?'#f0f0ec':'#1D9E75',color:showForm&&!editing?'#666':'#fff',
                border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              {showForm&&!editing?'✕':'+ Ajouter'}
            </button>
          </div>
        </div>

        <div style={{padding:'12px'}}>
          {/* Formulaire */}
          {showForm && (
            <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
              border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`}}>
              <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                {editing?(lang==='ar'?'تعديل المستوى':'✏️ Modifier niveau'):(lang==='ar'?'إضافة مستوى':'📚 Nouveau niveau')}
              </div>

              {/* Code */}
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
                  {lang==='ar'?'رمز المستوى (مثال: N1, CM2)':'Code (ex: N1, CM2) *'}
                </label>
                <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box',textTransform:'uppercase'}}
                  value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))}
                  placeholder="N1"/>
              </div>

              {/* Nom */}
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
                  {lang==='ar'?'اسم المستوى':'Nom du niveau *'}
                </label>
                <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                  value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
                  placeholder={lang==='ar'?'مثال: مستوى مبتدئ':'Ex: Niveau débutant'}/>
              </div>

              {/* Type */}
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>
                  {lang==='ar'?'نوع الاستظهار':'Type de récitation *'}
                </label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {val:'hizb',    icon:'📿', fr:'Hizb / Tomon',  ar:'حزب / ثُمن'},
                    {val:'sourate', icon:'📖', fr:'Sourates',       ar:'سور'},
                  ].map(t=>(
                    <div key={t.val} onClick={()=>setForm(f=>({...f,type:t.val}))}
                      style={{padding:'12px',borderRadius:12,textAlign:'center',cursor:'pointer',
                        background:form.type===t.val?'#E1F5EE':'#f5f5f0',
                        border:`1.5px solid ${form.type===t.val?'#1D9E75':'#e0e0d8'}`,
                        color:form.type===t.val?'#085041':'#666'}}>
                      <div style={{fontSize:22,marginBottom:4}}>{t.icon}</div>
                      <div style={{fontSize:12,fontWeight:form.type===t.val?700:400}}>{lang==='ar'?t.ar:t.fr}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Couleur */}
              <div style={{marginBottom:14}}>
                <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>
                  {lang==='ar'?'اللون':'Couleur'}
                </label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                  {COULEURS_PRESET.map(col=>(
                    <div key={col} onClick={()=>setForm(f=>({...f,couleur:col}))}
                      style={{width:32,height:32,borderRadius:'50%',background:col,cursor:'pointer',
                        border:`3px solid ${form.couleur===col?'#1a1a1a':'transparent'}`,
                        flexShrink:0}}/>
                  ))}
                  <input type="color" value={form.couleur}
                    onChange={e=>setForm(f=>({...f,couleur:e.target.value}))}
                    style={{width:32,height:32,borderRadius:'50%',border:'none',cursor:'pointer',padding:0,background:'none'}}
                    title="Couleur personnalisée"/>
                </div>
                {/* Aperçu */}
                <div style={{marginTop:10,display:'inline-flex',alignItems:'center',gap:8,
                  padding:'6px 14px',borderRadius:20,background:`${form.couleur}20`,
                  border:`1.5px solid ${form.couleur}40`}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:form.couleur}}/>
                  <span style={{fontSize:13,fontWeight:700,color:form.couleur}}>
                    {form.code||'CODE'} — {form.nom||lang==='ar'?'اسم المستوى':'Nom du niveau'}
                  </span>
                </div>
              </div>

              {/* Boutons */}
              <div style={{display:'flex',gap:8}}>
                <button onClick={resetForm}
                  style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  {lang==='ar'?'إلغاء':'Annuler'}
                </button>
                <button onClick={save} disabled={saving}
                  style={{flex:2,padding:'13px',background:saving?'#ccc':editing?'#378ADD':'#1D9E75',
                    color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,
                    cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                  {saving?'...':(editing?(lang==='ar'?'تحديث':'Mettre à jour ✓'):(lang==='ar'?'حفظ':'Enregistrer'))}
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>}

          {/* Liste niveaux */}
          {!loading && niveaux.length === 0 && (
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12}}>
              <div style={{fontSize:40,marginBottom:10}}>📚</div>
              <div style={{fontSize:14,marginBottom:16}}>{lang==='ar'?'لا توجد مستويات بعد':'Aucun niveau configuré'}</div>
              <div style={{fontSize:12,color:'#bbb'}}>{lang==='ar'?'أضف مستوى للبدء':'Ajoutez votre premier niveau pour commencer'}</div>
            </div>
          )}

          {!loading && niveaux.map((n, idx) => (
            <div key={n.id} style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:10,
              border:`0.5px solid ${n.actif?n.couleur+'30':'#e0e0d8'}`,
              opacity: n.actif ? 1 : 0.6}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {/* Badge niveau */}
                <div style={{width:48,height:48,borderRadius:12,background:`${n.couleur}20`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  border:`1.5px solid ${n.couleur}40`,flexShrink:0}}>
                  <span style={{fontSize:14,fontWeight:800,color:n.couleur}}>{n.code}</span>
                </div>
                {/* Infos */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:'#1a1a1a'}}>{n.nom}</div>
                  <div style={{display:'flex',gap:6,marginTop:4,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:n.type==='sourate'?'#EEEDFE':'#E6F1FB',
                      color:n.type==='sourate'?'#534AB7':'#0C447C',fontWeight:600}}>
                      {n.type==='sourate'?'📖 Sourates':'📿 Hizb'}
                    </span>
                    <span style={{fontSize:11,color:'#aaa'}}>Ordre {n.ordre}</span>
                    {!n.actif && <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#f0f0ec',color:'#888'}}>
                      {lang==='ar'?'غير نشط':'Inactif'}
                    </span>}
                  </div>
                </div>
                {/* Actions réorder */}
                <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>
                  <button onClick={()=>moveUp(n,idx)} disabled={idx===0}
                    style={{background:'#f5f5f0',border:'none',borderRadius:6,padding:'4px 8px',
                      cursor:idx===0?'not-allowed':'pointer',opacity:idx===0?0.3:1,fontSize:12}}>▲</button>
                  <button onClick={()=>moveDown(n,idx)} disabled={idx===niveaux.length-1}
                    style={{background:'#f5f5f0',border:'none',borderRadius:6,padding:'4px 8px',
                      cursor:idx===niveaux.length-1?'not-allowed':'pointer',
                      opacity:idx===niveaux.length-1?0.3:1,fontSize:12}}>▼</button>
                </div>
              </div>
              {/* Boutons actions */}
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={()=>startEdit(n)}
                  style={{flex:1,padding:'9px',background:'#E6F1FB',color:'#0C447C',border:'none',
                    borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  ✏️ {lang==='ar'?'تعديل':'Modifier'}
                </button>
                <button onClick={()=>toggleActif(n)}
                  style={{flex:1,padding:'9px',background:n.actif?'#FAEEDA':'#E1F5EE',
                    color:n.actif?'#633806':'#085041',border:'none',
                    borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  {n.actif?(lang==='ar'?'تعطيل':'Désactiver'):(lang==='ar'?'تفعيل':'Activer')}
                </button>
                <button onClick={()=>supprimer(n)}
                  style={{padding:'9px 14px',background:'#FCEBEB',color:'#E24B4A',border:'none',
                    borderRadius:10,fontSize:13,cursor:'pointer'}}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        {/* Confirm Modal */}
        {confirmModal.isOpen && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,
            display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:320,width:'100%'}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
              <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setConfirmModal({isOpen:false})}
                  style={{flex:1,padding:'12px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                  {lang==='ar'?'إلغاء':'Annuler'}
                </button>
                <button onClick={confirmModal.onConfirm}
                  style={{flex:1,padding:'12px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  {lang==='ar'?'حذف':'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PC ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>← {lang==='ar'?'رجوع':'Retour'}</button>
          <div style={{fontSize:20,fontWeight:700}}>📚 {lang==='ar'?'إدارة المستويات':'Gestion des niveaux'}</div>
        </div>
        <button onClick={()=>{setEditing(null);setForm({...emptyForm,ordre:niveaux.length+1});setShowForm(v=>!v);}}
          style={{padding:'8px 18px',background:showForm&&!editing?'#f0f0ec':'#1D9E75',color:showForm&&!editing?'#666':'#fff',
            border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
          {showForm&&!editing?'✕ Annuler':'+ Nouveau niveau'}
        </button>
      </div>

      {/* Formulaire PC */}
      {showForm && (
        <div style={{background:'#fff',border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`,borderRadius:14,padding:'1.5rem',marginBottom:'1.5rem'}}>
          <div style={{fontSize:15,fontWeight:600,color:'#085041',marginBottom:'1rem'}}>
            {editing?'✏️ Modifier le niveau':'📚 Nouveau niveau'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>Code *</label>
              <input className="field-input" value={form.code}
                onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="N1"/>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>Nom *</label>
              <input className="field-input" value={form.nom}
                onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Niveau débutant"/>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>Ordre</label>
              <input className="field-input" type="number" min="1" value={form.ordre}
                onChange={e=>setForm(f=>({...f,ordre:e.target.value}))}/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>Type de récitation *</label>
              <div style={{display:'flex',gap:8}}>
                {[{val:'hizb',icon:'📿',fr:'Hizb / Tomon'},{val:'sourate',icon:'📖',fr:'Sourates'}].map(t=>(
                  <div key={t.val} onClick={()=>setForm(f=>({...f,type:t.val}))}
                    style={{flex:1,padding:'10px',borderRadius:10,textAlign:'center',cursor:'pointer',
                      background:form.type===t.val?'#E1F5EE':'#f5f5f0',
                      border:`1.5px solid ${form.type===t.val?'#1D9E75':'#e0e0d8'}`,
                      color:form.type===t.val?'#085041':'#666'}}>
                    <div style={{fontSize:18}}>{t.icon}</div>
                    <div style={{fontSize:12,fontWeight:form.type===t.val?600:400,marginTop:4}}>{t.fr}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>Couleur</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                {COULEURS_PRESET.map(col=>(
                  <div key={col} onClick={()=>setForm(f=>({...f,couleur:col}))}
                    style={{width:28,height:28,borderRadius:'50%',background:col,cursor:'pointer',
                      border:`3px solid ${form.couleur===col?'#1a1a1a':'transparent'}`,flexShrink:0}}/>
                ))}
                <input type="color" value={form.couleur}
                  onChange={e=>setForm(f=>({...f,couleur:e.target.value}))}
                  style={{width:28,height:28,borderRadius:'50%',border:'none',cursor:'pointer',padding:0}}/>
                <span style={{padding:'4px 12px',borderRadius:20,background:`${form.couleur}20`,
                  color:form.couleur,fontWeight:700,fontSize:12,border:`1px solid ${form.couleur}40`}}>
                  {form.code||'CODE'}
                </span>
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={resetForm}
              style={{padding:'10px 20px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:600}}>
              Annuler
            </button>
            <button onClick={save} disabled={saving}
              style={{padding:'10px 24px',background:saving?'#ccc':editing?'#378ADD':'#1D9E75',
                color:'#fff',border:'none',borderRadius:10,cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:700}}>
              {saving?'...':(editing?'Mettre à jour ✓':'Enregistrer')}
            </button>
          </div>
        </div>
      )}

      {/* Table PC */}
      {loading ? <div className="loading">...</div> : niveaux.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'#aaa',background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:48,marginBottom:12}}>📚</div>
          <div style={{fontSize:15,marginBottom:8}}>Aucun niveau configuré</div>
          <div style={{fontSize:13}}>Ajoutez votre premier niveau pour commencer</div>
        </div>
      ) : (
        <div style={{background:'#fff',borderRadius:14,border:'0.5px solid #e0e0d8',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f5f5f0',borderBottom:'0.5px solid #e0e0d8'}}>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Ordre</th>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Code</th>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Nom</th>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Type</th>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Statut</th>
                <th style={{padding:'12px 16px',textAlign:'right',fontSize:12,fontWeight:600,color:'#888'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {niveaux.map((n, idx) => (
                <tr key={n.id} style={{borderBottom:'0.5px solid #f0f0ec',opacity:n.actif?1:0.5}}>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',flexDirection:'column',gap:2}}>
                      <button onClick={()=>moveUp(n,idx)} disabled={idx===0}
                        style={{background:'none',border:'none',cursor:idx===0?'not-allowed':'pointer',opacity:idx===0?0.3:1,fontSize:11,padding:'1px 4px'}}>▲</button>
                      <span style={{textAlign:'center',fontSize:13,fontWeight:500,color:'#888'}}>{n.ordre}</span>
                      <button onClick={()=>moveDown(n,idx)} disabled={idx===niveaux.length-1}
                        style={{background:'none',border:'none',cursor:idx===niveaux.length-1?'not-allowed':'pointer',opacity:idx===niveaux.length-1?0.3:1,fontSize:11,padding:'1px 4px'}}>▼</button>
                    </div>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{padding:'4px 12px',borderRadius:20,background:`${n.couleur}20`,
                      color:n.couleur,fontWeight:700,fontSize:13,border:`1px solid ${n.couleur}40`}}>
                      {n.code}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:14,fontWeight:500}}>{n.nom}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{fontSize:12,padding:'3px 10px',borderRadius:20,
                      background:n.type==='sourate'?'#EEEDFE':'#E6F1FB',
                      color:n.type==='sourate'?'#534AB7':'#0C447C',fontWeight:600}}>
                      {n.type==='sourate'?'📖 Sourates':'📿 Hizb'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{fontSize:12,padding:'3px 10px',borderRadius:20,
                      background:n.actif?'#E1F5EE':'#f0f0ec',
                      color:n.actif?'#085041':'#888',fontWeight:600}}>
                      {n.actif?'✓ Actif':'Inactif'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',textAlign:'right'}}>
                    <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                      <button onClick={()=>startEdit(n)}
                        style={{padding:'6px 12px',background:'#E6F1FB',color:'#0C447C',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>✏️</button>
                      <button onClick={()=>toggleActif(n)}
                        style={{padding:'6px 12px',background:n.actif?'#FAEEDA':'#E1F5EE',
                          color:n.actif?'#633806':'#085041',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                        {n.actif?'Désactiver':'Activer'}
                      </button>
                      <button onClick={()=>supprimer(n)}
                        style={{padding:'6px 10px',background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Modal PC */}
      {confirmModal.isOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:400,width:'100%'}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
            <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmModal({isOpen:false})}
                style={{padding:'10px 20px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>Annuler</button>
              <button onClick={confirmModal.onConfirm}
                style={{padding:'10px 20px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
