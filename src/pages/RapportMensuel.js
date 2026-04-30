import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calcEtatEleve, getInitiales , loadBareme, BAREME_DEFAUT, getSensForEleve} from '../lib/helpers';
import { fetchAll } from '../lib/fetchAll';
import { openPDF } from '../lib/pdf';
import ExportButtons from '../components/ExportButtons';
import PageHeader from '../components/PageHeader';

const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MOIS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const getMoisNom = (idx, lang) => lang==='ar' ? MOIS_AR[idx] : MOIS_FR[idx];
const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR');
const pctColor = (p) => p>=100?'#1D9E75':p>=70?'#EF9F27':'#E24B4A';
const pctBg    = (p) => p>=100?'#E1F5EE':p>=70?'#FAEEDA':'#FCEBEB';
const statut   = (p, lang) => p>=100?(lang==='ar'?'🟢 متفوق':'🟢 Atteint'):p>=70?(lang==='ar'?'🟡 قريب':'🟡 En cours'):(lang==='ar'?'🔴 متأخر':'🔴 En retard');

function Avatar({ prenom, nom, size=34 }) {
  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:'#E1F5EE',color:'#085041',
      display:'flex',alignItems:'center',justifyContent:'center',
      fontWeight:700,fontSize:size*0.33,flexShrink:0}}>
      {getInitiales(prenom,nom)}
    </div>
  );
}

