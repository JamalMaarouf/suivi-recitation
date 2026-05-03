import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, calcPointsPeriode, loadBareme, BAREME_DEFAUT, getSensForEleve, loadAnneeActiveAvecPeriodes, formatPeriodeCourte, detecterPeriodeEnCours} from '../lib/helpers';
import PeriodeSelectorHybride from '../components/PeriodeSelectorHybride';
import { t } from '../lib/i18n';
import { openPDF } from '../lib/pdf';
import { exportExcelSimple } from '../lib/excel';
import { fetchAll } from '../lib/fetchAll';
import ExportButtons from '../components/ExportButtons';
import PageHeader from '../components/PageHeader';

export default function ListeNotes({ user, navigate, goBack, lang='fr', isMobile }) {
  const [eleves, setEleves] = useState([]);
  const [allValidations, setAllValidations] = useState([]);
  const [pointsEvts, setPointsEvts] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [niveaux, setNiveaux] = useState([]);
  const [bareme, setBareme] = useState({ unites:{...BAREME_DEFAUT}, examens:{}, ensembles:{}, jalons:{} });
  const [loading, setLoading] = useState(true);
  const [genPdf, setGenPdf] = useState(false);

  // Filtres
  const [searchNum, setSearchNum] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [filtreInst, setFiltreInst] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [periode, setPeriode] = useState('total');
  const [periodesBDD, setPeriodesBDD] = useState([]); // Etape 14 v2 - trimestres + semestres
  const [anneeActive, setAnneeActive] = useState(null); // Etape 14 v2

  useEffect(() => { loadData(); }, []);

  // Etape 14 v2 - Charger annee active + ses periodes typees (T, S)
  useEffect(() => {
    if (!user?.ecole_id) return;
    loadAnneeActiveAvecPeriodes(supabase, user.ecole_id).then(({ annee, periodes }) => {
      setAnneeActive(annee);
      setPeriodesBDD(periodes.filter(p => p.type === 'trimestre' || p.type === 'semestre'));
    });
  }, [user?.ecole_id]);

  const loadData = async () => {
    setLoading(true);
    try {
    const [{ data: el }, { data: vd }, { data: pe }, { data: inst }, { data: niv }] = await Promise.all([
      supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole,hizb_depart,tomon_depart,instituteur_referent_id').eq('ecole_id', user.ecole_id).order('nom'),
      fetchAll(supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,date_validation').eq('ecole_id', user.ecole_id)).then(data=>({data})),
      supabase.from('points_eleves').select('*').eq('ecole_id', user.ecole_id).order('created_at', {ascending:false}),
      supabase.from('utilisateurs').select('id,prenom,nom').eq('role','instituteur').eq('ecole_id', user.ecole_id),
      supabase.from('niveaux').select('id,code,nom,couleur').eq('ecole_id', user.ecole_id).order('ordre'),
    ]);
    setEleves(el || []);
    setAllValidations(vd || []);
    setPointsEvts(pe || []);
    setInstituteurs(inst || []);
    setNiveaux(niv || []);
    const b = await loadBareme(supabase, user.ecole_id);
    setBareme(b);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const getPeriodeDates = () => {
    const now = new Date();
    if (periode === 'total') return { debut: new Date('2000-01-01'), fin: now };
    if (periode === 'semaine') return { debut: new Date(now.getTime()-7*86400000), fin: now };
    if (periode === 'mois') return { debut: new Date(now.getFullYear(),now.getMonth(),1), fin: now };
    // Etape 14 v2 - Annee scolaire active
    if (periode === 'annee_scolaire' && anneeActive) {
      return { debut: new Date(anneeActive.date_debut), fin: new Date(anneeActive.date_fin+'T23:59:59') };
    }
    // Etape 14 v2 - Periode BDD typee
    if (periode && typeof periode === 'string' && periode.startsWith('bdd_')) {
      const id = periode.substring(4);
      const p = periodesBDD.find(x => x.id === id);
      if (p) return { debut: new Date(p.date_debut), fin: new Date(p.date_fin+'T23:59:59') };
    }
    if (periode === 'custom' && dateDebut && dateFin) return { debut: new Date(dateDebut), fin: new Date(dateFin+'T23:59:59') };
    return { debut: new Date('2000-01-01'), fin: now };
  };

  const elevesAvecPts = useMemo(() => {
    const { debut, fin } = getPeriodeDates();
    // Index O(1) au lieu de filtrer n fois
    const valsByEleve = new Map();
    allValidations.forEach(v => {
      if (!valsByEleve.has(v.eleve_id)) valsByEleve.set(v.eleve_id, []);
      valsByEleve.get(v.eleve_id).push(v);
    });
    const evtsByEleve = new Map();
    pointsEvts.forEach(p => {
      if (!evtsByEleve.has(p.eleve_id)) evtsByEleve.set(p.eleve_id, []);
      evtsByEleve.get(p.eleve_id).push(p);
    });
    const instById = new Map(instituteurs.map(i => [i.id, i]));

    return eleves.map(el => {
      const vals = valsByEleve.get(el.id) || [];
      const evts = evtsByEleve.get(el.id) || [];
      const pts = calcPointsPeriode(vals, debut, fin, bareme, evts);
      const inst = instById.get(el.instituteur_referent_id);
      return { ...el, pts, instNom: inst ? `${inst.prenom} ${inst.nom}` : '—' };
    }).sort((a, b) => b.pts.total - a.pts.total);
  }, [eleves, allValidations, pointsEvts, bareme, periode, dateDebut, dateFin, periodesBDD, anneeActive]);

  const filtered = elevesAvecPts.filter(el => {
    if (searchNum && !el.eleve_id_ecole?.includes(searchNum) && !(el.prenom+' '+el.nom).toLowerCase().includes(searchNum.toLowerCase())) return false;
    if (filtreNiveau && el.code_niveau !== filtreNiveau) return false;
    if (filtreInst && el.instituteur_referent_id !== filtreInst) return false;
    return true;
  });

  const getNivColor = (code) => niveaux.find(n=>n.code===code)?.couleur || '#888';

  // ── PDF export ─────────────────────────────────────────────
  const handlePdfExport = async () => {
    if (genPdf || filtered.length === 0) return;
    setGenPdf(true);
    try {
      const periodeLabel = getPeriodeLabel();
      const elevesData = filtered.map(el => ({
        prenom: el.prenom || '',
        nom: el.nom || '',
        eleve_id_ecole: el.eleve_id_ecole || '',
        code_niveau: el.code_niveau || '',
        couleur: getNivColor(el.code_niveau),
        instituteur: el.instNom || '—',
        points: el.pts?.total || 0,
        tomon: el.pts?.details?.nbTomon || 0,
        hizb: el.pts?.details?.nbHizb || 0,
      }));
      await openPDF('liste_notes', {
        ecole: { nom: user?.ecole?.nom || '' },
        titre: lang === 'ar' ? 'قائمة النقاط' : 'Classement des points',
        periodeLabel,
        eleves: elevesData,
      }, lang);
    } catch (err) {
      console.error('PDF liste notes:', err);
      alert((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + err.message);
    }
    setGenPdf(false);
  };

  // ── Excel export ──────────────────────────────────────────
  const handleExcelExport = async () => {
    if (filtered.length === 0) return;
    const periodeLabel = getPeriodeLabel();
    const headers = [
      '#',
      lang === 'ar' ? 'الاسم' : 'Prénom',
      lang === 'ar' ? 'اللقب' : 'Nom',
      lang === 'ar' ? 'الرقم' : 'N° Élève',
      lang === 'ar' ? 'المستوى' : 'Niveau',
      lang === 'ar' ? 'الأستاذ' : 'Instituteur',
      lang === 'ar' ? 'النقاط' : 'Points',
      lang === 'ar' ? 'الثُّمنات' : 'Tomon',
      lang === 'ar' ? 'الأحزاب' : 'Hizb',
    ];
    const rows = filtered.map((el, i) => [
      i + 1,
      el.prenom || '',
      el.nom || '',
      el.eleve_id_ecole || '',
      niveaux.find(n => n.code === el.code_niveau)?.nom || el.code_niveau || '',
      el.instNom || '',
      el.pts?.total || 0,
      el.pts?.details?.nbTomon || 0,
      el.pts?.details?.nbHizb || 0,
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `notes_${periode}_${dateStr}.xlsx`;
    try {
      await exportExcelSimple(
        filename,
        [headers, ...rows],
        lang === 'ar' ? 'النقاط' : 'Notes',
      );
    } catch (err) {
      alert((lang === 'ar' ? 'خطأ Excel : ' : 'Erreur Excel : ') + err.message);
    }
  };

  // Etape 14 v2 - PERIODES gere par PeriodeSelectorHybride (voir plus bas)

  // Helper pour recuperer le label de la periode active (utile pour exports)
  const getPeriodeLabel = () => {
    const isAr = lang === 'ar';
    if (periode === 'total')   return isAr?'منذ البداية':'Depuis le début';
    if (periode === 'semaine') return isAr?'الأسبوع':'Semaine';
    if (periode === 'mois')    return isAr?'الشهر':'Ce mois';
    if (periode === 'custom')  return isAr?'فترة محددة':'Période personnalisée';
    if (periode === 'annee_scolaire' && anneeActive) return anneeActive.nom;
    if (periode && periode.startsWith('bdd_')) {
      const p = periodesBDD.find(x => x.id === periode.substring(4));
      if (p) return formatPeriodeCourte(p, lang, true);
    }
    return '';
  };

  return (
    <div style={{ padding: isMobile?'0':'1.5rem', paddingBottom:80, background: isMobile?'#f5f5f0':'transparent', minHeight: isMobile?'100vh':'auto' }}>
      {isMobile ? (
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 16px',marginBottom:12,position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:4}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>⭐ {lang==='ar'?'قائمة النقاط':'Notes & Points'}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.75)'}}>{filtered.length} {lang==='ar'?'طالب':'élève(s)'}</div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={handlePdfExport} disabled={genPdf||filtered.length===0}
                style={{background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:(genPdf||filtered.length===0)?'default':'pointer',opacity:(genPdf||filtered.length===0)?0.5:1,whiteSpace:'nowrap',fontFamily:'inherit'}}>
                {genPdf ? '⏳' : '📄 PDF'}
              </button>
              <button onClick={handleExcelExport} disabled={filtered.length===0}
                style={{background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 11px',color:'#fff',fontSize:12,fontWeight:600,cursor:filtered.length===0?'default':'pointer',opacity:filtered.length===0?0.5:1,whiteSpace:'nowrap',fontFamily:'inherit'}}>
                📊 Excel
              </button>
            </div>
          </div>
        </div>
      ) : (
      <PageHeader
        title="Liste des notes"
        titleAr="قائمة النقاط"
        icon="⭐"
        subtitle={`${filtered.length} ${lang==='ar'?'طالب':'élève(s)'}`}
        onBack={() => goBack ? goBack() : navigate('dashboard')}
        lang={lang}
        actions={
          <ExportButtons
            onPDF={handlePdfExport}
            onExcel={handleExcelExport}
            lang={lang}
            variant="inline"
            compact
            disabled={genPdf || filtered.length === 0}
          />
        }
      />
      )}

      {/* M4 — Wrapper padding mobile (avant : contenu touchait les bords) */}
      <div style={{padding: isMobile?'0 12px':0}}>

      {/* Sélecteur période - Etape 14 v2 - Composant hybride */}
      {(() => {
        // Boutons rapides Liste Notes : [Total] [Ce mois] [T en cours]
        const isAr = lang === 'ar';
        const trimestresBDD = periodesBDD.filter(p => p.type === 'trimestre');
        const semestresBDD = periodesBDD.filter(p => p.type === 'semestre');
        const trimestreEnCours = detecterPeriodeEnCours(trimestresBDD);
        const boutonsRapides = [
          { key:'total', label:isAr?'منذ البداية':'Depuis le début' },
          { key:'mois', label:isAr?'الشهر':'Ce mois' },
          ...(trimestreEnCours ? [{ key:'bdd_'+trimestreEnCours.id, label: formatPeriodeCourte(trimestreEnCours, lang, true) }] : []),
        ];
        const idsRapides = boutonsRapides.map(b => b.key);
        const dropdownItems = [
          { groupe: isAr?'حديث':'Récent', items: [
            { key:'semaine', label:isAr?'الأسبوع':'Semaine' },
          ].filter(item => !idsRapides.includes(item.key)) },
          { groupe: isAr?'الفصول الدراسية':'Trimestres', items:
            trimestresBDD.map(p => ({ key:'bdd_'+p.id, label: formatPeriodeCourte(p, lang, true) }))
              .filter(item => !idsRapides.includes(item.key))
          },
          { groupe: isAr?'الحصيلة':'Bilans', items: [
            ...semestresBDD.map(p => ({ key:'bdd_'+p.id, label: formatPeriodeCourte(p, lang, true) })),
            ...(anneeActive ? [{ key:'annee_scolaire', label: anneeActive.nom }] : []),
          ].filter(item => !idsRapides.includes(item.key)) },
        ].filter(g => g.items.length > 0);
        return (
          <div style={{marginBottom:'1rem'}}>
            <PeriodeSelectorHybride
              boutonsRapides={boutonsRapides}
              dropdownItems={dropdownItems}
              allowCustom={true}
              periode={periode}
              setPeriode={setPeriode}
              dateDebut={dateDebut}
              dateFin={dateFin}
              setDateDebut={setDateDebut}
              setDateFin={setDateFin}
              lang={lang}
              variant="default"
            />
            {periodesBDD.length === 0 && !anneeActive && (
              <div style={{
                background:'#FFF8EC',border:'1px solid #EF9F2740',borderRadius:8,
                padding:'8px 12px',fontSize:11,color:'#7B5800',marginTop:8,
                display:'flex',alignItems:'center',gap:8,
              }}>
                <span style={{fontSize:14}}>💡</span>
                <span>{isAr
                  ? 'لم تقم بإعداد سنة دراسية. يمكنك ذلك في الإدارة > الفترات'
                  : 'Aucune année scolaire active. Configurez-en une dans Gestion → Périodes'}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filtres */}
      <div className="card" style={{ marginBottom:'1.25rem', margin: isMobile?'0 12px 12px':'', borderRadius: isMobile?12:undefined }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
          <input className="field-input" placeholder={'🔍 '+(lang==='ar'?'رقم أو اسم الطالب':'N° ou nom élève')}
            value={searchNum} onChange={e=>setSearchNum(e.target.value)} />
          <select className="field-select" value={filtreNiveau} onChange={e=>setFiltreNiveau(e.target.value)}>
            <option value="">{lang==='ar'?'كل المستويات':'Tous les niveaux'}</option>
            {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
          </select>
          <select className="field-select" value={filtreInst} onChange={e=>setFiltreInst(e.target.value)}>
            <option value="">{lang==='ar'?'كل الأساتذة':'Tous les instituteurs'}</option>
            {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div>
          <style>{`@keyframes skelPulse{0%,100%{opacity:1}50%{opacity:0.55}}`}</style>
          {[0,1,2,3,4,5,6,7].map(i => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#fff', borderBottom:'1px solid #eee', animation:'skelPulse 1.2s ease-in-out infinite'}}>
              <div style={{width:28, height:16, background:'#e5e5df', borderRadius:4}} />
              <div style={{flex:1, height:16, background:'#e5e5df', borderRadius:4}} />
              <div style={{width:60, height:16, background:'#e5e5df', borderRadius:4}} />
              <div style={{width:40, height:16, background:'#e5e5df', borderRadius:4}} />
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{lang==='ar'?'الطالب':'Élève'}</th>
                <th>{lang==='ar'?'المستوى':'Niveau'}</th>
                <th>{lang==='ar'?'الأستاذ':'Instituteur'}</th>
                <th>{lang==='ar'?'الأثمان/السور':'Tomon/Sourates'}</th>
                <th>{lang==='ar'?'الأحزاب':'Hizb'}</th>
                <th>{lang==='ar'?'الامتحانات':'Examens'}</th>
                <th>{lang==='ar'?'الشهادات':'Certs'}</th>
                <th style={{color:'#378ADD'}}>{lang==='ar'?'المجموع':'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="empty">{lang==='ar'?'لا توجد بيانات':'Aucune donnée'}</td></tr>
              )}
              {(filtered||[]).map((el, idx) => {
                const nc = getNivColor(el.code_niveau);
                return (
                  <tr key={el.id} className="clickable" onClick={()=>navigate('fiche',el)}>
                    <td style={{color:'#aaa',fontSize:12}}>{idx+1}</td>
                    <td>
                      <div style={{fontWeight:600,fontSize:13}}>{el.prenom} {el.nom}</div>
                      <div style={{fontSize:10,color:'#aaa'}}>{lang==='ar'?'رقم':'N°'} {el.eleve_id_ecole}</div>
                    </td>
                    <td><span style={{padding:'2px 6px',borderRadius:8,fontSize:10,fontWeight:700,background:nc+'18',color:nc}}>{el.code_niveau}</span></td>
                    <td style={{fontSize:11,color:'#888'}}>{el.instNom}</td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#378ADD'}}>{el.pts.tomonPeriode}</span>
                      {el.pts.ptsTomon>0 && <div style={{fontSize:9,color:'#aaa'}}>+{el.pts.ptsTomon} {lang==='ar'?'ن':'pts'}</div>}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#085041'}}>{el.pts.hizbsPeriode}</span>
                      {el.pts.ptsHizb>0 && <div style={{fontSize:9,color:'#aaa'}}>+{el.pts.ptsHizb} {lang==='ar'?'ن':'pts'}</div>}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#EF9F27'}}>{el.pts.ptsExamens||0}</span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontWeight:700,color:'#D85A30'}}>{el.pts.ptsCertificats||0}</span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{fontSize:15,fontWeight:800,color:'#378ADD'}}>{el.pts.total.toLocaleString()}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
