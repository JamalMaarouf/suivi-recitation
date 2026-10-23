import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { loadBareme } from '../../lib/helpers';



// Sélecteur acquis antérieurs — adapté selon le niveau et le sens de récitation
// Prop programmeNiveau (optionnel) : si fourni et contient plusieurs blocs, affiche une
// aide contextuelle indiquant dans quel bloc pédagogique le Hizb choisi se situe.
// ───────────────────────────────────────────────────────────────────────
// AcquisSelector : composant extrait dans src/components/AcquisSelector.js
// pour partage PC + mobile. Voir l'import en haut du fichier.
// Fix Retours surveillant (jamais 2026) : semantique Hizb cliqué = acquis,
// tomon par défaut = 0, sourates depuis BDD (114).
// ───────────────────────────────────────────────────────────────────────






// ══════════════════════════════════════════════════════
// COMPOSANT BaremeTab — Paramétrage centralisé des points
// ══════════════════════════════════════════════════════
export function BaremeTab({ user, lang, bareme, setBareme, saving, setSaving, showMsg }) {
  const [examens,    setExamens]    = useState([]);
  const [ensembles,  setEnsembles]  = useState([]);  // avec niveau_id et sourates_ids
  const [niveaux,    setNiveaux]    = useState([]);  // pour optgroup et pilule
  const [souratesDB, setSouratesDB] = useState([]);  // pour afficher noms sourates
  const [jalons,     setJalons]     = useState([]);
  // Critères en cours de construction
  const [criteres,   setCriteres]   = useState([]); // [{type, objet_id, sourate_id, label, points, icon, color, groupe}]
  const [critereType, setCritereType] = useState('');
  const [critereObjetId, setCritereObjetId] = useState('');
  const [criterePoints, setCriterePoints] = useState(0);
  // Multi-sélection libre des ensembles (Mode 2 factorisation et Mode 3)
  const [ensemblesSelectionnes, setEnsemblesSelectionnes] = useState([]); // [ensemble_id, ...]
  // Configurations enregistrées (lignes)
  const [configs, setConfigs] = useState([]);
  // Etats de chargement pour skeleton et affichage progressif
  const [configsLoading, setConfigsLoading] = useState(true);

  const UNITES = [
    { key:'tomon',        icon:'📖', label_ar:'ثمن واحد مُستظهر',       color:'#378ADD' },
    { key:'hizb_complet', icon:'🎯', label_ar:'حزب كامل مُصحَّح',        color:'#085041' },
    { key:'sourate',      icon:'📜', label_ar:'سورة كاملة',              color:'#534AB7' },
    { key:'sequence_sourate', icon:'📌', label_ar:'مقطع من سورة',       color:'#534AB7' },
    { key:'muraja_tomon', icon:'🔄', label_ar:'ثمن مراجعة',              color:'#1D9E75' },
    { key:'muraja_hizb',  icon:'🔁', label_ar:'حزب مراجعة كامل',         color:'#1D9E75' },
    { key:'muraja_sourate',  icon:'🔁', label_ar:'سورة مراجعة كاملة',   color:'#534AB7' },
    { key:'muraja_sequence', icon:'🔄', label_ar:'مقطع سورة مراجعة',     color:'#534AB7' },
  ];

  useEffect(() => {
    // PRIORITE 1 : charger configs en premier (c'est ce que l'utilisateur veut voir)
    supabase.from('bareme_notes').select('*').eq('ecole_id', user.ecole_id).eq('actif', true).order('created_at')
      .then(({data}) => {
        if (data) setConfigs(data);
        setConfigsLoading(false);
      });
    // PRIORITE 2 : charger les autres en parallele (servent a enrichir l'affichage)
    supabase.from('examens').select('id,nom').eq('ecole_id', user.ecole_id).eq('actif', true).order('nom')
      .then(({data}) => setExamens(data||[]));
    supabase.from('ensembles_sourates').select('id,nom,niveau_id,sourates_ids,ordre').eq('ecole_id', user.ecole_id).order('niveau_id,ordre,nom')
      .then(({data}) => setEnsembles(data||[]));
    supabase.from('niveaux').select('id,code,nom,couleur,ordre,type').eq('ecole_id', user.ecole_id).order('ordre')
      .then(({data}) => setNiveaux(data||[]));
    supabase.from('sourates').select('id,nom_ar,nom_fr,numero').order('numero')
      .then(({data}) => setSouratesDB(data||[]));
    supabase.from('jalons').select('id,nom,nom_ar,type_jalon').eq('ecole_id', user.ecole_id).eq('actif', true).order('created_at')
      .then(({data}) => setJalons(data||[]));
  }, []);

  // Helpers
  const niveauObj = (niveau_id) => niveaux.find(n => n.id === niveau_id);
  const sourateNom = (sourate_id) => {
    const s = souratesDB.find(x => x.id === sourate_id);
    return lang === 'ar' ? (s?.nom_ar || `#${sourate_id}`) : (s?.nom_fr || s?.nom_ar || `#${sourate_id}`);
  };

  // PERF (mai 2026) : memoize un index 'niveau_id -> ensembles' pour
  // eviter de faire ensembles.filter() dans des boucles imbriquees a
  // chaque re-render. Acces O(1) au lieu de O(N) par niveau.
  // Utilise par le selecteur d'ensembles (mode classique) et le panneau
  // de multi-selection (mode 2/3).
  const ensemblesByNiveauId = useMemo(() => {
    const map = new Map();
    for (const e of ensembles) {
      const key = e.niveau_id || '__sans_niveau__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }, [ensembles]);

  // PERF (mai 2026) : memoize les options du selecteur de criteres pour
  // eviter le .map() a chaque re-render. Recalcul uniquement si le type
  // de critere ou les listes sources changent.
  const optionsCritere = useMemo(() => {
    if (critereType === 'examen') return examens.map(e => ({ id: e.id, label: e.nom }));
    if (critereType === 'ensemble_sourates') return ensembles.map(e => ({ id: e.id, label: e.nom }));
    if (critereType === 'jalon') return jalons.map(j => ({ id: j.id, label: j.nom_ar || j.nom }));
    return [];
  }, [critereType, examens, ensembles, jalons]);

  // Wrapper conserve pour compatibilite avec le code existant
  const getOptions = () => optionsCritere;

  const getCritereLabel = () => {
    const u = UNITES.find(u => u.key === critereType);
    if (u) return { label: u.label_ar, icon: u.icon, color: u.color, objet_id: null };
    if (critereType === 'examen') {
      const e = examens.find(x => x.id === critereObjetId);
      return { label: e?.nom || '', icon: '📝', color: '#EF9F27', objet_id: critereObjetId };
    }
    if (critereType === 'ensemble_sourates') {
      const e = ensembles.find(x => x.id === critereObjetId);
      return { label: e?.nom || '', icon: '📦', color: '#D85A30', objet_id: critereObjetId };
    }
    if (critereType === 'jalon') {
      const j = jalons.find(x => x.id === critereObjetId);
      return { label: j?.nom_ar || j?.nom || '', icon: '🏅', color: '#EF9F27', objet_id: critereObjetId };
    }
    return null;
  };

  const ajouterCritere = () => {
    if (!critereType) return;
    const isUnite = UNITES.find(u => u.key === critereType);
    if (criterePoints <= 0) { showMsg('error', lang==='ar'?'أدخل عدد النقاط':'Saisissez les points'); return; }

    // Mode 2 multi-selection (ensemble_sourates) ET Mode 3 (sourate_dans_ensemble)
    // utilisent la multi-selection libre des ensembles
    if (critereType === 'ensemble_sourates_multi' || critereType === 'sourate_dans_ensemble') {
      if (ensemblesSelectionnes.length === 0) {
        showMsg('error', lang==='ar'?'اختر مجموعة واحدة على الأقل':'Sélectionnez au moins un ensemble');
        return;
      }

      const groupeId = `grp_${Date.now()}`;
      const nouveaux = [];

      for (const ensId of ensemblesSelectionnes) {
        const ens = ensembles.find(e => e.id === ensId);
        if (!ens) continue;
        const niv = niveauObj(ens.niveau_id);
        const niveauLabel = niv ? `[${niv.code}] ${niv.nom}` : '';

        if (critereType === 'ensemble_sourates_multi') {
          // Mode 2 factorise : 1 critere par ensemble (note pour ensemble entier)
          const exists = criteres.find(c => c.type === 'ensemble_sourates' && c.objet_id === ensId);
          if (exists) continue;
          nouveaux.push({
            type: 'ensemble_sourates',
            objet_id: ensId,
            label: niveauLabel ? `${niveauLabel} — ${ens.nom}` : ens.nom,
            icon: '📦',
            color: '#D85A30',
            points: criterePoints,
            groupe: groupeId,
            niveau_id: ens.niveau_id,
            ensemble_nom: ens.nom,
          });
        } else {
          // Mode 3 : 1 critere par sourate de chaque ensemble (note par sourate)
          for (const sId of (ens.sourates_ids || [])) {
            const exists = criteres.find(c => c.type === 'sourate_dans_ensemble' && c.objet_id === ensId && c.sourate_id === sId);
            if (exists) continue;
            nouveaux.push({
              type: 'sourate_dans_ensemble',
              objet_id: ensId,
              sourate_id: sId,
              label: niveauLabel ? `${niveauLabel} — ${ens.nom} → ${sourateNom(sId)}` : `${ens.nom} → ${sourateNom(sId)}`,
              icon: '🎯',
              color: '#085041',
              points: criterePoints,
              groupe: groupeId,
              niveau_id: ens.niveau_id,
              ensemble_nom: ens.nom,
            });
          }
        }
      }

      if (nouveaux.length === 0) {
        showMsg('error', lang==='ar'?'كل المعايير المحددة موجودة بالفعل':'Tous ces critères sont déjà ajoutés');
        return;
      }
      setCriteres(prev => [...prev, ...nouveaux]);
      setCritereType(''); setCritereObjetId(''); setCriterePoints(0);
      setEnsemblesSelectionnes([]);
      return;
    }

    // Mode classique : un seul critere
    if (!isUnite && !critereObjetId) {
      showMsg('error', lang==='ar'?'اختر العنصر':"Choisissez l'élément");
      return;
    }
    const info = getCritereLabel();
    if (!info || !info.label) return;
    const exists = criteres.find(c => c.type === critereType && c.objet_id === info.objet_id);
    if (exists) { showMsg('error', lang==='ar'?'هذا المعيار موجود بالفعل':'Ce critère est déjà ajouté'); return; }
    setCriteres(prev => [...prev, { type: critereType, objet_id: info.objet_id, label: info.label, icon: info.icon, color: info.color, points: criterePoints }]);
    setCritereType(''); setCritereObjetId(''); setCriterePoints(0);
  };

  const retirerCritere = (idx) => setCriteres(prev => prev.filter((_,i) => i !== idx));

  const enregistrerConfig = async () => {
    if (criteres.length === 0) { showMsg('error', lang==='ar'?'أضف معياراً واحداً على الأقل':'Ajoutez au moins un critère'); return; }

    // P3 - Alerte prevention double comptage
    // Si on a un critere 'sourate' generique ET des criteres 'sourate_dans_ensemble',
    // prevenir le surveillant que le mode 3 prime sur le mode 1
    const aSourateGenerique = criteres.some(c => c.type === 'sourate') || (bareme?.unites?.sourate || 0) > 0;
    const aSourateDansEns = criteres.some(c => c.type === 'sourate_dans_ensemble');
    if (aSourateGenerique && aSourateDansEns) {
      const confirme = window.confirm(lang==='ar'
        ? '⚠️ تنبيه : لقد قمت بإعداد "سورة كاملة" (نقطة عامة) و "سورة في مجموعة" (نقطة محددة). النقطة المحددة (في مجموعة) ستُطبَّق وليس النقطة العامة لسور هذه المجموعات. هل تريد المتابعة ؟'
        : '⚠️ Attention : vous avez configuré "Sourate complète" (note générique) et "Sourate dans ensemble" (note spécifique). La note spécifique (dans ensemble) primera sur la générique pour les sourates de ces ensembles. Continuer ?');
      if (!confirme) return;
    }

    setSaving(true);
    const errors = [];
    let saved = 0;

    // BULK SAVE : groupe les criteres par (type + objet_id) pour faire un
    // DELETE bulk puis un INSERT bulk. Beaucoup plus rapide que critère par
    // critère sequentiellement (gain x10+ pour 100+ criteres).
    try {
      // Etape 1 : DELETE par batchs - regroupe par (type, objet_id)
      // pour les types simples (1 row par cle), et type='sourate_dans_ensemble'
      // est traite specifiquement (1 DELETE par ensemble)
      const deletesParEns = {}; // ensemble_id -> Set<sourate_id> pour mode 3
      const deletesClassiques = []; // {type, objet_id} pour autres types

      criteres.forEach(c => {
        if (c.type === 'sourate_dans_ensemble') {
          if (!deletesParEns[c.objet_id]) deletesParEns[c.objet_id] = new Set();
          deletesParEns[c.objet_id].add(c.sourate_id);
        } else {
          deletesClassiques.push({ type: c.type, objet_id: c.objet_id });
        }
      });

      // DELETE classiques en bulk
      for (const { type, objet_id } of deletesClassiques) {
        let q = supabase.from('bareme_notes').delete()
          .eq('ecole_id', user.ecole_id).eq('type_action', type).eq('actif', true);
        q = objet_id ? q.eq('objet_id', objet_id) : q.is('objet_id', null);
        await q;
      }

      // DELETE mode 3 par ensemble (avec sourate_id IN (...))
      for (const [ensId, sourateIdsSet] of Object.entries(deletesParEns)) {
        const sIds = Array.from(sourateIdsSet);
        await supabase.from('bareme_notes').delete()
          .eq('ecole_id', user.ecole_id)
          .eq('type_action', 'sourate_dans_ensemble')
          .eq('actif', true)
          .eq('objet_id', ensId)
          .in('sourate_id', sIds);
      }

      // Etape 2 : INSERT BULK (1 seule requete pour tous les criteres)
      const rows = criteres.map(c => {
        const row = {
          ecole_id: user.ecole_id,
          type_action: c.type,
          points: parseInt(c.points) || 0,
          actif: true,
        };
        if (c.objet_id) row.objet_id = c.objet_id;
        if (c.sourate_id) row.sourate_id = c.sourate_id;
        if (c.groupe) row.groupe_factorisation = c.groupe;
        return row;
      });

      const { error: insertError } = await supabase.from('bareme_notes').insert(rows);
      if (insertError) {
        errors.push(insertError.message || 'Erreur INSERT bulk');
      } else {
        saved = rows.length;
      }
    } catch (err) {
      errors.push(err.message || 'Erreur globale');
      console.error('Erreur bulk save:', err);
    }

    if (errors.length > 0) {
      // En cas d'erreur, on recharge toujours pour synchroniser
      const { data } = await supabase.from('bareme_notes').select('*').eq('ecole_id', user.ecole_id).eq('actif', true).order('created_at');
      if (data) setConfigs(data);
      const newB = await loadBareme(supabase, user.ecole_id);
      setBareme(newB);
      setSaving(false);
      showMsg('error', lang==='ar'
        ? `تم حفظ ${saved}/${criteres.length}. خطأ: ${errors[0]}`
        : `${saved}/${criteres.length} enregistrés. Erreur: ${errors[0]}`);
    } else {
      // SUCCES : feedback immediat + rechargement en arriere-plan
      // 1. Vider la liste de criteres en cours (UX optimiste)
      setCriteres([]);
      setSaving(false);
      showMsg('success', lang==='ar'
        ? `تم حفظ ${saved} معيار بنجاح`
        : `${saved} critère${saved > 1 ? 's' : ''} enregistré${saved > 1 ? 's' : ''}`);
      // 2. Rechargement BDD en arriere-plan (sans bloquer l'UI)
      (async () => {
        const { data } = await supabase.from('bareme_notes').select('*').eq('ecole_id', user.ecole_id).eq('actif', true).order('created_at');
        if (data) setConfigs(data);
        const newB = await loadBareme(supabase, user.ecole_id);
        setBareme(newB);
      })();
    }
  };

  const supprimerConfig = async (id) => {
    await supabase.from('bareme_notes').delete().eq('id', id);
    setConfigs(prev => prev.filter(c => c.id !== id));
    const newB = await loadBareme(supabase, user.ecole_id);
    setBareme(newB);
  };

  // Supprime un groupe entier de criteres (factorisation)
  const supprimerGroupe = async (ids) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(lang==='ar'
      ? `حذف ${ids.length} معيار من هذه المجموعة ؟`
      : `Supprimer ${ids.length} critère(s) de ce groupe ?`)) return;
    await supabase.from('bareme_notes').delete().in('id', ids);
    setConfigs(prev => prev.filter(c => !ids.includes(c.id)));
    const newB = await loadBareme(supabase, user.ecole_id);
    setBareme(newB);
  };

  const getConfigLabel = (c) => {
    // Support BDD (type_action) ET memoire (type) car les criteres en cours
    // d'ajout utilisent 'type' alors que les configs en BDD utilisent 'type_action'
    const t = c.type || c.type_action;
    if (!c.objet_id) return UNITES.find(u => u.key === t)?.label_ar || t;
    if (t === 'examen') return examens.find(e => e.id === c.objet_id)?.nom || '—';
    if (t === 'ensemble_sourates') {
      const e = ensembles.find(x => x.id === c.objet_id);
      const niv = niveauObj(e?.niveau_id);
      return niv ? `[${niv.code}] ${e?.nom||'—'}` : (e?.nom || '—');
    }
    if (t === 'sourate_dans_ensemble') {
      const e = ensembles.find(x => x.id === c.objet_id);
      const niv = niveauObj(e?.niveau_id);
      const ensLabel = niv ? `[${niv.code}] ${e?.nom||'—'}` : (e?.nom || '—');
      return `${ensLabel} → ${sourateNom(c.sourate_id)}`;
    }
    if (t === 'jalon') { const j = jalons.find(x => x.id === c.objet_id); return j?.nom_ar || j?.nom || '—'; }
    return t;
  };

  const getConfigIcon = (c) => {
    const t = c.type || c.type_action;
    if (!c.objet_id) return UNITES.find(u => u.key === t)?.icon || '⭐';
    if (t === 'examen') return '📝';
    if (t === 'ensemble_sourates') return '📦';
    if (t === 'sourate_dans_ensemble') return '🎯';
    if (t === 'jalon') return '🏅';
    return '⭐';
  };

  // needsObjet : pour quels types on affiche le select 'choisir element'
  // On EXCLUT 'ensemble_sourates_multi' et 'sourate_dans_ensemble' qui utilisent
  // un panneau dedie de multi-selection
  const needsObjet = critereType
    && !UNITES.find(u => u.key === critereType)
    && critereType !== 'ensemble_sourates_multi'
    && critereType !== 'sourate_dans_ensemble';

  // needsMultiSelect : pour quels types on affiche le panneau de multi-selection
  const needsMultiSelect = critereType === 'ensemble_sourates_multi' || critereType === 'sourate_dans_ensemble';

  return (
    <div>
      <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
        {lang==='ar'
          ? 'أضف معايير التنقيط واحفظها — تُطبَّق تلقائياً على جميع الطلاب'
          : 'Ajoutez des critères de notation et enregistrez — appliqués automatiquement à tous'}
      </div>

      {/* Formulaire ajout critère */}
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="section-label">{lang==='ar'?'إضافة معيار':'Ajouter un critère'}</div>

        {/* Ligne sélection */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end',marginBottom:12}}>

          {/* Sélecteur type */}
          <div style={{flex:2,minWidth:160}}>
            <label className="field-lbl">{lang==='ar'?'نوع المعيار':'Type de critère'}</label>
            <select className="field-select" value={critereType}
              onChange={e => { setCritereType(e.target.value); setCritereObjetId(''); setEnsemblesSelectionnes([]); }}>
              <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
              <optgroup label={lang==='ar'?'وحدات أساسية':'Unités de base'}>
                {UNITES.map(u => <option key={u.key} value={u.key}>{u.icon} {u.label_ar}</option>)}
              </optgroup>
              <optgroup label={lang==='ar'?'امتحانات':'Examens'}>
                <option value="examen">{lang==='ar'?'امتحان محدد...':'Examen spécifique...'}</option>
              </optgroup>
              <optgroup label={lang==='ar'?'مجموعات سور':'Ensembles'}>
                <option value="ensemble_sourates">{lang==='ar'?'مجموعة سور (واحدة)...':'Ensemble de sourates (un seul)...'}</option>
                <option value="ensemble_sourates_multi">{lang==='ar'?'📦 مجموعات متعددة (نقطة للمجموعة)...':'📦 Plusieurs ensembles (note pour ensemble entier)...'}</option>
                <option value="sourate_dans_ensemble">{lang==='ar'?'🎯 سورة في مجموعات (نقطة لكل سورة)...':'🎯 Sourate dans ensembles (note par sourate)...'}</option>
              </optgroup>
              <optgroup label={lang==='ar'?'شهادات':'Jalons'}>
                <option value="jalon">{lang==='ar'?'شهادة محددة...':'Jalon spécifique...'}</option>
              </optgroup>
            </select>
          </div>

          {/* Sélecteur objet (mode classique : un seul) */}
          {needsObjet && (
            <div style={{flex:2,minWidth:160}}>
              <label className="field-lbl">{lang==='ar'?'اختر العنصر':"Choisir l'élément"}</label>
              <select className="field-select" value={critereObjetId} onChange={e => setCritereObjetId(e.target.value)}>
                <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
                {critereType === 'ensemble_sourates' ? (
                  // Optgroup par niveau pour distinguer ensembles homonymes
                  niveaux.map(niv => {
                    const ensDuNiveau = ensemblesByNiveauId.get(niv.id) || [];
                    if (ensDuNiveau.length === 0) return null;
                    return (
                      <optgroup key={niv.id} label={`[${niv.code}] ${niv.nom}`}>
                        {ensDuNiveau.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                      </optgroup>
                    );
                  }).filter(Boolean)
                ) : (
                  getOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)
                )}
              </select>
            </div>
          )}

          {/* Points avec +/- */}
          <div style={{minWidth:130}}>
            <label className="field-lbl">{lang==='ar'?'النقاط':'Points'}</label>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <button onClick={() => setCriterePoints(p => Math.max(0, p-1))}
                style={{width:32,height:38,borderRadius:6,border:'0.5px solid #e0e0d8',background:'#f9f9f6',cursor:'pointer',fontSize:18,fontWeight:700,color:'#888'}}>−</button>
              <input type="number" min="0" max="9999" value={criterePoints}
                onChange={e => setCriterePoints(parseInt(e.target.value)||0)}
                style={{width:68,padding:'8px',borderRadius:6,border:'1.5px solid #378ADD50',fontSize:16,fontWeight:700,textAlign:'center',color:'#378ADD'}} />
              <button onClick={() => setCriterePoints(p => p+1)}
                style={{width:32,height:38,borderRadius:6,border:'0.5px solid #e0e0d8',background:'#f9f9f6',cursor:'pointer',fontSize:18,fontWeight:700,color:'#888'}}>+</button>
            </div>
          </div>

          {/* Bouton ajouter critère - feedback visuel */}
          {(() => {
            const isUnite = UNITES.find(u => u.key === critereType);
            const aPoints = criterePoints > 0;
            let pret = false;
            let raison = '';
            if (!critereType) { pret = false; raison = lang==='ar' ? 'اختر النوع' : 'Choisissez le type'; }
            else if (isUnite) { pret = aPoints; if (!aPoints) raison = lang==='ar' ? 'أدخل النقاط' : 'Saisissez les points'; }
            else if (needsMultiSelect) {
              if (ensemblesSelectionnes.length === 0) { pret = false; raison = lang==='ar' ? 'اختر مجموعة' : 'Sélectionnez un ensemble'; }
              else if (!aPoints) { pret = false; raison = lang==='ar' ? 'أدخل النقاط' : 'Saisissez les points'; }
              else pret = true;
            }
            else { pret = aPoints && !!critereObjetId; if (!critereObjetId) raison = lang==='ar' ? 'اختر العنصر' : "Choisissez l'élément"; else if (!aPoints) raison = lang==='ar' ? 'أدخل النقاط' : 'Saisissez les points'; }

            return (
              <button onClick={() => { if (pret) ajouterCritere(); else if (raison) showMsg('error', raison); }}
                title={pret ? '' : raison}
                style={{
                  padding:'8px 16px',
                  background: pret ? '#1D9E75' : '#E6F1FB',
                  color: pret ? '#fff' : '#378ADD',
                  border: pret ? '1px solid #1D9E75' : '1px solid #378ADD40',
                  borderRadius:8, fontWeight:700, fontSize:13,
                  cursor: pret ? 'pointer' : 'not-allowed',
                  opacity: pret ? 1 : 0.7,
                  alignSelf:'flex-end', height:38,
                  transition:'all 0.15s', fontFamily:'inherit',
                }}>
                + {lang==='ar'?'أضف':'Ajouter'}
              </button>
            );
          })()}
        </div>

        {/* Panneau multi-selection libre des ensembles (Mode 2 multi et Mode 3) */}
        {needsMultiSelect && (() => {
          const nbS = ensemblesSelectionnes.length;
          const toggleEns = (eId) => {
            setEnsemblesSelectionnes(prev => prev.includes(eId) ? prev.filter(x => x !== eId) : [...prev, eId]);
          };
          const ensParNiveau = niveaux.map(niv => ({
            niv,
            ensembles: ensemblesByNiveauId.get(niv.id) || [],
          })).filter(g => g.ensembles.length > 0);
          const ensSansNiveau = ensemblesByNiveauId.get('__sans_niveau__') || [];

          if (ensembles.length === 0) {
            return (
              <div style={{padding:'12px 14px',background:'#FFF3CD',border:'0.5px solid #EF9F2740',borderRadius:8,fontSize:12,color:'#856404',marginBottom:12}}>
                ⚠️ {lang==='ar' ? 'لا توجد مجموعات. أضفها أولاً في إدارة المجموعات.' : "Aucun ensemble. Créez-en d'abord dans Gestion → Ensembles."}
              </div>
            );
          }

          // Couleur distincte selon mode
          const isMode3 = critereType === 'sourate_dans_ensemble';
          const colorMain = isMode3 ? '#085041' : '#534AB7';
          const bgPanneau = isMode3 ? '#E8F5EE' : '#EEEDFE';
          const borderColor = isMode3 ? '#085041' : '#534AB7';
          const titre = isMode3
            ? (lang==='ar' ? '🎯 اختر المجموعات (نقطة لكل سورة)' : '🎯 Sélectionner les ensembles (note par sourate)')
            : (lang==='ar' ? '📦 اختر المجموعات (نقطة للمجموعة)' : '📦 Sélectionner les ensembles (note pour ensemble entier)');

          // Aperçu pour mode 3 : nombre total de sourates
          const totalSourates = isMode3 ? ensemblesSelectionnes.reduce((sum, eId) => {
            const ens = ensembles.find(e => e.id === eId);
            return sum + (ens?.sourates_ids?.length || 0);
          }, 0) : 0;

          return (
            <div style={{padding:'12px 14px',background:bgPanneau,border:`1px solid ${borderColor}30`,borderRadius:8,marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:6}}>
                <div style={{fontSize:13,fontWeight:600,color:colorMain}}>{titre}</div>
                <div style={{display:'flex',gap:6,fontSize:11,alignItems:'center'}}>
                  <button onClick={() => setEnsemblesSelectionnes(ensembles.map(e => e.id))}
                    disabled={nbS === ensembles.length}
                    style={{padding:'4px 10px',background: nbS === ensembles.length ? '#f0f0ec' : colorMain,
                      border:'none',color: nbS === ensembles.length ? '#aaa' : '#fff',borderRadius:6,
                      cursor: nbS === ensembles.length ? 'not-allowed' : 'pointer',fontWeight:600,fontFamily:'inherit'}}>
                    ✓ {lang==='ar' ? 'الكل' : 'Tout cocher'}
                  </button>
                  <button onClick={() => setEnsemblesSelectionnes([])}
                    disabled={nbS === 0}
                    style={{padding:'4px 10px',background:'#fff',border:'0.5px solid #E24B4A60',
                      color: nbS === 0 ? '#ccc' : '#E24B4A',borderRadius:6,
                      cursor: nbS === 0 ? 'not-allowed' : 'pointer',fontWeight:600,fontFamily:'inherit'}}>
                    ✕ {lang==='ar' ? 'إلغاء الكل' : 'Tout décocher'}
                  </button>
                  <span style={{fontSize:11,color:'#666',marginInlineStart:4,fontWeight:600}}>{nbS} / {ensembles.length}</span>
                </div>
              </div>

              <div style={{maxHeight:340, overflowY:'auto', display:'flex', flexDirection:'column', gap:10}}>
                {ensParNiveau.map(({niv, ensembles: ensNiv}) => {
                  const couleur = niv.couleur || colorMain;
                  return (
                    <div key={niv.id}>
                      <div style={{fontSize:11,fontWeight:700,marginBottom:5,display:'flex',alignItems:'center',gap:6}}>
                        <span style={{padding:'2px 8px',borderRadius:10,background:`${couleur}18`,color:couleur,
                          fontWeight:700,letterSpacing:0.3,border:`0.5px solid ${couleur}40`}}>{niv.code}</span>
                        <span style={{color:'#666'}}>{niv.nom}</span>
                      </div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:5,paddingInlineStart:6}}>
                        {ensNiv.map(ens => {
                          const sel = ensemblesSelectionnes.includes(ens.id);
                          const nbSourates = ens.sourates_ids?.length || 0;
                          return (
                            <div key={ens.id} onClick={() => toggleEns(ens.id)}
                              style={{padding:'6px 10px',borderRadius:6,cursor:'pointer',fontSize:11,
                                background: sel ? colorMain : '#fff',
                                color: sel ? '#fff' : '#1a1a1a',
                                border: `0.5px solid ${sel ? colorMain : '#e0e0d8'}`,
                                fontWeight: sel ? 600 : 400,
                                display:'flex',alignItems:'center',gap:5,transition:'all 0.15s'}}>
                              <span style={{fontSize:10,opacity:0.7}}>{sel ? '✓' : ''}</span>
                              <span>📦 {ens.nom}</span>
                              {isMode3 && <span style={{fontSize:9,opacity:0.7}}>({nbSourates} {lang==='ar'?'سور':'sour.'})</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {ensSansNiveau.length > 0 && (
                  <div>
                    <div style={{fontSize:11,fontWeight:700,marginBottom:5,color:'#888'}}>{lang==='ar' ? 'بدون مستوى' : 'Sans niveau'}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5,paddingInlineStart:6}}>
                      {ensSansNiveau.map(ens => {
                        const sel = ensemblesSelectionnes.includes(ens.id);
                        return (
                          <div key={ens.id} onClick={() => toggleEns(ens.id)}
                            style={{padding:'6px 10px',borderRadius:6,cursor:'pointer',fontSize:11,
                              background: sel ? colorMain : '#fff',color: sel ? '#fff' : '#1a1a1a',
                              border: `0.5px solid ${sel ? colorMain : '#e0e0d8'}`,
                              fontWeight: sel ? 600 : 400,display:'flex',alignItems:'center',gap:5}}>
                            <span style={{fontSize:10,opacity:0.7}}>{sel ? '✓' : ''}</span>
                            <span>📦 {ens.nom}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{marginTop:8,fontSize:10,color:'#666',fontStyle:'italic'}}>
                {isMode3 ? (
                  lang==='ar'
                    ? `سيتم إنشاء ${totalSourates} معيار (${nbS} مجموعة × ${totalSourates > 0 ? Math.round(totalSourates/Math.max(nbS,1)) : 0} سورة في المتوسط) بنفس عدد النقاط (${criterePoints})`
                    : `${totalSourates} critère(s) sera(nt) créé(s) (${nbS} ensemble(s)) avec la même note (${criterePoints} pts/sourate)`
                ) : (
                  lang==='ar'
                    ? `سيتم إنشاء ${nbS} معيار بنفس عدد النقاط (${criterePoints})`
                    : `${nbS} critère(s) sera(nt) créé(s) avec la même note (${criterePoints} pts)`
                )}
              </div>
            </div>
          );
        })()}

        {/* Liste critères en cours */}
        {criteres.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:'#888',marginBottom:6,fontWeight:600}}>
              {lang==='ar'?'المعايير المضافة:':'Critères ajoutés :'}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {criteres.map((c,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f9f9f6',borderRadius:8,border:'0.5px solid #e0e0d8'}}>
                  <span style={{fontSize:16}}>{c.icon}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:600,direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{c.label}</span>
                  <span style={{fontWeight:800,fontSize:15,color:c.color}}>{c.points}</span>
                  <span style={{fontSize:10,color:'#aaa'}}>{lang==='ar'?'ن':'pts'}</span>
                  <button onClick={() => retirerCritere(i)}
                    style={{padding:'2px 8px',background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:6,cursor:'pointer',fontSize:12}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{marginTop:8,fontSize:12,color:'#085041',fontWeight:600}}>
              {lang==='ar'?'المجموع:':'Total :'} {criteres.reduce((s,c)=>s+c.points,0)} {lang==='ar'?'نقطة':'pts'}
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={enregistrerConfig} disabled={saving||criteres.length===0}>
          {saving ? '...' : (lang==='ar'?'حفظ هذه التنقيطات':'Enregistrer ces notations')}
        </button>
      </div>

      {/* Liste des configurations enregistrées */}
      <div className="section-label">
        {lang==='ar'?'التنقيطات المُسجَّلة':'Notations enregistrées'}
        {!configsLoading && ` (${configs.length})`}
      </div>
      {configsLoading ? (
        // Skeleton de chargement (3 lignes grises animees)
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              display:'flex',alignItems:'center',gap:12,padding:'10px 14px',
              background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10,
              animation: 'pulse 1.5s ease-in-out infinite',
              opacity: 0.5,
            }}>
              <div style={{width:24,height:24,borderRadius:6,background:'#e8e8e0'}}></div>
              <div style={{flex:1, display:'flex', flexDirection:'column', gap:6}}>
                <div style={{width:'60%',height:13,background:'#e8e8e0',borderRadius:4}}></div>
                <div style={{width:'40%',height:10,background:'#f0f0eb',borderRadius:4}}></div>
              </div>
              <div style={{width:30,height:20,background:'#e8e8e0',borderRadius:4}}></div>
            </div>
          ))}
          <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.3; } }`}</style>
        </div>
      ) : configs.length === 0 ? (
        <div className="empty">{lang==='ar'?'لا توجد تنقيطات بعد — أضف معايير وسجّلها أعلاه':'Aucune notation enregistrée'}</div>
      ) : (() => {
        // GROUPAGE des configs :
        // - Si groupe_factorisation existe : grouper par cette cle (factorisation Mode 2 multi ou Mode 3)
        // - Sinon : ligne individuelle
        const groupes = {};   // groupe_id -> [configs]
        const isoles = [];    // configs sans groupe
        configs.forEach(c => {
          if (c.groupe_factorisation) {
            if (!groupes[c.groupe_factorisation]) groupes[c.groupe_factorisation] = [];
            groupes[c.groupe_factorisation].push(c);
          } else {
            isoles.push(c);
          }
        });

        // Tri : groupes triés par created_at (plus récents en premier),
        // puis isolés ensuite
        const groupesTriés = Object.entries(groupes)
          .map(([gId, items]) => ({
            groupe_id: gId,
            items,
            firstCreated: items[0].created_at,
            type: items[0].type_action,
            points: items[0].points,
            count: items.length,
          }))
          .sort((a, b) => new Date(b.firstCreated) - new Date(a.firstCreated));

        return (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {/* GROUPES (pliables) */}
            {groupesTriés.map(g => (
              <GroupeCard key={g.groupe_id}
                groupe={g}
                lang={lang}
                ensembles={ensembles}
                niveaux={niveaux}
                souratesDB={souratesDB}
                getConfigLabel={getConfigLabel}
                getConfigIcon={getConfigIcon}
                onDeleteGroupe={async () => {
                  if (!window.confirm(lang==='ar'
                    ? `هل أنت متأكد من حذف هذه المجموعة (${g.count} معيار) ؟`
                    : `Confirmer la suppression de ce groupe (${g.count} critères) ?`)) return;
                  const ids = g.items.map(it => it.id);
                  await supabase.from('bareme_notes').delete().in('id', ids);
                  setConfigs(prev => prev.filter(c => !ids.includes(c.id)));
                  const newB = await loadBareme(supabase, user.ecole_id);
                  setBareme(newB);
                }}
                onUpdatePoints={async (newPts) => {
                  // Mettre a jour TOUS les items du groupe avec les nouveaux points
                  const ids = g.items.map(it => it.id);
                  await supabase.from('bareme_notes')
                    .update({ points: parseInt(newPts) || 0 })
                    .in('id', ids);
                  // Recharger configs
                  setConfigs(prev => prev.map(c =>
                    ids.includes(c.id) ? { ...c, points: parseInt(newPts) || 0 } : c
                  ));
                  const newB = await loadBareme(supabase, user.ecole_id);
                  setBareme(newB);
                }}
              />
            ))}

            {/* ISOLES (non groupés) - lignes simples avec edit inline */}
            {isoles.map(c => (
              <ConfigSimpleLine key={c.id}
                config={c}
                lang={lang}
                getConfigLabel={getConfigLabel}
                getConfigIcon={getConfigIcon}
                onUpdatePoints={async (newPts) => {
                  await supabase.from('bareme_notes')
                    .update({ points: parseInt(newPts) || 0 })
                    .eq('id', c.id);
                  setConfigs(prev => prev.map(x =>
                    x.id === c.id ? { ...x, points: parseInt(newPts) || 0 } : x
                  ));
                  const newB = await loadBareme(supabase, user.ecole_id);
                  setBareme(newB);
                }}
                onDelete={() => supprimerConfig(c.id)}
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// COMPOSANT GroupeCard — affichage compact d'un groupe factorisé
// (Mode 2 multi ou Mode 3 - sourate dans ensemble)
// ══════════════════════════════════════════════════════
export function GroupeCard({ groupe, lang, ensembles, niveaux, souratesDB, getConfigLabel, getConfigIcon, onDeleteGroupe, onUpdatePoints }) {
  const [editing, setEditing] = useState(false);
  const [newPoints, setNewPoints] = useState(groupe.points);
  const [savingEdit, setSavingEdit] = useState(false);

  const niveauObj = (niveau_id) => niveaux.find(n => n.id === niveau_id);

  const isMode3 = groupe.type === 'sourate_dans_ensemble';
  const colorMain = isMode3 ? '#085041' : '#534AB7';
  const bgPanneau = isMode3 ? '#E8F5EE' : '#EEEDFE';
  const totalPts = groupe.items.reduce((s, it) => s + (it.points || 0), 0);

  // Construire la liste des ensembles concernés (uniques)
  const ensemblesConcernes = [...new Set(groupe.items.map(it => it.objet_id))]
    .map(eId => ensembles.find(e => e.id === eId))
    .filter(Boolean);

  const titreType = isMode3
    ? (lang==='ar' ? '🎯 سورة في مجموعات' : '🎯 Sourate dans ensembles')
    : (lang==='ar' ? '📦 مجموعات متعددة' : '📦 Plusieurs ensembles');

  // Stats compactes
  // Mode 3 : count = nombre de sourates total, ensembles = nombre d'ensembles distincts
  // Mode 2 : count = nombre d'ensembles
  const nbEnsembles = ensemblesConcernes.length;
  const nbSourates = isMode3 ? groupe.count : 0;

  const statLabel = isMode3
    ? (lang==='ar'
        ? `${nbSourates} سورة في ${nbEnsembles} ${nbEnsembles > 1 ? 'مجموعات' : 'مجموعة'} × ${groupe.points} = ${totalPts}`
        : `${nbSourates} sourates dans ${nbEnsembles} ensemble${nbEnsembles > 1 ? 's' : ''} × ${groupe.points} = ${totalPts}`)
    : (lang==='ar'
        ? `${nbEnsembles} ${nbEnsembles > 1 ? 'مجموعات' : 'مجموعة'} × ${groupe.points} = ${totalPts}`
        : `${nbEnsembles} ensemble${nbEnsembles > 1 ? 's' : ''} × ${groupe.points} = ${totalPts}`);

  const validerEdit = async () => {
    const valeur = parseInt(newPoints) || 0;
    if (valeur === groupe.points) { setEditing(false); return; }
    if (valeur <= 0) { setEditing(false); setNewPoints(groupe.points); return; }
    setSavingEdit(true);
    await onUpdatePoints(valeur);
    setSavingEdit(false);
    setEditing(false);
  };

  const annulerEdit = () => {
    setNewPoints(groupe.points);
    setEditing(false);
  };

  return (
    <div style={{
      background: bgPanneau,
      border: `1px solid ${colorMain}30`,
      borderRadius: 10,
      padding:'10px 14px',
      display:'flex', alignItems:'center', gap:12,
    }}>
      <span style={{fontSize:18}}>{isMode3 ? '🎯' : '📦'}</span>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontWeight:700, fontSize:13, color:colorMain, direction:'rtl', fontFamily:"'Tajawal',Arial,sans-serif"}}>
          {titreType}
        </div>
        <div style={{fontSize:11, color:'#666', marginTop:2}}>
          {ensemblesConcernes.map(ens => {
            const niv = niveauObj(ens.niveau_id);
            return niv ? `[${niv.code}] ${ens.nom}` : ens.nom;
          }).join(' · ')}
        </div>
        <div style={{fontSize:10, color:'#888', marginTop:3, fontStyle:'italic'}}>
          {statLabel}
        </div>
      </div>

      {/* Points (editable inline) */}
      {editing ? (
        <div style={{display:'flex', alignItems:'center', gap:4}}>
          <input type="number" min="0" max="9999" value={newPoints} autoFocus
            onChange={e => setNewPoints(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') validerEdit();
              if (e.key === 'Escape') annulerEdit();
            }}
            disabled={savingEdit}
            style={{width:60, padding:'6px', borderRadius:6, border:`1.5px solid ${colorMain}`, fontSize:14, fontWeight:700, textAlign:'center', color:colorMain}} />
          <button onClick={validerEdit} disabled={savingEdit}
            title={lang==='ar' ? 'حفظ' : 'Enregistrer'}
            style={{padding:'4px 8px', background:'#1D9E75', color:'#fff', border:'none', borderRadius:6, cursor: savingEdit ? 'wait' : 'pointer', fontSize:11, fontWeight:700}}>
            {savingEdit ? '...' : '✓'}
          </button>
          <button onClick={annulerEdit} disabled={savingEdit}
            title={lang==='ar' ? 'إلغاء' : 'Annuler'}
            style={{padding:'4px 8px', background:'#fff', color:'#888', border:'0.5px solid #ddd', borderRadius:6, cursor:'pointer', fontSize:11}}>
            ✕
          </button>
        </div>
      ) : (
        <>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:800, fontSize:16, color:colorMain}}>{groupe.points}</div>
            <div style={{fontSize:9, color:'#888'}}>{lang==='ar' ? 'لكل واحد' : '/ unité'}</div>
          </div>
          <button onClick={() => { setNewPoints(groupe.points); setEditing(true); }}
            title={lang==='ar' ? 'تعديل النقاط' : 'Modifier les points'}
            style={{padding:'4px 8px', background:'#fff', color:colorMain, border:`0.5px solid ${colorMain}40`, borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap'}}>
            ✏️ {lang==='ar' ? 'تعديل' : 'Modifier'}
          </button>
          <button onClick={onDeleteGroupe}
            title={lang==='ar' ? 'حذف المجموعة' : 'Supprimer le groupe'}
            style={{padding:'4px 8px', background:'#FCEBEB', color:'#E24B4A', border:'0.5px solid #E24B4A30', borderRadius:6, cursor:'pointer', fontSize:11, whiteSpace:'nowrap'}}>
            🗑 {lang==='ar' ? 'حذف' : 'Supprimer'}
          </button>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// COMPOSANT ConfigSimpleLine — ligne simple pour critere isolé
// (Mode 1 generique : Tomon, Hizb complet, Sourate, Examen, Jalon)
// Avec edit inline des points + bouton supprimer
// ══════════════════════════════════════════════════════
export function ConfigSimpleLine({ config, lang, getConfigLabel, getConfigIcon, onUpdatePoints, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [newPoints, setNewPoints] = useState(config.points);
  const [savingEdit, setSavingEdit] = useState(false);

  const validerEdit = async () => {
    const valeur = parseInt(newPoints) || 0;
    if (valeur === config.points) { setEditing(false); return; }
    if (valeur <= 0) { setEditing(false); setNewPoints(config.points); return; }
    setSavingEdit(true);
    await onUpdatePoints(valeur);
    setSavingEdit(false);
    setEditing(false);
  };

  const annulerEdit = () => {
    setNewPoints(config.points);
    setEditing(false);
  };

  const label = getConfigLabel(config) || '—';
  const icon = getConfigIcon(config) || '⭐';

  return (
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10}}>
      <span style={{fontSize:18}}>{icon}</span>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontWeight:600,fontSize:13,direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{label}</div>
      </div>

      {/* Points editable inline */}
      {editing ? (
        <div style={{display:'flex', alignItems:'center', gap:4}}>
          <input type="number" min="0" max="9999" value={newPoints} autoFocus
            onChange={e => setNewPoints(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') validerEdit();
              if (e.key === 'Escape') annulerEdit();
            }}
            disabled={savingEdit}
            style={{width:60, padding:'6px', borderRadius:6, border:'1.5px solid #378ADD', fontSize:14, fontWeight:700, textAlign:'center', color:'#378ADD'}} />
          <button onClick={validerEdit} disabled={savingEdit}
            title={lang==='ar' ? 'حفظ' : 'Enregistrer'}
            style={{padding:'4px 8px', background:'#1D9E75', color:'#fff', border:'none', borderRadius:6, cursor: savingEdit ? 'wait' : 'pointer', fontSize:11, fontWeight:700}}>
            {savingEdit ? '...' : '✓'}
          </button>
          <button onClick={annulerEdit} disabled={savingEdit}
            title={lang==='ar' ? 'إلغاء' : 'Annuler'}
            style={{padding:'4px 8px', background:'#fff', color:'#888', border:'0.5px solid #ddd', borderRadius:6, cursor:'pointer', fontSize:11}}>
            ✕
          </button>
        </div>
      ) : (
        <>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:800,fontSize:16,color:'#378ADD'}}>{config.points}</div>
            <div style={{fontSize:9, color:'#888'}}>{lang==='ar' ? 'نقطة' : 'pts'}</div>
          </div>
          <button onClick={() => { setNewPoints(config.points); setEditing(true); }}
            title={lang==='ar' ? 'تعديل النقاط' : 'Modifier les points'}
            style={{padding:'4px 8px', background:'#fff', color:'#378ADD', border:'0.5px solid #378ADD40', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap'}}>
            ✏️ {lang==='ar' ? 'تعديل' : 'Modifier'}
          </button>
          <button onClick={onDelete}
            title={lang==='ar' ? 'حذف' : 'Supprimer'}
            style={{padding:'4px 8px',background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',borderRadius:6,cursor:'pointer',fontSize:11,whiteSpace:'nowrap'}}>
            🗑 {lang==='ar' ? 'حذف' : 'Supprimer'}
          </button>
        </>
      )}
    </div>
  );
}
