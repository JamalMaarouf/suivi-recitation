import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { getSouratesForNiveau } from '../lib/sourates';

const NIVEAUX = [
  { code: '5B', label: 'Préscolaire (5B)', labelAr: 'تمهيدي (5B)', type: 'sourate' },
  { code: '5A', label: 'Primaire 1-2 (5A)', labelAr: 'ابتدائي 1-2 (5A)', type: 'sourate' },
  { code: '2M', label: 'Primaire 3-4 (2M)', labelAr: 'ابتدائي 3-4 (2M)', type: 'sourate' },
  { code: '2',  label: 'Primaire 5-6 (2)',  labelAr: 'ابتدائي 5-6 (2)',  type: 'hizb' },
  { code: '1',  label: 'Collège/Lycée (1)', labelAr: 'إعدادي/ثانوي (1)', type: 'hizb' },
];

const NIVEAU_COLORS = {
  '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'
};

export default function ValidationCollective({ user, navigate, goBack, lang = 'fr' }) {
  const [step, setStep] = useState(1); // 1=choix niveau, 2=choix contenu, 3=choix élèves, 4=confirmation
  const [selectedNiveau, setSelectedNiveau] = useState(null);
  const [typeRecitation, setTypeRecitation] = useState(''); // sequence|complete|tomon|hizb_complet
  const [selectedSourate, setSelectedSourate] = useState(null);
  const [selectedHizb, setSelectedHizb] = useState(1);
  const [selectedTomon, setSelectedTomon] = useState(1);
  const [nombreTomon, setNombreTomon] = useState(1);
  const [versetDebut, setVersetDebut] = useState('');
  const [versetFin, setVersetFin] = useState('');
  const [eleves, setEleves] = useState([]);
  const [selectedEleves, setSelectedEleves] = useState({});
  const [souratesDB, setSouratesDB] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(false);
  const [resultats, setResultats] = useState([]);

  const niveauInfo = NIVEAUX.find(n => n.code === selectedNiveau);
  const isSourate = niveauInfo?.type === 'sourate';
  const color = NIVEAU_COLORS[selectedNiveau] || '#085041';
  const sourates = selectedNiveau ? getSouratesForNiveau(selectedNiveau) : [];

  useEffect(() => {
    // Load sourates DB ids
    supabase.from('sourates').select('id,numero').then(({ data }) => {
      if (data) setSouratesDB(data);
    });
  }, []);

  useEffect(() => {
    if (selectedNiveau) loadEleves();
  }, [selectedNiveau]);

  const loadEleves = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('eleves')
      .select('id,prenom,nom,eleve_id_ecole,code_niveau')
      .eq('code_niveau', selectedNiveau)
      .order('nom');
    const list = data || [];
    setEleves(list);
    // All selected by default
    const sel = {};
    list.forEach(e => { sel[e.id] = true; });
    setSelectedEleves(sel);
    setLoading(false);
  };

  const toggleEleve = (id) => {
    setSelectedEleves(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = (val) => {
    const sel = {};
    eleves.forEach(e => { sel[e.id] = val; });
    setSelectedEleves(sel);
  };

  const nbSelected = Object.values(selectedEleves).filter(Boolean).length;

  const getDbSourateId = (numero) => {
    const s = souratesDB.find(x => x.numero === numero);
    return s?.id || null;
  };

  const canProceedStep2 = () => {
    if (!typeRecitation) return false;
    if (isSourate) {
      if (!selectedSourate) return false;
      if (typeRecitation === 'sequence') {
        return versetDebut && versetFin && parseInt(versetFin) >= parseInt(versetDebut);
      }
      return true;
    } else {
      // hizb
      if (typeRecitation === 'tomon') return nombreTomon >= 1 && nombreTomon <= 8;
      if (typeRecitation === 'hizb_complet') return selectedHizb >= 1 && selectedHizb <= 60;
      return false;
    }
  };

  const handleValider = async () => {
    setSaving(true);
    setMsg(null);
    const now = new Date().toISOString();
    const elevesCibles = eleves.filter(e => selectedEleves[e.id]);

    try {
      const inserts_rec = [];    // recitations_sourates
      const inserts_val = [];    // validations (tomon/hizb)

      for (const e of elevesCibles) {
        if (isSourate) {
          const sourateId = getDbSourateId(selectedSourate.numero);
          inserts_rec.push({
            eleve_id: e.id,
            sourate_id: sourateId,
            type_recitation: typeRecitation,
            verset_debut: typeRecitation === 'sequence' ? parseInt(versetDebut) : null,
            verset_fin: typeRecitation === 'sequence' ? parseInt(versetFin) : null,
            valide_par: user.id,
            date_validation: now,
            points: typeRecitation === 'complete' ? 20 : 5, // muraja'a pts (moins que mémorisation)
            is_muraja: true,
          });
        } else {
          // hizb/tomon
          inserts_val.push({
            eleve_id: e.id,
            valide_par: user.id,
            nombre_tomon: typeRecitation === 'tomon' ? parseInt(nombreTomon) : 0,
            type_validation: typeRecitation === 'tomon' ? 'tomon_muraja' : 'hizb_muraja',
            date_validation: now,
            tomon_debut: typeRecitation === 'tomon' ? parseInt(selectedTomon) : null,
            hizb_validation: typeRecitation === 'hizb_complet' ? parseInt(selectedHizb) : null,
            is_muraja: true,
          });
        }
      }

      let errors = [];
      if (inserts_rec.length > 0) {
        const { error } = await supabase.from('recitations_sourates').insert(inserts_rec);
        if (error) errors.push(error.message);
      }
      if (inserts_val.length > 0) {
        const { error } = await supabase.from('validations').insert(inserts_val);
        if (error) errors.push(error.message);
      }

      if (errors.length > 0) {
        setMsg({ type: 'error', text: errors.join(' | ') });
      } else {
        setResultats(elevesCibles);
        setDone(true);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
    setSaving(false);
  };

  const resetForm = () => {
    setStep(1);
    setSelectedNiveau(null);
    setTypeRecitation('');
    setSelectedSourate(null);
    setSelectedHizb(1);
    setSelectedTomon(1);
    setNombreTomon(1);
    setVersetDebut('');
    setVersetFin('');
    setDone(false);
    setResultats([]);
    setMsg(null);
  };

  // ── Rendu ──

  if (done) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ background: '#E1F5EE', borderRadius: 16, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#085041', marginBottom: 8 }}>
            {lang === 'ar' ? 'تم تسجيل المراجعة الجماعية' : 'Muraja\'a collective enregistrée !'}
          </div>
          <div style={{ fontSize: 14, color: '#1D9E75', marginBottom: 16 }}>
            {resultats.length} {lang === 'ar' ? 'طالب' : 'élève(s)'} · {
              isSourate
                ? (selectedSourate?.nom_ar || '')
                : (typeRecitation === 'tomon' ? `${nombreTomon} Tomon — Hizb ${selectedHizb}` : `Hizb ${selectedHizb} complet`)
            }
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {resultats.map(e => (
              <span key={e.id} style={{ padding: '4px 10px', background: '#fff', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#085041', border: '1px solid #9FE1CB' }}>
                {e.prenom} {e.nom}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button onClick={resetForm} style={{ padding: '10px 20px', background: '#085041', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>
              {lang === 'ar' ? '+ مراجعة جديدة' : '+ Nouvelle muraja\'a'}
            </button>
            <button onClick={() => goBack ? goBack() : navigate('dashboard')} className="back-link">
              {lang === 'ar' ? 'رجوع' : '← Retour'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.2rem' }}>
        <button className="back-link" onClick={() => goBack ? goBack() : navigate('dashboard')}>
          ← {t(lang, 'retour')}
        </button>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#085041' }}>
          📖 {lang === 'ar' ? 'مراجعة جماعية (مراجعة)' : 'Récitation collective (Muraja\'a)'}
        </div>
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
        {[
          { n: 1, label: lang === 'ar' ? 'المستوى' : 'Niveau' },
          { n: 2, label: lang === 'ar' ? 'المحتوى' : 'Contenu' },
          { n: 3, label: lang === 'ar' ? 'الطلاب' : 'Élèves' },
          { n: 4, label: lang === 'ar' ? 'تأكيد' : 'Confirmer' },
        ].map(s => (
          <div key={s.n} style={{ flex: 1, padding: '6px 4px', borderRadius: 8, textAlign: 'center', fontSize: 11, fontWeight: step >= s.n ? 700 : 400, background: step === s.n ? '#085041' : step > s.n ? '#E1F5EE' : '#f5f5f0', color: step === s.n ? '#fff' : step > s.n ? '#1D9E75' : '#aaa', cursor: step < s.n ? 'default' : 'pointer' }} onClick={() => step > s.n && setStep(s.n)}>
            {step > s.n ? '✓ ' : ''}{s.label}
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: msg.type === 'error' ? '#FCEBEB' : '#E1F5EE', color: msg.type === 'error' ? '#E24B4A' : '#085041', marginBottom: 12, fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      {/* ── STEP 1 : Choix du niveau ── */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#333' }}>
            {lang === 'ar' ? 'اختر المستوى الدراسي' : 'Choisissez le niveau'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {NIVEAUX.map(n => {
              const nc = NIVEAU_COLORS[n.code];
              return (
                <div key={n.code}
                  onClick={() => { setSelectedNiveau(n.code); setStep(2); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: `2px solid ${nc}20`, background: `${nc}08`, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${nc}15`}
                  onMouseLeave={e => e.currentTarget.style.background = `${nc}08`}
                >
                  <span style={{ padding: '4px 10px', borderRadius: 10, background: `${nc}20`, color: nc, fontWeight: 700, fontSize: 14 }}>{n.code}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{lang === 'ar' ? n.labelAr : n.label}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      {n.type === 'sourate'
                        ? (lang === 'ar' ? 'سور وتسلسلات' : 'Sourates & Séquences')
                        : (lang === 'ar' ? 'أثمان وأحزاب' : 'Tomon & Hizb')}
                    </div>
                  </div>
                  <span style={{ color: nc, fontSize: 18 }}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP 2 : Choix du contenu récité ── */}
      {step === 2 && niveauInfo && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ padding: '3px 10px', borderRadius: 10, background: `${color}20`, color, fontWeight: 700 }}>{selectedNiveau}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{lang === 'ar' ? 'ما الذي تمت مراجعته؟' : 'Qu\'est-ce qui a été récité ?'}</span>
          </div>

          {isSourate ? (
            <>
              {/* Type */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { val: 'sequence', label: lang === 'ar' ? 'تسلسل (أجزاء)' : 'Séquence (partielle)' },
                  { val: 'complete', label: lang === 'ar' ? 'سورة كاملة' : 'Sourate complète' },
                ].map(tp => (
                  <div key={tp.val} onClick={() => setTypeRecitation(tp.val)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', border: `2px solid ${typeRecitation === tp.val ? color : '#e0e0d8'}`, background: typeRecitation === tp.val ? `${color}12` : '#fff', fontWeight: typeRecitation === tp.val ? 700 : 400, color: typeRecitation === tp.val ? color : '#555', fontSize: 13 }}>
                    {tp.label}
                  </div>
                ))}
              </div>

              {/* Sourate selector */}
              <div className="field-group" style={{ marginBottom: 12 }}>
                <label className="field-lbl">{lang === 'ar' ? 'السورة المستظهَرة' : 'Sourate récitée'}</label>
                <select className="field-select" value={selectedSourate?.numero || ''} onChange={e => {
                  const s = sourates.find(x => x.numero === parseInt(e.target.value));
                  setSelectedSourate(s || null);
                }}>
                  <option value="">{lang === 'ar' ? '— اختر سورة —' : '— Choisir une sourate —'}</option>
                  {sourates.map(s => (
                    <option key={s.numero} value={s.numero}>{s.nom_ar}</option>
                  ))}
                </select>
              </div>

              {/* Verses for sequence */}
              {typeRecitation === 'sequence' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="field-group">
                    <label className="field-lbl">{lang === 'ar' ? 'من الآية' : 'Verset début'}</label>
                    <input className="field-input" type="number" min="1" value={versetDebut} onChange={e => setVersetDebut(e.target.value)} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang === 'ar' ? 'إلى الآية' : 'Verset fin'}</label>
                    <input className="field-input" type="number" min="1" value={versetFin} onChange={e => setVersetFin(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Type tomon/hizb */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { val: 'tomon', label: lang === 'ar' ? 'ثُمن (مراجعة)' : 'Tomon (révision)' },
                  { val: 'hizb_complet', label: lang === 'ar' ? 'حزب كامل' : 'Hizb complet' },
                ].map(tp => (
                  <div key={tp.val} onClick={() => setTypeRecitation(tp.val)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', border: `2px solid ${typeRecitation === tp.val ? color : '#e0e0d8'}`, background: typeRecitation === tp.val ? `${color}12` : '#fff', fontWeight: typeRecitation === tp.val ? 700 : 400, color: typeRecitation === tp.val ? color : '#555', fontSize: 13 }}>
                    {tp.label}
                  </div>
                ))}
              </div>

              {typeRecitation === 'tomon' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="field-group">
                    <label className="field-lbl">{lang === 'ar' ? 'رقم الحزب' : 'Numéro Hizb'}</label>
                    <input className="field-input" type="number" min="1" max="60" value={selectedHizb} onChange={e => setSelectedHizb(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang === 'ar' ? 'رقم الثُّمن' : 'Numéro Tomon'}</label>
                    <select className="field-select" value={selectedTomon} onChange={e => setSelectedTomon(parseInt(e.target.value))}>
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <option key={n} value={n}>Tomon {n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang === 'ar' ? 'عدد الأثمان' : 'Nombre de Tomon'}</label>
                    <select className="field-select" value={nombreTomon} onChange={e => setNombreTomon(parseInt(e.target.value))}>
                      {[1,2,3,4].map(n => <option key={n} value={n}>{n} Tomon</option>)}
                    </select>
                  </div>
                </div>
              )}

              {typeRecitation === 'hizb_complet' && (
                <div className="field-group">
                  <label className="field-lbl">{lang === 'ar' ? 'رقم الحزب المستظهَر' : 'Numéro du Hizb récité'}</label>
                  <input className="field-input" type="number" min="1" max="60" value={selectedHizb} onChange={e => setSelectedHizb(parseInt(e.target.value) || 1)} />
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setStep(1)} className="back-link">← {lang === 'ar' ? 'رجوع' : 'Retour'}</button>
            <button onClick={() => setStep(3)} disabled={!canProceedStep2()}
              style={{ flex: 1, padding: '10px', background: canProceedStep2() ? '#085041' : '#ccc', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: canProceedStep2() ? 'pointer' : 'default' }}>
              {lang === 'ar' ? 'التالي: اختيار الطلاب ←' : 'Suivant : Choisir les élèves →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 : Choix des élèves ── */}
      {step === 3 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {lang === 'ar' ? 'طلاب المستوى' : 'Élèves du niveau'} <span style={{ padding: '2px 8px', borderRadius: 10, background: `${color}20`, color, fontWeight: 700 }}>{selectedNiveau}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => toggleAll(true)} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 8, border: '1px solid #085041', color: '#085041', background: '#fff', cursor: 'pointer' }}>
                {lang === 'ar' ? 'الكل' : 'Tous'}
              </button>
              <button onClick={() => toggleAll(false)} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 8, border: '1px solid #888', color: '#888', background: '#fff', cursor: 'pointer' }}>
                {lang === 'ar' ? 'لا أحد' : 'Aucun'}
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {eleves.map(e => (
                <div key={e.id} onClick={() => toggleEleve(e.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${selectedEleves[e.id] ? color : '#e0e0d8'}`, background: selectedEleves[e.id] ? `${color}08` : '#fafaf8', cursor: 'pointer' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${selectedEleves[e.id] ? color : '#ccc'}`, background: selectedEleves[e.id] ? color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selectedEleves[e.id] && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{e.prenom} {e.nom}</span>
                    {e.eleve_id_ecole && <span style={{ fontSize: 11, color: '#888', marginRight: 6 }}> #{e.eleve_id_ecole}</span>}
                  </div>
                </div>
              ))}
              {eleves.length === 0 && (
                <div style={{ textAlign: 'center', color: '#aaa', padding: '1rem' }}>
                  {lang === 'ar' ? 'لا يوجد طلاب في هذا المستوى' : 'Aucun élève dans ce niveau'}
                </div>
              )}
            </div>
          )}

          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f5f5f0', marginBottom: 14, fontSize: 13, color: '#555' }}>
            {nbSelected}/{eleves.length} {lang === 'ar' ? 'طالب مختار' : 'élève(s) sélectionné(s)'}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} className="back-link">← {lang === 'ar' ? 'رجوع' : 'Retour'}</button>
            <button onClick={() => setStep(4)} disabled={nbSelected === 0}
              style={{ flex: 1, padding: '10px', background: nbSelected > 0 ? '#085041' : '#ccc', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: nbSelected > 0 ? 'pointer' : 'default' }}>
              {lang === 'ar' ? 'التالي: مراجعة وتأكيد ←' : 'Suivant : Récapitulatif →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4 : Confirmation ── */}
      {step === 4 && (
        <div>
          <div style={{ background: `${color}08`, border: `1.5px solid ${color}30`, borderRadius: 14, padding: '1.2rem', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 12 }}>
              📋 {lang === 'ar' ? 'ملخص المراجعة الجماعية' : 'Récapitulatif de la muraja\'a'}
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{lang === 'ar' ? 'المستوى' : 'Niveau'}</span>
                <span style={{ fontWeight: 600 }}>{selectedNiveau} — {lang === 'ar' ? niveauInfo?.labelAr : niveauInfo?.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{lang === 'ar' ? 'النوع' : 'Type'}</span>
                <span style={{ fontWeight: 600 }}>
                  {isSourate
                    ? (typeRecitation === 'complete' ? (lang === 'ar' ? 'سورة كاملة' : 'Sourate complète') : (lang === 'ar' ? 'تسلسل' : 'Séquence'))
                    : (typeRecitation === 'hizb_complet' ? (lang === 'ar' ? 'حزب كامل' : 'Hizb complet') : (lang === 'ar' ? 'ثُمن' : 'Tomon'))}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{lang === 'ar' ? 'المحتوى' : 'Contenu'}</span>
                <span style={{ fontWeight: 600 }}>
                  {isSourate
                    ? (selectedSourate?.nom_ar + (typeRecitation === 'sequence' ? ` (${lang === 'ar' ? 'آية' : 'v.'} ${versetDebut}–${versetFin})` : ''))
                    : (typeRecitation === 'tomon' ? `Hizb ${selectedHizb} — Tomon ${selectedTomon} (×${nombreTomon})` : `Hizb ${selectedHizb}`)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{lang === 'ar' ? 'النوع' : 'Catégorie'}</span>
                <span style={{ padding: '2px 8px', borderRadius: 10, background: '#FFF3CD', color: '#856404', fontWeight: 600, fontSize: 12 }}>
                  📖 {lang === 'ar' ? 'مراجعة جماعية' : 'Muraja\'a collective'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{lang === 'ar' ? 'عدد الطلاب' : 'Élèves concernés'}</span>
                <span style={{ fontWeight: 700, color }}>{nbSelected} {lang === 'ar' ? 'طالب' : 'élève(s)'}</span>
              </div>
            </div>

            {/* Excluded students */}
            {eleves.filter(e => !selectedEleves[e.id]).length > 0 && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#FCEBEB', fontSize: 12 }}>
                <span style={{ color: '#E24B4A', fontWeight: 600 }}>⚠️ {lang === 'ar' ? 'مستثنون: ' : 'Exclus : '}</span>
                {eleves.filter(e => !selectedEleves[e.id]).map(e => e.prenom + ' ' + e.nom).join(', ')}
              </div>
            )}
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FFF3CD', fontSize: 12, color: '#856404', marginBottom: 16 }}>
            ℹ️ {lang === 'ar'
              ? 'هذه المراجعة الجماعية تُضاف إلى رصيد كل طالب كمراجعة (مراجعة) وليس كحفظ جديد. لن تغير موضع الطالب في التقدم الفردي.'
              : 'Cette muraja\'a sera enregistrée comme révision collective et non comme mémorisation. Elle n\'affecte pas la progression individuelle de chaque élève.'}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(3)} className="back-link">← {lang === 'ar' ? 'رجوع' : 'Retour'}</button>
            <button onClick={handleValider} disabled={saving}
              style={{ flex: 1, padding: '12px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '...' : (lang === 'ar' ? '✓ تأكيد المراجعة الجماعية' : '✓ Confirmer la muraja\'a collective')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
