import React, { useState, useEffect } from 'react';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, formatDate } from '../lib/helpers';

function Avatar({ prenom, nom, size = 28 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function Calendrier({  user, navigate , lang="fr" }) {
  const [validations, setValidations] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mois, setMois] = useState(new Date().getMonth());
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: vd } = await supabase.from('validations').select('*, valideur:valide_par(prenom,nom)').order('date_validation', { ascending: false });
    const { data: ed } = await supabase.from('eleves').select('*');
    setValidations(vd || []);
    setEleves(ed || []);
    setLoading(false);
  };

  const joursNoms = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const moisNoms = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const premierJour = new Date(annee, mois, 1);
  const dernierJour = new Date(annee, mois + 1, 0);
  const debutCal = new Date(premierJour);
  const jourSemaine = (premierJour.getDay() + 6) % 7;
  debutCal.setDate(debutCal.getDate() - jourSemaine);

  const jours = [];
  const cur = new Date(debutCal);
  while (cur <= dernierJour || jours.length % 7 !== 0) {
    jours.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
    if (jours.length > 42) break;
  }

  // Map date -> validations
  const valParJour = {};
  validations.forEach(v => {
    const key = new Date(v.date_validation).toDateString();
    if (!valParJour[key]) valParJour[key] = [];
    valParJour[key].push(v);
  });

  const valsJourSelectionne = selectedDay ? (valParJour[selectedDay.toDateString()] || []) : [];
  const today = new Date().toDateString();

  const prevMois = () => { if (mois === 0) { setMois(11); setAnnee(a => a-1); } else setMois(m => m-1); setSelectedDay(null); };
  const nextMois = () => { if (mois === 11) { setMois(0); setAnnee(a => a+1); } else setMois(m => m+1); setSelectedDay(null); };

  // Stats du mois
  const vMois = validations.filter(v => {
    const d = new Date(v.date_validation);
    return d.getMonth() === mois && d.getFullYear() === annee;
  });
  const tomonMois = vMois.filter(v => v.type_validation === 'tomon').reduce((s,v) => s + v.nombre_tomon, 0);
  const hizbMois = vMois.filter(v => v.type_validation === 'hizb_complet').length;
  const joursActifsMois = new Set(vMois.map(v => new Date(v.date_validation).toDateString())).size;

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>{t(lang,'retour')}</button>

      {/* Stats mois */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginBottom: '1.25rem' }}>
        {[
          { val: tomonMois, lbl: 'Tomon ce mois', color: '#1D9E75', bg: '#E1F5EE' },
          { val: hizbMois, lbl: t(lang,'hizb_complets_label'), color: '#378ADD', bg: '#E6F1FB' },
          { val: joursActifsMois, lbl: t(lang,'jours_actifs'), color: '#EF9F27', bg: '#FAEEDA' },
        ].map((k,i) => (
          <div key={i} style={{ background: k.bg, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: k.color, opacity: 0.8 }}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Navigation mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={prevMois} style={{ padding: '6px 14px', border: '0.5px solid #e0e0d8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{moisNoms[mois]} {annee}</div>
        <button onClick={nextMois} style={{ padding: '6px 14px', border: '0.5px solid #e0e0d8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>›</button>
      </div>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {/* En-têtes jours */}
          <div className="cal-grid" style={{ marginBottom: 6 }}>
            {joursNoms.map(j => (
              <div key={j} style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: '#888', padding: '4px 0' }}>{j}</div>
            ))}
          </div>

          {/* Grille calendrier */}
          <div className="cal-grid" style={{ marginBottom: '1.5rem' }}>
            {jours.map((jour, idx) => {
              const key = jour.toDateString();
              const vals = valParJour[key] || [];
              const estMoisActuel = jour.getMonth() === mois;
              const estAujourdhui = key === today;
              const estSelectionne = selectedDay && key === selectedDay.toDateString();
              const nbTomon = vals.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+v.nombre_tomon,0);
              const nbHizb = vals.filter(v=>v.type_validation==='hizb_complet').length;

              return (
                <div key={idx} onClick={() => vals.length > 0 && setSelectedDay(jour)}
                  style={{
                    aspectRatio: '1', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: vals.length > 0 ? 'pointer' : 'default',
                    border: estSelectionne ? '2px solid #1D9E75' : estAujourdhui ? '2px solid #9FE1CB' : '0.5px solid #e0e0d8',
                    background: estSelectionne ? '#E1F5EE' : vals.length > 0 ? '#f0faf6' : '#fff',
                    opacity: estMoisActuel ? 1 : 0.3,
                    transition: 'all 0.15s', padding: 4
                  }}>
                  <div style={{ fontSize: 13, fontWeight: estAujourdhui ? 700 : 400, color: estAujourdhui ? '#1D9E75' : '#1a1a1a' }}>{jour.getDate()}</div>
                  {vals.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {nbTomon > 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} title={`${nbTomon} Tomon`} />}
                      {nbHizb > 0 && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF9F27' }} title={`${nbHizb} Hizb complet`} />}
                    </div>
                  )}
                  {vals.length > 1 && <div style={{ fontSize: 9, color: '#1D9E75', fontWeight: 600 }}>{vals.length}</div>}
                </div>
              );
            })}
          </div>

          {/* Légende */}
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#888', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75' }} />Tomon</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF9F27' }} />Hizb complet</div>
          </div>

          {/* Détail jour sélectionné */}
          {selectedDay && valsJourSelectionne.length > 0 && (
            <>
              <div className="section-label">
                {selectedDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — {valsJourSelectionne.length} récitation{valsJourSelectionne.length > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {valsJourSelectionne.map(v => {
                  const eleve = eleves.find(e => e.id === v.eleve_id);
                  return (
                    <div key={v.id} onClick={() => eleve && navigate('fiche', eleve)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 12, cursor: eleve ? 'pointer' : 'default' }}>
                      {eleve ? <Avatar prenom={eleve.prenom} nom={eleve.nom} size={36} /> : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f0ec' }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{eleve ? `${eleve.prenom} ${eleve.nom}` : '—'}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>
                          {v.type_validation === 'hizb_complet'
                            ? `Hizb ${v.hizb_valide} complet`
                            : `${v.nombre_tomon} Tomon${v.tomon_debut ? ` (T.${v.tomon_debut}→T.${v.tomon_debut + v.nombre_tomon - 1})` : ''}`}
                          {v.hizb_validation ? ` · Hizb ${v.hizb_validation}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#bbb' }}>
                          {new Date(v.date_validation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {v.valideur ? ` · ${v.valideur.prenom} ${v.valideur.nom}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {v.type_validation === 'hizb_complet'
                          ? <span className="badge badge-green" style={{ fontSize: 10 }}>Hizb cplt</span>
                          : <span className="badge badge-blue" style={{ fontSize: 10 }}>{v.nombre_tomon}T</span>}
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', marginTop: 2 }}>
                          +{v.type_validation === 'hizb_complet' ? 100 : v.nombre_tomon * 10} pts
                        </div>
                      </div>
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
