import React, { useState, useEffect } from 'react';
import { t } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, niveauTraduit, getInitiales, scoreLabel, formatDate } from '../lib/helpers';

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MOIS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MOIS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const getMoisNom = (idx, lang) => lang === 'ar' ? MOIS_AR[idx] : lang === 'en' ? MOIS_EN[idx] : MOIS_FR[idx];

function Avatar({ prenom, nom, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

export default function RapportMensuel({  user, navigate , lang="fr" }) {
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth());
  const [annee, setAnnee] = useState(now.getFullYear());
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [objectifs, setObjectifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingObj, setSavingObj] = useState({});
  const [editObj, setEditObj] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: ed }, { data: id }, { data: vd }, { data: od }] = await Promise.all([
      supabase.from('eleves').select('*').order('nom'),
      supabase.from('utilisateurs').select('*').eq('role', 'instituteur'),
      supabase.from('validations').select('*'),
      supabase.from('objectifs').select('*')
    ]);
    const elevesData = (ed || []).map(e => {
      const vals = (vd || []).filter(v => v.eleve_id === e.id);
      const etat = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart);
      const inst = (id || []).find(i => i.id === e.instituteur_referent_id);
      return { ...e, etat, instituteurNom: inst ? `${inst.prenom} ${inst.nom}` : '—' };
    });
    setEleves(elevesData);
    setInstituteurs(id || []);
    setAllValidations(vd || []);
    setObjectifs(od || []);
    setLoading(false);
  };

  // Stats du mois sélectionné
  const debutMois = new Date(annee, mois, 1);
  const finMois = new Date(annee, mois + 1, 0, 23, 59, 59);

  const vMois = allValidations.filter(v => {
    const d = new Date(v.date_validation);
    return d >= debutMois && d <= finMois;
  });

  const statsEleves = eleves.map(e => {
    const vEleve = vMois.filter(v => v.eleve_id === e.id);
    const tomonMois = vEleve.filter(v => v.type_validation === 'tomon').reduce((s, v) => s + v.nombre_tomon, 0);
    const hizbMois = vEleve.filter(v => v.type_validation === 'hizb_complet').length;
    const ptsMois = tomonMois * 10 + Math.floor(tomonMois / 2) * 25 + Math.floor(tomonMois / 4) * 60 + hizbMois * 100;
    const seances = new Set(vEleve.map(v => new Date(v.date_validation).toDateString())).size;
    const obj = objectifs.find(o => o.eleve_id === e.id && o.mois === mois + 1 && o.annee === annee);
    const pctObj = obj ? Math.min(100, Math.round(tomonMois / obj.nombre_tomon * 100)) : null;
    return { ...e, tomonMois, hizbMois, ptsMois, seances, objectif: obj?.nombre_tomon || null, pctObj };
  }).sort((a, b) => b.ptsMois - a.ptsMois);

  const totalTomonMois = vMois.filter(v => v.type_validation === 'tomon').reduce((s, v) => s + v.nombre_tomon, 0);
  const totalHizbMois = vMois.filter(v => v.type_validation === 'hizb_complet').length;
  const totalPtsMois = statsEleves.reduce((s, e) => s + e.ptsMois, 0);
  const elevesActifsMois = statsEleves.filter(e => e.tomonMois > 0 || e.hizbMois > 0).length;

  const saveObjectif = async (eleveId, valeur) => {
    if (!valeur || isNaN(valeur)) return;
    setSavingObj(prev => ({ ...prev, [eleveId]: true }));
    const existing = objectifs.find(o => o.eleve_id === eleveId && o.mois === mois + 1 && o.annee === annee);
    if (existing) {
      await supabase.from('objectifs').update({ nombre_tomon: parseInt(valeur) }).eq('id', existing.id);
    } else {
      await supabase.from('objectifs').insert({ eleve_id: eleveId, mois: mois + 1, annee, nombre_tomon: parseInt(valeur), created_by: user.id });
    }
    setEditObj(prev => ({ ...prev, [eleveId]: false }));
    setSavingObj(prev => ({ ...prev, [eleveId]: false }));
    await loadData();
  };

  const imprimerRapport = () => {
    const w = window.open('', '', 'width=900,height=1000');
    const medals = ['🥇', '🥈', '🥉'];
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const arabicFont = lang === 'ar' ? "'Tajawal', Arial, sans-serif" : "Arial, sans-serif";
    const dateLocale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-GB' : 'fr-FR';
    const thAlign = lang === 'ar' ? 'right' : 'left';
    const moisLabel = getMoisNom(mois, lang);
    w.document.write(`<html dir="${dir}" lang="${lang}"><head>
    <title>${t(lang,'rapport_mensuel')} — ${moisLabel} ${annee}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
      body{font-family:${arabicFont};color:#1a1a1a;padding:30px;font-size:13px;direction:${dir}}
      h1{font-size:24px;color:#1D9E75;margin-bottom:4px}
      h2{font-size:15px;margin:24px 0 10px;color:#1a1a1a;border-bottom:2px solid #1D9E75;padding-bottom:6px}
      .kpi{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}
      .kpi-box{flex:1;min-width:120px;border:1px solid #e0e0d8;border-radius:8px;padding:14px;text-align:center}
      .kpi-val{font-size:26px;font-weight:700;color:#1D9E75}
      .kpi-lbl{font-size:11px;color:#888;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px}
      th{background:#f5f5f0;text-align:${thAlign};padding:8px 10px;border-bottom:2px solid #e0e0d8;font-size:11px;text-transform:uppercase}
      td{padding:8px 10px;border-bottom:1px solid #f0f0ec;text-align:${thAlign}}
      tr:nth-child(even) td{background:#fafafa}
      .badge-green{background:#E1F5EE;color:#085041;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
      .badge-red{background:#FCEBEB;color:#A32D2D;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
      .badge-amber{background:#FAEEDA;color:#633806;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
      .pts{font-weight:700;color:#1D9E75}
      .footer{margin-top:30px;font-size:10px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:12px;text-align:center}
    </style></head><body>
    <h1>${t(lang,'rapport_mensuel')} — ${moisLabel} ${annee}</h1>
    <p style="color:#888;font-size:12px">${t(lang,'genere_le')} ${new Date().toLocaleDateString(dateLocale)} · ${t(lang,'app_name')}</p>
    <div class="kpi">
      <div class="kpi-box"><div class="kpi-val">${elevesActifsMois}</div><div class="kpi-lbl">${t(lang,'eleves_actifs')}</div></div>
      <div class="kpi-box"><div class="kpi-val">${totalTomonMois}</div><div class="kpi-lbl">${t(lang,'tomon_recites')}</div></div>
      <div class="kpi-box"><div class="kpi-val">${totalHizbMois}</div><div class="kpi-lbl">${t(lang,'hizb_complets')}</div></div>
      <div class="kpi-box"><div class="kpi-val">${totalPtsMois.toLocaleString()}</div><div class="kpi-lbl">${t(lang,'pts_generes')}</div></div>
    </div>
    <h2>${t(lang,'classement')}</h2>
    <table>
      <thead><tr>
        <th>#</th>
        <th>${t(lang,'eleve')}</th>
        <th>${t(lang,'referent')}</th>
        <th>${t(lang,'tomon_abrev')}</th>
        <th>${t(lang,'hizb_abrev')}</th>
        <th>${t(lang,'nb_seances')||'Séances'}</th>
        <th>${t(lang,'objectif_label')}</th>
        <th>${t(lang,'atteinte')}</th>
        <th>${t(lang,'score_mois')}</th>
      </tr></thead>
      <tbody>
        ${statsEleves.map((e, idx) => `
          <tr>
            <td>${medals[idx] || idx + 1}</td>
            <td><strong>${e.prenom} ${e.nom}</strong></td>
            <td style="color:#888">${e.instituteurNom}</td>
            <td class="pts">${e.tomonMois}</td>
            <td>${e.hizbMois > 0 ? \`<span class="badge-green">\${e.hizbMois} \${t(lang,'hizb_abrev')}</span>\` : '—'}</td>
            <td>${e.seances}</td>
            <td>${e.objectif ? e.objectif + ' ' + t(lang,'tomon_abrev') : '—'}</td>
            <td>${e.pctObj !== null ? \`<span class="\${e.pctObj >= 100 ? 'badge-green' : e.pctObj >= 60 ? 'badge-amber' : 'badge-red'}">\${e.pctObj}%</span>\` : '—'}</td>
            <td class="pts">${e.ptsMois.toLocaleString()} ${t(lang,'pts_abrev')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="footer">${t(lang,'app_name')} · ${moisLabel} ${annee}</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 600);
  };
  const prevMois = () => { if (mois === 0) { setMois(11); setAnnee(a => a - 1); } else setMois(m => m - 1); };
  const nextMois = () => { if (mois === 11) { setMois(0); setAnnee(a => a + 1); } else setMois(m => m + 1); };
  const medals = ['🥇', '🥈', '🥉'];
  const pctColor = (pct) => pct >= 100 ? '#1D9E75' : pct >= 60 ? '#EF9F27' : '#E24B4A';

  return (
    <div>
      <button className="back-link" onClick={() => navigate('dashboard')}>{t(lang,'retour')}</button>

      {/* Header navigation mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={prevMois} style={{ padding: '6px 14px', border: '0.5px solid #e0e0d8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>‹</button>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{getMoisNom(mois, lang)} {annee}</div>
          <button onClick={nextMois} style={{ padding: '6px 14px', border: '0.5px solid #e0e0d8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 16 }}>›</button>
        </div>
        <button onClick={imprimerRapport} style={{ padding: '8px 18px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          🖨️ Imprimer rapport PDF
        </button>
      </div>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {/* KPI mois */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: '1.5rem' }}>
            {[
              { val: elevesActifsMois, lbl: t(lang,'eleves_actifs'), color: '#1D9E75', bg: '#E1F5EE' },
              { val: totalTomonMois, lbl: t(lang,'tomon_recites'), color: '#378ADD', bg: '#E6F1FB' },
              { val: totalHizbMois, lbl: t(lang,'hizb_complets_label'), color: '#EF9F27', bg: '#FAEEDA' },
              { val: totalPtsMois.toLocaleString(), lbl: t(lang,'pts_generes'), color: '#534AB7', bg: '#EEEDFE' },
            ].map((k, i) => (
              <div key={i} style={{ background: k.bg, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 11, color: k.color, opacity: 0.8, marginTop: 2 }}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Tableau élèves avec objectifs */}
          <div className="section-label">Performance et objectifs — {getMoisNom(mois, lang)} {annee}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {statsEleves.map((e, idx) => (
              <div key={e.id} style={{ background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 12, padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: e.objectif ? 10 : 0 }}>
                  <div style={{ fontSize: 18, minWidth: 28, textAlign: 'center' }}>{medals[idx] || idx + 1}</div>
                  <Avatar prenom={e.prenom} nom={e.nom} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{e.prenom} {e.nom}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{e.instituteurNom} · Hizb {e.etat.hizbEnCours}</div>
                  </div>

                  {/* Stats mois */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {e.tomonMois > 0 && <span className="badge badge-blue" style={{ fontSize: 11 }}>{e.tomonMois} Tomon</span>}
                    {e.hizbMois > 0 && <span className="badge badge-green" style={{ fontSize: 11 }}>{e.hizbMois} Hizb</span>}
                    {e.seances > 0 && <span style={{ fontSize: 11, color: '#888' }}>{e.seances} séance{e.seances > 1 ? 's' : ''}</span>}
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1D9E75', minWidth: 60, textAlign: 'right' }}>{e.ptsMois.toLocaleString()} pts</span>

                    {/* Objectif — définir/modifier */}
                    {editObj[e.id] ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input type="number" min="1" max="80" placeholder="Tomon/mois"
                          style={{ width: 90, padding: '4px 8px', border: '0.5px solid #e0e0d8', borderRadius: 6, fontSize: 12 }}
                          defaultValue={e.objectif || ''}
                          onKeyDown={ev => ev.key === 'Enter' && saveObjectif(e.id, ev.target.value)}
                          id={`obj-${e.id}`} />
                        <button onClick={() => saveObjectif(e.id, document.getElementById(`obj-${e.id}`).value)}
                          style={{ padding: '4px 8px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                          {savingObj[e.id] ? '...' : '✓'}
                        </button>
                        <button onClick={() => setEditObj(prev => ({ ...prev, [e.id]: false }))}
                          style={{ padding: '4px 8px', border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditObj(prev => ({ ...prev, [e.id]: true }))}
                        style={{ padding: '4px 10px', border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#f9f9f6', fontSize: 11, cursor: 'pointer', color: '#888' }}>
                        {e.objectif ? `🎯 ${e.objectif}T` : ('+ ' + t(lang,'objectif_label'))}
                      </button>
                    )}
                  </div>
                </div>

                {/* Barre objectif */}
                {e.objectif && (
                  <div style={{ paddingLeft: 76 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                      <span>Objectif : {e.tomonMois} / {e.objectif} Tomon</span>
                      <span style={{ fontWeight: 600, color: pctColor(e.pctObj) }}>{e.pctObj}%</span>
                    </div>
                    <div style={{ height: 8, background: '#e8e8e0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${e.pctObj}%`, background: pctColor(e.pctObj), borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    {e.pctObj >= 100 && <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 4 }}>🎯 Objectif atteint !</div>}
                    {e.pctObj < 50 && e.objectif && <div style={{ fontSize: 11, color: '#E24B4A', marginTop: 4 }}>⚠️ Moins de 50% de l'objectif</div>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Stats par instituteur */}
          <div className="section-label" style={{ marginTop: '1.5rem' }}>Performance par instituteur</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 10 }}>
            {instituteurs.map(inst => {
              const ei = statsEleves.filter(e => e.instituteur_referent_id === inst.id);
              const tomon = ei.reduce((s, e) => s + e.tomonMois, 0);
              const hizb = ei.reduce((s, e) => s + e.hizbMois, 0);
              const pts = ei.reduce((s, e) => s + e.ptsMois, 0);
              const actifs = ei.filter(e => e.tomonMois > 0 || e.hizbMois > 0).length;
              return (
                <div key={inst.id} style={{ background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 12, padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Avatar prenom={inst.prenom} nom={inst.nom} size={36} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{inst.prenom} {inst.nom}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{actifs}/{ei.length} élèves actifs</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
                    {[[t(lang,'tomon_abrev'), tomon, '#E6F1FB', '#0C447C'], [t(lang,'hizb_abrev'), hizb, '#E1F5EE', '#085041'], [t(lang,'pts_abrev'), pts, '#EEEDFE', '#534AB7']].map(([l, v, bg, c]) => (
                      <div key={l} style={{ background: bg, borderRadius: 6, padding: '6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{v}</div>
                        <div style={{ fontSize: 9, color: c, opacity: 0.8 }}>{l}</div>
                      </div>
                    ))}
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
