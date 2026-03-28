import React, { useState, useEffect } from 'react';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, formatDate, formatDateCourt, getInitiales, scoreLabel, joursDepuis, isInactif } from '../lib/helpers';

function Avatar({ prenom, nom, size = 44, bg = '#E1F5EE', color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function ProfilInstituteur({  instituteur, user, navigate , lang="fr" }) {
  const [eleves, setEleves] = useState([]);
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [instituteur.id]);

  const loadData = async () => {
    setLoading(true);
    const { data: ed } = await supabase.from('eleves').select('*').eq('instituteur_referent_id', instituteur.id);
    const { data: vd } = await supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').eq('valide_par', instituteur.id).order('date_validation', { ascending: false });
    const { data: allVd } = await supabase.from('validations').select('*');

    const elevesData = (ed || []).map(e => {
      const vals = (allVd || []).filter(v => v.eleve_id === e.id);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
      const derniere = vals[0]?.date_validation || null;
      return { ...e, etat, derniere, jours: joursDepuis(derniere), inactif: isInactif(derniere) };
    });

    setEleves(elevesData);
    setValidations(vd || []);
    setLoading(false);
  };

  const totalPoints = eleves.reduce((s,e) => s+e.etat.points.total, 0);
  const totalTomon = eleves.reduce((s,e) => s+e.etat.tomonCumul, 0);
  const nbInactifs = eleves.filter(e=>e.inactif).length;
  const meilleur = [...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total)[0];

  // Validations récentes par cet instituteur
  const recentes = validations.slice(0, 10);

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>{t(lang,'retour')}</button>

      {/* Header */}
      <div style={{ background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 16, padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <Avatar prenom={instituteur.prenom} nom={instituteur.nom} size={60} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{instituteur.prenom} {instituteur.nom}</div>
            <div style={{ fontSize: 13, color: '#888' }}>Instituteur · {eleves.length} élèves référents</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            { lbl: 'Score groupe', val: totalPoints.toLocaleString(), color: '#1D9E75', bg: '#E1F5EE' },
            { lbl: 'Tomon total', val: totalTomon, color: '#378ADD', bg: '#E6F1FB' },
            { lbl: 'Validations', val: validations.length, color: '#888', bg: '#f5f5f0' },
            { lbl: 'Inactifs', val: nbInactifs, color: nbInactifs>0?'#A32D2D':'#bbb', bg: nbInactifs>0?'#FCEBEB':'#f9f9f6' },
          ].map(k => (
            <div key={k.lbl} style={{ background: k.bg, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 10, color: k.color, opacity: 0.8 }}>{k.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {/* Meilleur élève */}
          {meilleur && (
            <>
              <div className="section-label">Meilleur élève ⭐</div>
              <div onClick={() => navigate('fiche', meilleur)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', background: '#FAEEDA', border: '0.5px solid #EF9F27', borderRadius: 12, cursor: 'pointer', marginBottom: '1rem' }}>
                <Avatar prenom={meilleur.prenom} nom={meilleur.nom} size={44} bg="#FAC775" color="#412402" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#412402' }}>{meilleur.prenom} {meilleur.nom}</div>
                  <div style={{ fontSize: 12, color: '#854F0B' }}>Hizb {meilleur.etat.hizbEnCours} · {meilleur.etat.tomonCumul} Tomon · {meilleur.etat.hizbsComplets.size} Hizb complets</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#EF9F27' }}>{meilleur.etat.points.total.toLocaleString()} pts</div>
              </div>
            </>
          )}

          {/* Tous les élèves */}
          <div className="section-label">Mes élèves ({eleves.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1.5rem' }}>
            {[...eleves].sort((a,b)=>b.etat.points.total-a.etat.points.total).map((e, idx) => {
              const sl = scoreLabel(e.etat.points.total);
              return (
                <div key={e.id} onClick={() => navigate('fiche', e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: '#fff', border: `0.5px solid ${e.inactif?'#E24B4A30':e.etat.enAttenteHizbComplet?'#EF9F2730':'#e0e0d8'}`, borderRadius: 10, cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#bbb', minWidth: 20, textAlign: 'center' }}>{idx+1}</div>
                  <Avatar prenom={e.prenom} nom={e.nom} size={34} bg={sl.bg} color={sl.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Hizb {e.etat.hizbEnCours} · {e.etat.tomonDansHizbActuel}/8 Tomon</div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, marginRight: 8 }}>
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <div key={n} style={{ width: 5, height: 8, borderRadius: 2, background: n <= e.etat.tomonDansHizbActuel ? (e.etat.enAttenteHizbComplet?'#EF9F27':'#1D9E75') : '#e8e8e0' }} />
                    ))}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: sl.color }}>{e.etat.points.total} pts</div>
                    {e.inactif && <span style={{ fontSize: 10, color: '#A32D2D' }}>{e.jours}j</span>}
                    {e.etat.enAttenteHizbComplet && <span style={{ fontSize: 10, color: '#854F0B' }}>Hizb ⏳</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activité récente de cet instituteur */}
          <div className="section-label">Mes dernières validations</div>
          {recentes.length === 0 ? <div className="empty">Aucune validation.</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{width:'22%'}}>Date</th>
                  <th style={{width:'28%'}}>Élève</th>
                  <th style={{width:'30%'}}>Validation</th>
                  <th style={{width:'20%'}}>Points</th>
                </tr></thead>
                <tbody>
                  {recentes.map(v => {
                    const eleve = eleves.find(e => e.id === v.eleve_id);
                    return (
                      <tr key={v.id} className={eleve?'clickable':''} onClick={() => eleve && navigate('fiche', eleve)}>
                        <td style={{fontSize:12,color:'#888'}}>{formatDateCourt(v.date_validation)}</td>
                        <td style={{fontSize:13}}>{eleve?`${eleve.prenom} ${eleve.nom}`:'—'}</td>
                        <td>
                          {v.type_validation==='hizb_complet'
                            ?<span className="badge badge-green">Hizb {v.hizb_valide} complet</span>
                            :<span className="badge badge-blue">{v.nombre_tomon} Tomon{v.tomon_debut?` (T.${v.tomon_debut}→${v.tomon_debut+v.nombre_tomon-1})`:''}  </span>}
                        </td>
                        <td><span style={{fontSize:12,fontWeight:600,color:'#1D9E75'}}>+{v.type_validation==='hizb_complet'?100:v.nombre_tomon*10} pts</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