export default function RapportMensuel({ user, navigate, goBack, lang='fr', isMobile }) {
  const now = new Date();
  const [mois,       setMois]       = useState(now.getMonth());
  const [annee,      setAnnee]      = useState(now.getFullYear());
  const [eleves,     setEleves]     = useState([]);
  const [niveaux,    setNiveaux]    = useState([]);
  const [instituteurs,setInstituteurs]=useState([]);
  const [validations,setValidations]=useState([]);
  const [recitations,setRecitations]=useState([]);
  const [objectifs,  setObjectifs]  = useState([]);
  const [examens,    setExamens]    = useState([]);
  const [resultats,  setResultats]  = useState([]);
  const [ecole,      setEcole]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [bareme, setBareme] = React.useState({...BAREME_DEFAUT});
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
    const [
      {data:el},{data:nv},{data:inst},{data:vd},{data:rd},
      {data:ob},{data:ex},{data:re},{data:ec}
    ] = await Promise.all([
      supabase.from('eleves').select('*').eq('ecole_id',user.ecole_id).is('suspendu_at', null).order('nom'),
      supabase.from('niveaux').select('*').eq('ecole_id',user.ecole_id).order('ordre'),
      supabase.from('utilisateurs').select('*').eq('role','instituteur').eq('ecole_id',user.ecole_id),
      fetchAll(supabase.from('validations').select('*').eq('ecole_id',user.ecole_id)).then(data=>({data})),
      fetchAll(supabase.from('recitations_sourates').select('*').eq('ecole_id',user.ecole_id)).then(data=>({data})),
      supabase.from('objectifs').select('*').eq('ecole_id',user.ecole_id).eq('actif',true),
      supabase.from('examens').select('*').eq('ecole_id',user.ecole_id),
      supabase.from('resultats_examens').select('*').eq('ecole_id',user.ecole_id),
      supabase.from('ecoles').select('*').eq('id',user.ecole_id).maybeSingle(),
    ]);
    setEleves(el||[]);
    setNiveaux(nv||[]);
    setInstituteurs(inst||[]);
    setValidations(vd||[]);
    setRecitations(rd||[]);
    setObjectifs(ob||[]);
    setExamens(ex||[]);
    setResultats(re||[]);
    setEcole(ec);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const debutMois = new Date(annee, mois, 1);
  const finMois   = new Date(annee, mois+1, 0, 23, 59, 59);

  // ── Calcul stats par élève (memoize : tres lourd, depend de eleves+validations+...) ──
  const statsEleves = useMemo(() => (eleves||[]).map(e => {
    const vals  = validations.filter(v=>v.eleve_id===e.id);
    const sensE = getSensForEleve(e, niveaux, ecole);
    const etat  = calcEtatEleve(vals, e.hizb_depart, e.tomon_depart, sensE);
    const inst  = instituteurs.find(i=>i.id===e.instituteur_referent_id);
    const niv   = niveaux.find(n=>n.code===e.code_niveau);
    const isSourate = niv?.type==='sourate';

    const vMois = validations.filter(v=>v.eleve_id===e.id&&new Date(v.date_validation)>=debutMois&&new Date(v.date_validation)<=finMois);
    const rMois = recitations.filter(r=>r.eleve_id===e.id&&new Date(r.date_validation)>=debutMois&&new Date(r.date_validation)<=finMois);

    const tomonMois   = vMois.filter(v=>v.type_validation==='tomon').reduce((s,v)=>s+(v.nombre_tomon||0),0);
    const hizbMois    = vMois.filter(v=>v.type_validation==='hizb_complet').length;
    const souratesMois= rMois.filter(r=>r.type_recitation==='complete').length;
    const seqMois     = rMois.filter(r=>r.type_recitation==='sequence').length;
    const seances     = new Set(vMois.map(v=>new Date(v.date_validation).toDateString())).size +
                        new Set(rMois.map(r=>new Date(r.date_validation).toDateString())).size;
    const ptsMois     = isSourate
      ? rMois.reduce((s,r)=>s+(r.points||0),0)
      : tomonMois*(bareme.tomon || 0) + Math.floor(tomonMois/2)*25 + Math.floor(tomonMois/4)*60 + hizbMois*100;

    // Objectifs
    const objNiveau = objectifs.find(o=>
      o.type_cible==='niveau' && o.niveau_id===niv?.id &&
      new Date(o.date_debut)<=finMois && new Date(o.date_fin)>=debutMois
    );
    const objPerso = objectifs.find(o=>
      o.type_cible==='eleve' && o.eleve_id===e.id &&
      new Date(o.date_debut)<=finMois && new Date(o.date_fin)>=debutMois
    );

    const calcAtteinte = (obj) => {
      if (!obj) return null;
      let realise = 0;
      if (obj.metrique==='tomon')    realise=tomonMois;
      if (obj.metrique==='hizb')     realise=hizbMois;
      if (obj.metrique==='sourate')  realise=souratesMois;
      if (obj.metrique==='ensemble') realise=seqMois;
      const pct = Math.min(100, Math.round(realise/Math.max(1,obj.valeur_cible)*100));
      return { realise, pct, obj };
    };

    return {
      ...e, etat, inst, niv, isSourate,
      tomonMois, hizbMois, souratesMois, seqMois, seances, ptsMois,
      attNiveau: calcAtteinte(objNiveau),
      attPerso:  calcAtteinte(objPerso),
      actif: tomonMois>0||hizbMois>0||souratesMois>0,
    };
  }).sort((a,b)=>b.ptsMois-a.ptsMois),
  [eleves, validations, recitations, niveaux, instituteurs, objectifs, ecole, bareme, debutMois, finMois]);

  // ── KPIs globaux ───────────────────────────────────────────────
  const nbActifs     = statsEleves.filter(e=>e.actif).length;
  const tauxActivite = eleves.length>0?Math.round(nbActifs/eleves.length*100):0;
  const totalTomon   = statsEleves.reduce((s,e)=>s+e.tomonMois,0);
  const totalHizb    = statsEleves.reduce((s,e)=>s+e.hizbMois,0);
  const totalSourates= statsEleves.reduce((s,e)=>s+e.souratesMois,0);
  const reMois       = resultats.filter(r=>new Date(r.date_examen||r.created_at)>=debutMois&&new Date(r.date_examen||r.created_at)<=finMois);
  const exReussis    = reMois.filter(r=>r.statut==='reussi').length;
  const exTotal      = reMois.length;
  const tauxExamens  = exTotal>0?Math.round(exReussis/exTotal*100):null;
  const elevesAvecObj= statsEleves.filter(e=>e.attNiveau||e.attPerso).length;
  const tauxAtteinte = elevesAvecObj>0
    ? Math.round(statsEleves.filter(e=>e.attPerso?.pct>=100||(!e.attPerso&&e.attNiveau?.pct>=100)).length/elevesAvecObj*100)
    : null;

  // ── Stats par niveau (memoize) ─────────────────────────────────
  const statsByNiveau = useMemo(() => (niveaux||[]).map(niv => {
    const el = statsEleves.filter(e=>e.code_niveau===niv.code);
    const actifs = el.filter(e=>e.actif).length;
    const moy = el.length>0?Math.round(el.reduce((s,e)=>s+e.ptsMois,0)/el.length):0;
    const objNiv = objectifs.find(o=>o.type_cible==='niveau'&&o.niveau_id===niv.id&&new Date(o.date_debut)<=finMois&&new Date(o.date_fin)>=debutMois);
    const pctNiv = objNiv && el.length>0
      ? Math.round(el.reduce((s,e)=>s+(e.attNiveau?.pct||0),0)/el.length)
      : null;
    return { niv, el, actifs, moy, objNiv, pctNiv, top3: [...el].slice(0,3) };
  }).filter(s=>s.el.length>0),
  [niveaux, statsEleves, objectifs, debutMois, finMois]);

  // ── Stats par instituteur (memoize) ────────────────────────────
  const statsByInst = useMemo(() => (instituteurs||[]).map(inst => {
    const el = statsEleves.filter(e=>e.instituteur_referent_id===inst.id);
    const actifs = el.filter(e=>e.actif).length;
    const tomon  = el.reduce((s,e)=>s+e.tomonMois,0);
    const hizb   = el.reduce((s,e)=>s+e.hizbMois,0);
    const pts    = el.reduce((s,e)=>s+e.ptsMois,0);
    return { inst, el, actifs, tomon, hizb, pts };
  }).filter(s=>s.el.length>0),
  [instituteurs, statsEleves]);

  const prevMois = () => { if(mois===0){setMois(11);setAnnee(a=>a-1);}else setMois(m=>m-1); };
  const nextMois = () => { if(mois===11){setMois(0);setAnnee(a=>a+1);}else setMois(m=>m+1); };

  // ── GÉNÉRATION PDF CÔTÉ SERVEUR ────────────────────────────────
  // Utilise le helper centralisé openPDF() qui gere l'ouverture dans
  // un nouvel onglet + fallback blob si popup bloque. Meme template
  // serveur que les autres exports PDF.
  const genererRapportPDF = async () => {
    setGenerating(true);
    try {
      const moisLabel = getMoisNom(mois, lang);
      const ecolNom   = ecole?.nom || 'École Coranique';

      const elevesData = (statsEleves||[]).map(e => ({
        prenom: e.prenom, nom: e.nom,
        code_niveau: e.code_niveau,
        pts: e.pts || 0,
        tomon: e.tomon || 0,
        hizb: e.hizb || 0,
        jours: e.joursActifs || 0,
      }));

      await openPDF('rapport_mensuel', {
        ecole: { nom: ecolNom },
        mois: moisLabel,
        annee,
        eleves: elevesData,
        stats: {
          totalPts: elevesData.reduce((s,e)=>s+e.pts,0),
          totalTomon: totalTomon,
          totalHizb: totalHizb,
        },
      }, lang);
    } catch(err) {
      console.error(err);
      alert('Erreur génération PDF : ' + err.message);
    }
    setGenerating(false);
  };

  // ── PREVIEW UI ─────────────────────────────────────────────────
  return (
    <div style={{paddingBottom:isMobile?80:0, background:isMobile?'#f5f5f0':'transparent', minHeight:isMobile?'100vh':'auto'}}>
      {/* Header mobile */}
      {isMobile ? (
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'8px 12px',color:'#fff',fontSize:16,cursor:'pointer'}}>←</button>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:'#fff'}}>📊 {lang==='ar'?'التقرير الشهري':'Rapport mensuel'}</div>
            </div>
            <button onClick={genererRapportPDF} disabled={generating||loading}
              style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 12px',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              {generating?'⏳':'📄 PDF'}
            </button>
          </div>
          {/* Navigation mois */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
            <button onClick={prevMois} style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:8,padding:'6px 14px',color:'#fff',cursor:'pointer',fontSize:18}}>‹</button>
            <div style={{fontSize:15,fontWeight:700,color:'#fff',minWidth:140,textAlign:'center'}}>
              {getMoisNom(mois,lang)} {annee}
            </div>
            <button onClick={nextMois} style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:8,padding:'6px 14px',color:'#fff',cursor:'pointer',fontSize:18}}>›</button>
          </div>
        </div>
      ) : (
      <PageHeader
        title="Rapport mensuel"
        titleAr="التقرير الشهري"
        icon="📊"
        onBack={() => goBack ? goBack() : navigate('dashboard')}
        lang={lang}
        actions={
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button onClick={prevMois} style={{padding:'6px 12px',border:'0.5px solid #e0e0d8',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:16}}>‹</button>
              <div style={{fontSize:13,fontWeight:700,minWidth:120,textAlign:'center'}}>{getMoisNom(mois,lang)} {annee}</div>
              <button onClick={nextMois} style={{padding:'6px 12px',border:'0.5px solid #e0e0d8',borderRadius:8,background:'#fff',cursor:'pointer',fontSize:16}}>›</button>
            </div>
            <ExportButtons
              onPDF={genererRapportPDF}
              lang={lang}
              variant="inline"
              compact
              disabled={generating||loading}
            />
          </div>
        }
      />
      )}

      {loading ? <div style={{textAlign:'center',padding:'3rem',color:'#888'}}>...</div> : (
        <>
          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(6,1fr)',gap:8,marginBottom:'1.25rem'}}>
            {[
              {val:nbActifs,       lbl:lang==='ar'?'طلاب نشطون':'Élèves actifs',       c:'#085041',bg:'#E1F5EE'},
              {val:`${tauxActivite}%`,lbl:lang==='ar'?'نسبة النشاط':'Taux d\'activité', c:'#1D9E75',bg:'#E1F5EE'},
              {val:totalTomon,     lbl:lang==='ar'?'أثمان مُسمَّعة':'Tomon récités',    c:'#378ADD',bg:'#E6F1FB'},
              {val:totalHizb,      lbl:lang==='ar'?'أحزاب مكتملة':'Hizb complets',     c:'#EF9F27',bg:'#FAEEDA'},
              {val:exTotal>0?`${exReussis}/${exTotal}`:'-', lbl:lang==='ar'?'امتحانات':'Examens', c:'#534AB7',bg:'#EEEDFE'},
              {val:tauxAtteinte!=null?`${tauxAtteinte}%`:'-', lbl:lang==='ar'?'بلوغ الأهداف':'Taux objectifs', c:'#D85A30',bg:'#FAECE7'},
            ].map((k,i)=>(
              <div key={i} style={{background:k.bg,borderRadius:12,padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:isMobile?20:22,fontWeight:800,color:k.c}}>{k.val}</div>
                <div style={{fontSize:10,color:k.c,opacity:0.8,marginTop:2}}>{k.lbl}</div>
              </div>
            ))}
          </div>

          {/* Par niveau */}
          <div style={{fontSize:12,fontWeight:700,color:'#888',textTransform:'uppercase',
            letterSpacing:'1px',marginBottom:10}}>
            {lang==='ar'?'أداء المستويات':'Performance par niveau'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(280px,1fr))',gap:10,marginBottom:'1.25rem'}}>
            {statsByNiveau.map(({niv,el,actifs,moy,objNiv,pctNiv,top3})=>(
              <div key={niv.id} style={{background:'#fff',borderRadius:14,padding:'14px 16px',
                border:`0.5px solid ${niv.couleur}30`,borderLeft:`4px solid ${niv.couleur}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div>
                    <span style={{fontWeight:700,fontSize:15,color:niv.couleur}}>{niv.code}</span>
                    <span style={{fontSize:12,color:'#888',marginRight:6}}> — {niv.nom}</span>
                  </div>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                    background:`${niv.couleur}20`,color:niv.couleur,fontWeight:700}}>
                    {actifs}/{el.length} {lang==='ar'?'نشط':'actifs'}
                  </span>
                </div>
                {/* Top 3 */}
                <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:objNiv?10:0}}>
                  {top3.filter(e=>e.actif).slice(0,3).map((e,i)=>(
                    <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                      <span style={{fontSize:14,width:20}}>{['🥇','🥈','🥉'][i]}</span>
                      <span style={{flex:1,fontWeight:i===0?700:400}}>{e.prenom} {e.nom}</span>
                      <span style={{color:'#1D9E75',fontWeight:700}}>{e.ptsMois} pts</span>
                    </div>
                  ))}
                  {top3.filter(e=>e.actif).length===0&&(
                    <div style={{fontSize:12,color:'#aaa',textAlign:'center',padding:'4px 0'}}>
                      {lang==='ar'?'لا نشاط هذا الشهر':'Aucune activité ce mois'}
                    </div>
                  )}
                </div>
                {/* Objectif niveau */}
                {objNiv&&pctNiv!==null&&(
                  <div style={{marginTop:8,paddingTop:8,borderTop:'0.5px solid #f0f0ec'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                      <span style={{color:'#666'}}>🎯 Objectif niveau : {objNiv.valeur_cible} {objNiv.metrique}</span>
                      <span style={{fontWeight:700,color:pctColor(pctNiv)}}>{pctNiv}%</span>
                    </div>
                    <div style={{height:6,background:'#e8e8e0',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,width:`${pctNiv}%`,
                        background:pctColor(pctNiv),transition:'width 0.4s'}}/>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tableau élèves */}
          <div style={{fontSize:12,fontWeight:700,color:'#888',textTransform:'uppercase',
            letterSpacing:'1px',marginBottom:10}}>
            {lang==='ar'?'الأداء التفصيلي للطلاب':'Performance détaillée des élèves'}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:'1.25rem'}}>
            {statsEleves.map((e,idx)=>(
              <div key={e.id} style={{background:'#fff',borderRadius:12,padding:'12px 16px',
                border:'0.5px solid #e0e0d8',opacity:e.actif?1:0.6}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:16,minWidth:28,textAlign:'center'}}>{['🥇','🥈','🥉'][idx]||idx+1}</span>
                  <Avatar prenom={e.prenom} nom={e.nom}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13}}>{e.prenom} {e.nom}
                      {e.eleve_id_ecole&&<span style={{fontSize:10,color:'#aaa',marginRight:6}}> #{e.eleve_id_ecole}</span>}
                    </div>
                    <div style={{fontSize:11,color:'#888'}}>
                      <span style={{padding:'1px 6px',borderRadius:20,fontSize:10,fontWeight:700,
                        background:`${e.niv?.couleur||'#888'}20`,color:e.niv?.couleur||'#888',marginLeft:4}}>
                        {e.code_niveau}
                      </span>
                      {e.inst&&` · ${e.inst.prenom} ${e.inst.nom}`}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
                    {!e.isSourate&&e.tomonMois>0&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#E6F1FB',color:'#0C447C',fontWeight:600}}>{e.tomonMois} T</span>}
                    {!e.isSourate&&e.hizbMois>0&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#E1F5EE',color:'#085041',fontWeight:600}}>{e.hizbMois} H</span>}
                    {e.isSourate&&e.souratesMois>0&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#E1F5EE',color:'#085041',fontWeight:600}}>{e.souratesMois} سورة</span>}
                    {e.seances>0&&<span style={{fontSize:11,color:'#aaa'}}>{e.seances} séances</span>}
                    <span style={{fontSize:14,fontWeight:800,color:'#1D9E75',minWidth:50,textAlign:'left'}}>{e.ptsMois} pts</span>
                  </div>
                </div>
                {/* Barres objectifs */}
                {(e.attNiveau||e.attPerso)&&(
                  <div style={{marginTop:8,paddingTop:8,borderTop:'0.5px solid #f5f5f0',
                    display:'flex',flexDirection:'column',gap:5,paddingRight:isMobile?0:38}}>
                    {e.attNiveau&&(
                      <div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#888',marginBottom:2}}>
                          <span>📊 {lang==='ar'?'هدف المستوى':'Obj. niveau'} — {e.attNiveau.obj.valeur_cible} {e.attNiveau.obj.metrique}</span>
                          <span style={{fontWeight:700,color:pctColor(e.attNiveau.pct)}}>{e.attNiveau.realise}/{e.attNiveau.obj.valeur_cible} · {e.attNiveau.pct}%</span>
                        </div>
                        <div style={{height:5,background:'#e8e8e0',borderRadius:3,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:3,width:`${e.attNiveau.pct}%`,background:pctColor(e.attNiveau.pct)}}/>
                        </div>
                      </div>
                    )}
                    {e.attPerso&&(
                      <div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#534AB7',marginBottom:2}}>
                          <span>👤 {lang==='ar'?'هدف شخصي':'Obj. personnel'} — {e.attPerso.obj.valeur_cible} {e.attPerso.obj.metrique}</span>
                          <span style={{fontWeight:700,color:pctColor(e.attPerso.pct)}}>{e.attPerso.realise}/{e.attPerso.obj.valeur_cible} · {e.attPerso.pct}%</span>
                        </div>
                        <div style={{height:5,background:'#e8e8e0',borderRadius:3,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:3,width:`${e.attPerso.pct}%`,background:pctColor(e.attPerso.pct)}}/>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Par instituteur */}
          {statsByInst.length>0&&(
            <>
              <div style={{fontSize:12,fontWeight:700,color:'#888',textTransform:'uppercase',
                letterSpacing:'1px',marginBottom:10}}>
                {lang==='ar'?'أداء المدرسين':'Performance par instituteur'}
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(220px,1fr))',gap:10,marginBottom:'1.25rem'}}>
                {statsByInst.map(({inst,el,actifs,tomon,hizb,pts})=>(
                  <div key={inst.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <Avatar prenom={inst.prenom} nom={inst.nom}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:600}}>{inst.prenom} {inst.nom}</div>
                        <div style={{fontSize:11,color:'#888'}}>{actifs}/{el.length} {lang==='ar'?'نشطون':'actifs'}</div>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                      {[['Tomon',tomon,'#E6F1FB','#0C447C'],['Hizb',hizb,'#E1F5EE','#085041'],['Pts',pts,'#EEEDFE','#534AB7']].map(([l,v,bg,c])=>(
                        <div key={l} style={{background:bg,borderRadius:6,padding:'6px',textAlign:'center'}}>
                          <div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div>
                          <div style={{fontSize:9,color:c,opacity:0.8}}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Examens du mois */}
          {reMois.length>0&&(
            <>
              <div style={{fontSize:12,fontWeight:700,color:'#888',textTransform:'uppercase',
                letterSpacing:'1px',marginBottom:10}}>
                {lang==='ar'?'امتحانات الشهر':'Examens du mois'}
              </div>
              <div style={{background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8',
                padding:'14px',marginBottom:'1.25rem'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
                  {[
                    {l:lang==='ar'?'مجموع':'Total',   v:exTotal,   c:'#085041',bg:'#E1F5EE'},
                    {l:lang==='ar'?'ناجح':'Réussis',   v:exReussis, c:'#1D9E75',bg:'#E1F5EE'},
                    {l:lang==='ar'?'نسبة':'Taux',      v:`${tauxExamens}%`,c:'#534AB7',bg:'#EEEDFE'},
                  ].map((s,i)=>(
                    <div key={i} style={{background:s.bg,borderRadius:10,padding:'10px',textAlign:'center'}}>
                      <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:10,color:s.c,opacity:0.8}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {reMois.slice(0,5).map(r=>{
                    const el=eleves.find(e=>e.id===r.eleve_id);
                    const ex=examens.find(e=>e.id===r.examen_id);
                    const ok=r.statut==='reussi';
                    return(
                      <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,
                        padding:'8px 12px',borderRadius:8,background:ok?'#E1F5EE':'#FCEBEB'}}>
                        <span style={{fontSize:16}}>{ok?'✅':'❌'}</span>
                        <span style={{flex:1,fontSize:12,fontWeight:500}}>
                          {el?`${el.prenom} ${el.nom}`:'?'}
                        </span>
                        <span style={{fontSize:11,color:'#666'}}>{ex?.nom||'?'}</span>
                        <span style={{fontSize:13,fontWeight:700,color:ok?'#1D9E75':'#E24B4A'}}>{r.score}%</span>
                      </div>
                    );
                  })}
                  {reMois.length>5&&<div style={{fontSize:11,color:'#aaa',textAlign:'center'}}>+{reMois.length-5} autres</div>}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
