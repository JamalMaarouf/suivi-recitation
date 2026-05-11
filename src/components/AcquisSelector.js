// ═══════════════════════════════════════════════════════════════════════════
// AcquisSelector — Composant partagé PC + mobile
// ═══════════════════════════════════════════════════════════════════════════
//
// Permet au surveillant/instituteur de definir les acquis anterieurs
// d'un eleve (Hizb deja memorises OU sourates deja apprises).
//
// Initialement dans Gestion.js (function AcquisSelector lignes 73-281)
// Extrait ici lors de Phase Retours Surveillant pour permettre l'usage
// dans ElevesMobile.js egalement (1 source de verite).
//
// ── REGLES METIER (validation Jamal) ──────────────────────────────────────
//
// SEMANTIQUE HIZB :
//   - Cliquer sur Hizb N → N est ACQUIS (mémorisé)
//   - Stockage hizb_depart = next(N) selon le sens :
//     * desc : hizb_depart = N - 1 (prochain Hizb a apprendre)
//     * asc  : hizb_depart = N + 1
//   - Aucun tomon coche par defaut (tomon_depart = 0 lors du clic Hizb)
//
// SEMANTIQUE SOURATE :
//   - 114 sourates chargees depuis BDD (table 'sourates') triees par numero
//   - Affichage selon le sens du niveau (asc : 1→114, desc : 114→1)
//   - Cliquer sur sourate de rang R dans le sens → les R premieres deviennent acquises
//   - Stockage sourates_acquises = R (modele "nombre" preserve)
//
// COMPTEUR BLOCS :
//   - Pour les niveaux organises en blocs, compter inclusivement les Hizb acquis
//   - Si bloc complet → point de depart = premier Hizb du bloc suivant
//
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import { calcPoints } from '../lib/helpers';
import { SOURATES_CORAN } from '../lib/sourates';

