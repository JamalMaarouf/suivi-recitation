import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcStats, formatDate, formatDateCourt, isInactif, joursDepuis, getInitiales, scoreLabel } from '../lib/helpers';

const C = {
  green: '#1D9E75', greenBg: '#E1F5EE', greenLight: '#9FE1CB',
  blue: '#378ADD', blueBg: '#E6F1FB',
  amber: '#EF9F27', amberBg: '#FAEEDA',
  red: '#E24B4A', redBg: '#FCEBEB',
  border: '#e0e0d8', muted: '#888', dark: '#1a1a1a'
};

function Avatar({ prenom, nom, size = 36, bg = C.greenBg, color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

function Medaille({ idx }) {
  const colors = ['#EF9F27','#B0B0B0','#CD7F32'];
  if (idx > 2) return <span style={{ fontSize: 11, color: '#bbb', width: 22, display: 'inline-block', textAlign: 'center' }}>{idx+1}</span>;
  return <div style={{ width: 22, height: 22, borderRadius: '50%', background: colors[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0 }}>{idx+1}</div>;
}

function ProgressBar8({ done, color = C.green }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5,6,7,8].map(n => (
        <div key={n} style={{ flex: 1, height: 5, borderRadius: 2, background: n <= done ? color : '#e8e8e0' }} />
      ))}
    </div>
  );
}

