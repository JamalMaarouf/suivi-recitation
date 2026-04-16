import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcPointsPeriode, loadBareme, BAREME_DEFAUT } from '../lib/helpers';
import { t } from '../lib/i18n';

export default function ListeNotes({ user, navigate, goBack, lang='fr', isMobile }) {
  const [eleves, setEleves] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [pointsEvts, setPointsEvts] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [bareme, setBareme] = useState({ unites:{...BAREME_DEFAUT}, examens:{}, ensembles:{}, jalons:{} });
  const [loading, setLoading] = useState(true);

  // Filtres
  const [searchNum, setSearchNum] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [filtreInst, setFiltreInst] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [periode, setPeriode] = useState('total');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: el }, { data: vd }, { data: pe }, { data: inst }, { data: niv }] = await Promise.all([
      supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole,hizb_depart,tomon_depart,instituteur_referent_id').eq('ecole_id', user.ecole_id).order('nom'),
      supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,date_validation').eq('ecole_id', user.ecole_id),
      supabase.from('points_eleves').select('*').eq('ecole_id', user.ecole_id),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
      supabase.from('niveaux').select('id,code,nom,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
    ]);
    setEleves(el || []);
    setAllValidations(vd || []);
    setPointsEvts(pe || []);
    setInstituteurs(inst || []);
    setNiveaux(niv || []);
    const b = await loadBareme(supabase, user.ecole_id);
    setBareme(b);
    setLoading(false);
  };

  const getPeriodeDates = () => {
    const now = new Date();
    if (periode === 'total') return { debut: new Date('2000-01-01'), fin: now };
    if (periode === 'semaine') return { debut: new Date(now.getTime()-7*86400000), fin: now };
    if (periode === 'mois') return { debut: new Date(now.getFullYear(),now.getMonth(),1), fin: now };
    if (periode === 'trimestre') return { debut: new Date(now.getFullYear(),now.getMonth()-3,1), fin: now };
    if (dateDebut && dateFin) return { debut: new Date(dateDebut), fin: new Date(dateFin+'T23:59:59') };
    return { debut: new Date('2000-01-01'), fin: now };
  };

  const elevesAvecPts = useMemo(() => {
    const { debut, fin } = getPeriodeDates();
    return eleves.map(el => {
      const vals = allValidations.filter(v => v.eleve_id === el.id);
      const evts = pointsEvts.filter(p => p.eleve_id === el.id);
      const pts = calcPointsPeriode(vals, debut, fin, bareme, evts);
      const inst = instituteurs.find(i => i.id === el.instituteur_referent_id);
      return { ...el, pts, instNom: inst ? `${inst.prenom} ${inst.nom}` : '—' };
    }).sort((a, b) => b.pts.total - a.pts.total);
  }, [eleves, allValidations, pointsEvts, bareme, periode, dateDebut, dateFin]);

  const filtered = elevesAvecPts.filter(el => {
    if (searchNum && !el.eleve_id_ecole?.includes(searchNum) && !(el.prenom+' '+el.nom).toLowerCase().includes(searchNum.toLowerCase())) return false;
    if (filtreNiveau && el.code_niveau !== filtreNiveau) return false;
    if (filtreInst && el.instituteur_referent_id !== filtreInst) return false;
    return true;
  });

  const getNivColor = (code) => niveaux.find(n=>n.code===code)?.couleur || '#888';

  const PERIODES = [
    { id:'total',    label: lang==='ar'?'منذ البداية':'Depuis le début' },
    { id:'semaine',  label: lang==='ar'?'الأسبوع':'Semaine' },
    { id:'mois',     label: lang==='ar'?'الشهر':'Mois' },
    { id:'trimestre',label: lang==='ar'?'الفصل (3 أشهر)':'Trimestre' },
    { id:'custom',   label: lang==='ar'?'فترة محددة':'Période personnalisée' },
  ];

  return (
    <div style={{ padding: isMobile?'0':'1.5rem', paddingBottom:80, background: isMobile?'#f5f5f0':'transparent', minHeight: isMobile?'100vh':'auto' }}>
      {isMobile ? (
        <div style={{background:'linear-gradient(135deg,#534AB7,#7F77DD)',padding:'48px 16px 16px',marginBottom:12,position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:4}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:16,cursor:'pointer'}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>⭐ {lang==='ar'?'قائمة النقاط':'Notes & Points'}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.75)'}}>{filtered.length} {lang==='ar'?'طالب':'élève(s)'}</div>
            </div>
          </div>
        </div>
      ) : (
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.25rem' }}>
        <button onClick={()=>goBack?goBack():navigate('dashboard')} className="back-link">{t(lang,'retour')}</button>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:'#1a1a1a' }}>⭐ {lang==='ar'?'قائمة النقاط':'Liste des notes'}</div>
          <div style={{ fontSize:12, color:'#888' }}>{filtered.length} {lang==='ar'?'طالب':'élève(s)'}</div>
        </div>
      </div>
      )}

      {/* Sélecteur période */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:'1rem' }}>
        {PERIODES.map(p => (
          <button key={p.id} onClick={()=>setPeriode(p.id)}
            style={{ padding:'5px 12px', borderRadius:20,
              border:`1px solid ${periode===p.id?'#378ADD':'#e0e0d8'}`,
              background:periode===p.id?'#E6F1FB':'#fff',
              color:periode===p.id?'#378ADD':'#888',
              fontSize:11, fontWeight:periode===p.id?700:400, cursor:'pointer',
              fontFamily:"'Tajawal',Arial,sans-serif", direction:'rtl' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Dates personnalisées */}
      {periode === 'custom' && (
        <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap' }}>
          <input className="field-input" type="date" value={dateDebut} onChange={e=>setDateDebut(e.target.value)} style={{maxWidth:180}} />
          <input className="field-input" type="date" value={dateFin} onChange={e=>setDateFin(e.target.value)} style={{maxWidth:180}} />
        </div>
      )}

      {/* Filtres */}
      <div className="card" style={{ marginBottom:'1.25rem', margin: isMobile?'0 12px 12px':'', borderRadius: isMobile?12:undefined }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
          <input className="field-input" placeholder={'🔍 '+(lang==='ar'?'رقم أو اسم الطالب':'N° ou nom élève')}
            value={searchNum} onChange={e=>setSearchNum(e.target.value)} />
          <select className="field-select" value={filtreNiveau} onChange={e=>setFiltreNiveau(e.target.value)}>
            <option value="">{lang==='ar'?'كل المستويات':'Tous les niveaux'}</option>
            {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
          </select>
          <select className="field-select" value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}>
            <option value="">{lang==='ar'?'كل الأساتذة':'Tous les instituteurs'}</option>
            {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div style={{textAlign:'center',color:'#aaa',padding:'3rem'}}>...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{lang==='ar'?'الطالب':'Élève'}</th>
                <th>{lang==='ar'?'المستوى':'Niveau'}</th>
                <th>{lang==='ar'?'الأستاذ':'Instituteur'}</th>
                <th>{lang==='ar'?'الأثمان/السور':'Tomon/Sourates'}</th>
                <th>{lang==='ar'?'الأحزاب':'Hizb'}</th>
                <th>{lang==='ar'?'الامتحانات':'Examens'}</th>
                <th>{lang==='ar'?'الشهادات':'Certs'}</th>
                <th style={{color:'#378ADD'}}>{lang==='ar'?'المجموع':'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="empty">{lang==='ar'?'لا توجد بيانات':'Aucune donnée'}</td></tr>
              )}
              {filtered.map((el, idx) => {
                const nc = getNivColor(el.code_niveau);
                return (
                  <tr key={el.id} className="clickable" onClick={()=>navigate('fiche',el)}>
                    <td style={{color:'#aaa',fontSize:12}}>{idx+1}</td>
                    <td>
                      <div style={{fontWeight:600,fontSize:13}}>{el.prenom} {el.nom}</div>
                      <div style={{fontSize:10,color:'#aaa'}}>{lang==='ar'?'رقم':'N°'} {el.eleve_id_ecole}</div>
                    </td>
                    <td><span style={{padding:'2px 6px',borderRadius:8,fontSize:10,fontWeight:700,background:nc+'18',color:nc}}>{el.code_niveau}</span></td>
                    <td style={{fontSize:11,color:'#888'}}>{el.instNom}</td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#378ADD'}}>{el.pts.tomonPeriode}</span>
                      {el.pts.ptsTomon>0 && <div style={{fontSize:9,color:'#aaa'}}>+{el.pts.ptsTomon} {lang==='ar'?'ن':'pts'}</div>}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#085041'}}>{el.pts.hizbsPeriode}</span>
                      {el.pts.ptsHizb>0 && <div style={{fontSize:9,color:'#aaa'}}>+{el.pts.ptsHizb} {lang==='ar'?'ن':'pts'}</div>}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#EF9F27'}}>{el.pts.ptsExamens||0}</span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#D85A30'}}>{el.pts.ptsCertificats||0}</span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontSize:15,fontWeight:800,color:'#378ADD'}}>{el.pts.total.toLocaleString()}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
