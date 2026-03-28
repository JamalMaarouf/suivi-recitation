import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcPosition, calcUnite, formatDate, isInactif, getInitiales } from '../lib/helpers';

export default function Dashboard({ user, navigate }) {
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState('tous');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: elevesData } = await supabase.from('eleves').select('*').order('nom');
    const { data: instData } = await supabase.from('utilisateurs').select('*').eq('role', 'instituteur');
    const { data: validData } = await supabase.from('validations').select('*').order('date_validation', { ascending: false });

    const elevesAvecStats = (elevesData || []).map(eleve => {
      const vals = (validData || []).filter(v => v.eleve_id === eleve.id);
      const total = vals.reduce((s, v) => s + v.nombre_tomon, 0);
      const derniere = vals[0]?.date_validation || null;
      const pos = calcPosition(eleve.hizb_depart, eleve.tomon_depart, total);
      const inst = (instData || []).find(i => i.id === eleve.instituteur_referent_id);
      return { ...eleve, totalTomon: total, derniere, position: pos, instituteurNom: inst ? `${inst.prenom} ${inst.nom}` : '—', inactif: isInactif(derniere) };
    });

    setEleves(elevesAvecStats);
    setInstituteurs(instData || []);
    setLoading(false);
  };

  const elevesFiltres = eleves.filter(e => {
    if (filtre === 'inactifs') return e.inactif;
    if (filtre.startsWith('inst_')) return e.instituteur_referent_id === filtre.replace('inst_', '');
    return true;
  });

  const nbInactifs = eleves.filter(e => e.inactif).length;

  return (
    <div>
      <div className="page-title">Tableau de bord</div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-val">{eleves.length}</div>
          <div className="stat-lbl">Élèves total</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{eleves.filter(e => !e.inactif).length}</div>
          <div className="stat-lbl">Actifs</div>
        </div>
        <div className="stat-card">
          <div className="stat-val alert">{nbInactifs}</div>
          <div className="stat-lbl">Inactifs +14j</div>
        </div>
      </div>

      <div className="filters-row">
        <div className={`filter-chip ${filtre === 'tous' ? 'active' : ''}`} onClick={() => setFiltre('tous')}>Tous</div>
        <div className={`filter-chip ${filtre === 'inactifs' ? 'active' : ''}`} onClick={() => setFiltre('inactifs')}>Inactifs</div>
        {instituteurs.map(i => (
          <div key={i.id} className={`filter-chip ${filtre === 'inst_' + i.id ? 'active' : ''}`} onClick={() => setFiltre('inst_' + i.id)}>
            {i.prenom} {i.nom}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : elevesFiltres.length === 0 ? (
        <div className="empty">Aucun élève trouvé.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Élève</th>
                <th style={{ width: '20%' }}>Référent</th>
                <th style={{ width: '25%' }}>Position</th>
                <th style={{ width: '20%' }}>Dernière récitation</th>
                <th style={{ width: '10%' }}></th>
              </tr>
            </thead>
            <tbody>
              {elevesFiltres.map(eleve => (
                <tr key={eleve.id} className={`clickable ${eleve.inactif ? 'inactive' : ''}`} onClick={() => navigate('fiche', eleve)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{getInitiales(eleve.prenom, eleve.nom)}</div>
                      <span className={eleve.inactif ? 'name-cell' : ''}>{eleve.prenom} {eleve.nom}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>{eleve.instituteurNom}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>Hizb {eleve.position.hizb}, T.{eleve.position.tomon}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{calcUnite(eleve.position.tomon)}</div>
                  </td>
                  <td>
                    <span className={`badge ${eleve.inactif ? 'badge-alert' : 'badge-green'}`}>
                      {eleve.derniere ? formatDate(eleve.derniere) : 'Jamais'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 16, color: '#ccc' }}>›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
