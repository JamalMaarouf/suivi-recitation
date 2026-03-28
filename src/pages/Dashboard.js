import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcStats, formatDate, formatDateCourt, isInactif, joursDepuis, getInitiales, calcUnite } from '../lib/helpers';

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
      return { ...eleve, etat, derniere, jours: joursDepuis(derniere), instituteurNom: inst ? `${inst.prenom} ${inst.nom}` : '—', instituteur: inst, inactif: isInactif(derniere) };
    });

    setEleves(elevesAvecStats);
    setInstituteurs(instData || []);
    setAllValidations(validData || []);
    setStats(calcStats(validData || []));
    setLoading(false);
  };

  const nbInactifs = eleves.filter(e => e.inactif).length;
  const nbAttente = eleves.filter(e => e.etat.enAttenteHizbComplet).length;
  const nbActifs = eleves.filter(e => !e.inactif).length;

  const elevesFiltres = eleves.filter(e => {
    if (filtre === 'inactifs') return e.inactif;
    if (filtre === 'attente') return e.etat.enAttenteHizbComplet;
    if (filtre === 'actifs') return !e.inactif;
    if (filtre.startsWith('inst_')) return e.instituteur_referent_id === filtre.replace('inst_', '');
    return true;
  });

  const topEleves = [...eleves].sort((a, b) => b.etat.tomonCumul - a.etat.tomonCumul).slice(0, 5);
  const elevesUrgents = [...eleves].filter(e => e.inactif).sort((a, b) => (b.jours || 999) - (a.jours || 999)).slice(0, 5);
  const activiteRecente = allValidations.slice(0, 10);

  const statsParInst = instituteurs.map(inst => {
    const ei = eleves.filter(e => e.instituteur_referent_id === inst.id);
    return {
      ...inst,
      nbEleves: ei.length,
      tomonTotal: ei.reduce((s, e) => s + e.etat.tomonCumul, 0),
      hizbsComplets: ei.reduce((s, e) => s + e.etat.hizbsComplets.size, 0),
      enAttente: ei.filter(e => e.etat.enAttenteHizbComplet).length,
      inactifs: ei.filter(e => e.inactif).length,
      actifs: ei.filter(e => !e.inactif).length,
    };
  });

  const urgenceColor = (j) => j > 30 ? '#A32D2D' : j > 21 ? '#854F0B' : '#633806';
  const urgenceBg = (j) => j > 30 ? '#FCEBEB' : '#FAEEDA';

  const MedailleIcon = ({ idx }) => {
    const colors = ['#EF9F27', '#B0B0B0', '#CD7F32'];
    if (idx > 2) return <span style={{ fontSize: 12, color: '#bbb', minWidth: 20, textAlign: 'center' }}>{idx + 1}</span>;
    return <div style={{ width: 20, height: 20, borderRadius: '50%', background: colors[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 500, flexShrink: 0 }}>{idx + 1}</div>;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 8 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>
          {vue === 'dashboard' ? 'Vue générale' : vue === 'eleves' ? 'Élèves' : 'Rapport'}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div className={`filter-chip ${vue === 'dashboard' ? 'active' : ''}`} onClick={() => setVue('dashboard')}>Général</div>
          <div className={`filter-chip ${vue === 'eleves' ? 'active' : ''}`} onClick={() => setVue('eleves')}>Élèves</div>
          {user.role === 'surveillant' && (
            <div className={`filter-chip ${vue === 'rapport' ? 'active' : ''}`} onClick={() => setVue('rapport')}>Rapport</div>
          )}
        </div>
      </div>

      {loading && <div className="loading">Chargement...</div>}

      {/* ===== VUE GÉNÉRALE ===== */}
      {!loading && vue === 'dashboard' && (
        <>
          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: '1.25rem' }}>
            {[
              { val: eleves.length, lbl: 'Élèves inscrits', color: '#1D9E75' },
              { val: nbActifs, lbl: 'Actifs ce mois', color: '#378ADD' },
              { val: nbAttente, lbl: 'Attente Hizb complet', color: '#EF9F27' },
              { val: nbInactifs, lbl: 'Inactifs +14j', color: '#E24B4A' },
            ].map((k, i) => (
              <div key={i} className="stat-card" style={{ borderLeft: `3px solid ${k.color}`, borderRadius: '0 8px 8px 0', padding: '12px 14px' }}>
                <div style={{ fontSize: 24, fontWeight: 500, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Activité semaine / mois */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginBottom: '1.25rem' }}>
            <div style={{ padding: '14px', background: '#E1F5EE', border: '0.5px solid #9FE1CB', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Cette semaine</div>
              <div style={{ fontSize: 26, fontWeight: 500, color: '#085041' }}>{stats.tomonSemaine}</div>
              <div style={{ fontSize: 11, color: '#0F6E56' }}>Tomon récités</div>
            </div>
            <div style={{ padding: '14px', background: '#E6F1FB', border: '0.5px solid #85B7EB', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#185FA5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Ce mois</div>
              <div style={{ fontSize: 26, fontWeight: 500, color: '#0C447C' }}>{stats.hizbsCompletsMois}</div>
              <div style={{ fontSize: 11, color: '#185FA5' }}>Hizb complets validés</div>
            </div>
            <div style={{ padding: '14px', background: '#f9f9f6', border: '0.5px solid #e0e0d8', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Ce mois</div>
              <div style={{ fontSize: 26, fontWeight: 500, color: '#1a1a1a' }}>{stats.recitationsMois}</div>
              <div style={{ fontSize: 11, color: '#888' }}>Récitations totales</div>
            </div>
          </div>

          {/* Attente Hizb complet */}
          {nbAttente > 0 && (
            <>
              <div className="section-label">En attente de validation Hizb complet</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 8, marginBottom: '0.5rem' }}>
                {eleves.filter(e => e.etat.enAttenteHizbComplet).map(e => (
                  <div key={e.id} onClick={() => navigate('enregistrer', e)}
                    style={{ padding: '12px', background: '#FAEEDA', border: '0.5px solid #EF9F27', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, background: '#FAC775', color: '#412402' }}>{getInitiales(e.prenom, e.nom)}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#412402' }}>{e.prenom} {e.nom}</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#854F0B' }}>Hizb {e.etat.hizbEnCours} complet à valider</div>
                    <div style={{ fontSize: 11, color: '#854F0B', opacity: 0.8 }}>{e.instituteurNom}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            {/* À relancer */}
            <div>
              <div className="section-label">À relancer en urgence</div>
              {elevesUrgents.length === 0 ? (
                <div style={{ padding: '1rem', background: '#E1F5EE', borderRadius: 10, fontSize: 13, color: '#085041', textAlign: 'center' }}>
                  Tous les élèves sont actifs
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {elevesUrgents.map(e => (
                    <div key={e.id} onClick={() => navigate('fiche', e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: urgenceBg(e.jours), border: `0.5px solid ${urgenceColor(e.jours)}30`, borderRadius: 10, cursor: 'pointer' }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, background: 'transparent', border: `1.5px solid ${urgenceColor(e.jours)}`, color: urgenceColor(e.jours) }}>{getInitiales(e.prenom, e.nom)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: urgenceColor(e.jours) }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize: 11, color: urgenceColor(e.jours), opacity: 0.75 }}>Hizb {e.etat.hizbEnCours} · {e.instituteurNom}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: urgenceColor(e.jours), minWidth: 32, textAlign: 'right' }}>
                        {e.jours != null ? `${e.jours}j` : 'Jamais'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top récitateurs */}
            <div>
              <div className="section-label">Meilleurs récitateurs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topEleves.length === 0 && <div className="empty">Aucune récitation enregistrée.</div>}
                {topEleves.map((e, idx) => (
                  <div key={e.id} onClick={() => navigate('fiche', e)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 10, cursor: 'pointer' }}>
                    <MedailleIcon idx={idx} />
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitiales(e.prenom, e.nom)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.prenom} {e.nom}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>Hizb {e.etat.hizbEnCours}, T.{e.etat.prochainTomon || 1} · {e.instituteurNom}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1D9E75' }}>{e.etat.tomonCumul} T</div>
                      <div style={{ fontSize: 10, color: '#bbb' }}>{e.etat.hizbsComplets.size} Hizb</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activité récente */}
          <div className="section-label">Activité récente</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>Date</th>
                  <th style={{ width: '28%' }}>Élève</th>
                  <th style={{ width: '30%' }}>Validation</th>
                  <th style={{ width: '24%' }}>Validé par</th>
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
                      <td style={{ fontSize: 12, color: '#888' }}>{v.valideur ? `${v.valideur.prenom} ${v.valideur.nom}` : '—'}</td>
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
            {[
              { key: 'tous', label: `Tous (${eleves.length})` },
              { key: 'actifs', label: `Actifs (${nbActifs})` },
              { key: 'inactifs', label: `Inactifs (${nbInactifs})` },
              { key: 'attente', label: `Attente Hizb (${nbAttente})` },
              ...instituteurs.map(i => ({ key: 'inst_' + i.id, label: `${i.prenom} ${i.nom}` }))
            ].map(f => (
              <div key={f.key} className={`filter-chip ${filtre === f.key ? 'active' : ''}`} onClick={() => setFiltre(f.key)}>{f.label}</div>
            ))}
          </div>

          {elevesFiltres.length === 0 ? <div className="empty">Aucun élève trouvé.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>Élève</th>
                    <th style={{ width: '14%' }}>Niveau</th>
                    <th style={{ width: '16%' }}>Référent</th>
                    <th style={{ width: '16%' }}>Hizb en cours</th>
                    <th style={{ width: '20%' }}>Progression</th>
                    <th style={{ width: '14%' }}>Dernière récit.</th>
                  </tr>
                </thead>
                <tbody>
                  {elevesFiltres.map(eleve => (
                    <tr key={eleve.id} className={`clickable ${eleve.inactif ? 'inactive' : ''}`} onClick={() => navigate('fiche', eleve)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitiales(eleve.prenom, eleve.nom)}</div>
                          <span className={eleve.inactif ? 'name-cell' : ''}>{eleve.prenom} {eleve.nom}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${eleve.niveau === 'Avancé' ? 'badge-green' : eleve.niveau === 'Intermédiaire' ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: 10 }}>{eleve.niveau}</span>
                      </td>
                      <td style={{ fontSize: 12, color: '#888' }}>{eleve.instituteurNom}</td>
                      <td>
                        <div style={{ fontSize: 13 }}>Hizb {eleve.etat.hizbEnCours}</div>
                        {eleve.etat.enAttenteHizbComplet && <span className="badge badge-amber" style={{ fontSize: 10 }}>Hizb complet en attente</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                          {[1,2,3,4,5,6,7,8].map(n => (
                            <div key={n} style={{ flex: 1, height: 5, borderRadius: 2, background: n <= eleve.etat.tomonDansHizbActuel ? (eleve.etat.enAttenteHizbComplet ? '#EF9F27' : '#1D9E75') : '#e8e8e0' }}></div>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: '#999' }}>{eleve.etat.tomonDansHizbActuel}/8 · {eleve.etat.tomonCumul} total</div>
                      </td>
                      <td>
                        <span className={`badge ${eleve.inactif ? 'badge-alert' : 'badge-green'}`} style={{ fontSize: 10 }}>
                          {eleve.derniere ? formatDate(eleve.derniere) : 'Jamais'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== RAPPORT ===== */}
      {!loading && vue === 'rapport' && user.role === 'surveillant' && (
        <>
          {/* Stats globales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: '1.25rem' }}>
            {[
              { val: stats.hizbsCompletsMois, lbl: 'Hizb complets ce mois', color: '#1D9E75' },
              { val: stats.tomonSemaine, lbl: 'Tomon cette semaine', color: '#378ADD' },
              { val: stats.recitationsMois, lbl: 'Récitations ce mois', color: '#888' },
              { val: stats.recitationsSemaine, lbl: 'Récitations cette semaine', color: '#854F0B' },
            ].map((k, i) => (
              <div key={i} className="stat-card" style={{ borderLeft: `3px solid ${k.color}`, borderRadius: '0 8px 8px 0' }}>
                <div style={{ fontSize: 22, fontWeight: 500, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Par instituteur */}
          <div className="section-label">Performance par instituteur</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 10, marginBottom: '1.5rem' }}>
            {statsParInst.length === 0 && <div className="empty">Aucun instituteur.</div>}
            {statsParInst.sort((a,b) => b.tomonTotal - a.tomonTotal).map(inst => (
              <div key={inst.id} className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{getInitiales(inst.prenom, inst.nom)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{inst.prenom} {inst.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{inst.nbEleves} élèves</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ background: '#E1F5EE', borderRadius: 6, padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: '#085041' }}>{inst.tomonTotal}</div>
                    <div style={{ fontSize: 10, color: '#0F6E56' }}>Tomon total</div>
                  </div>
                  <div style={{ background: '#E6F1FB', borderRadius: 6, padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: '#0C447C' }}>{inst.hizbsComplets}</div>
                    <div style={{ fontSize: 10, color: '#185FA5' }}>Hizb complets</div>
                  </div>
                  <div style={{ background: inst.inactifs > 0 ? '#FCEBEB' : '#f9f9f6', borderRadius: 6, padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: inst.inactifs > 0 ? '#A32D2D' : '#bbb' }}>{inst.inactifs}</div>
                    <div style={{ fontSize: 10, color: inst.inactifs > 0 ? '#A32D2D' : '#bbb' }}>Inactifs</div>
                  </div>
                  <div style={{ background: inst.enAttente > 0 ? '#FAEEDA' : '#f9f9f6', borderRadius: 6, padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: inst.enAttente > 0 ? '#854F0B' : '#bbb' }}>{inst.enAttente}</div>
                    <div style={{ fontSize: 10, color: inst.enAttente > 0 ? '#854F0B' : '#bbb' }}>Attente Hizb</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Classement élèves */}
          <div className="section-label">Classement général des élèves</div>
          <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '6%' }}>#</th>
                  <th style={{ width: '24%' }}>Élève</th>
                  <th style={{ width: '14%' }}>Niveau</th>
                  <th style={{ width: '18%' }}>Position actuelle</th>
                  <th style={{ width: '14%' }}>Tomon total</th>
                  <th style={{ width: '12%' }}>Hizb complets</th>
                  <th style={{ width: '12%' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {[...eleves].sort((a,b) => b.etat.tomonCumul - a.etat.tomonCumul).map((e, idx) => (
                  <tr key={e.id} className="clickable" onClick={() => navigate('fiche', e)}>
                    <td>
                      <MedailleIcon idx={idx} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{getInitiales(e.prenom, e.nom)}</div>
                        <div>
                          <div style={{ fontSize: 13 }}>{e.prenom} {e.nom}</div>
                          <div style={{ fontSize: 11, color: '#bbb' }}>{e.instituteurNom}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${e.niveau === 'Avancé' ? 'badge-green' : e.niveau === 'Intermédiaire' ? 'badge-blue' : 'badge-amber'}`} style={{ fontSize: 10 }}>{e.niveau}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      Hizb {e.etat.hizbEnCours}
                      {e.etat.prochainTomon && `, T.${e.etat.prochainTomon}`}
                    </td>
                    <td><span className="badge badge-green">{e.etat.tomonCumul}</span></td>
                    <td><span className="badge badge-blue">{e.etat.hizbsComplets.size}</span></td>
                    <td>
                      {e.etat.enAttenteHizbComplet
                        ? <span className="badge badge-amber" style={{ fontSize: 10 }}>Attente Hizb</span>
                        : e.inactif
                          ? <span className="badge badge-alert" style={{ fontSize: 10 }}>Inactif</span>
                          : <span className="badge badge-green" style={{ fontSize: 10 }}>Actif</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Élèves sans récitation */}
          {eleves.filter(e => e.etat.tomonCumul === 0).length > 0 && (
            <>
              <div className="section-label">Élèves sans aucune récitation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {eleves.filter(e => e.etat.tomonCumul === 0).map(e => (
                  <div key={e.id} onClick={() => navigate('fiche', e)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 8, cursor: 'pointer' }}>
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{getInitiales(e.prenom, e.nom)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.prenom} {e.nom}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{e.instituteurNom} · Hizb {e.hizb_depart}, T.{e.tomon_depart}</div>
                    </div>
                    <span className="badge badge-alert" style={{ fontSize: 10 }}>Jamais récité</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  function MedailleIcon({ idx }) {
    const colors = ['#EF9F27', '#B0B0B0', '#CD7F32'];
    if (idx > 2) return <span style={{ fontSize: 12, color: '#bbb', display: 'block', textAlign: 'center' }}>{idx + 1}</span>;
    return <div style={{ width: 22, height: 22, borderRadius: '50%', background: colors[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 500 }}>{idx + 1}</div>;
  }
}