export default function Dashboard({ user, navigate }) {
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('general');
  const [stats, setStats] = useState({});
  const [exportMsg, setExportMsg] = useState('');

  // Filtres
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

  // Export Excel (CSV)
  const exportExcel = () => {
    const rang = [...eleves].sort((a,b) => b.etat.points.total - a.etat.points.total);
    const rows = [
      ['Rang', 'Prénom', 'Nom', 'Niveau', 'Instituteur référent', 'Hizb départ', 'Tomon départ', 'Hizb en cours', 'Tomon validés dans Hizb', 'Total Tomon', 'Hizb complets', 'Pts Tomon', 'Pts Roboe', 'Pts Nisf', 'Pts Hizb', 'Score Total', 'Dernière récitation', 'Statut'],
      ...rang.map((e, idx) => [
        idx + 1, e.prenom, e.nom, e.niveau, e.instituteurNom,
        e.hizb_depart, e.tomon_depart,
        e.etat.hizbEnCours, e.etat.tomonDansHizbActuel,
        e.etat.tomonCumul, e.etat.hizbsComplets.size,
        e.etat.points.ptsTomon, e.etat.points.ptsRoboe, e.etat.points.ptsNisf, e.etat.points.ptsHizb,
        e.etat.points.total,
        e.derniere ? formatDate(e.derniere) : 'Jamais',
        e.etat.enAttenteHizbComplet ? 'Attente Hizb complet' : e.inactif ? `Inactif (${e.jours}j)` : 'Actif'
      ])
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `suivi-recitation-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setExportMsg('Export Excel téléchargé !');
    setTimeout(() => setExportMsg(''), 3000);
  };

  // Backup JSON
  const backupJSON = async () => {
    const { data: elevesAll } = await supabase.from('eleves').select('*');
    const { data: validAll } = await supabase.from('validations').select('*');
    const { data: usersAll } = await supabase.from('utilisateurs').select('id, prenom, nom, identifiant, role');
    const backup = { date: new Date().toISOString(), eleves: elevesAll, validations: validAll, utilisateurs: usersAll };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `backup-recitation-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.json`;
    a.click(); URL.revokeObjectURL(url);
    setExportMsg('Backup JSON téléchargé !');
    setTimeout(() => setExportMsg(''), 3000);
  };

  const totalPoints = eleves.reduce((s, e) => s + e.etat.points.total, 0);
  const totalTomon = eleves.reduce((s, e) => s + e.etat.tomonCumul, 0);
  const totalHizb = eleves.reduce((s, e) => s + e.etat.hizbsComplets.size, 0);
  const nbInactifs = eleves.filter(e => e.inactif).length;
  const nbAttente = eleves.filter(e => e.etat.enAttenteHizbComplet).length;

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

  const statsInst = useMemo(() => instituteurs.map(inst => {
    const ei = eleves.filter(e => e.instituteur_referent_id === inst.id);
    return { ...inst, nbEleves: ei.length, totalPoints: ei.reduce((s,e) => s+e.etat.points.total,0), totalTomon: ei.reduce((s,e) => s+e.etat.tomonCumul,0), totalHizb: ei.reduce((s,e) => s+e.etat.hizbsComplets.size,0), nbInactifs: ei.filter(e=>e.inactif).length, nbAttente: ei.filter(e=>e.etat.enAttenteHizbComplet).length, meilleur: [...ei].sort((a,b)=>b.etat.points.total-a.etat.points.total)[0]||null, eleves: ei };
  }), [instituteurs, eleves]);

  const tabs = [
    { key: 'general', label: '🏠 Général' },
    { key: 'eleves', label: '👥 Élèves' },
    { key: 'instituteurs', label: '👨‍🏫 Instituteurs' },
    ...(user.role === 'surveillant' ? [{ key: 'rapport', label: '📊 Rapport' }] : [])
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{tabs.find(t=>t.key===vue)?.label?.split(' ').slice(1).join(' ')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {exportMsg && <span style={{ fontSize: 12, color: C.green, fontWeight: 500 }}>{exportMsg}</span>}
          {user.role === 'surveillant' && (
            <>
              <button onClick={exportExcel} style={{ padding: '6px 12px', border: `0.5px solid ${C.border}`, borderRadius: 8, background: '#fff', fontSize: 11, cursor: 'pointer', color: '#444' }}>📥 Export Excel</button>
              <button onClick={backupJSON} style={{ padding: '6px 12px', border: `0.5px solid ${C.border}`, borderRadius: 8, background: '#fff', fontSize: 11, cursor: 'pointer', color: '#444' }}>💾 Backup JSON</button>
            </>
          )}
          <button onClick={() => navigate('honneur')} style={{ padding: '6px 12px', background: C.green, color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>🏆 Tableau d'honneur</button>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 0, background: '#f0f0ec', borderRadius: 10, padding: 3, marginBottom: '1.5rem', width: 'fit-content' }}>
        {tabs.map(t => (
          <div key={t.key} onClick={() => setVue(t.key)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: vue===t.key?600:400, cursor: 'pointer', background: vue===t.key?'#fff':'transparent', color: vue===t.key?C.dark:C.muted, border: vue===t.key?`0.5px solid ${C.border}`:'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {t.label}
          </div>
        ))}
      </div>

      {loading && <div className="loading">Chargement...</div>}

      {/* ===== GÉNÉRAL ===== */}
      {!loading && vue === 'general' && (
        <>
          {/* Score école banner */}
          <div style={{ background: 'linear-gradient(135deg, #085041 0%, #1D9E75 100%)', borderRadius: 16, padding: '1.5rem', marginBottom: '1.25rem', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 6 }}>Score global de l'école</div>
            <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1 }}>{totalPoints.toLocaleString()}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, marginBottom: 16 }}>points cumulés</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{totalTomon}</div><div style={{ fontSize: 11, opacity: 0.65 }}>Tomon récités</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{totalHizb}</div><div style={{ fontSize: 11, opacity: 0.65 }}>Hizb complets</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{eleves.length}</div><div style={{ fontSize: 11, opacity: 0.65 }}>Élèves</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{instituteurs.length}</div><div style={{ fontSize: 11, opacity: 0.65 }}>Instituteurs</div></div>
            </div>
          </div>

          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: '1.25rem' }}>
            {[
              { val: stats.tomonSemaine||0, lbl: 'Tomon cette semaine', color: C.green },
              { val: stats.hizbsCompletsMois||0, lbl: 'Hizb complets ce mois', color: C.blue },
              { val: nbAttente, lbl: 'Attente Hizb complet', color: C.amber },
              { val: nbInactifs, lbl: 'Inactifs +14 jours', color: C.red },
            ].map((k,i) => (
              <div key={i} style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px', borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Podium */}
          <div className="section-label">Podium</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: '1.5rem' }}>
            {[1,0,2].map(rank => {
              const e = [...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total)[rank];
              if (!e) return null;
              const podColors = ['#EF9F27','#B0B0B0','#CD7F32'];
              const podBgs = ['#FAEEDA','#f5f5f0','#f9f3ec'];
              const podH = [140,110,90];
              const sl = scoreLabel(e.etat.points.total);
              return (
                <div key={e.id} onClick={() => navigate('fiche', e)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', maxWidth: 160 }}>
                  {rank === 0 && <div style={{ fontSize: 20, marginBottom: 2 }}>👑</div>}
                  <Avatar prenom={e.prenom} nom={e.nom} size={rank===0?52:42} bg={podBgs[rank]} color={podColors[rank]} />
                  <div style={{ fontSize: rank===0?13:12, fontWeight: 600, marginTop: 6, textAlign: 'center' }}>{e.prenom} {e.nom}</div>
                  <div style={{ fontSize: rank===0?16:14, fontWeight: 700, color: podColors[rank], margin: '4px 0' }}>{e.etat.points.total.toLocaleString()} pts</div>
                  <div style={{ width: '100%', height: podH[rank], background: podBgs[rank], border: `0.5px solid ${podColors[rank]}40`, borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: rank===0?36:28, fontWeight: 800, color: podColors[rank], opacity: 0.7 }}>{rank+1}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Urgences */}
            <div>
              <div className="section-label">À relancer</div>
              {eleves.filter(e=>e.inactif).length === 0 ? (
                <div style={{ padding: '1rem', background: C.greenBg, borderRadius: 10, fontSize: 13, color: '#085041', textAlign: 'center' }}>Tous actifs ✓</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...eleves].filter(e=>e.inactif).sort((a,b)=>(b.jours||0)-(a.jours||0)).slice(0,5).map(e => (
                    <div key={e.id} onClick={() => navigate('fiche', e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: e.jours>30?C.redBg:C.amberBg, borderRadius: 10, cursor: 'pointer' }}>
                      <Avatar prenom={e.prenom} nom={e.nom} size={30} bg="transparent" color={e.jours>30?C.red:'#633806'} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: e.jours>30?C.red:'#412402' }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize: 11, color: e.jours>30?'#A32D2D':'#854F0B', opacity:0.8 }}>{e.instituteurNom}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: e.jours>30?C.red:'#633806' }}>{e.jours!=null?`${e.jours}j`:'∞'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attente Hizb */}
            <div>
              <div className="section-label">Attente Hizb complet</div>
              {nbAttente === 0 ? (
                <div style={{ padding: '1rem', background: C.greenBg, borderRadius: 10, fontSize: 13, color: '#085041', textAlign: 'center' }}>Aucun en attente ✓</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {eleves.filter(e=>e.etat.enAttenteHizbComplet).map(e => (
                    <div key={e.id} onClick={() => navigate('enregistrer', e)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.amberBg, border: `0.5px solid ${C.amber}40`, borderRadius: 10, cursor: 'pointer' }}>
                      <Avatar prenom={e.prenom} nom={e.nom} size={30} bg="#FAC775" color="#412402" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#412402' }}>{e.prenom} {e.nom}</div>
                        <div style={{ fontSize: 11, color: '#854F0B' }}>Hizb {e.etat.hizbEnCours} · {e.instituteurNom}</div>
                      </div>
                      <span style={{ fontSize: 10, background: C.amber, color: '#fff', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>Valider</span>
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
                <th style={{width:'30%'}}>Validation</th>
                <th style={{width:'24%'}}>Validé par</th>
              </tr></thead>
              <tbody>
                {allValidations.slice(0,8).length === 0 && <tr><td colSpan={4} className="empty">Aucune activité.</td></tr>}
                {allValidations.slice(0,8).map(v => {
                  const e = eleves.find(el => el.id === v.eleve_id);
                  return (
                    <tr key={v.id} className={e?'clickable':''} onClick={() => e && navigate('fiche', e)}>
                      <td style={{fontSize:12,color:C.muted}}>{formatDateCourt(v.date_validation)}</td>
                      <td>{e?<div style={{display:'flex',alignItems:'center',gap:6}}><Avatar prenom={e.prenom} nom={e.nom} size={22}/><span style={{fontSize:13}}>{e.prenom} {e.nom}</span></div>:'—'}</td>
                      <td>{v.type_validation==='hizb_complet'?<span className="badge badge-green">Hizb {v.hizb_valide} complet</span>:<span className="badge badge-blue">{v.nombre_tomon} Tomon</span>}</td>
                      <td style={{fontSize:12,color:C.muted}}>{v.valideur?`${v.valideur.prenom} ${v.valideur.nom}`:'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== ÉLÈVES CARTES ===== */}
      {!loading && vue === 'eleves' && (
        <>
          <div style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <input className="field-input" style={{ flex: 2, minWidth: 160 }} placeholder="Rechercher..." value={searchEleve} onChange={e => setSearchEleve(e.target.value)} />
              <select className="field-select" style={{ flex: 1, minWidth: 130 }} value={filtreInst} onChange={e => setFiltreInst(e.target.value)}>
                <option value="tous">Tous les instituteurs</option>
                {instituteurs.map(i => <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
              </select>
              <select className="field-select" style={{ flex: 1, minWidth: 110 }} value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
                <option value="tous">Tous statuts</option>
                <option value="actifs">Actifs</option>
                <option value="inactifs">Inactifs</option>
                <option value="attente">Attente Hizb</option>
              </select>
              <select className="field-select" style={{ flex: 1, minWidth: 110 }} value={filtreNiveau} onChange={e => setFiltreNiveau(e.target.value)}>
                <option value="tous">Tous niveaux</option>
                <option>Débutant</option>
                <option>Intermédiaire</option>
                <option>Avancé</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.muted }}>Tri :</span>
              {[['points_desc','Score ↓'],['points_asc','Score ↑'],['hizb_desc','Hizb ↓'],['hizb_asc','Hizb ↑'],['nom_asc','Nom A→Z'],['recente','Récente'],['inactif','Inactifs']].map(([k,l]) => (
                <div key={k} onClick={() => setTri(k)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', background: tri===k?C.greenBg:'#f5f5f0', color: tri===k?'#085041':C.muted, border: `0.5px solid ${tri===k?C.green:C.border}`, fontWeight: tri===k?500:400 }}>{l}</div>
              ))}
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{elevesFiltres.length} élève{elevesFiltres.length>1?'s':''}</span>
            </div>
          </div>

          {elevesFiltres.length === 0 ? <div className="empty">Aucun élève.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px,1fr))', gap: 12 }}>
              {elevesFiltres.map(eleve => {
                const rang = [...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).findIndex(e=>e.id===eleve.id)+1;
                const sl = scoreLabel(eleve.etat.points.total);
                return (
                  <div key={eleve.id} onClick={() => navigate('fiche', eleve)}
                    style={{ background: '#fff', border: `0.5px solid ${eleve.etat.enAttenteHizbComplet?C.amber:eleve.inactif?C.red:C.border}`, borderRadius: 14, padding: '1.25rem', cursor: 'pointer', transition: 'transform 0.15s' }}
                    onMouseEnter={ev => ev.currentTarget.style.transform='translateY(-2px)'}
                    onMouseLeave={ev => ev.currentTarget.style.transform='translateY(0)'}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar prenom={eleve.prenom} nom={eleve.nom} size={44} bg={sl.bg} color={sl.color} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{eleve.prenom} {eleve.nom}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{eleve.instituteurNom}</div>
                          <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: sl.bg, color: sl.color }}>{sl.label}</span>
                        </div>
                      </div>
                      <Medaille idx={rang-1} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                      <span style={{ fontSize: 30, fontWeight: 800, color: sl.color, letterSpacing: '-1px' }}>{eleve.etat.points.total.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>pts</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 10 }}>
                      {[['T', eleve.etat.points.ptsTomon],['R', eleve.etat.points.ptsRoboe],['N', eleve.etat.points.ptsNisf],['H', eleve.etat.points.ptsHizb]].map(([l,v]) => (
                        <div key={l} style={{ background: '#f9f9f6', borderRadius: 6, padding: '5px 2px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>{v}</div>
                          <div style={{ fontSize: 9, color: C.muted }}>{l}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Hizb {eleve.etat.hizbEnCours} · {eleve.etat.tomonCumul} Tomon · {eleve.etat.hizbsComplets.size} Hizb complets</div>
                    <ProgressBar8 done={eleve.etat.tomonDansHizbActuel} color={eleve.etat.enAttenteHizbComplet?C.amber:C.green} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: C.muted }}>{eleve.derniere?formatDateCourt(eleve.derniere):'Jamais récité'}</div>
                      {eleve.etat.enAttenteHizbComplet?<span className="badge badge-amber" style={{fontSize:9}}>Hizb attendu</span>:eleve.inactif?<span className="badge badge-alert" style={{fontSize:9}}>{eleve.jours}j inactif</span>:<span className="badge badge-green" style={{fontSize:9}}>Actif</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== INSTITUTEURS ===== */}
      {!loading && vue === 'instituteurs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 14 }}>
          {statsInst.sort((a,b)=>b.totalPoints-a.totalPoints).map((inst, idx) => (
            <div key={inst.id} style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <Avatar prenom={inst.prenom} nom={inst.nom} size={48} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{inst.prenom} {inst.nom}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{inst.nbEleves} élèves référents</div>
                </div>
                <Medaille idx={idx} />
              </div>

              <div style={{ background: C.greenBg, borderRadius: 10, padding: '12px', marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Score du groupe</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#085041', letterSpacing: '-1px' }}>{inst.totalPoints.toLocaleString()}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
                {[
                  { l: 'Tomon', v: inst.totalTomon, bg: C.blueBg, c: '#0C447C' },
                  { l: 'Hizb', v: inst.totalHizb, bg: C.greenBg, c: '#085041' },
                  { l: 'Inactifs', v: inst.nbInactifs, bg: inst.nbInactifs>0?C.redBg:'#f9f9f6', c: inst.nbInactifs>0?'#A32D2D':'#bbb' },
                  { l: 'Attente', v: inst.nbAttente, bg: inst.nbAttente>0?C.amberBg:'#f9f9f6', c: inst.nbAttente>0?'#633806':'#bbb' },
                ].map(s => (
                  <div key={s.l} style={{ background: s.bg, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: s.c, opacity: 0.8 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {inst.meilleur && (
                <div style={{ borderTop: `0.5px solid ${C.border}`, paddingTop: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>Meilleur élève ⭐</div>
                  <div onClick={() => navigate('fiche', inst.meilleur)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Avatar prenom={inst.meilleur.prenom} nom={inst.meilleur.nom} size={28} bg="#FAEEDA" color="#412402" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{inst.meilleur.prenom} {inst.meilleur.nom}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>Hizb {inst.meilleur.etat.hizbEnCours} · {inst.meilleur.etat.points.total.toLocaleString()} pts</div>
                    </div>
                  </div>
                </div>
              )}

              {inst.eleves.length > 0 && (
                <div style={{ borderTop: `0.5px solid ${C.border}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>Tous les élèves</div>
                  {[...inst.eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).map(e => (
                    <div key={e.id} onClick={() => navigate('fiche', e)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', cursor: 'pointer', borderBottom: `0.5px solid ${C.border}` }}>
                      <Avatar prenom={e.prenom} nom={e.nom} size={22} />
                      <div style={{ flex: 1, fontSize: 12 }}>{e.prenom} {e.nom}</div>
                      <ProgressBar8 done={e.etat.tomonDansHizbActuel} color={e.etat.enAttenteHizbComplet?C.amber:C.green} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.green, minWidth: 50, textAlign: 'right' }}>{e.etat.points.total} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== RAPPORT ===== */}
      {!loading && vue === 'rapport' && user.role === 'surveillant' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: '1.5rem' }}>
            {[
              { val: totalPoints.toLocaleString(), lbl: 'Score total école', color: C.green },
              { val: stats.hizbsCompletsMois||0, lbl: 'Hizb ce mois', color: C.blue },
              { val: stats.tomonSemaine||0, lbl: 'Tomon cette semaine', color: C.amber },
              { val: stats.recitationsMois||0, lbl: 'Récitations ce mois', color: C.muted },
            ].map((k,i) => (
              <div key={i} style={{ background: '#fff', border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px', borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          <div className="section-label">Classement complet</div>
          <div className="table-wrap" style={{ marginBottom: '1.5rem' }}>
            <table>
              <thead><tr>
                <th style={{width:'5%'}}>#</th>
                <th style={{width:'20%'}}>Élève</th>
                <th style={{width:'12%'}}>Niveau</th>
                <th style={{width:'15%'}}>Instituteur</th>
                <th style={{width:'10%'}}>Hizb</th>
                <th style={{width:'8%'}}>Tomon</th>
                <th style={{width:'8%'}}>Hizb cplt</th>
                <th style={{width:'12%'}}>Score</th>
                <th style={{width:'10%'}}>Statut</th>
              </tr></thead>
              <tbody>
                {[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).map((e,idx) => {
                  const sl = scoreLabel(e.etat.points.total);
                  return (
                    <tr key={e.id} className="clickable" onClick={() => navigate('fiche', e)}>
                      <td><Medaille idx={idx} /></td>
                      <td><div style={{display:'flex',alignItems:'center',gap:6}}><Avatar prenom={e.prenom} nom={e.nom} size={24}/><span style={{fontSize:13}}>{e.prenom} {e.nom}</span></div></td>
                      <td><span className={`badge ${e.niveau==='Avancé'?'badge-green':e.niveau==='Intermédiaire'?'badge-blue':'badge-amber'}`} style={{fontSize:10}}>{e.niveau}</span></td>
                      <td style={{fontSize:11,color:C.muted}}>{e.instituteurNom}</td>
                      <td style={{fontSize:12}}>Hizb {e.etat.hizbEnCours}</td>
                      <td><span className="badge badge-blue" style={{fontSize:10}}>{e.etat.tomonCumul}</span></td>
                      <td><span className="badge badge-green" style={{fontSize:10}}>{e.etat.hizbsComplets.size}</span></td>
                      <td><span style={{fontSize:13,fontWeight:700,color:sl.color}}>{e.etat.points.total.toLocaleString()}</span></td>
                      <td>{e.etat.enAttenteHizbComplet?<span className="badge badge-amber" style={{fontSize:9}}>Attente Hizb</span>:e.inactif?<span className="badge badge-alert" style={{fontSize:9}}>Inactif</span>:<span className="badge badge-green" style={{fontSize:9}}>Actif</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="section-label">Performance instituteurs</div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th style={{width:'5%'}}>#</th>
                <th style={{width:'22%'}}>Instituteur</th>
                <th style={{width:'10%'}}>Élèves</th>
                <th style={{width:'15%'}}>Score groupe</th>
                <th style={{width:'12%'}}>Tomon total</th>
                <th style={{width:'12%'}}>Hizb complets</th>
                <th style={{width:'12%'}}>Inactifs</th>
                <th style={{width:'12%'}}>Attente Hizb</th>
              </tr></thead>
              <tbody>
                {statsInst.sort((a,b)=>b.totalPoints-a.totalPoints).map((i,idx) => (
                  <tr key={i.id}>
                    <td><Medaille idx={idx} /></td>
                    <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={i.prenom} nom={i.nom} size={28}/>{i.prenom} {i.nom}</div></td>
                    <td style={{fontSize:13}}>{i.nbEleves}</td>
                    <td><span style={{fontSize:13,fontWeight:700,color:C.green}}>{i.totalPoints.toLocaleString()}</span></td>
                    <td><span className="badge badge-blue" style={{fontSize:10}}>{i.totalTomon}</span></td>
                    <td><span className="badge badge-green" style={{fontSize:10}}>{i.totalHizb}</span></td>
                    <td>{i.nbInactifs>0?<span className="badge badge-alert" style={{fontSize:10}}>{i.nbInactifs}</span>:<span style={{color:'#bbb',fontSize:12}}>—</span>}</td>
                    <td>{i.nbAttente>0?<span className="badge badge-amber" style={{fontSize:10}}>{i.nbAttente}</span>:<span style={{color:'#bbb',fontSize:12}}>—</span>}</td>
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
