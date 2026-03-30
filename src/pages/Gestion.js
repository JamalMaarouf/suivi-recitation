import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales, calcEtatEleve, calcPoints } from '../lib/helpers';
import { t } from '../lib/i18n';

function Avatar({ prenom, nom, size = 28 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

// Sélecteur visuel Hizb + Tomon pour les acquis antérieurs
function HizbTomonSelector({ hizb, tomon, onHizbChange, onTomonChange, lang }) {
  return (
    <div style={{ background: '#f9f9f6', borderRadius: 12, padding: '1rem', border: '0.5px solid #e0e0d8' }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 10, textAlign: 'center' }}>{t(lang, 'acquis_aide')}</div>

      {/* Hizb selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }}>{t(lang, 'hizb_1_60')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => onHizbChange(Math.max(1, hizb - 1))}
            style={{ width: 32, height: 32, border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16 }}>-</button>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
            {Array.from({ length: 60 }, (_, i) => i + 1).map(n => (
              <div key={n} onClick={() => onHizbChange(n)}
                style={{ height: 28, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: n === hizb ? 700 : 400, cursor: 'pointer', background: n === hizb ? '#1D9E75' : n < hizb ? '#E1F5EE' : '#f0f0ec', color: n === hizb ? '#fff' : n < hizb ? '#085041' : '#999', transition: 'all 0.1s' }}>
                {n}
              </div>
            ))}
          </div>
          <button onClick={() => onHizbChange(Math.min(60, hizb + 1))}
            style={{ width: 32, height: 32, border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16 }}>+</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 14, fontWeight: 700, color: '#1D9E75' }}>Hizb {hizb}</div>
      </div>

      {/* Tomon selector */}
      <div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }}>{t(lang, 'tomon_1_8')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
          {[1,2,3,4,5,6,7,8].map(n => (
            <div key={n} onClick={() => onTomonChange(n)}
              style={{ height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: n === tomon ? 700 : 400, cursor: 'pointer', background: n === tomon ? '#1D9E75' : n < tomon ? '#E1F5EE' : '#f0f0ec', color: n === tomon ? '#fff' : n < tomon ? '#085041' : '#999', border: `0.5px solid ${n === tomon ? '#1D9E75' : '#e0e0d8'}`, transition: 'all 0.1s' }}>
              {n}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 12, color: '#888' }}>
          
          {hizb > 1 || tomon > 1
            ? <><span style={{color:'#1D9E75',fontWeight:600}}>{(hizb-1)*8+(tomon-1)} {t(lang,'tomon_abrev')}</span> + <span style={{color:'#EF9F27',fontWeight:600}}>{hizb-1} Hizb {t(lang,'hizb_complets')}</span></>
            : <span>{t(lang,'hizb_depart')}: 1, {t(lang,'tomon_depart')}: 1</span>}
        </div>
      </div>

      {/* Aperçu des points correspondants aux acquis */}
      {(hizb > 1 || tomon > 1) && (() => {
        const tomonAcquis = (hizb - 1) * 8 + (tomon - 1);
        const hizbComplets = hizb - 1;
        const pts = calcPoints(tomonAcquis, hizbComplets, [], tomonAcquis, hizbComplets);
        return (
          <div style={{marginTop:10,background:'#E1F5EE',borderRadius:10,padding:'12px',textAlign:'center',border:'0.5px solid #9FE1CB'}}>
            <div style={{fontSize:11,color:'#0F6E56',marginBottom:4,fontWeight:600}}>
              🎓 {lang==='ar'?'النقاط المقابلة للمكتسبات السابقة':lang==='en'?'Points for prior achievements':'Points correspondants aux acquis antérieurs'}
            </div>
            <div style={{fontSize:26,fontWeight:800,color:'#085041',letterSpacing:'-1px'}}>
              {pts.total.toLocaleString()} {t(lang,'pts_abrev')}
            </div>
            <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:8,flexWrap:'wrap'}}>
              {[
                {l:t(lang,'tomon_abrev'),v:pts.ptsTomon,sub:`${tomonAcquis}×10`},
                {l:'Roboe',v:pts.ptsRoboe,sub:`${pts.details.nbRoboe}×25`},
                {l:'Nisf',v:pts.ptsNisf,sub:`${pts.details.nbNisf}×60`},
                {l:t(lang,'hizb_abrev'),v:pts.ptsHizb,sub:`${hizbComplets}×100`},
              ].map(k=>(
                <div key={k.l} style={{background:'#fff',borderRadius:8,padding:'6px 10px',minWidth:55,textAlign:'center'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1D9E75'}}>{k.v}</div>
                  <div style={{fontSize:10,color:'#888'}}>{k.l}</div>
                  <div style={{fontSize:9,color:'#bbb'}}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:10,color:'#0F6E56',marginTop:6,opacity:0.8}}>
              {lang==='ar' ? 'ستُحسب هذه النقاط تلقائياً عند إضافة الطالب' : lang==='en' ? 'These points are automatically counted when the student is added' : "Ces points sont automatiquement comptabilisés à l'ajout"}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function Gestion({ user, navigate, lang = 'fr' }) {
  const [tab, setTab] = useState('eleves');
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editEleve, setEditEleve] = useState(null);
  const [showAcquisSelector, setShowAcquisSelector] = useState(false);
  const [editShowAcquisSelector, setEditShowAcquisSelector] = useState(false);

  const [newEleve, setNewEleve] = useState({ prenom: '', nom: '', niveau: 'Débutant', code_niveau: '1', eleve_id_ecole: '', instituteur_referent_id: '', hizb_depart: 1, tomon_depart: 1 });
  const [newInst, setNewInst] = useState({ prenom: '', nom: '', identifiant: '', mot_de_passe: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: e } = await supabase.from('eleves').select('*').order('nom');
    const { data: i } = await supabase.from('utilisateurs').select('*').eq('role', 'instituteur').order('nom');
    setEleves(e || []);
    setInstituteurs(i || []);
    setLoading(false);
  };

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const ajouterEleve = async () => {
    if (!newEleve.prenom || !newEleve.nom) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    const { error } = await supabase.from('eleves').insert({
      prenom: newEleve.prenom, nom: newEleve.nom, niveau: newEleve.niveau,
      code_niveau: newEleve.code_niveau || '1',
      eleve_id_ecole: newEleve.eleve_id_ecole || null,
      instituteur_referent_id: newEleve.instituteur_referent_id || null,
      hizb_depart: parseInt(newEleve.hizb_depart) || 1,
      tomon_depart: parseInt(newEleve.tomon_depart) || 1
    });
    if (error) return showMsg('error', t(lang, 'erreur_ajout'));
    showMsg('success', t(lang, 'eleve_ajoute'));
    setNewEleve({ prenom: '', nom: '', niveau: 'Débutant', instituteur_referent_id: '', hizb_depart: 1, tomon_depart: 1 });
    setShowAcquisSelector(false);
    loadData();
  };

  const modifierEleve = async () => {
    if (!editEleve.prenom || !editEleve.nom) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    const { error } = await supabase.from('eleves').update({
      prenom: editEleve.prenom, nom: editEleve.nom, niveau: editEleve.niveau,
      code_niveau: editEleve.code_niveau || '1',
      eleve_id_ecole: editEleve.eleve_id_ecole || null,
      instituteur_referent_id: editEleve.instituteur_referent_id || null,
      hizb_depart: parseInt(editEleve.hizb_depart) || 1,
      tomon_depart: parseInt(editEleve.tomon_depart) || 1
    }).eq('id', editEleve.id);
    if (error) return showMsg('error', t(lang, 'erreur_ajout'));
    showMsg('success', t(lang, 'eleve_modifie'));
    setEditEleve(null);
    setEditShowAcquisSelector(false);
    loadData();
  };

  const supprimerEleve = async (id) => {
    if (!window.confirm(t(lang, 'supprimer_eleve_confirm'))) return;
    await supabase.from('validations').delete().eq('eleve_id', id);
    await supabase.from('apprentissages').delete().eq('eleve_id', id);
    await supabase.from('objectifs').delete().eq('eleve_id', id);
    await supabase.from('eleves').delete().eq('id', id);
    showMsg('success', t(lang, 'eleve_retire'));
    loadData();
  };

  const ajouterInstituteur = async () => {
    if (!newInst.prenom || !newInst.nom || !newInst.identifiant || !newInst.mot_de_passe)
      return showMsg('error', t(lang, 'tous_champs_obligatoires'));
    const { error } = await supabase.from('utilisateurs').insert({
      prenom: newInst.prenom, nom: newInst.nom,
      identifiant: newInst.identifiant, mot_de_passe: newInst.mot_de_passe, role: 'instituteur'
    });
    if (error) return showMsg('error', error.message.includes('unique') ? t(lang, 'identifiant_utilise') : t(lang, 'erreur_ajout'));
    showMsg('success', t(lang, 'instituteur_ajoute'));
    setNewInst({ prenom: '', nom: '', identifiant: '', mot_de_passe: '' });
    loadData();
  };

  const supprimerInstituteur = async (id) => {
    if (!window.confirm(t(lang, 'supprimer_instituteur_confirm'))) return;
    await supabase.from('utilisateurs').delete().eq('id', id);
    showMsg('success', t(lang, 'instituteur_retire'));
    loadData();
  };

  const instNom = (id) => { const i = instituteurs.find(x => x.id === id); return i ? `${i.prenom} ${i.nom}` : '—'; };
  const niveaux = [
    { value: 'Débutant', label: t(lang, 'debutant') },
    { value: 'Intermédiaire', label: t(lang, 'intermediaire') },
    { value: 'Avancé', label: t(lang, 'avance') },
  ];

  return (
    <div>
      <div className="page-title">{t(lang, 'gestion')}</div>
      {msg.text && <div className={msg.type === 'error' ? 'error-box' : 'success-box'}>{msg.text}</div>}

      <div className="tabs-row">
        <div className={`tab ${tab === 'eleves' ? 'active' : ''}`} onClick={() => setTab('eleves')}>{t(lang, 'eleves')}</div>
        <div className={`tab ${tab === 'instituteurs' ? 'active' : ''}`} onClick={() => setTab('instituteurs')}>{t(lang, 'instituteurs')}</div>
      </div>

      {tab === 'eleves' && (
        <div>
          {/* Formulaire ajout / modification */}
          {!editEleve ? (
            <>
              <div className="section-label">{t(lang, 'ajouter_eleve')}</div>
              <div className="card">
                <div className="form-grid">
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'prenom')}</label>
                    <input className="field-input" value={newEleve.prenom} onChange={e => setNewEleve({ ...newEleve, prenom: e.target.value })} placeholder={t(lang, 'prenom')} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'nom_label')}</label>
                    <input className="field-input" value={newEleve.nom} onChange={e => setNewEleve({ ...newEleve, nom: e.target.value })} placeholder={t(lang, 'nom_label')} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'niveau')}</label>
                    <select className="field-select" value={newEleve.niveau} onChange={e => setNewEleve({ ...newEleve, niveau: e.target.value })}>
                      {niveaux.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المستوى الدراسي':lang==='en'?'Class level':'Niveau scolaire'}</label>
                    <select className="field-select" value={newEleve.code_niveau} onChange={e => setNewEleve({ ...newEleve, code_niveau: e.target.value })}>
                      <option value="5B">5B — {lang==='ar'?'تمهيدي':lang==='en'?'Preschool':'Préscolaire'}</option>
                      <option value="5A">5A — {lang==='ar'?'ابتدائي 1-2':lang==='en'?'Primary 1-2':'Primaire 1-2'}</option>
                      <option value="2M">2M — {lang==='ar'?'ابتدائي 3-4':lang==='en'?'Primary 3-4':'Primaire 3-4'}</option>
                      <option value="2">2 — {lang==='ar'?'ابتدائي 5-6':lang==='en'?'Primary 5-6':'Primaire 5-6'}</option>
                      <option value="1">1 — {lang==='ar'?'إعدادي/ثانوي':lang==='en'?'Middle/High school':'Collège/Lycée'}</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم تعريف الطالب':lang==='en'?'Student ID':'ID Élève'}</label>
                    <input className="field-input" value={newEleve.eleve_id_ecole} onChange={e => setNewEleve({ ...newEleve, eleve_id_ecole: e.target.value })} placeholder={lang==='ar'?'رقم التعريف (اختياري)':lang==='en'?'Student ID (optional)':'ID défini par la direction (optionnel)'}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'referent')}</label>
                    <select className="field-select" value={newEleve.instituteur_referent_id} onChange={e => setNewEleve({ ...newEleve, instituteur_referent_id: e.target.value })}>
                      <option value="">{t(lang, 'choisir')}</option>
                      {instituteurs.map(i => <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                    </select>
                  </div>
                </div>

                {/* Acquis antérieurs */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label className="field-lbl" style={{ margin: 0 }}>{t(lang, 'acquis_anterieurs')}</label>
                    <button onClick={() => setShowAcquisSelector(!showAcquisSelector)}
                      style={{ padding: '4px 12px', border: '0.5px solid #e0e0d8', borderRadius: 6, background: showAcquisSelector ? '#E1F5EE' : '#fff', fontSize: 11, cursor: 'pointer', color: showAcquisSelector ? '#085041' : '#666' }}>
                      {showAcquisSelector ? '▲ Réduire' : `▼ Hizb ${newEleve.hizb_depart}, T.${newEleve.tomon_depart}`}
                    </button>
                  </div>
                  {showAcquisSelector && (
                    <HizbTomonSelector
                      hizb={newEleve.hizb_depart} tomon={newEleve.tomon_depart} lang={lang}
                      onHizbChange={h => setNewEleve({ ...newEleve, hizb_depart: h })}
                      onTomonChange={t => setNewEleve({ ...newEleve, tomon_depart: t })}
                    />
                  )}
                </div>

                <button className="btn-primary" onClick={ajouterEleve}>{t(lang, 'ajouter_eleve_btn')}</button>
              </div>
            </>
          ) : (
            <>
              <div className="section-label">{t(lang, 'modifier_eleve')}</div>
              <div className="card">
                <div className="form-grid">
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'prenom')}</label>
                    <input className="field-input" value={editEleve.prenom} onChange={e => setEditEleve({ ...editEleve, prenom: e.target.value })} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'nom_label')}</label>
                    <input className="field-input" value={editEleve.nom} onChange={e => setEditEleve({ ...editEleve, nom: e.target.value })} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'niveau')}</label>
                    <select className="field-select" value={editEleve.niveau} onChange={e => setEditEleve({ ...editEleve, niveau: e.target.value })}>
                      {niveaux.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المستوى الدراسي':lang==='en'?'Class level':'Niveau scolaire'}</label>
                    <select className="field-select" value={editEleve.code_niveau||'1'} onChange={e => setEditEleve({ ...editEleve, code_niveau: e.target.value })}>
                      <option value="5B">5B — {lang==='ar'?'تمهيدي':lang==='en'?'Preschool':'Préscolaire'}</option>
                      <option value="5A">5A — {lang==='ar'?'ابتدائي 1-2':lang==='en'?'Primary 1-2':'Primaire 1-2'}</option>
                      <option value="2M">2M — {lang==='ar'?'ابتدائي 3-4':lang==='en'?'Primary 3-4':'Primaire 3-4'}</option>
                      <option value="2">2 — {lang==='ar'?'ابتدائي 5-6':lang==='en'?'Primary 5-6':'Primaire 5-6'}</option>
                      <option value="1">1 — {lang==='ar'?'إعدادي/ثانوي':lang==='en'?'Middle/High school':'Collège/Lycée'}</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم تعريف الطالب':lang==='en'?'Student ID':'ID Élève'}</label>
                    <input className="field-input" value={editEleve.eleve_id_ecole||''} onChange={e => setEditEleve({ ...editEleve, eleve_id_ecole: e.target.value })} placeholder={lang==='ar'?'رقم التعريف':lang==='en'?'Student ID':'ID défini par la direction'}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'referent')}</label>
                    <select className="field-select" value={editEleve.instituteur_referent_id || ''} onChange={e => setEditEleve({ ...editEleve, instituteur_referent_id: e.target.value })}>
                      <option value="">{t(lang, 'choisir')}</option>
                      {instituteurs.map(i => <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label className="field-lbl" style={{ margin: 0 }}>{t(lang, 'acquis_anterieurs')}</label>
                    <button onClick={() => setEditShowAcquisSelector(!editShowAcquisSelector)}
                      style={{ padding: '4px 12px', border: '0.5px solid #e0e0d8', borderRadius: 6, background: editShowAcquisSelector ? '#E1F5EE' : '#fff', fontSize: 11, cursor: 'pointer', color: editShowAcquisSelector ? '#085041' : '#666' }}>
                      {editShowAcquisSelector ? '▲ Réduire' : `▼ Hizb ${editEleve.hizb_depart}, T.${editEleve.tomon_depart}`}
                    </button>
                  </div>
                  {editShowAcquisSelector && (
                    <HizbTomonSelector
                      hizb={editEleve.hizb_depart} tomon={editEleve.tomon_depart} lang={lang}
                      onHizbChange={h => setEditEleve({ ...editEleve, hizb_depart: h })}
                      onTomonChange={t => setEditEleve({ ...editEleve, tomon_depart: t })}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={modifierEleve}>{t(lang, 'enregistrer_modifications')}</button>
                  <button className="btn-secondary" onClick={() => { setEditEleve(null); setEditShowAcquisSelector(false); }}>{t(lang, 'annuler')}</button>
                </div>
              </div>
            </>
          )}

          {/* Liste élèves */}
          <div className="section-label">{t(lang, 'eleves_inscrits')} ({eleves.length})</div>
          {loading ? <div className="loading">...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{width:'28%'}}>{t(lang, 'eleve')}</th>
                  <th style={{width:'16%'}}>{t(lang, 'niveau')}</th>
                  <th style={{width:'20%'}}>{t(lang, 'referent')}</th>
                  <th style={{width:'22%'}}>{t(lang, 'acquis_anterieurs')}</th>
                  <th style={{width:'14%'}}></th>
                </tr></thead>
                <tbody>
                  {eleves.length === 0 && <tr><td colSpan={5} className="empty">{t(lang, 'aucun_eleve')}</td></tr>}
                  {eleves.map(e => (
                    <tr key={e.id} style={{ background: editEleve?.id === e.id ? '#E1F5EE' : '' }}>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={e.prenom} nom={e.nom}/>{e.prenom} {e.nom}</div></td>
                      <td><span className={`badge ${e.niveau==='Avancé'||e.niveau==='متقدم'||e.niveau==='Advanced'?'badge-green':e.niveau==='Intermédiaire'||e.niveau==='متوسط'||e.niveau==='Intermediate'?'badge-blue':'badge-amber'}`} style={{fontSize:10}}>{e.niveau}</span></td>
                      <td style={{fontSize:12,color:'#888'}}>{instNom(e.instituteur_referent_id)}</td>
                      <td>
                        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                          <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:'#E1F5EE',color:'#085041'}}>{e.code_niveau||'1'}</span>
                          {e.eleve_id_ecole&&<span style={{fontSize:11,color:'#888'}}>#{e.eleve_id_ecole}</span>}
                        </div>
                        {['1','2','2M'].includes(e.code_niveau||'1')&&<div style={{fontSize:10,color:'#bbb',marginTop:2}}>Hizb {e.hizb_depart}, T.{e.tomon_depart}</div>}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="action-btn" onClick={() => { setEditEleve({...e}); setEditShowAcquisSelector(false); window.scrollTo(0,0); }}>{t(lang, 'modifier_btn')}</button>
                          <button className="action-btn danger" onClick={() => supprimerEleve(e.id)}>{t(lang, 'retirer')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'instituteurs' && (
        <div>
          <div className="section-label">{t(lang, 'ajouter_instituteur')}</div>
          <div className="card">
            <div className="form-grid">
              <div className="field-group"><label className="field-lbl">{t(lang, 'prenom')}</label><input className="field-input" value={newInst.prenom} onChange={e => setNewInst({...newInst,prenom:e.target.value})} placeholder={t(lang,'prenom')}/></div>
              <div className="field-group"><label className="field-lbl">{t(lang, 'nom_label')}</label><input className="field-input" value={newInst.nom} onChange={e => setNewInst({...newInst,nom:e.target.value})} placeholder={t(lang,'nom_label')}/></div>
              <div className="field-group"><label className="field-lbl">{t(lang, 'identifiant_label')}</label><input className="field-input" value={newInst.identifiant} onChange={e => setNewInst({...newInst,identifiant:e.target.value})} placeholder="ex: m.karim"/></div>
              <div className="field-group"><label className="field-lbl">{t(lang, 'mot_de_passe')}</label><input className="field-input" type="password" value={newInst.mot_de_passe} onChange={e => setNewInst({...newInst,mot_de_passe:e.target.value})} placeholder="••••••••"/></div>
            </div>
            <button className="btn-primary" onClick={ajouterInstituteur}>{t(lang, 'ajouter_instituteur_btn')}</button>
          </div>

          <div className="section-label">{t(lang, 'instituteurs_actifs')} ({instituteurs.length})</div>
          {loading ? <div className="loading">...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{width:'40%'}}>{t(lang, 'nom_label')}</th>
                  <th style={{width:'40%'}}>{t(lang, 'identifiant_label')}</th>
                  <th style={{width:'20%'}}></th>
                </tr></thead>
                <tbody>
                  {instituteurs.length === 0 && <tr><td colSpan={3} className="empty">{t(lang, 'aucun_instituteur')}</td></tr>}
                  {instituteurs.map(i => (
                    <tr key={i.id}>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={i.prenom} nom={i.nom}/>{i.prenom} {i.nom}</div></td>
                      <td style={{fontSize:12,color:'#888'}}>{i.identifiant}</td>
                      <td><button className="action-btn danger" onClick={() => supprimerInstituteur(i.id)}>{t(lang, 'retirer')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
