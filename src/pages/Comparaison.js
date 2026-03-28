import React, { useState, useEffect } from 'react';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, formatDateCourt } from '../lib/helpers';

const PALETTE = ['#1D9E75','#378ADD','#EF9F27','#E24B4A','#534AB7','#D85A30'];

function Avatar({ prenom, nom, size = 28, bg, color }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg||'#E1F5EE', color: color||'#085041', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size*0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function Comparaison({  navigate , lang="fr" }) {
  const [allEleves, setAllEleves] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: ed } = await supabase.from('eleves').select('*').order('nom');
    const { data: vd } = await supabase.from('validations').select('*').order('date_validation');
    const elevesData = (ed||[]).map(e => {
      const vals = (vd||[]).filter(v => v.eleve_id === e.id);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
      return { ...e, etat, validations: vals };
    });
    setAllEleves(elevesData);
    setAllValidations(vd||[]);
    setLoading(false);
  };

  const toggleEleve = (e) => {
    if (selected.find(s => s.id === e.id)) {
      setSelected(selected.filter(s => s.id !== e.id));
    } else if (selected.length < 6) {
      setSelected([...selected, e]);
    }
  };

  // Évolution des scores dans le temps
  const calcEvolutionEleve = (eleve) => {
    const vals = [...eleve.validations].sort((a,b) => new Date(a.date_validation)-new Date(b.date_validation));
    let cumul = 0; let hizbsComplets = new Set();
    const points = [{ date: null, score: 0 }];
    vals.forEach(v => {
      if (v.type_validation === 'hizb_complet') { hizbsComplets.add(v.hizb_valide); }
      else { cumul += v.nombre_tomon; }
      const score = cumul*10 + Math.floor(cumul/2)*25 + Math.floor(cumul/4)*60 + hizbsComplets.size*100;
      points.push({ date: v.date_validation, score, label: formatDateCourt(v.date_validation) });
    });
    return points;
  };

  const evolutions = selected.map(e => ({ eleve: e, points: calcEvolutionEleve(e) }));
  const maxScore = Math.max(...evolutions.flatMap(ev => ev.points.map(p => p.score)), 1);

  const filteredEleves = allEleves.filter(e =>
    `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>{t(lang,'retour')}</button>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: '1.5rem' }}>{t(lang,'comparer_eleves')}</div>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {/* Sélecteur */}
          <div style={{ background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 12, padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{t(lang,'selectionner_comparer')}</div>
            <input className="field-input" style={{ marginBottom: 10 }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filteredEleves.map((e, idx) => {
                const selIdx = selected.findIndex(s => s.id === e.id);
                const isSelected = selIdx >= 0;
                const color = isSelected ? PALETTE[selIdx] : '#888';
                return (
                  <div key={e.id} onClick={() => toggleEleve(e)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: `1.5px solid ${isSelected ? color : '#e0e0d8'}`, background: isSelected ? color+'15' : '#f9f9f6', transition: 'all 0.15s' }}>
                    {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
                    <span style={{ fontSize: 12, fontWeight: isSelected ? 500 : 400, color: isSelected ? color : '#666' }}>{e.prenom} {e.nom}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {selected.length === 0 ? (
            <div className="empty">{t(lang,'rechercher_commencer')}</div>
          ) : (
            <>
              {/* Légende */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' }}>
                {selected.map((e, idx) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#fff', border: `1.5px solid ${PALETTE[idx]}`, borderRadius: 20 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: PALETTE[idx] }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: PALETTE[idx] }}>{e.prenom} {e.nom}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>· {e.etat.points.total.toLocaleString()} pts</span>
                  </div>
                ))}
              </div>

              {/* Graphique SVG comparaison */}
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Évolution du score</div>
                <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
                  {/* Lignes de référence */}
                  {[0,25,50,75,100].map(pct => (
                    <div key={pct} style={{ position: 'absolute', left: 0, right: 0, top: `${100-pct}%`, borderTop: '0.5px solid #e8e8e0' }}>
                      <span style={{ fontSize: 9, color: '#bbb', marginLeft: 2 }}>{Math.round(maxScore*pct/100)}</span>
                    </div>
                  ))}
                  <svg style={{ position: 'absolute', left: 30, top: 0, width: 'calc(100% - 30px)', height: '90%' }}>
                    {evolutions.map((ev, idx) => {
                      if (ev.points.length < 2) return null;
                      const color = PALETTE[idx];
                      const w = 100 / (ev.points.length - 1);
                      const pts = ev.points.map((p,i) => `${i*w}%,${90-(p.score/maxScore)*85}%`).join(' ');
                      return (
                        <g key={ev.eleve.id}>
                          <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" opacity="0.9" />
                          {ev.points.map((p,i) => (
                            <circle key={i} cx={`${i*w}%`} cy={`${90-(p.score/maxScore)*85}%`} r="3" fill={color} />
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Tableau comparatif */}
              <div className="section-label">Tableau comparatif</div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th style={{width:'22%'}}>Élève</th>
                    <th style={{width:'14%'}}>Score</th>
                    <th style={{width:'14%'}}>Hizb</th>
                    <th style={{width:'14%'}}>Tomon</th>
                    <th style={{width:'14%'}}>Hizb cplt</th>
                    <th style={{width:'22%'}}>Progression Hizb</th>
                  </tr></thead>
                  <tbody>
                    {selected.map((e, idx) => {
                      const sl = scoreLabel(e.etat.points.total);
                      return (
                        <tr key={e.id} className="clickable" onClick={() => navigate('fiche', e)}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: PALETTE[idx], flexShrink: 0 }} />
                              <Avatar prenom={e.prenom} nom={e.nom} size={26} bg={PALETTE[idx]+'20'} color={PALETTE[idx]} />
                              <span style={{ fontSize: 13 }}>{e.prenom} {e.nom}</span>
                            </div>
                          </td>
                          <td><span style={{ fontSize: 14, fontWeight: 700, color: PALETTE[idx] }}>{e.etat.points.total.toLocaleString()}</span></td>
                          <td style={{ fontSize: 13 }}>Hizb {e.etat.hizbEnCours}</td>
                          <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{e.etat.tomonCumul}</span></td>
                          <td><span className="badge badge-green" style={{ fontSize: 10 }}>{e.etat.hizbsComplets.size}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 2 }}>
                              {[1,2,3,4,5,6,7,8].map(n => (
                                <div key={n} style={{ flex: 1, height: 8, borderRadius: 2, background: n <= e.etat.tomonDansHizbActuel ? PALETTE[idx] : '#e8e8e0' }} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Classement entre eux */}
              <div className="section-label">Classement entre eux</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...selected].sort((a,b) => b.etat.points.total-a.etat.points.total).map((e, idx) => {
                  const origIdx = selected.findIndex(s => s.id === e.id);
                  const color = PALETTE[origIdx];
                  const pct = maxScore > 0 ? (e.etat.points.total/selected.reduce((m,s)=>Math.max(m,s.etat.points.total),1))*100 : 0;
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: `0.5px solid ${color}30`, borderRadius: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color, minWidth: 20 }}>{idx+1}</div>
                      <Avatar prenom={e.prenom} nom={e.nom} size={32} bg={color+'15'} color={color} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{e.prenom} {e.nom}</div>
                        <div style={{ height: 5, background: '#e8e8e0', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color }}>{e.etat.points.total.toLocaleString()} pts</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