export default function AcquisSelector({
  codeNiveau,
  hizb, tomon,
  onHizbChange, onTomonChange,
  souratesAcquises, onSouratesChange,
  lang,
  niveauxDyn = [],
  sens = 'desc',
  programmeNiveau = [],
}) {
  const _niv = niveauxDyn.find(n => n.code === codeNiveau);
  const isSourate = _niv ? _niv.type === 'sourate' : ['5B', '5A', '2M'].includes(codeNiveau);

  // ══════════════════════════════════════════════════════════════════════
  // VUE SOURATES (114 du Coran - hardcodees dans le code source)
  // ══════════════════════════════════════════════════════════════════════
  // Note : la table BDD 'sourates' peut etre incomplete ou mal triee
  // (validation Jamal). On utilise donc la constante SOURATES_CORAN
  // qui contient les 114 sourates dans l'ordre coranique.
  if (isSourate) {
    // Ordre selon sens : asc = 1 → 114, desc = 114 → 1
    const souratesOrdonnees = [...SOURATES_CORAN].sort((a, b) =>
      sens === 'asc' ? a.numero - b.numero : b.numero - a.numero);
    const nbAcquis = souratesAcquises || 0;
    const ptsAcquis = nbAcquis * 30; // 30 pts par sourate complete

    return (
      <div style={{ background: '#f9f9f6', borderRadius: 12, padding: '1rem', border: '0.5px solid #e0e0d8' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 10, textAlign: 'center' }}>
          {lang === 'ar' ? 'عدد السور المحفوظة قبل بدء المتابعة' : lang === 'en' ? 'Surahs memorized before tracking' : 'Sourates mémorisées avant le début du suivi'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={() => onSouratesChange(Math.max(0, nbAcquis - 1))}
            style={{ width: 36, height: 36, border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>−</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#1D9E75' }}>{nbAcquis}</div>
            <div style={{ fontSize: 11, color: '#888' }}>/ {souratesOrdonnees.length} {lang === 'ar' ? 'سورة' : lang === 'en' ? 'surahs' : 'sourates'}</div>
            <div style={{ fontSize: 11, color: nbAcquis === 0 ? '#888' : '#1D9E75', marginTop: 4, fontWeight: 600 }}>
              {nbAcquis === 0
                ? (lang === 'ar' ? 'لا توجد مكتسبات سابقة' : 'Aucun acquis antérieur')
                : `${lang === 'ar' ? 'من' : 'De'} ${souratesOrdonnees[nbAcquis - 1]?.numero || ''} ${lang === 'ar' ? 'إلى' : 'à'} ${souratesOrdonnees[0]?.numero || ''}`}
            </div>
          </div>
          <button onClick={() => onSouratesChange(Math.min(souratesOrdonnees.length, nbAcquis + 1))}
            style={{ width: 36, height: 36, border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
        </div>

        {/* Grille visuelle des 114 sourates */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 10 }}>
          {souratesOrdonnees.map((s, idx) => {
            const isAcquis = idx < nbAcquis;
            return (
              <div key={s.numero}
                onClick={() => onSouratesChange(isAcquis ? idx : idx + 1)}
                style={{
                  borderRadius: 6, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '6px 4px', cursor: 'pointer', gap: 2,
                  background: isAcquis ? '#1D9E75' : '#f0f0ec',
                  color: isAcquis ? '#fff' : '#999',
                  border: `0.5px solid ${isAcquis ? '#1D9E75' : '#e0e0d8'}`,
                  transition: 'all 0.1s',
                }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{s.numero}</div>
                <div style={{
                  fontSize: 9, fontFamily: "'Tajawal',Arial,sans-serif", direction: 'rtl',
                  textAlign: 'center', lineHeight: 1.2, opacity: isAcquis ? 0.9 : 0.7,
                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {(s.nom_ar || '').replace('سورة ', '')}
                </div>
              </div>
            );
          })}
        </div>

        {nbAcquis > 0 && (
          <div style={{ background: '#E1F5EE', borderRadius: 10, padding: '10px', textAlign: 'center', border: '0.5px solid #9FE1CB' }}>
            <div style={{ fontSize: 11, color: '#085041', fontWeight: 600, marginBottom: 2 }}>
              🎓 {nbAcquis} {lang === 'ar' ? 'سورة محفوظة' : lang === 'en' ? 'surahs memorized' : 'sourates mémorisées'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#085041' }}>{ptsAcquis.toLocaleString()} {lang === 'ar' ? 'ن' : 'pts'}</div>
            <div style={{ fontSize: 10, color: '#0F6E56', marginTop: 2 }}>
              {lang === 'ar' ? 'ستُحسب تلقائياً' : lang === 'en' ? 'Auto-calculated' : 'Calculés automatiquement'}
            </div>
            {nbAcquis > 0 && (
              <div style={{ fontSize: 11, color: '#085041', marginTop: 4, direction: 'rtl' }}>
                {lang === 'ar' ? 'آخر سورة:' : lang === 'en' ? 'Last surah:' : 'Dernière sourate :'} {souratesOrdonnees[nbAcquis - 1]?.nom_ar}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // VUE HIZB / TOMON (60 hizbs)
  // ══════════════════════════════════════════════════════════════════════
  const hizbList = sens === 'asc'
    ? Array.from({ length: 60 }, (_, i) => i + 1)   // 1, 2, ..., 60
    : Array.from({ length: 60 }, (_, i) => 60 - i); // 60, 59, ..., 1
  const senshHintFR = sens === 'asc' ? '1 → 60' : '60 → 1';
  const senshHintAR = sens === 'asc' ? 'من 1 نحو 60' : 'من 60 نحو 1';

  // ── FIX RETOURS SURVEILLANT (validation Jamal) ─────────────────────────
  // Sémantique précédente : hizb stocké = hizb cliqué = point de départ
  // Nouvelle sémantique : hizb cliqué = ACQUIS, hizb_depart = next(cliqué)
  //
  // Donc visuellement, l'utilisateur clique sur N pour dire "N est acquis"
  // mais le composant stocke next(N) :
  //   - desc : next = N - 1 (Hizb suivant à apprendre dans le sens 60→1)
  //   - asc  : next = N + 1
  //
  // Et l'inverse : le hizb stocké (hizb_depart) doit etre converti en
  // "dernier acquis" pour l'affichage : prev(stocke).
  //
  // hizb = 0 (aucun acquis) -> dernierAcquis = 0
  // hizb = 56 desc -> dernierAcquis = 57 (le 57 est acquis, le 56 est le départ)
  // hizb = 5 asc  -> dernierAcquis = 4
  // ────────────────────────────────────────────────────────────────────────
  const dernierAcquis = hizb === 0 ? 0 : (sens === 'asc' ? hizb - 1 : hizb + 1);

  // Handler clic Hizb : stocker le NEXT du Hizb cliqué + reset tomon a 0
  const handleHizbClick = (n) => {
    // Cas "deselection" : si on re-clique sur le Hizb déjà acquis
    if (n === dernierAcquis) {
      onHizbChange(0);
      onTomonChange(0);
      return;
    }
    // Calculer le prochain Hizb à apprendre selon le sens
    const next = sens === 'asc' ? n + 1 : n - 1;
    // Limites : asc clamp [1..60], desc clamp [0..60] (0 = "tout acquis" en desc, 60 = "tout acquis" en asc)
    let nextClamped;
    if (sens === 'asc') {
      // Si on clique sur 60 en asc = tout est acquis
      nextClamped = n >= 60 ? 0 : Math.max(1, Math.min(60, next));
    } else {
      // Si on clique sur 1 en desc = tout est acquis
      nextClamped = n <= 1 ? 0 : Math.max(1, Math.min(60, next));
    }
    onHizbChange(nextClamped);
    // FIX retours surveillant : aucun tomon coche par défaut
    onTomonChange(0);
  };

  // Label affiche : "Acquis : 60 → 57 · Position de départ : Hizb 56"
  let acquisLabel;
  if (hizb === 0) {
    acquisLabel = lang === 'ar' ? 'لا توجد مكتسبات سابقة' : 'Aucun acquis antérieur';
  } else {
    const range = sens === 'asc'
      ? `1 ${lang === 'ar' ? 'إلى' : 'à'} ${dernierAcquis}`
      : `60 ${lang === 'ar' ? 'إلى' : 'à'} ${dernierAcquis}`;
    acquisLabel = `${lang === 'ar' ? 'المحفوظ' : 'Acquis'} : ${range} · ${lang === 'ar' ? 'حزب الانطلاق' : 'Hizb de départ'} : ${hizb}`;
  }

  return (
    <div style={{ background: '#f9f9f6', borderRadius: 12, padding: '1rem', border: '0.5px solid #e0e0d8' }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 10, textAlign: 'center' }}>
        {lang === 'ar' ? 'موقع الطالب في القرآن قبل بدء المتابعة' : lang === 'en' ? 'Position in Quran before tracking' : 'Position dans le Coran avant de commencer le suivi'}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }}>
          {lang === 'ar' ? `انقر على آخر حزب محفوظ (${senshHintAR})` : `Cliquez sur le dernier Hizb mémorisé (${senshHintFR})`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Boutons +/- : ajustent dernierAcquis */}
          <button
            onClick={() => {
              // - : diminuer le dernier acquis (asc -1, desc +1 du hizb stocké)
              if (dernierAcquis === 0) return;
              const newDernier = Math.max(0, dernierAcquis - 1);
              if (newDernier === 0) { onHizbChange(0); onTomonChange(0); }
              else handleHizbClick(newDernier);
            }}
            style={{ width: 32, height: 32, border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>−</button>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: 3 }}>
            {hizbList.map(n => {
              // "déjà acquis" :
              // desc : tous les Hizb >= dernierAcquis (de dernierAcquis a 60)
              // asc  : tous les Hizb <= dernierAcquis (de 1 a dernierAcquis)
              const isAcquis = dernierAcquis > 0 && (sens === 'asc' ? n <= dernierAcquis : n >= dernierAcquis);
              const isLastAcquis = n === dernierAcquis;
              return (
                <div key={n} onClick={() => handleHizbClick(n)}
                  style={{
                    height: 28, borderRadius: 4, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, cursor: 'pointer',
                    background: isAcquis ? '#1D9E75' : '#f0f0ec',
                    color: isAcquis ? '#fff' : '#999',
                    fontWeight: isLastAcquis ? 800 : 400,
                    border: isLastAcquis ? '2px solid #085041' : 'none',
                    transition: 'all 0.1s',
                  }}>
                  {n}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              // + : augmenter le dernier acquis
              const max = 60;
              const newDernier = Math.min(max, dernierAcquis + 1);
              if (newDernier > 0) handleHizbClick(newDernier);
            }}
            style={{ width: 32, height: 32, border: '0.5px solid #e0e0d8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>+</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 14, fontWeight: 700, color: '#1D9E75' }}>{acquisLabel}</div>
      </div>

      {/* ─── Aide par BLOCS pédagogiques ─────────────── */}
      {programmeNiveau && programmeNiveau.length > 0 && (() => {
        // Grouper le programme par bloc
        const blocsMap = new Map();
        for (const l of programmeNiveau) {
          const n = l.bloc_numero || 1;
          if (!blocsMap.has(n)) blocsMap.set(n, { numero: n, nom: l.bloc_nom, sens: l.bloc_sens || 'asc', hizbs: [] });
          const h = parseInt(l.reference_id);
          if (!isNaN(h)) blocsMap.get(n).hizbs.push(h);
        }
        const blocsList = Array.from(blocsMap.values()).sort((a, b) => a.numero - b.numero);
        if (blocsList.length <= 1) return null; // Mono-bloc : on n'affiche rien

        // FIX RETOUR SURVEILLANT 2 : compteur inclut le Hizb dernier-acquis
        // Avant : filter h < hizb (strict) -> manquait le Hizb cliqué dans le compteur
        // Apres : on filtre sur dernierAcquis (Hizb le plus avancé acquis)
        //   asc : tous les Hizb <= dernierAcquis dans le bloc sont acquis
        //   desc : tous les Hizb >= dernierAcquis dans le bloc sont acquis
        const blocsStat = blocsList.map(b => {
          const hizbsAcquis = dernierAcquis === 0
            ? []
            : b.hizbs.filter(h => sens === 'asc' ? h <= dernierAcquis : h >= dernierAcquis);
          const estDansBloc = hizb > 0 && b.hizbs.includes(hizb);
          const total = b.hizbs.length;
          const estComplet = hizbsAcquis.length === total && total > 0;
          return { ...b, nbAcquis: hizbsAcquis.length, total, estComplet, estDansBloc };
        });

        return (
          <div style={{ marginTop: 10, background: '#F0EEFF', borderRadius: 10, padding: '10px 12px', border: '0.5px solid #534AB740' }}>
            <div style={{ fontSize: 11, color: '#534AB7', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📚</span>
              <span>{lang === 'ar' ? 'موقع الطالب حسب البلوكات' : 'Position par blocs pédagogiques'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {blocsStat.map(b => {
                const color = b.estComplet ? '#1D9E75' : (b.estDansBloc ? '#EF9F27' : (b.nbAcquis > 0 ? '#378ADD' : '#888'));
                const bg = b.estComplet ? '#E1F5EE' : (b.estDansBloc ? '#FAEEDA' : (b.nbAcquis > 0 ? '#E6F1FB' : '#f5f5f0'));
                const statut = b.estComplet
                  ? (lang === 'ar' ? 'مكتسب كامل' : 'Entièrement acquis')
                  : b.estDansBloc
                    ? (lang === 'ar' ? 'البلوك الحالي' : 'Bloc actuel')
                    : b.nbAcquis > 0
                      ? (lang === 'ar' ? 'جزئي' : 'Partiel')
                      : (lang === 'ar' ? 'غير مبدوء' : 'Non commencé');
                return (
                  <div key={b.numero} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 7, background: bg, border: `0.5px solid ${color}30` }}>
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: color, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {b.estComplet ? '✓' : b.numero}
                    </div>
                    <div style={{ flex: 1, fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{b.nom || `${lang === 'ar' ? 'البلوك' : 'Bloc'} ${b.numero}`}</div>
                      <div style={{ color: '#666', fontSize: 10 }}>{b.nbAcquis}/{b.total} · {statut}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ─── Tomon (optionnel) ─────────────────────────────────────────
          FIX retours surveillant : tomon = 0 par défaut. L'utilisateur
          choisit explicitement s'il veut indiquer une progression
          partielle dans le Hizb de départ. */}
      {hizb > 0 && <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }}>
          {lang === 'ar' ? 'الثُّمن (اختياري - 1-8)' : lang === 'en' ? 'Tomon (optional - 1-8)' : 'Tomon (optionnel - 1-8)'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 4 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => {
            const selected = n === tomon;
            const beforeSelected = tomon > 0 && n < tomon;
            return (
              <div key={n}
                onClick={() => onTomonChange(selected ? 0 : n)}
                style={{
                  height: 36, borderRadius: 6, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: selected ? 700 : 400,
                  cursor: 'pointer',
                  background: selected ? '#1D9E75' : beforeSelected ? '#E1F5EE' : '#f0f0ec',
                  color: selected ? '#fff' : beforeSelected ? '#085041' : '#999',
                  border: `0.5px solid ${selected ? '#1D9E75' : '#e0e0d8'}`,
                  transition: 'all 0.1s',
                }}>
                {n}
              </div>
            );
          })}
        </div>
        {tomon > 0 && (
          <div style={{ textAlign: 'center', marginTop: 6, fontSize: 12, color: '#888' }}>
            T.{tomon} du Hizb {hizb} · <span style={{ color: '#1D9E75', fontWeight: 600 }}>{(hizb - 1) * 8 + (tomon - 1)} {lang === 'ar' ? 'ثُمن' : lang === 'en' ? 'Tomon' : 'Tomon'} acquis</span>
          </div>
        )}
      </div>}

      {/* Points correspondants aux acquis */}
      {(hizb > 1 || tomon > 1) && (() => {
        const ta = (hizb - 1) * 8 + (tomon - 1);
        const hc = hizb - 1;
        const pts = calcPoints(ta, hc, [], ta, hc);
        return (
          <div style={{ marginTop: 10, background: '#E1F5EE', borderRadius: 10, padding: '12px', textAlign: 'center', border: '0.5px solid #9FE1CB' }}>
            <div style={{ fontSize: 11, color: '#0F6E56', marginBottom: 4, fontWeight: 600 }}>
              🎓 {lang === 'ar' ? 'النقاط المقابلة للمكتسبات السابقة' : lang === 'en' ? 'Points for prior achievements' : 'Points correspondants aux acquis'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#085041' }}>{pts.total.toLocaleString()} {lang === 'ar' ? 'ن' : 'pts'}</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              {[{ l: 'T', v: pts.ptsTomon }, { l: 'R', v: pts.ptsRoboe }, { l: 'N', v: pts.ptsNisf }, { l: 'H', v: pts.ptsHizb }].map(k => (
                <div key={k.l} style={{ background: '#fff', borderRadius: 6, padding: '4px 8px', textAlign: 'center', minWidth: 45 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1D9E75' }}>{k.v}</div>
                  <div style={{ fontSize: 9, color: '#888' }}>{k.l}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
