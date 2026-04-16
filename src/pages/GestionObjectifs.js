import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import ConfirmModal from '../components/ConfirmModal';
import { t } from '../lib/i18n';

const PERIODES = [
  { val:'semaine',   label_fr:'Semaine',              label_ar:'أسبوع',           jours:7   },
  { val:'mois',      label_fr:'Mois',                 label_ar:'شهر',             jours:30  },
  { val:'trimestre', label_fr:'Trimestre',            label_ar:'فصل دراسي',       jours:90  },
  { val:'semestre',  label_fr:'Semestre',             label_ar:'نصف سنة',         jours:180 },
  { val:'annee',     label_fr:'Année',                label_ar:'سنة',             jours:365 },
  { val:'custom',    label_fr:'Dates personnalisées', label_ar:'تواريخ مخصصة',    jours:0   },
];
const METRIQUES_HIZB = [
  { val:'tomon', label_fr:'Tomon récités',   label_ar:'أثمان مُسمَّعة', unite_fr:'tomon',      unite_ar:'ثمن'     },
  { val:'hizb',  label_fr:'Hizb complets',   label_ar:'أحزاب مكتملة',  unite_fr:'hizb',       unite_ar:'حزب'     },
];
const METRIQUES_SOURATE = [
  { val:'sourate',  label_fr:'Sourates complètes',  label_ar:'سور مكتملة',     unite_fr:'sourate(s)',  unite_ar:'سورة'    },
  { val:'ensemble', label_fr:'Ensembles complétés', label_ar:'مجموعات مكتملة', unite_fr:'ensemble(s)', unite_ar:'مجموعة'  },
];
const getMetriques = (type) => type === 'sourate' ? METRIQUES_SOURATE : METRIQUES_HIZB;

const calcDates = (type_periode) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const fmt = d => d.toISOString().split('T')[0];
  const add = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
  const jours = PERIODES.find(p=>p.val===type_periode)?.jours||30;
  return { date_debut: fmt(today), date_fin: fmt(add(today, jours-1)) };
};

const emptyForm = {
  type_cible:'niveau', niveau_id:'', eleve_id:'',
  metrique:'tomon', valeur_cible:4,
  type_periode:'mois', date_debut:'', date_fin:'',
  notes:'', actif:true,
};

