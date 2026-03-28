import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcPositionAtteinte, calcUnite, formatDate, getInitiales, scoreLabel } from '../lib/helpers';

function Avatar({ prenom, nom, size = 44, bg = '#E1F5EE', color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: size * 0.33, flexShrink: 0 }}>
      {((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase()}
    </div>
  );
}

export default function FicheEleve({ eleve, user, navigate }) {
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instituteurNom, setInstituteurNom] = useState('—');
  const [etat, setEtat] = useState(null);

  useEffect(() => { loadData(); }, [eleve.id]);

  const loadData = async () => {
    setLoading(true);
    const { data: vals } = await supabase
      .from('validations')
      .select('*, valideur:valide_par(prenom, nom)')
      .eq('eleve_id', eleve.id)
      .order('date_validation', { ascending: false });

    if (eleve.instituteur_referent_id) {
      const { data: inst } = await supabase.from('utilisateurs').select('prenom, nom').eq('id', eleve.instituteur_referent_id).single();
      if (inst) setInstituteurNom(`${inst.prenom} ${inst.nom}`);
    }

    const e = calcEtatEleve(vals || [], eleve.hizb_depart, eleve.tomon_depart);
    setEtat(e);
    setValidations(vals || []);
    setLoading(false);
  };

  const sl = etat ? scoreLabel(etat.points.total) : { color: '#888', bg: '#f0f0ec', label: '—' };

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>← Retour au tableau de bord</button>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {/* Header card */}
          <div style={{ background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 16, padding: '1.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <Avatar prenom={eleve.prenom} nom={eleve.nom} size={56} bg={sl.bg} color={sl.color} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{eleve.prenom} {eleve.nom}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{eleve.niveau} · {instituteurNom}</div>
                <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: sl.bg, color: sl.color }}>{sl.label}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: sl.color }}>{etat?.points.total.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#888' }}>points</div>
              </div>
            </div>

            {/* Détail points */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { lbl: 'Pts Tomon', val: etat?.points.ptsTomon, sublbl: `${etat?.tomonCumul} × 10` },
                { lbl: 'Pts Roboe', val: etat?.points.ptsRoboe, sublbl: `${etat?.points.details.nbRoboe} × 25` },
                { lbl: 'Pts Nisf', val: etat?.points.ptsNisf, sublbl: `${etat?.points.details.nbNisf} × 60` },
                { lbl: 'Pts Hizb', val: etat?.points.ptsHizb, sublbl: `${etat?.points.details.nbHizb} × 100` },
              ].map(p => (
                <div key={p.lbl} style={{ background: '#f9f9f6', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{p.val}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{p.lbl}</div>
                  <div style={{ fontSize: 10, color: '#bbb' }}>{p.sublbl}</div>
                </div>
              ))}
            </div>

            {/* Infos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, borderTop: '0.5px solid #e8e8e0', paddingTop: 12 }}>
              <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Point de départ</div><div style={{ fontSize: 13 }}>Hizb {eleve.hizb_depart}, T.{eleve.tomon_depart}</div></div>
              <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Hizb complets</div><div style={{ fontSize: 13 }}>{etat?.hizbsComplets.size} Hizb</div></div>
              <div><div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Total Tomon</div><div style={{ fontSize: 13 }}>{etat?.tomonCumul} Tomon</div></div>
            </div>
          </div>

          {/* Position actuelle */}
          <div className="section-label">Position actuelle</div>
          <div className="position-card">
            <div className="pos-block">
              <div className="pos-val">{etat?.hizbEnCours}</div>
              <div className="pos-lbl">Hizb en cours</div>
            </div>
            <div className="pos-block">
              <div className="pos-val">{etat?.tomonDansHizbActuel}/8</div>
              <div className="pos-lbl">Tomon validés</div>
            </div>
            <div className="pos-block">
              <div className="pos-val" style={{ fontSize: 16 }}>
                {etat?.enAttenteHizbComplet ? 'Hizb à valider' : etat?.prochainTomon ? `T.${etat.prochainTomon} prochain` : '—'}
              </div>
              <div className="pos-lbl">Statut</div>
            </div>
          </div>

          {/* Barre Tomon */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 8 }}>
              <span>Progression Hizb {etat?.hizbEnCours}</span>
              <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{etat?.tomonDansHizbActuel} / 8 Tomon</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                <div key={n} style={{ flex: 1, height: 12, borderRadius: 4, background: n <= (etat?.tomonDansHizbActuel||0) ? (etat?.enAttenteHizbComplet ? '#EF9F27' : '#1D9E75') : '#e8e8e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {n <= (etat?.tomonDansHizbActuel||0) && <span style={{ fontSize: 8, color: '#fff' }}>✓</span>}
                </div>
              ))}
            </div>
            {etat?.enAttenteHizbComplet && (
              <div style={{ padding: '8px 12px', background: '#FAEEDA', borderRadius: 8, fontSize: 12, color: '#633806' }}>
                Les 8 Tomon sont validés — en attente de la validation du Hizb {etat?.hizbEnCours} complet.
              </div>
            )}
          </div>

          {/* Historique */}
          <div className="section-label">Historique des récitations</div>
          {validations.length === 0 ? <div className="empty">Aucune récitation enregistrée.</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{width:'22%'}}>Date</th>
                  <th style={{width:'20%'}}>Type</th>
                  <th style={{width:'22%'}}>Détail</th>
                  <th style={{width:'18%'}}>Points</th>
                  <th style={{width:'18%'}}>Validé par</th>
                </tr></thead>
                <tbody>
                  {validations.map(v => {
                    const pts = v.type_validation === 'hizb_complet' ? 100 : v.nombre_tomon * 10;
                    return (
                      <tr key={v.id}>
                        <td style={{ fontSize: 12, color: '#888' }}>{formatDate(v.date_validation)}</td>
                        <td>{v.type_validation === 'hizb_complet' ? <span className="badge badge-green">Hizb complet</span> : <span className="badge badge-blue">{v.nombre_tomon} Tomon</span>}</td>
                        <td style={{ fontSize: 12, color: '#888' }}>{v.type_validation === 'hizb_complet' ? `Hizb ${v.hizb_valide} validé` : `${v.nombre_tomon} Tomon récité${v.nombre_tomon > 1 ? 's' : ''}`}</td>
                        <td><span style={{ fontSize: 12, fontWeight: 600, color: '#1D9E75' }}>+{pts} pts</span></td>
                        <td style={{ fontSize: 12, color: '#888' }}>{v.valideur ? `${v.valideur.prenom} ${v.valideur.nom}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('enregistrer', eleve)}>
            + Enregistrer une récitation
          </button>
        </>
      )}
    </div>
  );
}
