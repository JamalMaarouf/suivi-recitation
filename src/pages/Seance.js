import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, formatDate, formatDateCourt, getInitiales, joursDepuis, isInactif, scoreLabel } from '../lib/helpers';

function Avatar({ prenom, nom, size = 36, bg = '#E1F5EE', color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function Seance({ user, navigate }) {
  const [eleves, setEleves] = useState([]);
  const [validationsAujourdhui, setValidationsAujourdhui] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toDateString();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: ed } = await supabase.from('eleves').select('*').order('nom');
    const { data: vd } = await supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').order('date_validation', { ascending: false });

    const debutJour = new Date(); debutJour.setHours(0,0,0,0);
    const vAujourdhui = (vd || []).filter(v => new Date(v.date_validation) >= debutJour);

    const elevesData = (ed || []).map(e => {
      const vals = (vd || []).filter(v => v.eleve_id === e.id);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
      const derniere = vals[0]?.date_validation || null;
      const vuAujourdhui = vAujourdhui.some(v => v.eleve_id === e.id);
      return { ...e, etat, derniere, jours: joursDepuis(derniere), inactif: isInactif(derniere), vuAujourdhui };
    });

    setEleves(elevesData);
    setValidationsAujourdhui(vAujourdhui);
    setAllValidations(vd || []);
    setLoading(false);
  };

  const elevesVusAujourdhui = eleves.filter(e => e.vuAujourdhui);
  const elevesNonVus = eleves.filter(e => !e.vuAujourdhui).sort((a,b) => (b.jours||0) - (a.jours||0));
  const tomonAujourdhui = validationsAujourdhui.filter(v => v.type_validation === 'tomon').reduce((s,v) => s + v.nombre_tomon, 0);
  const hizbAujourdhui = validationsAujourdhui.filter(v => v.type_validation === 'hizb_complet').length;

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>← Retour</button>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Ma séance du jour</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: '1.5rem' }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {/* KPI séance */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginBottom: '1.5rem' }}>
            {[
              { val: elevesVusAujourdhui.length, lbl: 'Élèves vus', color: '#1D9E75', bg: '#E1F5EE' },
              { val: tomonAujourdhui, lbl: 'Tomon validés', color: '#378ADD', bg: '#E6F1FB' },
              { val: hizbAujourdhui, lbl: 'Hizb complets', color: '#EF9F27', bg: '#FAEEDA' },
            ].map((k,i) => (
              <div key={i} style={{ background: k.bg, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 11, color: k.color, opacity: 0.8, marginTop: 2 }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Validations d'aujourd'hui */}
          {validationsAujourdhui.length > 0 && (
            <>
              <div className="section-label">Récitations validées aujourd'hui</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
                {validationsAujourdhui.map(v => {
                  const eleve = eleves.find(e => e.id === v.eleve_id);
                  if (!eleve) return null;
                  const sl = scoreLabel(eleve.etat.points.total);
                  return (
                    <div key={v.id} onClick={() => navigate('fiche', eleve)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 12, cursor: 'pointer' }}>
                      <Avatar prenom={eleve.prenom} nom={eleve.nom} size={38} bg={sl.bg} color={sl.color} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{eleve.prenom} {eleve.nom}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          {v.type_validation === 'hizb_complet'
                            ? `Hizb ${v.hizb_valide} complet validé`
                            : `${v.nombre_tomon} Tomon${v.tomon_debut ? ` (T.${v.tomon_debut} → T.${v.tomon_debut + v.nombre_tomon - 1})` : ''} — Hizb ${v.hizb_validation || eleve.etat.hizbEnCours}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#bbb' }}>
                          {new Date(v.date_validation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {v.valideur ? ` · Validé par ${v.valideur.prenom} ${v.valideur.nom}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {v.type_validation === 'hizb_complet'
                          ? <span className="badge badge-green">Hizb complet</span>
                          : <span className="badge badge-blue">{v.nombre_tomon} Tomon</span>}
                        <div style={{ fontSize: 11, color: '#1D9E75', fontWeight: 600, marginTop: 2 }}>
                          +{v.type_validation === 'hizb_complet' ? 100 : v.nombre_tomon * 10} pts
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Élèves non vus */}
          <div className="section-label">Élèves à voir ({elevesNonVus.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {elevesNonVus.slice(0, 10).map(e => {
              const urgence = e.jours != null && e.jours > 14;
              return (
                <div key={e.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: urgence ? '#fff8f8' : '#fff', border: `0.5px solid ${urgence ? '#E24B4A30' : '#e0e0d8'}`, borderRadius: 10, cursor: 'pointer' }}
                  onClick={() => navigate('enregistrer', e)}>
                  <Avatar prenom={e.prenom} nom={e.nom} size={34} bg={urgence ? '#FCEBEB' : '#E1F5EE'} color={urgence ? '#A32D2D' : '#085041'} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: urgence ? '#A32D2D' : '#1a1a1a' }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      Hizb {e.etat.hizbEnCours} · T.{e.etat.prochainTomon || 1} prochain
                      {e.etat.enAttenteHizbComplet && ' · Hizb complet en attente'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    {e.jours != null ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: urgence ? '#A32D2D' : '#888' }}>{e.jours}j</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#bbb' }}>Jamais</span>
                    )}
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <div key={n} style={{ width: 5, height: 5, borderRadius: 1, background: n <= e.etat.tomonDansHizbActuel ? '#1D9E75' : '#e8e8e0' }} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bouton valider */}
          <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('enregistrer')}>
            + Enregistrer une récitation
          </button>
        </>
      )}
    </div>
  );
}
