import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcPosition, calcUnite, formatDate, getInitiales } from '../lib/helpers';

export default function EnregistrerRecitation({ user, eleve: eleveInitial, navigate }) {
  const [step, setStep] = useState(eleveInitial ? 2 : 1);
  const [eleves, setEleves] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEleve, setSelectedEleve] = useState(eleveInitial || null);
  const [totalActuel, setTotalActuel] = useState(0);
  const [nombreTomon, setNombreTomon] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    loadEleves();
    if (eleveInitial) loadTotal(eleveInitial.id);
  }, []);

  const loadEleves = async () => {
    const { data } = await supabase.from('eleves').select('*').order('nom');
    setEleves(data || []);
  };

  const loadTotal = async (eleveId) => {
    const { data } = await supabase.from('validations').select('nombre_tomon').eq('eleve_id', eleveId);
    const total = (data || []).reduce((s, v) => s + v.nombre_tomon, 0);
    setTotalActuel(total);
  };

  const selectEleve = async (e) => {
    setSelectedEleve(e);
    await loadTotal(e.id);
    setNombreTomon(null);
    setStep(2);
  };

  const confirmer = async () => {
    setLoading(true);
    const { error } = await supabase.from('validations').insert({
      eleve_id: selectedEleve.id,
      valide_par: user.id,
      nombre_tomon: nombreTomon,
      date_validation: new Date().toISOString()
    });
    setLoading(false);
    if (!error) setDone(true);
  };

  const posActuelle = selectedEleve ? calcPosition(selectedEleve.hizb_depart, selectedEleve.tomon_depart, totalActuel) : null;
  const posNouvelle = selectedEleve && nombreTomon ? calcPosition(selectedEleve.hizb_depart, selectedEleve.tomon_depart, totalActuel + nombreTomon) : null;

  const elevesFiltre = eleves.filter(e =>
    `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase())
  );

  if (done) {
    return (
      <div>
        <div className="success-screen">
          <div className="success-circle"><div className="checkmark"></div></div>
          <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 8 }}>Récitation enregistrée</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: '1.5rem' }}>
            {selectedEleve?.prenom} {selectedEleve?.nom} — {nombreTomon} Tomon validé{nombreTomon > 1 ? 's' : ''}
          </div>
          <button className="btn-primary" style={{ maxWidth: 260, margin: '0 auto' }} onClick={() => { setDone(false); setStep(1); setSelectedEleve(null); setNombreTomon(null); }}>
            + Nouvelle récitation
          </button>
          <div style={{ marginTop: 12 }}>
            <button className="back-link" style={{ margin: '0 auto' }} onClick={() => navigate('dashboard')}>Retour au tableau de bord</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate(selectedEleve ? 'fiche' : 'dashboard', selectedEleve)}>← Retour</button>
      <div className="page-title">Enregistrer une récitation</div>

      <div className="steps-row">
        {[['Élève', 1], ['Tomon', 2], ['Confirmer', 3]].map(([label, n], i) => (
          <React.Fragment key={n}>
            {i > 0 && <div className={`step-line ${step > n - 1 ? 'done' : ''}`}></div>}
            <div className="step-item">
              <div className={`step-circle ${step > n ? 'done' : step === n ? 'active' : 'pending'}`}>
                {step > n ? '✓' : n}
              </div>
              <div className={`step-label ${step === n ? 'active' : ''}`}>{label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="section-label">Sélectionner l'élève</div>
          <div className="card">
            <input className="field-input" style={{ marginBottom: 12 }} type="text" placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {elevesFiltre.length === 0 && <div className="empty">Aucun élève trouvé.</div>}
              {elevesFiltre.map(e => (
                <div key={e.id} onClick={() => selectEleve(e)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '0.5px solid #e0e0d8', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={ev => ev.currentTarget.style.borderColor = '#1D9E75'}
                  onMouseLeave={ev => ev.currentTarget.style.borderColor = '#e0e0d8'}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{getInitiales(e.prenom, e.nom)}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{e.niveau}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 2 && selectedEleve && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '0.5px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', marginBottom: '1rem' }}>
            <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{getInitiales(selectedEleve.prenom, selectedEleve.nom)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#085041' }}>{selectedEleve.prenom} {selectedEleve.nom}</div>
              <div style={{ fontSize: 12, color: '#0F6E56' }}>Position : Hizb {posActuelle?.hizb}, T.{posActuelle?.tomon}</div>
            </div>
            <button className="action-btn" onClick={() => setStep(1)}>Changer</button>
          </div>

          <div className="section-label">Nombre de Tomon récités</div>
          <div className="card">
            <div className="tomon-grid">
              {[1,2,3,4,5,6,7,8].map(n => (
                <div key={n} className={`tomon-btn ${nombreTomon === n ? 'selected' : ''}`} onClick={() => setNombreTomon(n)}>{n}</div>
              ))}
            </div>
            {posNouvelle && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f9f9f6', borderRadius: 8, fontSize: 13, color: '#888' }}>
                Nouvelle position → <strong style={{ color: '#1a1a1a' }}>Hizb {posNouvelle.hizb}, T.{posNouvelle.tomon}</strong>
                <span className="badge badge-green" style={{ marginLeft: 4 }}>{calcUnite(posNouvelle.tomon)}</span>
              </div>
            )}
          </div>
          <button className="btn-primary" disabled={!nombreTomon} onClick={() => setStep(3)}>Continuer</button>
        </div>
      )}

      {step === 3 && selectedEleve && nombreTomon && (
        <div>
          <div className="section-label">Récapitulatif</div>
          <div className="recap-card">
            <div className="recap-row"><span className="recap-lbl">Élève</span><span className="recap-val">{selectedEleve.prenom} {selectedEleve.nom}</span></div>
            <div className="recap-row"><span className="recap-lbl">Tomon validés</span><span className="recap-val green">{nombreTomon} Tomon</span></div>
            <div className="recap-row"><span className="recap-lbl">Position atteinte</span><span className="recap-val">Hizb {posNouvelle?.hizb}, T.{posNouvelle?.tomon}</span></div>
            <div className="recap-row"><span className="recap-lbl">Validé par</span><span className="recap-val">{user.prenom} {user.nom}</span></div>
            <div className="recap-row"><span className="recap-lbl">Date</span><span className="recap-val">{formatDate(new Date().toISOString())}</span></div>
          </div>
          <button className="btn-primary" disabled={loading} onClick={confirmer}>{loading ? 'Enregistrement...' : 'Confirmer la validation'}</button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="back-link" style={{ margin: '0 auto' }} onClick={() => setStep(2)}>← Modifier</button>
          </div>
        </div>
      )}
    </div>
  );
}
