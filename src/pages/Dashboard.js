import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcStats, formatDate, formatDateCourt, isInactif, joursDepuis, getInitiales } from '../lib/helpers';

export default function Dashboard({ user, navigate }) {
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState('tous');
  const [vue, setVue] = useState('dashboard');
  const [stats, setStats] = useState({ hizbsCompletsMois: 0, tomonSemaine: 0, recitationsMois: 0, recitationsSemaine: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: elevesData } = await supabase.from('eleves').select('*').order('nom');
    const { data: instData } = await supabase.from('utilisateurs').select('*').eq('role', 'instituteur');
    const { data: validData } = await supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').order('date_validation', { ascending: false });

    const elevesAvecStats = (elevesData || []).map(eleve => {
      const vals = (validData || []).filter(v => v.eleve_id === eleve.id);
      const etat = calcEtatEleve(vals, eleve.hizb_depart, eleve.tomon_depart);
      const derniere = vals[0]?.date_validation || null;
      const inst = (instData || []).find(i => i.id === eleve.instituteur_referent_id);
      const jours = joursDepuis(derniere);
      return { ...eleve, etat, derniere, jours, instituteurNom: inst ? `${inst.prenom} ${inst.nom}` : '—', instituteur: inst, inactif: isInactif(derniere) };
    });

    setEleves(elevesAvecStats);
    setInstituteurs(instData || []);
    setAllValidations(validData || []);
    setStats(calcStats(validData || []));
    setLoading(false);
  };

  const elevesFiltres = eleves.filter(e => {
    if (filtre === 'inactifs') return e.inactif;
    if (filtre === 'attente') return e.etat.enAttenteHizbComplet;
    if (filtre === 'actifs') return !e.inactif;
    if (filtre.startsWith('inst_')) return e.instituteur_referent_id === filtre.replace('inst_', '');
    return true;
  });

  const nbInactifs = eleves.filter(e => e.inactif).length;
  const nbAttente = eleves.filter(e => e.etat.enAttenteHizbComplet).length;
  const nbActifs = eleves.filter(e => !e.inactif).length;

  // Top récitateurs — par tomon cumulé
  const topEleves = [...eleves].sort((a, b) => b.etat.tomonCumul - a.etat.tomonCumul).slice(0, 5);

  // Élèves urgents — inactifs depuis le plus longtemps
  const elevesUrgents = [...eleves].filter(e => e.inactif).sort((a, b) => (b.jours || 0) - (a.jours || 0)).slice(0, 4);

  // Activité récente — dernières validations
  const activiteRecente = allValidations.slice(0, 8);

  // Stats par instituteur
  const statsParInst = instituteurs.map(inst => {
    const elevesInst = eleves.filter(e => e.instituteur_referent_id === inst.id);
    const tomonTotal = elevesInst.reduce((s, e) => s + e.etat.tomonCumul, 0);
    const enAttente = elevesInst.filter(e => e.etat.enAttenteHizbComplet).length;
    const inactifs = elevesInst.filter(e => e.inactif).length;
    return { ...inst, nbEleves: elevesInst.length, tomonTotal, enAttente, inactifs };
  });

  const urgenceColor = (jours) => {
    if (jours > 30) return '#A32D2D';
    if (jours > 21) return '#854F0B';
    return '#633806';
  };

  const urgenceBg = (jours) => {
    if (jours > 30) return '#FCEBEB';
    if (jours > 21) return '#FAEEDA';
    return '#FAEEDA';
  };

  return (
    <div>
      {/* Header avec tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div className="page-title" style={{ marginBottom: 0 }}>
          {vue === 'dashboard' ? 'Tableau de bord' : vue === 'eleves' ? 'Tous les élèves' : 'Rapport'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div className={`filter-chip ${vue === 'dashboard' ? 'active' : ''}`} onClick={() => setVue('dashboard')}>Vue générale</div>
          <div className={`filter-chip ${vue === 'eleves' ? 'active' : ''}`} onClick={() => setVue('eleves')}>Élèves</div>
          {user.role === 'surveillant' && (
            <div className={`filter-chip ${vue === 'rapport' ? 'active' : ''}`} onClick={() => setVue('rapport')}>Rapport</div>
          )}
        </div>
      </div>

      {loading && <div className="loading">Chargement...</div>}

      {/* ===== VUE DASHBOARD ===== */}
      {!loading && vue === 'dashboard' && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: '1.5rem' }}>
            <div className="stat-card" style={{ borderLeft: '3px solid #1D9E75', borderRadius: '0 8px 8px 0' }}>
              <div className="stat-val">{eleves.length}</div>
              <div className="stat-lbl">Élèves inscrits</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #378ADD', borderRadius: '0 8px 8px 0' }}>
              <div className="stat-val">{nbActifs}</div>
              <div className="stat-lbl">Actifs ce mois</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #EF9F27', borderRadius: '0 8px 8px 0' }}>
              <div className="stat-val" style={{ color: nbAttente > 0 ? '#854F0B' : '#1a1a1a' }}>{nbAttente}</div>
              <div className="stat-lbl">Attente Hizb complet</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '3px solid #E24B4A', borderRadius: '0 8px 8px 0' }}>
              <div className="stat-val alert">{nbInactifs}</div>
              <div className="stat-lbl">Inactifs +14 jours</div>
            </div>
          </div>

          {/* Activité semaine */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem', background: '#E1F5EE', border: '0.5px solid #9FE1CB' }}>
              <div style={{ fontSize: 11, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Cette semaine</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: '#085041' }}>{stats.tomonSemaine}</div>
              <div style={{ fontSize: 12, color: '#0F6E56' }}>Tomon récités</div>
            </div>
            <div className="card" style={{ padding: '1rem', background: '#E6F1FB', border: '0.5px solid #85B7EB' }}>
              <div style={{ fontSize: 11, color: '#185FA5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Ce mois</div>
              <div style={{ fontSize: 28, fontWeight: 500, color: '#0C447C' }}>{stats.hizbsCompletsMois}</div>
              <div style={{ fontSize: 12, color: '#185FA5' }}>Hizb complets validés</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

            {/* Élèves à activer en urgence */}
            <div>
              <div className="section-label">À relancer en urgence</div>
              {elevesUrgents.length === 0 ? (
                <div style={{ padding: '1rem', background: '#E1F5EE', borderRadius: 12, fontSize: 13, color: '#085041', textAlign: 'center' }}>
                  Tous les élèves sont actifs
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {elevesUrgents.map(e => (
                    <div key={e.id} onClick={() => navigate('fiche', e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: urgenceBg(e.jours), border: `0.5px solid ${urgenceColor(e.jours)}30`, borderRadius: 10, cursor: 'pointer' }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, background: urgenceBg(e.jours), color: urgenceColor(e.jours) }}>{getInitiales(e.prenom, e.nom)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: urgenceColor(e.jours) }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize: 11, color: urgenceColor(e.jours), opacity: 0.8 }}>{e.instituteurNom}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: urgenceColor(e.jours) }}>
                        {e.jours ? `${e.jours}j` : 'Jamais'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top récitateurs */}
            <div>
              <div className="section-label">Meilleurs récitateurs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topEleves.map((e, idx) => (
                  <div key={e.id} onClick={() => navigate('fiche', e)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: idx === 0 ? '#EF9F27' : idx === 1 ? '#888' : idx === 2 ? '#BA7517' : '#f0f0ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: idx < 3 ? '#fff' : '#aaa', flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitiales(e.prenom, e.nom)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.prenom} {e.nom}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>Hizb {e.etat.hizbEnCours}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span className="badge badge-green" style={{ fontSize: 10 }}>{e.etat.tomonCumul} Tomon</span>
                      <span style={{ fontSize: 10, color: '#bbb' }}>{e.etat.hizbsComplets.size} Hizb</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* En attente Hizb complet */}
          {nbAttente > 0 && (
            <>
              <div className="section-label">En attente de validation Hizb complet</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 8 }}>
                {eleves.filter(e => e.etat.enAttenteHizbComplet).map(e => (
                  <div key={e.id} onClick={() => navigate('enregistrer', e)}
                    style={{ padding: '12px 14px', background: '#FAEEDA', border: '0.5px solid #EF9F27', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, background: '#FAC775', color: '#412402' }}>{getInitiales(e.prenom, e.nom)}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#412402' }}>{e.prenom} {e.nom}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#854F0B' }}>Hizb {e.etat.hizbEnCours} complet à valider</div>
                    <div style={{ fontSize: 11, color: '#854F0B', marginTop: 2 }}>{e.instituteurNom}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Activité récente */}
          <div className="section-label">Activité récente</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Date</th>
                  <th style={{ width: '30%' }}>Élève</th>
                  <th style={{ width: '25%' }}>Validation</th>
                  <th style={{ width: '20%' }}>Par</th>
                </tr>
              </thead>
              <tbody>
                {activiteRecente.length === 0 && <tr><td colSpan={4} className="empty">Aucune activité.</td></tr>}
                {activiteRecente.map(v => {
                  const eleve = eleves.find(e => e.id === v.eleve_id);
                  return (
                    <tr key={v.id} className={eleve ? 'clickable' : ''} onClick={() => eleve && navigate('fiche', eleve)}>
                      <td style={{ fontSize: 12, color: '#888' }}>{formatDateCourt(v.date_validation)}</td>
                      <td style={{ fontSize: 13 }}>{eleve ? `${eleve.prenom} ${eleve.nom}` : '—'}</td>
                      <td>
                        {v.type_validation === 'hizb_complet'
                          ? <span className="badge badge-green">Hizb {v.hizb_valide} complet</span>
                          : <span className="badge badge-blue">{v.nombre_tomon} Tomon</span>}
                      </td>
                      <td style={{ fontSize: 12, color: '#888' }}>{v.valideur ? `${v.valideur.prenom}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== VUE ÉLÈVES ===== */}
      {!loading && vue === 'eleves' && (
        <>
          <div className="filters-row">
            <div className={`filter-chip ${filtre === 'tous' ? 'active' : ''}`} onClick={() => setFiltre('tous')}>Tous ({eleves.length})</div>
            <div className={`filter-chip ${filtre === 'actifs' ? 'active' : ''}`} onClick={() => setFiltre('actifs')}>Actifs ({nbActifs})</div>
            <div className={`filter-chip ${filtre === 'inactifs' ? 'active' : ''}`} onClick={() => setFiltre('inactifs')}>Inactifs ({nbInactifs})</div>
            <div className={`filter-chip ${filtre === 'attente' ? 'active' : ''}`} onClick={() => setFiltre('attente')}>Attente Hizb ({nbAttente})</div>
            {instituteurs.map(i => (
              <div key={i.id} className={`filter-chip ${filtre === 'inst_' + i.id ? 'active' : ''}`} onClick={() => setFiltre('inst_' + i.id)}>
                {i.prenom} {i.nom}
              </div>
            ))}
          </div>

          {elevesFiltres.length === 0 ? <div className="empty">Aucun élève trouvé.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Élève</th>
                    <th style={{ width: '16%' }}>Référent</th>
                    <th style={{ width: '18%' }}>Hizb en cours</th>
                    <th style={{ width: '22%' }}>Progression</th>
                    <th style={{ width: '18%' }}>Dernière récitation</th>
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
                        {eleve.etat.enAttenteHizbComplet && <span className="badge badge-amber" style={{ fontSize: 10 }}>Hizb complet en attente</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                          {[1,2,3,4,5,6,7,8].map(n => (
                            <div key={n} style={{ flex: 1, height: 6, borderRadius: 2, background: n <= eleve.etat.tomonDansHizbActuel ? (eleve.etat.enAttenteHizbComplet ? '#EF9F27' : '#1D9E75') : '#e8e8e0' }}></div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: '#999' }}>{eleve.etat.tomonDansHizbActuel}/8 Tomon</div>
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

      {/* ===== VUE RAPPORT ===== */}
      {!loading && vue === 'rapport' && user.role === 'surveillant' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-val" style={{ color: '#1D9E75' }}>{stats.hizbsCompletsMois}</div>
              <div className="stat-lbl">Hizb complets ce mois</div>
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

          <div className="section-label">Performance par instituteur</div>
          <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Instituteur</th>
                  <th style={{ width: '15%' }}>Élèves</th>
                  <th style={{ width: '20%' }}>Tomon total</th>
                  <th style={{ width: '20%' }}>En attente</th>
                  <th style={{ width: '15%' }}>Inactifs</th>
                </tr>
              </thead>
              <tbody>
                {statsParInst.length === 0 && <tr><td colSpan={5} className="empty">Aucun instituteur.</td></tr>}
                {statsParInst.sort((a,b) => b.tomonTotal - a.tomonTotal).map(i => (
                  <tr key={i.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitiales(i.prenom, i.nom)}</div>
                        {i.prenom} {i.nom}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{i.nbEleves}</td>
                    <td><span className="badge badge-green">{i.tomonTotal} Tomon</span></td>
                    <td>{i.enAttente > 0 ? <span className="badge badge-amber">{i.enAttente}</span> : <span style={{ color: '#bbb' }}>—</span>}</td>
                    <td>{i.inactifs > 0 ? <span className="badge badge-alert">{i.inactifs}</span> : <span style={{ color: '#bbb' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-label">Classement des élèves</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>#</th>
                  <th style={{ width: '32%' }}>Élève</th>
                  <th style={{ width: '20%' }}>Position</th>
                  <th style={{ width: '20%' }}>Tomon total</th>
                  <th style={{ width: '20%' }}>Hizb complets</th>
                </tr>
              </thead>
              <tbody>
                {[...eleves].sort((a,b) => b.etat.tomonCumul - a.etat.tomonCumul).map((e, idx) => (
                  <tr key={e.id} className="clickable" onClick={() => navigate('fiche', e)}>
                    <td style={{ fontWeight: idx < 3 ? 500 : 400, color: idx === 0 ? '#BA7517' : idx === 1 ? '#888' : idx === 2 ? '#854F0B' : '#bbb' }}>
                      {idx + 1}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{getInitiales(e.prenom, e.nom)}</div>
                        {e.prenom} {e.nom}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#888' }}>Hizb {e.etat.hizbEnCours}, T.{e.etat.tomonActuel}</td>
                    <td><span className="badge badge-green">{e.etat.tomonCumul}</span></td>
                    <td><span className="badge badge-blue">{e.etat.hizbsComplets.size}</span></td>
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
