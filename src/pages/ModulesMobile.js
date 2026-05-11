// ═══════════════════════════════════════════════════════════════════════════
// ModulesMobile — Phase 2 mobile (page de navigation classe mondiale)
// ═══════════════════════════════════════════════════════════════════════════
//
// Page DEDIEE à la navigation entre les modules de l'app.
// Affichée quand l'utilisateur tape "⚙️ Plus" dans la bottom tab bar.
//
// SEPARATION DES CONCEPTS (standard classe mondiale) :
// - Dashboard = page de SYNTHESE (KPIs, alertes, podium, activités)
// - ModulesMobile = page de NAVIGATION (3 sections + Plus dépliable)
//
// Cette séparation est inspirée de Notion, Slack, Linear, Asana qui ont :
// - Une page d'accueil "Home" pure synthèse
// - Une page "Browse"/"All" séparée pour la navigation
//
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ModulesMobile({ user, navigate, lang='ar' }) {
  const [showPlusModules, setShowPlusModules] = useState(false);
  const [nbEleves, setNbEleves] = useState(0);

  // Charger juste le nombre d'élèves pour le sub-label "X طالب inscrits"
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase
          .from('eleves')
          .select('id', { count: 'exact', head: true })
          .eq('ecole_id', user.ecole_id);
        if (!cancelled) setNbEleves(count || 0);
      } catch (e) { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [user.ecole_id]);

  // ─── Sections catégorisées (identiques à celles du Dashboard avant refonte) ──
  const navSections = [
    {
      title: lang==='ar'?'📚 التعليم':'📚 Pédagogie',
      modules: [
        {icon:'👥', label:lang==='ar'?'الطلاب':'Élèves',          sub:`${nbEleves} ${lang==='ar'?'طالب':'inscrits'}`, page:'eleves_mobile', bg:'#E6F1FB'},
        {icon:'⭐', label:lang==='ar'?'النقاط':'Notes',            sub:lang==='ar'?'الترتيب':'Classement',         page:'liste_notes',        bg:'#FAEEDA'},
        {icon:'📝', label:lang==='ar'?'الامتحانات':'Examens',     sub:lang==='ar'?'النتائج':'Résultats',          page:'resultats_examens',  bg:'#E6F1FB'},
        {icon:'🏅', label:lang==='ar'?'الشهادات':'Certificats',    sub:lang==='ar'?'متابعة':'Suivi',               page:'liste_certificats',  bg:'#FAEEDA'},
        {icon:'📊', label:lang==='ar'?'السجل':'Historique',        sub:lang==='ar'?'تحليل':'Analyse',              page:'historique_seances', bg:'#E6F1FB'},
        {icon:'🎯', label:lang==='ar'?'الأهداف':'Objectifs',       sub:lang==='ar'?'متابعة':'Suivi',               page:'objectifs',          bg:'#EEEDFE', role:'surveillant'},
      ],
    },
    {
      title: lang==='ar'?'📊 التحليل والمتابعة':'📊 Suivi & Analyse',
      modules: [
        {icon:'🏆', label:lang==='ar'?'لوحة الشرف':'Honneur',      sub:lang==='ar'?'المتصدرون':'Top élèves',       page:'honneur',            bg:'#FAEEDA'},
        {icon:'📅', label:lang==='ar'?'التقويم':'Calendrier',      sub:lang==='ar'?'البرنامج':'Planning',          page:'calendrier',         bg:'#E6F1FB'},
        {icon:'📋', label:lang==='ar'?'التقرير':'Rapport',         sub:lang==='ar'?'شهري':'Mensuel',               page:'rapport_mensuel',    bg:'#F3F4F6', role:'surveillant'},
        {icon:'📈', label:lang==='ar'?'مقارنة':'Comparer',         sub:lang==='ar'?'بين الطلاب':'Élèves',         page:'comparaison',        bg:'#EEEDFE'},
      ],
    },
    {
      title: lang==='ar'?'⚙️ الإدارة':'⚙️ Administration',
      modules: [
        {icon:'⚙️', label:lang==='ar'?'الإدارة':'Gestion',          sub:lang==='ar'?'إعدادات':'Paramètres',         page:'gestion',            bg:'#E1F5EE'},
        {icon:'💰', label:lang==='ar'?'المالية':'Finance',           sub:lang==='ar'?'الاشتراكات':'Cotisations',     page:'finance',            bg:'#FCEBEB', role:'surveillant'},
        {icon:'👨‍👩‍👧', label:lang==='ar'?'الأولياء':'Parents',         sub:lang==='ar'?'متابعة':'Suivi',               page:'parents',            bg:'#EEEDFE', role:'surveillant'},
        {icon:'📚', label:lang==='ar'?'الدروس':'Cours',              sub:lang==='ar'?'متابعة':'Suivi',               page:'cours',              bg:'#E6F1FB'},
      ],
    },
  ];

  // Section "Plus" dépliable : modules secondaires
  const navPlus = [
    {icon:'📖', label:lang==='ar'?'مراجعة':"Muraja'a",            sub:lang==='ar'?'جماعية':'Collective',          page:'muraja',             bg:'#F0EEFF'},
    {icon:'📊', label:lang==='ar'?'لوحة القيادة':'Direction',     sub:lang==='ar'?'تحليلات':'Analytics',          page:'dashboard_direction', bg:'#E1F5EE', role:'surveillant'},
    {icon:'📅', label:lang==='ar'?'الحضور':'Assiduité',           sub:lang==='ar'?'الغياب':'Présences',           page:'assiduite',          bg:'#E1F5EE', role:'surveillant'},
  ];

  const filterByRole = m => !m.role || user.role===m.role;
  const sectionsFiltered = navSections.map(s => ({...s, modules: s.modules.filter(filterByRole)})).filter(s => s.modules.length > 0);
  const plusFiltered = navPlus.filter(filterByRole);

  const renderModule = (m) => (
    <div key={m.page+m.label} onClick={()=>navigate(m.page)}
      style={{background:'#fff',borderRadius:14,padding:'14px 10px',
        display:'flex',flexDirection:'column',alignItems:'center',gap:7,
        border:'0.5px solid #e0e0d8',cursor:'pointer',
        boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
      <div style={{width:40,height:40,borderRadius:12,background:m.bg,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
        {m.icon}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:'#1a1a1a',textAlign:'center',
        lineHeight:1.2}}>{m.label}</div>
      <div style={{fontSize:10,color:'#888',textAlign:'center'}}>{m.sub}</div>
    </div>
  );

  return (
    <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',
        padding:'48px 16px 20px', position:'sticky', top:0, zIndex:100}}>
        <div style={{fontSize:18, fontWeight:800, color:'#fff'}}>
          ⚙️ {lang==='ar'?'كل الوحدات':'Tous les modules'}
        </div>
        <div style={{fontSize:11, color:'rgba(255,255,255,0.8)', marginTop:4}}>
          {lang==='ar'?'تصفح كل الميزات':'Parcourir toutes les fonctionnalités'}
        </div>
      </div>

      {/* Sections */}
      {sectionsFiltered.map((section, idx) => (
        <div key={section.title} style={{padding: idx===0?'14px 12px 4px':'18px 12px 4px'}}>
          <div style={{fontSize:13, fontWeight:700, color:'#666',
            marginBottom:10}}>
            {section.title}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
            {section.modules.map(renderModule)}
          </div>
        </div>
      ))}

      {/* Section Plus dépliable */}
      {plusFiltered.length > 0 && (
        <div style={{padding:'18px 12px 4px'}}>
          <button onClick={()=>setShowPlusModules(v=>!v)}
            style={{width:'100%', padding:'14px 16px', background:'#fff',
              border:'0.5px solid #e0e0d8', borderRadius:12, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'space-between',
              fontFamily:'inherit', fontSize:13, fontWeight:600, color:'#666'}}>
            <span>{lang==='ar'?'➕ المزيد':'➕ Plus de modules'} ({plusFiltered.length})</span>
            <span style={{fontSize:11, opacity:0.7}}>{showPlusModules ? '▲' : '▼'}</span>
          </button>
          {showPlusModules && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:10}}>
              {plusFiltered.map(renderModule)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
