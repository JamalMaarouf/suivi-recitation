import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcPosition, calcUnite, formatDate, getInitiales } from '../lib/helpers';

export default function FicheEleve({ eleve, user, navigate }) {
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instituteurNom, setInstituteurNom] = useState('—');

  useEffect(() => {
    loadData();
  }, [eleve.id]);

  const loadData = async () => {
    setLoading(true);
    const { data: vals } = await supabase
      .from('validations')
      .select('*, valideur:valide_par(prenom, nom)')
      .eq('eleve_id', eleve.id)
      .order('date_validation', { ascending: false });

    if (eleve.instituteur_referent_id) {
      const { data: inst } = await supabase
        .from('utilisateurs')
        .select('prenom, nom')
        .eq('id', eleve.instituteur_referent_id)
        .single();
      if (inst) setInstituteurNom(`${inst.prenom} ${inst.nom}`);
    }

    setValidations(vals || []);
    setLoading(false);
  };

  const total = validations.reduce((s, v) => s + v.nombre_tomon, 0);
  const pos = calcPosition(eleve.hizb_depart, eleve.tomon_depart, total);

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>← Retour au tableau de bord</button>

      <div className="section-label">Identité</div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>{getInitiales(eleve.prenom, eleve.nom)}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{eleve.prenom} {eleve.nom}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Élève</div>
          </div>
        </div>
        <div className="form-grid" style={{ borderTop: '0.5px solid #e8e8e0', paddingTop: 12, marginBottom: 0 }}>
          <div>
            <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 2 }}>Niveau</div>
            <div style={{ fontSize: 13 }}>{eleve.niveau}</div>
          </div>
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

      <div className="section-label">Position actuelle</div>
      <div className="position-card">
        <div className="pos-block">
          <div className="pos-val">{pos.hizb}</div>
          <div className="pos-lbl">Hizb</div>
        </div>
        <div className="pos-block">
          <div className="pos-val">{pos.tomon}</div>
          <div className="pos-lbl">Tomon</div>
        </div>
        <div className="pos-block">
          <div className="pos-val" style={{ fontSize: 20 }}>{calcUnite(pos.tomon)}</div>
          <div className="pos-lbl">Unité</div>
        </div>
      </div>

      <div className="section-label">Historique des récitations</div>
      {loading ? (
        <div className="loading">Chargement...</div>
      ) : validations.length === 0 ? (
        <div className="empty">Aucune récitation enregistrée.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Date</th>
                <th style={{ width: '22%' }}>Tomon validés</th>
                <th style={{ width: '28%' }}>Position atteinte</th>
                <th style={{ width: '22%' }}>Validé par</th>
              </tr>
            </thead>
            <tbody>
              {validations.map((v, idx) => {
                const tomonAvant = validations.slice(idx).reduce((s, vv) => s + vv.nombre_tomon, 0);
                const posAtteinte = calcPosition(eleve.hizb_depart, eleve.tomon_depart, tomonAvant);
                return (
                  <tr key={v.id}>
                    <td>{formatDate(v.date_validation)}</td>
                    <td><span className="badge badge-green">{v.nombre_tomon} Tomon</span></td>
                    <td style={{ fontSize: 12, color: '#888' }}>Hizb {posAtteinte.hizb}, T.{posAtteinte.tomon}</td>
                    <td style={{ fontSize: 12, color: '#888' }}>
                      {v.valideur ? `${v.valideur.prenom} ${v.valideur.nom}` : '—'}
                    </td>
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
    </div>
  );
}
