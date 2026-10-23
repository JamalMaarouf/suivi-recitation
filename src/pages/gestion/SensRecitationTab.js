import React from 'react';
import { supabase } from '../../lib/supabase';



// ══════════════════════════════════════════════════════
// COMPOSANT SensRecitationTab — Sens de récitation (desc/asc)
// par école et par niveau
// ══════════════════════════════════════════════════════
export function SensRecitationTab({ user, lang, ecoleConfig, setEcoleConfig, niveaux, setNiveaux, showMsg }) {
  const [saving, setSaving] = React.useState(false);
  const [validationsCount, setValidationsCount] = React.useState({}); // { niveau_id: nbValidations }
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      // Pour chaque niveau, compter les validations existantes pour ses élèves
      // On fait une seule requête qui compte par code_niveau
      try {
        const { data: eleves } = await supabase.from('eleves')
          .select('id, code_niveau').eq('ecole_id', user.ecole_id);
        const byNiveau = {};
        (eleves || []).forEach(e => {
          if (!byNiveau[e.code_niveau]) byNiveau[e.code_niveau] = [];
          byNiveau[e.code_niveau].push(e.id);
        });
        const counts = {};
        for (const code of Object.keys(byNiveau)) {
          const ids = byNiveau[code];
          if (ids.length === 0) { counts[code] = 0; continue; }
          const { count } = await supabase.from('validations')
            .select('id', { count: 'exact', head: true })
            .eq('ecole_id', user.ecole_id)
            .in('eleve_id', ids);
          counts[code] = count || 0;
        }
        setValidationsCount(counts);
      } catch (e) {
        console.error('[SensRecitationTab] loadCounts', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user.ecole_id, niveaux.length]);

  const sensDefaut = ecoleConfig?.sens_recitation_defaut || 'desc';

  const libelle = (s) => {
    if (s === 'asc') return lang === 'ar'
      ? 'تصاعدي (من الحزب 1 إلى 60 · من السورة 1 إلى 114)'
      : 'Croissant (Hizb 1 → 60 · Sourate 1 → 114)';
    return lang === 'ar'
      ? 'تنازلي (من الحزب 60 إلى 1 · من السورة 114 إلى 1)'
      : 'Décroissant (Hizb 60 → 1 · Sourate 114 → 1)';
  };
  const libelleShort = (s) => s === 'asc'
    ? (lang === 'ar' ? 'تصاعدي' : 'Croissant')
    : (lang === 'ar' ? 'تنازلي' : 'Décroissant');

  const saveEcoleDefaut = async (newSens) => {
    setSaving(true);
    const { error } = await supabase.from('ecoles')
      .update({ sens_recitation_defaut: newSens })
      .eq('id', user.ecole_id);
    setSaving(false);
    if (error) {
      showMsg('error', lang === 'ar' ? 'خطأ في الحفظ' : 'Erreur de sauvegarde');
      return;
    }
    setEcoleConfig(prev => ({ ...prev, sens_recitation_defaut: newSens }));
    showMsg('success', lang === 'ar' ? 'تم الحفظ' : 'Réglage enregistré');
  };

  const saveNiveauSens = async (niveauId, niveauCode, newSens) => {
    // Si le niveau a des validations et qu'on change de sens, bloquer
    const currentEffectif = (niveaux.find(n => n.id === niveauId)?.sens_recitation) || sensDefaut;
    const nouveauEffectif = newSens === null ? sensDefaut : newSens;
    const nbVal = validationsCount[niveauCode] || 0;
    if (nbVal > 0 && currentEffectif !== nouveauEffectif) {
      showMsg('error', lang === 'ar'
        ? `لا يمكن تغيير الاتجاه: يوجد ${nbVal} استظهار مسجل في هذا المستوى`
        : `Impossible de changer le sens : ${nbVal} validation(s) déjà enregistrée(s) pour ce niveau`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('niveaux')
      .update({ sens_recitation: newSens })
      .eq('id', niveauId)
      .eq('ecole_id', user.ecole_id);
    setSaving(false);
    if (error) {
      showMsg('error', lang === 'ar' ? 'خطأ في الحفظ' : 'Erreur de sauvegarde');
      return;
    }
    // Mise à jour IMMÉDIATE du state local (le parent reflète le changement)
    if (typeof setNiveaux === 'function') {
      setNiveaux(prev => (prev || []).map(n =>
        n.id === niveauId ? { ...n, sens_recitation: newSens } : n
      ));
    }
    showMsg('success', lang === 'ar' ? 'تم الحفظ' : 'Enregistré');
  };

  return (
    <div>
      {/* ─── Défaut école ─── */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem',marginBottom:'1.25rem'}}>
        <div style={{fontSize:14,fontWeight:800,color:'#085041',marginBottom:8}}>
          🏫 {lang === 'ar' ? 'الإعداد الافتراضي للمدرسة' : 'Réglage par défaut pour toute l\'école'}
        </div>
        <div style={{fontSize:12,color:'#666',marginBottom:12,lineHeight:1.5}}>
          {lang === 'ar'
            ? 'هذا الإعداد يحدد الاتجاه الافتراضي لجميع مستويات المدرسة. المستويات التي تستخدم "افتراضي" ستتغير تلقائيًا عند تغيير هذا الإعداد.'
            : 'Ce réglage définit le sens par défaut pour tous les niveaux de l\'école. Les niveaux réglés sur "Défaut" suivront automatiquement tout changement de cette valeur.'}
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {['desc','asc'].map(s => (
            <button key={s} onClick={() => saveEcoleDefaut(s)} disabled={saving || sensDefaut === s}
              style={{
                flex:'1 1 200px',padding:'14px 18px',borderRadius:12,
                border:`2px solid ${sensDefaut === s ? '#085041' : '#e0e0d8'}`,
                background: sensDefaut === s ? '#E1F5EE' : '#fff',
                color: sensDefaut === s ? '#085041' : '#555',
                fontSize:13,fontWeight:700,cursor: saving ? 'wait' : 'pointer',
                fontFamily:'inherit',transition:'all 0.15s',textAlign:'start'
              }}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:20}}>{s === 'asc' ? '📈' : '📉'}</span>
                <span>{libelle(s)}</span>
                {sensDefaut === s && <span style={{marginInlineStart:'auto',color:'#1D9E75'}}>✓</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Surcharge par niveau ─── */}
      <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem'}}>
        <div style={{fontSize:14,fontWeight:800,color:'#085041',marginBottom:8}}>
          📚 {lang === 'ar' ? 'حسب المستوى' : 'Par niveau'}
        </div>
        <div style={{fontSize:12,color:'#666',marginBottom:14,lineHeight:1.5}}>
          {lang === 'ar'
            ? '🏫 "افتراضي": يتبع إعداد المدرسة (يتغير إذا غيرت الإعداد العام). 🔒 "تنازلي" أو "تصاعدي": يثبت هذا المستوى على اتجاه محدد. المستويات التي تحتوي على استظهارات مسجلة لا يمكن تغيير اتجاهها.'
            : '🏫 "Défaut" : suit le réglage école (change si vous modifiez le réglage global). 🔒 "Décroissant" ou "Croissant" : verrouille ce niveau sur un sens spécifique. Les niveaux avec validations enregistrées ne peuvent plus changer.'}
        </div>
        {loading ? (
          <div style={{padding:'1rem',color:'#888',fontSize:12}}>
            {lang === 'ar' ? 'جاري التحميل...' : 'Chargement...'}
          </div>
        ) : niveaux.length === 0 ? (
          <div style={{padding:'1rem',color:'#888',fontSize:12}}>
            {lang === 'ar' ? 'لا توجد مستويات' : 'Aucun niveau'}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {niveaux.map(n => {
              const sensSurcharge = n.sens_recitation; // null = hérite de l'école
              const sensEffectif = sensSurcharge || sensDefaut;
              const nbVal = validationsCount[n.code] || 0;
              const bloque = nbVal > 0;
              return (
                <div key={n.id} style={{
                  display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',
                  padding:'12px 14px',borderRadius:10,
                  background: bloque ? '#f5f5f0' : '#fff',
                  border: `0.5px solid ${n.couleur || '#e0e0d8'}40`
                }}>
                  <div style={{
                    width:36,height:36,borderRadius:'50%',
                    background:(n.couleur||'#888')+'22',color:n.couleur||'#555',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:13,fontWeight:800,flexShrink:0
                  }}>
                    {n.code}
                  </div>
                  <div style={{flex:'1 1 200px',minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#1a1a1a'}}>
                      {n.nom || n.code}
                    </div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>
                      {sensSurcharge ? (
                        <span style={{color:'#085041',fontWeight:600}}>
                          🔒 {libelleShort(sensSurcharge)}
                          <span style={{color:'#888',fontWeight:400}}>
                            {lang === 'ar' ? ' (مثبت)' : ' (verrouillé)'}
                          </span>
                        </span>
                      ) : (
                        <span style={{color:'#555'}}>
                          🏫 {libelleShort(sensDefaut)}
                          <span style={{color:'#888'}}>
                            {lang === 'ar' ? ' (يتبع المدرسة)' : ' (suit l\'école)'}
                          </span>
                        </span>
                      )}
                      {bloque && (
                        <span style={{marginInlineStart:6,color:'#EF9F27',fontWeight:600}}>
                          · 🔒 {nbVal} {lang === 'ar' ? 'استظهار' : 'validation(s)'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {[
                      {
                        val: null,
                        label: lang === 'ar' ? 'افتراضي' : 'Défaut',
                        icon: '🏫',
                        tooltip: lang === 'ar'
                          ? `يتبع هذا المستوى الإعداد العام للمدرسة تلقائيًا (حاليا: ${libelleShort(sensDefaut)}). إذا قمت بتغيير الإعداد العام، سيتغير هذا المستوى تلقائيًا.`
                          : `Ce niveau suit automatiquement le réglage de l'école (actuellement : ${libelleShort(sensDefaut)}). Si vous changez le réglage école, ce niveau changera aussi.`
                      },
                      {
                        val: 'desc',
                        label: lang === 'ar' ? 'تنازلي' : 'Décroissant',
                        icon: '📉',
                        tooltip: lang === 'ar'
                          ? 'تثبيت الاتجاه على تنازلي لهذا المستوى بغض النظر عن إعداد المدرسة العام.'
                          : 'Verrouille ce niveau en décroissant, indépendamment du réglage école.'
                      },
                      {
                        val: 'asc',
                        label: lang === 'ar' ? 'تصاعدي' : 'Croissant',
                        icon: '📈',
                        tooltip: lang === 'ar'
                          ? 'تثبيت الاتجاه على تصاعدي لهذا المستوى بغض النظر عن إعداد المدرسة العام.'
                          : 'Verrouille ce niveau en croissant, indépendamment du réglage école.'
                      },
                    ].map(opt => {
                      const isCurrent = sensSurcharge === opt.val;
                      // bloqué si le niveau a des validations ET que ce choix changerait le sens effectif
                      const nouveauEffectif = opt.val === null ? sensDefaut : opt.val;
                      const changeSens = sensEffectif !== nouveauEffectif;
                      const disabled = saving || isCurrent || (bloque && changeSens);
                      const tooltipBloque = lang === 'ar' ? 'لا يمكن التغيير: يوجد استظهارات' : 'Bloqué : validations existantes';
                      return (
                        <button key={String(opt.val)}
                          onClick={() => saveNiveauSens(n.id, n.code, opt.val)}
                          disabled={disabled}
                          title={disabled && bloque && changeSens ? tooltipBloque : opt.tooltip}
                          style={{
                            padding:'6px 10px',borderRadius:8,fontSize:11,fontWeight:700,
                            border: `1px solid ${isCurrent ? '#085041' : '#e0e0d8'}`,
                            background: isCurrent ? '#E1F5EE' : '#fff',
                            color: isCurrent ? '#085041' : (disabled ? '#bbb' : '#555'),
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled && !isCurrent ? 0.5 : 1,
                            fontFamily:'inherit',whiteSpace:'nowrap'
                          }}>
                          {opt.icon} {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
