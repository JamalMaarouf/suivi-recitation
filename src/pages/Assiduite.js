import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { t } from '../lib/i18n';

// ══════════════════════════════════════════════════════════════════════
// PAGE ASSIDUITÉ — الحضور
// Regroupe : Saisie rapide de présence + Dashboard de suivi
// Feature retour surveillant 22/04/2026 (sujet 1/5 : Absences élèves)
// ══════════════════════════════════════════════════════════════════════

export default function Assiduite({ user, navigate, goBack, lang, isMobile }) {
  const [onglet, setOnglet] = useState('saisie');  // 'saisie' | 'suivi'

  return (
    <div style={{ background: '#f5f5f0', minHeight: '100vh', paddingBottom: 80 }}>

      {/* ─── Header vert (cohérent avec pages d'action) ─── */}
      <div style={{
        background: 'linear-gradient(135deg, #085041, #1D9E75)',
        color: '#fff',
        padding: isMobile ? '48px 16px 14px' : '24px 24px 16px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={() => goBack ? goBack() : navigate('dashboard')}
            style={{
              width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.2)',
              border: 'none', borderRadius: 10, padding: 0, flexShrink: 0,
              color: '#fff', fontSize: 18, cursor: 'pointer',
            }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
              {lang === 'ar' ? '📅 الحضور' : '📅 Assiduité'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              {lang === 'ar' ? 'تسجيل و متابعة حضور الطلاب' : 'Saisie et suivi des présences'}
            </div>
          </div>
        </div>

        {/* ─── Onglets ─── */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[
            { k: 'saisie', label: lang === 'ar' ? '✍️ تسجيل' : '✍️ Saisie' },
            { k: 'suivi',  label: lang === 'ar' ? '📊 متابعة' : '📊 Suivi' },
          ].map(tab => {
            const active = onglet === tab.k;
            return (
              <button key={tab.k} onClick={() => setOnglet(tab.k)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: 10,
                  background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: active ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Contenu ─── */}
      {onglet === 'saisie' && <OngletSaisie user={user} lang={lang} />}
      {onglet === 'suivi'  && <OngletSuivi user={user} lang={lang} navigate={navigate} />}

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ONGLET SAISIE — l'élève arrive, tape son numéro, valide sa présence
// ══════════════════════════════════════════════════════════════════════

function OngletSaisie({ user, lang }) {
  const toast = useToast();
  const [recherche, setRecherche] = useState('');
  const [eleves, setEleves] = useState([]);       // tous les élèves de l'école (chargés 1 fois)
  const [presencesToday, setPresencesToday] = useState(new Set());  // IDs des élèves déjà présents aujourd'hui
  const [loading, setLoading] = useState(true);
  const [saisieLoading, setSaisieLoading] = useState(null);  // ID de l'élève en cours de saisie
  const inputRef = useRef(null);

  // Date d'aujourd'hui au format YYYY-MM-DD (pour filtrer les présences du jour)
  const today = new Date().toISOString().slice(0, 10);

  // ─── Chargement initial : élèves + présences du jour ─────────────
  const loadData = async () => {
    setLoading(true);
    const [elevesRes, presRes] = await Promise.all([
      supabase.from('eleves')
        .select('id, prenom, nom, eleve_id_ecole, code_niveau')
        .eq('ecole_id', user.ecole_id)
        .order('eleve_id_ecole', { ascending: true })
        .limit(500),
      supabase.from('presences')
        .select('eleve_id')
        .eq('ecole_id', user.ecole_id)
        .eq('date_presence', today),
    ]);
    setEleves(elevesRes.data || []);
    setPresencesToday(new Set((presRes.data || []).map(p => p.eleve_id)));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Focus auto sur l'input pour saisie rapide
  useEffect(() => { if (!loading && inputRef.current) inputRef.current.focus(); }, [loading]);

  // ─── Filtre des résultats (match par numéro OU par nom/prénom) ──
  const r = recherche.trim().toLowerCase();
  const resultats = !r ? [] : eleves.filter(e => {
    const num = (e.eleve_id_ecole || '').toLowerCase();
    const nom = `${e.prenom || ''} ${e.nom || ''}`.toLowerCase();
    return num.includes(r) || nom.includes(r);
  }).slice(0, 8);  // max 8 résultats pour ne pas saturer l'écran

  // ─── Enregistrement de la présence ──────────────────────────────
  const enregistrerPresence = async (eleve) => {
    if (presencesToday.has(eleve.id)) {
      toast.info(lang === 'ar' ? '⚠️ الحضور مسجل مسبقا اليوم' : '⚠️ Présence déjà enregistrée aujourd\'hui');
      return;
    }
    setSaisieLoading(eleve.id);
    const { error } = await supabase.from('presences').insert({
      eleve_id: eleve.id,
      ecole_id: user.ecole_id,
      date_presence: today,
      saisi_par: user.id || null,
    });
    setSaisieLoading(null);
    if (error) {
      // Si la contrainte UNIQUE bloque (doublon race condition), on informe gentiment
      if (error.code === '23505') {
        toast.info(lang === 'ar' ? '⚠️ الحضور مسجل مسبقا اليوم' : '⚠️ Présence déjà enregistrée aujourd\'hui');
        setPresencesToday(prev => new Set([...prev, eleve.id]));
      } else {
        console.error('[enregistrerPresence]', error);
        toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + error.message);
      }
      return;
    }
    // Succès
    toast.success(lang === 'ar'
      ? `✅ تم تسجيل حضور ${eleve.prenom} ${eleve.nom}`
      : `✅ Présence enregistrée : ${eleve.prenom} ${eleve.nom}`);
    setPresencesToday(prev => new Set([...prev, eleve.id]));
    // Reset du champ pour enchaîner l'élève suivant
    setRecherche('');
    if (inputRef.current) inputRef.current.focus();
  };

  // ─── Rendu ──────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
      {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
    </div>;
  }

  return (
    <div style={{ padding: '16px' }}>

      {/* ─── Compteur du jour ─── */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 14,
        border: '1px solid #e0e0d8',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: '#E1F5EE', color: '#085041',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>✓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#888' }}>
            {lang === 'ar' ? 'الحضور اليوم' : 'Présences aujourd\'hui'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>
            {presencesToday.size} / {eleves.length}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', {
            weekday: 'long', day: '2-digit', month: 'short',
          })}
        </div>
      </div>

      {/* ─── Champ de recherche ─── */}
      <div style={{ marginBottom: 14 }}>
        <input ref={inputRef}
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder={lang === 'ar'
            ? '🔍 أدخل رقم التعريف أو اسم الطالب'
            : '🔍 Tape le numéro élève ou son nom'}
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: 16,
            borderRadius: 12,
            border: '2px solid #1D9E75',
            background: '#fff',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            outline: 'none',
          }}/>
      </div>

      {/* ─── Résultats ─── */}
      {recherche.trim() === '' ? (
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '30px 20px',
          textAlign: 'center',
          color: '#888',
          border: '1px dashed #ccc',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
          <div style={{ fontSize: 13 }}>
            {lang === 'ar'
              ? 'اطلب من الطالب إدخال رقمه'
              : 'Demande à l\'élève de taper son numéro'}
          </div>
        </div>
      ) : resultats.length === 0 ? (
        <div style={{
          background: '#FCEBEB',
          borderRadius: 12,
          padding: '20px',
          textAlign: 'center',
          color: '#A32D2D',
          border: '1px solid #E24B4A40',
        }}>
          {lang === 'ar' ? '❌ لا يوجد طالب بهذا الرقم' : '❌ Aucun élève trouvé'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resultats.map(eleve => {
            const dejaPresent = presencesToday.has(eleve.id);
            const enCours = saisieLoading === eleve.id;
            return (
              <div key={eleve.id} style={{
                background: '#fff',
                borderRadius: 12,
                padding: '14px 16px',
                border: dejaPresent ? '1.5px solid #1D9E75' : '1px solid #e0e0d8',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {/* Badge numéro */}
                <div style={{
                  minWidth: 48, height: 48, padding: '0 8px', borderRadius: 10,
                  background: dejaPresent ? '#1D9E75' : '#E1F5EE',
                  color: dejaPresent ? '#fff' : '#085041',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  {eleve.eleve_id_ecole || '—'}
                </div>
                {/* Nom + niveau */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                    {eleve.prenom} {eleve.nom}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {eleve.code_niveau || '—'}
                  </div>
                </div>
                {/* Bouton de validation */}
                {dejaPresent ? (
                  <div style={{
                    padding: '8px 14px',
                    background: '#E1F5EE',
                    color: '#085041',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    ✓ {lang === 'ar' ? 'حاضر' : 'Présent'}
                  </div>
                ) : (
                  <button
                    disabled={enCours}
                    onClick={() => enregistrerPresence(eleve)}
                    style={{
                      padding: '10px 16px',
                      background: enCours ? '#888' : '#1D9E75',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: enCours ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                    {enCours
                      ? (lang === 'ar' ? '...' : '...')
                      : (lang === 'ar' ? '✓ تسجيل' : '✓ Valider')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ONGLET SUIVI — dashboard de suivi (à coder dans l'étape 4/7)
// ══════════════════════════════════════════════════════════════════════

function OngletSuivi({ user, lang, navigate }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
        {lang === 'ar' ? 'قيد التطوير' : 'En cours de développement'}
      </div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
        {lang === 'ar'
          ? 'لوحة متابعة الحضور — قريبا'
          : 'Dashboard de suivi des présences — bientôt disponible'}
      </div>
    </div>
  );
}
