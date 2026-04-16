import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales, scoreLabel, loadBareme, verifierEtCreerCertificats } from '../lib/helpers';
import { t } from '../lib/i18n';
import { getSouratesForNiveau, isSourateNiveau } from '../lib/sourates';
import { useToast } from '../lib/toast';

function Avatar({ prenom, nom, size=36, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

function NiveauBadge({ code }) {
  const colors = { '5B':'#534AB7', '5A':'#378ADD', '2M':'#1D9E75' };
  const c = colors[code] || '#888';
  return <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:c+'15',color:c,border:`0.5px solid ${c}30`}}>{code}</span>;
}

// Exception modal — surveillant picks which sourates to unlock
function ExceptionModal({ sourates, recitations, souratesDB, onConfirm, onCancel, lang }) {
  const [selected, setSelected] = useState([]);

  const toggle = (numero) => {
    setSelected(prev => prev.includes(numero) ? prev.filter(n=>n!==numero) : [...prev, numero]);
  };

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',maxWidth:500,width:'100%',maxHeight:'80vh',overflow:'auto'}}>
        <div style={{fontSize:16,fontWeight:700,color:'#A32D2D',marginBottom:4}}>🔓 {lang==='ar'?'فتح استثنائي':lang==='en'?'Exceptional unlock':'Déverrouillage exceptionnel'}</div>
        <div style={{fontSize:12,color:'#888',marginBottom:'1rem'}}>
          {lang==='ar'?'اختر السور التي تريد فتحها استثنائياً. هذا الإجراء مسجّل.':lang==='en'?'Select surahs to unlock. This action is logged.':'Sélectionnez les sourates à débloquer. Cette action est enregistrée.'}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:'1rem'}}>
          {sourates.map(s => {
            const isSelected = selected.includes(s.numero);
            return (
              <div key={s.numero} onClick={()=>toggle(s.numero)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',border:`1.5px solid ${isSelected?'#E24B4A':'#e0e0d8'}`,borderRadius:10,cursor:'pointer',background:isSelected?'#FCEBEB':'#fff',transition:'all 0.15s'}}>
                <div style={{width:20,height:20,borderRadius:4,border:`1.5px solid ${isSelected?'#E24B4A':'#bbb'}`,background:isSelected?'#E24B4A':'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {isSelected&&<span style={{color:'#fff',fontSize:11}}>✓</span>}
                </div>
                <span style={{fontSize:14,fontFamily:"'Tajawal',Arial,sans-serif",direction:'rtl'}}>{s.nom_ar}</span>
                <span style={{fontSize:11,color:'#bbb',marginLeft:'auto'}}>S.{s.numero}</span>
              </div>
            );
          })}
        </div>

        {selected.length > 0 && (
          <div style={{padding:'10px',background:'#FCEBEB',borderRadius:8,fontSize:12,color:'#A32D2D',marginBottom:'1rem'}}>
            ⚠️ {selected.length} {lang==='ar'?'سورة ستُفتح':lang==='en'?'surah(s) will be unlocked':'sourate(s) seront débloquées'}
          </div>
        )}

        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>selected.length>0&&onConfirm(selected)} disabled={selected.length===0}
            style={{flex:1,padding:'10px',background:selected.length>0?'#E24B4A':'#f0f0ec',color:selected.length>0?'#fff':'#bbb',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:selected.length>0?'pointer':'default'}}>
            {lang==='ar'?'تأكيد الفتح':lang==='en'?'Confirm unlock':'Confirmer le déblocage'}
          </button>
          <button onClick={onCancel} style={{flex:1,padding:'10px',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:13,cursor:'pointer',background:'#fff'}}>
            {t(lang,'annuler')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecitationSourate({ user, eleve, navigate, goBack, lang='fr', isMobile=false }) {
  const { toast } = useToast();
  const [souratesDB, setSouratesDB] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [exceptions, setExceptions] = useState([]); // unlocked sourates
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('liste');
  const [selectedSourate, setSelectedSourate] = useState(null);
  const [typeRecitation, setTypeRecitation] = useState('sequence');
  const [versetDebut, setVersetDebut] = useState('');
  const [versetFin, setVersetFin] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  const [bareme, setBareme] = useState(null);
  const [showExceptionModal, setShowExceptionModal] = useState(false);

  const codeNiveau = eleve.code_niveau || '5B';
  const souratesNiveau = getSouratesForNiveau(codeNiveau);
  // Order: 114 first → descending (start from shortest)
  const souratesOrdonnees = [...souratesNiveau].sort((a,b) => b.numero - a.numero);
  const isPrivilegied = user.role === 'surveillant';

  useEffect(() => {
    loadData();
    loadBareme(supabase, user.ecole_id).then(b => setBareme(b));
  }, [eleve.id]);

  // Auto-select current sourate when arriving from outside (e.g. from FicheSourate)
  useEffect(() => {
    if (!loading && currentSourate && !selectedSourate && step === 'liste') {
      // Don't auto-navigate, let user see the list first
      // But highlight the current sourate clearly
    }
  }, [loading]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: sdb }, { data: rd }] = await Promise.all([
      supabase.from('sourates').select('*'),
      supabase.from('recitations_sourates').select('*, valideur:valide_par(prenom,nom)')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', eleve.id).order('date_validation', { ascending: false }),
    ]);
    // Safe load for exceptions (table may not exist)
    let ex = [];
    try {
      const { data: exData, error: exErr } = await supabase
        .from('exceptions_recitation').select('*').eq('eleve_id', eleve.id).eq('ecole_id', user.ecole_id).eq('active', true);
      if (!exErr) ex = exData || [];
    } catch(e) { /* table not yet created */ }
    const sdbData = sdb || [];
    const rdData = rd || [];
    const exData = ex || [];
    setSouratesDB(sdbData);
    setRecitations(rdData);
    setExceptions(exData);
    setLoading(false);
    
    // Auto-navigate to current sourate after loading
    // Only if we're still on liste (not already on a specific sourate)
    // Find the current sourate based on acquis and completions
    const souratesAcq = eleve.sourates_acquises || 0;
    const souratesNiv = getSouratesForNiveau(eleve.code_niveau || '5B');
    const souratesOrd = [...souratesNiv].sort((a,b) => b.numero - a.numero);
    
    const getDbIdLocal = (numero) => sdbData.find(s => s.numero === numero)?.id;
    const isCompleteLocal = (numero) => {
      const dbId = getDbIdLocal(numero);
      return dbId ? rdData.some(r => r.sourate_id === dbId && r.type_recitation === 'complete') : false;
    };
    
    const currentIdxLocal = souratesOrd.findIndex((sr, i) => {
      if (i < souratesAcq) return false;
      return !isCompleteLocal(sr.numero);
    });
    
    if (currentIdxLocal >= 0) {
      setSelectedSourate(souratesOrd[currentIdxLocal]);
      setStep('valider');
    }
  };

  const getDbId = (numero) => souratesDB.find(s => s.numero === numero)?.id;
  const getRecsSourate = (numero) => { const dbId = getDbId(numero); return dbId ? recitations.filter(r => r.sourate_id === dbId) : []; };
  const isComplete = (numero) => getRecsSourate(numero).some(r => r.type_recitation === 'complete');
  const getSequences = (numero) => getRecsSourate(numero).filter(r => r.type_recitation === 'sequence');
  const isUnlocked = (numero) => exceptions.some(e => e.sourate_numero === numero);

  // Progression logic: find current sourate
  // acquis antérieurs = first N sourates (from end of list)
  const souratesAcquises = eleve.sourates_acquises || 0;
  // Sourates accessible = after acquis
  // First accessible = index souratesAcquises in souratesOrdonnees
  const getSourateStatus = (s, idx) => {
    // Acquis antérieurs = FIRST N sourates (114→111 if N=4)
    // List is sorted descending: [114,113,112,111,110,109,...]
    // So acquis = indices 0 to N-1
    if (idx < souratesAcquises) return 'acquis';
    // If exception unlocked by surveillant
    if (isUnlocked(s.numero)) return 'unlocked';
    // Current sourate = first non-complete after acquis block
    // Find the first sourate at index >= souratesAcquises that is not complete
    const firstNonComplete = souratesOrdonnees.findIndex((sr, i) => {
      if (i < souratesAcquises) return false; // skip acquis
      return !isComplete(sr.numero);
    });
    if (firstNonComplete === -1) return 'complete'; // all done!
    if (idx === firstNonComplete) return 'current';
    // Already completed (between acquis and current)
    if (isComplete(s.numero)) return 'complete';
    // Locked (after current)
    return 'locked';
  };

  // Can the user access this sourate?
  const canAccess = (s, idx) => {
    const status = getSourateStatus(s, idx);
    // acquis = grisé, not clickable
    // locked = bloqué
    return ['current', 'complete', 'unlocked'].includes(status);
  };

  const ptsParSourate = bareme?.unites?.sourate||0;
  const totalPoints = recitations.reduce((s,r) => s + (r.points||0), 0) + (souratesAcquises * ptsParSourate);
  const souratesCompletes = souratesOrdonnees.filter(s => isComplete(s.numero)).length + souratesAcquises;
  // The current sourate index
  const currentIdx = souratesOrdonnees.findIndex((sr, i) => i >= souratesAcquises && !isComplete(sr.numero));
  const currentSourate = currentIdx >= 0 ? souratesOrdonnees[currentIdx] : null;
  const sl = scoreLabel(totalPoints);

  const confirmer = async () => {
    if (!selectedSourate || saving) return;
    if (typeRecitation === 'sequence') {
      if (!versetDebut || !versetFin) { toast.warning(lang==='ar'?'يجب تحديد الآيات':'Veuillez saisir les versets'); return; }
      if (parseInt(versetFin) < parseInt(versetDebut)) { toast.warning(lang==='ar'?'الآية الأخيرة يجب أن تكون أكبر':'Le verset de fin doit être supérieur'); return; }
    }
    setSaving(true);
    const pts = typeRecitation === 'complete' ? (bareme?.unites?.sourate||0) : (bareme?.unites?.sequence_sourate||0);
    const { error } = await supabase.from('recitations_sourates').insert({
      eleve_id: eleve.id,
      ecole_id: user.ecole_id,
      sourate_id: getDbId(selectedSourate.numero),
      type_recitation: typeRecitation,
      verset_debut: typeRecitation === 'sequence' ? parseInt(versetDebut) : null,
      verset_fin: typeRecitation === 'sequence' ? parseInt(versetFin) : null,
      valide_par: user.id,
      date_validation: new Date().toISOString(),
      points: pts
    });
    setSaving(false);
    if (!error) {
      setFlash({ msg: typeRecitation === 'complete'
        ? `🎉 ${selectedSourate.nom_ar} — ${lang==='ar'?'تمت التلاوة كاملة':lang==='en'?'Complete!':'Complète !'}`
        : `✅ ${lang==='ar'?'مقطع مسجل':lang==='en'?'Sequence recorded':'Séquence enregistrée'} V.${versetDebut}→V.${versetFin}`,
        pts, color: typeRecitation==='complete'?'#EF9F27':'#1D9E75'
      });
      setTimeout(() => setFlash(null), 3000);
      await loadData();
      // Vérifier si un jalon/certificat est débloqué
      if (typeRecitation === 'complete') {
        const { data: recsNouv } = await supabase.from('recitations_sourates').select('*').eq('eleve_id', eleve.id).eq('ecole_id', user.ecole_id);
        const { data: valsNouv } = await supabase.from('validations').select('*').eq('eleve_id', eleve.id).eq('ecole_id', user.ecole_id);
        const nouveauxCerts = await verifierEtCreerCertificats(supabase, {
          eleve, ecole_id: user.ecole_id, valide_par: user.id,
          validations: valsNouv || [], recitations: recsNouv || [],
        });
        if (nouveauxCerts.length > 0) {
          setTimeout(() => setFlash({
            msg: `🏅 ${nouveauxCerts.map(c=>c.nom_certificat_ar||c.nom_certificat).join(', ')} !`,
            pts: 0, color: '#EF9F27'
          }), 3100);
          setTimeout(() => setFlash(null), 7000);
        }
        setStep('liste'); setSelectedSourate(null);
      }
      setVersetDebut(''); setVersetFin('');
    }
  };

  const activerException = async (sourates) => {
    // Insert exception records
    const inserts = sourates.map(numero => ({
      eleve_id: eleve.id,
      ecole_id: user.ecole_id,
      sourate_numero: numero,
      active: true,
      cree_par: user.id,
      date_creation: new Date().toISOString()
    }));
    await supabase.from('exceptions_recitation').insert(inserts);
    setShowExceptionModal(false);
    await loadData();
  };

  const desactiverException = async (numero) => {
    await supabase.from('exceptions_recitation').update({ active: false }).eq('eleve_id', eleve.id).eq('sourate_numero', numero);
    await loadData();
  };

  if (isMobile) {
    const NIVEAU_COLORS_RS = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75'};
    const nc = NIVEAU_COLORS_RS[codeNiveau] || '#1D9E75';
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        {/* Flash notification */}
        {flash&&(
          <div style={{position:'fixed',top:16,left:16,right:16,zIndex:999,
            background:flash.color||'#1D9E75',borderRadius:14,padding:'14px 16px',
            textAlign:'center',color:'#fff',fontWeight:700,fontSize:16,
            boxShadow:'0 4px 16px rgba(0,0,0,0.2)'}}>
            {flash.msg}
          </div>
        )}
        {/* Header sticky */}
        <div style={{background:`linear-gradient(135deg,#085041,#1D9E75)`, position:'sticky', top:0, zIndex:100}}>
          <div style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px'}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#085041',padding:0,lineHeight:1}}>
              
            </button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800}}>{eleve.prenom} {eleve.nom}</div>
              <div style={{fontSize:12,color:'#888'}}>{codeNiveau} · {lang==='ar'?'استظهار السور':'Récitation des sourates'}</div>
            </div>
            {isPrivilegied && (
              <button onClick={()=>setShowExceptionModal(true)}
                style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,padding:'6px 10px',fontSize:12,cursor:'pointer'}}>
                🔓
              </button>
            )}
          </div>
          {/* Onglets */}
          <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3,margin:'0 16px 12px'}}>
            {[['liste',lang==='ar'?'السور':'Sourates'],['recap',lang==='ar'?'ملخص':'Résumé']].map(([k,l])=>(
              <div key={k} onClick={()=>setStep(k)}
                style={{flex:1,padding:'7px 8px',borderRadius:8,textAlign:'center',fontSize:12,fontWeight:600,
                  cursor:'pointer',background:(step||'liste')===k?'#fff':'transparent',color:(step||'liste')===k?'#085041':'#888'}}>
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Exception banner */}
        {exceptions.length > 0 && (
          <div style={{margin:'8px 12px',padding:'10px 14px',background:'#FCEBEB',borderRadius:10,fontSize:12,color:'#A32D2D'}}>
            🔓 {lang==='ar'?'استثناءات نشطة':'Exceptions actives'} ({exceptions.length})
          </div>
        )}

        {loading ? <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div> : (
          <div style={{padding:'12px'}}>
            {/* Liste sourates */}
            {step!=='recap' && (
              <div>
                <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:8}}>
                  {lang==='ar'?'السور المقررة':'Sourates du niveau'} ({souratesOrdonnees.length})
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {souratesOrdonnees.map((s, sIdx)=>{
                    const recs = recitations.filter(r=>r.sourate_id===s.id||getDbId(s.numero)===r.sourate_id);
                    const complete = recs.some(r=>r.type_recitation==='complete');
                    const sequences = recs.filter(r=>r.type_recitation==='sequence').length;
                    const accessible = canAccess(s, sIdx);
                    return(
                      <div key={s.numero}
                        onClick={()=>accessible&&setSelectedSourate(selectedSourate?.numero===s.numero?null:s)}
                        style={{background:'#fff',borderRadius:12,padding:'12px 10px',cursor:accessible?'pointer':'default',
                          border:complete?`2px solid ${nc}`:selectedSourate?.numero===s.numero?`1.5px solid ${nc}`:'0.5px solid #e0e0d8',
                          background:complete?`${nc}08`:!accessible?'#f9f9f6':'#fff',
                          opacity:accessible?1:0.5}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                          <span style={{fontSize:10,fontWeight:700,color:'#888'}}>#{s.numero}</span>
                          {complete&&<span style={{fontSize:12}}>✅</span>}
                          {!complete&&sequences>0&&<span style={{fontSize:10,color:nc,fontWeight:600}}>{sequences}s</span>}
                          {!accessible&&<span style={{fontSize:10}}>🔒</span>}
                        </div>
                        <div style={{fontSize:14,fontWeight:700,color:complete?nc:!accessible?'#aaa':'#1a1a1a',
                          fontFamily:"'Tajawal',Arial",direction:'rtl',textAlign:'right',marginBottom:2}}>
                          {s.nom_ar}
                        </div>
                        <div style={{fontSize:10,color:'#888'}}>{s.nom_fr||s.nom||''}</div>
                        {/* Validation buttons when selected */}
                        {selectedSourate?.numero===s.numero&&accessible&&(
                          <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
                            <div style={{width:'100%',height:1,background:'#e0e0d8'}}/>
                            {!complete&&(
                              <button onClick={async e=>{
                                  e.stopPropagation();
                                  setSelectedSourate(s);
                                  setTypeRecitation('complete');
                                  setSaving(true);
                                  const dbId = getDbId(s.numero);
                                  if (dbId) {
                                    const {error} = await supabase.from('recitations_sourates')
                                      .insert({eleve_id:eleve.id,ecole_id:user.ecole_id,sourate_id:dbId,
                                        type_recitation:'complete',points:bareme?.unites?.sourate||0,valide_par:user.id,
                                        date_validation:new Date().toISOString()});
                                    if (!error) { setFlash({msg:`✅ +${bareme?.unites?.sourate||0} pts`,color:'#1D9E75'}); setTimeout(()=>setFlash(null),2000); loadData(); }
                                  }
                                  setSaving(false); setSelectedSourate(null);
                                }}
                                style={{padding:'10px',background:nc,color:'#fff',border:'none',borderRadius:10,
                                  fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                                `✅ ${lang==='ar'?'استظهار كامل':'Complète'} (+${bareme?.unites?.sourate||0} pts)`
                              </button>
                            )}
                            <button onClick={async e=>{
                                e.stopPropagation();
                                setSaving(true);
                                const dbId = getDbId(s.numero);
                                if (dbId) {
                                  const {error} = await supabase.from('recitations_sourates')
                                    .insert({eleve_id:eleve.id,ecole_id:user.ecole_id,sourate_id:dbId,
                                      type_recitation:'sequence',points:bareme?.unites?.sequence_sourate||0,valide_par:user.id,
                                      date_validation:new Date().toISOString(),verset_debut:1,verset_fin:1});
                                  if (!error) { setFlash({msg:'📝 +10 pts',color:'#378ADD'}); setTimeout(()=>setFlash(null),2000); loadData(); }
                                }
                                setSaving(false);
                              }}
                              style={{padding:'10px',background:`${nc}20`,color:nc,border:`1px solid ${nc}30`,borderRadius:10,
                                fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                              📝 {lang==='ar'?'مقطع':'Séquence (+10pts)'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Récap */}
            {(step||'liste')==='recap' && (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                  {[
                    {label:lang==='ar'?'مكتملة':'Complètes',val:recitations.filter(r=>r.type_recitation==='complete').length,color:nc,bg:`${nc}15`},
                    {label:lang==='ar'?'مقاطع':'Séquences',val:recitations.filter(r=>r.type_recitation==='sequence').length,color:'#378ADD',bg:'#E6F1FB'},
                    {label:lang==='ar'?'النقاط':'Points',val:recitations.reduce((s,r)=>s+(r.type_recitation==='complete'?30:10),0),color:'#EF9F27',bg:'#FAEEDA'},
                  ].map((k,i)=>(
                    <div key={i} style={{background:k.bg,borderRadius:12,padding:'12px 8px',textAlign:'center',border:`0.5px solid ${k.color}20`}}>
                      <div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.val}</div>
                      <div style={{fontSize:10,color:k.color,marginTop:2,opacity:0.8}}>{k.label}</div>
                    </div>
                  ))}
                </div>
                {/* Recent activity */}
                <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:8}}>{lang==='ar'?'آخر الاستظهارات':'Récentes'}</div>
                {recitations.slice(0,15).map((r,i)=>{
                  const s = souratesDB.find(x=>x.id===r.sourate_id);
                  return(
                    <div key={i} style={{background:'#fff',borderRadius:10,padding:'10px 12px',marginBottom:6,
                      border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:16}}>{r.type_recitation==='complete'?'✅':'📝'}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13,fontFamily:"'Tajawal',Arial",direction:'rtl'}}>{s?.nom_ar||'—'}</div>
                        <div style={{fontSize:11,color:'#888'}}>{new Date(r.date_validation).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR')}</div>
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:nc}}>+{r.type_recitation==='complete'?30:10}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Exception modal */}
        {showExceptionModal && (
          <ExceptionModal
            sourates={souratesOrdonnees}
            recitations={recitations}
            souratesDB={souratesDB}
            onConfirm={activerException}
            onCancel={()=>setShowExceptionModal(false)}
            lang={lang}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {showExceptionModal && (
        <ExceptionModal
          sourates={souratesOrdonnees}
          recitations={recitations}
          souratesDB={souratesDB}
          onConfirm={activerException}
          onCancel={() => setShowExceptionModal(false)}
          lang={lang}
        />
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:18,cursor:'pointer',minWidth:38}}>←</button>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <NiveauBadge code={codeNiveau}/>
          {isPrivilegied && (
            <button className="exception-btn" onClick={()=>setShowExceptionModal(true)}>
              🔓 {lang==='ar'?'فتح استثنائي':lang==='en'?'Unlock':'Exception'}
            </button>
          )}
        </div>
      </div>

      {/* Active exceptions banner */}
      {exceptions.length > 0 && (
        <div style={{marginBottom:'1rem',padding:'10px 14px',background:'#FCEBEB',border:'1px solid #E24B4A',borderRadius:10}}>
          <div style={{fontSize:12,fontWeight:600,color:'#A32D2D',marginBottom:6}}>
            🔓 {lang==='ar'?'استثناءات نشطة':lang==='en'?'Active exceptions':'Exceptions actives'} ({exceptions.length})
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {exceptions.map(ex => {
              const s = souratesOrdonnees.find(sr => sr.numero === ex.sourate_numero);
              return s ? (
                <div key={ex.id} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',background:'#fff',borderRadius:20,border:'1px solid #E24B4A'}}>
                  <span style={{fontSize:12,fontFamily:"'Tajawal',Arial",direction:'rtl'}}>{s.nom_ar}</span>
                  {isPrivilegied && (
                    <span onClick={()=>desactiverException(ex.sourate_numero)} style={{cursor:'pointer',color:'#E24B4A',fontSize:14,fontWeight:700,marginLeft:2}}>×</span>
                  )}
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Header élève */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <Avatar prenom={eleve.prenom} nom={eleve.nom} size={50} bg={sl.bg} color={sl.color}/>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:700}}>{eleve.prenom} {eleve.nom}</div>
            <div style={{fontSize:12,color:'#888'}}>{eleve.eleve_id_ecole?`#${eleve.eleve_id_ecole} · `:''}{codeNiveau}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:28,fontWeight:800,color:sl.color}}>{totalPoints}</div>
            <div style={{fontSize:11,color:'#888'}}>{t(lang,'pts_abrev')}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {[
            {val:souratesCompletes,lbl:lang==='ar'?'مكتملة':lang==='en'?'Complete':'Complètes',color:'#EF9F27',bg:'#FAEEDA'},
            {val:recitations.filter(r=>r.type_recitation==='sequence').length,lbl:lang==='ar'?'مقاطع':lang==='en'?'Sequences':'Séquences',color:'#1D9E75',bg:'#E1F5EE'},
            {val:souratesOrdonnees.length,lbl:lang==='ar'?'إجمالي السور':lang==='en'?'Total':'Total sourates',color:'#888',bg:'#f5f5f0'},
          ].map(k=>(
            <div key={k.lbl} style={{background:k.bg,borderRadius:8,padding:'8px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:700,color:k.color}}>{k.val}</div>
              <div style={{fontSize:10,color:k.color,opacity:0.8}}>{k.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {flash && (
        <div style={{position:'fixed',top:70,left:'50%',transform:'translateX(-50%)',zIndex:999,background:flash.color,color:'#fff',padding:'12px 24px',borderRadius:12,fontSize:14,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,0.15)',textAlign:'center',minWidth:280}}>
          {flash.msg}<div style={{fontSize:18,fontWeight:800,marginTop:4}}>+{flash.pts} {t(lang,'pts_abrev')}</div>
        </div>
      )}

      {loading ? <div className="loading">...</div> : (
        <>
          {step === 'liste' && (
            <>
              <div className="section-label">{lang==='ar'?'قائمة السور':lang==='en'?'Surah list':'Liste des sourates'}</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {souratesOrdonnees.map((s, idx) => {
                  const status = getSourateStatus(s, idx);
                  const recs = getRecsSourate(s.numero);
                  const seqs = getSequences(s.numero);
                  const comp = isComplete(s.numero);
                  const pts = recs.reduce((acc,r)=>acc+(r.points||0),0);
                  const accessible = canAccess(s, idx);
                  const isCurrent = status === 'current';

                  let bg = '#fff', border = '#e0e0d8', opacity = 1, cursor = 'pointer';
                  let iconBg = '#f0f0ec', iconColor = '#999', iconContent = String(s.numero);

                  if (status === 'acquis') { bg='#f9f9f6'; border='#e0e0d8'; opacity=0.6; cursor='default'; iconBg='#e0e0d8'; iconColor='#bbb'; iconContent='✓'; }
                  else if (status === 'complete') { bg='#FAEEDA'; border='#EF9F27'; iconBg='#EF9F27'; iconColor='#fff'; iconContent='✓'; }
                  else if (status === 'current') { border='#1D9E75'; iconBg='#E1F5EE'; iconColor='#1D9E75'; }
                  else if (status === 'unlocked') { bg='#FCEBEB'; border='#E24B4A'; iconBg='#E24B4A'; iconColor='#fff'; iconContent='🔓'; }
                  else if (status === 'locked') { opacity=0.35; cursor='not-allowed'; iconBg='#f0f0ec'; iconColor='#ccc'; iconContent='🔒'; }

                  return (
                    <div key={s.numero}
                      onClick={() => { if(accessible){ setSelectedSourate(s); setStep('valider'); } }}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:bg,border:`${isCurrent?'2px':'0.5px'} solid ${border}`,borderRadius:12,cursor,opacity,transition:'all 0.15s'}}
                      onMouseEnter={ev => accessible && (ev.currentTarget.style.borderColor='#1D9E75')}
                      onMouseLeave={ev => accessible && (ev.currentTarget.style.borderColor=border)}>
                      <div style={{width:38,height:38,borderRadius:'50%',background:iconBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:iconColor,flexShrink:0}}>
                        {seqs.length > 0 && !comp && status!=='locked' ? seqs.length : iconContent}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:16,fontWeight:600,fontFamily:"'Tajawal','Traditional Arabic',serif",direction:'rtl',textAlign:'right',color:status==='locked'?'#ccc':'#1a1a1a'}}>
                          {s.nom_ar}
                        </div>
                        <div style={{fontSize:11,color:'#888',marginTop:2}}>
                          {status==='acquis' ? (lang==='ar'?'مكتسب سابق':lang==='en'?'Prior achievement':'Acquis antérieur')
                          : status==='complete' ? `✓ ${lang==='ar'?'مكتملة':lang==='en'?'Complete':'Complète'} · ${seqs.length} ${lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'}`
                          : status==='current' ? seqs.length > 0 ? `${seqs.length}/3 ${lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'} — ${lang==='ar'?'جارية':lang==='en'?'in progress':'en cours'}` : (lang==='ar'?'السورة الحالية':lang==='en'?'Current surah':'Sourate actuelle')
                          : status==='unlocked' ? `🔓 ${lang==='ar'?'مفتوحة استثنائياً':lang==='en'?'Exceptionally unlocked':'Débloquée exceptionnellement'}`
                          : `🔒 ${lang==='ar'?'مقفلة':lang==='en'?'Locked':'Verrouillée'}`}
                        </div>
                        {seqs.length > 0 && !comp && (
                          <div style={{display:'flex',gap:3,marginTop:4}}>
                            {seqs.map((sq,i) => (
                              <span key={i} style={{fontSize:10,background:'#E1F5EE',color:'#085041',padding:'1px 6px',borderRadius:10}}>V.{sq.verset_debut}→{sq.verset_fin}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {pts > 0 && <div style={{fontSize:12,fontWeight:700,color:status==='complete'?'#EF9F27':'#1D9E75',flexShrink:0}}>+{pts} {t(lang,'pts_abrev')}</div>}
                      {accessible && status!=='acquis' && <div style={{color:'#bbb',fontSize:16,flexShrink:0}}>›</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {step === 'valider' && selectedSourate && (() => {
            const comp = isComplete(selectedSourate.numero);
            const recs = getRecsSourate(selectedSourate.numero);
            const seqs = getSequences(selectedSourate.numero);
            const nbSeqActuel = seqs.length;
            const maxSeqAtteint = nbSeqActuel >= 3;

            return (
              <div>
                <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:18,cursor:'pointer',minWidth:38}}>←</button>

                {/* Sourate header */}
                <div style={{textAlign:'center',padding:'1.5rem',background:'linear-gradient(135deg,#085041,#1D9E75)',borderRadius:16,marginBottom:'1.25rem',color:'#fff'}}>
                  <div style={{fontSize:26,fontWeight:800,fontFamily:"'Tajawal','Traditional Arabic',serif",direction:'rtl'}}>{selectedSourate.nom_ar}</div>
                  <div style={{fontSize:12,opacity:0.7,marginTop:4}}>Sourate {selectedSourate.numero}</div>
                  <div style={{display:'flex',gap:4,justifyContent:'center',marginTop:8}}>
                    {[1,2,3].map(n=><div key={n} style={{width:30,height:6,borderRadius:3,background:n<=nbSeqActuel?'#fff':'rgba(255,255,255,0.3)'}}/>)}
                    <span style={{fontSize:11,opacity:0.8,marginLeft:4}}>{nbSeqActuel}/3 {lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'}</span>
                  </div>
                </div>

                {/* History */}
                {recs.length > 0 && (
                  <div style={{marginBottom:'1.25rem'}}>
                    <div className="section-label">{lang==='ar'?'السجل':lang==='en'?'History':'Historique'}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {recs.map((r,i) => (
                        <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#fff',border:`0.5px solid ${r.type_recitation==='complete'?'#EF9F27':'#e0e0d8'}`,borderRadius:10}}>
                          <span style={{fontSize:18}}>{r.type_recitation==='complete'?'🎉':'📍'}</span>
                          <div style={{flex:1}}>
                            {r.type_recitation==='complete'
                              ?<span className="badge badge-green">{lang==='ar'?'سورة كاملة':lang==='en'?'Complete':'Complète'}</span>
                              :<span className="badge badge-blue">{lang==='ar'?'مقطع':lang==='en'?'Seq.':'Séq.'} {i+1} — V.{r.verset_debut}→V.{r.verset_fin} <span style={{opacity:0.6}}>({r.verset_fin-r.verset_debut+1} {lang==='ar'?'آية':lang==='en'?'v.':'v.'})</span></span>}
                            <div style={{fontSize:11,color:'#bbb',marginTop:2}}>{new Date(r.date_validation).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}{r.valideur?` · ${r.valideur.prenom} ${r.valideur.nom}`:''}</div>
                          </div>
                          <span style={{fontSize:12,fontWeight:600,color:r.type_recitation==='complete'?'#EF9F27':'#1D9E75'}}>+{r.points} {t(lang,'pts_abrev')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comp ? (
                  <div style={{padding:'1.5rem',background:'#FAEEDA',border:'1px solid #EF9F27',borderRadius:12,textAlign:'center'}}>
                    <div style={{fontSize:28,marginBottom:8}}>🎉</div>
                    <div style={{fontSize:15,fontWeight:600,color:'#412402'}}>
                      {lang==='ar'?'تم حفظ هذه السورة كاملاً':lang==='en'?'This surah is fully memorized!':'Sourate complètement validée !'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="section-label">{lang==='ar'?'نوع الاستظهار':lang==='en'?'Recitation type':'Type de récitation'}</div>

                    {maxSeqAtteint && (
                      <div style={{padding:'10px 14px',background:'#FAEEDA',border:'0.5px solid #EF9F27',borderRadius:10,marginBottom:'1rem',fontSize:13,color:'#633806'}}>
                        ⚠️ {lang==='ar'?'تم تسجيل 3 مقاطع — يجب الآن استظهار السورة كاملاً للانتقال للسورة التالية':lang==='en'?'3 sequences done — Full surah recitation required to advance':'3 séquences — La récitation complète est maintenant requise pour avancer'}
                      </div>
                    )}

                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:'1.25rem'}}>
                      <div onClick={()=>!maxSeqAtteint&&setTypeRecitation('sequence')}
                        style={{padding:'16px',border:`2px solid ${typeRecitation==='sequence'&&!maxSeqAtteint?'#1D9E75':'#e0e0d8'}`,borderRadius:12,textAlign:'center',cursor:maxSeqAtteint?'not-allowed':'pointer',opacity:maxSeqAtteint?0.4:1,background:typeRecitation==='sequence'&&!maxSeqAtteint?'#E1F5EE':'#fff',transition:'all 0.15s'}}>
                        <div style={{fontSize:24,marginBottom:6}}>📍</div>
                        <div style={{fontSize:13,fontWeight:600}}>{lang==='ar'?'مقطع':lang==='en'?'Sequence':'Séquence'}</div>
                        <div style={{fontSize:11,color:'#888',marginTop:2}}>{lang==='ar'?`المقطع ${nbSeqActuel+1} من 3`:lang==='en'?`Seq. ${nbSeqActuel+1}/3`:`Séq. ${nbSeqActuel+1}/3`}</div>
                        <div style={{fontSize:11,fontWeight:600,color:'#1D9E75',marginTop:4}}>+10 {t(lang,'pts_abrev')}</div>
                      </div>
                      <div onClick={()=>setTypeRecitation('complete')}
                        style={{padding:'16px',border:`2px solid ${typeRecitation==='complete'?'#EF9F27':'#e0e0d8'}`,borderRadius:12,textAlign:'center',cursor:'pointer',background:typeRecitation==='complete'?'#FAEEDA':'#fff',transition:'all 0.15s'}}>
                        <div style={{fontSize:24,marginBottom:6}}>🎉</div>
                        <div style={{fontSize:13,fontWeight:600}}>{lang==='ar'?'سورة كاملة':lang==='en'?'Full surah':'Sourate complète'}</div>
                        <div style={{fontSize:11,color:'#888',marginTop:2}}>{lang==='ar'?'للانتقال للسورة التالية':lang==='en'?'To advance to next':'Pour passer à la suivante'}</div>
                        <div style={{fontSize:11,fontWeight:600,color:'#EF9F27',marginTop:4}}>{(bareme?.unites?.sourate||0)>0?`+${bareme.unites.sourate} ${t(lang,'pts_abrev')}`:''}</div>
                      </div>
                    </div>

                    {typeRecitation === 'sequence' && !maxSeqAtteint && (
                      <div className="card" style={{marginBottom:'1rem'}}>
                        <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>
                          {lang==='ar'?'تحديد الآيات':lang==='en'?'Verse range':'Versets récités'}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                          <div className="field-group">
                            <label className="field-lbl">{lang==='ar'?'من الآية':lang==='en'?'From verse':'Verset début'} <span style={{color:'#E24B4A'}}>*</span></label>
                            <input className="field-input" type="number" min="1" value={versetDebut} onChange={e=>setVersetDebut(e.target.value)} placeholder="1"/>
                          </div>
                          <div className="field-group">
                            <label className="field-lbl">{lang==='ar'?'إلى الآية':lang==='en'?'To verse':'Verset fin'} <span style={{color:'#E24B4A'}}>*</span></label>
                            <input className="field-input" type="number" min="1" value={versetFin} onChange={e=>setVersetFin(e.target.value)} placeholder="10"/>
                          </div>
                        </div>
                      </div>
                    )}

                    <button className="btn-primary"
                      disabled={saving||(typeRecitation==='sequence'&&(maxSeqAtteint||!versetDebut||!versetFin))}
                      onClick={confirmer}>
                      {saving?'...':`✓ ${lang==='ar'?'تأكيد الاستظهار':lang==='en'?'Confirm':'Confirmer'}`}
                    </button>
                  </>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
