import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales, scoreLabel } from '../lib/helpers';
import { t } from '../lib/i18n';
import { getSouratesForNiveau } from '../lib/sourates';

function Avatar({ prenom, nom, size=36, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

// Badge niveau
function NiveauBadge({ code }) {
  const colors = { '5B':'#534AB7', '5A':'#378ADD', '2M':'#1D9E75', '2':'#EF9F27', '1':'#E24B4A' };
  const c = colors[code] || '#888';
  return <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:c+'15',color:c,border:`0.5px solid ${c}30`}}>{code}</span>;
}

export default function RecitationSourate({ user, eleve, navigate, lang='fr' }) {
  const [sourates, setSourates] = useState([]);
  const [recitations, setRecitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('liste'); // liste | valider | confirmer
  const [selectedSourate, setSelectedSourate] = useState(null);
  const [typeRecitation, setTypeRecitation] = useState('sequence'); // sequence | complete
  const [versetDebut, setVersetDebut] = useState('');
  const [versetFin, setVersetFin] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState(null);

  const codeNiveau = eleve.code_niveau || '5B';
  const souratesNiveau = getSouratesForNiveau(codeNiveau);
  // Order: 114 first → descending
  const souratesOrdonnees = [...souratesNiveau].sort((a,b) => b.numero - a.numero);

  useEffect(() => { loadData(); }, [eleve.id]);

  const loadData = async () => {
    setLoading(true);
    const { data: rd } = await supabase
      .from('recitations_sourates')
      .select('*, valideur:valide_par(prenom,nom)')
      .eq('eleve_id', eleve.id)
      .order('date_validation', { ascending: false });
    setRecitations(rd || []);
    setLoading(false);
  };

  // Stats par sourate
  const statsSourate = (numero) => {
    const r = recitations.filter(r => {
      // Find sourate by joining with souratesNiveau
      return r.sourate_id === souratesOrdonnees.find(s => s.numero === numero)?.id_db;
    });
    return r;
  };

  // How many sequences validated for a sourate
  const getRecitationsSourate = (sourateId) => {
    return recitations.filter(r => r.sourate_id === sourateId);
  };

  const isSourateComplete = (sourateId) => {
    return recitations.some(r => r.sourate_id === sourateId && r.type_recitation === 'complete');
  };

  const nbSequences = (sourateId) => {
    return recitations.filter(r => r.sourate_id === sourateId && r.type_recitation === 'sequence').length;
  };

  const totalPoints = recitations.reduce((s,r) => s + (r.points||0), 0);
  const souratesCompletes = new Set(recitations.filter(r=>r.type_recitation==='complete').map(r=>r.sourate_id)).size;
  const totalSequences = recitations.filter(r=>r.type_recitation==='sequence').length;

  const confirmer = async () => {
    if (!selectedSourate || saving) return;
    if (typeRecitation === 'sequence') {
      if (!versetDebut || !versetFin) {
        alert(lang==='ar'?'يجب تحديد رقم الآية الأولى والآخيرة':lang==='en'?'Please enter start and end verse numbers':'Veuillez saisir les versets de début et de fin');
        return;
      }
      if (parseInt(versetFin) < parseInt(versetDebut)) {
        alert(lang==='ar'?'الآية الأخيرة يجب أن تكون أكبر من الآية الأولى':lang==='en'?'End verse must be greater than start verse':'Le verset de fin doit être supérieur au verset de début');
        return;
      }
    }
    setSaving(true);

    const pts = typeRecitation === 'complete' ? 30 : 10; // 10 seq + 20 bonus complete = 30 direct
    const { error } = await supabase.from('recitations_sourates').insert({
      eleve_id: eleve.id,
      sourate_id: selectedSourate.id_db,
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
        ? `🎉 ${selectedSourate.nom_ar} — ${lang==='ar'?'تمت التلاوة كاملة':lang==='en'?'Complete recitation validated!':'Sourate complète validée !'}`
        : `✅ ${lang==='ar'?'تم تسجيل المقطع':lang==='en'?'Sequence recorded':'Séquence enregistrée'} — V.${versetDebut}→V.${versetFin}`,
        pts, color: typeRecitation==='complete'?'#EF9F27':'#1D9E75'
      });
      setTimeout(() => setFlash(null), 3000);
      await loadData();
      setStep('liste');
      setSelectedSourate(null);
      setVersetDebut(''); setVersetFin('');
      setTypeRecitation('sequence');
    }
  };

  const sl = scoreLabel(totalPoints);

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={()=>navigate('dashboard')}>{t(lang,'retour')}</button>
        <NiveauBadge code={codeNiveau}/>
      </div>

      {/* Header élève */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <Avatar prenom={eleve.prenom} nom={eleve.nom} size={50} bg={sl.bg} color={sl.color}/>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:700}}>{eleve.prenom} {eleve.nom}</div>
            <div style={{fontSize:13,color:'#888'}}>
              {codeNiveau==='5B'?lang==='ar'?'المستوى التمهيدي':lang==='en'?'Preschool level':'Niveau préscolaire':
               lang==='ar'?'المستوى الابتدائي 1-2':lang==='en'?'Primary 1-2':'Primaire 1-2'}
              {eleve.eleve_id_ecole && ` · #${eleve.eleve_id_ecole}`}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:28,fontWeight:800,color:sl.color}}>{totalPoints}</div>
            <div style={{fontSize:11,color:'#888'}}>{t(lang,'pts_abrev')}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {[
            {val:souratesCompletes, lbl:lang==='ar'?'سور مكتملة':lang==='en'?'Complete surahs':'Sourates complètes', color:'#EF9F27', bg:'#FAEEDA'},
            {val:totalSequences, lbl:lang==='ar'?'مقاطع':lang==='en'?'Sequences':'Séquences', color:'#1D9E75', bg:'#E1F5EE'},
            {val:souratesOrdonnees.length, lbl:lang==='ar'?'إجمالي السور':lang==='en'?'Total surahs':'Total sourates', color:'#888', bg:'#f5f5f0'},
          ].map(k=>(
            <div key={k.lbl} style={{background:k.bg,borderRadius:8,padding:'10px',textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:700,color:k.color}}>{k.val}</div>
              <div style={{fontSize:11,color:k.color,opacity:0.8}}>{k.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Flash message */}
      {flash && (
        <div style={{position:'fixed',top:70,left:'50%',transform:'translateX(-50%)',zIndex:999,background:flash.color,color:'#fff',padding:'12px 24px',borderRadius:12,fontSize:14,fontWeight:600,boxShadow:'0 4px 20px rgba(0,0,0,0.15)',textAlign:'center',minWidth:280,direction:'rtl'}}>
          {flash.msg}
          <div style={{fontSize:18,fontWeight:800,marginTop:4}}>+{flash.pts} {t(lang,'pts_abrev')}</div>
        </div>
      )}

      {loading ? <div className="loading">...</div> : (
        <>
          {step === 'liste' && (
            <>
              <div className="section-label">
                {lang==='ar'?'قائمة السور':lang==='en'?'Surah list':'Liste des sourates'} ({souratesOrdonnees.length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {souratesOrdonnees.map(s => {
                  const recs = getRecitationsSourate(s.id_db);
                  const complete = isSourateComplete(s.id_db);
                  const nbSeq = nbSequences(s.id_db);
                  const ptsS = recs.reduce((acc,r)=>acc+(r.points||0),0);
                  return (
                    <div key={s.numero}
                      onClick={() => { setSelectedSourate(s); setStep('valider'); }}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:complete?'#FAEEDA':'#fff',border:`0.5px solid ${complete?'#EF9F27':'#e0e0d8'}`,borderRadius:12,cursor:'pointer',transition:'all 0.15s'}}
                      onMouseEnter={ev=>ev.currentTarget.style.borderColor='#1D9E75'}
                      onMouseLeave={ev=>ev.currentTarget.style.borderColor=complete?'#EF9F27':'#e0e0d8'}>
                      {/* Numero */}
                      <div style={{width:36,height:36,borderRadius:'50%',background:complete?'#EF9F27':'#f0f0ec',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:complete?'#fff':'#888',flexShrink:0}}>
                        {complete?'✓':s.numero}
                      </div>
                      {/* Nom arabe */}
                      <div style={{flex:1}}>
                        <div style={{fontSize:16,fontWeight:600,color:complete?'#412402':'#1a1a1a',fontFamily:"'Amiri','Traditional Arabic',serif",direction:'rtl',textAlign:'right'}}>
                          {s.nom_ar}
                        </div>
                        <div style={{fontSize:11,color:'#888',marginTop:2}}>
                          {complete
                            ? `✓ ${lang==='ar'?'مكتملة':lang==='en'?'Complete':'Complète'} · ${nbSeq} ${lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'}`
                            : nbSeq > 0
                            ? `${nbSeq} ${lang==='ar'?'مقطع':lang==='en'?'seq.':'séq.'} ${lang==='ar'?'مسجلة':lang==='en'?'recorded':'enregistrée(s)'}`
                            : lang==='ar'?'لم تبدأ بعد':lang==='en'?'Not started':'Pas encore commencée'}
                        </div>
                      </div>
                      {/* Points */}
                      {ptsS > 0 && (
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:13,fontWeight:700,color:complete?'#EF9F27':'#1D9E75'}}>+{ptsS} {t(lang,'pts_abrev')}</div>
                        </div>
                      )}
                      {/* Chevron */}
                      <div style={{color:'#bbb',fontSize:16}}>›</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {step === 'valider' && selectedSourate && (
            <div>
              <button className="back-link" onClick={()=>{setStep('liste');setSelectedSourate(null);}}>{t(lang,'retour')}</button>

              {/* Sourate header */}
              <div style={{textAlign:'center',padding:'1.5rem',background:'linear-gradient(135deg,#085041,#1D9E75)',borderRadius:16,marginBottom:'1.25rem',color:'#fff'}}>
                <div style={{fontSize:28,fontWeight:800,fontFamily:"'Amiri','Traditional Arabic',serif",marginBottom:4,direction:'rtl'}}>{selectedSourate.nom_ar}</div>
                <div style={{fontSize:13,opacity:0.8}}>Sourate {selectedSourate.numero}</div>
                <div style={{fontSize:11,opacity:0.6,marginTop:4}}>
                  {isSourateComplete(selectedSourate.id_db)
                    ? (lang==='ar'?'✓ مكتملة':lang==='en'?'✓ Complete':'✓ Complète')
                    : `${nbSequences(selectedSourate.id_db)} ${lang==='ar'?'مقطع مسجل':lang==='en'?'seq. recorded':'séq. enregistrée(s)'}`}
                </div>
              </div>

              {/* Historique récitations pour cette sourate */}
              {getRecitationsSourate(selectedSourate.id_db).length > 0 && (
                <div style={{marginBottom:'1.25rem'}}>
                  <div className="section-label">{lang==='ar'?'السجل':lang==='en'?'History':'Historique'}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {getRecitationsSourate(selectedSourate.id_db).map(r=>(
                      <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10}}>
                        <span style={{fontSize:18}}>{r.type_recitation==='complete'?'🎉':'📍'}</span>
                        <div style={{flex:1}}>
                          {r.type_recitation==='complete'
                            ?<span className="badge badge-green">{lang==='ar'?'تلاوة كاملة':lang==='en'?'Complete':'Complète'}</span>
                            :<span className="badge badge-blue">{lang==='ar'?'مقطع':lang==='en'?'Seq.':'Séq.'} V.{r.verset_debut}→V.{r.verset_fin}</span>}
                          <span style={{fontSize:11,color:'#bbb',marginLeft:8}}>{new Date(r.date_validation).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} {r.valideur?`· ${r.valideur.prenom} ${r.valideur.nom}`:''}</span>
                        </div>
                        <span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{r.points} {t(lang,'pts_abrev')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Type de validation */}
              {!isSourateComplete(selectedSourate.id_db) && (() => {
                const nbSeqActuel = nbSequences(selectedSourate.id_db);
                const maxSeqAtteint = nbSeqActuel >= 3;
                return (
                <>
                  <div className="section-label">{lang==='ar'?'نوع التسميع':lang==='en'?'Recitation type':'Type de récitation'}</div>
                  {/* Progress indicator */}
                  <div style={{display:'flex',gap:4,marginBottom:12,alignItems:'center'}}>
                    {[1,2,3].map(n=>(
                      <div key={n} style={{flex:1,height:6,borderRadius:3,background:n<=nbSeqActuel?'#1D9E75':'#e8e8e0'}}/>
                    ))}
                    <span style={{fontSize:11,color:'#888',marginLeft:6,whiteSpace:'nowrap'}}>{nbSeqActuel}/3 {lang==='ar'?'مقاطع':lang==='en'?'seq.':'séq.'}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:'1.25rem'}}>
                    <div onClick={()=>!maxSeqAtteint&&setTypeRecitation('sequence')}
                      style={{padding:'16px',border:`2px solid ${typeRecitation==='sequence'&&!maxSeqAtteint?'#1D9E75':'#e0e0d8'}`,borderRadius:12,textAlign:'center',cursor:maxSeqAtteint?'not-allowed':'pointer',opacity:maxSeqAtteint?0.4:1,background:typeRecitation==='sequence'&&!maxSeqAtteint?'#E1F5EE':'#fff',transition:'all 0.15s'}}>
                      <div style={{fontSize:24,marginBottom:6}}>📍</div>
                      <div style={{fontSize:13,fontWeight:600,color:typeRecitation==='sequence'?'#085041':'#1a1a1a'}}>
                        {lang==='ar'?'مقطع':lang==='en'?'Sequence':'Séquence'}
                      </div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>
                        {lang==='ar'?'من آية إلى آية':lang==='en'?'Verse to verse':'Verset à verset'}
                      </div>
                      <div style={{fontSize:11,fontWeight:600,color:'#1D9E75',marginTop:4}}>+10 {t(lang,'pts_abrev')}</div>
                    </div>
                    <div onClick={()=>setTypeRecitation('complete')}
                      style={{padding:'16px',border:`2px solid ${typeRecitation==='complete'?'#EF9F27':'#e0e0d8'}`,borderRadius:12,textAlign:'center',cursor:'pointer',background:typeRecitation==='complete'?'#FAEEDA':'#fff',transition:'all 0.15s'}}>
                      <div style={{fontSize:24,marginBottom:6}}>🎉</div>
                      <div style={{fontSize:13,fontWeight:600,color:typeRecitation==='complete'?'#412402':'#1a1a1a'}}>
                        {lang==='ar'?'سورة كاملة':lang==='en'?'Full surah':'Sourate complète'}
                      </div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>
                        {lang==='ar'?'تلاوة دفعة واحدة':lang==='en'?'One shot recitation':'En une seule fois'}
                      </div>
                      <div style={{fontSize:11,fontWeight:600,color:'#EF9F27',marginTop:4}}>+30 {t(lang,'pts_abrev')}</div>
                    </div>
                  </div>

                  {/* Max 3 sequences warning */}
                  {maxSeqAtteint && typeRecitation === 'sequence' && (
                    <div style={{padding:'10px 14px',background:'#FAEEDA',border:'0.5px solid #EF9F27',borderRadius:10,marginBottom:'1rem',fontSize:13,color:'#633806'}}>
                      ⚠️ {lang==='ar'?'تم تسجيل 3 مقاطع. يجب الآن تسميع السورة كاملة':lang==='en'?'3 sequences recorded. The full surah recitation is now required':'3 séquences enregistrées. La récitation complète de la sourate est maintenant requise'}
                    </div>
                  )}

                  {typeRecitation === 'sequence' && !maxSeqAtteint && (
                    <div className="card" style={{marginBottom:'1rem'}}>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:12}}>
                        {lang==='ar'?'تحديد الآيات':lang==='en'?'Verse range':'Versets récités'}
                        <span style={{fontSize:11,color:'#888',marginRight:8,marginLeft:8}}>({lang==='ar'?`المقطع ${nbSeqActuel+1} من 3`:lang==='en'?`Sequence ${nbSeqActuel+1} of 3`:`Séquence ${nbSeqActuel+1}/3`})</span>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        <div className="field-group">
                          <label className="field-lbl">{lang==='ar'?'من الآية':lang==='en'?'From verse':'Verset début'} <span style={{color:'#E24B4A'}}>*</span></label>
                          <input className="field-input" type="number" min="1" value={versetDebut} onChange={e=>setVersetDebut(e.target.value)} placeholder="1"
                            style={{borderColor: versetDebut?'':'#E24B4A'}}/>
                        </div>
                        <div className="field-group">
                          <label className="field-lbl">{lang==='ar'?'إلى الآية':lang==='en'?'To verse':'Verset fin'} <span style={{color:'#E24B4A'}}>*</span></label>
                          <input className="field-input" type="number" min="1" value={versetFin} onChange={e=>setVersetFin(e.target.value)} placeholder="10"
                            style={{borderColor: versetFin?'':'#E24B4A'}}/>
                        </div>
                      </div>
                      <div style={{fontSize:11,color:'#bbb',marginTop:6}}>
                        <span style={{color:'#E24B4A'}}>*</span> {lang==='ar'?'حقول إلزامية':lang==='en'?'Required fields':'Champs obligatoires'}
                      </div>
                    </div>
                  )}

                  <button className="btn-primary"
                    disabled={saving || (typeRecitation==='sequence' && (maxSeqAtteint || !versetDebut || !versetFin))}
                    onClick={confirmer}>
                    {saving?'...':`✓ ${lang==='ar'?'تأكيد التسميع':lang==='en'?'Confirm recitation':'Confirmer la récitation'}`}
                  </button>
                </>
                );
              })()}

              {isSourateComplete(selectedSourate.id_db) && (
                <div style={{padding:'1.5rem',background:'#FAEEDA',border:'1px solid #EF9F27',borderRadius:12,textAlign:'center'}}>
                  <div style={{fontSize:28,marginBottom:8}}>🎉</div>
                  <div style={{fontSize:15,fontWeight:600,color:'#412402'}}>
                    {lang==='ar'?'تم حفظ هذه السورة كاملاً':lang==='en'?'This surah is fully memorized!':'Cette sourate est complètement validée !'}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
