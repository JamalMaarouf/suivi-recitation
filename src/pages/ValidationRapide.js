import React, { useState, useEffect, useRef } from 'react';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, motivationMsg } from '../lib/helpers';

function Avatar({ prenom, nom, size = 40, bg = '#E1F5EE', color = '#085041' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function ValidationRapide({  user, navigate , lang="fr" }) {
  const [eleves, setEleves] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [etat, setEtat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const searchRef = useRef();

  useEffect(() => {
    loadData();
    setTimeout(() => searchRef.current?.focus(), 200);
  }, []);

  const loadData = async () => {
    const [{ data: ed }, { data: vd }] = await Promise.all([
      supabase.from('eleves').select('*').order('nom'),
      supabase.from('validations').select('*')
    ]);
    setEleves(ed || []);
    setAllValidations(vd || []);
    setLoading(false);
  };

  const filteredEleves = search.length > 0
    ? eleves.filter(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : [];

  const selectEleve = (e) => {
    const vals = allValidations.filter(v => v.eleve_id === e.id);
    const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
    setSelectedEleve(e);
    setEtat(etat);
    setSearch('');
  };

  const validerTomon = async (n) => {
    if (!selectedEleve || !etat || saving) return;
    if (etat.enAttenteHizbComplet) return;
    const prochain = etat.prochainTomon;
    if (!prochain) return;

    setSaving(true);
    const { error } = await supabase.from('validations').insert({
      eleve_id: selectedEleve.id,
      valide_par: user.id,
      nombre_tomon: n,
      type_validation: 'tomon',
      date_validation: new Date().toISOString(),
      tomon_debut: prochain,
      hizb_validation: etat.hizbEnCours
    });

    if (!error) {
      const msg = motivationMsg(n, etat, false);
      setFlash({ msg: msg.msg, color: msg.color, pts: n * 10 });
      setTimeout(() => setFlash(null), 2500);

      // Log session
      setSessionLog(prev => [{
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        detail: `${n} Tomon · Hizb ${etat.hizbEnCours}`,
        pts: n * 10,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }, ...prev.slice(0, 9)]);

      // Refresh etat
      const { data: newVals } = await supabase.from('validations').select('*').eq('eleve_id', selectedEleve.id);
      const newEtat = calcEtatEleve(newVals || [], selectedEleve.hizb_depart, selectedEleve.tomon_depart);
      setEtat(newEtat);
      setAllValidations(prev => [...prev, ...(newVals || []).filter(v => !prev.find(p => p.id === v.id))]);
    }
    setSaving(false);
  };

  const validerHizb = async () => {
    if (!selectedEleve || !etat || saving || !etat.enAttenteHizbComplet) return;
    setSaving(true);
    const { error } = await supabase.from('validations').insert({
      eleve_id: selectedEleve.id,
      valide_par: user.id,
      nombre_tomon: 0,
      type_validation: 'hizb_complet',
      date_validation: new Date().toISOString(),
      hizb_valide: etat.hizbEnCours
    });
    if (!error) {
      setFlash({ msg: `🎉 Hizb ${etat.hizbEnCours} complet validé !`, color: '#EF9F27', pts: 100 });
      setTimeout(() => setFlash(null), 2500);
      setSessionLog(prev => [{ eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`, detail: `Hizb ${etat.hizbEnCours} complet`, pts: 100, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }, ...prev.slice(0, 9)]);
      const { data: newVals } = await supabase.from('validations').select('*').eq('eleve_id', selectedEleve.id);
      setEtat(calcEtatEleve(newVals || [], selectedEleve.hizb_depart, selectedEleve.tomon_depart));
    }
    setSaving(false);
  };

  const sl = selectedEleve && etat ? scoreLabel(etat.points.total) : null;

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>{t(lang,'retour')}</button>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>⚡ Validation Express</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: '1.5rem' }}>Recherchez un élève et validez en 2 clics</div>

      {/* Flash message */}
      {flash && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: flash.color, color: '#fff', padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', textAlign: 'center', minWidth: 280 }}>
          {flash.msg}
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>+{flash.pts} pts</div>
        </div>
      )}

      {/* Recherche */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <input ref={searchRef} className="field-input" style={{ fontSize: 16, padding: '12px 16px' }}
          placeholder={t(lang,'rechercher_eleve')} value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
        {filteredEleves.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: '0 0 12px 12px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            {filteredEleves.map(e => {
              const vals = allValidations.filter(v => v.eleve_id === e.id);
              const et = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
              const s = scoreLabel(et.points.total);
              return (
                <div key={e.id} onClick={() => selectEleve(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderBottom: '0.5px solid #f0f0ec' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = '#f9f9f6'}
                  onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}>
                  <Avatar prenom={e.prenom} nom={e.nom} size={36} bg={s.bg} color={s.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>Hizb {et.hizbEnCours} · T.{et.prochainTomon || '—'} prochain · {et.points.total} pts</div>
                  </div>
                  {et.enAttenteHizbComplet && <span className="badge badge-amber" style={{ fontSize: 10 }}>Hizb ⏳</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Élève sélectionné + validation rapide */}
      {selectedEleve && etat && (
        <div style={{ background: '#fff', border: `2px solid ${sl?.color || '#e0e0d8'}`, borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem' }}>
            <Avatar prenom={selectedEleve.prenom} nom={selectedEleve.nom} size={48} bg={sl?.bg} color={sl?.color} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedEleve.prenom} {selectedEleve.nom}</div>
              <div style={{ fontSize: 13, color: '#888' }}>
                Hizb {etat.hizbEnCours} · {etat.tomonDansHizbActuel}/8 Tomon · {etat.points.total.toLocaleString()} pts
              </div>
            </div>
            <button onClick={() => { setSelectedEleve(null); setEtat(null); setTimeout(() => searchRef.current?.focus(), 100); }}
              style={{ padding: '4px 10px', border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#f9f9f6', fontSize: 11, cursor: 'pointer' }}>Changer</button>
          </div>

          {/* Barre Tomon */}
          <div style={{ display: 'flex', gap: 3, marginBottom: '1.25rem' }}>
            {[1,2,3,4,5,6,7,8].map(n => (
              <div key={n} style={{ flex: 1, height: 8, borderRadius: 3, background: n <= etat.tomonDansHizbActuel ? (etat.enAttenteHizbComplet ? '#EF9F27' : '#1D9E75') : '#e8e8e0' }} />
            ))}
          </div>

          {etat.enAttenteHizbComplet ? (
            <div>
              <div style={{ padding: '10px 14px', background: '#FAEEDA', borderRadius: 10, fontSize: 13, color: '#633806', marginBottom: 12 }}>
                ⏳ Les 8 Tomon du Hizb {etat.hizbEnCours} sont validés — valider le Hizb complet pour continuer.
              </div>
              <button onClick={validerHizb} disabled={saving}
                style={{ width: '100%', padding: '16px', background: '#EF9F27', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? '...' : `✓ Valider Hizb ${etat.hizbEnCours} complet (+100 pts)`}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 10, textAlign: 'center' }}>
                Prochain : T.{etat.prochainTomon} — Combien de Tomon récités ?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${etat.tomonRestants}, 1fr)`, gap: 8 }}>
                {Array.from({ length: etat.tomonRestants }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => validerTomon(n)} disabled={saving}
                    style={{ padding: '20px 8px', background: n === 1 ? '#1D9E75' : '#f0faf6', border: `2px solid ${n === 1 ? '#1D9E75' : '#9FE1CB'}`, borderRadius: 12, fontSize: 22, fontWeight: 800, cursor: 'pointer', color: n === 1 ? '#fff' : '#085041', transition: 'all 0.1s' }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = '#1D9E75'; ev.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={ev => { if (n !== 1) { ev.currentTarget.style.background = '#f0faf6'; ev.currentTarget.style.color = '#085041'; } }}>
                    {n}
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>+{n * 10} pts</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log de session */}
      {sessionLog.length > 0 && (
        <>
          <div className="section-label">Log de la session ({sessionLog.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessionLog.map((log, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#bbb', minWidth: 40 }}>{log.time}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{log.eleve}</span>
                  <span style={{ fontSize: 12, color: '#888' }}> — {log.detail}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75' }}>+{log.pts} pts</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!selectedEleve && !loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#bbb' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 14 }}>Recherchez un élève pour commencer</div>
        </div>
      )}
    </div>
  );
}
