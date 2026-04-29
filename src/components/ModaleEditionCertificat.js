// ═══════════════════════════════════════════════════════════════════════════
// ModaleEditionCertificat — Phase A / B3
// ═══════════════════════════════════════════════════════════════════════════
//
// Modale unifiée pour :
//  - Éditer un certificat existant (champs : titre, description, date_emission)
//  - Émettre manuellement un certificat (depuis Suivi Résultats > Émettre cert.)
//
// Toute modification est tracée via audit_log avec metadata avant/après.
//
// Props :
//   - mode          : 'edit' | 'create'
//   - certificat    : objet certificat existant (mode 'edit') ou null
//   - eleve         : { id, prenom, nom } — toujours requis
//   - resultat      : { id, examen_id, score, date_examen } — pour mode 'create' depuis examen
//   - examen        : { id, nom } — pour mode 'create' depuis examen
//   - user          : utilisateur courant (pour audit + cree_par)
//   - lang          : 'fr' | 'ar'
//   - onClose       : () => void
//   - onSaved       : (cert) => void — callback après save réussi (cert créé/mis à jour)
//
// Sécurité : RLS permissive, mais on filtre toujours par ecole_id côté insert/update.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';
import { useToast } from '../lib/toast';

export default function ModaleEditionCertificat({
  mode = 'edit',
  certificat = null,
  eleve = null,
  resultat = null,
  examen = null,
  user,
  lang = 'fr',
  onClose,
  onSaved,
}) {
  const { toast } = useToast();
  const isAr = lang === 'ar';
  const isCreate = mode === 'create';

  // ─── States du formulaire ──────────────────────────────────────────────
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [dateEmission, setDateEmission] = useState('');
  const [saving, setSaving] = useState(false);

  // Snapshot initial pour calculer le diff (audit metadata)
  const [snapshotInitial, setSnapshotInitial] = useState(null);

  // ─── Pré-remplissage selon mode ────────────────────────────────────────
  useEffect(() => {
    if (isCreate) {
      // Mode création : pré-remplir avec les infos de l'examen/résultat
      const titreInit = examen?.nom || '';
      const descInit = '';
      const dateInit = resultat?.date_examen
        ? String(resultat.date_examen).split('T')[0]
        : new Date().toISOString().split('T')[0];
      setTitre(titreInit);
      setDescription(descInit);
      setDateEmission(dateInit);
      setSnapshotInitial(null); // pas de snapshot en création
    } else if (certificat) {
      // Mode édition : charger les valeurs actuelles
      const titreInit = certificat.titre || '';
      const descInit = certificat.description || '';
      const dateInit = certificat.date_emission
        ? String(certificat.date_emission).split('T')[0]
        : '';
      setTitre(titreInit);
      setDescription(descInit);
      setDateEmission(dateInit);
      setSnapshotInitial({ titre: titreInit, description: descInit, date_emission: dateInit });
    }
  }, [mode, certificat, examen, resultat]);

  // ─── Validation simple ─────────────────────────────────────────────────
  const titreClean = (titre || '').trim();
  const isValid = titreClean.length > 0 && !!dateEmission;

  // ─── Save : update (edit) ou insert (create) ───────────────────────────
  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      if (isCreate) {
        // ── CRÉATION ──
        if (!eleve?.id || !user?.ecole_id) {
          toast.error(isAr ? 'بيانات ناقصة' : 'Données manquantes');
          setSaving(false);
          return;
        }
        const payload = {
          eleve_id: eleve.id,
          ecole_id: user.ecole_id,
          jalon_id: null,
          titre: titreClean,
          description: (description || '').trim() || null,
          type_certificat: 'examen_manuel', // distinct de 'examen_auto' (cf B3)
          date_emission: dateEmission,
          cree_par: user.id || null,
          examen_id_source: examen?.id || null,
          resultat_examen_id_source: resultat?.id || null,
        };
        const { data: inserted, error } = await supabase
          .from('certificats_eleves').insert(payload).select().single();
        if (error) {
          console.error('[ModaleEditionCertificat] insert:', error);
          toast.error(isAr ? 'خطأ في إنشاء الشهادة' : 'Erreur création certificat');
          setSaving(false);
          return;
        }

        // Audit log (non bloquant)
        await logAudit(supabase, {
          actor: user,
          action: 'creer_certificat_manuel',
          target_type: 'certificat',
          target_id: inserted.id,
          target_label: `${eleve.prenom} ${eleve.nom} — ${titreClean}`,
          metadata: {
            type_certificat: 'examen_manuel',
            eleve_id: eleve.id,
            examen_id: examen?.id || null,
            resultat_examen_id: resultat?.id || null,
            valeurs: { titre: titreClean, description, date_emission: dateEmission },
          },
        });

        toast.success(isAr ? '✅ تم إنشاء الشهادة' : '✅ Certificat créé');
        onSaved?.(inserted);
        onClose?.();
        return;
      }

      // ── ÉDITION ──
      if (!certificat?.id) {
        toast.error(isAr ? 'شهادة غير صالحة' : 'Certificat invalide');
        setSaving(false);
        return;
      }
      const updates = {
        titre: titreClean,
        description: (description || '').trim() || null,
        date_emission: dateEmission,
      };
      const { data: updated, error } = await supabase
        .from('certificats_eleves')
        .update(updates)
        .eq('id', certificat.id)
        .eq('ecole_id', user.ecole_id) // sécurité multi-tenant
        .select().single();
      if (error) {
        console.error('[ModaleEditionCertificat] update:', error);
        toast.error(isAr ? 'خطأ في الحفظ' : 'Erreur de sauvegarde');
        setSaving(false);
        return;
      }

      // Calcul du diff pour l'audit
      const diff = {};
      if (snapshotInitial) {
        if (snapshotInitial.titre !== titreClean) {
          diff.titre = { avant: snapshotInitial.titre, apres: titreClean };
        }
        if ((snapshotInitial.description || '') !== (updates.description || '')) {
          diff.description = { avant: snapshotInitial.description, apres: updates.description };
        }
        if (snapshotInitial.date_emission !== dateEmission) {
          diff.date_emission = { avant: snapshotInitial.date_emission, apres: dateEmission };
        }
      }

      // Audit log uniquement si quelque chose a changé
      if (Object.keys(diff).length > 0) {
        await logAudit(supabase, {
          actor: user,
          action: 'editer_certificat',
          target_type: 'certificat',
          target_id: certificat.id,
          target_label: `${eleve?.prenom || ''} ${eleve?.nom || ''} — ${titreClean}`.trim(),
          metadata: {
            eleve_id: eleve?.id || certificat.eleve_id,
            type_certificat: certificat.type_certificat,
            modifications: diff,
          },
        });
      }

      toast.success(isAr ? '✅ تم الحفظ' : '✅ Modifications enregistrées');
      onSaved?.(updated);
      onClose?.();
    } catch (err) {
      console.error('[ModaleEditionCertificat] handleSave:', err);
      toast.error(isAr ? 'خطأ غير متوقع' : 'Erreur inattendue');
    } finally {
      setSaving(false);
    }
  };

  // ─── Type certificat (lecture seule — Q3=A) ────────────────────────────
  const typeCertif = certificat?.type_certificat
    || (isCreate ? 'examen_manuel' : null);
  const typeLabel = (() => {
    if (typeCertif === 'jalon')           return isAr ? 'مرحلة'        : 'Jalon';
    if (typeCertif === 'bloc')            return isAr ? 'كتلة'         : 'Bloc';
    if (typeCertif === 'examen_auto')     return isAr ? 'امتحان (تلقائي)' : 'Examen (auto)';
    if (typeCertif === 'examen_manuel')   return isAr ? 'امتحان (يدوي)' : 'Examen (manuel)';
    return typeCertif || '—';
  })();

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div onClick={onClose}
      style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000,
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
        animation:'fadeIn 0.15s ease-out'}}>
      <div onClick={(e)=>e.stopPropagation()}
        style={{background:'#fff', borderRadius:16, width:'100%', maxWidth:520,
          maxHeight:'90vh', overflowY:'auto', boxShadow:'0 10px 40px rgba(0,0,0,0.2)',
          fontFamily:'inherit'}}>

        {/* Header */}
        <div style={{padding:'18px 24px', borderBottom:'1px solid #f0f0ec',
          display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize:18, fontWeight:800, color:'#085041'}}>
              {isCreate
                ? (isAr ? '✨ إصدار شهادة' : '✨ Émettre un certificat')
                : (isAr ? '✏️ تحرير الشهادة' : '✏️ Éditer le certificat')}
            </div>
            {eleve && (
              <div style={{fontSize:12, color:'#888', marginTop:3}}>
                {eleve.prenom} {eleve.nom}
              </div>
            )}
          </div>
          <button onClick={onClose}
            style={{background:'none', border:'none', fontSize:22, color:'#888',
              cursor:'pointer', padding:0, lineHeight:1}}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{padding:'20px 24px', display:'flex', flexDirection:'column', gap:16}}>

          {/* Type de certificat (lecture seule — Q3=A) */}
          {typeCertif && (
            <div>
              <div style={{fontSize:11, color:'#888', fontWeight:600, marginBottom:6,
                letterSpacing:0.5}}>
                {isAr ? 'نوع الشهادة' : 'TYPE'}
              </div>
              <span style={{display:'inline-block', padding:'5px 12px', borderRadius:20,
                background:'#E1F5EE', color:'#085041', fontSize:12, fontWeight:700}}>
                {typeLabel}
              </span>
            </div>
          )}

          {/* Score (lecture seule, si dispo en mode create depuis examen) */}
          {isCreate && resultat?.score != null && (
            <div style={{padding:'10px 14px', background:'#f9f9f6', borderRadius:10,
              display:'flex', alignItems:'center', gap:10}}>
              <span style={{fontSize:18}}>🎯</span>
              <span style={{fontSize:13, color:'#666'}}>
                {isAr ? 'النتيجة' : 'Score'} :
              </span>
              <span style={{fontSize:18, fontWeight:800, color:'#1D9E75'}}>
                {resultat.score}%
              </span>
            </div>
          )}

          {/* Titre */}
          <div>
            <label style={{fontSize:11, color:'#888', fontWeight:600, marginBottom:6,
              display:'block', letterSpacing:0.5}}>
              {isAr ? 'العنوان *' : 'TITRE *'}
            </label>
            <input type="text" value={titre} onChange={(e)=>setTitre(e.target.value)}
              placeholder={isAr ? 'مثال: امتحان نهاية الفصل' : 'Ex: Examen fin de trimestre'}
              style={{width:'100%', padding:'10px 12px', borderRadius:10,
                border: titreClean.length === 0 ? '1px solid #E24B4A40' : '0.5px solid #e0e0d8',
                fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box'}}/>
            {titreClean.length === 0 && (
              <div style={{fontSize:11, color:'#E24B4A', marginTop:4}}>
                {isAr ? 'العنوان مطلوب' : 'Le titre est requis'}
              </div>
            )}
          </div>

          {/* Description (utilisé aussi pour le titre AR sur le PDF) */}
          <div>
            <label style={{fontSize:11, color:'#888', fontWeight:600, marginBottom:6,
              display:'block', letterSpacing:0.5}}>
              {isAr ? 'الوصف (اختياري)' : 'DESCRIPTION (optionnel)'}
            </label>
            <textarea value={description} onChange={(e)=>setDescription(e.target.value)}
              rows={2}
              placeholder={isAr
                ? 'مثال: العنوان بالعربية أو ملاحظة'
                : 'Ex: Titre en arabe ou note complémentaire'}
              style={{width:'100%', padding:'10px 12px', borderRadius:10,
                border:'0.5px solid #e0e0d8', fontSize:13, fontFamily:'inherit',
                outline:'none', boxSizing:'border-box', resize:'vertical', minHeight:60}}/>
            <div style={{fontSize:11, color:'#aaa', marginTop:4}}>
              {isAr
                ? '💡 يستخدم كعنوان عربي على الشهادة'
                : '💡 Utilisé comme titre AR sur le certificat'}
            </div>
          </div>

          {/* Date d'émission */}
          <div>
            <label style={{fontSize:11, color:'#888', fontWeight:600, marginBottom:6,
              display:'block', letterSpacing:0.5}}>
              {isAr ? 'تاريخ الإصدار *' : "DATE D'ÉMISSION *"}
            </label>
            <input type="date" value={dateEmission}
              onChange={(e)=>setDateEmission(e.target.value)}
              style={{width:'100%', padding:'10px 12px', borderRadius:10,
                border: !dateEmission ? '1px solid #E24B4A40' : '0.5px solid #e0e0d8',
                fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box'}}/>
          </div>

          {/* Note audit (visible uniquement en édition) */}
          {!isCreate && (
            <div style={{fontSize:11, color:'#888', padding:'8px 12px',
              background:'#f9f9f6', borderRadius:8, display:'flex', alignItems:'center', gap:6}}>
              <span>📝</span>
              <span>
                {isAr
                  ? 'يتم تسجيل كل تعديل في سجل التدقيق'
                  : 'Toute modification est enregistrée dans le journal d\'audit'}
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{padding:'14px 24px', borderTop:'1px solid #f0f0ec',
          display:'flex', justifyContent:'flex-end', gap:10}}>
          <button onClick={onClose} disabled={saving}
            style={{padding:'10px 18px', borderRadius:10, border:'0.5px solid #e0e0d8',
              background:'#fff', color:'#666', fontSize:13, fontWeight:600,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit'}}>
            {isAr ? 'إلغاء' : 'Annuler'}
          </button>
          <button onClick={handleSave} disabled={!isValid || saving}
            style={{padding:'10px 22px', borderRadius:10, border:'none',
              background: (!isValid || saving) ? '#ccc' : '#1D9E75',
              color:'#fff', fontSize:13, fontWeight:700,
              cursor: (!isValid || saving) ? 'not-allowed' : 'pointer',
              fontFamily:'inherit'}}>
            {saving
              ? (isAr ? '⏳ جاري الحفظ…' : '⏳ Enregistrement…')
              : isCreate
                ? (isAr ? '✨ إصدار' : '✨ Émettre')
                : (isAr ? '💾 حفظ' : '💾 Enregistrer')}
          </button>
        </div>
      </div>
    </div>
  );
}
