import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { getInitiales, formatDate } from '../lib/helpers';
import { t } from '../lib/i18n';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import ExportButtons from '../components/ExportButtons';
import ModaleEditionCertificat from '../components/ModaleEditionCertificat';
import PageHeader from '../components/PageHeader';
import MobileSkeletonList from '../components/MobileSkeletonList';
import { usePullToRefresh, PullToRefreshIndicator } from '../lib/usePullToRefresh';
import { MobileHeader, HeaderIconButton, HeaderMenu, SearchField, actionsExport, ListRow, LevelBadge, ActionSheet, EmptyState, C } from '../components/ui';
import { Award, Plus, Pencil, FileText, UserRound, Loader2, X } from 'lucide-react';

export default function ListeCertificats({ user, navigate, goBack, lang='fr', isMobile, data }) {
  const { toast } = useToast();
  const focusCertId = data?.focusCertId || null;
  // B3 — Mode création depuis Suivi Résultats (B2 "Émettre cert.")
  const focusEleveId = data?.focusEleveId || null;
  const focusResultatId = data?.focusResultatId || null;
  const focusExamenId = data?.focusExamenId || null;
  const [certificats, setCertificats] = useState([]);
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [jalons, setJalons] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [ecole, setEcole] = useState(null); // B5 — école complète (nom, ville, pays) pour le certificat
  const [loading, setLoading] = useState(true);
  const [genPdfId, setGenPdfId] = useState(null); // id du certificat en cours de génération
  const [genListe, setGenListe] = useState(false);

  // B3 — États modale d'édition / création
  const [modaleOpen, setModaleOpen] = useState(false);
  const [modaleMode, setModaleMode] = useState('edit'); // 'edit' | 'create'
  const [modaleCertif, setModaleCertif] = useState(null);
  const [modaleEleve, setModaleEleve] = useState(null);
  const [modaleResultat, setModaleResultat] = useState(null);
  const [modaleExamen, setModaleExamen] = useState(null);
  const [examens, setExamens] = useState([]);
  const [resultatsExamens, setResultatsExamens] = useState([]);
  const [menuCert, setMenuCert] = useState(null); // charte mobile : panneau d'actions d'un certificat

  // Filtres
  const [searchNum, setSearchNum] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [filtreJalon, setFiltreJalon] = useState('');
  const [filtreInst, setFiltreInst] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => { loadData(); }, []);

  // Etape 8 - Si on arrive avec un focusCertId, scroll + highlight le certif
  // B3 — En plus, auto-ouverture de la modale en mode édition (cohérent avec le bouton "Éditer cert." de Suivi Résultats)
  useEffect(() => {
    if (!focusCertId || loading || certificats.length === 0) return;
    if (modaleOpen) return; // ne pas ré-ouvrir
    // Donner un peu de temps au DOM pour rendre les elements
    const timer = setTimeout(() => {
      const elem = document.getElementById(`cert-row-${focusCertId}`);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight temporaire
        elem.style.transition = 'background-color 0.3s ease';
        const originalBg = elem.style.backgroundColor;
        elem.style.backgroundColor = '#FFF8EC';
        elem.style.boxShadow = '0 0 0 2px #EF9F27';
        setTimeout(() => {
          elem.style.backgroundColor = originalBg;
          elem.style.boxShadow = '';
        }, 3000);
      }
      // B3 — Ouvrir la modale en mode édition après le scroll
      const cert = certificats.find(c => c.id === focusCertId);
      if (cert) {
        ouvrirEdition(cert);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCertId, loading, certificats]);

  const loadData = async () => {
    setLoading(true);
    try {
    const [{ data: certs }, { data: el }, { data: inst }, { data: jal }, { data: niv }, { data: ec }, { data: ex }, { data: re }] = await Promise.all([
      supabase.from('certificats_eleves').select('*').eq('ecole_id', user.ecole_id).order('created_at', { ascending: false }),
      supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole,instituteur_referent_id').eq('ecole_id', user.ecole_id).limit(500).order('nom'),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
      supabase.from('jalons').select('id,nom,nom_ar,type_jalon').eq('ecole_id', user.ecole_id),
      supabase.from('niveaux').select('id,code,nom,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
      // B5 — école complète pour header certificat (nom + ville + pays)
      supabase.from('ecoles').select('id,nom,nom_ar,ville,pays,nom_directeur,nom_directeur_ar').eq('id', user.ecole_id).maybeSingle(),
      // B3 — examens + résultats pour mode création depuis Suivi Résultats
      supabase.from('examens').select('id,nom,niveau_id,type_contenu,contenu_ids').eq('ecole_id', user.ecole_id),
      supabase.from('resultats_examens').select('id,examen_id,eleve_id,score,date_examen,statut').eq('ecole_id', user.ecole_id),
    ]);
    // Mapping BDD -> aliases utilises partout dans le code
    // BDD: titre, description, date_emission, cree_par
    // Alias: nom_certificat, nom_certificat_ar, date_obtention, valide_par
    const certsMapped = (certs || []).map(c => ({
      ...c,
      nom_certificat: c.titre,
      nom_certificat_ar: c.description,
      date_obtention: c.date_emission,
      valide_par: c.cree_par,
    }));
    setCertificats(certsMapped);
    setEleves(el || []);
    setInstituteurs(inst || []);
    setJalons(jal || []);
    setNiveaux(niv || []);
    setEcole(ec || null);
    setExamens(ex || []);
    setResultatsExamens(re || []);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const getEleve = (id) => eleves.find(e => e.id === id);
  const getJalon = (id) => jalons.find(j => j.id === id);
  const getInst = (id) => instituteurs.find(i => i.id === id);
  const getNivColor = (code) => niveaux.find(n => n.code === code)?.couleur || '#888';

  // B3 — Ouverture modale en mode édition
  const ouvrirEdition = (cert, ev) => {
    ev?.stopPropagation?.();
    const eleve = getEleve(cert.eleve_id);
    setModaleMode('edit');
    setModaleCertif(cert);
    setModaleEleve(eleve || null);
    setModaleResultat(null);
    setModaleExamen(null);
    setModaleOpen(true);
  };

  // B3 — Ouverture modale en mode création (depuis B2 ou bouton interne)
  const ouvrirCreation = ({ eleve, resultat = null, examen = null }) => {
    setModaleMode('create');
    setModaleCertif(null);
    setModaleEleve(eleve || null);
    setModaleResultat(resultat);
    setModaleExamen(examen);
    setModaleOpen(true);
  };

  // B3 — Callback après save : recharger la liste pour reflet immédiat
  const onModaleSaved = () => {
    loadData();
  };

  // B3 — Auto-ouverture en mode création quand on arrive depuis Suivi Résultats
  // (badge orange "Émettre cert." -> navigate avec focusEleveId + focusResultatId)
  useEffect(() => {
    if (loading) return;
    if (modaleOpen) return; // ne pas ré-ouvrir si déjà ouverte
    if (!focusEleveId) return;
    // Vérifier qu'aucun cert n'existe déjà pour ce résultat (sécurité)
    if (focusResultatId) {
      const dejaCert = certificats.find(c => c.resultat_examen_id_source === focusResultatId);
      if (dejaCert) {
        // Cert déjà émis : passer en mode édition
        ouvrirEdition(dejaCert);
        return;
      }
    }
    const eleve = eleves.find(e => e.id === focusEleveId);
    const resultat = focusResultatId ? resultatsExamens.find(r => r.id === focusResultatId) : null;
    const examen = (focusExamenId || resultat?.examen_id)
      ? examens.find(e => e.id === (focusExamenId || resultat?.examen_id))
      : null;
    if (eleve) {
      ouvrirCreation({ eleve, resultat, examen });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, focusEleveId, focusResultatId, focusExamenId, certificats, eleves, resultatsExamens, examens]);

  // ── PDF certificat individuel ────────────────────────────────
  const handlePdfCertificat = async (c, e) => {
    e?.stopPropagation?.(); // ne pas naviguer vers la fiche en cliquant le bouton
    if (genPdfId) return;
    const el = getEleve(c.eleve_id);
    const jal = getJalon(c.jalon_id);
    // B5 — Enrichir payload : niveau + ecole complète (ville/pays) pour le nouveau template
    const niv = el ? niveaux.find(n => n.code === el.code_niveau) : null;
    setGenPdfId(c.id);
    try {
      await openPDF('certificat', {
        eleve: el ? { prenom: el.prenom, nom: el.nom, code_niveau: el.code_niveau } : { prenom: '', nom: '' },
        jalon: jal ? { nom: jal.nom, nom_ar: jal.nom_ar } : { nom: c.titre || c.nom_certificat, nom_ar: c.nom_certificat_ar },
        date: c.date_emission || c.date_obtention,
        ecole: {
          nom: ecole?.nom || '',
          nom_ar: ecole?.nom_ar || '',
          ville: ecole?.ville || '',
          pays: ecole?.pays || '',
          nom_directeur: ecole?.nom_directeur || '',
          nom_directeur_ar: ecole?.nom_directeur_ar || '',
        },
        niveau: niv ? { code: niv.code, nom: niv.nom } : null,
        numero: c.numero || null,
      }, lang);
    } catch (err) {
      console.error('PDF certificat:', err);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + err.message);
    }
    setGenPdfId(null);
  };

  // ── PDF liste complète (après filtres) ───────────────────────
  const handlePdfListe = async () => {
    if (genListe || filtered.length === 0) return;
    setGenListe(true);
    try {
      const certificatsData = filtered.map(c => {
        const el = getEleve(c.eleve_id) || {};
        const jal = getJalon(c.jalon_id) || {};
        const inst = el.instituteur_referent_id ? getInst(el.instituteur_referent_id) : null;
        const jalonLabel = lang === 'ar' ? (jal.nom_ar || jal.nom || '—') : (jal.nom || jal.nom_ar || '—');
        return {
          prenom: el.prenom || '',
          nom: el.nom || '',
          eleve_id_ecole: el.eleve_id_ecole || '',
          code_niveau: el.code_niveau || '',
          couleur: getNivColor(el.code_niveau),
          jalon: jalonLabel,
          instituteur: inst ? `${inst.prenom} ${inst.nom}` : '—',
          date_obtention: c.date_obtention,
        };
      });
      await openPDF('liste_certificats', {
        ecole: { nom: ecole?.nom || '' },
        titre: lang === 'ar' ? 'قائمة الشهادات' : 'Liste des certificats',
        certificats: certificatsData,
      }, lang);
    } catch (err) {
      console.error('PDF liste certificats:', err);
      toast.error((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + err.message);
    }
    setGenListe(false);
  };

  // ── Export Excel liste des certificats ────────────────────
  const handleExcelListe = async () => {
    if (filtered.length === 0) return;
    const headers = [
      '#',
      lang === 'ar' ? 'الاسم' : 'Prénom',
      lang === 'ar' ? 'اللقب' : 'Nom',
      lang === 'ar' ? 'الرقم' : 'N° Élève',
      lang === 'ar' ? 'المستوى' : 'Niveau',
      lang === 'ar' ? 'الشهادة' : 'Certificat',
      lang === 'ar' ? 'الأستاذ' : 'Instituteur',
      lang === 'ar' ? 'تاريخ الحصول' : 'Date obtention',
    ];
    const rows = filtered.map((c, i) => {
      const el = getEleve(c.eleve_id) || {};
      const jal = getJalon(c.jalon_id) || {};
      const inst = el.instituteur_referent_id ? getInst(el.instituteur_referent_id) : null;
      const jalonLabel = lang === 'ar' ? (jal.nom_ar || jal.nom || '') : (jal.nom || jal.nom_ar || '');
      return [
        i + 1,
        el.prenom || '',
        el.nom || '',
        el.eleve_id_ecole || '',
        el.code_niveau || '',
        jalonLabel,
        inst ? `${inst.prenom} ${inst.nom}` : '',
        c.date_obtention || '',
      ];
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    try {
      await exportExcelSimple(
        `certificats_${dateStr}.xlsx`,
        [headers, ...rows],
        lang === 'ar' ? 'الشهادات' : 'Certificats',
      );
    } catch (err) {
      toast.error((lang === 'ar' ? 'خطأ Excel : ' : 'Erreur Excel : ') + err.message);
    }
  };

  const filtered = certificats.filter(c => {
    const el = getEleve(c.eleve_id);
    if (!el) return false;
    if (searchNum && !el.eleve_id_ecole?.includes(searchNum) && !(el.prenom+' '+el.nom).toLowerCase().includes(searchNum.toLowerCase())) return false;
    if (filtreNiveau && el.code_niveau !== filtreNiveau) return false;
    if (filtreJalon && c.jalon_id !== filtreJalon) return false;
    if (filtreInst && el.instituteur_referent_id !== filtreInst) return false;
    if (dateDebut && new Date(c.date_obtention) < new Date(dateDebut)) return false;
    if (dateFin && new Date(c.date_obtention) > new Date(dateFin+'T23:59:59')) return false;
    return true;
  });

  // B3 — JSX de la modale (réutilisé en mobile et desktop)
  const modaleJSX = modaleOpen && (
    <ModaleEditionCertificat
      mode={modaleMode}
      certificat={modaleCertif}
      eleve={modaleEleve}
      eleves={eleves}
      resultat={modaleResultat}
      examen={modaleExamen}
      user={user}
      lang={lang}
      onClose={()=>setModaleOpen(false)}
      onSaved={onModaleSaved}
    />
  );

  // B3 — Ouvrir modale en mode manuel pur (depuis bouton header)
  const ouvrirCreationManuelle = () => {
    setModaleMode('create');
    setModaleCertif(null);
    setModaleEleve(null);   // Pas d'élève pré-sélectionné -> selecteur dans la modale
    setModaleResultat(null);
    setModaleExamen(null);
    setModaleOpen(true);
  };

  // Pull-to-refresh (Phase 2 mobile - hook appele au top level pour respecter les rules of hooks)
  const {
    pullDistance, isRefreshing, isThreshold,
    onTouchStart, onTouchMove, onTouchEnd,
  } = usePullToRefresh(loadData);

  // ─── Mobile render ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          isThreshold={isThreshold}
          lang={lang}
        />
        {/* Header */}
        <MobileHeader
          title={lang==='ar'?'الشهادات':'Certificats'}
          subtitle={`${filtered.length} ${lang==='ar'?'شهادة':'certificat(s)'}`}
          icon={Award}
          onBack={()=>goBack?goBack():navigate('dashboard')}
          lang={lang}
          actions={<>
            <HeaderIconButton icon={Plus} onClick={ouvrirCreationManuelle}
              label={lang==='ar' ? 'إصدار شهادة يدوية' : 'Émettre un certificat manuel'} />
            <HeaderMenu lang={lang} actions={[
              ...actionsExport({ onPDF: handlePdfListe, lang, disabled: genListe||filtered.length===0 }),
              ...actionsExport({ onExcel: handleExcelListe, lang, disabled: filtered.length===0 }),
            ]} />
          </>}>
          {/* Recherche */}
          <SearchField value={searchNum} onChange={setSearchNum} lang={lang} id="recherche-certificats"
            placeholder={lang==='ar'?'بحث بالاسم أو الرقم...':'Nom ou numéro...'} />
        </MobileHeader>

        {/* Filtres chips */}
        <div style={{display:'flex',gap:6,overflowX:'auto',padding:'10px 12px',scrollbarWidth:'none',background:C.surface,borderBottom:`1px solid ${C.line}`}}>
          <select value={filtreNiveau} onChange={e=>setFiltreNiveau(e.target.value)}
            style={{padding:'5px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',fontSize:11,fontFamily:'inherit',background:filtreNiveau?C.brand:C.surface,color:filtreNiveau?C.onBrand:C.text,border:`1px solid ${filtreNiveau?C.brand:C.line}`,flexShrink:0}}>
            <option value="">{lang==='ar'?'كل المستويات':'Niveaux'}</option>
            {niveaux.map(n=><option key={n.code} value={n.code}>{n.code}</option>)}
          </select>
          <select value={filtreJalon} onChange={e=>setFiltreJalon(e.target.value)}
            style={{padding:'5px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',fontSize:11,fontFamily:'inherit',background:filtreJalon?C.brand:C.surface,color:filtreJalon?C.onBrand:C.text,border:`1px solid ${filtreJalon?C.brand:C.line}`,flexShrink:0}}>
            <option value="">{lang==='ar'?'كل الشهادات':'Jalons'}</option>
            {jalons.map(j=><option key={j.id} value={j.id}>{j.nom_ar||j.nom}</option>)}
          </select>
          <select value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}
            style={{padding:'5px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',fontSize:11,fontFamily:'inherit',background:filtreInst?C.brand:C.surface,color:filtreInst?C.onBrand:C.text,border:`1px solid ${filtreInst?C.brand:C.line}`,flexShrink:0}}>
            <option value="">{lang==='ar'?'كل الأساتذة':'Instituteurs'}</option>
            {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
          </select>
          {(searchNum||filtreNiveau||filtreJalon||filtreInst)&&(
            <div onClick={()=>{setSearchNum('');setFiltreNiveau('');setFiltreJalon('');setFiltreInst('');}}
              aria-label={lang==='ar'?'مسح':'Effacer'}
              style={{padding:'5px 10px',borderRadius:20,background:C.critSoft,color:C.crit,fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0,border:'none',display:'flex',alignItems:'center'}}>
              <X size={14} />
            </div>
          )}
        </div>

        {/* Liste */}
        {loading ? <MobileSkeletonList type="card-with-avatar" count={6} padding="10px 12px" />
          : filtered.length===0 ? (
            <EmptyState icon={Award} title={lang==='ar'?'لا توجد شهادات':'Aucun certificat'} />
          ) : (
            <div style={{padding:'10px 12px'}}>
              {(filtered||[]).map(c=>{
                const el=getEleve(c.eleve_id);
                const jal=getJalon(c.jalon_id);
                const inst=el?getInst(el.instituteur_referent_id):null;
                const nc=el?getNivColor(el.code_niveau):'#888';
                const dateTxt = c.date_obtention?new Date(c.date_obtention).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—';
                return(
                  <div key={c.id} id={`cert-row-${c.id}`} style={{marginBottom:8,borderRadius:12}}>
                    <ListRow lang={lang}
                      leading={<div style={{width:40,height:40,borderRadius:12,background:C.goldSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Award size={20} color={C.gold} /></div>}
                      title={<span dir="rtl" style={{fontFamily:"'Tajawal',Arial,sans-serif"}}>{jal?.nom_ar||jal?.nom||c.nom_certificat_ar||c.nom_certificat}</span>}
                      subtitle={[el?`${el.prenom} ${el.nom}`:null, el?.eleve_id_ecole?`#${el.eleve_id_ecole}`:null].filter(Boolean).join(' · ') || undefined}
                      meta={<div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',fontSize:11,color:C.muted}}>
                        {el&&<LevelBadge code={el.code_niveau} color={nc} />}
                        {inst&&<span>{inst.prenom} {inst.nom} ·</span>}
                        <span>{dateTxt}</span>
                      </div>}
                      value={genPdfId===c.id ? <Loader2 size={18} color={C.muted} /> : undefined}
                      onClick={()=>el&&navigate('fiche',el)}
                      onMore={()=>setMenuCert(c)}
                    />
                  </div>
                );
              })}
            </div>
          )}
      {/* Charte mobile (oct 2026) : actions d'un certificat dans un panneau */}
      <ActionSheet open={!!menuCert} onClose={()=>setMenuCert(null)} lang={lang}
        title={menuCert ? (()=>{ const j=getJalon(menuCert.jalon_id); return j?.nom_ar||j?.nom||menuCert.nom_certificat_ar||menuCert.nom_certificat||''; })() : ''}
        actions={menuCert ? [
          getEleve(menuCert.eleve_id) && { label: lang==='ar'?'بطاقة الطالب':'Ouvrir la fiche', icon: UserRound, onClick: ()=>{ const el=getEleve(menuCert.eleve_id); el&&navigate('fiche',el); } },
          { label: lang==='ar'?'تحرير':'Éditer', icon: Pencil, onClick: ()=>ouvrirEdition(menuCert) },
          { label: lang==='ar'?'تحميل PDF':'Télécharger PDF', icon: FileText, onClick: ()=>handlePdfCertificat(menuCert), disabled: genPdfId===menuCert.id },
        ] : []} />
      {modaleJSX}
      </div>
    );
  }

  // ─── PC render ────────────────────────────────────────────────
  return (
    <div style={{ padding:'1.5rem', paddingBottom: 80 }}>
      <PageHeader
        title={lang==='ar' ? 'قائمة الشهادات' : 'Liste des certificats'}
        titleAr="قائمة الشهادات"
        icon="🏅"
        subtitle={`${filtered.length} ${lang==='ar' ? 'شهادة' : 'certificat(s)'}`}
        onBack={() => goBack ? goBack() : navigate('dashboard')}
        lang={lang}
        actions={
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button onClick={ouvrirCreationManuelle}
              title={lang==='ar' ? 'إصدار شهادة يدوية' : 'Émettre un certificat manuel'}
              style={{padding:'8px 14px', borderRadius:10, border:'none',
                background:'#1D9E75', color:'#fff', fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit', display:'flex',
                alignItems:'center', gap:6, whiteSpace:'nowrap'}}>
              ➕ {lang==='ar' ? 'شهادة جديدة' : 'Nouveau certificat'}
            </button>
            <ExportButtons
              onPDF={handlePdfListe}
              onExcel={handleExcelListe}
              lang={lang}
              variant="inline"
              compact
              disabled={genListe || filtered.length === 0}
            />
          </div>
        }
      />

      {/* Filtres */}
      <div className="card" style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
          <input className="field-input" placeholder={'🔍 '+(lang==='ar'?'رقم أو اسم الطالب':'N° ou nom élève')}
            value={searchNum} onChange={e=>setSearchNum(e.target.value)} />
          <select className="field-select" value={filtreNiveau} onChange={e=>setFiltreNiveau(e.target.value)}>
            <option value="">{lang==='ar'?'كل المستويات':'Tous les niveaux'}</option>
            {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
          </select>
          <select className="field-select" value={filtreJalon} onChange={e=>setFiltreJalon(e.target.value)}>
            <option value="">{lang==='ar'?'كل الشهادات':'Tous les jalons'}</option>
            {jalons.map(j=><option key={j.id} value={j.id}>{j.nom_ar||j.nom}</option>)}
          </select>
          <select className="field-select" value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}>
            <option value="">{lang==='ar'?'كل الأساتذة':'Tous les instituteurs'}</option>
            {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
          </select>
          <input className="field-input" type="date" value={dateDebut} onChange={e=>setDateDebut(e.target.value)}
            placeholder={lang==='ar'?'من':'Du'} title={lang==='ar'?'من':'Du'} />
          <input className="field-input" type="date" value={dateFin} onChange={e=>setDateFin(e.target.value)}
            placeholder={lang==='ar'?'إلى':'Au'} title={lang==='ar'?'إلى':'Au'} />
        </div>
        {(searchNum||filtreNiveau||filtreJalon||filtreInst||dateDebut||dateFin) && (
          <button onClick={()=>{setSearchNum('');setFiltreNiveau('');setFiltreJalon('');setFiltreInst('');setDateDebut('');setDateFin('');}}
            style={{marginTop:8,padding:'4px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:11,cursor:'pointer',color:'#888'}}>
            ✕ {lang==='ar'?'مسح الفلاتر':'Effacer filtres'}
          </button>
        )}
      </div>

      {loading ? <div style={{textAlign:'center',color:'#aaa',padding:'3rem'}}>...</div> : (
        filtered.length === 0 ? (
          <div className="empty">{lang==='ar'?'لا توجد شهادات':'Aucun certificat'}</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(filtered||[]).map(c => {
              const el = getEleve(c.eleve_id);
              const jal = getJalon(c.jalon_id);
              const inst = el ? getInst(el.instituteur_referent_id) : null;
              const nc = el ? getNivColor(el.code_niveau) : '#888';
              return (
                <div key={c.id} id={`cert-row-${c.id}`} onClick={()=>el&&navigate('fiche',el)}
                  style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <div style={{width:44,height:44,borderRadius:12,background:'#FAEEDA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🏅</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#085041',direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>
                      {jal?.nom_ar || jal?.nom || c.nom_certificat_ar || c.nom_certificat}
                    </div>
                    <div style={{fontSize:12,color:'#888',marginTop:2}}>
                      {el ? <><span style={{fontWeight:600,color:'#1a1a1a'}}>{el.prenom} {el.nom}</span> · <span style={{color:nc,fontWeight:600,fontSize:10}}>{el.code_niveau}</span></> : '—'}
                      {inst && <span style={{color:'#888'}}> · {inst.prenom} {inst.nom}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:11,color:'#EF9F27',fontWeight:600}}>
                      📅 {c.date_obtention ? new Date(c.date_obtention).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                    </div>
                    {el && <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{lang==='ar'?'رقم':'N°'} {el.eleve_id_ecole}</div>}
                  </div>
                  <button onClick={(ev)=>{ev.stopPropagation(); ouvrirEdition(c, ev);}}
                    style={{background:'#E1F5EE',border:'none',borderRadius:10,padding:'8px 12px',fontSize:13,fontWeight:600,color:'#085041',cursor:'pointer',flexShrink:0,fontFamily:'inherit'}}
                    title={lang==='ar'?'تحرير':'Éditer'}>
                    ✏️
                  </button>
                  <button onClick={(ev)=>handlePdfCertificat(c,ev)} disabled={genPdfId===c.id}
                    style={{background:'#FAEEDA',border:'none',borderRadius:10,padding:'8px 12px',fontSize:13,fontWeight:600,color:'#A85F10',cursor:genPdfId===c.id?'default':'pointer',flexShrink:0,opacity:genPdfId===c.id?0.5:1,fontFamily:'inherit'}}
                    title={lang==='ar'?'تحميل PDF':'Télécharger PDF'}>
                    {genPdfId===c.id?'⏳':'📄 PDF'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}
      {modaleJSX}
    </div>
  );
}
