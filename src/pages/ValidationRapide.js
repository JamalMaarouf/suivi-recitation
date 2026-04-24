import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { withRetryToast } from '../lib/retry';
import { invalidateMany } from '../lib/cache';
import { enqueueOrRun } from '../lib/offlineQueue';
import { swr } from '../lib/offlineCache';
import { calcEtatEleve, getInitiales, scoreLabel, motivationMsg, verifierEtCreerCertificats, isSourateNiveauDyn, loadBareme, BAREME_DEFAUT, getSensForEleve} from '../lib/helpers';
import { notifierParents } from '../lib/notificationsParents';
import { getSouratesForNiveau } from '../lib/sourates';
import { t } from '../lib/i18n';
import { fetchAll } from '../lib/fetchAll';

export default function ValidationRapide({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [eleves, setEleves] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [souratesDB, setSouratesDB] = useState([]);
  const [recitationsSourates, setRecitationsSourates] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [etat, setEtat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const [nbTomon, setNbTomon] = useState(1); // nombre de tomons à valider
  const [bareme, setBareme] = useState(null); // barème de l'école
  const [programmeNiveau, setProgrammeNiveau] = useState([]); // hizbs ou sourates du programme
  const [programmeCharge, setProgrammeCharge] = useState(false); // true quand chargement terminé
  const [currentSourateState, setCurrentSourateState] = useState(null); // calculé après chargement
  const [sourateSelectionnee, setSourateSelectionnee] = useState(null); // sourate choisie
  const [typeRec, setTypeRec] = useState('complete'); // 'complete' ou 'sequence'
  const [versetDebut, setVersetDebut] = useState('');
  const [versetFin, setVersetFin] = useState('');
  const [ecoleConfig, setEcoleConfig] = useState(null);

  const searchRef = useRef();

  useEffect(() => { loadData(); setTimeout(() => searchRef.current?.focus(), 200); }, []);

  const loadData = async () => {
    const ecoleId = user.ecole_id;
    // SWR : affichage immédiat depuis cache IndexedDB + refresh réseau en tâche de fond
    // Chaque swr() appelle onUpdate 1 ou 2 fois : cache puis réseau
    await Promise.all([
      swr(
        `vr_eleves_${ecoleId}`,
        () => supabase.from('eleves').select('*').eq('ecole_id', ecoleId).order('nom'),
        (data) => { if (data) setEleves(data); }
      ).catch(()=>{}),
      swr(
        `vr_validations_${ecoleId}`,
        () => fetchAll(supabase.from('validations').select('*').eq('ecole_id', ecoleId)),
        (data) => { if (data) setAllValidations(data); }
      ).catch(()=>{}),
      swr(
        `vr_niveaux_${ecoleId}`,
        () => supabase.from('niveaux').select('id,code,nom,type,couleur,sens_recitation').eq('ecole_id', ecoleId),
        (data) => { if (data) setNiveaux(data); }
      ).catch(()=>{}),
      swr(
        `vr_sourates`,
        () => supabase.from('sourates').select('*'),
        (data) => { if (data) setSouratesDB(data); }
      ).catch(()=>{}),
      swr(
        `vr_ecole_${ecoleId}`,
        () => supabase.from('ecoles').select('sens_recitation_defaut').eq('id', ecoleId).maybeSingle(),
        (data) => { if (data) setEcoleConfig(data); }
      ).catch(()=>{}),
    ]);
    const b = await loadBareme(supabase, ecoleId);
    setBareme(b);
    setLoading(false);
  };

  const filteredEleves = search.length > 0
    ? eleves.filter(e => `${e.prenom} ${e.nom} ${e.eleve_id_ecole || ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  const selectEleve = async (e) => {
    // Recharger l'eleve frais depuis la DB (ses hizb_depart/tomon_depart peuvent avoir
    // change suite a un passage de niveau). Sinon on calcule a partir de donnees periees.
    let freshEleve = e;
    try {
      const { data: fresh } = await supabase.from('eleves').select('*')
        .eq('id', e.id).maybeSingle();
      if (fresh) freshEleve = fresh;
    } catch (err) { /* on garde l'objet initial */ }

    const vals = allValidations.filter(v => v.eleve_id === freshEleve.id);
    setSelectedEleve(freshEleve);
    const sensEl = getSensForEleve(freshEleve, niveaux, ecoleConfig);
    setEtat(calcEtatEleve(vals, freshEleve.hizb_depart, freshEleve.tomon_depart, sensEl));
    setSearch('');
    setNbTomon(1);
    setSourateSelectionnee(null);
    setTypeRec('complete');
    setVersetDebut(''); setVersetFin('');
    setProgrammeCharge(false);
    // Charger en parallèle récitations + souratesDB + programme
    const [{ data: recs }, { data: sourFresh }] = await Promise.all([
      supabase.from('recitations_sourates').select('*').eq('eleve_id', freshEleve.id).eq('ecole_id', user.ecole_id),
      supabase.from('sourates').select('*'),
    ]);
    // Stocker dans des variables locales pour les utiliser dans currentSourate ci-dessous
    const souratesLocal = sourFresh || [];
    const recitationsLocal = recs || [];
    setSouratesDB(souratesLocal);
    setRecitationsSourates(recitationsLocal);
    // Charger le programme du niveau de l'élève
    let progData = [];
    const { data: niv } = await supabase.from('niveaux').select('id').eq('code', freshEleve.code_niveau).eq('ecole_id', user.ecole_id).maybeSingle();
    if (niv) {
      const { data: prog } = await supabase.from('programmes').select('reference_id,ordre')
        .eq('niveau_id', niv.id).eq('ecole_id', user.ecole_id).order('ordre');
      progData = prog || [];
      setProgrammeNiveau(progData);
    } else {
      setProgrammeNiveau([]);
    }
    setProgrammeCharge(true);
    // Calculer la sourate en cours avec données LOCALES fraîches (évite timing React)
    const isSourateEleve = niveaux.some(n => n.code === freshEleve.code_niveau && n.type === 'sourate');
    if (isSourateEleve && souratesLocal.length > 0) {
      const souratesAcquises = freshEleve.sourates_acquises || 0;
      let souratesOrd;
      if (progData.length > 0) {
        souratesOrd = progData
          .map(p => souratesLocal.find(s => String(s.id) === String(p.reference_id)))
          .filter(Boolean)
          .sort((a, b) => b.numero - a.numero);
      } else {
        souratesOrd = [...souratesLocal].sort((a, b) => b.numero - a.numero);
      }
      const isCompleteLoc = (id) =>
        recitationsLocal.some(r => r.sourate_id === id && r.type_recitation === 'complete');
      const idx = souratesOrd.findIndex((sr, i) => {
        if (i < souratesAcquises) return false;
        return !isCompleteLoc(sr.id);
      });
      setCurrentSourateState(idx >= 0 ? souratesOrd[idx] : null);
    }
  };

  const estSourate = selectedEleve ? isSourateNiveauDyn(selectedEleve.code_niveau, niveaux) : false;

  // Calculer la sourate en cours — même logique que RecitationSourate
  const getDbId = (numero) => souratesDB.find(s => s.numero === numero)?.id;
  const isCompleteNum = (numero) => {
    const dbId = getDbId(numero);
    return dbId ? recitationsSourates.some(r => r.sourate_id === dbId && r.type_recitation === 'complete') : false;
  };

  const currentSourate = programmeCharge ? currentSourateState : null;

  // Vérifier si l'élève a un programme défini
  // Pour sourates : programmeNiveau chargé depuis DB (table programmes)
  // Pour hizbs : hizb_depart défini et > 0
  // Pas de programme = chargement terminé ET programmeNiveau vide
  const aucunProgramme = (() => {
    if (!selectedEleve) return false;
    if (!programmeCharge) return false; // attendre fin du chargement
    if (estSourate) {
      return programmeNiveau.length === 0;
    } else {
      const hd = selectedEleve.hizb_depart;
      return hd === null || hd === undefined;
    }
  })();

  // Vérifier si c'est le dernier hizb du programme (pas forcément Hizb 1)
  const estDernierHizb = (() => {
    if (estSourate || !etat) return false;
    if (programmeNiveau.length === 0) return etat.hizbEnCours === 1; // fallback
    // Programme hizb : reference_id = numéro du hizb, trié par ordre
    // En ordre décroissant, le dernier hizb = celui avec le plus petit numéro
    const hizbsProg = programmeNiveau.map(p => parseInt(p.reference_id)).filter(n => !isNaN(n));
    if (hizbsProg.length === 0) return etat.hizbEnCours === 1;
    const dernierHizb = Math.min(...hizbsProg); // le plus petit numéro = dernier en ordre décroissant
    return etat.hizbEnCours === dernierHizb;
  })();

  // Vérifier si c'est la dernière sourate du programme
  const estDerniereSourate = (() => {
    if (!estSourate || !selectedEleve || !currentSourate) return false;
    const souratesAcquises = selectedEleve.sourates_acquises || 0;
    const souratesNiveau = getSouratesForNiveau(selectedEleve.code_niveau);
    const souratesOrdonnees = [...souratesNiveau].sort((a, b) => b.numero - a.numero);
    // Si programme défini : la dernière = sourate avec le plus petit numéro dans le programme
    if (programmeNiveau.length > 0) {
      const souratesProg = programmeNiveau.map(p => {
        const s = souratesDB.find(sd => sd.id === p.reference_id);
        return s?.numero;
      }).filter(Boolean);
      if (souratesProg.length > 0) {
        const dernierNumero = Math.min(...souratesProg);
        return currentSourate.numero === dernierNumero;
      }
    }
    // Fallback : pas de sourate restante après la courante
    const restantes = souratesOrdonnees.filter((sr, i) => {
      if (i < souratesAcquises) return false;
      if (sr.numero === currentSourate.numero) return false;
      return !isCompleteNum(sr.numero);
    });
    return restantes.length === 0;
  })();

  // Valider N tomons
  const validerTomon = async () => {
    if (!selectedEleve || !etat || saving || etat.enAttenteHizbComplet) return;
    setSaving(true);
    const payload = {
      eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
      nombre_tomon: nbTomon, type_validation: 'tomon',
      date_validation: new Date().toISOString(),
      tomon_debut: etat.prochainTomon, hizb_validation: etat.hizbEnCours
    };
    const res = await enqueueOrRun(supabase, 'validations', 'insert', payload, user.ecole_id);
    const error = res.error;
    const wasQueued = res.status === 'queued';

    if (wasQueued) {
      toast.success(lang === 'ar'
        ? '✓ تم الحفظ (مزامنة تلقائية)'
        : '✓ Enregistré (sync auto)');
    }
    if (!error) {
      const ptsParTomon = bareme?.unites?.tomon || 0;
      const pts = nbTomon * ptsParTomon;
      setFlash({ msg: `✓ ${nbTomon} ثمن · الحزب ${etat.hizbEnCours}`, color: '#1D9E75', pts });
      setTimeout(() => setFlash(null), 2500);
      setSessionLog(prev => [{
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        detail: `${nbTomon} ثمن · الحزب ${etat.hizbEnCours}${wasQueued ? ' 💾' : ''}`, pts,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }, ...prev.slice(0, 9)]);
      // Si online, recharger l'état depuis la base ; sinon, on ajoute l'op localement à etat
      if (!wasQueued) {
        const { data: newVals } = await supabase.from('validations').select('*')
          .eq('ecole_id', user.ecole_id).eq('eleve_id', selectedEleve.id);
        const sensEl = getSensForEleve(selectedEleve, niveaux, ecoleConfig);
        setEtat(calcEtatEleve(newVals || [], selectedEleve.hizb_depart, selectedEleve.tomon_depart, sensEl));
      }
      setNbTomon(1);
      invalidateMany(['validations', 'recitations_sourates_min', `validations_${selectedEleve.id}`, `recitations_eleve_${selectedEleve.id}`], user.ecole_id);
    }
    setSaving(false);
  };

  // Valider hizb complet
  const validerHizb = async () => {
    if (!selectedEleve || !etat || saving || !etat.enAttenteHizbComplet) return;
    setSaving(true);
    const res = await enqueueOrRun(supabase, 'validations', 'insert', {
      eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
      nombre_tomon: 0, type_validation: 'hizb_complet',
      date_validation: new Date().toISOString(), hizb_valide: etat.hizbEnCours
    }, user.ecole_id);
    const error = res.error;
    const wasQueued = res.status === 'queued';

    if (wasQueued) {
      toast.success(lang === 'ar' ? '✓ تم الحفظ (مزامنة تلقائية)' : '✓ Enregistré (sync auto)');
    }
    if (!error) {
      const ptsHizb = bareme?.unites?.hizb_complet || 0;
      setFlash({ msg: `🎉 الحزب ${etat.hizbEnCours} مكتمل !${wasQueued ? ' 💾' : ''}`, color: '#EF9F27', pts: ptsHizb });
      setTimeout(() => setFlash(null), 2500);
      setSessionLog(prev => [{
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        detail: `الحزب ${etat.hizbEnCours} مكتمل${wasQueued ? ' 💾' : ''}`, pts: ptsHizb,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }, ...prev.slice(0, 9)]);
      if (!wasQueued) {
        const { data: newVals } = await supabase.from('validations').select('*')
          .eq('ecole_id', user.ecole_id).eq('eleve_id', selectedEleve.id);
        const sensEl = getSensForEleve(selectedEleve, niveaux, ecoleConfig);
        setEtat(calcEtatEleve(newVals || [], selectedEleve.hizb_depart, selectedEleve.tomon_depart, sensEl));
        try {
          const nouveauxCerts = await verifierEtCreerCertificats(supabase, {
            eleve: selectedEleve, ecole_id: user.ecole_id, valide_par: user.id,
            validations: newVals || [], recitations: [],
          });
          if (nouveauxCerts && nouveauxCerts.length > 0) {
            setTimeout(() => setFlash({ msg: `🏅 ${(nouveauxCerts||[]).map(c => c.nom_certificat).join(', ')} !`, color: '#EF9F27', pts: 0 }), 2600);
            setTimeout(() => setFlash(null), 6000);
            // NOTIF PARENTS : certificats obtenus
            for (const c of nouveauxCerts) {
              notifierParents({
                type: 'certificat_obtenu',
                eleve: { id: selectedEleve.id, prenom: selectedEleve.prenom, nom: selectedEleve.nom, ecole_id: user.ecole_id },
                donnees: { certificat_nom: c.nom_certificat, certificat_nom_ar: c.nom_certificat_ar || null, jalon_id: c.jalon_id || null, date: c.date_obtention },
              }).catch(e => console.warn('[notif cert express] async error', e));
            }
          }
        } catch (e) { /* silencieux */ }
      }
      // NOTIF PARENTS : validation Hizb complet via Express
      if (!wasQueued) {
        notifierParents({
          type: 'hizb_complet',
          eleve: { id: selectedEleve.id, prenom: selectedEleve.prenom, nom: selectedEleve.nom, ecole_id: user.ecole_id },
          donnees: { hizb_num: etat.hizbEnCours, date: new Date().toISOString() },
        }).catch(e => console.warn('[notif hizb express] async error', e));
      }
      invalidateMany(['validations', 'recitations_sourates_min', `validations_${selectedEleve.id}`, `recitations_eleve_${selectedEleve.id}`], user.ecole_id);
    }
    setSaving(false);
  };

  // Valider une sourate (complète ou séquence)
  const validerSourate = async () => {
    if (!selectedEleve || saving || !sourateSelectionnee) return;
    if (typeRec === 'sequence' && (!versetDebut || !versetFin)) return;
    setSaving(true);

    // Trouver l'id Supabase par numero
    let sourateId = souratesDB.find(s => s.numero === sourateSelectionnee.numero)?.id;
    if (!sourateId) {
      const { data: freshSour } = await supabase.from('sourates')
        .select('id,numero').eq('numero', sourateSelectionnee.numero).single();
      sourateId = freshSour?.id;
    }
    if (!sourateId) { setSaving(false); return; }

    const ptsComplet = bareme?.unites?.sourate || 0;
    const ptsSequence = bareme?.unites?.sequence_sourate || 0;
    const pts = typeRec === 'complete' ? ptsComplet : ptsSequence;

    const res = await enqueueOrRun(supabase, 'recitations_sourates', 'insert', {
      eleve_id: selectedEleve.id, ecole_id: user.ecole_id, valide_par: user.id,
      sourate_id: sourateId, type_recitation: typeRec,
      verset_debut: typeRec === 'sequence' ? parseInt(versetDebut) : null,
      verset_fin: typeRec === 'sequence' ? parseInt(versetFin) : null,
      date_validation: new Date().toISOString(), points: pts,
    }, user.ecole_id);
    const error = res.error;
    const wasQueued = res.status === 'queued';

    if (wasQueued) {
      toast.success(lang === 'ar' ? '✓ تم الحفظ (مزامنة تلقائية)' : '✓ Enregistré (sync auto)');
    }

    if (error) {
      setFlash({ msg: `❌ ${error.message}`, color: '#E24B4A', pts: 0 });
      setTimeout(() => setFlash(null), 4000);
    } else {
      const detail = typeRec === 'complete'
        ? sourateSelectionnee.nom_ar
        : `${sourateSelectionnee.nom_ar} (V.${versetDebut}→${versetFin})`;
      setFlash({ msg: `✓ ${detail}`, color: typeRec === 'complete' ? '#EF9F27' : '#1D9E75', pts });
      setTimeout(() => setFlash(null), 2500);
      setSessionLog(prev => [{
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`, detail, pts,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      }, ...prev.slice(0, 9)]);
      setSourateSelectionnee(null); setTypeRec('complete');
      setVersetDebut(''); setVersetFin('');
      const { data: newRecs } = await supabase.from('recitations_sourates')
        .select('*').eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id);
      const newRecsData = newRecs || [];
      setRecitationsSourates(newRecsData);
      // Vérifier si un jalon/certificat est débloqué
      const { data: valsForCert } = await supabase.from('validations').select('*')
        .eq('eleve_id', selectedEleve.id).eq('ecole_id', user.ecole_id);
      const nouveauxCertsSourate = await verifierEtCreerCertificats(supabase, {
        eleve: selectedEleve, ecole_id: user.ecole_id, valide_par: user.id,
        validations: valsForCert || [], recitations: newRecsData,
      });
      if (nouveauxCertsSourate.length > 0) {
        setTimeout(() => setFlash({ msg: `🏅 ${(nouveauxCertsSourate||[]).map(c => c.nom_certificat_ar||c.nom_certificat).join(', ')} !`, color: '#EF9F27', pts: 0 }), 2600);
        setTimeout(() => setFlash(null), 6000);
      }
      // Recalculer la sourate suivante
      const isCompleteLoc2 = (id) =>
        newRecsData.some(r => r.sourate_id === id && r.type_recitation === 'complete');
      const souratesAcquises2 = selectedEleve.sourates_acquises || 0;
      const souratesOrd2 = programmeNiveau.length > 0
        ? programmeNiveau.map(p => souratesDB.find(s => String(s.id) === String(p.reference_id))).filter(Boolean).sort((a,b) => b.numero - a.numero)
        : [...souratesDB].sort((a,b) => b.numero - a.numero);
      const idx2 = souratesOrd2.findIndex((sr, i) => {
        if (i < souratesAcquises2) return false;
        return !isCompleteLoc2(sr.id);
      });
      setCurrentSourateState(idx2 >= 0 ? souratesOrd2[idx2] : null);
    }
    setSaving(false);
  };

  const sl = selectedEleve && etat ? scoreLabel(etat.points.total) : null;
  const nc = selectedEleve ? ({ '5B': '#534AB7', '5A': '#378ADD', '2M': '#1D9E75', '2': '#EF9F27', '1': '#E24B4A' }[selectedEleve.code_niveau] || '#888') : '#888';

  // ── PC ───────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: isMobile?80:0, background: isMobile?'#f5f5f0':'transparent', minHeight: isMobile?'100vh':'auto' }}>
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
      {isMobile ? (
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 16px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:4}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:'#fff'}}>⚡ {lang==='ar'?'استظهار سريع':'Validation express'}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.75)'}}>{lang==='ar'?'ابحث وسجّل بنقرتين':'Trouvez et validez en 2 clics'}</div>
            </div>
          </div>
        </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', padding:'1rem 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}></button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#085041' }}>⚡ {lang === 'ar' ? 'تسجيل سريع' : 'Validation express'}</div>
            <div style={{ fontSize: 12, color: '#aaa' }}>{lang === 'ar' ? 'ابحث عن طالب وسجّل استظهاره بنقرتين' : 'Trouvez un élève et validez en 2 clics'}</div>
          </div>
        </div>
      </div>
      )}

      {/* Barre de recherche */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', padding: isMobile?'0 12px':0 }}>
        <input ref={searchRef} className="field-input"
          style={{ fontSize: 15, padding: '13px 16px 13px 44px' }}
          placeholder={`🔍 ${lang === 'ar' ? 'ابحث بالاسم أو رقم التعريف...' : 'Nom ou numéro élève...'}`}
          value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
        {filteredEleves.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
            border: '0.5px solid #e0e0d8', borderRadius: '0 0 14px 14px', zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {(filteredEleves||[]).map(e => {
              const vals = allValidations.filter(v => v.eleve_id === e.id);
              const sensEl = getSensForEleve(e, niveaux, ecoleConfig);
              const et = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart, sensEl);
              const isSour = isSourateNiveauDyn(e.code_niveau, niveaux);
              const nivColor = ({ '5B': '#534AB7', '5A': '#378ADD', '2M': '#1D9E75', '2': '#EF9F27', '1': '#E24B4A' }[e.code_niveau] || '#888');
              return (
                <div key={e.id} onTouchEnd={()=>selectEleve(e)} onClick={() => selectEleve(e)}
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
          <div style={{ background: `linear-gradient(135deg,#085041,#1D9E75)`, padding: '16px 20px',
            borderBottom: `1px solid ${nc}20`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(135deg,#085041,#1D9E75)`,
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
            {/* ── Pas de programme ── */}
            {aucunProgramme && (
              <div style={{ textAlign:'center', padding:'1.5rem', background:'#FCEBEB',
                borderRadius:12, border:'1px solid #E24B4A20' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#E24B4A', marginBottom:4 }}>
                  {lang==='ar'?'لا يوجد برنامج لهذا الطالب':'Aucun programme défini pour cet élève'}
                </div>
                <div style={{ fontSize:12, color:'#888' }}>
                  {lang==='ar'?'يرجى إعداد البرنامج من الإدارة  المستويات':'Configurez le programme dans الإدارة → المستويات'}
                </div>
              </div>
            )}
            {/* ── Élève HIZB ── */}
            {!estSourate && !aucunProgramme && (
              <>
                {etat.enAttenteHizbComplet ? (
                  /* Validation hizb complet */
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: '#FAEEDA', borderRadius: 12, padding: '14px', marginBottom: 16,
                      fontSize: 14, color: '#633806', fontWeight: 600 }}>
                      🎉 {lang === 'ar' ? `الحزب ${etat.hizbEnCours} مكتمل — انتظار التصحيح` : `Hizb ${etat.hizbEnCours} complet — en attente de validation`}
                    </div>
                    <button onClick={validerHizb} disabled={saving}
                      style={{ width: '100%', padding: '16px', background: saving ? '#ccc' : 'linear-gradient(135deg,#085041,#1D9E75)',
                        color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 3px 12px rgba(239,159,39,0.4)', fontFamily: 'inherit' }}>
                      {saving ? '...' : `✓ ${lang === 'ar' ? `تصحيح الحزب ${etat.hizbEnCours}` : `Valider Hizb ${etat.hizbEnCours}`}${(bareme?.unites?.hizb_complet||0)>0?` (+${bareme.unites.hizb_complet} ${t(lang,'pts_abrev')})`:''}`}
                    </button>
                  </div>
                ) : (
                  /* Validation tomons */
                  <div>
                    {/* Avertissement dernier hizb */}
                    {estDernierHizb && (
                      <div style={{ background:'#FAEEDA', borderRadius:10, padding:'10px 14px',
                        marginBottom:12, fontSize:12, color:'#633806', textAlign:'center', fontWeight:600 }}>
                        ⚠️ {lang==='ar'
                          ? 'هذا آخر حزب في البرنامج — تأكد من صحة الاستظهار قبل التسجيل'
                          : 'Dernier hizb du programme — vérifiez avant de valider'}
                      </div>
                    )}

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
                      style={{ width: '100%', padding: '15px', background: saving ? '#ccc' : `linear-gradient(135deg,#085041,#1D9E75)`,
                        color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800,
                        cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                        boxShadow: saving ? 'none' : `0 3px 12px ${nc}40`, transition: 'all 0.15s' }}>
                      {saving ? '...' : `✓ ${lang === 'ar' ? `تسجيل ${nbTomon} ثمن` : `Valider ${nbTomon} tomon${nbTomon > 1 ? 's' : ''}`}`}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Élève SOURATES — affiche la sourate en cours directement ── */}
            {estSourate && !sourateSelectionnee && !aucunProgramme && (
              <div>
                {currentSourate ? (
                  <>
                    {/* Info sourate en cours */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14,
                      padding:'12px 14px', background:`${nc}08`, borderRadius:12, border:`1px solid ${nc}20` }}>
                      <div style={{ lineHeight:1.2, flex:1 }}>
                        <div style={{ fontSize:11, color:'#aaa', marginBottom:3 }}>
                          {lang==='ar'?'السورة في الدور:':'Sourate en cours :'}
                        </div>
                        <div style={{ fontSize:17, fontWeight:900, color:'#1a1a1a', direction:'rtl' }}>
                          {currentSourate.nom_ar}
                        </div>
                        <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>
                          {lang==='ar'?'رقم':'N°'} {currentSourate.numero} · {currentSourate.nb_versets} {lang==='ar'?'آية':'versets'}
                        </div>
                      </div>
                      <div style={{ width:44, height:44, borderRadius:10, background:`${nc}15`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:16, fontWeight:900, color:nc, flexShrink:0 }}>
                        {currentSourate.numero}
                      </div>
                    </div>

                {/* Avertissement dernière sourate */}
                {estDerniereSourate && (
                  <div style={{ background:'#FAEEDA', borderRadius:10, padding:'10px 14px',
                    marginBottom:12, fontSize:12, color:'#633806', textAlign:'center', fontWeight:600 }}>
                    ⚠️ {lang==='ar'
                      ? 'هذه آخر سورة في البرنامج — تأكد من صحة الاستظهار قبل التسجيل'
                      : 'Dernière sourate du programme — vérifiez avant de valider'}
                  </div>
                )}

                    {/* Choix : complète ou séquence */}
                    <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                      {[
                        { val:'complete', label:lang==='ar'?'كاملة':'Complète', pts:bareme?.unites?.sourate||0, icon:'🎯' },
                        { val:'sequence', label:lang==='ar'?'مقطع':'Séquence', pts:bareme?.unites?.sequence_sourate||0, icon:'📌' },
                      ].map(opt => (
                        <button key={opt.val} onClick={() => { setTypeRec(opt.val); setSourateSelectionnee(currentSourate); }}
                          style={{ flex:1, padding:'12px 8px', borderRadius:12, cursor:'pointer',
                            border:`2px solid ${nc}30`, background:`${nc}08`,
                            fontFamily:"'Tajawal',Arial,sans-serif", transition:'all 0.15s' }}
                          onMouseEnter={ev=>{ev.currentTarget.style.background=`${nc}15`;ev.currentTarget.style.border=`2px solid ${nc}60`;}}
                          onMouseLeave={ev=>{ev.currentTarget.style.background=`${nc}08`;ev.currentTarget.style.border=`2px solid ${nc}30`;}}>
                          <div style={{ fontSize:20, marginBottom:4 }}>{opt.icon}</div>
                          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>{opt.label}</div>
                          {opt.pts > 0 && <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>+{opt.pts} {t(lang,'pts_abrev')}</div>}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign:'center', padding:'2rem' }}>
                    {souratesDB.length === 0 ? (
                      <div style={{ color:'#aaa', fontSize:13 }}>...</div>
                    ) : (
                      <>
                        <div style={{ fontSize:32, marginBottom:8 }}>🎉</div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#085041' }}>
                          {lang==='ar'?'أحسنت! تم الانتهاء من جميع سور البرنامج':'Programme complété !'}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Confirmation sourate ── */}
            {estSourate && sourateSelectionnee && !aucunProgramme && (
              <div>
                {/* Sourate sélectionnée */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  background: `${nc}12`, borderRadius: 12, marginBottom: 14,
                  border: `1.5px solid ${nc}30` }}>
                  <span style={{ fontSize: 11, color: nc, fontWeight: 700, background: `${nc}20`,
                    padding: '2px 8px', borderRadius: 8 }}>{sourateSelectionnee.numero}</span>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: '#1a1a1a', direction: 'rtl' }}>
                    {sourateSelectionnee.nom_ar}
                  </span>
                  <button onClick={() => setSourateSelectionnee(null)}
                    style={{ fontSize: 13, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Type : complète ou séquence */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {[
                    { val: 'complete', label: lang==='ar'?'كاملة':'Complète', pts: bareme?.unites?.sourate || 0, icon: '🎯' },
                    { val: 'sequence', label: lang==='ar'?'مقطع':'Séquence', pts: bareme?.unites?.sequence_sourate || 0, icon: '📌' },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setTypeRec(opt.val)}
                      style={{ flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                        border: `2px solid ${typeRec === opt.val ? nc : '#e0e0d8'}`,
                        background: typeRec === opt.val ? `${nc}12` : '#f9f9f6',
                        fontFamily: "'Tajawal',Arial,sans-serif", transition: 'all 0.15s' }}>
                      <div style={{ fontSize: 16 }}>{opt.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: typeRec === opt.val ? nc : '#555' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>+{opt.pts} {t(lang, 'pts_abrev')}</div>
                    </button>
                  ))}
                </div>

                {/* Versets si séquence */}
                {typeRec === 'sequence' && (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <label className="field-lbl">{lang==='ar'?'من الآية':'Verset début'}</label>
                      <input className="field-input" type="number" min="1" max={sourateSelectionnee.nb_versets}
                        value={versetDebut} onChange={e => setVersetDebut(e.target.value)}
                        placeholder="1" style={{ textAlign: 'center' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="field-lbl">{lang==='ar'?'إلى الآية':'Verset fin'}</label>
                      <input className="field-input" type="number" min="1" max={sourateSelectionnee.nb_versets}
                        value={versetFin} onChange={e => setVersetFin(e.target.value)}
                        placeholder={String(sourateSelectionnee.nb_versets)} style={{ textAlign: 'center' }} />
                    </div>
                  </div>
                )}

                {/* Bouton valider */}
                <button onClick={validerSourate}
                  disabled={saving || (typeRec === 'sequence' && (!versetDebut || !versetFin))}
                  style={{ width: '100%', padding: '15px',
                    background: (saving || (typeRec === 'sequence' && (!versetDebut || !versetFin)))
                      ? '#e0e0d8' : `linear-gradient(135deg,#085041,#1D9E75)`,
                    color: (saving || (typeRec === 'sequence' && (!versetDebut || !versetFin))) ? '#aaa' : '#fff',
                    border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: saving ? 'none' : `0 3px 12px ${nc}40` }}>
                  {saving ? '...' : `✓ ${lang==='ar'?'تسجيل':'Valider'} ${typeRec==='complete'?(lang==='ar'?'السورة كاملة':'sourate complète'):(lang==='ar'?'المقطع':'la séquence')}`}
                </button>
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
