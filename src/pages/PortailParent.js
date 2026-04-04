import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales, joursDepuis, scoreLabel, formatDateCourt } from '../lib/helpers';
import { getSouratesForNiveau } from '../lib/sourates';
import { t } from '../lib/i18n';

const IS_SOURATE = (code) => ['5B','5A','2M'].includes(code||'');
const NIVEAU_COLORS = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'};

function Avatar({ prenom, nom, size=40, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:size*0.35,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

function NiveauBadge({ code }) {
  const c = NIVEAU_COLORS[code||'1']||'#888';
  return <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700,background:c+'18',color:c,border:'0.5px solid '+c+'30'}}>{code}</span>;
}

export default function PortailParent({ parent, navigate, goBack, lang='fr' }) {
  const [enfants, setEnfants] = useState([]);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [validations, setValidations] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [objectifs, setObjectifs] = useState([]);
  const [cotisations, setCotisations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState('progression');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (enfants.length>0 && !selectedEnfant) setSelectedEnfant(enfants[0]); }, [enfants]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load linked children
      const { data: links } = await supabase
        .from('parent_eleve')
        .select('eleve_id, eleve:eleve_id(*)')
        .eq('parent_id', parent.id);

      const elevesData = (links||[]).map(l=>l.eleve).filter(Boolean);
      setEnfants(elevesData);

      if (elevesData.length > 0) {
        const ids = elevesData.map(e=>e.id);
        const results = await Promise.allSettled([
          supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').in('eleve_id', ids).order('date_validation',{ascending:false}),
          supabase.from('recitations_sourates').select('*, valideur:valide_par(prenom,nom)').in('eleve_id', ids).order('date_validation',{ascending:false}),
          supabase.from('objectifs_globaux').select('*').limit(100),
          supabase.from('cotisations').select('*').in('eleve_id', ids).order('date_paiement',{ascending:false}),
          supabase.from('sourates').select('*'),
        ]);
        setValidations(results[0].status==='fulfilled'?results[0].value.data||[]:[]);
        setRecitations(results[1].status==='fulfilled'?results[1].value.data||[]:[]);
        setObjectifs(results[2].status==='fulfilled'?results[2].value.data||[]:[]);
        setCotisations(results[3].status==='fulfilled'?results[3].value.data||[]:[]);
        setSouratesDB(results[4].status==='fulfilled'?results[4].value.data||[]:[]);
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  if (loading) return <div className="loading">...</div>;
  if (enfants.length === 0) return (
    <div style={{padding:'3rem',textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:'1rem'}}>👶</div>
      <div style={{fontSize:15,color:'#888'}}>{lang==='ar'?'لا يوجد طلاب مرتبطون بحسابك':'Aucun enfant lié à votre compte'}</div>
    </div>
  );

  const eleve = selectedEnfant;
  if (!eleve) return null;

  const isSourate = IS_SOURATE(eleve?.code_niveau||'');
  const nc = NIVEAU_COLORS[eleve?.code_niveau||'1']||'#888';
  const sl = scoreLabel(0);

  // Stats pour l'élève sélectionné
  const vE = validations.filter(v=>v.eleve_id===eleve.id);
  const rE = recitations.filter(r=>r.eleve_id===eleve.id);
  const cotE = cotisations.filter(c=>c.eleve_id===eleve.id);

  const tomon = vE.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
  const hizb = vE.filter(v=>v.type_validation==='hizb_complet').length;
  const souratesCompletes = rE.filter(r=>r.type_recitation==='complete').length;
  const sequences = rE.filter(r=>r.type_recitation==='sequence').length;
  const pts = tomon*10+Math.floor(tomon/2)*25+Math.floor(tomon/4)*60+hizb*100+rE.reduce((s,r)=>s+(r.points||0),0);

  // Dernière activité
  const allActivity = [...vE,...rE].sort((a,b)=>new Date(b.date_validation)-new Date(a.date_validation));
  const derniere = allActivity[0]?.date_validation||null;
  const joursInactif = joursDepuis(derniere);

  // Activité 7 derniers jours
  const debutSemaine = new Date(); debutSemaine.setDate(debutSemaine.getDate()-7);
  const actifSemaine = allActivity.filter(x=>new Date(x.date_validation)>=debutSemaine).length;

  // Objectifs actifs pour cet élève
  const now = new Date();
  const objActifs = objectifs.filter(o => {
    const debut = new Date(o.date_debut); const fin = new Date(o.date_fin);
    if (now < debut || now > fin) return false;
    if (o.type_cible==='eleve') return o.eleve_id===eleve.id;
    if (o.type_cible==='niveau') return o.code_niveau===(eleve.code_niveau||'1');
    return false;
  });

  // Sourate actuelle
  let sourateActuelle = null;
  if (isSourate) {
    const souratesNiveau = getSouratesForNiveau(eleve.code_niveau);
    const sorted = [...souratesNiveau].sort((a,b)=>b.numero-a.numero);
    const souratesAcq = parseInt(eleve.sourates_acquises)||0;
    const souratesCompletesSet = new Set(rE.filter(r=>r.type_recitation==='complete').map(r=>r.sourate_id));
    const idx = sorted.findIndex((s,i) => {
      if (i < souratesAcq) return false;
      const dbS = souratesDB.find(x=>x.numero===s.numero);
      return dbS ? !souratesCompletesSet.has(dbS.id) : false;
    });
    sourateActuelle = idx >= 0 ? sorted[idx] : null;
  }

  const onglets = [
    { key:'progression', label:'Progression',     labelAr:'التقدم',        icon:'📈' },
    { key:'recitations', label:'Récitations',      labelAr:'الاستظهارات',     icon:'📖' },
    { key:'objectifs',   label:'Objectifs',        labelAr:'الأهداف',       icon:'🎯' },
    { key:'cotisations', label:'Cotisations',      labelAr:'الاشتراكات',    icon:'💰' },
  ];

  return (
    <div>
      {/* Header parent */}
      <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem',color:'#fff'}}>
        <div style={{fontSize:12,opacity:0.8,marginBottom:4}}>
          {lang==='ar'?'مرحباً':lang==='en'?'Welcome':'Bonjour'}, <strong>{parent.prenom} {parent.nom}</strong>
        </div>
        <div style={{fontSize:11,opacity:0.7}}>متابعة التحفيظ</div>
      </div>

      {/* Sélecteur enfant (si plusieurs) */}
      {enfants.length > 1 && (
        <div style={{display:'flex',gap:8,marginBottom:'1rem',flexWrap:'wrap'}}>
          {enfants.map(e=>(
            <div key={e.id} onClick={()=>{setSelectedEnfant(e);setOnglet('progression');}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:12,cursor:'pointer',
                border:'1.5px solid '+(selectedEnfant?.id===e.id?nc:'#e0e0d8'),
                background:selectedEnfant?.id===e.id?nc+'10':'#fff'}}>
              <Avatar prenom={e.prenom} nom={e.nom} size={32} bg={nc+'20'} color={nc}/>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:selectedEnfant?.id===e.id?nc:'#1a1a1a'}}>{e.prenom} {e.nom}</div>
                <NiveauBadge code={e.code_niveau}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Carte élève */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1rem',display:'flex',alignItems:'center',gap:14}}>
        <Avatar prenom={eleve.prenom} nom={eleve.nom} size={52} bg={nc+'18'} color={nc}/>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:18,fontWeight:700}}>{eleve.prenom} {eleve.nom}</span>
            <NiveauBadge code={eleve.code_niveau}/>
            {eleve.eleve_id_ecole&&<span style={{fontSize:11,color:'#bbb'}}>#{eleve.eleve_id_ecole}</span>}
          </div>
          <div style={{fontSize:12,color:'#888',marginTop:4}}>
            {isSourate
              ? (sourateActuelle?<span>{lang==='ar'?'السورة الحالية:':'En cours: '}<strong style={{fontFamily:"'Tajawal',Arial"}}>{sourateActuelle.nom_ar}</strong></span>:<span>{lang==='ar'?'أتم البرنامج 🎉':'Programme terminé 🎉'}</span>)
              : `Hizb ${eleve.hizb_depart||1} · T.${eleve.tomon_depart||1}`
            }
          </div>
          <div style={{fontSize:11,color:joursInactif>14?'#E24B4A':'#888',marginTop:2}}>
            {derniere
              ? (lang==='ar'?'آخر استظهار: ':'Dernière récitation: ')+new Date(derniere).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'numeric',month:'long',year:'numeric'})
              : (lang==='ar'?'لم يبدأ بعد':'Pas encore commencé')}
          </div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:800,color:nc}}>{pts.toLocaleString()}</div>
          <div style={{fontSize:11,color:'#888'}}>pts</div>
        </div>
      </div>

      {/* KPI rapides */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:'1rem'}}>
        {(isSourate?[
          {val:souratesCompletes,lbl:lang==='ar'?'سور مكتملة':'Sourates',color:'#1D9E75',bg:'#E1F5EE'},
          {val:sequences,lbl:lang==='ar'?'مقاطع':'Séquences',color:'#378ADD',bg:'#E6F1FB'},
          {val:actifSemaine,lbl:lang==='ar'?'نشاط 7 أيام':'7 derniers jours',color:'#EF9F27',bg:'#FAEEDA'},
          {val:pts,lbl:lang==='ar'?'النقاط':'Points',color:'#534AB7',bg:'#EEEDFE'},
        ]:[
          {val:tomon,lbl:'Tomon',color:'#378ADD',bg:'#E6F1FB'},
          {val:hizb,lbl:'Hizb',color:'#EF9F27',bg:'#FAEEDA'},
          {val:actifSemaine,lbl:lang==='ar'?'نشاط 7 أيام':'7 derniers jours',color:'#1D9E75',bg:'#E1F5EE'},
          {val:pts,lbl:lang==='ar'?'النقاط':'Points',color:'#534AB7',bg:'#EEEDFE'},
        ]).map(k=>(
          <div key={k.lbl} style={{background:k.bg,borderRadius:10,padding:'10px',textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,color:k.color}}>{k.val}</div>
            <div style={{fontSize:10,color:k.color,opacity:0.8}}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{display:'flex',gap:4,background:'#f0f0ec',borderRadius:12,padding:4,marginBottom:'1rem'}}>
        {onglets.map(o=>(
          <div key={o.key} onClick={()=>setOnglet(o.key)}
            style={{flex:1,padding:'7px 8px',borderRadius:8,fontSize:11,fontWeight:onglet===o.key?600:400,cursor:'pointer',textAlign:'center',
              background:onglet===o.key?'#fff':'transparent',color:onglet===o.key?'#085041':'#888',
              border:onglet===o.key?'0.5px solid #e0e0d8':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:3}}>
            <span>{o.icon}</span><span>{lang==='ar'?o.labelAr:o.label}</span>
          </div>
        ))}
      </div>

      {/* PROGRESSION */}
      {onglet==='progression'&&(
        <>
          {/* Barre de progression globale */}
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem',marginBottom:'1rem'}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{lang==='ar'?'التقدم العام':'Progression générale'}</div>
            {isSourate?(()=>{
              const souratesNiveau = getSouratesForNiveau(eleve.code_niveau);
              const total = souratesNiveau.length;
              const acq = parseInt(eleve.sourates_acquises)||0;
              const pct = Math.round((acq+souratesCompletes)/total*100);
              return(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:6}}>
                    <span>{acq+souratesCompletes}/{total} {lang==='ar'?'سورة':'sourates'}</span>
                    <span style={{fontWeight:700,color:nc}}>{pct}%</span>
                  </div>
                  <div style={{height:14,background:'#e8e8e0',borderRadius:7,overflow:'hidden'}}>
                    <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,#1D9E75,#5DCAA5)',borderRadius:7,transition:'width 0.5s'}}/>
                  </div>
                  <div style={{fontSize:11,color:'#888',marginTop:6}}>
                    {lang==='ar'?'المكتسبات السابقة:':'Acquis antérieurs:'} <strong>{acq}</strong> · {lang==='ar'?'منذ المتابعة:':'Depuis le suivi:'} <strong>{souratesCompletes}</strong>
                  </div>
                </div>
              );
            })():(()=>{
              const totalTomon = (60-((eleve.hizb_depart||1)-1))*8 - ((eleve.tomon_depart||1)-1);
              const pct = Math.min(100, Math.round(tomon/Math.max(totalTomon,1)*100));
              return(
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:6}}>
                    <span>{tomon} Tomon · {hizb} Hizb complets</span>
                    <span style={{fontWeight:700,color:nc}}>{pct}%</span>
                  </div>
                  <div style={{height:14,background:'#e8e8e0',borderRadius:7,overflow:'hidden'}}>
                    <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,#EF9F27,#F5C56E)',borderRadius:7}}/>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Activité récente */}
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem'}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{lang==='ar'?'النشاط الأخير':'Activité récente'}</div>
            {allActivity.slice(0,6).map((item,i)=>{
              const isSR = !!item.type_recitation;
              const sourate = isSR ? souratesDB.find(s=>s.id===item.sourate_id) : null;
              const pts2 = isSR?(item.points||10):(item.type_validation==='hizb_complet'?100:item.nombre_tomon*10);
              return(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'0.5px solid #f0f0ec'}}>
                  <div style={{width:36,height:36,borderRadius:8,background:isSR?'#E1F5EE':'#E6F1FB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                    {isSR?'📖':'🎯'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:500}}>
                      {isSR?(item.type_recitation==='complete'?(sourate?sourate.nom_ar:'Sourate complète'):('V.'+item.verset_debut+'→'+item.verset_fin)):(item.type_validation==='hizb_complet'?'Hizb '+item.hizb_valide:item.nombre_tomon+' Tomon')}
                    </div>
                    <div style={{fontSize:11,color:'#888'}}>{new Date(item.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'numeric',month:'short'})}</div>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>+{pts2}</span>
                </div>
              );
            })}
            {allActivity.length===0&&<div className="empty">{lang==='ar'?'لا نشاط بعد':'Aucune activité'}</div>}
          </div>
        </>
      )}

      {/* RÉCITATIONS */}
      {onglet==='recitations'&&(
        <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem'}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{lang==='ar'?'سجل الاستظهارات':'Historique des récitations'} ({allActivity.length})</div>
          {allActivity.length===0?<div className="empty">{lang==='ar'?'لا استظهارات بعد':'Aucune récitation'}</div>:(
            <div className="table-wrap">
              <table><thead><tr>
                <th>{lang==='ar'?'التاريخ':'Date'}</th>
                <th>{lang==='ar'?'النوع':'Type'}</th>
                <th>{lang==='ar'?'التفاصيل':'Détails'}</th>
                <th>{lang==='ar'?'صحح بواسطة':'Validé par'}</th>
                <th>pts</th>
              </tr></thead>
              <tbody>
                {allActivity.map((item,i)=>{
                  const isSR = !!item.type_recitation;
                  const sourate = isSR ? souratesDB.find(s=>s.id===item.sourate_id) : null;
                  const pts2 = isSR?(item.points||10):(item.type_validation==='hizb_complet'?100:item.nombre_tomon*10);
                  return(
                    <tr key={i}>
                      <td style={{fontSize:11,color:'#888'}}>{new Date(item.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</td>
                      <td>{isSR?(item.type_recitation==='complete'?<span className="badge badge-green">{lang==='ar'?'سورة كاملة':'Complète'}</span>:<span className="badge badge-blue">{lang==='ar'?'مقطع':'Séquence'}</span>):(item.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb ✓</span>:<span className="badge badge-blue">Tomon</span>)}</td>
                      <td style={{fontFamily:"'Tajawal',Arial",fontSize:12}}>{isSR?(sourate?sourate.nom_ar:('V.'+item.verset_debut+'→'+item.verset_fin)):(item.type_validation==='hizb_complet'?'Hizb '+item.hizb_valide:item.nombre_tomon+' T.')}</td>
                      <td style={{fontSize:11,color:'#888'}}>{item.valideur?item.valideur.prenom+' '+item.valideur.nom:'—'}</td>
                      <td><span style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>+{pts2}</span></td>
                    </tr>
                  );
                })}
              </tbody></table>
            </div>
          )}
        </div>
      )}

      {/* OBJECTIFS */}
      {onglet==='objectifs'&&(
        <div>
          {objActifs.length===0?<div className="empty">{lang==='ar'?'لا أهداف نشطة حالياً':'Aucun objectif actif'}</div>:(
            objActifs.map(obj=>{
              // Calculate achievement
              let realise = 0;
              if (obj.metrique==='tomon') realise=tomon;
              else if (obj.metrique==='hizb') realise=hizb;
              else if (obj.metrique==='sourate') realise=souratesCompletes;
              else if (obj.metrique==='sequence') realise=sequences;
              else if (obj.metrique==='points') realise=pts;
              const pct = Math.min(100, Math.round(realise/obj.valeur_cible*100));
              const color = pct>=100?'#1D9E75':pct>=60?'#EF9F27':'#E24B4A';
              const daysLeft = Math.max(0,Math.ceil((new Date(obj.date_fin)-now)/(1000*60*60*24)));
              return(
                <div key={obj.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem',marginBottom:'1rem'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600}}>{obj.titre||(lang==='ar'?'هدف':'Objectif')}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>
                        {new Date(obj.date_debut).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} → {new Date(obj.date_fin).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
                      </div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:24,fontWeight:800,color}}>{pct}%</div>
                      <div style={{fontSize:10,color:'#888'}}>{realise}/{obj.valeur_cible}</div>
                    </div>
                  </div>
                  <div style={{height:12,background:'#e8e8e0',borderRadius:6,overflow:'hidden',marginBottom:6}}>
                    <div style={{height:'100%',width:pct+'%',background:color,borderRadius:6,transition:'width 0.5s'}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#888'}}>
                    <span>{pct>=100?'🎉 '+(lang==='ar'?'تم تحقيق الهدف!':'Objectif atteint !'):daysLeft+' '+(lang==='ar'?'يوم متبقي':'jours restants')}</span>
                    <span>{lang==='ar'?'المتبقي:':'Restant:'} {Math.max(0,obj.valeur_cible-realise)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* COTISATIONS */}
      {onglet==='cotisations'&&(
        <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem'}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>
            💰 {lang==='ar'?'الاشتراكات':'Cotisations'}
            <span style={{fontSize:12,color:'#1D9E75',marginRight:8,marginLeft:8,fontWeight:700}}>
              {lang==='ar'?'المجموع:':'Total: '}{cotE.filter(c=>c.statut!=='exonere').reduce((s,c)=>s+parseFloat(c.montant||0),0).toLocaleString()} MAD
            </span>
          </div>
          {cotE.length===0?<div className="empty">{lang==='ar'?'لا اشتراكات مسجلة':'Aucune cotisation'}</div>:(
            cotE.map((c,i)=>{
              const STATUTS_P = {paye:{label:'Payé',labelAr:'مدفوع',color:'#1D9E75',bg:'#E1F5EE'},partiel:{label:'Partiel',labelAr:'جزئي',color:'#EF9F27',bg:'#FAEEDA'},non_paye:{label:'Non payé',labelAr:'غير مدفوع',color:'#E24B4A',bg:'#FCEBEB'},exonere:{label:'Exonéré',labelAr:'معفى',color:'#888',bg:'#f5f5f0'}};
              const st = STATUTS_P[c.statut]||STATUTS_P.paye;
              return(
                <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'0.5px solid #f0f0ec'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{c.periode||(lang==='ar'?'دفعة':'Versement')} {i+1}</div>
                    <div style={{fontSize:11,color:'#888'}}>{c.date_paiement}{c.note?' · '+c.note:''}</div>
                  </div>
                  <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:st.bg,color:st.color}}>{lang==='ar'?st.labelAr:st.label}</span>
                  <span style={{fontSize:15,fontWeight:800,color:'#1D9E75'}}>{parseFloat(c.montant||0).toLocaleString()} MAD</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
