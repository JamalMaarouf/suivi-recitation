import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcPositionAtteinte, calcUnite, formatDate, getInitiales, motivationMsg } from '../lib/helpers';

function Avatar({ prenom, nom, size = 36, bg = '#E1F5EE', color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function EnregistrerRecitation({ user, eleve: eleveInitial, navigate }) {
  const [step, setStep] = useState(eleveInitial ? 2 : 1);
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
  }, []);

  const loadEleves = async () => {
    const { data } = await supabase.from('eleves').select('*').order('nom');
    setEleves(data || []);
  };

  const loadValidations = async (el) => {
    const [{ data: vals }, { data: appr }] = await Promise.all([
      supabase.from('validations').select('*').eq('eleve_id', el.id),
      supabase.from('apprentissages').select('*').eq('eleve_id', el.id)
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
      valide_par: user.id,
      nombre_tomon: typeValidation === 'hizb_complet' ? 0 : nombreTomon,
      type_validation: typeValidation,
      date_validation: new Date().toISOString(),
      tomon_debut: typeValidation === 'tomon' ? etat.prochainTomon : null,
      hizb_validation: typeValidation === 'tomon' ? etat.hizbEnCours : null
    };
    if (typeValidation === 'hizb_complet') insertData.hizb_valide = etat.hizbEnCours;
    const { error } = await supabase.from('validations').insert(insertData);

    if (!error && typeValidation === 'tomon') {
      // Enregistrer l'apprentissage du prochain Tomon
      const prochainApresValidation = etat.prochainTomon + nombreTomon;
      if (prochainApresValidation <= 8) {
        const existant = apprentissages.find(a => a.hizb === etat.hizbEnCours && a.tomon === prochainApresValidation);
        if (!existant) {
          await supabase.from('apprentissages').insert({
            eleve_id: selectedEleve.id,
            hizb: etat.hizbEnCours,
            tomon: prochainApresValidation,
            date_debut: new Date().toISOString()
          });
        }
      }
    }

    setLoading(false);
    if (!error) {
      const msg = motivationMsg(nombreTomon, etat, typeValidation === 'hizb_complet');
      setMotivMsg(msg);
      setDone(true);
    }
  };

  const elevesFiltre = eleves.filter(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase()));

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: 36 }}>
          {typeValidation === 'hizb_complet' ? '🎉' : '✅'}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {typeValidation === 'hizb_complet' ? 'Hizb complet validé !' : 'Récitation enregistrée !'}
        </div>
        {motivMsg && (
          <div style={{ background: motivMsg.color + '15', border: `1px solid ${motivMsg.color}30`, borderRadius: 12, padding: '12px 20px', margin: '0 auto 1.5rem', maxWidth: 400, fontSize: 14, color: motivMsg.color, fontWeight: 500 }}>
            {motivMsg.msg}
          </div>
        )}
        {dureesApprentissage.length > 0 && (
          <div style={{ background: '#E6F1FB', border: '0.5px solid #85B7EB', borderRadius: 10, padding: '10px 16px', margin: '0 auto 1.5rem', maxWidth: 400, fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: '#0C447C', marginBottom: 4 }}>⏱ Durées d'apprentissage</div>
            {dureesApprentissage.map(d => (
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
          <div className="section-label">Sélectionner l'élève</div>
          <div className="card">
            <input className="field-input" style={{ marginBottom: 12 }} type="text"
              placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {elevesFiltre.length === 0 && <div className="empty">Aucun élève.</div>}
              {elevesFiltre.map(e => (
                <div key={e.id} onClick={() => selectEleve(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '0.5px solid #e0e0d8', borderRadius: 8, cursor: 'pointer' }}
                  onMouseEnter={ev => ev.currentTarget.style.borderColor = '#1D9E75'}
                  onMouseLeave={ev => ev.currentTarget.style.borderColor = '#e0e0d8'}>
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
              <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => setStep(3)}>Continuer</button>
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
                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#1D9E75' }}>+{nombreTomon * 10} pts</span>
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
            <div className="recap-row"><span className="recap-lbl">Élève</span><span className="recap-val">{selectedEleve.prenom} {selectedEleve.nom}</span></div>
            <div className="recap-row"><span className="recap-lbl">Hizb</span><span className="recap-val">Hizb {etat.hizbEnCours}</span></div>
            {typeValidation === 'tomon' ? (
              <>
                <div className="recap-row">
                  <span className="recap-lbl">Tomon récités</span>
                  <span className="recap-val green">T.{tomonSelectionnes[0]} à T.{tomonSelectionnes[tomonSelectionnes.length - 1]} ({nombreTomon} Tomon)</span>
                </div>
                {dureesApprentissage.length > 0 && (
                  <div className="recap-row">
                    <span className="recap-lbl">Durées apprentissage</span>
                    <span className="recap-val" style={{ fontSize: 12 }}>
                      {dureesApprentissage.map(d => `T.${d.tomon}: ${d.jours}j`).join(' · ')}
                    </span>
                  </div>
                )}
                {posNouvelle && <div className="recap-row"><span className="recap-lbl">Position atteinte</span><span className="recap-val">Hizb {posNouvelle.hizb}, T.{posNouvelle.tomon}</span></div>}
                <div className="recap-row"><span className="recap-lbl">Points gagnés</span><span className="recap-val green">+{nombreTomon * 10} pts</span></div>
              </>
            ) : (
              <>
                <div className="recap-row"><span className="recap-lbl">Validation</span><span className="recap-val green">Hizb {etat.hizbEnCours} complet</span></div>
                <div className="recap-row"><span className="recap-lbl">Points gagnés</span><span className="recap-val green">+100 pts</span></div>
                <div className="recap-row"><span className="recap-lbl">Hizb suivant</span><span className="recap-val">Hizb {etat.hizbEnCours + 1} s'ouvre</span></div>
              </>
            )}
            <div className="recap-row"><span className="recap-lbl">Validé par</span><span className="recap-val">{user.prenom} {user.nom}</span></div>
            <div className="recap-row"><span className="recap-lbl">Date & heure</span><span className="recap-val">{new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
          </div>
          <button className="btn-primary" disabled={loading} onClick={confirmer}>
            {loading ? 'Enregistrement...' : '✓ Confirmer la validation'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="back-link" style={{ margin: '0 auto' }} onClick={() => setStep(2)}>← Modifier</button>
          </div>
        </div>
      )}
    </div>
  );
}
