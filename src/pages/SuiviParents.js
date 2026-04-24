import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import ExportButtons from '../components/ExportButtons';

// ══════════════════════════════════════════════════════════════════════
// PAGE SUIVI PARENTS — Menu principal surveillant
//
// Objectif metier : identifier les parents qui ne consultent pas le
// portail pour pouvoir les contacter oralement.
//
// Classification (seuils configurables dans Gestion > Parametres) :
//   🟢 actif       : derniere visite <= seuil_actif (defaut 7j)
//   🟡 peu_actif   : seuil_actif < derniere visite <= seuil_peu_actif (defaut 30j)
//   🔴 inactif     : derniere visite > seuil_peu_actif
//   ⚪ jamais      : aucune visite enregistree
//
// Calcul cote application a partir des tables :
//   - utilisateurs (role='parent') : liste des parents + telephone
//   - parents_enfants (si existe) ou direct eleves.parent_id
//   - parents_visites : max(date_visite) par (parent, eleve)
// ══════════════════════════════════════════════════════════════════════

export default function SuiviParents({ user, navigate, goBack, lang, isMobile }) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [seuils, setSeuils] = useState({ actif: 7, peuActif: 30 });
  const [parents, setParents] = useState([]);     // liste enrichie
  const [filtreNiveau, setFiltreNiveau] = useState('tous');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [niveaux, setNiveaux] = useState([]);

  // ─── Chargement ─────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);

    // 1) Seuils ecole
    const { data: ecoleData } = await supabase.from('ecoles')
      .select('seuil_parent_actif_jours, seuil_parent_peu_actif_jours')
      .eq('id', user.ecole_id).maybeSingle();
    const seuilActif = ecoleData?.seuil_parent_actif_jours ?? 7;
    const seuilPeuActif = ecoleData?.seuil_parent_peu_actif_jours ?? 30;
    setSeuils({ actif: seuilActif, peuActif: seuilPeuActif });

    // 2) Charger en parallèle : niveaux + parents + eleves + liaisons + visites
    const [niveauxRes, parentsRes, elevesRes, liaisonsRes, visitesRes] = await Promise.all([
      supabase.from('niveaux').select('code, nom, couleur, ordre').eq('ecole_id', user.ecole_id).order('ordre'),
      supabase.from('utilisateurs')
        .select('id, prenom, nom, identifiant, telephone')
        .eq('ecole_id', user.ecole_id)
        .eq('role', 'parent'),
      supabase.from('eleves')
        .select('id, prenom, nom, code_niveau, eleve_id_ecole')
        .eq('ecole_id', user.ecole_id),
      supabase.from('parent_eleve')
        .select('parent_id, eleve_id'),
      supabase.from('parents_visites')
        .select('parent_id, eleve_id, date_visite, onglets_visites, nb_consultations')
        .eq('ecole_id', user.ecole_id),
    ]);

    setNiveaux(niveauxRes.data || []);
    const parentsList = parentsRes.data || [];
    const elevesList = elevesRes.data || [];
    const liaisonsList = liaisonsRes.data || [];
    const visitesList = visitesRes.data || [];

    // Index liaisons par parent pour lookup rapide
    const parentByEleve = {};
    liaisonsList.forEach(l => { parentByEleve[l.eleve_id] = l.parent_id; });

    // 3) Construction d'une vue enrichie : 1 ligne par couple (parent, enfant)
    // pour pouvoir filtrer par niveau et trier par dernière visite
    const lignes = [];
    const now = new Date();
    const today = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00`);

    elevesList.forEach(eleve => {
      const parentId = parentByEleve[eleve.id];
      if (!parentId) return;  // élève sans parent lié : skip
      const parent = parentsList.find(p => p.id === parentId);
      if (!parent) return;

      // Trouver la dernière visite de CE parent pour CE enfant
      const visitesParEnfant = visitesList.filter(v =>
        v.parent_id === parent.id && v.eleve_id === eleve.id
      );
      // Tri décroissant
      visitesParEnfant.sort((a, b) => new Date(b.date_visite) - new Date(a.date_visite));
      const derniereVisite = visitesParEnfant[0];

      // Calcul jours écoulés
      let joursEcoules = null;
      if (derniereVisite) {
        const dv = new Date(derniereVisite.date_visite + 'T00:00:00');
        joursEcoules = Math.floor((today - dv) / (1000 * 60 * 60 * 24));
      }

      // Classification
      let statut;
      if (joursEcoules === null) statut = 'jamais';
      else if (joursEcoules <= seuilActif) statut = 'actif';
      else if (joursEcoules <= seuilPeuActif) statut = 'peu_actif';
      else statut = 'inactif';

      // Agréger onglets consultés (union sur toutes les visites)
      const setOnglets = new Set();
      visitesParEnfant.forEach(v => {
        (v.onglets_visites || []).forEach(o => setOnglets.add(o));
      });

      // Total consultations (somme nb_consultations)
      const totalConsult = visitesParEnfant.reduce((s, v) => s + (v.nb_consultations || 0), 0);

      lignes.push({
        parent,
        eleve,
        derniereVisite,
        joursEcoules,
        statut,
        nbVisitesJours: visitesParEnfant.length,  // nb de jours uniques de visite
        nbConsultTotal: totalConsult,
        onglets: Array.from(setOnglets),
      });
    });

    setParents(lignes);
    setLoading(false);
  };
  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, []);

  // ─── Stats globales ─────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { total: parents.length, actif: 0, peu_actif: 0, inactif: 0, jamais: 0 };
    parents.forEach(p => { s[p.statut]++; });
    return s;
  }, [parents]);

  // ─── Filtrage + tri ────────────────────────────────────────
  const parentsFiltres = useMemo(() => {
    let list = parents;
    if (filtreNiveau !== 'tous') {
      list = list.filter(p => p.eleve.code_niveau === filtreNiveau);
    }
    if (filtreStatut !== 'tous') {
      list = list.filter(p => p.statut === filtreStatut);
    }
    if (recherche.trim()) {
      const r = recherche.trim().toLowerCase();
      list = list.filter(p =>
        (p.parent.prenom || '').toLowerCase().includes(r) ||
        (p.parent.nom || '').toLowerCase().includes(r) ||
        (p.eleve.prenom || '').toLowerCase().includes(r) ||
        (p.eleve.nom || '').toLowerCase().includes(r) ||
        (p.eleve.eleve_id_ecole || '').toLowerCase().includes(r)
      );
    }
    // Tri : jamais venu en premier, puis inactifs les plus anciens, ...
    const ordreStatut = { jamais: 0, inactif: 1, peu_actif: 2, actif: 3 };
    list.sort((a, b) => {
      const diff = ordreStatut[a.statut] - ordreStatut[b.statut];
      if (diff !== 0) return diff;
      // Même statut : plus anciens d'abord
      return (b.joursEcoules || 999999) - (a.joursEcoules || 999999);
    });
    return list;
  }, [parents, filtreNiveau, filtreStatut, recherche]);

  // ─── Export Excel ───────────────────────────────────────────
  const exportExcel = async () => {
    if (parentsFiltres.length === 0) {
      toast.info(lang === 'ar' ? 'لا توجد بيانات للتصدير' : 'Aucune donnée à exporter');
      return;
    }
    const headers = [
      lang === 'ar' ? 'اسم الولي' : 'Nom parent',
      lang === 'ar' ? 'اسم الطالب' : 'Nom enfant',
      lang === 'ar' ? 'المستوى' : 'Niveau',
      lang === 'ar' ? 'الهاتف' : 'Téléphone',
      lang === 'ar' ? 'المعرف' : 'Identifiant',
      lang === 'ar' ? 'آخر زيارة' : 'Dernière visite',
      lang === 'ar' ? 'الأيام المنقضية' : 'Jours écoulés',
      lang === 'ar' ? 'عدد أيام الزيارة' : 'Nb jours visités',
      lang === 'ar' ? 'عدد الاستشارات' : 'Nb consultations',
      lang === 'ar' ? 'الحالة' : 'Statut',
    ];

    const statutLabel = s => ({
      actif: lang === 'ar' ? 'نشط' : 'Actif',
      peu_actif: lang === 'ar' ? 'قليل النشاط' : 'Peu actif',
      inactif: lang === 'ar' ? 'غير نشط' : 'Inactif',
      jamais: lang === 'ar' ? 'لم يزر' : 'Jamais venu',
    }[s]);

    const rows = parentsFiltres.map(p => [
      `${p.parent.prenom || ''} ${p.parent.nom || ''}`.trim(),
      `${p.eleve.prenom || ''} ${p.eleve.nom || ''}`.trim(),
      niveaux.find(n => n.code === p.eleve.code_niveau)?.nom || p.eleve.code_niveau || '',
      p.parent.telephone || '',
      p.parent.identifiant || '',
      p.derniereVisite?.date_visite || '',
      p.joursEcoules !== null ? p.joursEcoules : '',  // number (pas string) pour Excel
      p.nbVisitesJours,
      p.nbConsultTotal,
      statutLabel(p.statut),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `parents_${filtreStatut === 'tous' ? 'tous' : filtreStatut}_${dateStr}.xlsx`;
    try {
      await exportExcelSimple(
        filename,
        [headers, ...rows],
        lang === 'ar' ? 'الأولياء' : 'Parents',
      );
      toast.success(lang === 'ar' ? '✅ تم التصدير' : '✅ Exporté');
    } catch (err) {
      toast.error('Erreur Excel : ' + err.message);
    }
  };

  // ─── Export PDF ─────────────────────────────────────────────
  const exportPDF = async () => {
    if (parentsFiltres.length === 0) {
      toast.info(lang === 'ar' ? 'لا توجد بيانات للتصدير' : 'Aucune donnée à exporter');
      return;
    }
    // Map les lignes dans le format attendu par le template serveur
    const rows = parentsFiltres.map(p => {
      const niveau = niveaux.find(n => n.code === p.eleve.code_niveau);
      return {
        parent_nom: `${p.parent.prenom || ''} ${p.parent.nom || ''}`.trim(),
        enfant_nom: `${p.eleve.prenom || ''} ${p.eleve.nom || ''}`.trim(),
        niveau_nom: niveau?.nom || p.eleve.code_niveau || '',
        niveau_couleur: niveau?.couleur,
        telephone: p.parent.telephone || '',
        statut: p.statut,
        joursEcoules: p.joursEcoules,
      };
    });
    const niveauLabel = filtreNiveau !== 'tous'
      ? (niveaux.find(n => n.code === filtreNiveau)?.nom || '')
      : '';
    try {
      await openPDF('rapport_parents', {
        ecole: { nom: user.ecole_nom || '' },
        filtreStatut,
        filtreNiveau: niveauLabel,
        stats,
        rows,
      }, lang);
    } catch (err) {
      toast.error('Erreur PDF : ' + err.message);
    }
  };

  // ─── Helper affichage statut ───────────────────────────────
  const statutInfo = (s) => ({
    actif:     { emoji: '🟢', label: lang === 'ar' ? 'نشط' : 'Actif',        color: '#1D9E75', bg: '#E1F5EE' },
    peu_actif: { emoji: '🟡', label: lang === 'ar' ? 'قليل النشاط' : 'Peu actif', color: '#EF9F27', bg: '#FAEEDA' },
    inactif:   { emoji: '🔴', label: lang === 'ar' ? 'غير نشط' : 'Inactif',    color: '#E24B4A', bg: '#FCEBEB' },
    jamais:    { emoji: '⚪', label: lang === 'ar' ? 'لم يزر' : 'Jamais venu', color: '#888',    bg: '#f5f5f0' },
  }[s]);

  const joursLabel = (j) => {
    if (j === null) return lang === 'ar' ? 'لم يزر قط' : 'Jamais venu';
    if (j === 0) return lang === 'ar' ? 'اليوم' : 'Aujourd\'hui';
    if (j === 1) return lang === 'ar' ? 'أمس' : 'Hier';
    return lang === 'ar' ? `منذ ${j} يوم` : `Il y a ${j} jour${j > 1 ? 's' : ''}`;
  };

  const ongletLabel = (o) => ({
    progression: lang === 'ar' ? 'التقدم' : 'Progression',
    recitations: lang === 'ar' ? 'الاستظهارات' : 'Récitations',
    cours:       lang === 'ar' ? 'الدروس' : 'Cours',
    objectifs:   lang === 'ar' ? 'الأهداف' : 'Objectifs',
    cotisations: lang === 'ar' ? 'الاشتراكات' : 'Cotisations',
  }[o] || o);

  return (
    <div style={{ background: isMobile ? '#f5f5f0' : 'transparent', minHeight: isMobile ? '100vh' : 'auto', paddingBottom: 80 }}>

      {/* Header */}
      {isMobile ? (
        <div style={{
          background: 'linear-gradient(135deg, #085041, #1D9E75)',
          color: '#fff', padding: '48px 16px 14px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => goBack ? goBack() : navigate('dashboard')}
              style={{
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10,
                padding: 0, flexShrink: 0, color: '#fff', fontSize: 18, cursor: 'pointer',
              }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                👨‍👩‍👧 {lang === 'ar' ? 'متابعة الأولياء' : 'Suivi parents'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {lang === 'ar' ? 'من يتابع و من لا يتابع' : 'Qui consulte et qui ne consulte pas'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <button onClick={() => goBack ? goBack() : navigate('dashboard')} className="back-link"></button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>
                👨‍👩‍👧 {lang === 'ar' ? 'متابعة الأولياء' : 'Suivi parents'}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {lang === 'ar'
                  ? 'تحديد الأولياء غير النشطين للاتصال بهم'
                  : 'Identifier les parents inactifs pour les contacter'}
              </div>
            </div>
            <ExportButtons
              onPDF={exportPDF}
              onExcel={exportExcel}
              isMobile={false}
              lang={lang}
              variant="inline"
              compact
            />
          </div>
        </div>
      )}

      <div style={{ padding: isMobile ? '14px' : '0 1.5rem' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            {lang === 'ar' ? '...جاري التحميل' : 'Chargement...'}
          </div>
        ) : (
          <>
            {/* Boutons export mobile (PDF + CSV) */}
            {isMobile && (
              <div style={{ marginBottom: 12 }}>
                <ExportButtons
                  onPDF={exportPDF}
                  onExcel={exportExcel}
                  isMobile
                  lang={lang}
                  compact
                />
              </div>
            )}

            {/* KPIs (cliquables → filtrent la liste) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
              gap: 8, marginBottom: 14,
            }}>
              <KpiCard
                label={lang === 'ar' ? 'الإجمالي' : 'Total'}
                value={stats.total} emoji="👥" color="#0C447C" bg="#E6F1FB"
                active={filtreStatut === 'tous'}
                onClick={() => setFiltreStatut('tous')}
              />
              <KpiCard
                label={lang === 'ar' ? 'نشط' : 'Actifs'}
                value={stats.actif} emoji="🟢" color="#1D9E75" bg="#E1F5EE"
                active={filtreStatut === 'actif'}
                onClick={() => setFiltreStatut('actif')}
              />
              <KpiCard
                label={lang === 'ar' ? 'قليل النشاط' : 'Peu actifs'}
                value={stats.peu_actif} emoji="🟡" color="#EF9F27" bg="#FAEEDA"
                active={filtreStatut === 'peu_actif'}
                onClick={() => setFiltreStatut('peu_actif')}
              />
              <KpiCard
                label={lang === 'ar' ? 'غير نشط' : 'Inactifs'}
                value={stats.inactif} emoji="🔴" color="#E24B4A" bg="#FCEBEB"
                active={filtreStatut === 'inactif'}
                onClick={() => setFiltreStatut('inactif')}
              />
              <KpiCard
                label={lang === 'ar' ? 'لم يزر' : 'Jamais venus'}
                value={stats.jamais} emoji="⚪" color="#888" bg="#f5f5f0"
                active={filtreStatut === 'jamais'}
                onClick={() => setFiltreStatut('jamais')}
              />
            </div>

            {/* Barre de répartition */}
            {stats.total > 0 && (
              <div style={{
                background: '#fff', borderRadius: 10, padding: 12,
                marginBottom: 12, border: '1px solid #e0e0d8',
              }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>
                  📊 {lang === 'ar' ? 'توزيع الأولياء' : 'Répartition des parents'}
                </div>
                <div style={{
                  height: 14, background: '#f0f0ec', borderRadius: 999,
                  overflow: 'hidden', display: 'flex',
                }}>
                  {stats.actif > 0 && (
                    <div title={`${stats.actif} actifs`}
                      style={{ width: `${(stats.actif / stats.total) * 100}%`, background: '#1D9E75' }} />
                  )}
                  {stats.peu_actif > 0 && (
                    <div title={`${stats.peu_actif} peu actifs`}
                      style={{ width: `${(stats.peu_actif / stats.total) * 100}%`, background: '#EF9F27' }} />
                  )}
                  {stats.inactif > 0 && (
                    <div title={`${stats.inactif} inactifs`}
                      style={{ width: `${(stats.inactif / stats.total) * 100}%`, background: '#E24B4A' }} />
                  )}
                  {stats.jamais > 0 && (
                    <div title={`${stats.jamais} jamais venus`}
                      style={{ width: `${(stats.jamais / stats.total) * 100}%`, background: '#aaa' }} />
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 6, textAlign: 'center' }}>
                  {stats.actif + stats.peu_actif} / {stats.total} {lang === 'ar' ? 'ولي على الأقل شوهدوا مرة' : 'parent(s) au moins vus une fois'}
                </div>
              </div>
            )}

            {/* Filtres : niveau + recherche */}
            <div style={{
              background: '#fff', borderRadius: 10, padding: 12,
              marginBottom: 12, border: '1px solid #e0e0d8',
              display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#666', fontWeight: 700, flexShrink: 0 }}>
                🔍 {lang === 'ar' ? 'تصفية:' : 'Filtrer :'}
              </div>
              <select value={filtreNiveau}
                onChange={e => setFiltreNiveau(e.target.value)}
                style={{
                  padding: '6px 10px', fontSize: 12, borderRadius: 8,
                  border: '1px solid #e0e0d8', fontFamily: 'inherit',
                  background: '#f9f9f5', cursor: 'pointer',
                }}>
                <option value="tous">{lang === 'ar' ? 'جميع المستويات' : 'Tous niveaux'}</option>
                {niveaux.map(n => (
                  <option key={n.code} value={n.code}>{n.nom}</option>
                ))}
              </select>
              <input type="text"
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث بالاسم أو الرقم' : 'Rechercher nom ou numéro'}
                style={{
                  flex: 1, minWidth: 150, padding: '6px 10px', fontSize: 12,
                  borderRadius: 8, border: '1px solid #e0e0d8',
                  fontFamily: 'inherit', outline: 'none',
                }} />
              {(filtreNiveau !== 'tous' || filtreStatut !== 'tous' || recherche) && (
                <button onClick={() => { setFiltreNiveau('tous'); setFiltreStatut('tous'); setRecherche(''); }}
                  style={{
                    padding: '6px 10px', background: '#f5f5f0', color: '#666',
                    border: '1px solid #e0e0d8', borderRadius: 8,
                    fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  ✕ {lang === 'ar' ? 'إزالة' : 'Effacer'}
                </button>
              )}
            </div>

            {/* Liste des parents */}
            {parentsFiltres.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center', color: '#888',
                background: '#fff', borderRadius: 12, border: '1px dashed #ccc',
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {parents.length === 0
                    ? (lang === 'ar' ? 'لا يوجد أولياء مرتبطون بالطلاب' : 'Aucun parent lié à des élèves')
                    : (lang === 'ar' ? 'لا نتائج لهذه التصفية' : 'Aucun résultat pour ce filtre')}
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: 11, color: '#888', marginBottom: 8, textAlign: 'right', fontStyle: 'italic',
              }}>
                {parentsFiltres.length} / {parents.length} {lang === 'ar' ? 'ولي' : 'parent(s)'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parentsFiltres.map((p, i) => {
                const si = statutInfo(p.statut);
                const niveau = niveaux.find(n => n.code === p.eleve.code_niveau);
                const niveauCouleur = niveau?.couleur || '#888';
                return (
                  <div key={`${p.parent.id}_${p.eleve.id}_${i}`} style={{
                    background: '#fff', borderRadius: 12, padding: 14,
                    border: `1px solid ${si.color}30`,
                    borderLeft: `4px solid ${si.color}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 26, flexShrink: 0 }}>{si.emoji}</div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        {/* Parent */}
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                          {p.parent.prenom} {p.parent.nom}
                        </div>
                        {/* Enfant */}
                        <div style={{ fontSize: 11, color: '#666', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>👶 {p.eleve.prenom} {p.eleve.nom}</span>
                          {niveau && (
                            <span style={{
                              padding: '1px 7px', background: `${niveauCouleur}20`, color: niveauCouleur,
                              borderRadius: 8, fontSize: 10, fontWeight: 700,
                              border: `1px solid ${niveauCouleur}40`,
                            }}>{niveau.nom}</span>
                          )}
                        </div>
                        {/* Statut + dernière visite */}
                        <div style={{ fontSize: 11, color: si.color, fontWeight: 700, marginTop: 6 }}>
                          {si.label} · {joursLabel(p.joursEcoules)}
                        </div>
                        {/* Stats consultation */}
                        {p.statut !== 'jamais' && (
                          <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>
                            📊 {p.nbVisitesJours} {lang === 'ar' ? 'يوم زيارة' : 'jour(s) de visite'} · {p.nbConsultTotal} {lang === 'ar' ? 'استشارة' : 'consultation(s)'}
                          </div>
                        )}
                        {/* Onglets consultés */}
                        {p.onglets.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                            {p.onglets.map(o => (
                              <span key={o} style={{
                                padding: '1px 6px', background: '#E6F1FB', color: '#0C447C',
                                borderRadius: 4, fontSize: 9, fontWeight: 600,
                              }}>{ongletLabel(o)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Contacts */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'flex-end' }}>
                        {p.parent.telephone && (
                          <a href={`tel:${p.parent.telephone}`}
                            style={{
                              padding: '6px 12px', background: '#1D9E75', color: '#fff',
                              border: 'none', borderRadius: 8, textDecoration: 'none',
                              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                            📞 {p.parent.telephone}
                          </a>
                        )}
                        {p.parent.identifiant && (
                          <div
                            title={p.parent.identifiant}
                            style={{
                              padding: '4px 8px', background: '#f5f5f0', color: '#888',
                              border: '1px solid #e0e0d8', borderRadius: 6,
                              fontSize: 10, fontFamily: 'inherit',
                              maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                            🆔 {p.parent.identifiant}
                          </div>
                        )}
                        <button onClick={() => navigate('fiche', p.eleve)}
                          style={{
                            padding: '4px 8px', background: '#E6F1FB', color: '#378ADD',
                            border: '1px solid #378ADD40', borderRadius: 6,
                            fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                          👁 {lang === 'ar' ? 'بطاقة' : 'Fiche'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// KPI Card cliquable (filtre)
// ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, emoji, color, bg, active, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        padding: '10px 8px',
        background: active ? color : bg,
        border: `2px solid ${active ? color : color + '30'}`,
        borderRadius: 10,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
      <div style={{
        fontSize: 9, color: active ? 'rgba(255,255,255,0.85)' : '#888',
        fontWeight: 600, marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 800,
        color: active ? '#fff' : color,
      }}>{value}</div>
    </div>
  );
}
