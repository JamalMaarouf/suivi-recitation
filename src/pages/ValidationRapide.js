import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales, scoreLabel, motivationMsg, verifierEtCreerCertificats, isSourateNiveauDyn } from '../lib/helpers';
import { t } from '../lib/i18n';

export default function ValidationRapide({ user, navigate, goBack, lang='fr', isMobile }) {
  const [eleves, setEleves] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [etat, setEtat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const [nbTomon, setNbTomon] = useState(1); // nombre de tomons à valider
  const searchRef = useRef();

  useEffect(() => { loadData(); setTimeout(() => searchRef.current?.focus(), 200); }, []);

  const loadData = async () => {
    const [{ data: ed }, { data: vd }, { data: niv }, { data: sour }] = await Promise.all([
      supabase.from('eleves').select('*').eq('ecole_id', user.ecole_id).order('nom'),
      supabase.from('validations').select('*').eq('ecole_id', user.ecole_id),
      supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id', user.ecole_id),
      supabase.from('sourates').select('id,numero,nom_ar,nb_versets').order('numero', { ascending: false }),
    ]);
    setEleves(ed || []); setAllValidations(vd || []);
    setNiveaux(niv || []); setSouratesDB(sour || []);
    setLoading(false);
  };

  const filteredEleves = search.length > 0
    ? eleves.filter(e => `${e.prenom} ${e.nom} ${e.eleve_id_ecole || ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  const selectEleve = (e) => {
    const vals = allValidations.filter(v => v.eleve_id === e.id);
    setSelectedEleve(e);
    setEtat(calcEtatEleve(vals, e.hizb_depart, e.tomon_depart));
    setSearch('');
    setNbTomon(1);
  };

  const estSourate = selectedEleve ? isSourateNiveauDyn(selectedEleve.code_niveau, niveaux) : false;

  // Valider N tomons
  const validerTomon = async () => {
    if (!selectedEleve || !etat || saving || etat.enAttenteHizbComplet) return;
    setSaving(true);
    const { error } = await supabase.from('validations').insert({
      eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
      nombre_tomon: nbTomon, type_validation: 'tomon',
      date_validation: new Date().toISOString(),
      tomon_debut: etat.prochainTomon, hizb_validation: etat.hizbEnCours
    });
    if (!error) {
      const pts = nbTomon * 10;
      setFlash({ msg: `✓ ${nbTomon} ثمن · الحزب ${etat.hizbEnCours}`, color: '#1D9E75', pts });
      setTimeout(() => setFlash(null), 2500);
      setSessionLog(prev => [{
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        detail: `${nbTomon} ثمن · الحزب ${etat.hizbEnCours}`, pts,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }, ...prev.slice(0, 9)]);
      const { data: newVals } = await supabase.from('validations').select('*')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', selectedEleve.id);
      setEtat(calcEtatEleve(newVals || [], selectedEleve.hizb_depart, selectedEleve.tomon_depart));
      setNbTomon(1);
    }
    setSaving(false);
  };

  // Valider hizb complet
  const validerHizb = async () => {
    if (!selectedEleve || !etat || saving || !etat.enAttenteHizbComplet) return;
    setSaving(true);
    const { error } = await supabase.from('validations').insert({
      eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
      nombre_tomon: 0, type_validation: 'hizb_complet',
      date_validation: new Date().toISOString(), hizb_valide: etat.hizbEnCours
    });
    if (!error) {
      setFlash({ msg: `🎉 الحزب ${etat.hizbEnCours} مكتمل !`, color: '#EF9F27', pts: 100 });
      setTimeout(() => setFlash(null), 2500);
      setSessionLog(prev => [{
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        detail: `الحزب ${etat.hizbEnCours} مكتمل`, pts: 100,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }, ...prev.slice(0, 9)]);
      const { data: newVals } = await supabase.from('validations').select('*')
        .eq('ecole_id', user.ecole_id).eq('eleve_id', selectedEleve.id);
      setEtat(calcEtatEleve(newVals || [], selectedEleve.hizb_depart, selectedEleve.tomon_depart));
      const nouveauxCerts = await verifierEtCreerCertificats(supabase, {
        eleve: selectedEleve, ecole_id: user.ecole_id, valide_par: user.id,
        validations: newVals || [], recitations: [],
      });
      if (nouveauxCerts.length > 0) {
        setTimeout(() => setFlash({ msg: `🏅 ${nouveauxCerts.map(c => c.nom_certificat).join(', ')} !`, color: '#EF9F27', pts: 0 }), 2600);
        setTimeout(() => setFlash(null), 6000);
      }
    }
    setSaving(false);
  };

  // Valider une sourate complète
  const validerSourate = async (sourateId, sourateNom) => {
    if (!selectedEleve || saving) return;
    setSaving(true);
    const { error } = await supabase.from('recitations_sourates').insert({
      eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
      sourate_id: sourateId, type_recitation: 'complete',
      date_recitation: new Date().toISOString(),
    });
    if (!error) {
      setFlash({ msg: `✓ ${sourateNom}`, color: '#1D9E75', pts: 30 });
      setTimeout(() => setFlash(null), 2500);
      setSessionLog(prev => [{
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        detail: sourateNom, pts: 30,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }, ...prev.slice(0, 9)]);
    }
    setSaving(false);
  };

  const sl = selectedEleve && etat ? scoreLabel(etat.points.total) : null;
  const nc = selectedEleve ? ({ '5B': '#534AB7', '5A': '#378ADD', '2M': '#1D9E75', '2': '#EF9F27', '1': '#E24B4A' }[selectedEleve.code_niveau] || '#888') : '#888';

  // ── PC ───────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Flash */}
      {flash && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 999,
          background: flash.color, color: '#fff', padding: '12px 28px', borderRadius: 14,
          fontSize: 14, fontWeight: 700, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          textAlign: 'center', minWidth: 260 }}>
          {flash.msg}
          {flash.pts > 0 && <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>+{flash.pts} {t(lang, 'pts_abrev')}</div>}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="back-link" onClick={() => goBack ? goBack() : navigate('dashboard')} style={{ marginBottom: 0 }}>{t(lang, 'retour')}</button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#085041' }}>⚡ {lang === 'ar' ? 'تسجيل سريع' : 'Validation express'}</div>
            <div style={{ fontSize: 12, color: '#aaa' }}>{lang === 'ar' ? 'ابحث عن طالب وسجّل استظهاره بنقرتين' : 'Trouvez un élève et validez en 2 clics'}</div>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <input ref={searchRef} className="field-input"
          style={{ fontSize: 15, padding: '13px 16px 13px 44px' }}
          placeholder={`🔍 ${lang === 'ar' ? 'ابحث بالاسم أو رقم التعريف...' : 'Nom ou numéro élève...'}`}
          value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
        {filteredEleves.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
            border: '0.5px solid #e0e0d8', borderRadius: '0 0 14px 14px', zIndex: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {filteredEleves.map(e => {
              const vals = allValidations.filter(v => v.eleve_id === e.id);
              const et = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
              const isSour = isSourateNiveauDyn(e.code_niveau, niveaux);
              const nivColor = ({ '5B': '#534AB7', '5A': '#378ADD', '2M': '#1D9E75', '2': '#EF9F27', '1': '#E24B4A' }[e.code_niveau] || '#888');
              return (
                <div key={e.id} onClick={() => selectEleve(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    cursor: 'pointer', borderBottom: '0.5px solid #f0f0ec' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = '#f9f9f6'}
                  onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${nivColor}20`,
                    color: nivColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    {getInitiales(e.prenom, e.nom)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>
                      <span style={{ padding: '1px 6px', borderRadius: 6, background: `${nivColor}15`, color: nivColor, fontWeight: 700, marginLeft: 4 }}>{e.code_niveau}</span>
                      {isSour ? ` · ${lang === 'ar' ? 'سور' : 'Sourates'}` : ` · الحزب ${et.hizbEnCours} · T.${et.prochainTomon || '—'}`}
                    </div>
                  </div>
                  <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zone de validation */}
      {selectedEleve && etat && (
        <div style={{ background: '#fff', borderRadius: 18, border: `2px solid ${nc}30`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem' }}>

          {/* Header élève */}
          <div style={{ background: `linear-gradient(135deg,${nc}15,${nc}05)`, padding: '16px 20px',
            borderBottom: `1px solid ${nc}20`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg,${nc},${nc}80)`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 16, flexShrink: 0, boxShadow: `0 3px 10px ${nc}40` }}>
              {getInitiales(selectedEleve.prenom, selectedEleve.nom)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{selectedEleve.prenom} {selectedEleve.nom}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                <span style={{ padding: '1px 8px', borderRadius: 8, background: `${nc}15`, color: nc, fontWeight: 700, marginLeft: 6 }}>{selectedEleve.code_niveau}</span>
                {!estSourate && ` · الحزب ${etat.hizbEnCours} · ${etat.tomonDansHizbActuel}/8 ثمن`}
                {` · ${etat.points.total.toLocaleString()} ${t(lang, 'pts_abrev')}`}
              </div>
            </div>
            <button onClick={() => { setSelectedEleve(null); setEtat(null); setTimeout(() => searchRef.current?.focus(), 100); }}
              style={{ width: 30, height: 30, borderRadius: '50%', background: '#f5f5f0', border: 'none',
                fontSize: 14, cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {/* ── Élève HIZB ── */}
            {!estSourate && (
              <>
                {etat.enAttenteHizbComplet ? (
                  /* Validation hizb complet */
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: '#FAEEDA', borderRadius: 12, padding: '14px', marginBottom: 16,
                      fontSize: 14, color: '#633806', fontWeight: 600 }}>
                      🎉 {lang === 'ar' ? `الحزب ${etat.hizbEnCours} مكتمل — انتظار التصحيح` : `Hizb ${etat.hizbEnCours} complet — en attente de validation`}
                    </div>
                    <button onClick={validerHizb} disabled={saving}
                      style={{ width: '100%', padding: '16px', background: saving ? '#ccc' : 'linear-gradient(135deg,#EF9F27,#d4841a)',
                        color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 3px 12px rgba(239,159,39,0.4)', fontFamily: 'inherit' }}>
                      {saving ? '...' : `✓ ${lang === 'ar' ? `تصحيح الحزب ${etat.hizbEnCours}` : `Valider Hizb ${etat.hizbEnCours}`} (+100 ${t(lang, 'pts_abrev')})`}
                    </button>
                  </div>
                ) : (
                  /* Validation tomons */
                  <div>
                    {/* Barre progression hizb */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginBottom: 6 }}>
                        <span>{lang === 'ar' ? `الحزب ${etat.hizbEnCours}` : `Hizb ${etat.hizbEnCours}`}</span>
                        <span>{etat.tomonDansHizbActuel}/8 {lang === 'ar' ? 'ثمن' : 'tomon'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                          <div key={n} style={{ flex: 1, height: 8, borderRadius: 3,
                            background: n <= etat.tomonDansHizbActuel ? nc : '#e8e8e0' }} />
                        ))}
                      </div>
                    </div>

                    {/* Prochain tomon info */}
                    <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 13, color: '#666' }}>
                      {lang === 'ar' ? `الثمن التالي : T.${etat.prochainTomon} من الحزب ${etat.hizbEnCours}` : `Prochain : T.${etat.prochainTomon} — Hizb ${etat.hizbEnCours}`}
                    </div>

                    {/* Sélecteur nombre de tomons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                      background: '#f9f9f6', borderRadius: 12, padding: '12px 16px' }}>
                      <span style={{ fontSize: 13, color: '#666', flex: 1 }}>
                        {lang === 'ar' ? 'عدد الأثمان المستظهرة:' : 'Nombre de tomons :'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => setNbTomon(Math.max(1, nbTomon - 1))}
                          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${nc}40`,
                            background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: nc }}>−</button>
                        <span style={{ fontSize: 22, fontWeight: 900, color: nc, minWidth: 32, textAlign: 'center' }}>{nbTomon}</span>
                        <button onClick={() => setNbTomon(Math.min(etat.tomonRestants, nbTomon + 1))}
                          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${nc}40`,
                            background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: nc }}>+</button>
                      </div>
                      <span style={{ fontSize: 12, color: '#aaa' }}>+{nbTomon * 10} {t(lang, 'pts_abrev')}</span>
                    </div>

                    {/* Bouton valider */}
                    <button onClick={validerTomon} disabled={saving}
                      style={{ width: '100%', padding: '15px', background: saving ? '#ccc' : `linear-gradient(135deg,${nc},${nc}cc)`,
                        color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800,
                        cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                        boxShadow: saving ? 'none' : `0 3px 12px ${nc}40`, transition: 'all 0.15s' }}>
                      {saving ? '...' : `✓ ${lang === 'ar' ? `تسجيل ${nbTomon} ثمن` : `Valider ${nbTomon} tomon${nbTomon > 1 ? 's' : ''}`}`}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Élève SOURATES ── */}
            {estSourate && (
              <div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 12, textAlign: 'center' }}>
                  {lang === 'ar' ? 'اختر السورة المستظهرة:' : 'Choisissez la sourate récitée :'}
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {souratesDB.slice(0, 30).map(s => (
                    <button key={s.id} onClick={() => validerSourate(s.id, s.nom_ar)} disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        background: '#f9f9f6', border: `1px solid ${nc}20`, borderRadius: 10,
                        cursor: 'pointer', textAlign: 'right', fontFamily: "'Tajawal',Arial,sans-serif" }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = `${nc}12`; ev.currentTarget.style.border = `1px solid ${nc}40`; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = '#f9f9f6'; ev.currentTarget.style.border = `1px solid ${nc}20`; }}>
                      <span style={{ fontSize: 11, color: '#aaa', minWidth: 24 }}>{s.numero}</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1a1a1a', direction: 'rtl' }}>{s.nom_ar}</span>
                      <span style={{ fontSize: 11, color: nc, fontWeight: 600 }}>+30 {t(lang, 'pts_abrev')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* État vide */}
      {!selectedEleve && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#bbb' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#888', marginBottom: 6 }}>
            {lang === 'ar' ? 'تسجيل سريع' : 'Validation express'}
          </div>
          <div style={{ fontSize: 13 }}>
            {lang === 'ar' ? 'ابحث عن طالب وسجّل استظهاره بنقرتين' : 'Recherchez un élève et validez en 2 clics'}
          </div>
        </div>
      )}

      {/* Journal de session */}
      {sessionLog.length > 0 && (
        <>
          <div className="section-label">{lang === 'ar' ? 'سجل الجلسة' : 'Journal de session'} ({sessionLog.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessionLog.map((log, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#bbb', minWidth: 40 }}>{log.time}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{log.eleve}</span>
                  <span style={{ fontSize: 12, color: '#888' }}> — {log.detail}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75' }}>+{log.pts} {t(lang, 'pts_abrev')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
