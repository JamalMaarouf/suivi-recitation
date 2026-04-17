import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales, formatDate } from '../lib/helpers';
import { t } from '../lib/i18n';
import { openPDF } from '../lib/pdf';

export default function ListeCertificats({ user, navigate, goBack, lang='fr', isMobile }) {
  const [certificats, setCertificats] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [jalons, setJalons] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genPdfId, setGenPdfId] = useState(null); // id du certificat en cours de génération
  const [genListe, setGenListe] = useState(false);

  // Filtres
  const [searchNum, setSearchNum] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [filtreJalon, setFiltreJalon] = useState('');
  const [filtreInst, setFiltreInst] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
    const [{ data: certs }, { data: el }, { data: inst }, { data: jal }, { data: niv }] = await Promise.all([
      supabase.from('certificats_eleves').select('*').eq('ecole_id', user.ecole_id).order('created_at', { ascending: false }),
      supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole,instituteur_referent_id').eq('ecole_id', user.ecole_id).limit(500).order('nom'),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
      supabase.from('jalons').select('id,nom,nom_ar,type_jalon').eq('ecole_id', user.ecole_id),
      supabase.from('niveaux').select('id,code,nom,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
    ]);
    setCertificats(certs || []);
    setEleves(el || []);
    setInstituteurs(inst || []);
    setJalons(jal || []);
    setNiveaux(niv || []);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const getEleve = (id) => eleves.find(e => e.id === id);
  const getJalon = (id) => jalons.find(j => j.id === id);
  const getInst = (id) => instituteurs.find(i => i.id === id);
  const getNivColor = (code) => niveaux.find(n => n.code === code)?.couleur || '#888';

  // ── PDF certificat individuel ────────────────────────────────
  const handlePdfCertificat = async (c, e) => {
    e?.stopPropagation?.(); // ne pas naviguer vers la fiche en cliquant le bouton
    if (genPdfId) return;
    const el = getEleve(c.eleve_id);
    const jal = getJalon(c.jalon_id);
    setGenPdfId(c.id);
    try {
      await openPDF('certificat', {
        eleve: el ? { prenom: el.prenom, nom: el.nom } : { prenom: '', nom: '' },
        jalon: jal ? { nom: jal.nom, nom_ar: jal.nom_ar } : { nom: c.nom_certificat, nom_ar: c.nom_certificat_ar },
        date: c.date_obtention,
        ecole: { nom: user?.ecole?.nom || '' },
        directeur: c.directeur || '',
      }, lang);
    } catch (err) {
      console.error('PDF certificat:', err);
      alert((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + err.message);
    }
    setGenPdfId(null);
  };

  // ── PDF liste complète (après filtres) ───────────────────────
  const handlePdfListe = async () => {
    if (genListe || filtered.length === 0) return;
    setGenListe(true);
    try {
      const certificatsData = filtered.map(c => {
        const el = getEleve(c.eleve_id) || {};
        const jal = getJalon(c.jalon_id) || {};
        const inst = el.instituteur_referent_id ? getInst(el.instituteur_referent_id) : null;
        const jalonLabel = lang === 'ar' ? (jal.nom_ar || jal.nom || '—') : (jal.nom || jal.nom_ar || '—');
        return {
          prenom: el.prenom || '',
          nom: el.nom || '',
          eleve_id_ecole: el.eleve_id_ecole || '',
          code_niveau: el.code_niveau || '',
          couleur: getNivColor(el.code_niveau),
          jalon: jalonLabel,
          instituteur: inst ? `${inst.prenom} ${inst.nom}` : '—',
          date_obtention: c.date_obtention,
        };
      });
      await openPDF('liste_certificats', {
        ecole: { nom: user?.ecole?.nom || '' },
        titre: lang === 'ar' ? 'قائمة الشهادات' : 'Liste des certificats',
        certificats: certificatsData,
      }, lang);
    } catch (err) {
      console.error('PDF liste certificats:', err);
      alert((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + err.message);
    }
    setGenListe(false);
  };

  const filtered = certificats.filter(c => {
    const el = getEleve(c.eleve_id);
    if (!el) return false;
    if (searchNum && !el.eleve_id_ecole?.includes(searchNum) && !(el.prenom+' '+el.nom).toLowerCase().includes(searchNum.toLowerCase())) return false;
    if (filtreNiveau && el.code_niveau !== filtreNiveau) return false;
    if (filtreJalon && c.jalon_id !== filtreJalon) return false;
    if (filtreInst && el.instituteur_referent_id !== filtreInst) return false;
    if (dateDebut && new Date(c.date_obtention) < new Date(dateDebut)) return false;
    if (dateFin && new Date(c.date_obtention) > new Date(dateFin+'T23:59:59')) return false;
    return true;
  });

  // ─── Mobile render ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#534AB7,#7F77DD)',padding:'48px 16px 16px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>🏅 {lang==='ar'?'الشهادات':'Certificats'}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.8)'}}>{filtered.length} {lang==='ar'?'شهادة':'certificat(s)'}</div>
            </div>
            <button onClick={handlePdfListe} disabled={genListe||filtered.length===0}
              style={{background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:(genListe||filtered.length===0)?'default':'pointer',opacity:(genListe||filtered.length===0)?0.5:1,flexShrink:0,whiteSpace:'nowrap',fontFamily:'inherit'}}>
              {genListe ? '⏳' : '📄 PDF'}
            </button>
          </div>
          {/* Recherche */}
          <input value={searchNum} onChange={e=>setSearchNum(e.target.value)}
            placeholder={lang==='ar'?'🔍 بحث بالاسم أو الرقم...':'🔍 Nom ou numéro...'}
            style={{width:'100%',padding:'10px 14px',borderRadius:12,border:'none',fontSize:14,fontFamily:'inherit',
              boxSizing:'border-box',background:'rgba(255,255,255,0.2)',color:'#fff',outline:'none'}}/>
        </div>

        {/* Filtres chips */}
        <div style={{display:'flex',gap:6,overflowX:'auto',padding:'10px 12px',scrollbarWidth:'none',background:'#fff',borderBottom:'0.5px solid #e0e0d8'}}>
          <select value={filtreNiveau} onChange={e=>setFiltreNiveau(e.target.value)}
            style={{padding:'5px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',fontSize:11,fontFamily:'inherit',background:filtreNiveau?'#EF9F27':'#f0f0ec',color:filtreNiveau?'#fff':'#666',flexShrink:0}}>
            <option value="">{lang==='ar'?'كل المستويات':'Niveaux'}</option>
            {niveaux.map(n=><option key={n.code} value={n.code}>{n.code}</option>)}
          </select>
          <select value={filtreJalon} onChange={e=>setFiltreJalon(e.target.value)}
            style={{padding:'5px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',fontSize:11,fontFamily:'inherit',background:filtreJalon?'#EF9F27':'#f0f0ec',color:filtreJalon?'#fff':'#666',flexShrink:0}}>
            <option value="">{lang==='ar'?'كل الشهادات':'Jalons'}</option>
            {jalons.map(j=><option key={j.id} value={j.id}>{j.nom_ar||j.nom}</option>)}
          </select>
          <select value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}
            style={{padding:'5px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',fontSize:11,fontFamily:'inherit',background:filtreInst?'#EF9F27':'#f0f0ec',color:filtreInst?'#fff':'#666',flexShrink:0}}>
            <option value="">{lang==='ar'?'كل الأساتذة':'Instituteurs'}</option>
            {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
          </select>
          {(searchNum||filtreNiveau||filtreJalon||filtreInst)&&(
            <div onClick={()=>{setSearchNum('');setFiltreNiveau('');setFiltreJalon('');setFiltreInst('');}}
              style={{padding:'5px 10px',borderRadius:20,background:'#FCEBEB',color:'#E24B4A',fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0,border:'none'}}>
              ✕
            </div>
          )}
        </div>

        {/* Liste */}
        {loading ? <div style={{textAlign:'center',padding:'3rem',color:'#888'}}>...</div>
          : filtered.length===0 ? (
            <div style={{textAlign:'center',padding:'3rem',color:'#aaa'}}>
              <div style={{fontSize:36,marginBottom:8}}>🏅</div>
              <div style={{fontSize:13}}>{lang==='ar'?'لا توجد شهادات':'Aucun certificat'}</div>
            </div>
          ) : (
            <div style={{padding:'10px 12px'}}>
              {(filtered||[]).map(c=>{
                const el=getEleve(c.eleve_id);
                const jal=getJalon(c.jalon_id);
                const inst=el?getInst(el.instituteur_referent_id):null;
                const nc=el?getNivColor(el.code_niveau):'#888';
                return(
                  <div key={c.id} onClick={()=>el&&navigate('fiche',el)}
                    style={{background:'#fff',borderRadius:13,padding:'12px 14px',marginBottom:8,
                      border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:12,cursor:'pointer',
                      boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                    <div style={{width:42,height:42,borderRadius:12,background:'#FAEEDA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>🏅</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:'#085041',direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif",lineHeight:1.3}}>
                        {jal?.nom_ar||jal?.nom||c.nom_certificat_ar||c.nom_certificat}
                      </div>
                      <div style={{display:'flex',gap:6,marginTop:3,alignItems:'center',flexWrap:'wrap'}}>
                        {el&&<span style={{fontSize:12,fontWeight:600,color:'#1a1a1a'}}>{el.prenom} {el.nom}</span>}
                        {el&&<span style={{padding:'1px 6px',borderRadius:10,fontSize:10,fontWeight:700,background:`${nc}20`,color:nc}}>{el.code_niveau}</span>}
                        {el?.eleve_id_ecole&&<span style={{fontSize:10,color:'#bbb'}}>#{el.eleve_id_ecole}</span>}
                      </div>
                      <div style={{fontSize:11,color:'#aaa',marginTop:2}}>
                        {inst&&<span>👨‍🏫 {inst.prenom} {inst.nom} · </span>}
                        📅 {c.date_obtention?new Date(c.date_obtention).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—'}
                      </div>
                    </div>
                    <button onClick={(ev)=>handlePdfCertificat(c,ev)} disabled={genPdfId===c.id}
                      style={{background:'#FAEEDA',border:'none',borderRadius:10,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,cursor:genPdfId===c.id?'default':'pointer',flexShrink:0,opacity:genPdfId===c.id?0.5:1}}
                      title={lang==='ar'?'تحميل PDF':'Télécharger PDF'}>
                      {genPdfId===c.id?'⏳':'📄'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    );
  }

  // ─── PC render ────────────────────────────────────────────────
  return (
    <div style={{ padding:'1.5rem', paddingBottom: 80 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.25rem' }}>
        <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">{t(lang,'retour')}</button>
        <div style={{flex:1}}>
          <div style={{ fontSize:20, fontWeight:800, color:'#1a1a1a' }}>🏅 {lang==='ar'?'قائمة الشهادات':'Liste des certificats'}</div>
          <div style={{ fontSize:12, color:'#888' }}>{filtered.length} {lang==='ar'?'شهادة':'certificat(s)'}</div>
        </div>
        <button onClick={handlePdfListe} disabled={genListe||filtered.length===0}
          style={{padding:'8px 16px',background:'#534AB7',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:(genListe||filtered.length===0)?'default':'pointer',opacity:(genListe||filtered.length===0)?0.5:1,fontFamily:'inherit'}}>
          {genListe ? (lang==='ar'?'⏳ جاري...':'⏳ Génération...') : (lang==='ar'?'📄 تصدير PDF':'📄 Exporter PDF')}
        </button>
      </div>

      {/* Filtres */}
      <div className="card" style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
          <input className="field-input" placeholder={'🔍 '+(lang==='ar'?'رقم أو اسم الطالب':'N° ou nom élève')}
            value={searchNum} onChange={e=>setSearchNum(e.target.value)} />
          <select className="field-select" value={filtreNiveau} onChange={e=>setFiltreNiveau(e.target.value)}>
            <option value="">{lang==='ar'?'كل المستويات':'Tous les niveaux'}</option>
            {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
          </select>
          <select className="field-select" value={filtreJalon} onChange={e=>setFiltreJalon(e.target.value)}>
            <option value="">{lang==='ar'?'كل الشهادات':'Tous les jalons'}</option>
            {jalons.map(j=><option key={j.id} value={j.id}>{j.nom_ar||j.nom}</option>)}
          </select>
          <select className="field-select" value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}>
            <option value="">{lang==='ar'?'كل الأساتذة':'Tous les instituteurs'}</option>
            {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
          </select>
          <input className="field-input" type="date" value={dateDebut} onChange={e=>setDateDebut(e.target.value)}
            placeholder={lang==='ar'?'من':'Du'} title={lang==='ar'?'من':'Du'} />
          <input className="field-input" type="date" value={dateFin} onChange={e=>setDateFin(e.target.value)}
            placeholder={lang==='ar'?'إلى':'Au'} title={lang==='ar'?'إلى':'Au'} />
        </div>
        {(searchNum||filtreNiveau||filtreJalon||filtreInst||dateDebut||dateFin) && (
          <button onClick={()=>{setSearchNum('');setFiltreNiveau('');setFiltreJalon('');setFiltreInst('');setDateDebut('');setDateFin('');}}
            style={{marginTop:8,padding:'4px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',color:'#888'}}>
            ✕ {lang==='ar'?'مسح الفلاتر':'Effacer filtres'}
          </button>
        )}
      </div>

      {loading ? <div style={{textAlign:'center',color:'#aaa',padding:'3rem'}}>...</div> : (
        filtered.length === 0 ? (
          <div className="empty">{lang==='ar'?'لا توجد شهادات':'Aucun certificat'}</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(filtered||[]).map(c => {
              const el = getEleve(c.eleve_id);
              const jal = getJalon(c.jalon_id);
              const inst = el ? getInst(el.instituteur_referent_id) : null;
              const nc = el ? getNivColor(el.code_niveau) : '#888';
              return (
                <div key={c.id} onClick={()=>el&&navigate('fiche',el)}
                  style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <div style={{width:44,height:44,borderRadius:12,background:'#FAEEDA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🏅</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#085041',direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>
                      {jal?.nom_ar || jal?.nom || c.nom_certificat_ar || c.nom_certificat}
                    </div>
                    <div style={{fontSize:12,color:'#888',marginTop:2}}>
                      {el ? <><span style={{fontWeight:600,color:'#1a1a1a'}}>{el.prenom} {el.nom}</span> · <span style={{color:nc,fontWeight:600,fontSize:10}}>{el.code_niveau}</span></> : '—'}
                      {inst && <span style={{color:'#888'}}> · {inst.prenom} {inst.nom}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:11,color:'#EF9F27',fontWeight:600}}>
                      📅 {c.date_obtention ? new Date(c.date_obtention).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                    </div>
                    {el && <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{lang==='ar'?'رقم':'N°'} {el.eleve_id_ecole}</div>}
                  </div>
                  <button onClick={(ev)=>handlePdfCertificat(c,ev)} disabled={genPdfId===c.id}
                    style={{background:'#FAEEDA',border:'none',borderRadius:10,padding:'8px 12px',fontSize:13,fontWeight:600,color:'#A85F10',cursor:genPdfId===c.id?'default':'pointer',flexShrink:0,opacity:genPdfId===c.id?0.5:1,fontFamily:'inherit'}}
                    title={lang==='ar'?'تحميل PDF':'Télécharger PDF'}>
                    {genPdfId===c.id?'⏳':'📄 PDF'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
