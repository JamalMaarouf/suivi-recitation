import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcPosition, calcPositionAtteinte, calcUnite, formatDate, getInitiales } from '../lib/helpers';

export default function EnregistrerRecitation({ user, eleve: eleveInitial, navigate }) {
  const [step, setStep] = useState(eleveInitial ? 2 : 1);
  const [eleves, setEleves] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEleve, setSelectedEleve] = useState(eleveInitial || null);
  const [etat, setEtat] = useState(null);
  const [tomonSelectionnes, setTomonSelectionnes] = useState([]);
  const [typeValidation, setTypeValidation] = useState('tomon');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    loadEleves();
    if (eleveInitial) loadValidations(eleveInitial);
  }, []);

  const loadEleves = async () => {
    const { data } = await supabase.from('eleves').select('*').order('nom');
    setEleves(data || []);
  };

  const loadValidations = async (el) => {
    const { data } = await supabase.from('validations').select('*').eq('eleve_id', el.id);
    const e = calcEtatEleve(data || [], el.hizb_depart, el.tomon_depart);
    setEtat(e);
  };

  const selectEleve = async (el) => {
    setSelectedEleve(el);
    setTomonSelectionnes([]);
    setTypeValidation('tomon');
    await loadValidations(el);
    setStep(2);
  };

  // Cliquer sur un tomon : toggle consécutif
  // On peut sélectionner uniquement les tomon consécutifs à partir du prochain
  const toggleTomon = (n) => {
    if (!etat || etat.enAttenteHizbComplet) return;
    const prochain = etat.prochainTomon;
    if (n < prochain) return; // déjà validé, non cliquable

    // Règle consécutive : on peut cocher n seulement si n === prochain + nb déjà sélectionnés
    const maxSelectionnable = prochain + tomonSelectionnes.length;
    if (n > maxSelectionnable) return; // on ne peut pas sauter

    if (tomonSelectionnes.includes(n)) {
      // Décocher — on décoche aussi tout ce qui est après
      setTomonSelectionnes(tomonSelectionnes.filter(t => t < n));
    } else {
      setTomonSelectionnes([...tomonSelectionnes, n]);
    }
  };

  const nombreTomonSelectionnes = tomonSelectionnes.length;

  // Position après validation
  const posNouvelle = selectedEleve && etat && nombreTomonSelectionnes > 0
    ? calcPositionAtteinte(selectedEleve.hizb_depart, selectedEleve.tomon_depart, etat.tomonCumul + nombreTomonSelectionnes)
    : null;

  const confirmer = async () => {
    setLoading(true);
    const insertData = {
      eleve_id: selectedEleve.id,
      valide_par: user.id,
      nombre_tomon: typeValidation === 'hizb_complet' ? 0 : nombreTomonSelectionnes,
      type_validation: typeValidation,
      date_validation: new Date().toISOString()
    };
    if (typeValidation === 'hizb_complet') {
      insertData.hizb_valide = etat.hizbEnCours;
    }
    const { error } = await supabase.from('validations').insert(insertData);
    setLoading(false);
    if (!error) setDone(true);
  };

  const elevesFiltre = eleves.filter(e =>
    `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase())
  );

  if (done) {
    return (
      <div className="success-screen">
        <div className="success-circle"><div className="checkmark"></div></div>
        <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 8 }}>
          {typeValidation === 'hizb_complet' ? 'Hizb complet validé !' : 'Récitation enregistrée'}
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: '1.5rem' }}>
          {selectedEleve?.prenom} {selectedEleve?.nom} —
          {typeValidation === 'hizb_complet'
            ? ` Hizb ${etat?.hizbEnCours} validé complet`
            : ` Tomon ${tomonSelectionnes.join(', ')} du Hizb ${etat?.hizbEnCours}`}
        </div>
        <button className="btn-primary" style={{ maxWidth: 260, margin: '0 auto' }}
          onClick={() => { setDone(false); setStep(1); setSelectedEleve(null); setTomonSelectionnes([]); setEtat(null); setTypeValidation('tomon'); }}>
          + Nouvelle récitation
        </button>
        <div style={{ marginTop: 12 }}>
          <button className="back-link" style={{ margin: '0 auto' }} onClick={() => navigate('dashboard')}>Retour au tableau de bord</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate(selectedEleve ? 'fiche' : 'dashboard', selectedEleve)}>← Retour</button>
      <div className="page-title">Enregistrer une récitation</div>

      <div className="steps-row">
        {[['Élève', 1], ['Validation', 2], ['Confirmer', 3]].map(([label, n], i) => (
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

      {/* STEP 1 */}
      {step === 1 && (
        <div>
          <div className="section-label">Sélectionner l'élève</div>
          <div className="card">
            <input className="field-input" style={{ marginBottom: 12 }} type="text"
              placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {elevesFiltre.length === 0 && <div className="empty">Aucun élève trouvé.</div>}
              {elevesFiltre.map(e => (
                <div key={e.id} onClick={() => selectEleve(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '0.5px solid #e0e0d8', borderRadius: 8, cursor: 'pointer' }}
                  onMouseEnter={ev => ev.currentTarget.style.borderColor = '#1D9E75'}
                  onMouseLeave={ev => ev.currentTarget.style.borderColor = '#e0e0d8'}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{getInitiales(e.prenom, e.nom)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{e.niveau}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#bbb' }}>›</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && selectedEleve && etat && (
        <div>
          {/* Élève sélectionné */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '0.5px solid #1D9E75', borderRadius: 8, background: '#E1F5EE', marginBottom: '1rem' }}>
            <div className="avatar" style={{ width: 36, height: 36, fontSize: 12 }}>{getInitiales(selectedEleve.prenom, selectedEleve.nom)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#085041' }}>{selectedEleve.prenom} {selectedEleve.nom}</div>
              <div style={{ fontSize: 12, color: '#0F6E56' }}>
                Hizb {etat.hizbEnCours} · {etat.tomonDansHizbActuel}/8 Tomon validés
                {etat.prochainTomon && ` · Prochain : Tomon ${etat.prochainTomon}`}
              </div>
            </div>
            <button className="action-btn" onClick={() => setStep(1)}>Changer</button>
          </div>

          {/* Attente Hizb complet */}
          {etat.enAttenteHizbComplet && (
            <div>
              <div style={{ padding: '12px 14px', background: '#FAEEDA', borderRadius: 8, fontSize: 13, color: '#633806', marginBottom: '1rem', lineHeight: 1.6 }}>
                Les 8 Tomon du Hizb <strong>{etat.hizbEnCours}</strong> sont validés.<br />
                L'élève doit réciter le Hizb complet avant d'ouvrir le Hizb <strong>{etat.hizbEnCours + 1}</strong>.
              </div>
              <div className="card"
                style={{ cursor: 'pointer', border: '2px solid #1D9E75', textAlign: 'center', padding: '1.5rem' }}
                onClick={() => setTypeValidation('hizb_complet')}>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#1D9E75', marginBottom: 6 }}>
                  Valider le Hizb {etat.hizbEnCours} complet
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>L'élève a récité les 8 Tomon du Hizb entier</div>
              </div>
              <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => setStep(3)}>Continuer</button>
            </div>
          )}

          {/* Sélecteur Tomon */}
          {!etat.enAttenteHizbComplet && (
            <div>
              <div className="section-label">
                Tomon récités aujourd'hui — Hizb {etat.hizbEnCours}
              </div>

              <div className="card">
                {/* Grille des 8 Tomon */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0,1fr))', gap: 6, marginBottom: 12 }}>
                  {[1,2,3,4,5,6,7,8].map(n => {
                    const dejaValide = n < etat.prochainTomon;
                    const selectionne = tomonSelectionnes.includes(n);
                    const disponible = n >= etat.prochainTomon && n <= (etat.prochainTomon - 1 + tomonSelectionnes.length + 1);
                    const inaccessible = n > (etat.prochainTomon + tomonSelectionnes.length);

                    let bg = '#f9f9f6';
                    let border = '0.5px solid #d0d0c8';
                    let color = '#1a1a1a';
                    let cursor = 'pointer';

                    if (dejaValide) { bg = '#e8e8e0'; color = '#bbb'; cursor = 'not-allowed'; border = '0.5px solid #e0e0d8'; }
                    else if (selectionne) { bg = '#1D9E75'; color = '#fff'; border = '0.5px solid #1D9E75'; }
                    else if (inaccessible) { bg = '#f9f9f6'; color = '#ccc'; cursor = 'not-allowed'; }

                    return (
                      <div key={n}
                        onClick={() => !dejaValide && !inaccessible && toggleTomon(n)}
                        style={{
                          padding: '12px 4px', borderRadius: 8,
                          background: bg, border, color,
                          fontSize: 15, fontWeight: 500,
                          textAlign: 'center', cursor,
                          transition: 'all 0.15s',
                          position: 'relative'
                        }}>
                        {n}
                        {dejaValide && (
                          <div style={{ position: 'absolute', top: 3, right: 4, fontSize: 9, color: '#bbb' }}>✓</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Légende */}
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#999', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#e8e8e0' }}></div>
                    Déjà validé
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#1D9E75' }}></div>
                    Récité aujourd'hui
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f9f9f6', border: '0.5px solid #d0d0c8' }}></div>
                    À venir
                  </div>
                </div>

                {/* Barre de progression */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <div key={n} style={{
                      flex: 1, height: 6, borderRadius: 3,
                      background: n < etat.prochainTomon ? '#1D9E75'
                        : tomonSelectionnes.includes(n) ? '#9FE1CB'
                        : '#e8e8e0'
                    }}></div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999' }}>
                  <span>Validés avant : {etat.tomonDansHizbActuel}</span>
                  {nombreTomonSelectionnes > 0 && <span style={{ color: '#1D9E75', fontWeight: 500 }}>+ {nombreTomonSelectionnes} aujourd'hui</span>}
                  <span>Restants : {etat.tomonRestants - nombreTomonSelectionnes}</span>
                </div>

                {/* Nouvelle position */}
                {posNouvelle && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0faf6', borderRadius: 8, fontSize: 13 }}>
                    <span style={{ color: '#888' }}>Nouvelle position →</span>
                    <strong>Hizb {posNouvelle.hizb}, T.{posNouvelle.tomon}</strong>
                    <span className="badge badge-green">{calcUnite(posNouvelle.tomon)}</span>
                  </div>
                )}

                {/* Avertissement si on complète les 8 */}
                {etat.tomonDansHizbActuel + nombreTomonSelectionnes === 8 && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#E1F5EE', borderRadius: 8, fontSize: 12, color: '#085041' }}>
                    Les 8 Tomon seront complétés — une validation Hizb complet sera nécessaire ensuite.
                  </div>
                )}
              </div>

              <button className="btn-primary" disabled={nombreTomonSelectionnes === 0} onClick={() => setStep(3)}>
                Continuer
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && selectedEleve && etat && (
        <div>
          <div className="section-label">Récapitulatif</div>
          <div className="recap-card">
            <div className="recap-row">
              <span className="recap-lbl">Élève</span>
              <span className="recap-val">{selectedEleve.prenom} {selectedEleve.nom}</span>
            </div>
            <div className="recap-row">
              <span className="recap-lbl">Hizb</span>
              <span className="recap-val">Hizb {etat.hizbEnCours}</span>
            </div>
            {typeValidation === 'tomon' && (
              <>
                <div className="recap-row">
                  <span className="recap-lbl">Tomon récités</span>
                  <span className="recap-val green">
                    Tomon {tomonSelectionnes.join(', ')} ({nombreTomonSelectionnes} Tomon)
                  </span>
                </div>
                {posNouvelle && (
                  <div className="recap-row">
                    <span className="recap-lbl">Position atteinte</span>
                    <span className="recap-val">Hizb {posNouvelle.hizb}, T.{posNouvelle.tomon}</span>
                  </div>
                )}
              </>
            )}
            {typeValidation === 'hizb_complet' && (
              <div className="recap-row">
                <span className="recap-lbl">Validation</span>
                <span className="recap-val green">Hizb {etat.hizbEnCours} complet → Hizb {etat.hizbEnCours + 1} s'ouvre</span>
              </div>
            )}
            <div className="recap-row">
              <span className="recap-lbl">Validé par</span>
              <span className="recap-val">{user.prenom} {user.nom}</span>
            </div>
            <div className="recap-row">
              <span className="recap-lbl">Date</span>
              <span className="recap-val">{formatDate(new Date().toISOString())}</span>
            </div>
          </div>
          <button className="btn-primary" disabled={loading} onClick={confirmer}>
            {loading ? 'Enregistrement...' : 'Confirmer la validation'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="back-link" style={{ margin: '0 auto' }} onClick={() => setStep(2)}>← Modifier</button>
          </div>
        </div>
      )}
    </div>
  );
}
