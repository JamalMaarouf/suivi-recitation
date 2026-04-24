import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales } from '../lib/helpers';

// ══════════════════════════════════════════════════════════════════════
// COMPOSANT <GlobalSearch>
//
// Modale de recherche transversale style Spotlight / Ctrl+K.
// Cherche simultanément dans : élèves, parents, instituteurs.
// Affichage groupé par catégorie, max 5 résultats par catégorie.
//
// USAGE
// -----
// <GlobalSearch
//   isOpen={searchOpen}
//   onClose={() => setSearchOpen(false)}
//   user={user}
//   lang={lang}
//   navigate={navigate}
// />
//
// RACCOURCI : Ctrl+K (Cmd+K sur Mac) déclenche l'ouverture. Géré par
// le parent (App.js) via un listener global.
//
// SCOPE MVP : eleves + parents + instituteurs uniquement.
// Extensions possibles : validations, certificats, examens.
// ══════════════════════════════════════════════════════════════════════

const MAX_RESULTS_PER_CAT = 5;

export default function GlobalSearch({ isOpen, onClose, user, lang = 'fr', navigate }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ eleves: [], parents: [], instituteurs: [], niveaux: [] });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const isAr = lang === 'ar';

  // ─── Focus input à l'ouverture + reset state ───────────────
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      loadData();
    }
  }, [isOpen]); // eslint-disable-line

  // ─── Debounce la frappe pour éviter re-renders inutiles ────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [query]);

  // ─── Chargement des données (1 seule fois à l'ouverture) ───
  const loadData = async () => {
    setLoading(true);
    try {
      const [elevesRes, parentsRes, institsRes, niveauxRes] = await Promise.all([
        supabase.from('eleves')
          .select('id,prenom,nom,eleve_id_ecole,code_niveau,instituteur_referent_id')
          .eq('ecole_id', user.ecole_id)
          .limit(500),
        supabase.from('utilisateurs')
          .select('id,prenom,nom,telephone,identifiant')
          .eq('ecole_id', user.ecole_id)
          .eq('role', 'parent')
          .limit(500),
        supabase.from('utilisateurs')
          .select('id,prenom,nom,telephone')
          .eq('ecole_id', user.ecole_id)
          .eq('role', 'instituteur')
          .limit(200),
        supabase.from('niveaux')
          .select('code,nom,couleur')
          .eq('ecole_id', user.ecole_id),
      ]);
      setData({
        eleves: elevesRes.data || [],
        parents: parentsRes.data || [],
        instituteurs: institsRes.data || [],
        niveaux: niveauxRes.data || [],
      });
    } catch (err) {
      console.error('[GlobalSearch] loadData error:', err);
    }
    setLoading(false);
  };

  // ─── Scope selon le rôle de l'utilisateur ───────────────────
  // - Surveillant : voit tout
  // - Instituteur : voit uniquement ses élèves référents
  // - Parent : n'a pas cette modale (bloqué en amont)
  const scopedEleves = useMemo(() => {
    if (user?.role === 'instituteur') {
      return data.eleves.filter(e => e.instituteur_referent_id === user.id);
    }
    return data.eleves;
  }, [data.eleves, user]);

  // ─── Calcul des résultats filtrés ──────────────────────────
  const results = useMemo(() => {
    const q = debouncedQuery;
    if (!q || q.length < 1) {
      return { eleves: [], parents: [], instituteurs: [] };
    }

    const matchText = (text) => (text || '').toString().toLowerCase().includes(q);

    // Élèves : match sur prénom, nom, N° élève, ou combinaison
    const eleves = scopedEleves.filter(e => {
      const fullName = `${e.prenom || ''} ${e.nom || ''}`.toLowerCase();
      return (
        matchText(e.prenom) ||
        matchText(e.nom) ||
        matchText(e.eleve_id_ecole) ||
        fullName.includes(q)
      );
    }).slice(0, MAX_RESULTS_PER_CAT);

    // Parents (uniquement si surveillant)
    const parents = user?.role === 'surveillant'
      ? data.parents.filter(p => {
          const fullName = `${p.prenom || ''} ${p.nom || ''}`.toLowerCase();
          return (
            matchText(p.prenom) ||
            matchText(p.nom) ||
            matchText(p.telephone) ||
            matchText(p.identifiant) ||
            fullName.includes(q)
          );
        }).slice(0, MAX_RESULTS_PER_CAT)
      : [];

    // Instituteurs (uniquement si surveillant)
    const instituteurs = user?.role === 'surveillant'
      ? data.instituteurs.filter(i => {
          const fullName = `${i.prenom || ''} ${i.nom || ''}`.toLowerCase();
          return (
            matchText(i.prenom) ||
            matchText(i.nom) ||
            matchText(i.telephone) ||
            fullName.includes(q)
          );
        }).slice(0, MAX_RESULTS_PER_CAT)
      : [];

    return { eleves, parents, instituteurs };
  }, [debouncedQuery, scopedEleves, data, user]);

  // ─── Liste aplatie pour navigation clavier ────────────────
  const flatResults = useMemo(() => {
    const flat = [];
    results.eleves.forEach(e => flat.push({ type: 'eleve', item: e }));
    results.parents.forEach(p => flat.push({ type: 'parent', item: p }));
    results.instituteurs.forEach(i => flat.push({ type: 'instituteur', item: i }));
    return flat;
  }, [results]);

  // ─── Reset selectedIndex quand les résultats changent ─────
  useEffect(() => { setSelectedIndex(0); }, [debouncedQuery]);

  // ─── Navigation clavier ───────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults.length > 0) {
      e.preventDefault();
      handleSelect(flatResults[selectedIndex]);
    }
  };

  // ─── Action à la sélection ────────────────────────────────
  const handleSelect = (entry) => {
    onClose();
    if (entry.type === 'eleve') {
      navigate('fiche', entry.item);
    } else if (entry.type === 'parent') {
      // Pas de page dédiée parent → direction Gestion > onglet Parents
      navigate('gestion');
    } else if (entry.type === 'instituteur') {
      navigate('profil_instituteur', entry.item);
    }
  };

  // ─── Helpers de rendu ─────────────────────────────────────
  const getNiveauColor = (code) => {
    return data.niveaux.find(n => n.code === code)?.couleur || '#888';
  };
  const getNiveauNom = (code) => {
    return data.niveaux.find(n => n.code === code)?.nom || code;
  };
  const getInstNom = (id) => {
    const inst = data.instituteurs.find(i => i.id === id);
    return inst ? `${inst.prenom} ${inst.nom}` : '';
  };

  if (!isOpen) return null;

  // ─── Rendu d'une ligne résultat ───────────────────────────
  const renderEleve = (e, absoluteIdx) => {
    const isSelected = absoluteIdx === selectedIndex;
    const couleur = getNiveauColor(e.code_niveau);
    const instNom = getInstNom(e.instituteur_referent_id);
    return (
      <div key={`eleve-${e.id}`}
        onClick={() => handleSelect({ type: 'eleve', item: e })}
        onMouseEnter={() => setSelectedIndex(absoluteIdx)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderRadius: 10,
          background: isSelected ? '#E1F5EE' : 'transparent',
          cursor: 'pointer',
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#378ADD20', color: '#378ADD',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>
          {getInitiales(e.prenom, e.nom)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
            {e.prenom} {e.nom}
          </div>
          <div style={{ fontSize: 11, color: '#888', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {e.eleve_id_ecole && <span>N° {e.eleve_id_ecole}</span>}
            {e.code_niveau && (
              <span style={{
                padding: '1px 7px', borderRadius: 8,
                background: `${couleur}20`, color: couleur, fontWeight: 700,
              }}>{getNiveauNom(e.code_niveau)}</span>
            )}
            {instNom && <span style={{ fontStyle: 'italic' }}>· {instNom}</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderParent = (p, absoluteIdx) => {
    const isSelected = absoluteIdx === selectedIndex;
    return (
      <div key={`parent-${p.id}`}
        onClick={() => handleSelect({ type: 'parent', item: p })}
        onMouseEnter={() => setSelectedIndex(absoluteIdx)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderRadius: 10,
          background: isSelected ? '#FAEEDA' : 'transparent',
          cursor: 'pointer',
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#EF9F2720', color: '#EF9F27',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>
          {getInitiales(p.prenom, p.nom)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
            {p.prenom} {p.nom}
          </div>
          <div style={{ fontSize: 11, color: '#888', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.telephone && <span style={{ fontFamily: 'monospace' }}>📞 {p.telephone}</span>}
            {p.identifiant && <span>· {p.identifiant}</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderInst = (i, absoluteIdx) => {
    const isSelected = absoluteIdx === selectedIndex;
    return (
      <div key={`inst-${i.id}`}
        onClick={() => handleSelect({ type: 'instituteur', item: i })}
        onMouseEnter={() => setSelectedIndex(absoluteIdx)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderRadius: 10,
          background: isSelected ? '#EEEDFE' : 'transparent',
          cursor: 'pointer',
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#534AB720', color: '#534AB7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>
          {getInitiales(i.prenom, i.nom)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
            {i.prenom} {i.nom}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            {i.telephone ? <span style={{ fontFamily: 'monospace' }}>📞 {i.telephone}</span> : (isAr ? 'بدون هاتف' : 'Sans téléphone')}
          </div>
        </div>
      </div>
    );
  };

  const totalResults = flatResults.length;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh', paddingLeft: 16, paddingRight: 16,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        dir={isAr ? 'rtl' : 'ltr'}
        style={{
          background: '#fff', width: '100%', maxWidth: 620,
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxHeight: '75vh', display: 'flex', flexDirection: 'column',
        }}>
        {/* Input de recherche */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #f0f0ec',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isAr
              ? 'ابحث عن طالب، ولي أمر، مؤطر...'
              : 'Rechercher un élève, parent, instituteur...'}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 16, fontFamily: 'inherit', color: '#1a1a1a',
              background: 'transparent',
            }}
          />
          <kbd style={{
            padding: '2px 8px', background: '#f5f5f0',
            borderRadius: 6, fontSize: 10, color: '#888',
            fontFamily: 'monospace', border: '1px solid #e0e0d8',
          }}>Esc</kbd>
        </div>

        {/* Zone résultats scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading && (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>
              {isAr ? '...جاري التحميل' : 'Chargement...'}
            </div>
          )}

          {!loading && !debouncedQuery && (
            <div style={{ padding: 30, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💡</div>
              <div>
                {isAr
                  ? 'ابدأ الكتابة للبحث في جميع البيانات'
                  : 'Commencez à taper pour rechercher dans toutes les données'}
              </div>
              <div style={{ marginTop: 10, fontSize: 11 }}>
                {isAr ? 'طلاب · أولياء · مؤطرون' : 'Élèves · Parents · Instituteurs'}
              </div>
            </div>
          )}

          {!loading && debouncedQuery && totalResults === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              {isAr
                ? `لا نتائج لـ "${debouncedQuery}"`
                : `Aucun résultat pour "${debouncedQuery}"`}
            </div>
          )}

          {!loading && totalResults > 0 && (
            <>
              {/* Élèves */}
              {results.eleves.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    padding: '8px 14px 4px',
                    fontSize: 10, fontWeight: 700, color: '#888',
                    textTransform: 'uppercase', letterSpacing: '0.8px',
                  }}>
                    👤 {isAr ? 'الطلاب' : 'Élèves'} ({results.eleves.length})
                  </div>
                  {results.eleves.map((e, i) => renderEleve(e, i))}
                </div>
              )}

              {/* Parents */}
              {results.parents.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    padding: '8px 14px 4px',
                    fontSize: 10, fontWeight: 700, color: '#888',
                    textTransform: 'uppercase', letterSpacing: '0.8px',
                  }}>
                    👨‍👩 {isAr ? 'الأولياء' : 'Parents'} ({results.parents.length})
                  </div>
                  {results.parents.map((p, i) => renderParent(p, results.eleves.length + i))}
                </div>
              )}

              {/* Instituteurs */}
              {results.instituteurs.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    padding: '8px 14px 4px',
                    fontSize: 10, fontWeight: 700, color: '#888',
                    textTransform: 'uppercase', letterSpacing: '0.8px',
                  }}>
                    👨‍🏫 {isAr ? 'المؤطرون' : 'Instituteurs'} ({results.instituteurs.length})
                  </div>
                  {results.instituteurs.map((inst, i) =>
                    renderInst(inst, results.eleves.length + results.parents.length + i)
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer avec raccourcis */}
        <div style={{
          padding: '8px 14px', borderTop: '1px solid #f0f0ec',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: '#888',
          background: '#fafaf7',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span><kbd style={{ padding: '1px 5px', background: '#fff', border: '1px solid #e0e0d8', borderRadius: 4 }}>↑↓</kbd> {isAr ? 'تنقل' : 'Naviguer'}</span>
            <span><kbd style={{ padding: '1px 5px', background: '#fff', border: '1px solid #e0e0d8', borderRadius: 4 }}>↵</kbd> {isAr ? 'فتح' : 'Ouvrir'}</span>
          </div>
          {totalResults > 0 && (
            <span>{totalResults} {isAr ? 'نتيجة' : 'résultat(s)'}</span>
          )}
        </div>
      </div>
    </div>
  );
}
