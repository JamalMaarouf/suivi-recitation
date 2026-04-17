import React, { useState, useEffect } from 'react';
import { useToast } from '../lib/toast';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { withRetryToast } from '../lib/retry';
import { invalidateMany } from '../lib/cache';
import { enqueueOrRun } from '../lib/offlineQueue';
import { calcEtatEleve, calcPositionAtteinte, calcUnite, formatDate, getInitiales, motivationMsg, verifierBlocageExamen, verifierEtCreerCertificats, loadBareme } from '../lib/helpers';

function Avatar({ prenom, nom, size = 36, bg = '#E1F5EE', color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function EnregistrerRecitation({  user, eleve: eleveInitial, navigate, goBack, lang="fr", isMobile=false }) {
  const { toast } = useToast();
  const [step, setStep] = useState(eleveInitial ? 2 : 1);
  const [bareme, setBareme] = useState(null);
  const [blocage, setBlocage] = useState(null); // examen requis avant de continuer
  const [eleves, setEleves] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEleve, setSelectedEleve] = useState(eleveInitial || null);
  const [etat, setEtat] = useState(null);
  const [apprentissages, setApprentissages] = useState([]);
  const [tomonSelectionnes, setTomonSelectionnes] = useState([]);
  const [typeValidation, setTypeValidation] = useState('tomon');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [motivMsg, setMotivMsg] = useState(null);

  useEffect(() => {
    loadEleves();
    if (eleveInitial) loadValidations(eleveInitial);
    loadBareme(supabase, user.ecole_id).then(b => setBareme(b));
  }, []);

  const loadEleves = async () => {
    const { data } = await supabase.from('eleves').select('*')
        .eq('ecole_id', user.ecole_id).order('nom');
    setEleves(data || []);
  };

  const loadValidations = async (el) => {
    const [{ data: vals }, { data: appr }] = await Promise.all([
      supabase.from('validations').select('*')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', el.id),
      supabase.from('apprentissages').select('*')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', el.id)
    ]);
    const e = calcEtatEleve(vals || [], el.hizb_depart, el.tomon_depart);
    setEtat(e);
    setApprentissages(appr || []);
  };

  const selectEleve = async (el) => {
    setSelectedEleve(el);
    setTomonSelectionnes([]);
    setTypeValidation('tomon');
    await loadValidations(el);
    setStep(2);
  };

  const toggleTomon = (n) => {
    if (!etat || etat.enAttenteHizbComplet) return;
    const prochain = etat.prochainTomon;
    if (n < prochain) return;
    const maxSel = prochain + tomonSelectionnes.length;
    if (n > maxSel) return;
    if (tomonSelectionnes.includes(n)) setTomonSelectionnes(tomonSelectionnes.filter(t => t < n));
    else setTomonSelectionnes([...tomonSelectionnes, n]);
  };

  const nombreTomon = tomonSelectionnes.length;
  const posNouvelle = selectedEleve && etat && nombreTomon > 0
    ? calcPositionAtteinte(selectedEleve.hizb_depart, selectedEleve.tomon_depart, etat.tomonCumul + nombreTomon)
    : null;

  // Trouver l'apprentissage en cours pour les Tomon sélectionnés
  const apprentissageInfo = (tomonNum) => {
    if (!selectedEleve || !etat) return null;
    return apprentissages.find(a => a.hizb === etat.hizbEnCours && a.tomon === tomonNum);
  };

  const dureesApprentissage = tomonSelectionnes.map(n => {
    const appr = apprentissageInfo(n);
    if (!appr) return null;
    const jours = Math.round((new Date() - new Date(appr.date_debut)) / (1000 * 60 * 60 * 24));
    return { tomon: n, jours };
  }).filter(Boolean);

  const confirmer = async () => {
    setLoading(true);
    const insertData = {
      eleve_id: selectedEleve.id,
      ecole_id: user.ecole_id,
      valide_par: user.id,
      nombre_tomon: typeValidation === 'hizb_complet' ? 0 : nombreTomon,
      type_validation: typeValidation,
      date_validation: new Date().toISOString(),
      tomon_debut: typeValidation === 'tomon' ? etat.prochainTomon : null,
      hizb_validation: typeValidation === 'tomon' ? etat.hizbEnCours : null
    };
    if (typeValidation === 'hizb_complet') insertData.hizb_valide = etat.hizbEnCours;
    // Online : tente direct avec retry. Offline : met en queue et synchronisera plus tard.
    const res = await enqueueOrRun(supabase, 'validations', 'insert', insertData, user.ecole_id);
    const error = res.error;
    const wasQueued = res.status === 'queued';

    if (wasQueued) {
      // Toast de succès pour ne pas inquiéter l'utilisateur — la validation est bien enregistrée
      toast.success(lang === 'ar'
        ? '✓ تم الحفظ (سيتم المزامنة تلقائياً)'
        : '✓ Enregistré (synchro auto au retour du réseau)');
    }

    if (!error && !wasQueued && typeValidation === 'tomon') {
      // Enregistrer l'apprentissage du prochain Tomon (seulement si online)
      const prochainApresValidation = etat.prochainTomon + nombreTomon;
      if (prochainApresValidation <= 8) {
        const existant = apprentissages.find(a => a.hizb === etat.hizbEnCours && a.tomon === prochainApresValidation);
        if (!existant) {
          await enqueueOrRun(supabase, 'apprentissages', 'insert', {
            eleve_id: selectedEleve.id,
            ecole_id: user.ecole_id,
            hizb: etat.hizbEnCours,
            tomon: prochainApresValidation,
            date_debut: new Date().toISOString()
          }, user.ecole_id);
        }
      }
    }

    // Invalider les caches impactés par cette validation (online ou queued)
    if (!error) {
      const eid = selectedEleve?.id;
      invalidateMany(
        ['validations', 'recitations_sourates_min',
         ...(eid ? [`validations_${eid}`, `recitations_eleve_${eid}`] : [])],
        user.ecole_id
      );
    }

    setLoading(false);
    if (error) {
      toast.error(error.message || 'Erreur de validation');
      return;
    }

    // Vérifier si un examen de bloc est maintenant requis
    // On recharge les validations fraîches pour avoir l'état à jour
    const { data: valsNouv } = await supabase
      .from('validations').select('*')
      .eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id);
    const { data: recsNouv } = await supabase
      .from('recitations_sourates').select('*')
      .eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id);

    const blocageDetecte = await verifierBlocageExamen(supabase, {
      eleve: selectedEleve,   // contient code_niveau
      ecole_id: user.ecole_id,
      validations: valsNouv || [],
      recitations: recsNouv || [],
    });

    if (blocageDetecte) {
      setBlocage(blocageDetecte);
    }

    // Vérifier si un jalon/certificat est débloqué
    const nouveauxCerts = await verifierEtCreerCertificats(supabase, {
      eleve: selectedEleve, ecole_id: user.ecole_id, valide_par: user.id,
      validations: valsNouv || [], recitations: recsNouv || [],
    });
    if (nouveauxCerts.length > 0) {
      toast.success(lang==='ar'
        ? `🏅 شهادة جديدة: ${(nouveauxCerts||[]).map(c=>c.nom_certificat_ar||c.nom_certificat).join(', ')} !`
        : `🏅 Nouveau certificat: ${(nouveauxCerts||[]).map(c=>c.nom_certificat).join(', ')} !`);
    }

    const msg = motivationMsg(nombreTomon, etat, typeValidation === 'hizb_complet');
    setMotivMsg(msg);
    setDone(true);
  };

  const elevesFiltre = eleves.filter(e => `${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes(search.toLowerCase()));

  if (isMobile) {
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#fff',padding:0}}>
              ←
            </button>
            <div style={{fontSize:16,fontWeight:800,color:'#fff'}}>
              {lang==='ar'?'استظهار':lang==='en'?'Recitation':'Récitation'}
            </div>
          </div>
        </div>
        <div style={{padding:'16px'}}>
          {/* Eleve info */}
          {eleveInitial && (
            <div style={{background:'#E1F5EE',borderRadius:12,padding:'13px 16px',marginBottom:16,
              display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:'#1D9E75',color:'#fff',
                display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,flexShrink:0}}>
                {((eleveInitial.prenom||'?')[0])+((eleveInitial.nom||'?')[0])}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{eleveInitial.prenom} {eleveInitial.nom}</div>
                <div style={{fontSize:12,color:'#085041',opacity:0.8}}>{eleveInitial.code_niveau}</div>
              </div>
            </div>
          )}
          {/* Loading */}
          {!etat && (
            <div style={{textAlign:'center',color:'#888',padding:'2rem'}}>
              <div style={{fontSize:32,marginBottom:8}}>⏳</div>
              <div>{lang==='ar'?'جاري التحميل...':'Chargement...'}</div>
            </div>
          )}
          {/* Validation - etat loaded */}
          {etat && !done && (
            <div>
              {/* Progress bar */}
              <div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:16,border:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:13,color:'#085041',fontWeight:600,marginBottom:8}}>
                  Hizb {etat.hizbEnCours} · Tomon {etat.prochainTomon}
                </div>
                <div style={{display:'flex',gap:3}}>
                  {[1,2,3,4,5,6,7,8].map(n=>(
                    <div key={n} style={{flex:1,height:8,borderRadius:3,
                      background:n<=etat.tomonDansHizbActuel?'#1D9E75':'#e0e0d8'}}/>
                  ))}
                </div>
                <div style={{fontSize:11,color:'#888',marginTop:6}}>
                  {etat.tomonDansHizbActuel}/8 tomon complétés dans ce Hizb
                </div>
              </div>
              {/* Hizb complet waiting */}
              {etat.enAttenteHizbComplet ? (
                <div>
                  <div style={{background:'#FAEEDA',borderRadius:12,padding:'14px',marginBottom:14,
                    textAlign:'center',fontSize:14,color:'#633806',fontWeight:600}}>
                    🎉 {t(lang,'hizb_complet_en_attente')}
                  </div>
                  <button onClick={async ()=>{
                    const {error} = await withRetryToast(
                      () => supabase.from('validations').insert({
                        eleve_id:eleveInitial.id, ecole_id:user.ecole_id,
                        valide_par:user.id, nombre_tomon:0,
                        type_validation:'hizb_complet',
                        date_validation:new Date().toISOString(),
                        tomon_debut:etat.prochainTomon,
                        hizb_validation:etat.hizbEnCours
                      }),
                      toast, lang
                    );
                    if (!error) { setDone(true); setMotivMsg({msg:`🎉 Hizb complet ! +${bareme?.unites?.hizb_complet||0} pts`}); toast.success(lang==='ar'?'🎉 تم تسجيل الحزب الكامل':`🎉 Hizb complet enregistré ! +${bareme?.unites?.hizb_complet||0} pts`); invalidateMany(['validations', 'recitations_sourates_min', `validations_${eleveInitial.id}`, `recitations_eleve_${eleveInitial.id}`], user.ecole_id); }
                  }}
                    style={{width:'100%',padding:'18px',background:'#EF9F27',color:'#fff',
                      border:'none',borderRadius:14,fontSize:17,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>
                    ✓ Valider Hizb (+100 pts)
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:'#444',marginBottom:12,textAlign:'center'}}>
                    {lang==='ar'?'اختر عدد الثُّمن':'Combien de tomon ?'}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
                    {Array.from({length:Math.min(etat.tomonRestants||8,4)},(_,i)=>i+1).map(n=>(
                      <button key={n} onClick={async ()=>{
                        const {error} = await withRetryToast(
                          () => supabase.from('validations').insert({
                            eleve_id:eleveInitial.id, ecole_id:user.ecole_id,
                            valide_par:user.id, nombre_tomon:n,
                            type_validation:'tomon',
                            date_validation:new Date().toISOString(),
                            tomon_debut:etat.prochainTomon,
                            hizb_validation:etat.hizbEnCours
                          }),
                          toast, lang
                        );
                        if (!error) { setDone(true); setMotivMsg({msg:`✅ +${n*30} pts !`}); toast.success(`✅ +${n*30} pts enregistrés !`); invalidateMany(['validations', 'recitations_sourates_min', `validations_${eleveInitial.id}`, `recitations_eleve_${eleveInitial.id}`], user.ecole_id); }
                      }}
                        style={{padding:'20px 8px',background:'#1D9E75',color:'#fff',
                          border:'none',borderRadius:14,fontSize:16,fontWeight:800,
                          cursor:'pointer',fontFamily:'inherit',textAlign:'center'}}>
                        +{n} tomon
                        <div style={{fontSize:12,opacity:0.8,marginTop:4}}>(+{n*30} pts)</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Done */}
          {done && blocage && (
            <div style={{margin:'12px 12px 0',padding:'16px',borderRadius:14,
              background:'#FAEEDA',border:'1.5px solid #EF9F2730'}}>
              <div style={{fontSize:15,fontWeight:700,color:'#633806',marginBottom:8}}>
                📝 {lang==='ar'?'امتحان مطلوب !':'Examen requis !'}
              </div>
              <div style={{fontSize:13,color:'#854F0B',marginBottom:12}}>
                {lang==='ar'?blocage.message_ar:blocage.message_fr}
              </div>
              <button onClick={()=>navigate('resultats_examens', {eleve:selectedEleve, blocage})}
                style={{width:'100%',padding:'12px',background:'#EF9F27',color:'#fff',border:'none',
                  borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'تسجيل نتيجة الامتحان':"Enregistrer le résultat d'examen"}
              </button>
            </div>
          )}
          {done && motivMsg && (
            <div style={{background:'#E1F5EE',borderRadius:14,padding:'24px',textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:8}}>🎉</div>
              <div style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:16}}>
                {motivMsg.msg}
              </div>
              <button onClick={()=>goBack?goBack():navigate('dashboard')}
                style={{padding:'14px 28px',background:'#1D9E75',color:'#fff',
                  border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'رجوع':'Retour'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: 36 }}>
          {typeValidation === 'hizb_complet' ? '🎉' : '✅'}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {typeValidation === 'hizb_complet' ? t(lang,'hizb_valide_titre') : t(lang,'recitation_enregistree')}
        </div>
        {motivMsg && (
          <div style={{ background: motivMsg.color + '15', border: `1px solid ${motivMsg.color}30`, borderRadius: 12, padding: '12px 20px', margin: '0 auto 1.5rem', maxWidth: 400, fontSize: 14, color: motivMsg.color, fontWeight: 500 }}>
            {motivMsg.msg}
          </div>
        )}
        {dureesApprentissage.length > 0 && (
          <div style={{ background: '#E6F1FB', border: '0.5px solid #85B7EB', borderRadius: 10, padding: '10px 16px', margin: '0 auto 1.5rem', maxWidth: 400, fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: '#0C447C', marginBottom: 4 }}>{t(lang,'durees_apprentissage')}</div>
            {(dureesApprentissage||[]).map(d => (
              <div key={d.tomon} style={{ color: '#185FA5' }}>Tomon {d.tomon} : {d.jours} jour{d.jours > 1 ? 's' : ''}</div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, color: '#888', marginBottom: '1.5rem' }}>
          {selectedEleve?.prenom} {selectedEleve?.nom} —
          {typeValidation === 'hizb_complet'
            ? ` Hizb ${etat?.hizbEnCours} validé complet (+100 pts)`
            : ` ${nombreTomon} Tomon validé${nombreTomon > 1 ? 's' : ''} (+${nombreTomon * 10} pts)`}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ maxWidth: 220 }}
            onClick={() => { setDone(false); setStep(1); setSelectedEleve(null); setTomonSelectionnes([]); setEtat(null); setTypeValidation('tomon'); setMotivMsg(null); }}>
            + Nouvelle récitation
          </button>
          <button className="btn-secondary" onClick={() => navigate('fiche', selectedEleve)}>Voir la fiche</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <button style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:16,cursor:"pointer",fontFamily:"inherit"}} style={{ margin: '0 auto' }} onClick={() => goBack?goBack():navigate('dashboard')}>{t(lang,'retour')}</button>
        </div>
      </div>
    );
  }


  return (
    <div>
      <button style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:16,cursor:"pointer",fontFamily:"inherit"}} onClick={() => navigate(selectedEleve ? 'fiche' : 'dashboard', selectedEleve)}>t(lang,'retour')</button>
      <div className="page-title">{t(lang,'enregistrer_recitation_titre')}</div>

      <div className="steps-row">
        {[[lang==='ar'?'الطالب':'Élève', 1], [lang==='ar'?'الاستظهار':'Validation', 2], [lang==='ar'?'تأكيد':'Confirmer', 3]].map(([label, n], i) => (
          <React.Fragment key={n}>
            {i > 0 && <div className={`step-line ${step > n - 1 ? 'done' : ''}`} />}
            <div className="step-item">
              <div className={`step-circle ${step > n ? 'done' : step === n ? 'active' : 'pending'}`}>{step > n ? '✓' : n}</div>
              <div className={`step-label ${step === n ? 'active' : ''}`}>{label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="section-label">{t(lang,'selectionner_eleve')}</div>
          <div className="card">
            <input className="field-input" style={{ marginBottom: 12 }} type="text"
              placeholder={t(lang,'rechercher_eleve')} value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {elevesFiltre.length === 0 && <div className="empty">{t(lang,'aucun_eleve')}</div>}
              {(elevesFiltre||[]).map(e => (
                <div key={e.id} onTouchEnd={()=>selectEleve(e)} onClick={() => selectEleve(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '0.5px solid #e0e0d8', borderRadius: 8, cursor: 'pointer' }}>
                  <Avatar prenom={e.prenom} nom={e.nom} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{e.niveau}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && selectedEleve && etat && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '0.5px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', marginBottom: '1rem' }}>
            <Avatar prenom={selectedEleve.prenom} nom={selectedEleve.nom} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#085041' }}>{selectedEleve.prenom} {selectedEleve.nom}</div>
              <div style={{ fontSize: 12, color: '#0F6E56' }}>Hizb {etat.hizbEnCours} · {etat.tomonDansHizbActuel}/8 · {etat.prochainTomon ? `Prochain : T.${etat.prochainTomon}` : ''}</div>
            </div>
            <button className="action-btn" onClick={() => setStep(1)}>Changer</button>
          </div>

          {/* Info apprentissage du prochain Tomon */}
          {etat.prochainTomon && (() => {
            const appr = apprentissageInfo(etat.prochainTomon);
            if (!appr) return null;
            const jours = Math.round((new Date() - new Date(appr.date_debut)) / (1000 * 60 * 60 * 24));
            return (
              <div style={{ padding: '10px 14px', background: '#E6F1FB', border: '0.5px solid #85B7EB', borderRadius: 8, marginBottom: '1rem', fontSize: 12, color: '#0C447C' }}>
                ⏱ <strong>T.{etat.prochainTomon}</strong> en apprentissage depuis <strong>{jours} jour{jours > 1 ? 's' : ''}</strong>
                {jours > 14 && <span style={{ color: '#E24B4A', marginLeft: 6 }}>⚠️ Apprentissage long</span>}
              </div>
            );
          })()}

          {/* Barre */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Tomon du Hizb {etat.hizbEnCours}</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                <div key={n} style={{ flex: 1, height: 12, borderRadius: 4, background: n < etat.prochainTomon ? '#1D9E75' : tomonSelectionnes.includes(n) ? '#9FE1CB' : '#e8e8e0' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999' }}>
              <span>Validés : {etat.tomonDansHizbActuel}</span>
              {nombreTomon > 0 && <span style={{ color: '#1D9E75', fontWeight: 500 }}>+ {nombreTomon} aujourd'hui</span>}
              <span>Restants : {etat.tomonRestants - nombreTomon}</span>
            </div>
          </div>

          {etat.enAttenteHizbComplet ? (
            <div>
              <div style={{ padding: '12px 14px', background: '#FAEEDA', borderRadius: 8, fontSize: 13, color: '#633806', marginBottom: '1rem' }}>
                ⏳ Les 8 Tomon du Hizb {etat.hizbEnCours} sont validés — valider le Hizb complet pour continuer.
              </div>
              <div className="card" style={{ cursor: 'pointer', border: '2px solid #1D9E75', textAlign: 'center', padding: '1.5rem' }}
                onClick={() => setTypeValidation('hizb_complet')}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1D9E75' }}>Valider le Hizb {etat.hizbEnCours} complet</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>+100 pts bonus</div>
              </div>
              <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => { setTypeValidation('hizb_complet'); setStep(3); }}>Continuer</button>
            </div>
          ) : (
            <div>
              <div className="section-label">Tomon récités — Hizb {etat.hizbEnCours}</div>
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0,1fr))', gap: 6, marginBottom: 12 }}>
                  {[1,2,3,4,5,6,7,8].map(n => {
                    const dejaValide = n < etat.prochainTomon;
                    const selectionne = tomonSelectionnes.includes(n);
                    const inaccessible = n > (etat.prochainTomon + tomonSelectionnes.length);
                    const appr = apprentissageInfo(n);
                    const joursAppr = appr ? Math.round((new Date() - new Date(appr.date_debut)) / (1000 * 60 * 60 * 24)) : null;
                    let bg = '#f9f9f6', border = '0.5px solid #d0d0c8', color = '#1a1a1a', cursor = 'pointer';
                    if (dejaValide) { bg = '#e8e8e0'; color = '#bbb'; cursor = 'not-allowed'; border = '0.5px solid #e0e0d8'; }
                    else if (selectionne) { bg = '#1D9E75'; color = '#fff'; border = '0.5px solid #1D9E75'; }
                    else if (inaccessible) { color = '#ccc'; cursor = 'not-allowed'; }
                    return (
                      <div key={n} onClick={() => !dejaValide && !inaccessible && toggleTomon(n)}
                        style={{ padding: '12px 4px', borderRadius: 8, background: bg, border, color, fontSize: 15, fontWeight: 500, textAlign: 'center', cursor, transition: 'all 0.15s', position: 'relative' }}>
                        {n}
                        {dejaValide && <div style={{ position: 'absolute', top: 3, right: 4, fontSize: 9, color: '#bbb' }}>✓</div>}
                        {joursAppr !== null && !dejaValide && (
                          <div style={{ fontSize: 9, color: selectionne ? 'rgba(255,255,255,0.8)' : '#888', marginTop: 2 }}>{joursAppr}j</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#999', marginBottom: 12, flexWrap: 'wrap' }}>
                  {[['#e8e8e0', 'Déjà validé'], ['#1D9E75', "Récité aujourd'hui"], ['#f9f9f6', 'À venir']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: c, border: '0.5px solid #d0d0c8' }} />{l}
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>Le chiffre sous chaque case = jours d'apprentissage</div>
                </div>

                {posNouvelle && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0faf6', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: '#888' }}>Position atteinte →</span>
                    <strong>Hizb {posNouvelle.hizb}, T.{posNouvelle.tomon}</strong>
                    <span className="badge badge-green">{calcUnite(posNouvelle.tomon)}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#1D9E75' }}>+{nombreTomon * (bareme?.unites?.tomon||0)} pts</span>
                  </div>
                )}

                {etat.tomonDansHizbActuel + nombreTomon === 8 && (
                  <div style={{ padding: '8px 12px', background: '#E1F5EE', borderRadius: 8, fontSize: 12, color: '#085041' }}>
                    🎯 Les 8 Tomon seront complétés — validation Hizb complet nécessaire ensuite.
                  </div>
                )}
              </div>
              <button className="btn-primary" disabled={nombreTomon === 0} onClick={() => setStep(3)}>Continuer</button>
            </div>
          )}
        </div>
      )}

      {step === 3 && selectedEleve && etat && (
        <div>
          <div className="section-label">Récapitulatif</div>
          <div className="recap-card">
            <div className="recap-row"><span className="recap-lbl">{lang==='ar'?'الطالب':'Élève'}</span><span className="recap-val">{selectedEleve.prenom} {selectedEleve.nom}</span></div>
            <div className="recap-row"><span className="recap-lbl">Hizb</span><span className="recap-val">Hizb {etat.hizbEnCours}</span></div>
            {typeValidation === 'tomon' ? (
              <>
                <div className="recap-row">
                  <span className="recap-lbl">{t(lang,'tomon_recites_label')}</span>
                  <span className="recap-val green">T.{tomonSelectionnes[0]} à T.{tomonSelectionnes[tomonSelectionnes.length - 1]} ({nombreTomon} Tomon)</span>
                </div>
                {dureesApprentissage.length > 0 && (
                  <div className="recap-row">
                    <span className="recap-lbl">{t(lang,'durees_apprentissage')}</span>
                    <span className="recap-val" style={{ fontSize: 12 }}>
                      {(dureesApprentissage||[]).map(d => `T.${d.tomon}: ${d.jours}j`).join(' · ')}
                    </span>
                  </div>
                )}
                {posNouvelle && <div className="recap-row"><span className="recap-lbl">Position atteinte</span><span className="recap-val">Hizb {posNouvelle.hizb}, T.{posNouvelle.tomon}</span></div>}
                <div className="recap-row"><span className="recap-lbl">{t(lang,'points_gagnes')}</span><span className="recap-val green">+{nombreTomon * (bareme?.unites?.tomon||0)} pts</span></div>
              </>
            ) : (
              <>
                <div className="recap-row"><span className="recap-lbl">Validation</span><span className="recap-val green">Hizb {etat.hizbEnCours} complet</span></div>
                <div className="recap-row"><span className="recap-lbl">{t(lang,'points_gagnes')}</span><span className="recap-val green">+100 pts</span></div>
                <div className="recap-row"><span className="recap-lbl">Hizb suivant</span><span className="recap-val">Hizb {etat.hizbEnCours + 1} s'ouvre</span></div>
              </>
            )}
            <div className="recap-row"><span className="recap-lbl">{t(lang,'valide_par')}</span><span className="recap-val">{user.prenom} {user.nom}</span></div>
            <div className="recap-row"><span className="recap-lbl">Date & heure</span><span className="recap-val">{new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
          </div>
          <button className="btn-primary" disabled={loading} onClick={confirmer}>
            {loading ? t(lang,'enregistrement') : t(lang,'confirmer')}
          </button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:16,cursor:"pointer",fontFamily:"inherit"}} style={{ margin: '0 auto' }} onClick={() => setStep(2)}>← Modifier</button>
          </div>
        </div>
      )}
    </div>
  );
}
