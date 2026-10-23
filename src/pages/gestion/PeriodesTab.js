import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

// Modele : Annee scolaire = container, periodes attachees a une annee
// Q1=A : 1 seule annee active a la fois
// Q3=B : Cloture manuelle puis activation manuelle
// Q5=C : Bandeau si pas d'annee active + Semaine/Mois/Personnalisee dispo
// ══════════════════════════════════════════════════════
export function PeriodesTab({ user, lang, showMsg }) {
  // States locaux (le state global periodes/newPeriode n'est plus utilise)
  const [annees, setAnnees] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // UI : annee selectionnee (par defaut active, sinon premiere)
  const [selectedAnneeId, setSelectedAnneeId] = useState(null);
  // Modale creation/edition annee
  const [showAnneeForm, setShowAnneeForm] = useState(false);
  const [editingAnneeId, setEditingAnneeId] = useState(null);
  const [formAnnee, setFormAnnee] = useState({ nom: '', date_debut: '', date_fin: '' });
  // Modale creation periode
  const [showPeriodeForm, setShowPeriodeForm] = useState(false);
  const [editingPeriodeId, setEditingPeriodeId] = useState(null);
  const [formPeriode, setFormPeriode] = useState({ nom_ar: '', date_debut: '', date_fin: '', type: 'trimestre' });
  // Modale generique de confirmation (Etape 14 v2)
  const [confirmModale, setConfirmModale] = useState(null); // {titre, message, onConfirm, danger}

  // Etape 14 v2 - L'annee scolaire (annees_scolaires) sert directement comme
  // periode 'Annee' dans les selecteurs. Le type 'annee' n'est plus propose
  // a la creation pour eviter la redondance, mais reste affichable pour
  // les anciennes periodes (retrocompatibilite).
  const TYPE_OPTIONS_AFFICHAGE = [
    { val: 'trimestre', icon: '🗓️', label_fr: 'Trimestre',  label_ar: 'فصل دراسي',   color: '#378ADD' },
    { val: 'semestre',  icon: '📆', label_fr: 'Semestre',   label_ar: 'نصف سنة',     color: '#085041' },
    { val: 'annee',     icon: '📚', label_fr: 'Année',      label_ar: 'سنة كاملة',  color: '#EF9F27' },
    { val: 'libre',     icon: '📅', label_fr: 'Libre',      label_ar: 'حر',          color: '#888'    },
  ];
  // Options proposees a la creation : sans 'annee' (Q3=A)
  const TYPE_OPTIONS = TYPE_OPTIONS_AFFICHAGE.filter(o => o.val !== 'annee');
  const getTypeMeta = (t) => TYPE_OPTIONS_AFFICHAGE.find(o => o.val === (t || 'libre')) || TYPE_OPTIONS_AFFICHAGE[3];

  const fmt = (d) => d ? new Date(d).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR', {day:'2-digit', month:'short', year:'numeric'}) : '—';

  // ──────────────────────────────────────────────
  // Chargement initial
  // ──────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    const [aRes, pRes] = await Promise.all([
      supabase.from('annees_scolaires').select('*').eq('ecole_id', user.ecole_id).order('date_debut', { ascending: false }),
      supabase.from('periodes_notes').select('*').eq('ecole_id', user.ecole_id).order('date_debut', { ascending: true }),
    ]);
    const anneesArr = aRes.data || [];
    setAnnees(anneesArr);
    setPeriodes(pRes.data || []);
    // Selection : annee active si existe, sinon premiere disponible
    if (!selectedAnneeId) {
      const active = anneesArr.find(a => a.statut === 'active');
      setSelectedAnneeId(active ? active.id : (anneesArr[0]?.id || null));
    }
    setLoading(false);
  };

  React.useEffect(() => { loadData(); }, [user.ecole_id]);

  const anneeActive = annees.find(a => a.statut === 'active');
  const anneeSelectionnee = annees.find(a => a.id === selectedAnneeId) || null;
  const periodesAnneeSelectionnee = periodes.filter(p => p.annee_scolaire_id === selectedAnneeId);
  const anneesArchivees = annees.filter(a => a.statut === 'archivee');
  const anneesAVenir = annees.filter(a => a.statut === 'a_venir');

  // ──────────────────────────────────────────────
  // CRUD Annee
  // ──────────────────────────────────────────────
  const ouvrirCreationAnnee = () => {
    setEditingAnneeId(null);
    // Suggestion nom : 2026-2027 base sur today
    const today = new Date();
    const yearBase = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
    setFormAnnee({
      nom: `${yearBase}-${yearBase+1}`,
      date_debut: `${yearBase}-09-01`,
      date_fin: `${yearBase+1}-06-30`,
    });
    setShowAnneeForm(true);
  };

  const ouvrirEditionAnnee = (annee) => {
    setEditingAnneeId(annee.id);
    setFormAnnee({
      nom: annee.nom,
      date_debut: annee.date_debut,
      date_fin: annee.date_fin,
    });
    setShowAnneeForm(true);
  };

  const sauvegarderAnnee = async () => {
    if (!formAnnee.nom.trim()) return showMsg('error', lang==='ar'?'الاسم مطلوب':'Nom requis');
    if (!formAnnee.date_debut || !formAnnee.date_fin) return showMsg('error', lang==='ar'?'التواريخ مطلوبة':'Dates requises');
    if (new Date(formAnnee.date_debut) >= new Date(formAnnee.date_fin)) return showMsg('error', lang==='ar'?'التواريخ غير صحيحة':'Dates invalides');
    setSaving(true);
    try {
      let savedId;
      if (editingAnneeId) {
        const { error } = await supabase.from('annees_scolaires').update({
          nom: formAnnee.nom.trim(),
          date_debut: formAnnee.date_debut,
          date_fin: formAnnee.date_fin,
        }).eq('id', editingAnneeId);
        if (error) throw error;
        savedId = editingAnneeId;
      } else {
        const { data, error } = await supabase.from('annees_scolaires').insert({
          ecole_id: user.ecole_id,
          nom: formAnnee.nom.trim(),
          date_debut: formAnnee.date_debut,
          date_fin: formAnnee.date_fin,
          statut: 'a_venir',
        }).select().single();
        if (error) throw error;
        savedId = data.id;
      }
      setShowAnneeForm(false);
      setSelectedAnneeId(savedId);
      await loadData();
      showMsg('success', lang==='ar'?'✅ تم الحفظ':'✅ Enregistré');
    } catch (err) {
      console.error('[sauvegarderAnnee]', err);
      showMsg('error', (lang==='ar'?'فشل: ':'Erreur : ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const activerAnnee = (annee) => {
    setConfirmModale({
      titre: lang==='ar'?'تفعيل السنة':'Activer l\'année',
      message: lang==='ar'
        ? `تفعيل '${annee.nom}'؟ سيتم أرشفة السنة الحالية تلقائياً.`
        : `Activer '${annee.nom}' ? L'année active actuelle sera archivée.`,
      action: lang==='ar'?'تفعيل':'Activer',
      danger: false,
      onConfirm: async () => {
        setSaving(true);
        try {
          if (anneeActive) {
            await supabase.from('annees_scolaires').update({ statut: 'archivee' }).eq('id', anneeActive.id);
          }
          const { error } = await supabase.from('annees_scolaires').update({ statut: 'active' }).eq('id', annee.id);
          if (error) throw error;
          try {
            await supabase.from('audit_log').insert({
              actor_user_id: user.id, actor_role: user.role || 'surveillant',
              action: 'annee_scolaire.activee', target_type: 'annees_scolaires',
              target_id: annee.id, target_label: annee.nom,
              metadata: { ecole_id: user.ecole_id, archived: anneeActive?.id || null },
            });
          } catch(e) { console.warn('[activerAnnee] audit:', e); }
          await loadData();
          showMsg('success', lang==='ar'?`✅ السنة ${annee.nom} نشطة الآن`:`✅ Année ${annee.nom} activée`);
          setConfirmModale(null);
        } catch (err) {
          console.error('[activerAnnee]', err);
          showMsg('error', (lang==='ar'?'فشل: ':'Erreur : ') + err.message);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const cloturerAnnee = () => {
    if (!anneeActive) return;
    setConfirmModale({
      titre: lang==='ar'?'إغلاق السنة':'Clôturer l\'année',
      message: lang==='ar'
        ? `إغلاق السنة '${anneeActive.nom}'؟ ستصبح للقراءة فقط.`
        : `Clôturer l'année '${anneeActive.nom}' ? Elle deviendra lecture seule.`,
      action: lang==='ar'?'إغلاق':'Clôturer',
      danger: false,
      onConfirm: async () => {
        setSaving(true);
        try {
          const { error } = await supabase.from('annees_scolaires').update({ statut: 'archivee' }).eq('id', anneeActive.id);
          if (error) throw error;
          try {
            await supabase.from('audit_log').insert({
              actor_user_id: user.id, actor_role: user.role || 'surveillant',
              action: 'annee_scolaire.archivee', target_type: 'annees_scolaires',
              target_id: anneeActive.id, target_label: anneeActive.nom,
              metadata: { ecole_id: user.ecole_id },
            });
          } catch(e) { console.warn('[cloturerAnnee] audit:', e); }
          await loadData();
          showMsg('success', lang==='ar'?'✅ تم الإغلاق':'✅ Année clôturée');
          setConfirmModale(null);
        } catch (err) {
          console.error('[cloturerAnnee]', err);
          showMsg('error', (lang==='ar'?'فشل: ':'Erreur : ') + err.message);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const supprimerAnnee = (annee) => {
    if (annee.statut === 'active') {
      return showMsg('error', lang==='ar'?'لا يمكن حذف السنة النشطة':'Impossible de supprimer l\'année active');
    }
    const nbPeriodes = periodes.filter(p => p.annee_scolaire_id === annee.id).length;
    setConfirmModale({
      titre: lang==='ar'?'حذف السنة':'Supprimer l\'année',
      message: lang==='ar'
        ? `حذف '${annee.nom}' و ${nbPeriodes} فترات؟ لا يمكن التراجع.`
        : `Supprimer '${annee.nom}' et ses ${nbPeriodes} périodes ? Action irréversible.`,
      action: lang==='ar'?'حذف':'Supprimer',
      danger: true,
      onConfirm: async () => {
        setSaving(true);
        try {
          const { error } = await supabase.from('annees_scolaires').delete().eq('id', annee.id);
          if (error) throw error;
          if (selectedAnneeId === annee.id) setSelectedAnneeId(null);
          await loadData();
          showMsg('success', lang==='ar'?'✅ تم الحذف':'✅ Supprimé');
          setConfirmModale(null);
        } catch (err) {
          console.error('[supprimerAnnee]', err);
          showMsg('error', (lang==='ar'?'فشل: ':'Erreur : ') + err.message);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const preparerAnneeSuivante = () => {
    if (!anneeActive) {
      return showMsg('error', lang==='ar'?'لا توجد سنة نشطة لنسخها':'Aucune année active à recopier');
    }
    const periodesActives = periodes.filter(p => p.annee_scolaire_id === anneeActive.id);
    if (periodesActives.length === 0) {
      return showMsg('error', lang==='ar'?'السنة النشطة بدون فترات':'L\'année active n\'a aucune période');
    }
    const ajouterUnAn = (iso) => {
      const d = new Date(iso); d.setFullYear(d.getFullYear()+1);
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${dd}`;
    };
    const remplacerAnnee = (nom) => (nom||'').replace(/(\d{4})-(\d{4})/, (m,a,b)=>`${parseInt(a)+1}-${parseInt(b)+1}`).replace(/(\d{4})/, (m,a)=>`${parseInt(a)+1}`);
    const nouveauNom = remplacerAnnee(anneeActive.nom);
    setConfirmModale({
      titre: lang==='ar'?'تحضير السنة المقبلة':'Préparer l\'année suivante',
      message: lang==='ar'
        ? `إنشاء '${nouveauNom}' مع ${periodesActives.length} فترات منسوخة (+1 سنة)؟`
        : `Créer '${nouveauNom}' avec ${periodesActives.length} périodes recopiées (+1 an) ?`,
      action: lang==='ar'?'تحضير':'Préparer',
      danger: false,
      onConfirm: async () => {
        setSaving(true);
        try {
          const { data: newAnnee, error: errA } = await supabase.from('annees_scolaires').insert({
            ecole_id: user.ecole_id,
            nom: nouveauNom,
            date_debut: ajouterUnAn(anneeActive.date_debut),
            date_fin: ajouterUnAn(anneeActive.date_fin),
            statut: 'a_venir',
          }).select().single();
          if (errA) throw errA;
          const nouvellesPeriodes = periodesActives.map(p => ({
            ecole_id: user.ecole_id,
            annee_scolaire_id: newAnnee.id,
            nom: remplacerAnnee(p.nom),
            nom_ar: remplacerAnnee(p.nom_ar || p.nom),
            date_debut: ajouterUnAn(p.date_debut),
            date_fin: ajouterUnAn(p.date_fin),
            type: p.type,
            actif: true,
          }));
          const { error: errP } = await supabase.from('periodes_notes').insert(nouvellesPeriodes);
          if (errP) throw errP;
          try {
            await supabase.from('audit_log').insert({
              actor_user_id: user.id, actor_role: user.role || 'surveillant',
              action: 'annee_scolaire.preparee', target_type: 'annees_scolaires',
              target_id: newAnnee.id, target_label: nouveauNom,
              metadata: { ecole_id: user.ecole_id, periodes_recopiees: nouvellesPeriodes.length },
            });
          } catch(e) { console.warn('[preparerAnnee] audit:', e); }
          setSelectedAnneeId(newAnnee.id);
          await loadData();
          showMsg('success', lang==='ar'
            ? `🎉 ${nouveauNom} مع ${nouvellesPeriodes.length} فترات`
            : `🎉 ${nouveauNom} créée avec ${nouvellesPeriodes.length} périodes`);
          setConfirmModale(null);
        } catch (err) {
          console.error('[preparerAnnee]', err);
          showMsg('error', (lang==='ar'?'فشل: ':'Erreur : ') + err.message);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // ──────────────────────────────────────────────
  // CRUD Periode
  // ──────────────────────────────────────────────
  const ouvrirCreationPeriode = () => {
    if (!anneeSelectionnee) return showMsg('error', lang==='ar'?'اختر سنة أولاً':'Sélectionnez une année');
    setEditingPeriodeId(null);
    // Pre-rempli dates avec celles de l'annee
    setFormPeriode({
      nom_ar: '',
      date_debut: anneeSelectionnee.date_debut,
      date_fin: anneeSelectionnee.date_fin,
      type: 'trimestre',
    });
    setShowPeriodeForm(true);
  };

  const ouvrirEditionPeriode = (p) => {
    setEditingPeriodeId(p.id);
    setFormPeriode({
      nom_ar: p.nom_ar || p.nom || '',
      date_debut: p.date_debut,
      date_fin: p.date_fin,
      type: p.type || 'libre',
    });
    setShowPeriodeForm(true);
  };

  const sauvegarderPeriode = async () => {
    if (!formPeriode.nom_ar.trim()) return showMsg('error', lang==='ar'?'الاسم مطلوب':'Nom requis');
    if (!formPeriode.date_debut || !formPeriode.date_fin) return showMsg('error', lang==='ar'?'التواريخ مطلوبة':'Dates requises');
    if (new Date(formPeriode.date_debut) >= new Date(formPeriode.date_fin)) return showMsg('error', lang==='ar'?'التواريخ غير صحيحة':'Dates invalides');
    // Detection doublon par DATES dans la meme annee
    const doublons = periodes.filter(p =>
      p.annee_scolaire_id === selectedAnneeId &&
      p.id !== editingPeriodeId &&
      p.date_debut === formPeriode.date_debut &&
      p.date_fin === formPeriode.date_fin
    );
    if (doublons.length > 0) {
      return showMsg('error', lang==='ar'
        ? `⚠️ توجد فترة بنفس التواريخ: ${doublons[0].nom_ar||doublons[0].nom}`
        : `⚠️ Période existante avec ces dates : ${doublons[0].nom_ar||doublons[0].nom}`);
    }
    setSaving(true);
    try {
      const payload = {
        ecole_id: user.ecole_id,
        annee_scolaire_id: selectedAnneeId,
        nom: formPeriode.nom_ar.trim(),
        nom_ar: formPeriode.nom_ar.trim(),
        date_debut: formPeriode.date_debut,
        date_fin: formPeriode.date_fin,
        type: formPeriode.type,
        actif: true,
      };
      if (editingPeriodeId) {
        const { error } = await supabase.from('periodes_notes').update(payload).eq('id', editingPeriodeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('periodes_notes').insert(payload);
        if (error) throw error;
      }
      setShowPeriodeForm(false);
      await loadData();
      showMsg('success', lang==='ar'?'✅ تم الحفظ':'✅ Enregistré');
    } catch (err) {
      console.error('[sauvegarderPeriode]', err);
      showMsg('error', (lang==='ar'?'فشل: ':'Erreur : ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const supprimerPeriode = (p) => {
    setConfirmModale({
      titre: lang==='ar'?'حذف الفترة':'Supprimer la période',
      message: lang==='ar'?`حذف '${p.nom_ar||p.nom}'؟`:`Supprimer '${p.nom_ar||p.nom}' ?`,
      action: lang==='ar'?'حذف':'Supprimer',
      danger: true,
      onConfirm: async () => {
        setSaving(true);
        try {
          await supabase.from('periodes_notes').delete().eq('id', p.id);
          await loadData();
          showMsg('success', lang==='ar'?'✅ تم الحذف':'✅ Supprimé');
          setConfirmModale(null);
        } catch (err) {
          console.error('[supprimerPeriode]', err);
          showMsg('error', (lang==='ar'?'فشل: ':'Erreur : ') + err.message);
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // ──────────────────────────────────────────────
  // RENDU
  // ──────────────────────────────────────────────
  if (loading) return <div style={{padding:40,textAlign:'center',color:'#888'}}>{lang==='ar'?'جاري التحميل...':'Chargement...'}</div>;

  const anneeEstArchivee = anneeSelectionnee?.statut === 'archivee';
  const peutEditer = anneeSelectionnee?.statut !== 'archivee';

  return (
    <div>
      {/* Cas : aucune annee configuree */}
      {annees.length === 0 && (
        <div style={{
          background:'linear-gradient(135deg,#FFF8EC,#FAEEDA)',
          border:'1px solid #EF9F2740',borderRadius:12,padding:'24px',marginBottom:14,textAlign:'center',
        }}>
          <div style={{fontSize:42,marginBottom:10}}>📅</div>
          <div style={{fontSize:16,fontWeight:800,color:'#7B5800',marginBottom:6}}>
            {lang==='ar'?'لم تقم بإعداد أي سنة دراسية':'Aucune année scolaire configurée'}
          </div>
          <div style={{fontSize:13,color:'#8a5a00',marginBottom:14,lineHeight:1.5}}>
            {lang==='ar'?'ابدأ بإنشاء أول سنة دراسية لتنظيم فتراتك':'Commencez par créer votre première année scolaire'}
          </div>
          <button onClick={ouvrirCreationAnnee}
            style={{padding:'10px 20px',background:'linear-gradient(135deg,#1D9E75,#085041)',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 2px 8px rgba(8,80,65,0.3)'}}>
            ➕ {lang==='ar'?'إنشاء سنة دراسية':'Créer une année scolaire'}
          </button>
        </div>
      )}

      {/* Cas : annees existent */}
      {annees.length > 0 && (
        <>
          {/* Selecteur annee */}
          <div style={{
            background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,
            padding:'14px 16px',marginBottom:14,
          }}>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:'#666',textTransform:'uppercase',letterSpacing:0.3}}>
                {lang==='ar'?'السنة الدراسية':'Année scolaire'}
              </div>
              <select value={selectedAnneeId || ''} onChange={e=>setSelectedAnneeId(e.target.value)}
                style={{padding:'7px 10px',borderRadius:8,border:'1px solid #d0d8e8',fontSize:13,fontWeight:600,fontFamily:'inherit',cursor:'pointer',flex:1,minWidth:150}}>
                {annees.map(a => {
                  const meta = a.statut==='active' ? '✅ ' : a.statut==='archivee' ? '📂 ' : '📅 ';
                  return <option key={a.id} value={a.id}>{meta}{a.nom}</option>;
                })}
              </select>
            </div>
            {anneeSelectionnee && (
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                {/* Badge statut */}
                {anneeSelectionnee.statut === 'active' && (
                  <span style={{padding:'3px 10px',borderRadius:8,fontSize:10,fontWeight:700,background:'#E1F5EE',color:'#085041',border:'0.5px solid #1D9E7530'}}>
                    ✅ {lang==='ar'?'نشطة':'Active'}
                  </span>
                )}
                {anneeSelectionnee.statut === 'archivee' && (
                  <span style={{padding:'3px 10px',borderRadius:8,fontSize:10,fontWeight:700,background:'#f0f0ec',color:'#888',border:'0.5px solid #e0e0d8'}}>
                    📂 {lang==='ar'?'مؤرشفة':'Archivée'}
                  </span>
                )}
                {anneeSelectionnee.statut === 'a_venir' && (
                  <span style={{padding:'3px 10px',borderRadius:8,fontSize:10,fontWeight:700,background:'#FFF8EC',color:'#7B5800',border:'0.5px solid #EF9F2730'}}>
                    📅 {lang==='ar'?'قادمة':'À venir'}
                  </span>
                )}
                {/* Dates */}
                <span style={{fontSize:12,color:'#666',fontWeight:600}}>
                  📅 {fmt(anneeSelectionnee.date_debut)} → {fmt(anneeSelectionnee.date_fin)}
                </span>
                <div style={{flex:1}}/>
                {/* Actions selon statut */}
                {anneeSelectionnee.statut === 'a_venir' && (
                  <button onClick={()=>activerAnnee(anneeSelectionnee)} disabled={saving}
                    style={{padding:'5px 12px',borderRadius:8,fontSize:11,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                      background:'linear-gradient(135deg,#1D9E75,#085041)',color:'#fff',border:'none',fontFamily:'inherit'}}>
                    ▶ {lang==='ar'?'تفعيل':'Activer'}
                  </button>
                )}
                {anneeSelectionnee.statut === 'active' && (
                  <button onClick={cloturerAnnee} disabled={saving}
                    style={{padding:'5px 12px',borderRadius:8,fontSize:11,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                      background:'#FFF8EC',color:'#7B5800',border:'1px solid #EF9F2730',fontFamily:'inherit'}}>
                    ⏸ {lang==='ar'?'إغلاق':'Clôturer'}
                  </button>
                )}
                <button onClick={()=>ouvrirEditionAnnee(anneeSelectionnee)} disabled={saving || anneeEstArchivee}
                  style={{padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:600,cursor:(saving||anneeEstArchivee)?'not-allowed':'pointer',
                    background:'#E6F1FB',color:'#378ADD',border:'0.5px solid #378ADD30',opacity:anneeEstArchivee?0.5:1,fontFamily:'inherit'}}>
                  ✏️
                </button>
                {anneeSelectionnee.statut !== 'active' && (
                  <button onClick={()=>supprimerAnnee(anneeSelectionnee)} disabled={saving}
                    style={{padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:600,cursor:saving?'not-allowed':'pointer',
                      background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',fontFamily:'inherit'}}>
                    🗑
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Boutons globaux */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
            <button onClick={ouvrirCreationAnnee} disabled={saving}
              style={{padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                background:'#fff',color:'#085041',border:'1px solid #1D9E7540',fontFamily:'inherit'}}>
              ➕ {lang==='ar'?'سنة جديدة':'Nouvelle année'}
            </button>
            {anneeActive && (
              <button onClick={preparerAnneeSuivante} disabled={saving}
                style={{padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                  background:'linear-gradient(135deg,#1D9E75,#085041)',color:'#fff',border:'none',fontFamily:'inherit',boxShadow:'0 2px 8px rgba(8,80,65,0.25)'}}>
                🔄 {lang==='ar'?'تحضير السنة المقبلة':'Préparer l\'année suivante'}
              </button>
            )}
          </div>

          {/* Liste des periodes de l'annee selectionnee */}
          {anneeSelectionnee && (
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8,flexWrap:'wrap'}}>
                <div className="section-label" style={{margin:0}}>
                  {lang==='ar'?'الفترات':'Périodes'} ({periodesAnneeSelectionnee.length})
                </div>
                {peutEditer && (
                  <button onClick={ouvrirCreationPeriode} disabled={saving}
                    style={{padding:'6px 12px',borderRadius:8,fontSize:11,fontWeight:700,cursor:saving?'not-allowed':'pointer',
                      background:'#085041',color:'#fff',border:'none',fontFamily:'inherit'}}>
                    ➕ {lang==='ar'?'إضافة فترة':'Ajouter une période'}
                  </button>
                )}
              </div>
              {periodesAnneeSelectionnee.length === 0 ? (
                <div className="empty">{lang==='ar'?'لا توجد فترات في هذه السنة':'Aucune période dans cette année'}</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {periodesAnneeSelectionnee.map(p => {
                    const meta = getTypeMeta(p.type);
                    return (
                      <div key={p.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                        <div style={{width:44,height:44,borderRadius:12,background:`${meta.color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{meta.icon}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a'}}>{p.nom_ar||p.nom}</div>
                            <span style={{padding:'1px 7px',borderRadius:8,fontSize:9,fontWeight:700,
                              background:`${meta.color}15`,color:meta.color,border:`0.5px solid ${meta.color}40`}}>
                              {lang==='ar'?meta.label_ar:meta.label_fr}
                            </span>
                          </div>
                          <div style={{fontSize:11,color:'#888',marginTop:2,fontWeight:600}}>
                            📅 {fmt(p.date_debut)} → {fmt(p.date_fin)}
                          </div>
                        </div>
                        {peutEditer && (
                          <div style={{display:'flex',gap:5}}>
                            <button onClick={()=>ouvrirEditionPeriode(p)} disabled={saving}
                              style={{padding:'4px 8px',borderRadius:6,fontSize:11,fontWeight:600,cursor:saving?'not-allowed':'pointer',
                                background:'#E6F1FB',color:'#378ADD',border:'0.5px solid #378ADD30'}}>✏️</button>
                            <button onClick={()=>supprimerPeriode(p)} disabled={saving}
                              style={{padding:'4px 8px',borderRadius:6,fontSize:11,fontWeight:600,cursor:saving?'not-allowed':'pointer',
                                background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30'}}>🗑</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODALE de confirmation generique (Etape 14 v2 - remplace window.confirm) */}
      {confirmModale && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:20,
          animation:'modalFadeIn 0.15s ease-out'}}
          onClick={()=>{ if(!saving) setConfirmModale(null); }}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:'#fff',borderRadius:16,maxWidth:440,width:'100%',padding:24,boxShadow:'0 20px 60px rgba(0,0,0,0.3)',
              animation:'modalSlideIn 0.18s ease-out'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <div style={{
                width:48,height:48,borderRadius:14,
                background:confirmModale.danger?'#FCEBEB':'#E1F5EE',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0,
              }}>
                {confirmModale.danger?'⚠️':'❓'}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:800,color:'#1a1a1a'}}>
                  {confirmModale.titre}
                </div>
              </div>
            </div>
            <div style={{fontSize:13,color:'#444',lineHeight:1.6,marginBottom:18}}>
              {confirmModale.message}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setConfirmModale(null)} disabled={saving}
                style={{flex:1,padding:11,background:'#f5f5f0',color:'#666',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'إلغاء':'Annuler'}
              </button>
              <button onClick={confirmModale.onConfirm} disabled={saving}
                style={{flex:2,padding:11,
                  background:saving?'#ccc':(confirmModale.danger?'#E24B4A':'linear-gradient(135deg,#1D9E75,#085041)'),
                  color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                {saving?(lang==='ar'?'جاري...':'En cours...'):confirmModale.action}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE creation/edition annee */}
      {showAnneeForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20,
          animation:'modalFadeIn 0.15s ease-out'}}
          onClick={()=>{ if(!saving) setShowAnneeForm(false); }}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:'#fff',borderRadius:16,maxWidth:480,width:'100%',padding:24,boxShadow:'0 20px 60px rgba(0,0,0,0.3)',
              animation:'modalSlideIn 0.18s ease-out'}}>
            <div style={{fontSize:17,fontWeight:800,color:'#085041',marginBottom:14}}>
              {editingAnneeId ? (lang==='ar'?'تعديل السنة':'Modifier l\'année') : (lang==='ar'?'سنة دراسية جديدة':'Nouvelle année scolaire')}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:14}}>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'الاسم':'Nom'} <span style={{color:'#E24B4A'}}>*</span></label>
                <input className="field-input" value={formAnnee.nom}
                  onChange={e=>setFormAnnee({...formAnnee, nom:e.target.value})}
                  placeholder="2026-2027"/>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'تاريخ البداية':'Date de début'} <span style={{color:'#E24B4A'}}>*</span></label>
                <input className="field-input" type="date" value={formAnnee.date_debut}
                  onChange={e=>setFormAnnee({...formAnnee, date_debut:e.target.value})}/>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'تاريخ النهاية':'Date de fin'} <span style={{color:'#E24B4A'}}>*</span></label>
                <input className="field-input" type="date" value={formAnnee.date_fin}
                  onChange={e=>setFormAnnee({...formAnnee, date_fin:e.target.value})}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowAnneeForm(false)} disabled={saving}
                style={{flex:1,padding:11,background:'#f5f5f0',color:'#666',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'إلغاء':'Annuler'}
              </button>
              <button onClick={sauvegarderAnnee} disabled={saving}
                style={{flex:2,padding:11,background:saving?'#ccc':'linear-gradient(135deg,#1D9E75,#085041)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                {saving?(lang==='ar'?'جاري...':'En cours...'):(lang==='ar'?'حفظ':'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE creation/edition periode */}
      {showPeriodeForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:20,
          animation:'modalFadeIn 0.15s ease-out'}}
          onClick={()=>{ if(!saving) setShowPeriodeForm(false); }}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:'#fff',borderRadius:16,maxWidth:520,width:'100%',padding:24,boxShadow:'0 20px 60px rgba(0,0,0,0.3)',maxHeight:'90vh',overflowY:'auto',
              animation:'modalSlideIn 0.18s ease-out'}}>
            <div style={{fontSize:17,fontWeight:800,color:'#085041',marginBottom:14}}>
              {editingPeriodeId ? (lang==='ar'?'تعديل الفترة':'Modifier la période') : (lang==='ar'?'فترة جديدة':'Nouvelle période')}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:14}}>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'النوع':'Type'}</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {TYPE_OPTIONS.map(opt => (
                    <button key={opt.val} type="button"
                      onClick={()=>setFormPeriode({...formPeriode, type:opt.val})}
                      style={{padding:'7px 14px',borderRadius:8,
                        background:formPeriode.type===opt.val?opt.color:'#fff',
                        color:formPeriode.type===opt.val?'#fff':opt.color,
                        border:`1px solid ${opt.color}50`,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'inherit'}}>
                      {opt.icon} {lang==='ar'?opt.label_ar:opt.label_fr}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'الاسم':'Nom'} <span style={{color:'#E24B4A'}}>*</span></label>
                <input className="field-input" value={formPeriode.nom_ar}
                  onChange={e=>setFormPeriode({...formPeriode, nom_ar:e.target.value})}
                  placeholder={lang==='ar'?'مثال: الفصل الأول':'Ex: Trimestre 1'}/>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'تاريخ البداية':'Date de début'} <span style={{color:'#E24B4A'}}>*</span></label>
                <input className="field-input" type="date" value={formPeriode.date_debut}
                  onChange={e=>setFormPeriode({...formPeriode, date_debut:e.target.value})}/>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'تاريخ النهاية':'Date de fin'} <span style={{color:'#E24B4A'}}>*</span></label>
                <input className="field-input" type="date" value={formPeriode.date_fin}
                  onChange={e=>setFormPeriode({...formPeriode, date_fin:e.target.value})}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowPeriodeForm(false)} disabled={saving}
                style={{flex:1,padding:11,background:'#f5f5f0',color:'#666',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                {lang==='ar'?'إلغاء':'Annuler'}
              </button>
              <button onClick={sauvegarderPeriode} disabled={saving}
                style={{flex:2,padding:11,background:saving?'#ccc':'linear-gradient(135deg,#1D9E75,#085041)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                {saving?(lang==='ar'?'جاري...':'En cours...'):(lang==='ar'?'حفظ':'Enregistrer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
