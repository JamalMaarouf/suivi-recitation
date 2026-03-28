import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcPosition, calcUnite, formatDate, getInitiales } from '../lib/helpers';

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
      const { data: inst } = await supabase
        .from('utilisateurs').select('prenom, nom')
        .eq('id', eleve.instituteur_referent_id).single();
      if (inst) setInstituteurNom(`${inst.prenom} ${inst.nom}`);
    }

    const e = calcEtatEleve(vals || [], eleve.hizb_depart, eleve.tomon_depart);
    setEtat(e);
    setValidations(vals || []);
    setLoading(false);
  };

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>← Retour au tableau de bord</button>

      <div className="section-label">Identité</div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>{getInitiales(eleve.prenom, eleve.nom)}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{eleve.prenom} {eleve.nom}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{eleve.niveau}</div>
          </div>
        </div>
        <div className="form-grid" style={{ borderTop: '0.5px solid #e8e8e0', paddingTop: 12, marginBottom: 0 }}>
          <div>
            <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Instituteur référent</div>
            <div style={{ fontSize: 13 }}>{instituteurNom}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Point de départ</div>
            <div style={{ fontSize: 13 }}>Hizb {eleve.hizb_depart}, Tomon {eleve.tomon_depart}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Inscrit le</div>
            <div style={{ fontSize: 13 }}>{formatDate(eleve.created_at)}</div>
          </div>
        </div>
      </div>

      {etat && (
        <>
          <div className="section-label">Position actuelle</div>
          <div className="position-card">
            <div className="pos-block">
              <div className="pos-val">{etat.hizbEnCours}</div>
              <div className="pos-lbl">Hizb en cours</div>
            </div>
            <div className="pos-block">
              <div className="pos-val">{etat.tomonDansHizbActuel}/8</div>
              <div className="pos-lbl">Tomon validés</div>
            </div>
            <div className="pos-block">
              <div className="pos-val" style={{ fontSize: 16 }}>
                {etat.enAttenteHizbComplet ? '⏳' : etat.hizbCompletValide ? '✓' : calcUnite(etat.tomonActuel)}
              </div>
              <div className="pos-lbl">
                {etat.enAttenteHizbComplet ? 'Hizb complet attendu' : etat.hizbCompletValide ? 'Hizb validé' : 'Unité'}
              </div>
            </div>
          </div>

          {/* Barre de progression Tomon dans le Hizb */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 8 }}>
              <span>Progression dans le Hizb {etat.hizbEnCours}</span>
              <span style={{ fontWeight: 500, color: '#1a1a1a' }}>{etat.tomonDansHizbActuel} / 8 Tomon</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                <div key={n} style={{
                  flex: 1, height: 10, borderRadius: 3,
                  background: n <= etat.tomonDansHizbActuel
                    ? (etat.enAttenteHizbComplet ? '#EF9F27' : '#1D9E75')
                    : '#e8e8e0'
                }}></div>
              ))}
            </div>
            {etat.enAttenteHizbComplet && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#FAEEDA', borderRadius: 8, fontSize: 12, color: '#633806' }}>
                Les 8 Tomon sont validés — en attente de la validation du Hizb {etat.hizbEnCours} complet pour ouvrir le Hizb {etat.hizbEnCours + 1}.
              </div>
            )}
            {etat.hizbCompletValide && !etat.enAttenteHizbComplet && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#E1F5EE', borderRadius: 8, fontSize: 12, color: '#085041' }}>
                Hizb {etat.hizbEnCours - 1} validé complet — progression en cours sur le Hizb {etat.hizbEnCours}.
              </div>
            )}
          </div>
        </>
      )}

      <div className="section-label">Historique des récitations</div>
      {loading ? <div className="loading">Chargement...</div> : validations.length === 0 ? (
        <div className="empty">Aucune récitation enregistrée.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Date</th>
                <th style={{ width: '25%' }}>Type</th>
                <th style={{ width: '25%' }}>Détail</th>
                <th style={{ width: '25%' }}>Validé par</th>
              </tr>
            </thead>
            <tbody>
              {validations.map(v => (
                <tr key={v.id}>
                  <td>{formatDate(v.date_validation)}</td>
                  <td>
                    {v.type_validation === 'hizb_complet'
                      ? <span className="badge badge-green">Hizb complet</span>
                      : <span className="badge badge-blue">{v.nombre_tomon} Tomon</span>
                    }
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>
                    {v.type_validation === 'hizb_complet'
                      ? `Hizb ${v.hizb_valide} validé`
                      : `${v.nombre_tomon} Tomon récité${v.nombre_tomon > 1 ? 's' : ''}`
                    }
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>
                    {v.valideur ? `${v.valideur.prenom} ${v.valideur.nom}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('enregistrer', eleve)}>
        + Enregistrer une récitation
      </button>
    </div>
  );
}
