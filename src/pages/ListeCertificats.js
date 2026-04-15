import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales, formatDate } from '../lib/helpers';
import { t } from '../lib/i18n';

export default function ListeCertificats({ user, navigate, goBack, lang='fr', isMobile }) {
  const [certificats, setCertificats] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [jalons, setJalons] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [loading, setLoading] = useState(true);

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
    const [{ data: certs }, { data: el }, { data: inst }, { data: jal }, { data: niv }] = await Promise.all([
      supabase.from('certificats_eleves').select('*').eq('ecole_id', user.ecole_id).order('date_obtention', { ascending: false }),
      supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole,instituteur_referent_id').eq('ecole_id', user.ecole_id),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
      supabase.from('jalons').select('id,nom,nom_ar,type_jalon').eq('ecole_id', user.ecole_id),
      supabase.from('niveaux').select('id,code,nom,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
    ]);
    setCertificats(certs || []);
    setEleves(el || []);
    setInstituteurs(inst || []);
    setJalons(jal || []);
    setNiveaux(niv || []);
    setLoading(false);
  };

  const getEleve = (id) => eleves.find(e => e.id === id);
  const getJalon = (id) => jalons.find(j => j.id === id);
  const getInst = (id) => instituteurs.find(i => i.id === id);
  const getNivColor = (code) => niveaux.find(n => n.code === code)?.couleur || '#888';

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

  return (
    <div style={{ padding: isMobile?'1rem':'1.5rem', paddingBottom: 80 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.25rem' }}>
        <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">{t(lang,'retour')}</button>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:'#1a1a1a' }}>🏅 {lang==='ar'?'قائمة الشهادات':'Liste des certificats'}</div>
          <div style={{ fontSize:12, color:'#888' }}>{filtered.length} {lang==='ar'?'شهادة':'certificat(s)'}</div>
        </div>
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
            {filtered.map(c => {
              const el = getEleve(c.eleve_id);
              const jal = getJalon(c.jalon_id);
              const inst = el ? getInst(el.instituteur_referent_id) : null;
              const nc = el ? getNivColor(el.code_niveau) : '#888';
              return (
                <div key={c.id} onClick={()=>el&&navigate('fiche',el)}
                  style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#f9f9f6'}
                  onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
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
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
