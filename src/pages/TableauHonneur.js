import React, { useState, useEffect } from 'react';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, formatDate } from '../lib/helpers';

function Avatar({ prenom, nom, size = 44, bg = '#E1F5EE', color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0, border: `2px solid ${color}30` }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function TableauHonneur({  navigate , lang="fr" }) {
  const [eleves, setEleves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    loadData();
    setTimeout(() => setAnimated(true), 100);
  }, []);

  const loadData = async () => {
    const { data: ed } = await supabase.from('eleves').select('*');
    const { data: vd } = await supabase.from('validations').select('*');
    const elevesData = (ed || []).map(e => {
      const vals = (vd || []).filter(v => v.eleve_id === e.id);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
      return { ...e, etat };
    }).sort((a, b) => b.etat.points.total - a.etat.points.total);
    setEleves(elevesData);
    setLoading(false);
  };

  const top3 = eleves.slice(0, 3);
  const reste = eleves.slice(3);
  const podColors = ['#EF9F27', '#B0B0B0', '#CD7F32'];
  const podBgs = ['#FAEEDA', '#f5f5f0', '#f9f3ec'];
  const podHeights = [200, 160, 130];
  const podOrder = [1, 0, 2]; // Silver left, Gold center, Bronze right

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0a0a 0%, #1a1a1a 50%, #0d2b1f 100%)', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <button onClick={() => navigate('dashboard')} style={{ background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginBottom: '1.5rem' }}>{t(lang,'retour')}</button>
        <div style={{ fontSize: 11, color: '#1D9E75', textTransform: 'uppercase', letterSpacing: '4px', marginBottom: 8 }}>Tableau d'honneur</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#fff', letterSpacing: '-1px' }}>Les Gardiens du Coran</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Classement par score de récitation</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '3rem' }}>Chargement...</div>
      ) : (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: '3rem', maxWidth: 600, margin: '0 auto 3rem' }}>
              {podOrder.map(rank => {
                const e = top3[rank];
                if (!e) return null;
                const sl = scoreLabel(e.etat.points.total);
                return (
                  <div key={e.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: animated ? 1 : 0, transform: animated ? 'translateY(0)' : 'translateY(40px)', transition: `all 0.6s ease ${rank * 0.15}s` }}>
                    {rank === 0 && <div style={{ fontSize: 28, marginBottom: 4 }}>👑</div>}
                    <Avatar prenom={e.prenom} nom={e.nom} size={rank === 0 ? 64 : 52} bg={podBgs[rank]} color={podColors[rank]} />
                    <div style={{ fontSize: rank === 0 ? 14 : 12, fontWeight: 600, color: '#fff', marginTop: 8, textAlign: 'center' }}>{e.prenom}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{e.nom}</div>
                    <div style={{ fontSize: rank === 0 ? 20 : 16, fontWeight: 700, color: podColors[rank], margin: '6px 0' }}>{e.etat.points.total.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>pts</div>
                    <div style={{ width: '100%', height: podHeights[rank], background: `linear-gradient(to top, ${podColors[rank]}40, ${podColors[rank]}15)`, border: `1px solid ${podColors[rank]}40`, borderRadius: '8px 8px 0 0', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: rank === 0 ? 48 : 36, fontWeight: 800, color: podColors[rank], opacity: 0.8 }}>{rank + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reste du classement */}
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {reste.map((e, idx) => {
              const sl = scoreLabel(e.etat.points.total);
              const rang = idx + 4;
              return (
                <div key={e.id} onClick={() => navigate('fiche', e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', marginBottom: 8, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, cursor: 'pointer', opacity: animated ? 1 : 0, transform: animated ? 'translateX(0)' : 'translateX(-30px)', transition: `all 0.5s ease ${idx * 0.05 + 0.4}s` }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(29,158,117,0.1)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.3)', minWidth: 28, textAlign: 'center' }}>{rang}</div>
                  <Avatar prenom={e.prenom} nom={e.nom} size={38} bg={sl.bg + '30'} color={sl.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Hizb {e.etat.hizbEnCours} · {e.etat.tomonCumul} Tomon · {e.etat.hizbsComplets.size} Hizb complets</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: sl.color }}>{e.etat.points.total.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
