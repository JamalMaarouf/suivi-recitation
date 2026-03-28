import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcPositionAtteinte, calcUnite, formatDate, formatDateCourt, getInitiales, scoreLabel, calcBadges, calcVitesse, joursDepuis, isInactif } from '../lib/helpers';

function Avatar({ prenom, nom, size = 44, bg = '#E1F5EE', color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

function calcStreak(validations) {
  if (!validations.length) return 0;
  const weeks = new Set(validations.map(v => {
    const d = new Date(v.date_validation);
    const start = new Date(d.getFullYear(), 0, 1);
    return `${d.getFullYear()}-${Math.floor((d-start)/(7*24*60*60*1000))}`;
  }));
  const sorted = [...weeks].sort().reverse();
  let streak = 1;
  for (let i = 0; i < sorted.length-1; i++) {
    const [y1,w1]=sorted[i].split('-').map(Number);
    const [y2,w2]=sorted[i+1].split('-').map(Number);
    if((y1-y2)*52+(w1-w2)===1) streak++;
    else break;
  }
  return streak;
}

function calcHeatmap(validations) {
  const map = {};
  validations.forEach(v => {
    const d = new Date(v.date_validation).toLocaleDateString('fr-FR');
    map[d] = (map[d]||0) + (v.type_validation==='hizb_complet'?3:v.nombre_tomon);
  });
  return map;
}

function calcEvolution(validations, hizbDepart, tomonDepart) {
  const vals = [...validations].sort((a,b) => new Date(a.date_validation)-new Date(b.date_validation));
  let cumul=0, hizbsComplets=new Set();
  const points = [{ date:null, score:0, label:'Départ' }];
  vals.forEach(v => {
    if(v.type_validation==='hizb_complet') hizbsComplets.add(v.hizb_valide);
    else cumul += v.nombre_tomon;
    const score = cumul*10 + Math.floor(cumul/2)*25 + Math.floor(cumul/4)*60 + hizbsComplets.size*100;
    points.push({ date:v.date_validation, score, label:formatDateCourt(v.date_validation) });
  });
  return points;
}

export default function FicheEleve({ eleve, user, navigate }) {
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instituteurNom, setInstituteurNom] = useState('—');
  const [etat, setEtat] = useState(null);
  const [onglet, setOnglet] = useState('apercu');
  const [objectifMensuel, setObjectifMensuel] = useState(null);
  const [editObjectif, setEditObjectif] = useState(false);
  const [newObjectif, setNewObjectif] = useState('');

  useEffect(() => { loadData(); }, [eleve.id]);

  const loadData = async () => {
    setLoading(true);
    const { data: vals } = await supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').eq('eleve_id', eleve.id).order('date_validation', { ascending: false });
    if (eleve.instituteur_referent_id) {
      const { data: inst } = await supabase.from('utilisateurs').select('prenom,nom').eq('id', eleve.instituteur_referent_id).single();
      if (inst) setInstituteurNom(`${inst.prenom} ${inst.nom}`);
    }
    const e = calcEtatEleve(vals||[], eleve.hizb_depart, eleve.tomon_depart);
    setEtat(e);
    setValidations(vals||[]);
    setLoading(false);
  };

  const handlePrint = () => {
    const w = window.open('','','width=800,height=900');
    const pts = etat?.points;
    w.document.write(`<html><head><title>Fiche - ${eleve.prenom} ${eleve.nom}</title>
    <style>body{font-family:Arial,sans-serif;color:#1a1a1a;padding:30px}h1{font-size:22px}h2{font-size:14px;margin:20px 0 10px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}.box{border:1px solid #e0e0d8;border-radius:8px;padding:12px;text-align:center}
    .box-title{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:4px}.box-val{font-size:22px;font-weight:700;color:#1D9E75}
    table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f9f9f6;text-align:left;padding:8px;border-bottom:1px solid #e0e0d8;font-size:10px;text-transform:uppercase}
    td{padding:8px;border-bottom:1px solid #f0f0ec}.pts{color:#1D9E75;font-weight:600}.footer{margin-top:30px;font-size:11px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:12px}
    </style></head><body>
    <h1>${eleve.prenom} ${eleve.nom}</h1>
    <p style="color:#888;font-size:13px">${eleve.niveau} · Référent : ${instituteurNom} · Départ : Hizb ${eleve.hizb_depart}, T.${eleve.tomon_depart}</p>
    <div class="grid">
      <div class="box"><div class="box-title">Score total</div><div class="box-val">${pts?.total.toLocaleString()} pts</div></div>
      <div class="box"><div class="box-title">Position</div><div class="box-val">Hizb ${etat?.hizbEnCours}</div></div>
      <div class="box"><div class="box-title">Tomon validés</div><div class="box-val">${etat?.tomonCumul}</div></div>
      <div class="box"><div class="box-title">Hizb complets</div><div class="box-val">${etat?.hizbsComplets.size}</div></div>
    </div>
    <h2>Détail des points</h2>
    <table><thead><tr><th>Type</th><th>Quantité</th><th>Pts unitaires</th><th>Total</th></tr></thead><tbody>
    <tr><td>Tomon</td><td>${etat?.tomonCumul}</td><td>10 pts</td><td class="pts">${pts?.ptsTomon} pts</td></tr>
    <tr><td>Roboe</td><td>${pts?.details.nbRoboe}</td><td>25 pts</td><td class="pts">${pts?.ptsRoboe} pts</td></tr>
    <tr><td>Nisf</td><td>${pts?.details.nbNisf}</td><td>60 pts</td><td class="pts">${pts?.ptsNisf} pts</td></tr>
    <tr><td>Hizb complet</td><td>${pts?.details.nbHizb}</td><td>100 pts</td><td class="pts">${pts?.ptsHizb} pts</td></tr>
    <tr style="font-weight:bold"><td colspan="3">TOTAL</td><td class="pts">${pts?.total.toLocaleString()} pts</td></tr>
    </tbody></table>
    <h2>Historique</h2>
    <table><thead><tr><th>Date</th><th>Type</th><th>Détail</th><th>Points</th><th>Validé par</th></tr></thead><tbody>
    ${validations.map(v=>`<tr><td>${formatDate(v.date_validation)}</td><td>${v.type_validation==='hizb_complet'?'Hizb complet':v.nombre_tomon+' Tomon'}</td><td>${v.type_validation==='hizb_complet'?'Hizb '+v.hizb_valide+' validé':(v.tomon_debut?'T.'+v.tomon_debut+'→T.'+(v.tomon_debut+v.nombre_tomon-1):v.nombre_tomon+' Tomon')}</td><td class="pts">+${v.type_validation==='hizb_complet'?100:v.nombre_tomon*10} pts</td><td>${v.valideur?v.valideur.prenom+' '+v.valideur.nom:'—'}</td></tr>`).join('')}
    </tbody></table>
    <div class="footer">Imprimé le ${new Date().toLocaleDateString('fr-FR')} · Suivi Récitation</div>
    </body></html>`);
    w.document.close();
    setTimeout(()=>{w.print();w.close();},500);
  };

  const sl = etat ? scoreLabel(etat.points.total) : { color:'#888', bg:'#f0f0ec', label:'—' };
  const badges = etat ? calcBadges(validations, etat) : [];
  const vitesse = calcVitesse(validations);
  const streak = calcStreak(validations);
  const heatmap = calcHeatmap(validations);
  const evolution = calcEvolution(validations, eleve.hizb_depart, eleve.tomon_depart);
  const maxScore = Math.max(...evolution.map(p=>p.score), 1);
  const derniere = validations[0]?.date_validation||null;

  const last90 = Array.from({length:90},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(89-i));return d.toLocaleDateString('fr-FR');});
  const heatColor = (c) => !c?'#e8e8e0':c>=6?'#085041':c>=4?'#1D9E75':c>=2?'#5DCAA5':'#9FE1CB';

  // Objectif mensuel
  const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  const tomonCeMois = validations.filter(v=>v.type_validation==='tomon'&&new Date(v.date_validation)>=debutMois).reduce((s,v)=>s+v.nombre_tomon,0);
  const pctObjectif = objectifMensuel ? Math.min(100, Math.round(tomonCeMois/objectifMensuel*100)) : null;

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={()=>navigate('dashboard')}>← Retour</button>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-secondary" onClick={handlePrint} style={{fontSize:12,padding:'6px 14px'}}>🖨️ PDF</button>
          <button className="btn-primary" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={()=>navigate('enregistrer',eleve)}>+ Récitation</button>
        </div>
      </div>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {/* Hero */}
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.5rem',marginBottom:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
              <Avatar prenom={eleve.prenom} nom={eleve.nom} size={60} bg={sl.bg} color={sl.color}/>
              <div style={{flex:1}}>
                <div style={{fontSize:20,fontWeight:700}}>{eleve.prenom} {eleve.nom}</div>
                <div style={{fontSize:13,color:'#888'}}>{eleve.niveau} · {instituteurNom}</div>
                <div style={{display:'flex',gap:6,marginTop:4,flexWrap:'wrap'}}>
                  <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:500,background:sl.bg,color:sl.color}}>{sl.label}</span>
                  {streak>0&&<span style={{padding:'2px 10px',borderRadius:20,fontSize:11,background:'#E6F1FB',color:'#0C447C'}}>🔥 {streak} sem.</span>}
                  {vitesse.moyenne>0&&<span style={{padding:'2px 10px',borderRadius:20,fontSize:11,background:'#f5f5f0',color:'#666'}}>{vitesse.tendance==='hausse'?'📈':vitesse.tendance==='baisse'?'📉':'➡️'} {vitesse.moyenne}T/sem</span>}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:38,fontWeight:800,color:sl.color,letterSpacing:'-2px'}}>{etat?.points.total.toLocaleString()}</div>
                <div style={{fontSize:11,color:'#888'}}>points</div>
              </div>
            </div>

            {/* Points */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
              {[['Tomon',etat?.points.ptsTomon,`${etat?.tomonCumul}×10`],['Roboe',etat?.points.ptsRoboe,`${etat?.points.details.nbRoboe}×25`],['Nisf',etat?.points.ptsNisf,`${etat?.points.details.nbNisf}×60`],['Hizb',etat?.points.ptsHizb,`${etat?.points.details.nbHizb}×100`]].map(([l,v,s])=>(
                <div key={l} style={{background:'#f9f9f6',borderRadius:8,padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:700,color:'#1a1a1a'}}>{v}</div>
                  <div style={{fontSize:11,color:'#888'}}>{l}</div>
                  <div style={{fontSize:10,color:'#bbb'}}>{s}</div>
                </div>
              ))}
            </div>

            {/* KPI */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,borderTop:'0.5px solid #e8e8e0',paddingTop:12}}>
              {[['Hizb en cours',`Hizb ${etat?.hizbEnCours}`],['Tomon/Hizb',`${etat?.tomonDansHizbActuel}/8`],['Hizb complets',etat?.hizbsComplets.size],['Total Tomon',etat?.tomonCumul]].map(([l,v])=>(
                <div key={l}><div style={{fontSize:10,color:'#999',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:500}}>{v}</div></div>
              ))}
            </div>
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div style={{marginBottom:'1rem'}}>
              <div className="section-label">Badges obtenus</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {badges.map(b=>(
                  <div key={b.id} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:b.bg,border:`0.5px solid ${b.color}30`,borderRadius:20}}>
                    <span style={{fontSize:16}}>{b.icon}</span>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:b.color}}>{b.label}</div>
                      <div style={{fontSize:10,color:b.color,opacity:0.8}}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Objectif mensuel */}
          {user.role==='surveillant' && (
            <div className="card" style={{marginBottom:'1rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:500}}>Objectif mensuel</div>
                <button className="action-btn" onClick={()=>setEditObjectif(!editObjectif)}>{editObjectif?'Annuler':'Définir'}</button>
              </div>
              {editObjectif?(
                <div style={{display:'flex',gap:8}}>
                  <input className="field-input" type="number" min="1" max="80" placeholder="Nb Tomon par mois" value={newObjectif} onChange={e=>setNewObjectif(e.target.value)} style={{flex:1}}/>
                  <button className="btn-primary" style={{width:'auto',padding:'8px 14px',fontSize:12}} onClick={()=>{setObjectifMensuel(parseInt(newObjectif)||null);setEditObjectif(false);}}>✓</button>
                </div>
              ):(
                objectifMensuel?(
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:6}}>
                      <span>Ce mois : {tomonCeMois} / {objectifMensuel} Tomon</span>
                      <span style={{fontWeight:600,color:pctObjectif>=100?'#1D9E75':pctObjectif>=60?'#EF9F27':'#E24B4A'}}>{pctObjectif}%</span>
                    </div>
                    <div style={{height:8,background:'#e8e8e0',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pctObjectif}%`,background:pctObjectif>=100?'#1D9E75':pctObjectif>=60?'#EF9F27':'#E24B4A',borderRadius:4,transition:'width 0.5s'}}/>
                    </div>
                    {pctObjectif>=100&&<div style={{fontSize:12,color:'#1D9E75',marginTop:6}}>🎯 Objectif atteint !</div>}
                  </div>
                ):<div style={{fontSize:12,color:'#bbb'}}>Aucun objectif défini pour ce mois.</div>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="tabs-row" style={{marginBottom:'1rem'}}>
            {[['apercu','Aperçu'],['graphique','Évolution'],['activite','Activité'],['historique','Historique']].map(([k,l])=>(
              <div key={k} className={`tab ${onglet===k?'active':''}`} onClick={()=>setOnglet(k)}>{l}</div>
            ))}
          </div>

          {/* Aperçu */}
          {onglet==='apercu' && (
            <>
              <div className="position-card">
                <div className="pos-block"><div className="pos-val">{etat?.hizbEnCours}</div><div className="pos-lbl">Hizb en cours</div></div>
                <div className="pos-block"><div className="pos-val">{etat?.tomonDansHizbActuel}/8</div><div className="pos-lbl">Tomon</div></div>
                <div className="pos-block">
                  <div className="pos-val" style={{fontSize:14}}>{etat?.enAttenteHizbComplet?'⏳ Hizb complet':etat?.prochainTomon?`T.${etat.prochainTomon} prochain`:'✓'}</div>
                  <div className="pos-lbl">Statut</div>
                </div>
              </div>
              <div className="card">
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:8}}>
                  <span>Hizb {etat?.hizbEnCours}</span><span style={{fontWeight:500}}>{etat?.tomonDansHizbActuel}/8</span>
                </div>
                <div style={{display:'flex',gap:4,marginBottom:8}}>
                  {[1,2,3,4,5,6,7,8].map(n=>(
                    <div key={n} style={{flex:1,height:14,borderRadius:4,background:n<=(etat?.tomonDansHizbActuel||0)?(etat?.enAttenteHizbComplet?'#EF9F27':'#1D9E75'):'#e8e8e0',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {n<=(etat?.tomonDansHizbActuel||0)&&<span style={{fontSize:9,color:'#fff'}}>✓</span>}
                    </div>
                  ))}
                </div>
                {etat?.enAttenteHizbComplet&&<div style={{padding:'8px 12px',background:'#FAEEDA',borderRadius:8,fontSize:12,color:'#633806'}}>Les 8 Tomon sont validés — validation Hizb {etat?.hizbEnCours} complet requise.</div>}
              </div>
              <div className="card">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                  <div><div style={{fontSize:10,color:'#999',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:2}}>Départ</div><div style={{fontSize:13}}>Hizb {eleve.hizb_depart}, T.{eleve.tomon_depart}</div></div>
                  <div><div style={{fontSize:10,color:'#999',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:2}}>Dernière récitation</div><div style={{fontSize:13}}>{derniere?formatDate(derniere):'Jamais'}</div></div>
                  <div><div style={{fontSize:10,color:'#999',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:2}}>Nb récitations</div><div style={{fontSize:13}}>{validations.length}</div></div>
                </div>
              </div>
            </>
          )}

          {/* Graphique */}
          {onglet==='graphique' && (
            <div className="card">
              <div style={{fontSize:13,fontWeight:500,marginBottom:'1rem'}}>Évolution du score</div>
              {evolution.length<2?<div className="empty">Pas encore assez de données.</div>:(
                <div style={{position:'relative',height:200}}>
                  {[0,25,50,75,100].map(pct=>(
                    <div key={pct} style={{position:'absolute',left:0,right:0,top:`${100-pct}%`,borderTop:'0.5px solid #e8e8e0'}}>
                      <span style={{fontSize:9,color:'#bbb',marginLeft:2}}>{Math.round(maxScore*pct/100)}</span>
                    </div>
                  ))}
                  <svg style={{position:'absolute',left:36,top:0,width:'calc(100% - 36px)',height:'90%'}}>
                    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1D9E75" stopOpacity="0.3"/><stop offset="100%" stopColor="#1D9E75" stopOpacity="0.02"/></linearGradient></defs>
                    {(()=>{
                      const w=100/(evolution.length-1);
                      const pts=evolution.map((p,i)=>`${i*w}%,${100-(p.score/maxScore)*90}%`).join(' ');
                      const area=`0%,100% ${pts} 100%,100%`;
                      return(<>
                        <polygon points={area} fill="url(#g)"/>
                        <polyline points={pts} fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinejoin="round"/>
                        {evolution.map((p,i)=><circle key={i} cx={`${i*w}%`} cy={`${100-(p.score/maxScore)*90}%`} r="3" fill="#1D9E75"/>)}
                      </>);
                    })()}
                  </svg>
                  <div style={{position:'absolute',bottom:0,left:36,right:0,display:'flex',justifyContent:'space-between'}}>
                    {[evolution[0],evolution[Math.floor(evolution.length/2)],evolution[evolution.length-1]].map((p,i)=>(
                      <span key={i} style={{fontSize:9,color:'#bbb'}}>{p?.label||'Départ'}</span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{marginTop:12,display:'flex',gap:16,fontSize:12,color:'#888',flexWrap:'wrap'}}>
                <span>Score : <strong style={{color:'#1D9E75'}}>{etat?.points.total.toLocaleString()} pts</strong></span>
                <span>Vitesse : <strong style={{color:vitesse.tendance==='hausse'?'#1D9E75':vitesse.tendance==='baisse'?'#E24B4A':'#888'}}>{vitesse.moyenne} T/sem {vitesse.tendance==='hausse'?'📈':vitesse.tendance==='baisse'?'📉':'➡️'}</strong></span>
              </div>
            </div>
          )}

          {/* Activité heatmap */}
          {onglet==='activite' && (
            <>
              <div className="card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:500}}>Activité — 90 derniers jours</div>
                  <div style={{display:'flex',gap:3,alignItems:'center',fontSize:10,color:'#888'}}>
                    <span>Faible</span>
                    {['#e8e8e0','#9FE1CB','#5DCAA5','#1D9E75','#085041'].map(c=><div key={c} style={{width:10,height:10,borderRadius:2,background:c}}/>)}
                    <span>Fort</span>
                  </div>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {last90.map(day=>(
                    <div key={day} title={`${day}: ${heatmap[day]||0} Tomon`}
                      style={{width:12,height:12,borderRadius:2,background:heatColor(heatmap[day]||0)}}/>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
                {[
                  {lbl:'Streak actuel',val:`${streak} sem.`,icon:'🔥',color:'#EF9F27',bg:'#FAEEDA'},
                  {lbl:'Jours actifs (90j)',val:Object.keys(heatmap).filter(d=>{const p=d.split('/');return(new Date()-new Date(p[2],p[1]-1,p[0]))/(1000*60*60*24)<=90;}).length,icon:'📅',color:'#1D9E75',bg:'#E1F5EE'},
                  {lbl:'Moy/séance',val:validations.filter(v=>v.type_validation==='tomon').length>0?(etat?.tomonCumul/validations.filter(v=>v.type_validation==='tomon').length).toFixed(1):'0',icon:'📊',color:'#378ADD',bg:'#E6F1FB'},
                ].map(s=>(
                  <div key={s.lbl} style={{background:s.bg,borderRadius:12,padding:'1rem',textAlign:'center'}}>
                    <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                    <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.val}</div>
                    <div style={{fontSize:11,color:s.color,opacity:0.8}}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Historique */}
          {onglet==='historique' && (
            validations.length===0?<div className="empty">Aucune récitation.</div>:(
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th style={{width:'20%'}}>Date</th>
                    <th style={{width:'20%'}}>Type</th>
                    <th style={{width:'28%'}}>Détail</th>
                    <th style={{width:'14%'}}>Points</th>
                    <th style={{width:'18%'}}>Validé par</th>
                  </tr></thead>
                  <tbody>
                    {validations.map(v=>(
                      <tr key={v.id}>
                        <td style={{fontSize:12,color:'#888'}}>{formatDate(v.date_validation)}</td>
                        <td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb complet</span>:<span className="badge badge-blue">{v.nombre_tomon} Tomon</span>}</td>
                        <td style={{fontSize:12,color:'#888'}}>
                          {v.type_validation==='hizb_complet'
                            ?`Hizb ${v.hizb_valide} validé`
                            :v.tomon_debut?`T.${v.tomon_debut}→T.${v.tomon_debut+v.nombre_tomon-1} · Hizb ${v.hizb_validation||'—'}`:`${v.nombre_tomon} Tomon`}
                        </td>
                        <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{v.type_validation==='hizb_complet'?100:v.nombre_tomon*10} pts</span></td>
                        <td style={{fontSize:12,color:'#888'}}>{v.valideur?`${v.valideur.prenom} ${v.valideur.nom}`:'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
