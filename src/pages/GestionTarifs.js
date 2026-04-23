import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';

// ══════════════════════════════════════════════════════════════════════
// PAGE GESTION TARIFS INSTITUTEURS
// Accessible depuis Gestion → Paramètres école → Tarifs Instituteurs
//
// Étape 1 : choisir le mode de tarification
//   - 'ecole'      : tarif unique pour tous les instituteurs de l'école
//   - 'individuel' : chaque instituteur a son propre tarif
// Étape 2 : saisir les tarifs selon le mode
//
// Tant qu'aucun mode n'est choisi (mode_tarif_instituteur = NULL),
// la feature Présences Instituteurs demandera de venir ici d'abord.
// ══════════════════════════════════════════════════════════════════════

export default function GestionTarifs({ user, navigate, goBack, lang, isMobile }) {
  const { toast } = useToast();

  // ─── State école ────────────────────────────────────────────
  const [modeTarif, setModeTarif] = useState(null);   // null | 'ecole' | 'individuel'
  const [tarifEcole, setTarifEcole] = useState('');
  const [ecoleLoading, setEcoleLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [savingTarifEcole, setSavingTarifEcole] = useState(false);

  // ─── State instituteurs (pour mode individuel) ─────────────
  const [instituteurs, setInstituteurs] = useState([]);
  const [tarifsEdits, setTarifsEdits] = useState({});  // { instituteurId: 'valeur' }
  const [instLoading, setInstLoading] = useState(true);
  const [savingInst, setSavingInst] = useState({});    // { instituteurId: boolean }

  // ─── Chargement initial ────────────────────────────────────
  const loadData = async () => {
    setEcoleLoading(true);
    setInstLoading(true);
    const [ecoleRes, instRes] = await Promise.all([
      supabase.from('ecoles')
        .select('mode_tarif_instituteur, tarif_seance_ecole')
        .eq('id', user.ecole_id)
        .maybeSingle(),
      supabase.from('utilisateurs')
        .select('id, prenom, nom, instituteur_id_ecole, tarif_seance')
        .eq('ecole_id', user.ecole_id)
        .eq('role', 'instituteur')
        .order('nom'),
    ]);
    if (ecoleRes.data) {
      setModeTarif(ecoleRes.data.mode_tarif_instituteur || null);
      setTarifEcole(ecoleRes.data.tarif_seance_ecole !== null && ecoleRes.data.tarif_seance_ecole !== undefined
        ? String(ecoleRes.data.tarif_seance_ecole) : '');
    }
    const insts = instRes.data || [];
    setInstituteurs(insts);
    // Pré-remplir tarifsEdits avec les valeurs actuelles
    const edits = {};
    insts.forEach(i => {
      edits[i.id] = i.tarif_seance !== null && i.tarif_seance !== undefined
        ? String(i.tarif_seance) : '';
    });
    setTarifsEdits(edits);
    setEcoleLoading(false);
    setInstLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  // ─── Sauvegarde du mode ────────────────────────────────────
  const saveMode = async (newMode) => {
    setSavingMode(true);
    const { error } = await supabase.from('ecoles')
      .update({ mode_tarif_instituteur: newMode })
      .eq('id', user.ecole_id);
    setSavingMode(false);
    if (error) {
      console.error('[saveMode]', error);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    setModeTarif(newMode);
    toast.success(lang === 'ar'
      ? '✅ تم اختيار النمط'
      : '✅ Mode de tarification enregistré');
  };

  // ─── Sauvegarde tarif école ────────────────────────────────
  const saveTarifEcole = async () => {
    const val = parseFloat(tarifEcole);
    if (isNaN(val) || val < 0) {
      toast.error(lang === 'ar'
        ? 'التعرفة يجب أن تكون رقما موجبا'
        : 'Le tarif doit être un nombre positif');
      return;
    }
    setSavingTarifEcole(true);
    const { error } = await supabase.from('ecoles')
      .update({ tarif_seance_ecole: val })
      .eq('id', user.ecole_id);
    setSavingTarifEcole(false);
    if (error) {
      console.error('[saveTarifEcole]', error);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    toast.success(lang === 'ar' ? '✅ تم حفظ التعرفة' : '✅ Tarif école enregistré');
  };

  // ─── Sauvegarde tarif d'un instituteur ─────────────────────
  const saveTarifInst = async (instId) => {
    const rawVal = tarifsEdits[instId];
    // Valeur vide = on efface (NULL en base)
    let val = null;
    if (rawVal !== '' && rawVal !== null && rawVal !== undefined) {
      val = parseFloat(rawVal);
      if (isNaN(val) || val < 0) {
        toast.error(lang === 'ar'
          ? 'التعرفة يجب أن تكون رقما موجبا'
          : 'Le tarif doit être un nombre positif');
        return;
      }
    }
    setSavingInst(s => ({ ...s, [instId]: true }));
    const { error } = await supabase.from('utilisateurs')
      .update({ tarif_seance: val })
      .eq('id', instId);
    setSavingInst(s => ({ ...s, [instId]: false }));
    if (error) {
      console.error('[saveTarifInst]', error);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      return;
    }
    toast.success(lang === 'ar' ? '✅ تم الحفظ' : '✅ Enregistré');
    // Recharger pour avoir les valeurs fraîches
    loadData();
  };

  // ══════════════════════════════════════════════════════════
  // Rendu
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ background: isMobile ? '#f5f5f0' : 'transparent', minHeight: isMobile ? '100vh' : 'auto', paddingBottom: 80 }}>

      {/* ─── Header ─── */}
      {isMobile ? (
        <div style={{
          background: 'linear-gradient(135deg, #085041, #1D9E75)',
          color: '#fff', padding: '48px 16px 14px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => goBack ? goBack() : navigate('gestion')}
              style={{
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10,
                padding: 0, flexShrink: 0, color: '#fff', fontSize: 18, cursor: 'pointer',
              }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                💰 {lang === 'ar' ? 'تعرفات الأساتذة' : 'Tarifs Instituteurs'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {lang === 'ar' ? 'تعرفة الحصة للأساتذة' : 'Tarifs par séance'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <button onClick={() => goBack ? goBack() : navigate('gestion')} className="back-link"></button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>
                💰 {lang === 'ar' ? 'تعرفات الأساتذة' : 'Tarifs Instituteurs'}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {lang === 'ar'
                  ? 'تعرفة الحصة المدفوعة لكل أستاذ'
                  : 'Montant payé par séance à chaque instituteur'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Contenu ─── */}
      <div style={{ padding: isMobile ? '14px' : '0 1.5rem' }}>

        {ecoleLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
          </div>
        ) : (
          <>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 1 : CHOIX DU MODE                                */}
            {/* ═══════════════════════════════════════════════════════ */}
            <div style={{
              background: '#fff', borderRadius: 14, padding: isMobile ? 16 : 20,
              marginBottom: 16, border: '1px solid #e0e0d8',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 22 }}>⚙️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                    {lang === 'ar' ? 'نمط التعرفة' : 'Mode de tarification'}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {lang === 'ar'
                      ? 'اختر كيفية تحديد تعرفة الأساتذة'
                      : 'Choisis comment fixer les tarifs'}
                  </div>
                </div>
              </div>

              {/* Alerte si aucun mode choisi */}
              {!modeTarif && (
                <div style={{
                  background: '#FAEEDA', borderLeft: '4px solid #EF9F27',
                  padding: '10px 14px', borderRadius: 8, marginBottom: 14,
                  fontSize: 12, color: '#633806',
                }}>
                  ⚠️ {lang === 'ar'
                    ? 'يجب اختيار نمط قبل استعمال خاصية متابعة الحضور'
                    : 'Tu dois choisir un mode avant d\'utiliser la feature Présences'}
                </div>
              )}

              {/* Choix des 2 modes */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12,
              }}>
                {/* Mode école */}
                <ModeCard
                  icon="🏫"
                  title={lang === 'ar' ? 'تعرفة موحدة' : 'Tarif école'}
                  description={lang === 'ar'
                    ? 'نفس التعرفة لكل الأساتذة'
                    : 'Même tarif pour tous les instituteurs'}
                  active={modeTarif === 'ecole'}
                  onClick={() => !savingMode && saveMode('ecole')}
                  color="#1D9E75"
                />
                {/* Mode individuel */}
                <ModeCard
                  icon="👤"
                  title={lang === 'ar' ? 'تعرفة فردية' : 'Tarif individuel'}
                  description={lang === 'ar'
                    ? 'تعرفة مخصصة لكل أستاذ'
                    : 'Tarif propre à chaque instituteur'}
                  active={modeTarif === 'individuel'}
                  onClick={() => !savingMode && saveMode('individuel')}
                  color="#534AB7"
                />
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 2A : TARIF ÉCOLE (si mode = 'ecole')             */}
            {/* ═══════════════════════════════════════════════════════ */}
            {modeTarif === 'ecole' && (
              <div style={{
                background: '#fff', borderRadius: 14, padding: isMobile ? 16 : 20,
                marginBottom: 16, border: '1px solid #e0e0d8',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 22 }}>💵</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                      {lang === 'ar' ? 'تعرفة المدرسة' : 'Tarif de l\'école'}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      {lang === 'ar'
                        ? 'يطبق على جميع الأساتذة'
                        : 'Appliqué à tous les instituteurs'}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: '#E1F5EE', padding: 14, borderRadius: 10,
                  border: '1px solid #1D9E7530',
                }}>
                  <label style={{
                    fontSize: 12, fontWeight: 700, color: '#085041',
                    display: 'block', marginBottom: 6,
                  }}>
                    {lang === 'ar' ? 'التعرفة لكل حصة' : 'Tarif par séance'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min="0" step="0.01"
                      value={tarifEcole}
                      onChange={e => setTarifEcole(e.target.value)}
                      placeholder="50"
                      style={{
                        flex: 1, padding: '11px 12px',
                        fontSize: 16, fontWeight: 700,
                        borderRadius: 8, border: '1px solid #1D9E7550',
                        background: '#fff', color: '#085041',
                        fontFamily: 'inherit', textAlign: 'center', outline: 'none',
                      }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#085041' }}>
                      {lang === 'ar' ? 'درهم' : 'DH'}
                    </span>
                    <button onClick={saveTarifEcole} disabled={savingTarifEcole}
                      style={{
                        padding: '11px 18px',
                        background: savingTarifEcole ? '#888' : '#1D9E75',
                        color: '#fff', border: 'none', borderRadius: 8,
                        fontSize: 13, fontWeight: 700,
                        cursor: savingTarifEcole ? 'wait' : 'pointer',
                        fontFamily: 'inherit',
                      }}>
                      {savingTarifEcole
                        ? '...'
                        : (lang === 'ar' ? '💾 حفظ' : '💾 Enregistrer')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* SECTION 2B : TARIFS INDIVIDUELS (si mode = 'individuel') */}
            {/* ═══════════════════════════════════════════════════════ */}
            {modeTarif === 'individuel' && (
              <div style={{
                background: '#fff', borderRadius: 14, padding: isMobile ? 16 : 20,
                marginBottom: 16, border: '1px solid #e0e0d8',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 22 }}>👥</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                      {lang === 'ar' ? 'تعرفات الأساتذة' : 'Tarifs par instituteur'}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      {lang === 'ar'
                        ? `${instituteurs.length} أستاذ`
                        : `${instituteurs.length} instituteur${instituteurs.length > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>

                {instLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>
                    {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
                  </div>
                ) : instituteurs.length === 0 ? (
                  <div style={{
                    padding: 30, textAlign: 'center', color: '#888',
                    background: '#f5f5f0', borderRadius: 10, border: '1px dashed #ccc',
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍🏫</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {lang === 'ar' ? 'لا يوجد أساتذة' : 'Aucun instituteur'}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {lang === 'ar' ? 'أضف الأساتذة في صفحة الإدارة أولاً' : 'Ajoute des instituteurs depuis Gestion d\'abord'}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {instituteurs.map(inst => (
                      <InstituteurTarifRow
                        key={inst.id}
                        inst={inst}
                        valueEdit={tarifsEdits[inst.id] || ''}
                        onChangeEdit={v => setTarifsEdits(s => ({ ...s, [inst.id]: v }))}
                        onSave={() => saveTarifInst(inst.id)}
                        saving={!!savingInst[inst.id]}
                        isMobile={isMobile}
                        lang={lang}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Composant : carte de choix de mode (tarif école / individuel)
// ──────────────────────────────────────────────────────────────
function ModeCard({ icon, title, description, active, onClick, color }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? color : '#fff',
        color: active ? '#fff' : '#1a1a1a',
        border: active ? `2px solid ${color}` : '1.5px solid #e0e0d8',
        borderRadius: 12, padding: '14px 16px',
        cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 2px 8px ${color}25`; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = '#e0e0d8'; e.currentTarget.style.boxShadow = 'none'; } }}
    >
      <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, opacity: active ? 0.9 : 0.7 }}>{description}</div>
      </div>
      {active && <div style={{ fontSize: 18, flexShrink: 0 }}>✓</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Composant : ligne tarif d'un instituteur
// ──────────────────────────────────────────────────────────────
function InstituteurTarifRow({ inst, valueEdit, onChangeEdit, onSave, saving, isMobile, lang }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: '#f9f9f5', borderRadius: 10,
      border: '1px solid #e0e0d8',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
    }}>
      {inst.instituteur_id_ecole && (
        <div style={{
          padding: '4px 8px', background: '#E1F5EE', color: '#085041',
          borderRadius: 6, fontSize: 10, fontWeight: 700,
          flexShrink: 0,
        }}>{inst.instituteur_id_ecole}</div>
      )}
      <div style={{
        fontSize: 14, fontWeight: 600, color: '#1a1a1a',
        flex: isMobile ? '1 1 100%' : 1, minWidth: 0,
      }}>
        {inst.prenom} {inst.nom}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <input type="number" min="0" step="0.01"
          value={valueEdit}
          onChange={e => onChangeEdit(e.target.value)}
          placeholder="—"
          style={{
            width: 90, padding: '7px 10px',
            fontSize: 13, fontWeight: 700,
            borderRadius: 8, border: '1px solid #e0e0d8',
            background: '#fff', color: '#1a1a1a',
            fontFamily: 'inherit', textAlign: 'center', outline: 'none',
          }} />
        <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
          {lang === 'ar' ? 'د.' : 'DH'}
        </span>
        <button onClick={onSave} disabled={saving}
          style={{
            padding: '7px 12px',
            background: saving ? '#888' : '#1D9E75',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 11, fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit',
          }}>
          {saving ? '...' : '💾'}
        </button>
      </div>
    </div>
  );
}
