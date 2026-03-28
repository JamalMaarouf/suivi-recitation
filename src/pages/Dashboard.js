import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcStats, formatDate, isInactif, getInitiales } from '../lib/helpers';

export default function Dashboard({ user, navigate }) {
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState('tous');
  const [vue, setVue] = useState('eleves');
  const [stats, setStats] = useState({ hizbsCompletsMois: 0, tomonSemaine: 0, recitationsMois: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: elevesData } = await supabase.from('eleves').select('*').order('nom');
    const { data: instData } = await supabase.from('utilisateurs').select('*').eq('role', 'instituteur');
    const { data: validData } = await supabase.from('validations').select('*').order('date_validation', { ascending: false });

    const elevesAvecStats = (elevesData || []).map(eleve => {
      const vals = (validData || []).filter(v => v.eleve_id === eleve.id);
      const etat = calcEtatEleve(vals, eleve.hizb_depart, eleve.tomon_depart);
      const derniere = vals[0]?.date_validation || null;
      const inst = (instData || []).find(i => i.id === eleve.instituteur_referent_id);
      return {
        ...eleve,
        etat,
        derniere,
        instituteurNom: inst ? `${inst.prenom} ${inst.nom}` : '—',
        inactif: isInactif(derniere)
      };
    });

    setEleves(elevesAvecStats);
    setInstituteurs(instData || []);
    setStats(calcStats(validData || []));
    setLoading(false);
  };

  const elevesFiltres = eleves.filter(e => {
    if (filtre === 'inactifs') return e.inactif;
    if (filtre === 'attente') return e.etat.enAttenteHizbComplet;
    if (filtre.startsWith('inst_')) return e.instituteur_referent_id === filtre.replace('inst_', '');
    return true;
  });

  const nbInactifs = eleves.filter(e => e.inactif).length;
  const nbAttente = eleves.filter(e => e.etat.enAttenteHizbComplet).length;

  // Stats par instituteur pour le rapport
  const statsParInst = instituteurs.map(inst => {
    const elevesInst = eleves.filter(e => e.instituteur_referent_id === inst.id);
    const hizbMoyен = elevesInst.length > 0
      ? Math.round(elevesInst.reduce((s, e) => s + e.etat.hizbEnCours, 0) / elevesInst.length)
      : 0;
    return { ...inst, nbEleves: elevesInst.length, hizbMoyen: hizbMoyен };
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Tableau de bord</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className={`filter-chip ${vue === 'eleves' ? 'active' : ''}`} onClick={() => setVue('eleves')}>Élèves</div>
          {user.role === 'surveillant' && (
            <div className={`filter-chip ${vue === 'rapport' ? 'active' : ''}`} onClick={() => setVue('rapport')}>Rapport</div>
          )}
        </div>
      </div>

      {vue === 'eleves' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-val">{eleves.length}</div>
              <div className="stat-lbl">Élèves total</div>
            </div>
            <div className="stat-card">
              <div className="stat-val alert">{nbInactifs}</div>
              <div className="stat-lbl">Inactifs +14j</div>
            </div>
            <div className="stat-card">
              <div className="stat-val" style={{ color: nbAttente > 0 ? '#854F0B' : '#1a1a1a' }}>{nbAttente}</div>
              <div className="stat-lbl">Attente Hizb complet</div>
            </div>
          </div>

          <div className="filters-row">
            <div className={`filter-chip ${filtre === 'tous' ? 'active' : ''}`} onClick={() => setFiltre('tous')}>Tous</div>
            <div className={`filter-chip ${filtre === 'inactifs' ? 'active' : ''}`} onClick={() => setFiltre('inactifs')}>Inactifs</div>
            <div className={`filter-chip ${filtre === 'attente' ? 'active' : ''}`} onClick={() => setFiltre('attente')}>Attente Hizb</div>
            {instituteurs.map(i => (
              <div key={i.id} className={`filter-chip ${filtre === 'inst_' + i.id ? 'active' : ''}`} onClick={() => setFiltre('inst_' + i.id)}>
                {i.prenom} {i.nom}
              </div>
            ))}
          </div>

          {loading ? <div className="loading">Chargement...</div> : elevesFiltres.length === 0 ? (
            <div className="empty">Aucun élève trouvé.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Élève</th>
                    <th style={{ width: '16%' }}>Référent</th>
                    <th style={{ width: '20%' }}>Hizb en cours</th>
                    <th style={{ width: '22%' }}>Progression Tomon</th>
                    <th style={{ width: '16%' }}>Dernière récitation</th>
                    <th style={{ width: '4%' }}></th>
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
                        <div style={{ fontSize: 13 }}>Hizb {eleve.etat.hizbEnCours}</div>
                        {eleve.etat.enAttenteHizbComplet && (
                          <span className="badge badge-amber" style={{ fontSize: 10 }}>Hizb complet en attente</span>
                        )}
                        {eleve.etat.hizbCompletValide && !eleve.etat.enAttenteHizbComplet && (
                          <span className="badge badge-green" style={{ fontSize: 10 }}>Hizb validé</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: '#e8e8e0', borderRadius: 3, overflow: 'hidden', minWidth: 40 }}>
                            <div style={{ height: '100%', width: `${Math.round((eleve.etat.tomonDansHizbActuel / 8) * 100)}%`, background: eleve.etat.enAttenteHizbComplet ? '#EF9F27' : '#1D9E75', borderRadius: 3 }}></div>
                          </div>
                          <span style={{ fontSize: 11, color: '#888', minWidth: 32 }}>{eleve.etat.tomonDansHizbActuel}/8</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${eleve.inactif ? 'badge-alert' : 'badge-green'}`}>
                          {eleve.derniere ? formatDate(eleve.derniere) : 'Jamais'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}><span style={{ fontSize: 16, color: '#ccc' }}>›</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {vue === 'rapport' && user.role === 'surveillant' && (
        <>
          <div className="section-label">Ce mois-ci</div>
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-val" style={{ color: '#1D9E75' }}>{stats.hizbsCompletsMois}</div>
              <div className="stat-lbl">Hizb complets validés</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">{stats.tomonSemaine}</div>
              <div className="stat-lbl">Tomon cette semaine</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">{stats.recitationsMois}</div>
              <div className="stat-lbl">Récitations ce mois</div>
            </div>
          </div>

          <div className="section-label">Par instituteur</div>
          <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Instituteur</th>
                  <th style={{ width: '20%' }}>Nb élèves</th>
                  <th style={{ width: '25%' }}>Hizb moyen</th>
                  <th style={{ width: '20%' }}>En attente</th>
                </tr>
              </thead>
              <tbody>
                {statsParInst.length === 0 && <tr><td colSpan={4} className="empty">Aucun instituteur.</td></tr>}
                {statsParInst.map(i => {
                  const enAttente = eleves.filter(e => e.instituteur_referent_id === i.id && e.etat.enAttenteHizbComplet).length;
                  return (
                    <tr key={i.id}>
                      <td>{i.prenom} {i.nom}</td>
                      <td style={{ fontSize: 13, color: '#888' }}>{i.nbEleves} élèves</td>
                      <td><span className="badge badge-green">Hizb {i.hizbMoyen}</span></td>
                      <td>{enAttente > 0 ? <span className="badge badge-amber">{enAttente} en attente</span> : <span style={{ color: '#bbb', fontSize: 12 }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="section-label">Élèves les plus avancés</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Élève</th>
                  <th style={{ width: '30%' }}>Position</th>
                  <th style={{ width: '30%' }}>Hizb complets</th>
                </tr>
              </thead>
              <tbody>
                {[...eleves].sort((a, b) => b.etat.tomonCumul - a.etat.tomonCumul).slice(0, 5).map(e => (
                  <tr key={e.id} className="clickable" onClick={() => navigate('fiche', e)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitiales(e.prenom, e.nom)}</div>
                        {e.prenom} {e.nom}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: '#888' }}>Hizb {e.etat.hizbEnCours}, T.{e.etat.tomonActuel}</td>
                    <td><span className="badge badge-green">{e.etat.hizbsComplets.size} Hizb</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