// ── FORMULAIRE PC — 2 lignes, pleine largeur ───────────────────
function FormPC({ form, setForm, setFormField, niveaux, eleves, metriques,
  searchEleve, setSearchEleve, onChangePeriode, onChangeNiveau, save, saving,
  editing, setShowForm, setEditing, lang }) {

  const elevesFiltr = eleves.filter(e =>
    `${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase()
      .includes(searchEleve.toLowerCase())
  );

  return (
    <div>
      {/* LIGNE 1 : Type | Cible | Métrique | Valeur */}
      <div style={{display:'grid', gridTemplateColumns:'160px 1fr 200px 160px', gap:16, marginBottom:16, alignItems:'start'}}>

        {/* Type */}
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'#888',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
            {lang==='ar'?'نوع الهدف':'Type d\'objectif'}
          </label>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[{val:'niveau',icon:'🏫',fr:'Par niveau',ar:'بالمستوى'},{val:'eleve',icon:'👤',fr:'Par élève',ar:'بالطالب'}].map(t=>(
              <div key={t.val} onClick={()=>setFormField('type_cible',t.val)}
                style={{padding:'8px 12px',borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',gap:8,
                  background:form.type_cible===t.val?'#E1F5EE':'#f5f5f0',
                  border:`1.5px solid ${form.type_cible===t.val?'#1D9E75':'#e0e0d8'}`}}>
                <span style={{fontSize:14}}>{t.icon}</span>
                <span style={{fontSize:12,fontWeight:600,color:form.type_cible===t.val?'#085041':'#555'}}>
                  {lang==='ar'?t.ar:t.fr}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Niveau ou Élève */}
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'#888',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
            {form.type_cible==='niveau'?(lang==='ar'?'المستوى *':'Niveau *'):(lang==='ar'?'الطالب *':'Élève *')}
          </label>
          {form.type_cible==='niveau' ? (
            <select value={form.niveau_id} onChange={e=>onChangeNiveau(e.target.value)}
              style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:13,fontFamily:'inherit',background:'#fff',outline:'none',boxSizing:'border-box'}}>
              <option value="">— {lang==='ar'?'اختر':'Choisir'} —</option>
              {niveaux.map(n=><option key={n.id} value={n.id}>{n.code} — {n.nom}</option>)}
            </select>
          ) : !form.eleve_id ? (
            <>
              <input value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}
                placeholder={lang==='ar'?'🔍 بحث...':'🔍 Rechercher...'}
                style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
                  fontSize:13,fontFamily:'inherit',boxSizing:'border-box',marginBottom:6,outline:'none'}}/>
              <div style={{maxHeight:140,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
                {elevesFiltr.slice(0,10).map(e=>{
                  const niv=niveaux.find(n=>n.code===e.code_niveau);
                  return(
                    <div key={e.id} onClick={()=>{
                      const metr=getMetriques(niv?.type||'hizb')[0]?.val||'tomon';
                      setForm(f=>({...f,eleve_id:e.id,metrique:metr}));
                      setSearchEleve('');
                    }}
                      style={{padding:'6px 10px',borderRadius:8,cursor:'pointer',background:'#f5f5f0',
                        border:'0.5px solid #e0e0d8',display:'flex',gap:8,alignItems:'center',fontSize:12}}>
                      <span style={{padding:'1px 6px',borderRadius:20,fontSize:10,
                        background:`${niv?.couleur||'#888'}20`,color:niv?.couleur||'#888',fontWeight:700}}>
                        {e.code_niveau}
                      </span>
                      {e.eleve_id_ecole&&<span style={{color:'#aaa',fontSize:11}}>#{e.eleve_id_ecole}</span>}
                      <span style={{fontWeight:500}}>{e.prenom} {e.nom}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',
              borderRadius:10,background:'#E1F5EE',border:'1.5px solid #1D9E75'}}>
              <span style={{flex:1,fontWeight:600,fontSize:13}}>
                {(()=>{const e=eleves.find(x=>x.id===form.eleve_id);return e?`${e.prenom} ${e.nom}`:'?';})()}
              </span>
              <button onClick={()=>setFormField('eleve_id','')}
                style={{background:'none',border:'none',color:'#E24B4A',cursor:'pointer',fontSize:14}}>✕</button>
            </div>
          )}
        </div>

        {/* Métrique */}
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'#888',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
            {lang==='ar'?'المقياس':'Métrique'}
          </label>
          <select value={form.metrique} onChange={e=>setFormField('metrique',e.target.value)}
            style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
              fontSize:13,fontFamily:'inherit',background:'#fff',outline:'none',boxSizing:'border-box'}}>
            {metriques.map(m=>(
              <option key={m.val} value={m.val}>{lang==='ar'?m.label_ar:m.label_fr}</option>
            ))}
          </select>
        </div>

        {/* Valeur */}
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'#888',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
            {lang==='ar'?'الهدف (عدد)':'Objectif (nombre)'}
          </label>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <button onClick={()=>setFormField('valeur_cible',Math.max(1,parseInt(form.valeur_cible||1)-1))}
              style={{width:34,height:40,borderRadius:8,border:'0.5px solid #e0e0d8',
                background:'#f5f5f0',fontSize:18,cursor:'pointer',fontWeight:700,lineHeight:1}}>−</button>
            <input type="number" min="1" max="999" value={form.valeur_cible}
              onChange={e=>setFormField('valeur_cible',parseInt(e.target.value)||1)}
              style={{width:60,padding:'8px 6px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:18,fontWeight:800,textAlign:'center',fontFamily:'inherit',outline:'none'}}/>
            <button onClick={()=>setFormField('valeur_cible',parseInt(form.valeur_cible||1)+1)}
              style={{width:34,height:40,borderRadius:8,border:'0.5px solid #e0e0d8',
                background:'#f5f5f0',fontSize:18,cursor:'pointer',fontWeight:700,lineHeight:1}}>+</button>
          </div>
        </div>
      </div>

      {/* LIGNE 2 : Période | Dates | Notes | Actif | Boutons */}
      <div style={{display:'grid', gridTemplateColumns:'auto 240px 1fr auto auto', gap:16, alignItems:'start',
        paddingTop:14, borderTop:'0.5px solid #f0f0ec'}}>

        {/* Périodes */}
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'#888',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
            {lang==='ar'?'الفترة':'Période'}
          </label>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {PERIODES.map(p=>(
              <div key={p.val} onClick={()=>onChangePeriode(p.val)}
                style={{padding:'4px 10px',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,
                  background:form.type_periode===p.val?'#1D9E75':'#f5f5f0',
                  color:form.type_periode===p.val?'#fff':'#666',
                  border:`0.5px solid ${form.type_periode===p.val?'#1D9E75':'#e0e0d8'}`}}>
                {lang==='ar'?p.label_ar:p.label_fr}
              </div>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'#888',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
            {lang==='ar'?'التواريخ':'Dates'}
          </label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div>
              <div style={{fontSize:10,color:'#aaa',marginBottom:3}}>{lang==='ar'?'من':'Du'}</div>
              <input type="date" value={form.date_debut} onChange={e=>setFormField('date_debut',e.target.value)}
                style={{width:'100%',padding:'7px 8px',borderRadius:8,border:'0.5px solid #e0e0d8',
                  fontSize:12,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:'#aaa',marginBottom:3}}>{lang==='ar'?'إلى':'Au'}</div>
              <input type="date" value={form.date_fin} onChange={e=>setFormField('date_fin',e.target.value)}
                style={{width:'100%',padding:'7px 8px',borderRadius:8,border:'0.5px solid #e0e0d8',
                  fontSize:12,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={{fontSize:11,fontWeight:700,color:'#888',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>
            {lang==='ar'?'ملاحظات':'Notes'} <span style={{fontWeight:400,textTransform:'none'}}>(opt.)</span>
          </label>
          <input value={form.notes} onChange={e=>setFormField('notes',e.target.value)}
            placeholder={lang==='ar'?'ملاحظة...':'Remarque...'}
            style={{width:'100%',padding:'9px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
              fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
        </div>

        {/* Actif */}
        <div style={{paddingTop:24}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div onClick={()=>setFormField('actif',!form.actif)}
              style={{width:40,height:22,borderRadius:11,cursor:'pointer',position:'relative',
                background:form.actif?'#1D9E75':'#ccc',transition:'background 0.2s',flexShrink:0}}>
              <div style={{position:'absolute',top:2,left:form.actif?20:2,width:18,height:18,
                borderRadius:'50%',background:'#fff',transition:'left 0.2s',
                boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
            </div>
            <span style={{fontSize:12,fontWeight:600,color:'#555',whiteSpace:'nowrap'}}>
              {lang==='ar'?'نشط':'Actif'}
            </span>
          </div>
        </div>

        {/* Boutons */}
        <div style={{paddingTop:22,display:'flex',gap:8}}>
          <button onClick={save} disabled={saving}
            style={{padding:'9px 22px',border:'none',borderRadius:10,
              background:saving?'#ccc':'#1D9E75',color:'#fff',fontSize:13,
              fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
            {saving?'...':(editing?(lang==='ar'?'تحديث':'Modifier'):(lang==='ar'?'+ إضافة':'+ Ajouter'))}
          </button>
          <button onClick={()=>{setShowForm(false);setEditing(null);}}
            style={{padding:'9px 14px',border:'0.5px solid #e0e0d8',borderRadius:10,
              background:'#fff',color:'#666',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FORMULAIRE MOBILE ──────────────────────────────────────────
function FormMobile({ form, setForm, setFormField, niveaux, eleves, metriques,
  searchEleve, setSearchEleve, onChangePeriode, onChangeNiveau, save, saving,
  editing, setShowForm, setEditing, lang }) {

  const elevesFiltr = eleves.filter(e =>
    `${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase()
      .includes(searchEleve.toLowerCase())
  );

  return (
    <div>
      {/* Type cible */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:8}}>
          {lang==='ar'?'نوع الهدف':'Type d\'objectif'}
        </label>
        <div style={{display:'flex',gap:8}}>
          {[{val:'niveau',icon:'🏫',fr:'Par niveau',ar:'بالمستوى'},{val:'eleve',icon:'👤',fr:'Par élève',ar:'بالطالب'}].map(t=>(
            <div key={t.val} onClick={()=>setFormField('type_cible',t.val)}
              style={{flex:1,padding:'10px',borderRadius:10,cursor:'pointer',textAlign:'center',
                background:form.type_cible===t.val?'#E1F5EE':'#f5f5f0',
                border:`1.5px solid ${form.type_cible===t.val?'#1D9E75':'#e0e0d8'}`}}>
              <div style={{fontSize:20}}>{t.icon}</div>
              <div style={{fontSize:12,fontWeight:600,color:form.type_cible===t.val?'#085041':'#555',marginTop:4}}>
                {lang==='ar'?t.ar:t.fr}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Niveau ou Élève */}
      {form.type_cible==='niveau' ? (
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
            {lang==='ar'?'المستوى *':'Niveau *'}
          </label>
          <select value={form.niveau_id} onChange={e=>onChangeNiveau(e.target.value)}
            style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
              fontSize:14,fontFamily:'inherit',background:'#fff',outline:'none',boxSizing:'border-box'}}>
            <option value="">— {lang==='ar'?'اختر':'Choisir'} —</option>
            {niveaux.map(n=><option key={n.id} value={n.id}>{n.code} — {n.nom}</option>)}
          </select>
        </div>
      ):(
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
            {lang==='ar'?'الطالب *':'Élève *'}
          </label>
          {!form.eleve_id ? (
            <>
              <input value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}
                placeholder={lang==='ar'?'🔍 بحث...':'🔍 Rechercher...'}
                style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
                  fontSize:14,fontFamily:'inherit',boxSizing:'border-box',marginBottom:6,outline:'none'}}/>
              <div style={{maxHeight:160,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                {elevesFiltr.slice(0,15).map(e=>{
                  const niv=niveaux.find(n=>n.code===e.code_niveau);
                  return(
                    <div key={e.id} onClick={()=>{
                      const metr=getMetriques(niv?.type||'hizb')[0]?.val||'tomon';
                      setForm(f=>({...f,eleve_id:e.id,metrique:metr}));
                      setSearchEleve('');
                    }}
                      style={{padding:'8px 12px',borderRadius:8,cursor:'pointer',background:'#f5f5f0',
                        border:'0.5px solid #e0e0d8',display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{fontSize:11,padding:'1px 7px',borderRadius:20,
                        background:`${niv?.couleur||'#888'}20`,color:niv?.couleur||'#888',fontWeight:700}}>
                        {e.code_niveau}
                      </span>
                      {e.eleve_id_ecole&&<span style={{fontSize:11,color:'#aaa'}}>#{e.eleve_id_ecole}</span>}
                      <span style={{fontSize:13,fontWeight:500}}>{e.prenom} {e.nom}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ):(
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
              borderRadius:10,background:'#E1F5EE',border:'1.5px solid #1D9E75'}}>
              <span style={{flex:1,fontWeight:700,fontSize:14}}>
                {(()=>{const e=eleves.find(x=>x.id===form.eleve_id);return e?`${e.prenom} ${e.nom}`:'?';})()}
              </span>
              <button onClick={()=>setFormField('eleve_id','')}
                style={{background:'none',border:'none',color:'#E24B4A',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* Métrique + Valeur */}
      <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginBottom:14}}>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
            {lang==='ar'?'المقياس':'Métrique'}
          </label>
          <select value={form.metrique} onChange={e=>setFormField('metrique',e.target.value)}
            style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
              fontSize:14,fontFamily:'inherit',background:'#fff',outline:'none',boxSizing:'border-box'}}>
            {metriques.map(m=>(
              <option key={m.val} value={m.val}>{lang==='ar'?m.label_ar:m.label_fr}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
            {lang==='ar'?'الهدف':'Objectif'}
          </label>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <button onClick={()=>setFormField('valeur_cible',Math.max(1,parseInt(form.valeur_cible||1)-1))}
              style={{width:36,height:42,borderRadius:8,border:'0.5px solid #e0e0d8',
                background:'#f5f5f0',fontSize:18,cursor:'pointer',fontWeight:700}}>−</button>
            <input type="number" min="1" max="999" value={form.valeur_cible}
              onChange={e=>setFormField('valeur_cible',parseInt(e.target.value)||1)}
              style={{width:64,padding:'10px 8px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:16,fontWeight:800,textAlign:'center',fontFamily:'inherit',outline:'none'}}/>
            <button onClick={()=>setFormField('valeur_cible',parseInt(form.valeur_cible||1)+1)}
              style={{width:36,height:42,borderRadius:8,border:'0.5px solid #e0e0d8',
                background:'#f5f5f0',fontSize:18,cursor:'pointer',fontWeight:700}}>+</button>
          </div>
        </div>
      </div>

      {/* Période */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:8}}>
          {lang==='ar'?'الفترة':'Période'}
        </label>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
          {PERIODES.map(p=>(
            <div key={p.val} onClick={()=>onChangePeriode(p.val)}
              style={{padding:'5px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,
                background:form.type_periode===p.val?'#1D9E75':'#f5f5f0',
                color:form.type_periode===p.val?'#fff':'#666',
                border:`0.5px solid ${form.type_periode===p.val?'#1D9E75':'#e0e0d8'}`}}>
              {lang==='ar'?p.label_ar:p.label_fr}
            </div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div>
            <label style={{fontSize:11,color:'#888',display:'block',marginBottom:4}}>{lang==='ar'?'من':'Du'}</label>
            <input type="date" value={form.date_debut} onChange={e=>setFormField('date_debut',e.target.value)}
              style={{width:'100%',padding:'9px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div>
            <label style={{fontSize:11,color:'#888',display:'block',marginBottom:4}}>{lang==='ar'?'إلى':'Au'}</label>
            <input type="date" value={form.date_fin} onChange={e=>setFormField('date_fin',e.target.value)}
              style={{width:'100%',padding:'9px 10px',borderRadius:10,border:'0.5px solid #e0e0d8',
                fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}/>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,fontWeight:700,color:'#666',display:'block',marginBottom:6}}>
          {lang==='ar'?'ملاحظات (اختياري)':'Notes (optionnel)'}
        </label>
        <textarea value={form.notes} onChange={e=>setFormField('notes',e.target.value)} rows={2}
          placeholder={lang==='ar'?'ملاحظة حول هذا الهدف...':'Remarque sur cet objectif...'}
          style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',
            fontSize:13,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box',outline:'none'}}/>
      </div>

      {/* Actif */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
        marginBottom:16,padding:'10px 14px',background:'#f9f9f6',borderRadius:10}}>
        <span style={{fontSize:13,fontWeight:600,color:'#555'}}>{lang==='ar'?'هدف نشط':'Objectif actif'}</span>
        <div onClick={()=>setFormField('actif',!form.actif)}
          style={{width:44,height:24,borderRadius:12,cursor:'pointer',position:'relative',
            background:form.actif?'#1D9E75':'#ccc',transition:'background 0.2s'}}>
          <div style={{position:'absolute',top:2,left:form.actif?22:2,width:20,height:20,
            borderRadius:'50%',background:'#fff',transition:'left 0.2s',
            boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
        </div>
      </div>

      {/* Boutons */}
      <div style={{display:'flex',gap:10}}>
        <button onClick={save} disabled={saving}
          style={{flex:1,padding:'13px',border:'none',borderRadius:12,
            background:saving?'#ccc':'#1D9E75',color:'#fff',fontSize:14,
            fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
          {saving?'...':(editing?(lang==='ar'?'تحديث':'Modifier'):(lang==='ar'?'إضافة الهدف':'Ajouter l\'objectif'))}
        </button>
        <button onClick={()=>{setShowForm(false);setEditing(null);}}
          style={{padding:'13px 20px',border:'0.5px solid #e0e0d8',borderRadius:12,
            background:'#fff',color:'#666',fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
          {lang==='ar'?'إلغاء':'Annuler'}
        </button>
      </div>
    </div>
  );
}

// ── COMPOSANT PRINCIPAL ────────────────────────────────────────
export default function GestionObjectifs({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux,   setNiveaux]   = useState([]);
  const [eleves,    setEleves]    = useState([]);
  const [objectifs, setObjectifs] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(emptyForm);
  const [filtreType,setFiltreType]= useState('tous');
  const [searchEleve,setSearchEleve]=useState('');
  const [confirmModal,setConfirmModal]=useState({isOpen:false});

  useEffect(()=>{ loadAll(); },[]);

  const loadAll = async () => {
    setLoading(true);
    const [{data:nv},{data:el},{data:ob}] = await Promise.all([
      supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole').eq('ecole_id',user.ecole_id).order('nom'),
      supabase.from('objectifs').select('*').eq('ecole_id',user.ecole_id).order('created_at',{ascending:false}),
    ]);
    setNiveaux(nv||[]);
    setEleves(el||[]);
    setObjectifs(ob||[]);
    setLoading(false);
  };

  const niveauDuForm  = niveaux.find(n=>n.id===form.niveau_id);
  const eleveDuForm   = eleves.find(e=>e.id===form.eleve_id);
  const niveauEleve   = eleveDuForm ? niveaux.find(n=>n.code===eleveDuForm.code_niveau) : null;
  const typeActif     = form.type_cible==='eleve' ? (niveauEleve?.type||'hizb') : (niveauDuForm?.type||'hizb');
  const metriques     = getMetriques(typeActif);

  const setFormField = (key,val) => setForm(f=>({...f,[key]:val}));

  const onChangePeriode = (val) => {
    if (val==='custom') { setForm(f=>({...f,type_periode:'custom',date_debut:'',date_fin:''})); }
    else { const {date_debut,date_fin}=calcDates(val); setForm(f=>({...f,type_periode:val,date_debut,date_fin})); }
  };
  const onChangeNiveau = (nid) => {
    const niv=niveaux.find(n=>n.id===nid);
    const metr=getMetriques(niv?.type||'hizb')[0]?.val||'tomon';
    setForm(f=>({...f,niveau_id:nid,metrique:metr}));
  };

  const startCreate = () => {
    setEditing(null);
    const dates=calcDates('mois');
    setForm({...emptyForm,...dates,
      niveau_id:niveaux[0]?.id||'',
      metrique:getMetriques(niveaux[0]?.type||'hizb')[0]?.val||'tomon',
    });
    setShowForm(true);
    if (!isMobile) window.scrollTo(0,0);
  };

  const startEdit = (obj) => {
    setEditing(obj.id);
    setForm({
      type_cible:obj.type_cible, niveau_id:obj.niveau_id||'', eleve_id:obj.eleve_id||'',
      metrique:obj.metrique, valeur_cible:obj.valeur_cible, type_periode:obj.type_periode,
      date_debut:obj.date_debut, date_fin:obj.date_fin, notes:obj.notes||'', actif:obj.actif,
    });
    setShowForm(true);
    window.scrollTo(0,0);
  };

  const save = async () => {
    if (saving) return;
    if (form.type_cible==='niveau'&&!form.niveau_id) return toast.warning(lang==='ar'?'اختر المستوى':'Sélectionnez un niveau');
    if (form.type_cible==='eleve'&&!form.eleve_id)   return toast.warning(lang==='ar'?'اختر الطالب':'Sélectionnez un élève');
    if (!form.date_debut||!form.date_fin)             return toast.warning(lang==='ar'?'حدد الفترة':'Définissez la période');
    if (parseInt(form.valeur_cible)<1)                return toast.warning('Objectif > 0');
    setSaving(true);
    const payload = {
      ecole_id:user.ecole_id, type_cible:form.type_cible,
      niveau_id:form.type_cible==='niveau'?form.niveau_id:null,
      eleve_id:form.type_cible==='eleve'?form.eleve_id:null,
      metrique:form.metrique, valeur_cible:parseInt(form.valeur_cible)||1,
      type_periode:form.type_periode, date_debut:form.date_debut, date_fin:form.date_fin,
      notes:form.notes.trim()||null, actif:form.actif, created_by:user.id,
    };
    const {error} = editing
      ? await supabase.from('objectifs').update(payload).eq('id',editing)
      : await supabase.from('objectifs').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing?(lang==='ar'?'✅ تم التحديث':'✅ Modifié !'):(lang==='ar'?'✅ تم الإضافة':'✅ Ajouté !'));
    setShowForm(false); setEditing(null); setForm(emptyForm); loadAll();
  };

  const supprimer = (id) => setConfirmModal({
    isOpen:true,
    title:lang==='ar'?'حذف الهدف':'Supprimer',
    message:lang==='ar'?'هل تريد حذف هذا الهدف؟':'Supprimer cet objectif ?',
    onConfirm:async()=>{ await supabase.from('objectifs').delete().eq('id',id); loadAll(); setConfirmModal({isOpen:false}); }
  });

  const nomNiveau   = (id)=>{const n=niveaux.find(x=>x.id===id);return n?`${n.code} — ${n.nom}`:'?';};
  const couleurNiv  = (id)=>niveaux.find(n=>n.id===id)?.couleur||'#888';
  const nomEleve    = (id)=>{const e=eleves.find(x=>x.id===id);return e?`${e.prenom} ${e.nom}`:'?';};
  const labelMetr   = (val)=>{const m=[...METRIQUES_HIZB,...METRIQUES_SOURATE].find(x=>x.val===val);return m?(lang==='ar'?m.label_ar:m.label_fr):val;};
  const labelPeriode= (val)=>{const p=PERIODES.find(x=>x.val===val);return p?(lang==='ar'?p.label_ar:p.label_fr):val;};
  const fmtDate     = (d)=>d?new Date(d).toLocaleDateString('fr-FR'):'';

  const objFiltres = objectifs.filter(o=>filtreType==='tous'||o.type_cible===filtreType);
  const stats = {
    total:objectifs.length, actifs:objectifs.filter(o=>o.actif).length,
    niveau:objectifs.filter(o=>o.type_cible==='niveau').length,
    eleve:objectifs.filter(o=>o.type_cible==='eleve').length,
  };

  const formProps = { form, setForm, setFormField, niveaux, eleves, metriques,
    searchEleve, setSearchEleve, onChangePeriode, onChangeNiveau, save, saving,
    editing, setShowForm, setEditing, lang };

  const CarteObjectif = ({obj}) => {
    const isNiveau=obj.type_cible==='niveau';
    const nc=isNiveau?couleurNiv(obj.niveau_id):'#378ADD';
    const today=new Date();
    const actif=today>=new Date(obj.date_debut)&&today<=new Date(obj.date_fin)&&obj.actif;
    const m=[...METRIQUES_HIZB,...METRIQUES_SOURATE].find(x=>x.val===obj.metrique);
    const unite=m?(lang==='ar'?m.unite_ar:m.unite_fr):'';
    return(
      <div style={{background:'#fff',borderRadius:14,padding:'14px 16px',
        border:`0.5px solid ${nc}30`,opacity:obj.actif?1:0.6,borderLeft:`4px solid ${nc}`}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,flexShrink:0,
            background:`${nc}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
            {isNiveau?'🏫':'👤'}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              <span style={{fontWeight:700,fontSize:14}}>{isNiveau?nomNiveau(obj.niveau_id):nomEleve(obj.eleve_id)}</span>
              {actif&&<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:'#E1F5EE',color:'#1D9E75',fontWeight:700}}>{lang==='ar'?'نشط':'Actif'}</span>}
              {!obj.actif&&<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:'#f5f5f0',color:'#aaa',fontWeight:700}}>{lang==='ar'?'غير نشط':'Inactif'}</span>}
            </div>
            <div style={{fontSize:13,color:'#1D9E75',fontWeight:700,marginBottom:4}}>
              🎯 {obj.valeur_cible} {unite} — {labelMetr(obj.metrique)}
            </div>
            <div style={{fontSize:11,color:'#888'}}>
              📅 {fmtDate(obj.date_debut)} → {fmtDate(obj.date_fin)} · {labelPeriode(obj.type_periode)}
            </div>
            {obj.notes&&<div style={{fontSize:11,color:'#aaa',marginTop:4,fontStyle:'italic'}}>💬 {obj.notes}</div>}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
            <button onClick={()=>startEdit(obj)}
              style={{padding:'5px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',
                background:'#fff',fontSize:12,cursor:'pointer'}}>✏️</button>
            <button onClick={()=>supprimer(obj.id)}
              style={{padding:'5px 12px',borderRadius:8,border:'0.5px solid #FCEBEB',
                background:'#FCEBEB',fontSize:12,cursor:'pointer',color:'#E24B4A'}}>🗑️</button>
          </div>
        </div>
      </div>
    );
  };

  const StatsBar = () => (
    <div style={{display:'grid',gridTemplateColumns:`repeat(${isMobile?2:4},1fr)`,gap:isMobile?8:10,marginBottom:isMobile?12:'1.25rem'}}>
      {[
        {l:lang==='ar'?'المجموع':'Total',      v:stats.total,  c:'#085041',bg:'#E1F5EE'},
        {l:lang==='ar'?'نشطة':'Actifs',        v:stats.actifs, c:'#1D9E75',bg:'#E1F5EE'},
        {l:lang==='ar'?'بالمستوى':'Par niveau', v:stats.niveau, c:'#378ADD',bg:'#E6F1FB'},
        {l:lang==='ar'?'بالطالب':'Par élève',   v:stats.eleve,  c:'#D85A30',bg:'#FAECE7'},
      ].map((s,i)=>(
        <div key={i} style={{background:s.bg,borderRadius:12,padding:isMobile?'12px':'14px',textAlign:'center'}}>
          <div style={{fontSize:isMobile?22:26,fontWeight:800,color:s.c}}>{s.v}</div>
          <div style={{fontSize:isMobile?11:12,color:s.c,opacity:0.8,marginTop:2}}>{s.l}</div>
        </div>
      ))}
    </div>
  );

  const Filtres = () => (
    <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
      {[{val:'tous',fr:'Tous',ar:'الكل'},{val:'niveau',fr:'Par niveau',ar:'بالمستوى'},{val:'eleve',fr:'Par élève',ar:'بالطالب'}].map(f=>(
        <div key={f.val} onClick={()=>setFiltreType(f.val)}
          style={{padding:isMobile?'5px 12px':'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:600,
            background:filtreType===f.val?'#085041':'#f5f5f0',color:filtreType===f.val?'#fff':'#666',
            border:`0.5px solid ${filtreType===f.val?'#085041':'#e0e0d8'}`}}>
          {lang==='ar'?f.ar:f.fr}
        </div>
      ))}
      <span style={{fontSize:12,color:'#888',alignSelf:'center'}}>{objFiltres.length} {lang==='ar'?'هدف':'objectif(s)'}</span>
    </div>
  );

  const Liste = () => (
    loading?<div style={{textAlign:'center',padding:'3rem',color:'#888'}}>...</div>
    :objFiltres.length===0?(
      <div style={{textAlign:'center',padding:'4rem',color:'#aaa',background:'#fff',
        borderRadius:12,border:'0.5px solid #e0e0d8'}}>
        <div style={{fontSize:48,marginBottom:12}}>🎯</div>
        <div>{lang==='ar'?'لا توجد أهداف محددة':'Aucun objectif défini'}</div>
      </div>
    ):(
      <div style={{display:'flex',flexDirection:'column',gap:isMobile?8:10}}>
        {objFiltres.map(obj=><CarteObjectif key={obj.id} obj={obj}/>)}
      </div>
    )
  );

  // ── MOBILE ────────────────────────────────────────────────────
  if (isMobile) return (
    <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
      <div style={{background:'#fff',padding:'14px 16px',borderBottom:'0.5px solid #e0e0d8',
        position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">{t(lang,'retour')}</button>
          <div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>🎯 {lang==='ar'?'الأهداف':'Objectifs'}</div>
          <button onClick={showForm?()=>{setShowForm(false);setEditing(null);}:startCreate}
            style={{background:showForm?'#f0f0ec':'#1D9E75',color:showForm?'#666':'#fff',
              border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            {showForm?'✕':(lang==='ar'?'+ إضافة':'+ Ajouter')}
          </button>
        </div>
      </div>
      <div style={{padding:'12px'}}>
        {showForm&&(
          <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
            border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`}}>
            <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
              {editing?(lang==='ar'?'تعديل الهدف':'✏️ Modifier'):(lang==='ar'?'إضافة هدف جديد':'🎯 Nouvel objectif')}
            </div>
            <FormMobile {...formProps}/>
          </div>
        )}
        {!showForm&&<><StatsBar/><Filtres/><Liste/></>}
      </div>
      <ConfirmModal {...confirmModal} onClose={()=>setConfirmModal({isOpen:false})} lang={lang}/>
    </div>
  );

  // ── PC ────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">
            ← {lang==='ar'?'رجوع':'Retour'}
          </button>
          <div style={{fontSize:20,fontWeight:700}}>🎯 {lang==='ar'?'الأهداف':'Gestion des objectifs'}</div>
        </div>
        <button onClick={showForm?()=>{setShowForm(false);setEditing(null);}:startCreate}
          style={{padding:'8px 18px',background:showForm?'#f0f0ec':'#1D9E75',
            color:showForm?'#666':'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
          {showForm?'✕ Annuler':'+ Nouvel objectif'}
        </button>
      </div>

      <StatsBar/>

      {/* Formulaire PC — pleine largeur */}
      {showForm&&(
        <div style={{background:'#fff',border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`,
          borderRadius:14,padding:'1.5rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:14,fontWeight:700,color:'#085041',marginBottom:'1.25rem'}}>
            {editing?(lang==='ar'?'تعديل الهدف':'✏️ Modifier l\'objectif'):(lang==='ar'?'إضافة هدف جديد':'🎯 Nouvel objectif')}
          </div>
          <FormPC {...formProps}/>
        </div>
      )}

      <Filtres/>
      <Liste/>
      <ConfirmModal {...confirmModal} onClose={()=>setConfirmModal({isOpen:false})} lang={lang}/>
    </div>
  );
}
