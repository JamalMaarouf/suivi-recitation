import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { isSourateNiveauDyn } from '../lib/helpers';

export default function ElevesMobile({ user, navigate, goBack, lang='ar', niveaux=[] }) {
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('tous');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: ed }, { data: id }] = await Promise.all([
      supabase.from('eleves').select('id,prenom,nom,code_niveau,niveau,eleve_id_ecole,hizb_depart,tomon_depart,sourates_acquises,telephone,date_inscription,instituteur_referent_id').eq('ecole_id', user.ecole_id).order('nom'),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
    ]);
    setEleves(ed || []);
    setInstituteurs(id || []);
    setLoading(false);
  };

  const getNiveauColor = (code) =>
    niveaux.find(n=>n.code===code)?.couleur ||
    {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[code] || '#888';

  const niveauxCodes = ['tous', ...niveaux.map(n=>n.code)];

  const elevesFiltres = eleves.filter(e => {
    const matchSearch = !search || `${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(search.toLowerCase());
    const matchNiveau = filtreNiveau === 'tous' || e.code_niveau === filtreNiveau;
    return matchSearch && matchNiveau;
  });

  return (
    <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#378ADD,#0C447C)', padding:'48px 16px 16px', position:'sticky', top:0, zIndex:100}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
          <button onClick={()=>goBack?goBack():navigate('dashboard')}
            style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:10, padding:'8px 12px', color:'#fff', fontSize:16, cursor:'pointer'}}>
            ←
          </button>
          <div style={{flex:1}}>
            <div style={{fontSize:18, fontWeight:800, color:'#fff'}}>👥 {lang==='ar'?'الطلاب':'Élèves'}</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.75)'}}>{eleves.length} {lang==='ar'?'طالب مسجل':'inscrits'}</div>
          </div>
          {user.role==='surveillant' && (
            <button onClick={()=>navigate('gestion', null, {tab:'eleves'})}
              style={{background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:10, padding:'8px 14px', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit'}}>
              + {lang==='ar'?'إضافة':'Ajouter'}
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{position:'relative'}}>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={lang==='ar'?'بحث عن طالب...':'Rechercher un élève...'}
            style={{width:'100%', padding:'10px 14px 10px 36px', borderRadius:12, border:'none', fontSize:14, fontFamily:'inherit', boxSizing:'border-box', background:'rgba(255,255,255,0.15)', color:'#fff', outline:'none'}}
          />
          <span style={{position:'absolute', right:lang==='ar'?'auto':'12px', left:lang==='ar'?'12px':'auto', top:'50%', transform:'translateY(-50%)', fontSize:14, opacity:0.7}}>🔍</span>
        </div>
      </div>

      {/* Filtre niveaux */}
      <div style={{display:'flex', gap:6, overflowX:'auto', padding:'10px 12px', scrollbarWidth:'none', background:'#fff', borderBottom:'0.5px solid #e0e0d8'}}>
        {niveauxCodes.map(code=>{
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

      {/* Count */}
      <div style={{padding:'8px 14px', fontSize:11, color:'#888'}}>
        {elevesFiltres.length} {lang==='ar'?'طالب':'élève(s)'}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{textAlign:'center', padding:'3rem', color:'#888'}}>...</div>
      ) : elevesFiltres.length===0 ? (
        <div style={{textAlign:'center', padding:'3rem', color:'#aaa', fontSize:13}}>
          {lang==='ar'?'لا يوجد طلاب':'Aucun élève'}
        </div>
      ) : (
        <div style={{padding:'0 12px'}}>
          {elevesFiltres.map(e => {
            const nc = getNiveauColor(e.code_niveau);
            const inst = instituteurs.find(i=>i.id===e.instituteur_referent_id);
            const isSour = isSourateNiveauDyn(e.code_niveau, niveaux);
            const niveauLabel = e.niveau==='Avancé'||e.niveau==='متقدم'?{label:lang==='ar'?'متقدم':'Avancé',color:'#085041'}
              :e.niveau==='Intermédiaire'||e.niveau==='متوسط'?{label:lang==='ar'?'متوسط':'Interm.',color:'#378ADD'}
              :{label:lang==='ar'?'مبتدئ':'Débutant',color:'#EF9F27'};
            return (
              <div key={e.id} onClick={()=>navigate('fiche',e)}
                style={{background:'#fff', borderRadius:14, padding:'13px 14px', marginBottom:8,
                  border:'0.5px solid #e0e0d8', display:'flex', alignItems:'center', gap:12, cursor:'pointer',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                {/* Avatar */}
                <div style={{width:44, height:44, borderRadius:'50%', background:`${nc}20`, color:nc,
                  display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14, flexShrink:0}}>
                  {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                </div>
                {/* Info */}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:700, fontSize:14}}>{e.prenom} {e.nom}</div>
                  <div style={{display:'flex', gap:5, marginTop:3, alignItems:'center', flexWrap:'wrap'}}>
                    <span style={{padding:'1px 7px', borderRadius:10, fontSize:10, fontWeight:700, background:`${nc}20`, color:nc}}>
                      {e.code_niveau||'?'}
                    </span>
                    <span style={{fontSize:10, fontWeight:500, color:niveauLabel.color}}>{niveauLabel.label}</span>
                    {e.eleve_id_ecole&&<span style={{fontSize:10, color:'#bbb'}}>#{e.eleve_id_ecole}</span>}
                  </div>
                  <div style={{display:'flex', gap:8, marginTop:3, fontSize:10, color:'#888'}}>
                    {inst&&<span>👨‍🏫 {inst.prenom} {inst.nom}</span>}
                    {isSour
                      ? <span style={{color:'#1D9E75', fontWeight:600}}>📖 {e.sourates_acquises||0}</span>
                      : <span>H.{e.hizb_depart} T.{e.tomon_depart}</span>
                    }
                    {e.telephone&&<span>📞 {e.telephone}</span>}
                  </div>
                </div>
                <span style={{color:'#ccc', fontSize:18}}>›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
