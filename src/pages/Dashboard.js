import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcStats, formatDate, formatDateCourt, isInactif, joursDepuis, getInitiales, calcUnite, scoreLabel } from '../lib/helpers';

const COLORS = {
  green: '#1D9E75', greenBg: '#E1F5EE', greenLight: '#9FE1CB',
  blue: '#378ADD', blueBg: '#E6F1FB',
  amber: '#EF9F27', amberBg: '#FAEEDA',
  red: '#E24B4A', redBg: '#FCEBEB',
  gray: '#888', grayBg: '#f5f5f0',
  dark: '#1a1a1a', muted: '#888', border: '#e0e0d8'
};

function Avatar({ prenom, nom, size = 36, bg = COLORS.greenBg, color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

function ScoreBadge({ points }) {
  const s = scoreLabel(points);
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: s.bg, color: s.color }}>{s.label}</span>;
}

function ProgressBar8({ done, pending = 0, color = COLORS.green }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5,6,7,8].map(n => (
        <div key={n} style={{ flex: 1, height: 5, borderRadius: 2, background: n <= done ? color : n <= done + pending ? '#9FE1CB' : '#e8e8e0' }} />
      ))}
    </div>
  );
}

function Medaille({ idx }) {
  const colors = ['#EF9F27','#B0B0B0','#CD7F32'];
  if (idx > 2) return <span style={{ fontSize: 11, color: '#bbb', width: 20, display: 'inline-block', textAlign: 'center' }}>{idx+1}</span>;
  return <div style={{ width: 22, height: 22, borderRadius: '50%', background: colors[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0 }}>{idx+1}</div>;
}

export default function Dashboard({ user, navigate }) {
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('general');
  const [stats, setStats] = useState({});

  // Filtres élèves
  const [searchEleve, setSearchEleve] = useState('');
  const [filtreInst, setFiltreInst] = useState('tous');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [filtreNiveau, setFiltreNiveau] = useState('tous');
  const [tri, setTri] = useState('points_desc');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: ed }, { data: id }, { data: vd }] = await Promise.all([
      supabase.from('eleves').select('*').order('nom'),
      supabase.from('utilisateurs').select('*').eq('role', 'instituteur'),
      supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').order('date_validation', { ascending: false })
    ]);

    const elevesData = (ed || []).map(eleve => {
      const vals = (vd || []).filter(v => v.eleve_id === eleve.id);
      const etat = calcEtatEleve(vals, eleve.hizb_depart, eleve.tomon_depart);
      const derniere = vals[0]?.date_validation || null;
      const inst = (id || []).find(i => i.id === eleve.instituteur_referent_id);
      return { ...eleve, etat, derniere, jours: joursDepuis(derniere), instituteurNom: inst ? `${inst.prenom} ${inst.nom}` : '—', instituteur: inst, inactif: isInactif(derniere) };
    });

    setEleves(elevesData);
    setInstituteurs(id || []);
    setAllValidations(vd || []);
    setStats(calcStats(vd || []));
    setLoading(false);
  };

  // Stats globales
  const totalPoints = eleves.reduce((s, e) => s + e.etat.points.total, 0);
  const totalTomon = eleves.reduce((s, e) => s + e.etat.tomonCumul, 0);
  const totalHizb = eleves.reduce((s, e) => s + e.etat.hizbsComplets.size, 0);
  const nbInactifs = eleves.filter(e => e.inactif).length;
  const nbAttente = eleves.filter(e => e.etat.enAttenteHizbComplet).length;

  // Élèves filtrés et triés
  const elevesFiltres = useMemo(() => {
    let list = [...eleves];
    if (searchEleve) list = list.filter(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(searchEleve.toLowerCase()));
    if (filtreInst !== 'tous') list = list.filter(e => e.instituteur_referent_id === filtreInst);
    if (filtreStatut === 'actifs') list = list.filter(e => !e.inactif);
    if (filtreStatut === 'inactifs') list = list.filter(e => e.inactif);
    if (filtreStatut === 'attente') list = list.filter(e => e.etat.enAttenteHizbComplet);
    if (filtreNiveau !== 'tous') list = list.filter(e => e.niveau === filtreNiveau);
    switch (tri) {
      case 'points_desc': list.sort((a,b) => b.etat.points.total - a.etat.points.total); break;
      case 'points_asc': list.sort((a,b) => a.etat.points.total - b.etat.points.total); break;
      case 'hizb_desc': list.sort((a,b) => b.etat.hizbEnCours - a.etat.hizbEnCours); break;
      case 'hizb_asc': list.sort((a,b) => a.etat.hizbEnCours - b.etat.hizbEnCours); break;
      case 'nom_asc': list.sort((a,b) => a.nom.localeCompare(b.nom)); break;
      case 'nom_desc': list.sort((a,b) => b.nom.localeCompare(a.nom)); break;
      case 'inactif': list.sort((a,b) => (b.jours||0) - (a.jours||0)); break;
      case 'recente': list.sort((a,b) => new Date(b.derniere||0) - new Date(a.derniere||0)); break;
      default: break;
    }
    return list;
  }, [eleves, searchEleve, filtreInst, filtreStatut, filtreNiveau, tri]);

  // Stats instituteurs
  const statsInst = useMemo(() => instituteurs.map(inst => {
    const ei = eleves.filter(e => e.instituteur_referent_id === inst.id);
    return {
      ...inst,
      nbEleves: ei.length,
      totalPoints: ei.reduce((s,e) => s + e.etat.points.total, 0),
      totalTomon: ei.reduce((s,e) => s + e.etat.tomonCumul, 0),
      totalHizb: ei.reduce((s,e) => s + e.etat.hizbsComplets.size, 0),
      nbActifs: ei.filter(e => !e.inactif).length,
      nbInactifs: ei.filter(e => e.inactif).length,
      nbAttente: ei.filter(e => e.etat.enAttenteHizbComplet).length,
      meilleur: [...ei].sort((a,b) => b.etat.points.total - a.etat.points.total)[0] || null,
      eleves: ei
    };
  }), [instituteurs, eleves]);

  const tabs = [
    { key: 'general', label: 'Général' },
    { key: 'eleves', label: 'Élèves' },
    { key: 'instituteurs', label: 'Instituteurs' },
    ...(user.role === 'surveillant' ? [{ key: 'rapport', label: 'Rapport' }] : [])
  ];

  return (
    <div>
      {/* Navigation tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 500 }}>
          {tabs.find(t => t.key === vue)?.label}
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f0f0ec', borderRadius: 10, padding: 3 }}>
          {tabs.map(t => (
            <div key={t.key} onClick={() => setVue(t.key)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: vue === t.key ? '#fff' : 'transparent', color: vue === t.key ? COLORS.dark : COLORS.muted, transition: 'all 0.15s', border: vue === t.key ? `0.5px solid ${COLORS.border}` : 'none' }}>
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {loading && <div className="loading">Chargement...</div>}

      {/* ===== GÉNÉRAL ===== */}
      {!loading && vue === 'general' && (
        <>
          {/* Score école */}
          <div style={{ background: 'linear-gradient(135deg, #085041 0%, #1D9E75 100%)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.25rem', color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>Score global de l'école</div>
            <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1px' }}>{totalPoints.toLocaleString()}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>points cumulés par tous les élèves</div>
            <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
              <div><div style={{ fontSize: 20, fontWeight: 600 }}>{totalTomon}</div><div style={{ fontSize: 11, opacity: 0.7 }}>Tomon récités</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 600 }}>{totalHizb}</div><div style={{ fontSize: 11, opacity: 0.7 }}>Hizb complets</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 600 }}>{eleves.length}</div><div style={{ fontSize: 11, opacity: 0.7 }}>Élèves</div></div>
            </div>
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: '1.25rem' }}>
            {[
              { val: stats.tomonSemaine || 0, lbl: 'Tomon cette semaine', color: COLORS.green, icon: '📖' },
              { val: stats.hizbsCompletsMois || 0, lbl: 'Hizb complets ce mois', color: COLORS.blue, icon: '✅' },
              { val: nbAttente, lbl: 'Attente Hizb complet', color: COLORS.amber, icon: '⏳' },
              { val: nbInactifs, lbl: 'Inactifs +14 jours', color: COLORS.red, icon: '⚠️' },
            ].map((k,i) => (
              <div key={i} style={{ background: '#fff', border: `0.5px solid ${COLORS.border}`, borderRadius: 12, padding: '14px', borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 3, lineHeight: 1.4 }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Podium top 3 */}
          <div className="section-label">Podium des récitateurs</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: '1.5rem', alignItems: 'flex-end' }}>
            {[...eleves].sort((a,b) => b.etat.points.total - a.etat.points.total).slice(0,3).map((e, idx) => {
              const heights = [160, 130, 110];
              const podColors = ['#EF9F27','#B0B0B0','#CD7F32'];
              const podBgs = ['#FAEEDA','#f5f5f0','#f9f3ec'];
              return (
                <div key={e.id} onClick={() => navigate('fiche', e)} style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Avatar prenom={e.prenom} nom={e.nom} size={idx===0?52:44} bg={podBgs[idx]} color={podColors[idx]} />
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6, textAlign: 'center' }}>{e.prenom}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>{e.etat.points.total.toLocaleString()} pts</div>
                  <div style={{ width: '100%', height: heights[idx], background: podBgs[idx], borderRadius: '8px 8px 0 0', border: `0.5px solid ${podColors[idx]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: idx===0?28:22, fontWeight: 700, color: podColors[idx] }}>{idx+1}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deux colonnes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Urgences */}
            <div>
              <div className="section-label">À relancer en urgence</div>
              {eleves.filter(e => e.inactif).length === 0 ? (
                <div style={{ padding: '1rem', background: COLORS.greenBg, borderRadius: 10, fontSize: 13, color: '#085041', textAlign: 'center' }}>Tous les élèves sont actifs</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...eleves].filter(e => e.inactif).sort((a,b) => (b.jours||0)-(a.jours||0)).slice(0,5).map(e => (
                    <div key={e.id} onClick={() => navigate('fiche', e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: e.jours > 30 ? COLORS.redBg : COLORS.amberBg, borderRadius: 10, cursor: 'pointer', border: `0.5px solid ${e.jours > 30 ? COLORS.red : COLORS.amber}30` }}>
                      <Avatar prenom={e.prenom} nom={e.nom} size={32} bg="transparent" color={e.jours > 30 ? COLORS.red : '#633806'} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: e.jours > 30 ? COLORS.red : '#412402' }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize: 11, color: e.jours > 30 ? '#A32D2D' : '#854F0B', opacity: 0.8 }}>Hizb {e.etat.hizbEnCours} · {e.instituteurNom}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: e.jours > 30 ? COLORS.red : '#633806' }}>{e.jours != null ? `${e.jours}j` : '∞'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attente Hizb */}
            <div>
              <div className="section-label">Attente validation Hizb complet</div>
              {nbAttente === 0 ? (
                <div style={{ padding: '1rem', background: COLORS.greenBg, borderRadius: 10, fontSize: 13, color: '#085041', textAlign: 'center' }}>Aucun élève en attente</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {eleves.filter(e => e.etat.enAttenteHizbComplet).map(e => (
                    <div key={e.id} onClick={() => navigate('enregistrer', e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: COLORS.amberBg, border: `0.5px solid ${COLORS.amber}50`, borderRadius: 10, cursor: 'pointer' }}>
                      <Avatar prenom={e.prenom} nom={e.nom} size={32} bg="#FAC775" color="#412402" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#412402' }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize: 11, color: '#854F0B' }}>Hizb {e.etat.hizbEnCours} à valider · {e.instituteurNom}</div>
                      </div>
                      <div style={{ fontSize: 10, background: COLORS.amber, color: '#fff', borderRadius: 20, padding: '2px 8px' }}>Valider</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activité récente */}
          <div className="section-label">Activité récente</div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th style={{width:'18%'}}>Date</th>
                <th style={{width:'28%'}}>Élève</th>
                <th style={{width:'28%'}}>Validation</th>
                <th style={{width:'26%'}}>Validé par</th>
              </tr></thead>
              <tbody>
                {allValidations.slice(0,8).map(v => {
                  const eleve = eleves.find(e => e.id === v.eleve_id);
                  return (
                    <tr key={v.id} className={eleve ? 'clickable' : ''} onClick={() => eleve && navigate('fiche', eleve)}>
                      <td style={{ fontSize: 12, color: COLORS.muted }}>{formatDateCourt(v.date_validation)}</td>
                      <td>
                        {eleve ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Avatar prenom={eleve.prenom} nom={eleve.nom} size={24} />
                            <span style={{ fontSize: 13 }}>{eleve.prenom} {eleve.nom}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {v.type_validation === 'hizb_complet'
                          ? <span className="badge badge-green">Hizb {v.hizb_valide} complet</span>
                          : <span className="badge badge-blue">{v.nombre_tomon} Tomon</span>}
                      </td>
                      <td style={{ fontSize: 12, color: COLORS.muted }}>{v.valideur ? `${v.valideur.prenom} ${v.valideur.nom}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== ÉLÈVES — CARTES ===== */}
      {!loading && vue === 'eleves' && (
        <>
          {/* Barre de filtres */}
          <div style={{ background: '#fff', border: `0.5px solid ${COLORS.border}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <input className="field-input" style={{ flex: 2, minWidth: 160 }} placeholder="Rechercher un élève..." value={searchEleve} onChange={e => setSearchEleve(e.target.value)} />
              <select className="field-select" style={{ flex: 1, minWidth: 130 }} value={filtreInst} onChange={e => setFiltreInst(e.target.value)}>
                <option value="tous">Tous les instituteurs</option>
                {instituteurs.map(i => <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
              </select>
              <select className="field-select" style={{ flex: 1, minWidth: 120 }} value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
                <option value="tous">Tous les statuts</option>
                <option value="actifs">Actifs</option>
                <option value="inactifs">Inactifs</option>
                <option value="attente">Attente Hizb</option>
              </select>
              <select className="field-select" style={{ flex: 1, minWidth: 120 }} value={filtreNiveau} onChange={e => setFiltreNiveau(e.target.value)}>
                <option value="tous">Tous les niveaux</option>
                <option>Débutant</option>
                <option>Intermédiaire</option>
                <option>Avancé</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: COLORS.muted }}>Trier par :</span>
              {[
                { key: 'points_desc', label: 'Score ↓' },
                { key: 'points_asc', label: 'Score ↑' },
                { key: 'hizb_desc', label: 'Hizb ↓' },
                { key: 'hizb_asc', label: 'Hizb ↑' },
                { key: 'nom_asc', label: 'Nom A→Z' },
                { key: 'recente', label: 'Récente' },
                { key: 'inactif', label: 'Inactifs' },
              ].map(t => (
                <div key={t.key} onClick={() => setTri(t.key)}
                  style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: tri === t.key ? 500 : 400, background: tri === t.key ? COLORS.greenBg : '#f5f5f0', color: tri === t.key ? '#085041' : COLORS.muted, border: `0.5px solid ${tri === t.key ? COLORS.green : COLORS.border}` }}>
                  {t.label}
                </div>
              ))}
              <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 'auto' }}>{elevesFiltres.length} élève{elevesFiltres.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Cartes élèves */}
          {elevesFiltres.length === 0 ? <div className="empty">Aucun élève trouvé.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 12 }}>
              {elevesFiltres.map((eleve, idx) => {
                const rang = [...eleves].sort((a,b) => b.etat.points.total - a.etat.points.total).findIndex(e => e.id === eleve.id) + 1;
                const sl = scoreLabel(eleve.etat.points.total);
                const urgence = eleve.inactif && eleve.jours > 21;
                return (
                  <div key={eleve.id} onClick={() => navigate('fiche', eleve)}
                    style={{ background: '#fff', border: `0.5px solid ${eleve.etat.enAttenteHizbComplet ? COLORS.amber : eleve.inactif ? COLORS.red : COLORS.border}`, borderRadius: 14, padding: '1.25rem', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', overflow: 'hidden' }}
                    onMouseEnter={ev => ev.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={ev => ev.currentTarget.style.transform = 'translateY(0)'}>

                    {/* Rang badge */}
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <Medaille idx={rang-1} />
                    </div>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <Avatar prenom={eleve.prenom} nom={eleve.nom} size={44} bg={sl.bg} color={sl.color} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{eleve.prenom} {eleve.nom}</div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>{eleve.instituteurNom}</div>
                        <ScoreBadge points={eleve.etat.points.total} />
                      </div>
                    </div>

                    {/* Score */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: sl.color }}>{eleve.etat.points.total.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>points</span>
                    </div>

                    {/* Détail points */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 12 }}>
                      {[
                        { lbl: 'Tomon', val: eleve.etat.points.ptsTomon },
                        { lbl: 'Roboe', val: eleve.etat.points.ptsRoboe },
                        { lbl: 'Nisf', val: eleve.etat.points.ptsNisf },
                        { lbl: 'Hizb', val: eleve.etat.points.ptsHizb },
                      ].map(p => (
                        <div key={p.lbl} style={{ background: '#f9f9f6', borderRadius: 6, padding: '5px', textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.dark }}>{p.val}</div>
                          <div style={{ fontSize: 9, color: COLORS.muted }}>{p.lbl}</div>
                        </div>
                      ))}
                    </div>

                    {/* Position */}
                    <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>
                      Hizb {eleve.etat.hizbEnCours} · T.{eleve.etat.prochainTomon || 1} · {eleve.etat.tomonCumul} Tomon total
                    </div>

                    {/* Barre progression */}
                    <ProgressBar8
                      done={eleve.etat.tomonDansHizbActuel}
                      color={eleve.etat.enAttenteHizbComplet ? COLORS.amber : COLORS.green}
                    />

                    {/* Statut */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>
                        {eleve.derniere ? `Dernière : ${formatDateCourt(eleve.derniere)}` : 'Jamais récité'}
                      </div>
                      {eleve.etat.enAttenteHizbComplet && <span className="badge badge-amber" style={{ fontSize: 9 }}>Hizb complet attendu</span>}
                      {eleve.inactif && !eleve.etat.enAttenteHizbComplet && <span className="badge badge-alert" style={{ fontSize: 9 }}>{eleve.jours}j inactif</span>}
                      {!eleve.inactif && !eleve.etat.enAttenteHizbComplet && <span className="badge badge-green" style={{ fontSize: 9 }}>Actif</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== INSTITUTEURS — CARTES ===== */}
      {!loading && vue === 'instituteurs' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 14 }}>
            {statsInst.sort((a,b) => b.totalPoints - a.totalPoints).map((inst, idx) => (
              <div key={inst.id} style={{ background: '#fff', border: `0.5px solid ${COLORS.border}`, borderRadius: 14, padding: '1.25rem', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <Avatar prenom={inst.prenom} nom={inst.nom} size={48} bg={COLORS.greenBg} color="#085041" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{inst.prenom} {inst.nom}</div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>{inst.nbEleves} élèves référents</div>
                  </div>
                  <Medaille idx={idx} />
                </div>

                {/* Score total groupe */}
                <div style={{ background: COLORS.greenBg, borderRadius: 10, padding: '12px', marginBottom: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Score du groupe</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: '#085041' }}>{inst.totalPoints.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#0F6E56' }}>points</div>
                </div>

                {/* Stats 4 cases */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                  {[
                    { lbl: 'Tomon', val: inst.totalTomon, bg: COLORS.blueBg, color: '#0C447C' },
                    { lbl: 'Hizb', val: inst.totalHizb, bg: COLORS.greenBg, color: '#085041' },
                    { lbl: 'Inactifs', val: inst.nbInactifs, bg: inst.nbInactifs > 0 ? COLORS.redBg : '#f9f9f6', color: inst.nbInactifs > 0 ? '#A32D2D' : '#bbb' },
                    { lbl: 'Attente', val: inst.nbAttente, bg: inst.nbAttente > 0 ? COLORS.amberBg : '#f9f9f6', color: inst.nbAttente > 0 ? '#633806' : '#bbb' },
                  ].map(s => (
                    <div key={s.lbl} style={{ background: s.bg, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: 9, color: s.color, opacity: 0.8 }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Meilleur élève */}
                {inst.meilleur && (
                  <div style={{ borderTop: `0.5px solid ${COLORS.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>Meilleur élève</div>
                    <div onClick={() => navigate('fiche', inst.meilleur)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <Avatar prenom={inst.meilleur.prenom} nom={inst.meilleur.nom} size={28} bg="#FAEEDA" color="#412402" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{inst.meilleur.prenom} {inst.meilleur.nom}</div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>Hizb {inst.meilleur.etat.hizbEnCours} · {inst.meilleur.etat.points.total.toLocaleString()} pts</div>
                      </div>
                      <span style={{ fontSize: 16, color: '#EF9F27' }}>★</span>
                    </div>
                  </div>
                )}

                {/* Liste élèves mini */}
                {inst.eleves.length > 0 && (
                  <div style={{ borderTop: `0.5px solid ${COLORS.border}`, paddingTop: 10, marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>Élèves</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[...inst.eleves].sort((a,b) => b.etat.points.total - a.etat.points.total).map(e => (
                        <div key={e.id} onClick={() => navigate('fiche', e)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 0' }}>
                          <Avatar prenom={e.prenom} nom={e.nom} size={22} />
                          <div style={{ flex: 1, fontSize: 12 }}>{e.prenom} {e.nom}</div>
                          <ProgressBar8 done={e.etat.tomonDansHizbActuel} color={e.etat.enAttenteHizbComplet ? COLORS.amber : COLORS.green} />
                          <span style={{ fontSize: 11, fontWeight: 500, color: COLORS.green, minWidth: 40, textAlign: 'right' }}>{e.etat.points.total} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== RAPPORT ===== */}
      {!loading && vue === 'rapport' && user.role === 'surveillant' && (
        <>
          {/* KPI rapport */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: '1.5rem' }}>
            {[
              { val: totalPoints.toLocaleString(), lbl: 'Score total école', color: COLORS.green },
              { val: stats.hizbsCompletsMois || 0, lbl: 'Hizb ce mois', color: COLORS.blue },
              { val: stats.tomonSemaine || 0, lbl: 'Tomon cette semaine', color: COLORS.amber },
              { val: stats.recitationsMois || 0, lbl: 'Récitations ce mois', color: COLORS.muted },
            ].map((k,i) => (
              <div key={i} style={{ background: '#fff', border: `0.5px solid ${COLORS.border}`, borderRadius: 12, padding: '14px', borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 3 }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Classement complet */}
          <div className="section-label">Classement général — tous les élèves</div>
          <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table>
              <thead><tr>
                <th style={{width:'6%'}}>#</th>
                <th style={{width:'22%'}}>Élève</th>
                <th style={{width:'14%'}}>Niveau</th>
                <th style={{width:'16%'}}>Instituteur</th>
                <th style={{width:'12%'}}>Hizb</th>
                <th style={{width:'10%'}}>Tomon</th>
                <th style={{width:'10%'}}>Hizb cplt</th>
                <th style={{width:'10%'}}>Score</th>
              </tr></thead>
              <tbody>
                {[...eleves].sort((a,b) => b.etat.points.total - a.etat.points.total).map((e, idx) => (
                  <tr key={e.id} className="clickable" onClick={() => navigate('fiche', e)}>
                    <td><Medaille idx={idx} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar prenom={e.prenom} nom={e.nom} size={24} />
                        <div>
                          <div style={{ fontSize: 13 }}>{e.prenom} {e.nom}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${e.niveau==='Avancé'?'badge-green':e.niveau==='Intermédiaire'?'badge-blue':'badge-amber'}`} style={{fontSize:10}}>{e.niveau}</span></td>
                    <td style={{fontSize:12,color:COLORS.muted}}>{e.instituteurNom}</td>
                    <td style={{fontSize:13}}>Hizb {e.etat.hizbEnCours}</td>
                    <td><span className="badge badge-blue" style={{fontSize:10}}>{e.etat.tomonCumul}</span></td>
                    <td><span className="badge badge-green" style={{fontSize:10}}>{e.etat.hizbsComplets.size}</span></td>
                    <td><span style={{fontSize:13,fontWeight:600,color:scoreLabel(e.etat.points.total).color}}>{e.etat.points.total.toLocaleString()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rapport instituteurs */}
          <div className="section-label">Performance par instituteur</div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th style={{width:'25%'}}>Instituteur</th>
                <th style={{width:'10%'}}>Élèves</th>
                <th style={{width:'15%'}}>Score groupe</th>
                <th style={{width:'12%'}}>Tomon</th>
                <th style={{width:'12%'}}>Hizb cplt</th>
                <th style={{width:'13%'}}>Inactifs</th>
                <th style={{width:'13%'}}>Attente</th>
              </tr></thead>
              <tbody>
                {statsInst.sort((a,b) => b.totalPoints - a.totalPoints).map(i => (
                  <tr key={i.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar prenom={i.prenom} nom={i.nom} size={28} />
                        {i.prenom} {i.nom}
                      </div>
                    </td>
                    <td style={{fontSize:13}}>{i.nbEleves}</td>
                    <td><span style={{fontSize:13,fontWeight:600,color:COLORS.green}}>{i.totalPoints.toLocaleString()}</span></td>
                    <td><span className="badge badge-blue" style={{fontSize:10}}>{i.totalTomon}</span></td>
                    <td><span className="badge badge-green" style={{fontSize:10}}>{i.totalHizb}</span></td>
                    <td>{i.nbInactifs > 0 ? <span className="badge badge-alert" style={{fontSize:10}}>{i.nbInactifs}</span> : <span style={{color:'#bbb',fontSize:12}}>—</span>}</td>
                    <td>{i.nbAttente > 0 ? <span className="badge badge-amber" style={{fontSize:10}}>{i.nbAttente}</span> : <span style={{color:'#bbb',fontSize:12}}>—</span>}</td>
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
