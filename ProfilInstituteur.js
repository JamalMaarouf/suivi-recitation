import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales, scoreLabel, formatDate, formatDateCourt } from '../lib/helpers';
import { t } from '../lib/i18n';
import { getSouratesForNiveau, isSourateNiveau } from '../lib/sourates';

function Avatar({ prenom, nom, size=44, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

function NiveauBadge({ code }) {
  const colors = { '5B':'#534AB7', '5A':'#378ADD', '2M':'#1D9E75' };
  const c = colors[code] || '#888';
  return <span style={{padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:c+'15',color:c,border:`0.5px solid ${c}30`}}>{code}</span>;
}

export default function FicheSourate({ eleve, user, navigate, goBack, lang='fr' }) {
  const [recitations, setRecitations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [instituteurNom, setInstituteurNom] = useState('—');
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState('progression');
  const [selectedSourate, setSelectedSourate] = useState(null);

  const [showAcquis, setShowAcquis] = useState(false);
  const codeNiveau = eleve.code_niveau || '5B';
  const souratesNiveau = getSouratesForNiveau(codeNiveau);
  // Order: 114 → 72 (start from shortest)
  const souratesOrdonnees = [...souratesNiveau].sort((a,b) => b.numero - a.numero);

  useEffect(() => { loadData(); }, [eleve.id]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: rd }, { data: sdb }] = await Promise.all([
      supabase.from('recitations_sourates').select('*, valideur:valide_par(prenom,nom)').eq('eleve_id', eleve.id).order('date_validation', { ascending: false }),
      supabase.from('sourates').select('*')
    ]);
    if (eleve.instituteur_referent_id) {
      const { data: inst, error: instErr } = await supabase.from('utilisateurs').select('prenom,nom').eq('id', eleve.instituteur_referent_id).single(); if(instErr) console.warn('inst not found');
      if (inst) setInstituteurNom(`${inst.prenom} ${inst.nom}`);
    }
    setRecitations(rd || []);
    setSouratesDB(sdb || []);
    setLoading(false);
  };

  // Match static sourate to DB id
  const getDbId = (numero) => souratesDB.find(s => s.numero === numero)?.id;

  // Get recitations for a specific sourate
  const getRecsSourate = (numero) => {
    const dbId = getDbId(numero);
    if (!dbId) return [];
    return recitations.filter(r => r.sourate_id === dbId);
  };

  const isComplete = (numero) => getRecsSourate(numero).some(r => r.type_recitation === 'complete');
  const getSequences = (numero) => getRecsSourate(numero).filter(r => r.type_recitation === 'sequence');

  // Stats globales
  const souratesCompletes = souratesOrdonnees.filter(s => isComplete(s.numero)).length;
  const souratesEnCours = souratesOrdonnees.filter(s => !isComplete(s.numero) && getSequences(s.numero).length > 0).length;
  const totalSequences = recitations.filter(r => r.type_recitation === 'sequence').length;
  const totalPoints = recitations.reduce((s,r) => s + (r.points||0), 0);

  // Acquis antérieurs points
  const souratesAcquises = parseInt(eleve.sourates_acquises)||0;
  const ptsAcquis = souratesAcquises * 30;
  const ptsSuivi = totalPoints;
  const ptsTotal = ptsAcquis + ptsSuivi;

  const sl = scoreLabel(ptsTotal);
  const pctProgression = souratesOrdonnees.length > 0
    ? Math.round((souratesCompletes + souratesAcquises) / souratesOrdonnees.length * 100)
    : 0;

  const handlePrint = () => {
    const w = window.open('', '', 'width=800,height=900');
    if (!w) return;
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const dateLocale = lang==='ar'?'ar-MA':lang==='en'?'en-GB':'fr-FR';
    w.document.write(`<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head>
    <meta charset="UTF-8"><title>${eleve.prenom} ${eleve.nom}</title>
    <style>
      body{font-family:${lang==='ar'?"'Tajawal',Arial":"Arial"},sans-serif;color:#1a1a1a;padding:30px;direction:${dir}}
      h1{font-size:22px;color:#085041}h2{font-size:14px;margin:20px 0 10px;border-bottom:2px solid #1D9E75;padding-bottom:6px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
      .box{border:1px solid #e0e0d8;border-radius:8px;padding:12px;text-align:center}
      .box-title{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:4px}
      .box-val{font-size:20px;font-weight:700;color:#1D9E75}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f9f9f6;text-align:${lang==='ar'?'right':'left'};padding:8px;border-bottom:1px solid #e0e0d8;font-size:10px;text-transform:uppercase}
      td{padding:8px;border-bottom:1px solid #f0f0ec;text-align:${lang==='ar'?'right':'left'}}
      .complete{color:#EF9F27;font-weight:600}.seq{color:#1D9E75}.pts{color:#1D9E75;font-weight:600}
      .surah-name{font-family:'Amiri','Traditional Arabic',serif;font-size:14px}
    </style></head><body>
    <h1>${eleve.prenom} ${eleve.nom}</h1>
    <p style="color:#888;font-size:13px">${codeNiveau} · ${instituteurNom}${eleve.eleve_id_ecole ? ' · #'+eleve.eleve_id_ecole : ''}</p>
    <div class="grid">
      <div class="box"><div class="box-title">${lang==='ar'?'المجموع':lang==='en'?'Total score':'Score total'}</div><div class="box-val">${ptsTotal.toLocaleString()} ${lang==='ar'?'ن':'pts'}</div></div>
      <div class="box"><div class="box-title">${lang==='ar'?'سور مكتملة':lang==='en'?'Complete surahs':'Sourates complètes'}</div><div class="box-val">${souratesCompletes + souratesAcquises}/${souratesOrdonnees.length}</div></div>
      <div class="box"><div class="box-title">${lang==='ar'?'التقدم':lang==='en'?'Progress':'Progression'}</div><div class="box-val">${pctProgression}%</div></div>
    </div>
    ${souratesAcquises > 0 ? `<div style="background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:12px;margin-bottom:16px">
      <strong>🎓 ${lang==='ar'?'المكتسبات السابقة':lang==='en'?'Prior achievements':'Acquis antérieurs'} : ${souratesAcquises} ${lang==='ar'?'سورة':lang==='en'?'surahs':'sourates'} (+${ptsAcquis} ${lang==='ar'?'ن':'pts'})</strong>
    </div>` : ''}
    <h2>${lang==='ar'?'تفاصيل السور':lang==='en'?'Surah details':'Détail par sourate'}</h2>
    <table><thead><tr>
      <th>${lang==='ar'?'السورة':lang==='en'?'Surah':'Sourate'}</th>
      <th>${lang==='ar'?'الحالة':lang==='en'?'Status':'Statut'}</th>
      <th>${lang==='ar'?'المقاطع':lang==='en'?'Sequences':'Séquences'}</th>
      <th>${lang==='ar'?'النقاط':lang==='en'?'Points':'Points'}</th>
    </tr></thead><tbody>
    ${souratesOrdonnees.map(s => {
      const recs = getRecsSourate(s.numero);
      const comp = isComplete(s.numero);
      const seqs = getSequences(s.numero);
      const pts = recs.reduce((acc,r)=>acc+(r.points||0),0);
      return `<tr>
        <td class="surah-name">${s.nom_ar}</td>
        <td class="${comp?'complete':'seq'}">${comp?(lang==='ar'?'مكتملة':lang==='en'?'Complete':'Complète'):seqs.length>0?(lang==='ar'?'جارية':lang==='en'?'In progress':'En cours'):(lang==='ar'?'لم تبدأ':lang==='en'?'Not started':'Pas commencée')}</td>
        <td>${seqs.length}</td>
        <td class="pts">${pts > 0 ? '+'+pts : '—'}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
    <div style="margin-top:30px;font-size:11px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:12px">
      ${t(lang,'genere_le')} ${new Date().toLocaleDateString(dateLocale)} · ${t(lang,'app_name')}
    </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 600);
  };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={() => navigate('dashboard')}>{t(lang,'retour')}</button>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-secondary" onClick={handlePrint} style={{fontSize:12,padding:'6px 14px'}}>{t(lang,'imprimer_pdf')}</button>
          <button className="btn-primary" style={{width:'auto',padding:'6px 14px',fontSize:12}} onClick={() => navigate('enregistrer', eleve)}>
            {lang==='ar'?'+ تسميع':lang==='en'?'+ Recitation':'+ Récitation'}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.5rem',marginBottom:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
          <Avatar prenom={eleve.prenom} nom={eleve.nom} size={60} bg={sl.bg} color={sl.color}/>
          <div style={{flex:1}}>
            <div style={{fontSize:20,fontWeight:700}}>{eleve.prenom} {eleve.nom}</div>
            <div style={{display:'flex',gap:6,alignItems:'center',marginTop:4,flexWrap:'wrap'}}>
              <NiveauBadge code={codeNiveau}/>
              <span style={{fontSize:13,color:'#888'}}>{instituteurNom}</span>
              {eleve.eleve_id_ecole && <span style={{fontSize:12,color:'#bbb'}}>#{eleve.eleve_id_ecole}</span>}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:38,fontWeight:800,color:sl.color,letterSpacing:'-2px'}}>{ptsTotal.toLocaleString()}</div>
            <div style={{fontSize:11,color:'#888'}}>{t(lang,'pts_abrev')}</div>
          </div>
        </div>

        {/* Progression bar */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#888',marginBottom:6}}>
            <span>{lang==='ar'?'التقدم العام':lang==='en'?'Overall progress':'Progression globale'}</span>
            <span style={{fontWeight:700,color:'#1D9E75'}}>{souratesCompletes + souratesAcquises}/{souratesOrdonnees.length} {lang==='ar'?'سورة':lang==='en'?'surahs':'sourates'} ({pctProgression}%)</span>
          </div>
          <div style={{height:10,background:'#e8e8e0',borderRadius:5,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pctProgression}%`,background:'linear-gradient(90deg,#1D9E75,#5DCAA5)',borderRadius:5,transition:'width 0.5s'}}/>
          </div>
        </div>

        {/* KPI */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {[
            {l:lang==='ar'?'مكتملة':lang==='en'?'Complete':'Complètes', v:souratesCompletes+souratesAcquises, c:'#EF9F27', bg:'#FAEEDA'},
            {l:lang==='ar'?'جارية':lang==='en'?'In progress':'En cours', v:souratesEnCours, c:'#1D9E75', bg:'#E1F5EE'},
            {l:lang==='ar'?'مقاطع':lang==='en'?'Sequences':'Séquences', v:totalSequences, c:'#378ADD', bg:'#E6F1FB'},
            {l:lang==='ar'?'منذ المتابعة':lang==='en'?'Since tracking':'Depuis suivi', v:`+${ptsSuivi}`, c:'#534AB7', bg:'#EEEDFE'},
          ].map(k=>(
            <div key={k.l} style={{background:k.bg,borderRadius:8,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:700,color:k.c}}>{k.v}</div>
              <div style={{fontSize:10,color:k.c,opacity:0.8}}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Acquis antérieurs — bouton accordéon cliquable */}
        {souratesAcquises > 0 && (
          <div style={{marginTop:10}}>
            <button onClick={()=>setShowAcquis(v=>!v)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'10px 14px',border:`1.5px solid ${showAcquis?'#1D9E75':'#9FE1CB'}`,borderRadius:showAcquis?'10px 10px 0 0':'10px',background:showAcquis?'#E1F5EE':'#f0faf6',cursor:'pointer',transition:'all 0.2s'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:18}}>🎓</span>
                <div style={{textAlign:'left'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#085041'}}>{lang==='ar'?'المكتسبات السابقة':lang==='en'?'Prior achievements':'Acquis antérieurs'}</div>
                  <div style={{fontSize:11,color:'#0F6E56'}}>{souratesAcquises} {lang==='ar'?'سورة محفوظة':lang==='en'?'surahs':'sourates'} · <strong>+{ptsAcquis} {t(lang,'pts_abrev')}</strong></div>
                </div>
              </div>
              <span style={{fontSize:16,color:'#1D9E75',fontWeight:700,display:'inline-block',transform:showAcquis?'rotate(180deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▼</span>
            </button>
            {showAcquis && (
              <div style={{background:'#f0faf6',border:'1.5px solid #1D9E75',borderTop:'none',borderRadius:'0 0 10px 10px',padding:'1rem'}}>
                <div style={{fontSize:11,color:'#085041',fontWeight:600,marginBottom:8}}>
                  {lang==='ar'?'السور المحفوظة قبل بدء المتابعة':lang==='en'?'Surahs memorized before tracking':'Sourates mémorisées avant le suivi'}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:12}}>
                  {souratesOrdonnees.slice(0, souratesAcquises).map(s=>(
                    <div key={s.numero} style={{padding:'4px 10px',background:'#fff',borderRadius:20,border:'0.5px solid #9FE1CB',fontSize:13,fontFamily:"'Tajawal',Arial",direction:'rtl',display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:10,color:'#bbb'}}>{s.numero}</span>
                      <span style={{color:'#085041',fontWeight:500}}>{s.nom_ar}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                  <div style={{background:'#E1F5EE',borderRadius:8,padding:'8px',textAlign:'center',border:'0.5px solid #9FE1CB'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#1D9E75'}}>+{ptsAcquis} {t(lang,'pts_abrev')}</div>
                    <div style={{fontSize:10,color:'#0F6E56'}}>{lang==='ar'?'نقاط المكتسبات':lang==='en'?'Prior points':'Points antérieurs'}</div>
                  </div>
                  <div style={{background:'#E6F1FB',borderRadius:8,padding:'8px',textAlign:'center',border:'0.5px solid #85B7EB'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#378ADD'}}>+{ptsSuivi} {t(lang,'pts_abrev')}</div>
                    <div style={{fontSize:10,color:'#0C447C'}}>{lang==='ar'?'منذ المتابعة':lang==='en'?'Since tracking':'Depuis le suivi'}</div>
                  </div>
                  <div style={{background:'#085041',borderRadius:8,padding:'8px',textAlign:'center'}}>
                    <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>{ptsTotal} {t(lang,'pts_abrev')}</div>
                    <div style={{fontSize:10,color:'#9FE1CB'}}>{t(lang,'score_total')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-row" style={{marginBottom:'1rem'}}>
        {[
          ['progression', lang==='ar'?'التقدم':lang==='en'?'Progress':'Progression'],
          ['historique', t(lang,'historique')],
        ].map(([k,l])=>(
          <div key={k} className={`tab ${onglet===k?'active':''}`} onClick={()=>{setOnglet(k);setSelectedSourate(null);}}>{l}</div>
        ))}
      </div>

      {loading ? <div className="loading">...</div> : (
        <>
          {/* PROGRESSION */}
          {onglet === 'progression' && (
            <>
              {selectedSourate ? (
                // Détail d'une sourate
                <div>
                  <button className="back-link" onClick={()=>setSelectedSourate(null)}>{t(lang,'retour')}</button>
                  <div style={{textAlign:'center',padding:'1.25rem',background:'linear-gradient(135deg,#085041,#1D9E75)',borderRadius:16,marginBottom:'1.25rem',color:'#fff'}}>
                    <div style={{fontSize:26,fontWeight:800,fontFamily:"'Amiri','Traditional Arabic',serif",direction:'rtl'}}>{selectedSourate.nom_ar}</div>
                    <div style={{fontSize:12,opacity:0.7,marginTop:4}}>Sourate {selectedSourate.numero}</div>
                    <div style={{fontSize:13,marginTop:6}}>
                      {isComplete(selectedSourate.numero)
                        ? '✓ '+(lang==='ar'?'مكتملة':lang==='en'?'Complete':'Complète')
                        : `${getSequences(selectedSourate.numero).length} ${lang==='ar'?'مقطع':lang==='en'?'seq.':'séq.'}`}
                    </div>
                  </div>

                  {/* Sequences detail */}
                  <div className="section-label">{lang==='ar'?'المقاطع المسجلة':lang==='en'?'Recorded sequences':'Séquences enregistrées'}</div>
                  {getRecsSourate(selectedSourate.numero).length === 0
                    ? <div className="empty">{lang==='ar'?'لا يوجد تسميع بعد':lang==='en'?'No recitation yet':'Aucune récitation encore'}</div>
                    : (
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {getRecsSourate(selectedSourate.numero).map((r,idx)=>(
                          <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'#fff',border:`0.5px solid ${r.type_recitation==='complete'?'#EF9F27':'#e0e0d8'}`,borderRadius:12}}>
                            <span style={{fontSize:20}}>{r.type_recitation==='complete'?'🎉':'📍'}</span>
                            <div style={{flex:1}}>
                              {r.type_recitation==='complete'
                                ? <span className="badge badge-green">{lang==='ar'?'سورة كاملة':lang==='en'?'Full surah':'Sourate complète'}</span>
                                : <div>
                                    <span className="badge badge-blue">
                                      {lang==='ar'?'مقطع':lang==='en'?'Seq.':'Séq.'} {idx+1} — {lang==='ar'?'من الآية':lang==='en'?'V.':'V.'}{r.verset_debut} {lang==='ar'?'إلى':'→'} {lang==='ar'?'الآية':'V.'}{r.verset_fin}
                                    </span>
                                    <div style={{fontSize:11,color:'#bbb',marginTop:2}}>
                                      {lang==='ar'?`${r.verset_fin - r.verset_debut + 1} آية`:`${r.verset_fin - r.verset_debut + 1} ${lang==='en'?'verses':'versets'}`}
                                    </div>
                                  </div>}
                              <div style={{fontSize:11,color:'#bbb',marginTop:2}}>
                                {formatDate(r.date_validation)}{r.valideur?` · ${r.valideur.prenom} ${r.valideur.nom}`:''}
                              </div>
                            </div>
                            <span style={{fontSize:13,fontWeight:700,color:r.type_recitation==='complete'?'#EF9F27':'#1D9E75'}}>+{r.points} {t(lang,'pts_abrev')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  <button className="btn-primary" style={{marginTop:'1rem'}} onClick={()=>navigate('enregistrer',eleve)}>
                    {lang==='ar'?'+ تسميع جديد':lang==='en'?'+ New recitation':'+ Nouvelle récitation'}
                  </button>
                </div>
              ) : (
                // Liste de toutes les sourates
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {souratesOrdonnees.map((s,idx) => {
                    const recs = getRecsSourate(s.numero);
                    const comp = isComplete(s.numero);
                    const seqs = getSequences(s.numero);
                    const pts = recs.reduce((acc,r)=>acc+(r.points||0),0);
                    // Acquis = FIRST N (indices 0 to N-1), list is 114→78 descending
                    const isAcquis = idx < souratesAcquises;
                    return (
                      <div key={s.numero} onClick={()=>!isAcquis&&setSelectedSourate(s)}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                          background:isAcquis?'#f5f5f0':comp?'#FAEEDA':'#fff',
                          border:`0.5px solid ${isAcquis?'#e0e0d8':comp?'#EF9F27':seqs.length>0?'#9FE1CB':'#e0e0d8'}`,
                          borderRadius:12,cursor:isAcquis?'default':'pointer',opacity:isAcquis?0.7:1}}>
                        {/* Status icon */}
                        <div style={{width:36,height:36,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                          background:isAcquis?'#e0e0d8':comp?'#EF9F27':seqs.length>0?'#E1F5EE':'#f0f0ec',
                          fontSize:isAcquis||comp?16:12,fontWeight:700,
                          color:isAcquis?'#bbb':comp?'#fff':seqs.length>0?'#1D9E75':'#999'}}>
                          {isAcquis?'✓':comp?'✓':seqs.length>0?seqs.length:s.numero}
                        </div>
                        {/* Sourate name */}
                        <div style={{flex:1}}>
                          <div style={{fontSize:16,fontWeight:600,fontFamily:"'Amiri','Traditional Arabic',serif",direction:'rtl',textAlign:'right',
                            color:isAcquis?'#bbb':comp?'#412402':'#1a1a1a'}}>
                            {s.nom_ar}
                          </div>
                          <div style={{fontSize:11,color:'#888',marginTop:1}}>
                            {isAcquis
                              ? (lang==='ar'?'مكتسب سابق':lang==='en'?'Prior achievement':'Acquis antérieur')
                              : comp
                              ? `✓ ${lang==='ar'?'مكتملة':lang==='en'?'Complete':'Complète'} · ${seqs.length} ${lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'}`
                              : seqs.length > 0
                              ? `${seqs.length} ${lang==='ar'?'مقطع':lang==='en'?'seq.':'séq.'} — ${lang==='ar'?'جارية':lang==='en'?'in progress':'en cours'}`
                              : lang==='ar'?'لم تبدأ بعد':lang==='en'?'Not started':'Pas encore commencée'}
                          </div>
                          {/* Sequences mini-preview */}
                          {seqs.length > 0 && !comp && (
                            <div style={{display:'flex',gap:3,marginTop:4,flexWrap:'wrap'}}>
                              {seqs.map((sq,i)=>(
                                <span key={i} style={{fontSize:10,background:'#E1F5EE',color:'#085041',padding:'1px 6px',borderRadius:10}}>
                                  V.{sq.verset_debut}→{sq.verset_fin}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {pts > 0 && <div style={{fontSize:12,fontWeight:700,color:comp?'#EF9F27':'#1D9E75'}}>+{pts} {t(lang,'pts_abrev')}</div>}
                        {!isAcquis && <div style={{color:'#bbb',fontSize:16}}>›</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* HISTORIQUE */}
          {onglet === 'historique' && (
            recitations.length === 0
              ? <div className="empty">{t(lang,'aucune_recitation_label')}</div>
              : (
                <div className="table-wrap">
                  <table><thead><tr>
                    <th style={{width:'18%'}}>{t(lang,'date_heure')}</th>
                    <th style={{width:'28%'}}>{lang==='ar'?'السورة':lang==='en'?'Surah':'Sourate'}</th>
                    <th style={{width:'30%'}}>{lang==='ar'?'التفاصيل':lang==='en'?'Details':'Détails'}</th>
                    <th style={{width:'12%'}}>{t(lang,'pts_abrev')}</th>
                    <th style={{width:'12%'}}>{t(lang,'valide_par')}</th>
                  </tr></thead>
                  <tbody>
                    {recitations.map(r => {
                      const sourate = souratesDB.find(s => s.id === r.sourate_id);
                      return (
                        <tr key={r.id}>
                          <td style={{fontSize:12,color:'#888'}}>{formatDateCourt(r.date_validation)}</td>
                          <td style={{fontSize:14,fontFamily:"'Amiri','Traditional Arabic',serif",direction:'rtl',textAlign:'right'}}>{sourate?.nom_ar||'—'}</td>
                          <td>
                            {r.type_recitation==='complete'
                              ?<span className="badge badge-green">{lang==='ar'?'سورة كاملة':lang==='en'?'Complete':'Complète'}</span>
                              :<span className="badge badge-blue">V.{r.verset_debut} → V.{r.verset_fin} <span style={{opacity:0.7}}>({r.verset_fin-r.verset_debut+1} {lang==='ar'?'آية':lang==='en'?'v.':'v.'})</span></span>}
                          </td>
                          <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{r.points} {t(lang,'pts_abrev')}</span></td>
                          <td style={{fontSize:12,color:'#888'}}>{r.valideur?`${r.valideur.prenom} ${r.valideur.nom}`:'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody></table>
                </div>
              )
          )}
        </>
      )}
    </div>
  );
}
