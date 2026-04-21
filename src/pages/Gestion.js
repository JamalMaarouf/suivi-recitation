import React, { useState, useEffect } from 'react';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import { getInitiales, calcEtatEleve, calcPoints, BAREME_DEFAUT, loadBareme, saveBaremeItem, isSourateNiveauDyn, getSensForEleve} from '../lib/helpers';
import { SOURATES_5B, SOURATES_5A, SOURATES_2M, isSourateNiveau } from '../lib/sourates';
import { t } from '../lib/i18n';

function Avatar({ prenom, nom, size = 28 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

// Sélecteur acquis antérieurs — adapté selon le niveau et le sens de récitation
// Prop programmeNiveau (optionnel) : si fourni et contient plusieurs blocs, affiche une
// aide contextuelle indiquant dans quel bloc pédagogique le Hizb choisi se situe.
function AcquisSelector({ codeNiveau, hizb, tomon, onHizbChange, onTomonChange, souratesAcquises, onSouratesChange, lang, niveauxDyn=[], sens='desc', programmeNiveau=[] }) {
  const _niv = niveauxDyn.find(n=>n.code===codeNiveau);
  const isSourate = _niv ? _niv.type==='sourate' : ['5B','5A','2M'].includes(codeNiveau);

  if (isSourate) {
    const souratesNiveau = codeNiveau === '5B' ? SOURATES_5B : codeNiveau === '5A' ? SOURATES_5A : SOURATES_2M;
    // desc : on commence par 114 → 1 (les plus courtes d'abord)
    // asc  : on commence par 1 → 114 (Al-Fatiha d'abord)
    const souratesOrdonnees = [...souratesNiveau].sort((a,b) =>
      sens === 'asc' ? a.numero - b.numero : b.numero - a.numero);
    const nbAcquis = souratesAcquises || 0;
    // Sourates acquired = first N sourates in order (selon sens)
    const ptsAcquis = nbAcquis * 30; // 30 pts per complete sourate

    return (
      <div style={{background:'#f9f9f6',borderRadius:12,padding:'1rem',border:'0.5px solid #e0e0d8'}}>
        <div style={{fontSize:11,color:'#888',marginBottom:10,textAlign:'center'}}>
          {lang==='ar'?'عدد السور المحفوظة قبل بدء المتابعة':lang==='en'?'Surahs memorized before tracking':'Sourates mémorisées avant le début du suivi'}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <button onClick={()=>onSouratesChange(Math.max(0,nbAcquis-1))}
            style={{width:36,height:36,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:18,fontWeight:700}}>−</button>
          <div style={{flex:1,textAlign:'center'}}>
            <div style={{fontSize:32,fontWeight:800,color:'#1D9E75'}}>{nbAcquis}</div>
            <div style={{fontSize:11,color:'#888'}}>/ {souratesNiveau.length} {lang==='ar'?'سورة':lang==='en'?'surahs':'sourates'}</div>
            <div style={{fontSize:11,color:nbAcquis===0?'#888':'#1D9E75',marginTop:4,fontWeight:600}}>
              {nbAcquis===0?(lang==='ar'?'لا توجد مكتسبات سابقة':'Aucun acquis antérieur'):`${lang==='ar'?'من':'De'} ${souratesOrdonnees[nbAcquis-1]?.numero||''} ${lang==='ar'?'إلى':'à'} ${souratesOrdonnees[0]?.numero||''}`}
            </div>
          </div>
          <button onClick={()=>onSouratesChange(Math.min(souratesNiveau.length, nbAcquis+1))}
            style={{width:36,height:36,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:18,fontWeight:700}}>+</button>
        </div>

        {/* Visual grid of surahs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginBottom:10}}>
          {souratesOrdonnees.map((s,idx)=>{
            const isAcquis = idx < nbAcquis;
            return(
              <div key={s.numero} onClick={()=>onSouratesChange(isAcquis?idx:idx+1)}
                style={{borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  padding:'6px 4px',cursor:'pointer',gap:2,
                  background:isAcquis?'#1D9E75':'#f0f0ec',
                  color:isAcquis?'#fff':'#999',
                  border:`0.5px solid ${isAcquis?'#1D9E75':'#e0e0d8'}`,
                  transition:'all 0.1s'}}>
                <div style={{fontSize:11,fontWeight:700}}>{s.numero}</div>
                <div style={{fontSize:9,fontFamily:"'Tajawal',Arial,sans-serif",direction:'rtl',
                  textAlign:'center',lineHeight:1.2,opacity:isAcquis?0.9:0.7,
                  maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {s.nom_ar.replace('سورة ','')}
                </div>
              </div>
            );
          })}
        </div>

        {nbAcquis > 0 && (
          <div style={{background:'#E1F5EE',borderRadius:10,padding:'10px',textAlign:'center',border:'0.5px solid #9FE1CB'}}>
            <div style={{fontSize:11,color:'#085041',fontWeight:600,marginBottom:2}}>
              🎓 {nbAcquis} {lang==='ar'?'سورة محفوظة':lang==='en'?'surahs memorized':'sourates mémorisées'}
            </div>
            <div style={{fontSize:22,fontWeight:800,color:'#085041'}}>{ptsAcquis.toLocaleString()} {lang==='ar'?'ن':'pts'}</div>
            <div style={{fontSize:10,color:'#0F6E56',marginTop:2}}>
              {lang==='ar'?'ستُحسب تلقائياً':lang==='en'?'Auto-calculated':'Calculés automatiquement'}
            </div>
            {nbAcquis > 0 && (
              <div style={{fontSize:11,color:'#085041',marginTop:4,direction:'rtl'}}>
                {lang==='ar'?'آخر سورة:':lang==='en'?'Last surah:':'Dernière sourate :'} {souratesOrdonnees[nbAcquis-1]?.nom_ar}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Hizb/Tomon selector for 2M, 2, 1
  const hizbList = sens === 'asc'
    ? Array.from({length:60},(_,i)=>i+1)   // 1, 2, ..., 60
    : Array.from({length:60},(_,i)=>60-i); // 60, 59, ..., 1
  const senshHintFR = sens === 'asc' ? '1 → 60' : '60 → 1';
  const senshHintAR = sens === 'asc' ? 'من 1 نحو 60' : 'من 60 نحو 1';
  // Pour "Acquis = X à Y", les bornes dépendent du sens :
  // desc : déjà mémorisé de hizb à 60 (ex: Hizb 5 sélectionné = Hizb 5 à 60 acquis)
  // asc  : déjà mémorisé de 1 à hizb (ex: Hizb 5 sélectionné = Hizb 1 à 5 acquis)
  const acquisLabel = hizb === 0 ? (lang==='ar'?'لا توجد مكتسبات سابقة':'Aucun acquis antérieur')
    : `${lang==='ar'?'الحزب المختار':'Hizb sélectionné'} : ${hizb} — ${lang==='ar'?'المحفوظ':'Acquis'} : ${sens === 'asc' ? `1 ${lang==='ar'?'إلى':'à'} ${hizb}` : `${hizb} ${lang==='ar'?'إلى 60':'à 60'}`}`;

  return (
    <div style={{background:'#f9f9f6',borderRadius:12,padding:'1rem',border:'0.5px solid #e0e0d8'}}>
      <div style={{fontSize:11,color:'#888',marginBottom:10,textAlign:'center'}}>{lang==='ar'?'موقع الطالب في القرآن قبل بدء المتابعة':lang==='en'?'Position in Quran before tracking':'Position dans le Coran avant de commencer le suivi'}</div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:500}}>{lang==='ar'?`انقر على أول حزب محفوظ (${senshHintAR})`:`Cliquez sur le premier Hizb mémorisé (${senshHintFR})`}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>onHizbChange(Math.min(60,hizb+1))} style={{width:32,height:32,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:16,fontWeight:700}}>−</button>
          <div style={{flex:1,display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3}}>
            {hizbList.map(n=>{
              // "déjà acquis" :
              // desc : tous les Hizb >= hizb (de hizb à 60)
              // asc  : tous les Hizb <= hizb (de 1 à hizb)
              const isAcquis = hizb > 0 && (sens === 'asc' ? n <= hizb : n >= hizb);
              return (
                <div key={n} onClick={()=>onHizbChange(n===hizb?0:n)} style={{height:28,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,cursor:'pointer',background:isAcquis?'#1D9E75':'#f0f0ec',color:isAcquis?'#fff':'#999',fontWeight:n===hizb?800:400,border:n===hizb&&hizb>0?'2px solid #085041':'none',transition:'all 0.1s'}}>
                  {n}
                </div>
              );
            })}
          </div>
          <button onClick={()=>onHizbChange(Math.max(0,hizb-1))} style={{width:32,height:32,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:16,fontWeight:700}}>+</button>
        </div>
        <div style={{textAlign:'center',marginTop:6,fontSize:14,fontWeight:700,color:'#1D9E75'}}>{acquisLabel}</div>
      </div>

      {/* ─── Aide par BLOCS pédagogiques (Étape C) ─────────────── */}
      {/* N'apparaît que si le programme du niveau contient plusieurs blocs.
          Indique graphiquement à quel bloc l'élève appartient selon son hizb_depart. */}
      {programmeNiveau && programmeNiveau.length > 0 && (()=>{
        // Grouper le programme par bloc
        const blocsMap = new Map();
        for (const l of programmeNiveau) {
          const n = l.bloc_numero || 1;
          if (!blocsMap.has(n)) blocsMap.set(n, { numero:n, nom:l.bloc_nom, sens:l.bloc_sens||'asc', hizbs:[] });
          const h = parseInt(l.reference_id);
          if (!isNaN(h)) blocsMap.get(n).hizbs.push(h);
        }
        const blocsList = Array.from(blocsMap.values()).sort((a,b)=>a.numero-b.numero);
        if (blocsList.length <= 1) return null; // Mono-bloc : on n'affiche rien

        // Calculer pour chaque bloc : combien de Hizb seront déjà acquis si on garde ce hizb_depart
        // Acquis : en asc, tous les Hizb < hizb ; en desc, tous les Hizb > hizb
        const blocsStat = blocsList.map(b => {
          const hizbsAcquis = hizb === 0 ? [] : b.hizbs.filter(h => sens === 'asc' ? h < hizb : h > hizb);
          const estDansBloc = hizb > 0 && b.hizbs.includes(hizb);
          const total = b.hizbs.length;
          const estComplet = hizbsAcquis.length === total && total > 0;
          return { ...b, nbAcquis: hizbsAcquis.length, total, estComplet, estDansBloc };
        });

        return (
          <div style={{marginTop:10, background:'#F0EEFF', borderRadius:10, padding:'10px 12px', border:'0.5px solid #534AB740'}}>
            <div style={{fontSize:11, color:'#534AB7', fontWeight:600, marginBottom:8, display:'flex', alignItems:'center', gap:6}}>
              <span>📚</span>
              <span>{lang==='ar'?'موقع الطالب حسب البلوكات':'Position par blocs pédagogiques'}</span>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:5}}>
              {blocsStat.map(b => {
                const color = b.estComplet ? '#1D9E75' : (b.estDansBloc ? '#EF9F27' : (b.nbAcquis > 0 ? '#378ADD' : '#888'));
                const bg = b.estComplet ? '#E1F5EE' : (b.estDansBloc ? '#FAEEDA' : (b.nbAcquis > 0 ? '#E6F1FB' : '#f5f5f0'));
                const statut = b.estComplet
                  ? (lang==='ar' ? 'مكتسب كامل' : 'Entièrement acquis')
                  : b.estDansBloc
                    ? (lang==='ar' ? 'البلوك الحالي' : 'Bloc actuel')
                    : b.nbAcquis > 0
                      ? (lang==='ar' ? 'جزئي' : 'Partiel')
                      : (lang==='ar' ? 'غير مبدوء' : 'Non commencé');
                return (
                  <div key={b.numero} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 9px', borderRadius:7, background:bg, border:`0.5px solid ${color}30`}}>
                    <div style={{width:22, height:22, borderRadius:5, background:color, color:'#fff', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                      {b.estComplet ? '✓' : b.numero}
                    </div>
                    <div style={{flex:1, fontSize:11}}>
                      <div style={{fontWeight:600, color:'#1a1a1a'}}>{b.nom || `${lang==='ar'?'البلوك':'Bloc'} ${b.numero}`}</div>
                      <div style={{color:'#666', fontSize:10}}>{b.nbAcquis}/{b.total} · {statut}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {hizb > 0 && <div>
        <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:500}}>{lang==='ar'?'الثُّمن (1-8)':lang==='en'?'Tomon (1-8)':'Tomon (1-8)'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4}}>
          {[1,2,3,4,5,6,7,8].map(n=>(
            <div key={n} onClick={()=>onTomonChange(n)} style={{height:36,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:n===tomon?700:400,cursor:'pointer',background:n===tomon?'#1D9E75':n<tomon?'#E1F5EE':'#f0f0ec',color:n===tomon?'#fff':n<tomon?'#085041':'#999',border:`0.5px solid ${n===tomon?'#1D9E75':'#e0e0d8'}`,transition:'all 0.1s'}}>
              {n}
            </div>
          ))}
        </div>
        <div style={{textAlign:'center',marginTop:6,fontSize:12,color:'#888'}}>
          T.{tomon} du Hizb {hizb} · <span style={{color:'#1D9E75',fontWeight:600}}>{(hizb-1)*8+(tomon-1)} {lang==='ar'?'ثُمن':lang==='en'?'Tomon':'Tomon'} acquis</span>
        </div>
      </div>}

      {(hizb > 1 || tomon > 1) && (()=>{
        const ta=(hizb-1)*8+(tomon-1); const hc=hizb-1;
        const pts=calcPoints(ta,hc,[],ta,hc);
        return(
          <div style={{marginTop:10,background:'#E1F5EE',borderRadius:10,padding:'12px',textAlign:'center',border:'0.5px solid #9FE1CB'}}>
            <div style={{fontSize:11,color:'#0F6E56',marginBottom:4,fontWeight:600}}>
              🎓 {lang==='ar'?'النقاط المقابلة للمكتسبات السابقة':lang==='en'?'Points for prior achievements':'Points correspondants aux acquis'}
            </div>
            <div style={{fontSize:24,fontWeight:800,color:'#085041'}}>{pts.total.toLocaleString()} {lang==='ar'?'ن':'pts'}</div>
            <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:6,flexWrap:'wrap'}}>
              {[{l:'T',v:pts.ptsTomon},{l:'R',v:pts.ptsRoboe},{l:'N',v:pts.ptsNisf},{l:'H',v:pts.ptsHizb}].map(k=>(
                <div key={k.l} style={{background:'#fff',borderRadius:6,padding:'4px 8px',textAlign:'center',minWidth:45}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>{k.v}</div>
                  <div style={{fontSize:9,color:'#888'}}>{k.l}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}




// ══════════════════════════════════════════════════════
// COMPOSANT BaremeTab — Paramétrage centralisé des points
// ══════════════════════════════════════════════════════
function BaremeTab({ user, lang, bareme, setBareme, saving, setSaving, showMsg }) {
  const [examens,    setExamens]    = useState([]);
  const [ensembles,  setEnsembles]  = useState([]);
  const [jalons,     setJalons]     = useState([]);
  // Critères en cours de construction
  const [criteres,   setCriteres]   = useState([]); // [{type, objet_id, label, points, icon, color}]
  const [critereType, setCritereType] = useState('');
  const [critereObjetId, setCritereObjetId] = useState('');
  const [criterePoints, setCriterePoints] = useState(0);
  // Configurations enregistrées (lignes)
  const [configs, setConfigs] = useState([]);

  const UNITES = [
    { key:'tomon',        icon:'📖', label_ar:'ثمن واحد مُستظهر',       color:'#378ADD' },
    { key:'hizb_complet', icon:'🎯', label_ar:'حزب كامل مُصحَّح',        color:'#085041' },
    { key:'sourate',      icon:'📜', label_ar:'سورة كاملة',              color:'#534AB7' },
    { key:'muraja_tomon', icon:'🔄', label_ar:'ثمن مراجعة',              color:'#1D9E75' },
    { key:'muraja_hizb',  icon:'🔁', label_ar:'حزب مراجعة كامل',         color:'#1D9E75' },
  ];

  useEffect(() => {
    supabase.from('examens').select('id,nom').eq('ecole_id', user.ecole_id).eq('actif', true).order('nom')
      .then(({data}) => setExamens(data||[]));
    supabase.from('ensembles_sourates').select('id,nom').eq('ecole_id', user.ecole_id).order('nom')
      .then(({data}) => setEnsembles(data||[]));
    supabase.from('jalons').select('id,nom,nom_ar,type_jalon').eq('ecole_id', user.ecole_id).eq('actif', true).order('created_at')
      .then(({data}) => setJalons(data||[]));
    // Charger configs existantes
    supabase.from('bareme_notes').select('*').eq('ecole_id', user.ecole_id).eq('actif', true).order('created_at')
      .then(({data}) => { if (data) setConfigs(data); });
  }, []);

  // Options du sélecteur selon type
  const getOptions = () => {
    if (critereType === 'examen') return examens.map(e => ({ id: e.id, label: e.nom }));
    if (critereType === 'ensemble_sourates') return ensembles.map(e => ({ id: e.id, label: e.nom }));
    if (critereType === 'jalon') return jalons.map(j => ({ id: j.id, label: j.nom_ar || j.nom }));
    return [];
  };

  const getCritereLabel = () => {
    const u = UNITES.find(u => u.key === critereType);
    if (u) return { label: u.label_ar, icon: u.icon, color: u.color, objet_id: null };
    if (critereType === 'examen') {
      const e = examens.find(x => x.id === critereObjetId);
      return { label: e?.nom || '', icon: '📝', color: '#EF9F27', objet_id: critereObjetId };
    }
    if (critereType === 'ensemble_sourates') {
      const e = ensembles.find(x => x.id === critereObjetId);
      return { label: e?.nom || '', icon: '📦', color: '#D85A30', objet_id: critereObjetId };
    }
    if (critereType === 'jalon') {
      const j = jalons.find(x => x.id === critereObjetId);
      return { label: j?.nom_ar || j?.nom || '', icon: '🏅', color: '#EF9F27', objet_id: critereObjetId };
    }
    return null;
  };

  const ajouterCritere = () => {
    if (!critereType) return;
    const isUnite = UNITES.find(u => u.key === critereType);
    if (!isUnite && !critereObjetId) return;
    if (criterePoints <= 0) return;
    const info = getCritereLabel();
    if (!info || !info.label) return;
    // Éviter doublon
    const exists = criteres.find(c => c.type === critereType && c.objet_id === info.objet_id);
    if (exists) { showMsg('error', lang==='ar'?'هذا المعيار موجود بالفعل':'Ce critère est déjà ajouté'); return; }
    setCriteres(prev => [...prev, { type: critereType, objet_id: info.objet_id, label: info.label, icon: info.icon, color: info.color, points: criterePoints }]);
    setCritereType(''); setCritereObjetId(''); setCriterePoints(0);
  };

  const retirerCritere = (idx) => setCriteres(prev => prev.filter((_,i) => i !== idx));

  const enregistrerConfig = async () => {
    if (criteres.length === 0) { showMsg('error', lang==='ar'?'أضف معياراً واحداً على الأقل':'Ajoutez au moins un critère'); return; }
    setSaving(true);
    // Upsert chaque critère
    for (const c of criteres) {
      await saveBaremeItem(supabase, user.ecole_id, c.type, c.points, c.objet_id);
    }
    // Recharger configs
    const { data } = await supabase.from('bareme_notes').select('*').eq('ecole_id', user.ecole_id).eq('actif', true).order('created_at');
    if (data) setConfigs(data);
    // Recharger bareme global
    const newB = await loadBareme(supabase, user.ecole_id);
    setBareme(newB);
    setCriteres([]);
    setSaving(false);
    showMsg('success', lang==='ar'?'تم حفظ التنقيط بنجاح':'Configuration enregistrée');
  };

  const supprimerConfig = async (id) => {
    await supabase.from('bareme_notes').delete().eq('id', id);
    setConfigs(prev => prev.filter(c => c.id !== id));
    const newB = await loadBareme(supabase, user.ecole_id);
    setBareme(newB);
  };

  const getConfigLabel = (c) => {
    if (!c.objet_id) return UNITES.find(u => u.key === c.type)?.label_ar || c.type;
    if (c.type === 'examen') return examens.find(e => e.id === c.objet_id)?.nom || '—';
    if (c.type === 'ensemble_sourates') return ensembles.find(e => e.id === c.objet_id)?.nom || '—';
    if (c.type === 'jalon') { const j = jalons.find(x => x.id === c.objet_id); return j?.nom_ar || j?.nom || '—'; }
    return c.type;
  };

  const getConfigIcon = (c) => {
    if (!c.objet_id) return UNITES.find(u => u.key === c.type)?.icon || '⭐';
    if (c.type === 'examen') return '📝';
    if (c.type === 'ensemble_sourates') return '📦';
    if (c.type === 'jalon') return '🏅';
    return '⭐';
  };

  const needsObjet = critereType && !UNITES.find(u => u.key === critereType);

  return (
    <div>
      <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
        {lang==='ar'
          ? 'أضف معايير التنقيط واحفظها — تُطبَّق تلقائياً على جميع الطلاب'
          : 'Ajoutez des critères de notation et enregistrez — appliqués automatiquement à tous'}
      </div>

      {/* Formulaire ajout critère */}
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="section-label">{lang==='ar'?'إضافة معيار':'Ajouter un critère'}</div>

        {/* Ligne sélection */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end',marginBottom:12}}>

          {/* Sélecteur type */}
          <div style={{flex:2,minWidth:160}}>
            <label className="field-lbl">{lang==='ar'?'نوع المعيار':'Type de critère'}</label>
            <select className="field-select" value={critereType}
              onChange={e => { setCritereType(e.target.value); setCritereObjetId(''); }}>
              <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
              <optgroup label={lang==='ar'?'وحدات أساسية':'Unités de base'}>
                {UNITES.map(u => <option key={u.key} value={u.key}>{u.icon} {u.label_ar}</option>)}
              </optgroup>
              <optgroup label={lang==='ar'?'امتحانات':'Examens'}>
                <option value="examen">{lang==='ar'?'امتحان محدد...':'Examen spécifique...'}</option>
              </optgroup>
              <optgroup label={lang==='ar'?'مجموعات سور':'Ensembles'}>
                <option value="ensemble_sourates">{lang==='ar'?'مجموعة سور...':'Ensemble de sourates...'}</option>
              </optgroup>
              <optgroup label={lang==='ar'?'شهادات':'Jalons'}>
                <option value="jalon">{lang==='ar'?'شهادة محددة...':'Jalon spécifique...'}</option>
              </optgroup>
            </select>
          </div>

          {/* Sélecteur objet si nécessaire */}
          {needsObjet && (
            <div style={{flex:2,minWidth:160}}>
              <label className="field-lbl">{lang==='ar'?'اختر العنصر':"Choisir l'élément"}</label>
              <select className="field-select" value={critereObjetId} onChange={e => setCritereObjetId(e.target.value)}>
                <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
                {getOptions().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* Points avec +/- */}
          <div style={{minWidth:130}}>
            <label className="field-lbl">{lang==='ar'?'النقاط':'Points'}</label>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <button onClick={() => setCriterePoints(p => Math.max(0, p-1))}
                style={{width:32,height:38,borderRadius:6,border:'0.5px solid #e0e0d8',background:'#f9f9f6',cursor:'pointer',fontSize:18,fontWeight:700,color:'#888'}}>−</button>
              <input type="number" min="0" max="9999" value={criterePoints}
                onChange={e => setCriterePoints(parseInt(e.target.value)||0)}
                style={{width:68,padding:'8px',borderRadius:6,border:'1.5px solid #378ADD50',fontSize:16,fontWeight:700,textAlign:'center',color:'#378ADD'}} />
              <button onClick={() => setCriterePoints(p => p+1)}
                style={{width:32,height:38,borderRadius:6,border:'0.5px solid #e0e0d8',background:'#f9f9f6',cursor:'pointer',fontSize:18,fontWeight:700,color:'#888'}}>+</button>
            </div>
          </div>

          {/* Bouton ajouter critère */}
          <button onClick={ajouterCritere}
            style={{padding:'8px 16px',background:'#E6F1FB',color:'#378ADD',border:'1px solid #378ADD40',borderRadius:8,fontWeight:700,fontSize:13,cursor:'pointer',alignSelf:'flex-end',height:38}}>
            + {lang==='ar'?'أضف':'Ajouter'}
          </button>
        </div>

        {/* Liste critères en cours */}
        {criteres.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:'#888',marginBottom:6,fontWeight:600}}>
              {lang==='ar'?'المعايير المضافة:':'Critères ajoutés :'}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {criteres.map((c,i) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f9f9f6',borderRadius:8,border:'0.5px solid #e0e0d8'}}>
                  <span style={{fontSize:16}}>{c.icon}</span>
                  <span style={{flex:1,fontSize:13,fontWeight:600,direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{c.label}</span>
                  <span style={{fontWeight:800,fontSize:15,color:c.color}}>{c.points}</span>
                  <span style={{fontSize:10,color:'#aaa'}}>{lang==='ar'?'ن':'pts'}</span>
                  <button onClick={() => retirerCritere(i)}
                    style={{padding:'2px 8px',background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:6,cursor:'pointer',fontSize:12}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{marginTop:8,fontSize:12,color:'#085041',fontWeight:600}}>
              {lang==='ar'?'المجموع:':'Total :'} {criteres.reduce((s,c)=>s+c.points,0)} {lang==='ar'?'نقطة':'pts'}
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={enregistrerConfig} disabled={saving||criteres.length===0}>
          {saving ? '...' : (lang==='ar'?'حفظ هذه التنقيطات':'Enregistrer ces notations')}
        </button>
      </div>

      {/* Liste des configurations enregistrées */}
      <div className="section-label">{lang==='ar'?'التنقيطات المُسجَّلة':'Notations enregistrées'} ({configs.length})</div>
      {configs.length === 0 ? (
        <div className="empty">{lang==='ar'?'لا توجد تنقيطات بعد — أضف معايير وسجّلها أعلاه':'Aucune notation enregistrée'}</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {configs.map(c => (
            <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10}}>
              <span style={{fontSize:18}}>{getConfigIcon(c)}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{getConfigLabel(c)}</div>
                <div style={{fontSize:11,color:'#888',marginTop:1}}>
                  {c.type} {c.objet_id ? '· '+c.objet_id.slice(0,8)+'...' : ''}
                </div>
              </div>
              <span style={{fontWeight:800,fontSize:16,color:'#378ADD'}}>{c.points}</span>
              <span style={{fontSize:10,color:'#aaa'}}>{lang==='ar'?'ن':'pts'}</span>
              <button onClick={() => supprimerConfig(c.id)}
                style={{padding:'4px 8px',background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',borderRadius:6,cursor:'pointer',fontSize:11}}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// COMPOSANT PeriodesTab — Gestion des périodes de notes
// ══════════════════════════════════════════════════════
function PeriodesTab({ user, lang, periodes, setPeriodes, newPeriode, setNewPeriode, savingPeriode, setSavingPeriode, showMsg }) {

  const ajouterPeriode = async () => {
    if (!newPeriode.nom_ar.trim()) return showMsg('error', lang==='ar'?'اسم الفترة مطلوب':'Nom de la période requis');
    if (!newPeriode.date_debut) return showMsg('error', lang==='ar'?'تاريخ البداية مطلوب':'Date de début requise');
    if (!newPeriode.date_fin) return showMsg('error', lang==='ar'?'تاريخ النهاية مطلوب':'Date de fin requise');
    if (new Date(newPeriode.date_debut) >= new Date(newPeriode.date_fin)) return showMsg('error', lang==='ar'?'تاريخ البداية يجب أن يكون قبل النهاية':'La date de début doit être avant la fin');
    setSavingPeriode(true);
    await supabase.from('periodes_notes').insert({
      ecole_id: user.ecole_id,
      nom: newPeriode.nom_ar.trim(),
      nom_ar: newPeriode.nom_ar.trim(),
      date_debut: newPeriode.date_debut,
      date_fin: newPeriode.date_fin,
      actif: true,
    });
    const { data } = await supabase.from('periodes_notes').select('*').eq('ecole_id', user.ecole_id).order('date_debut');
    if (data) setPeriodes(data);
    setNewPeriode({ nom_ar: '', date_debut: '', date_fin: '' });
    setSavingPeriode(false);
    showMsg('success', lang==='ar'?'تمت إضافة الفترة':'Période ajoutée');
  };

  const supprimerPeriode = async (id) => {
    await supabase.from('periodes_notes').delete().eq('id', id);
    setPeriodes(prev => prev.filter(p => p.id !== id));
    showMsg('success', lang==='ar'?'تم حذف الفترة':'Période supprimée');
  };

  const toggleActif = async (p) => {
    await supabase.from('periodes_notes').update({ actif: !p.actif }).eq('id', p.id);
    setPeriodes(prev => prev.map(x => x.id === p.id ? {...x, actif: !x.actif} : x));
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR', {day:'2-digit', month:'short', year:'numeric'}) : '—';

  return (
    <div>
      <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
        {lang==='ar'?'حدد فترات التقييم (أسابيع، أشهر، فصول دراسية) لحساب النقاط والتصنيف':"Définissez les périodes d'évaluation pour le calcul des points et classements"}
      </div>

      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="section-label">{lang==='ar'?'إضافة فترة جديدة':'Ajouter une période'}</div>
        <div className="form-grid">
          <div className="field-group" style={{gridColumn:'1/-1'}}>
            <label className="field-lbl">{lang==='ar'?'اسم الفترة':'Nom de la période'} <span style={{color:'#E24B4A'}}>*</span></label>
            <input className="field-input" value={newPeriode.nom_ar}
              onChange={e=>setNewPeriode({...newPeriode, nom_ar: e.target.value})}
              placeholder={lang==='ar'?'مثال: الفصل الأول 2024-2025':'Ex: 1er trimestre 2024-2025'}
              style={{direction:'rtl', fontFamily:"'Tajawal',Arial,sans-serif"}} />
          </div>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'تاريخ البداية':'Date de début'} <span style={{color:'#E24B4A'}}>*</span></label>
            <input className="field-input" type="date" value={newPeriode.date_debut}
              onChange={e=>setNewPeriode({...newPeriode, date_debut: e.target.value})} />
          </div>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'تاريخ النهاية':'Date de fin'} <span style={{color:'#E24B4A'}}>*</span></label>
            <input className="field-input" type="date" value={newPeriode.date_fin}
              onChange={e=>setNewPeriode({...newPeriode, date_fin: e.target.value})} />
          </div>
        </div>
        <button className="btn-primary" onClick={ajouterPeriode} disabled={savingPeriode}>
          {savingPeriode ? '...' : (lang==='ar'?'إضافة الفترة':'Ajouter la période')}
        </button>
      </div>

      <div className="section-label">{lang==='ar'?'الفترات المُعرَّفة':'Périodes configurées'} ({periodes.length})</div>
      {periodes.length === 0 ? (
        <div className="empty">{lang==='ar'?'لا توجد فترات بعد — أضف أول فترة أعلاه':'Aucune période — ajoutez-en une ci-dessus'}</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {periodes.map(p => (
            <div key={p.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,opacity:p.actif?1:0.5}}>
              <div style={{width:44,height:44,borderRadius:12,background:p.actif?'#E6F1FB':'#f0f0ec',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>📊</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a',direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{p.nom_ar||p.nom}</div>
                <div style={{fontSize:11,color:'#378ADD',marginTop:2,fontWeight:600}}>
                  📅 {fmt(p.date_debut)} → {fmt(p.date_fin)}
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>toggleActif(p)}
                  style={{padding:'4px 8px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',
                    background:p.actif?'#E1F5EE':'#f0f0ec',color:p.actif?'#085041':'#888',
                    border:`0.5px solid ${p.actif?'#1D9E7530':'#e0e0d8'}`}}>
                  {p.actif ? (lang==='ar'?'نشطة':'Active') : (lang==='ar'?'غير نشطة':'Inactive')}
                </button>
                <button onClick={()=>supprimerPeriode(p.id)}
                  style={{padding:'4px 8px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',cursor:'pointer',fontSize:11,fontWeight:600}}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// COMPOSANT SensRecitationTab — Sens de récitation (desc/asc)
// par école et par niveau
// ══════════════════════════════════════════════════════
function SensRecitationTab({ user, lang, ecoleConfig, setEcoleConfig, niveaux, setNiveaux, showMsg }) {
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

// ══════════════════════════════════════════════════════
// COMPOSANT PassageNiveauTab — Règles de passage de niveau
// ══════════════════════════════════════════════════════
function PassageNiveauTab({ user, lang, niveaux, showMsg }) {
  const [regles, setRegles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [newRegle, setNewRegle] = React.useState({
    niveau_from: '', niveau_to: '', type_depart: 'continuer',
    hizb_depart_fixe: 0, tomon_depart_fixe: 1, sourates_acquises_fixe: 0, note: ''
  });

  React.useEffect(() => { loadRegles(); }, []);

  const loadRegles = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('regles_passage_niveau')
        .select('*').eq('ecole_id', user.ecole_id).order('created_at');
      setRegles(data || []);
    } catch (e) {
      console.error('[Gestion] Erreur loadRegles:', e);
    } finally {
      setLoading(false);
    }
  };

  const ajouterRegle = async () => {
    if (!newRegle.niveau_from || !newRegle.niveau_to)
      return showMsg('error', lang==='ar'?'اختر المستوى المصدر والهدف':'Choisissez les niveaux source et cible');
    if (newRegle.niveau_from === newRegle.niveau_to)
      return showMsg('error', lang==='ar'?'لا يمكن أن يكون المستويان متطابقين':'Les niveaux ne peuvent pas être identiques');
    setSaving(true);
    const payload = {
      ecole_id: user.ecole_id,
      niveau_from: newRegle.niveau_from,
      niveau_to: newRegle.niveau_to,
      type_depart: newRegle.type_depart,
      hizb_depart_fixe: parseInt(newRegle.hizb_depart_fixe)||0,
      tomon_depart_fixe: parseInt(newRegle.tomon_depart_fixe)||1,
      sourates_acquises_fixe: parseInt(newRegle.sourates_acquises_fixe)||0,
      note: newRegle.note||null,
      actif: true,
    };
    await supabase.from('regles_passage_niveau').insert(payload);
    await loadRegles();
    setNewRegle({ niveau_from:'', niveau_to:'', type_depart:'continuer', hizb_depart_fixe:0, tomon_depart_fixe:1, sourates_acquises_fixe:0, note:'' });
    setSaving(false);
    showMsg('success', lang==='ar'?'تمت إضافة قاعدة الانتقال':'Règle de passage ajoutée');
  };

  const supprimerRegle = async (id) => {
    await supabase.from('regles_passage_niveau').delete().eq('id', id);
    setRegles(prev => prev.filter(r => r.id !== id));
  };

  const toggleActif = async (regle) => {
    await supabase.from('regles_passage_niveau').update({ actif: !regle.actif }).eq('id', regle.id);
    setRegles(prev => prev.map(r => r.id===regle.id ? {...r, actif: !r.actif} : r));
  };

  const getNiveauNom = (code) => niveaux.find(n=>n.code===code)?.nom || code;
  const getNiveauColor = (code) => niveaux.find(n=>n.code===code)?.couleur || '#888';

  const typeDepartLabel = (type) => ({
    'continuer': lang==='ar'?'يستمر من موقعه الحالي':'Continue depuis sa position actuelle',
    'debut': lang==='ar'?'يبدأ من بداية البرنامج':'Repart du début du programme',
    'personnalise': lang==='ar'?'موقع مخصص':'Position personnalisée',
  })[type] || type;

  const typeDepartColor = (type) => ({'continuer':'#1D9E75','debut':'#EF9F27','personnalise':'#534AB7'})[type]||'#888';

  return (
    <div>
      <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
        {lang==='ar'?'حدد قواعد انتقال الطلاب من مستوى إلى آخر وموقع انطلاقهم في البرنامج الجديد':'Définissez les règles de passage entre niveaux et la position de départ dans le nouveau programme'}
      </div>

      {/* Info box */}
      <div style={{background:'#E1F5EE',borderRadius:10,padding:'12px 14px',marginBottom:'1.5rem',fontSize:12,color:'#085041',border:'0.5px solid #1D9E7530'}}>
        <div style={{fontWeight:700,marginBottom:6}}>ℹ️ {lang==='ar'?'كيف يعمل هذا؟':'Comment ça fonctionne ?'}</div>
        <div style={{lineHeight:1.6}}>
          {lang==='ar'
            ?'عند تغيير مستوى طالب، يبحث النظام عن قاعدة مطابقة. إذا وُجدت، يطبق موقع الانطلاق المحدد. إذا لم توجد قاعدة، يستمر الطالب من موقعه الحالي تلقائياً.'
            :"Lors du changement de niveau d'un élève, le système cherche une règle correspondante. Si trouvée, applique le départ configuré. Sinon, l'élève continue depuis sa position actuelle."}
        </div>
      </div>

      {/* Formulaire */}
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="section-label">{lang==='ar'?'إضافة قاعدة انتقال':'Ajouter une règle de passage'}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 20px',marginBottom:14}}>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'المستوى المصدر (من)':'Niveau source (de)'} <span style={{color:'#E24B4A'}}>*</span></label>
            <select className="field-select" value={newRegle.niveau_from} onChange={e=>setNewRegle({...newRegle,niveau_from:e.target.value})}>
              <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
              {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'المستوى الهدف (إلى)':'Niveau cible (vers)'} <span style={{color:'#E24B4A'}}>*</span></label>
            <select className="field-select" value={newRegle.niveau_to} onChange={e=>setNewRegle({...newRegle,niveau_to:e.target.value})}>
              <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
              {niveaux.filter(n=>n.code!==newRegle.niveau_from).map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
            </select>
          </div>
        </div>

        {/* Type de départ */}
        <div className="field-group" style={{marginBottom:14}}>
          <label className="field-lbl">{lang==='ar'?'موقع الانطلاق في البرنامج الجديد':'Position de départ dans le nouveau programme'} <span style={{color:'#E24B4A'}}>*</span></label>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:4}}>
            {[
              {val:'continuer', icon:'▶️', label:lang==='ar'?'يستمر من موقعه':'Continue', desc:lang==='ar'?'يبدأ من الحزب/السورة التي وصل إليها':'Repart du Hizb/Sourate où il en était'},
              {val:'debut', icon:'🔄', label:lang==='ar'?'من البداية':'Début', desc:lang==='ar'?'يبدأ من أول الثُّمن أو أول سورة في البرنامج':'Repart du premier Tomon/Sourate du programme'},
              {val:'personnalise', icon:'🎯', label:lang==='ar'?'موقع محدد':'Personnalisé', desc:lang==='ar'?'تحديد موقع البداية يدوياً':'Définir manuellement la position de départ'},
            ].map(opt=>(
              <div key={opt.val} onClick={()=>setNewRegle({...newRegle,type_depart:opt.val})}
                style={{padding:'10px',borderRadius:10,cursor:'pointer',textAlign:'center',
                  border:`2px solid ${newRegle.type_depart===opt.val?typeDepartColor(opt.val):'#e0e0d8'}`,
                  background:newRegle.type_depart===opt.val?typeDepartColor(opt.val)+'15':'#fff'}}>
                <div style={{fontSize:20,marginBottom:4}}>{opt.icon}</div>
                <div style={{fontWeight:700,fontSize:12,color:newRegle.type_depart===opt.val?typeDepartColor(opt.val):'#333'}}>{opt.label}</div>
                <div style={{fontSize:10,color:'#888',marginTop:2}}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Position personnalisée */}
        {newRegle.type_depart==='personnalise' && (() => {
          const cibleType = niveaux.find(n=>n.code===newRegle.niveau_to)?.type;
          return cibleType==='sourate' ? (
            <div className="field-group" style={{marginBottom:14}}>
              <label className="field-lbl">{lang==='ar'?'عدد السور المحفوظة كمكتسبات':'Nb sourates acquises au départ'}</label>
              <input className="field-input" type="number" min="0" value={newRegle.sourates_acquises_fixe}
                onChange={e=>setNewRegle({...newRegle,sourates_acquises_fixe:e.target.value})}/>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 20px',marginBottom:14}}>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'حزب الانطلاق':'Hizb de départ'}</label>
                <input className="field-input" type="number" min="0" max="60" value={newRegle.hizb_depart_fixe}
                  onChange={e=>setNewRegle({...newRegle,hizb_depart_fixe:e.target.value})}/>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'الثُّمن':'Tomon'}</label>
                <select className="field-select" value={newRegle.tomon_depart_fixe} onChange={e=>setNewRegle({...newRegle,tomon_depart_fixe:e.target.value})}>
                  {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>T.{n}</option>)}
                </select>
              </div>
            </div>
          );
        })()}

        <div className="field-group" style={{marginBottom:14}}>
          <label className="field-lbl">{lang==='ar'?'ملاحظة (اختياري)':'Note (optionnelle)'}</label>
          <input className="field-input" value={newRegle.note} onChange={e=>setNewRegle({...newRegle,note:e.target.value})}
            placeholder={lang==='ar'?'مثال: انتقال من الابتدائي إلى الإعدادي':'Ex: Passage du primaire au collège'}/>
        </div>
        <button className="btn-primary" onClick={ajouterRegle} disabled={saving}>
          {saving?'...':(lang==='ar'?'إضافة القاعدة':'Ajouter la règle')}
        </button>
      </div>

      {/* Liste des règles */}
      <div className="section-label">{lang==='ar'?'القواعد المُعرَّفة':'Règles configurées'} ({regles.length})</div>
      {loading ? <div className="loading">...</div> : regles.length===0 ? (
        <div className="empty">{lang==='ar'?'لا توجد قواعد — الانتقال الافتراضي: الطالب يستمر من موقعه':"Aucune règle — comportement par défaut : l'élève continue depuis sa position"}</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {regles.map(r => {
            const fromColor = getNiveauColor(r.niveau_from);
            const toColor = getNiveauColor(r.niveau_to);
            const dColor = typeDepartColor(r.type_depart);
            return (
              <div key={r.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',opacity:r.actif?1:0.5}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <span style={{padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:700,background:fromColor+'20',color:fromColor}}>{r.niveau_from}</span>
                  <span style={{fontSize:16,color:'#888'}}>→</span>
                  <span style={{padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:700,background:toColor+'20',color:toColor}}>{r.niveau_to}</span>
                  <span style={{flex:1}}/>
                  <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:dColor+'15',color:dColor}}>
                    {r.type_depart==='continuer'?'▶️':r.type_depart==='debut'?'🔄':'🎯'} {typeDepartLabel(r.type_depart)}
                  </span>
                </div>
                {r.type_depart==='personnalise'&&(
                  <div style={{fontSize:11,color:'#888',marginBottom:6}}>
                    {niveaux.find(n=>n.code===r.niveau_to)?.type==='sourate'
                      ? `📖 ${lang==='ar'?'السور المحفوظة:':'Sourates acquises:'} ${r.sourates_acquises_fixe}`
                      : `📍 Hizb ${r.hizb_depart_fixe} · T.${r.tomon_depart_fixe}`
                    }
                  </div>
                )}
                {r.note&&<div style={{fontSize:11,color:'#aaa',fontStyle:'italic',marginBottom:6}}>{r.note}</div>}
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>toggleActif(r)}
                    style={{padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:600,cursor:'pointer',
                      background:r.actif?'#E1F5EE':'#f0f0ec',color:r.actif?'#085041':'#888',border:'none'}}>
                    {r.actif?(lang==='ar'?'نشط':'Actif'):(lang==='ar'?'غير نشط':'Inactif')}
                  </button>
                  <button onClick={()=>supprimerRegle(r.id)}
                    style={{padding:'3px 8px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'none',cursor:'pointer',fontSize:10,fontWeight:600}}>
                    🗑 {lang==='ar'?'حذف':'Supprimer'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// COMPOSANT JalonsTab — Gestion des jalons/certificats
// ══════════════════════════════════════════════════════
function JalonsTab({ user, lang, jalons, setJalons, ensembles, examens, newJalon, setNewJalon, savingJalon, setSavingJalon, showMsg }) {

  const ajouterJalon = async () => {
    if (!newJalon.nom_ar.trim()) return showMsg('error', lang==='ar'?'اسم الشهادة مطلوب':'Le nom du certificat est obligatoire');
    if (newJalon.type_jalon === 'hizb' && (!newJalon.hizb_ids || newJalon.hizb_ids.length === 0)) return showMsg('error', lang==='ar'?'اختر الأحزاب المطلوبة':'Sélectionnez au moins un Hizb');
    if (newJalon.type_jalon === 'ensemble_sourates' && !newJalon.ensemble_id) return showMsg('error', lang==='ar'?'اختر مجموعة السور':'Choisissez un ensemble de sourates');
    if (newJalon.type_jalon === 'examen' && !newJalon.examen_id) return showMsg('error', lang==='ar'?'اختر الامتحان':'Choisissez un examen');
    setSavingJalon(true);
    const payload = {
      ecole_id: user.ecole_id,
      nom: newJalon.nom_ar.trim(),
      nom_ar: newJalon.nom_ar.trim(),
      type_jalon: newJalon.type_jalon,
      hizb_ids: newJalon.type_jalon === 'hizb' ? newJalon.hizb_ids : null,
      ensemble_id: newJalon.type_jalon === 'ensemble_sourates' ? newJalon.ensemble_id : null,
      examen_id: newJalon.type_jalon === 'examen' ? newJalon.examen_id : null,
      condition_obtention: newJalon.condition_obtention || 'cumul',
      examen_final_id: newJalon.condition_obtention === 'cumul_puis_examen' ? (newJalon.examen_final_id||null) : null,
      description_condition: newJalon.description_condition || null,
      actif: true,
    };
    await supabase.from('jalons').insert(payload);
    const { data } = await supabase.from('jalons').select('*').eq('ecole_id', user.ecole_id).order('created_at');
    if (data) setJalons(data);
    setNewJalon({ nom_ar: '', type_jalon: 'hizb', hizb_ids: [], ensemble_id: '', examen_id: '', condition_obtention: 'cumul', examen_final_id: '', description_condition: '' });
    setSavingJalon(false);
    showMsg('success', lang==='ar'?'تمت إضافة المرحلة بنجاح':'Jalon ajouté avec succès');
  };

  const supprimerJalon = async (id) => {
    await supabase.from('jalons').delete().eq('id', id);
    setJalons(prev => prev.filter(j => j.id !== id));
    showMsg('success', lang==='ar'?'تم حذف المرحلة':'Jalon supprimé');
  };

  const toggleActif = async (jalon) => {
    await supabase.from('jalons').update({ actif: !jalon.actif }).eq('id', jalon.id);
    setJalons(prev => prev.map(j => j.id === jalon.id ? {...j, actif: !j.actif} : j));
  };

  const getEnsembleNom = (id) => ensembles.find(e => e.id === id)?.nom || '—';
  const getExamenNom = (id) => (examens||[]).find(e => e.id === id)?.nom || '—';
  const typeLabel = (j) => {
    if (j.type_jalon === 'hizb') {
      const ids = j.hizb_ids || [];
      const label = ids.length > 0 ? ids.sort((a,b)=>a-b).join(', ') : '—';
      return lang==='ar' ? `أحزاب محددة: ${label}` : `Hizb spécifiques: ${label}`;
    }
    if (j.type_jalon === 'ensemble_sourates') return lang==='ar' ? `مجموعة: ${getEnsembleNom(j.ensemble_id)}` : `Ensemble: ${getEnsembleNom(j.ensemble_id)}`;
    if (j.type_jalon === 'examen') return lang==='ar' ? `امتحان ناجح: ${getExamenNom(j.examen_id)}` : `Examen réussi: ${getExamenNom(j.examen_id)}`;
    return j.type_jalon;
  };
  const toggleHizb = (n) => {
    const ids = newJalon.hizb_ids || [];
    const updated = ids.includes(n) ? ids.filter(h=>h!==n) : [...ids, n];
    setNewJalon({...newJalon, hizb_ids: updated});
  };

  return (
    <div>
      <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
        {lang==='ar'?'تكوين المراحل التي تُمنح عندها شهادة للطالب تلقائياً':'Configurez les jalons qui déclenchent automatiquement un certificat'}
      </div>

      {/* Formulaire ajout jalon */}
      <div className="card" style={{marginBottom:'1.5rem'}}>
        <div className="section-label">{lang==='ar'?'إضافة مرحلة جديدة':'Ajouter un jalon'}</div>
        <div className="form-grid">
          <div className="field-group" style={{gridColumn:'1/-1'}}>
            <label className="field-lbl">
              {lang==='ar'?'اسم الشهادة':'Nom du certificat'} <span style={{color:'#E24B4A'}}>*</span>
            </label>
            <input className="field-input" value={newJalon.nom_ar} onChange={e=>setNewJalon({...newJalon,nom_ar:e.target.value})}
              placeholder={lang==='ar'?'مثال: شهادة إتمام الأحزاب المقررة':'Ex: شهادة إتمام الأحزاب المقررة'}
              style={{direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif",fontSize:14}} />
          </div>
          <div className="field-group">
            <label className="field-lbl">{lang==='ar'?'نوع المرحلة':'Type de jalon'} <span style={{color:'#E24B4A'}}>*</span></label>
            <select className="field-select" value={newJalon.type_jalon} onChange={e=>setNewJalon({...newJalon,type_jalon:e.target.value,hizb_ids:[],ensemble_id:'',examen_id:''})}>
              <option value="hizb">{lang==='ar'?'أحزاب محددة':'Hizb spécifiques'}</option>
              <option value="ensemble_sourates">{lang==='ar'?'مجموعة سور مكتملة':'Ensemble de sourates terminé'}</option>
              <option value="examen">{lang==='ar'?'اجتياز امتحان':'Examen réussi'}</option>
            </select>
          </div>
          {/* Condition d'obtention */}
          <div className="field-group" style={{gridColumn:'1/-1'}}>
            <label className="field-lbl">{lang==='ar'?'شرط الحصول على الشهادة':"Condition d'obtention"} <span style={{color:'#E24B4A'}}>*</span></label>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              {[
                {val:'cumul', icon:'📚', label:lang==='ar'?'تراكمي فقط':'Cumulatif seul', desc:lang==='ar'?'يستظهر الطالب حزباً بحزب أو سورة بسورة تلقائياً — الشهادة تُمنح عند اكتمال العدد المطلوب':"L'élève valide progressivement — le certificat est décerné automatiquement au seuil"},
                {val:'cumul_puis_examen', icon:'🎯', label:lang==='ar'?'تراكمي + امتحان ختامي':'Cumulatif + examen final', desc:lang==='ar'?'يستظهر تدريجياً أولاً، ثم يجب اجتياز امتحان رسمي بتلاوة كاملة أمام لجنة للحصول على الشهادة':"Valide progressivement d'abord, puis doit réussir un examen formel en une seule récitation devant jury"},
              ].map(opt=>(
                <div key={opt.val} onClick={()=>setNewJalon({...newJalon,condition_obtention:opt.val})}
                  style={{flex:1,padding:'10px 12px',borderRadius:10,cursor:'pointer',
                    border:`2px solid ${newJalon.condition_obtention===opt.val?'#534AB7':'#e0e0d8'}`,
                    background:newJalon.condition_obtention===opt.val?'#EEEDFE':'#fff'}}>
                  <div style={{fontSize:16,marginBottom:4}}>{opt.icon}</div>
                  <div style={{fontWeight:700,fontSize:12,color:newJalon.condition_obtention===opt.val?'#534AB7':'#333'}}>{opt.label}</div>
                  <div style={{fontSize:10,color:'#888',marginTop:3}}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Si cumul_puis_examen : sélectionner l'examen final */}
          {newJalon.condition_obtention === 'cumul_puis_examen' && (
            <div className="field-group" style={{gridColumn:'1/-1'}}>
              <label className="field-lbl">
                {lang==='ar'?'الامتحان الختامي المطلوب':'Examen final requis'} <span style={{color:'#E24B4A'}}>*</span>
              </label>
              <select className="field-select" value={newJalon.examen_final_id||''} onChange={e=>setNewJalon({...newJalon,examen_final_id:e.target.value})}>
                <option value="">{lang==='ar'?'— اختر الامتحان —':"— Choisir l'examen —"}</option>
                {(examens||[]).map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
              <div style={{fontSize:11,color:'#888',marginTop:4}}>
                {lang==='ar'?'سيُمنح الشهادة فقط عند اجتياز هذا الامتحان بعد اكتمال الاستظهار التراكمي':'Le certificat sera décerné seulement après réussite de cet examen, une fois le cumul complété'}
              </div>
            </div>
          )}

          {newJalon.type_jalon === 'hizb' && (
            <div className="field-group" style={{gridColumn:'1/-1'}}>
              <label className="field-lbl">
                {lang==='ar'?'اختر الأحزاب المطلوبة':'Sélectionnez les Hizb requis'} <span style={{color:'#E24B4A'}}>*</span>
                {newJalon.hizb_ids.length > 0 && (
                  <span style={{marginRight:8,marginLeft:8,color:'#1D9E75',fontWeight:700}}>
                    ({newJalon.hizb_ids.length} {lang==='ar'?'محدد':'sélectionné(s)'})
                  </span>
                )}
              </label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3,marginTop:6}}>
                {(() => {
                  const sensEcole = ecoleConfig?.sens_recitation_defaut || 'desc';
                  const hizbList = sensEcole === 'asc'
                    ? Array.from({length:60},(_,i)=>i+1)
                    : Array.from({length:60},(_,i)=>60-i);
                  return hizbList.map(n=>{
                  const sel = (newJalon.hizb_ids||[]).includes(n);
                  return (
                    <div key={n} onClick={()=>toggleHizb(n)}
                      style={{borderRadius:6,padding:'5px 2px',textAlign:'center',cursor:'pointer',fontSize:11,fontWeight:700,
                        background: sel ? '#085041' : '#f0f0ec',
                        color: sel ? '#fff' : '#888',
                        border: `0.5px solid ${sel ? '#085041' : '#e0e0d8'}`,
                        transition:'all 0.1s'}}>
                      {n}
                    </div>
                  );
                });
                })()}
              </div>
              {newJalon.hizb_ids.length > 0 && (
                <div style={{marginTop:6,fontSize:11,color:'#085041',fontWeight:600}}>
                  {lang==='ar'?'الأحزاب المختارة:':'Hizb sélectionnés:'} {[...newJalon.hizb_ids].sort((a,b)=>a-b).join(', ')}
                </div>
              )}
            </div>
          )}
          {newJalon.type_jalon === 'ensemble_sourates' && (
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'مجموعة السور':'Ensemble de sourates'} <span style={{color:'#E24B4A'}}>*</span></label>
              <select className="field-select" value={newJalon.ensemble_id} onChange={e=>setNewJalon({...newJalon,ensemble_id:e.target.value})}>
                <option value="">{lang==='ar'?'اختر مجموعة':'Choisir un ensemble'}</option>
                {ensembles.map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
          )}
          {newJalon.type_jalon === 'examen' && (
            <div className="field-group">
              <label className="field-lbl">{lang==='ar'?'الامتحان':'Examen'} <span style={{color:'#E24B4A'}}>*</span></label>
              <select className="field-select" value={newJalon.examen_id} onChange={e=>setNewJalon({...newJalon,examen_id:e.target.value})}>
                <option value="">{lang==='ar'?'اختر امتحاناً':'Choisir un examen'}</option>
                {(examens||[]).map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={ajouterJalon} disabled={savingJalon}>
          {savingJalon ? '...' : (lang==='ar'?'إضافة المرحلة':'Ajouter le jalon')}
        </button>
      </div>

      {/* Liste des jalons */}
      <div className="section-label">{lang==='ar'?'المراحل المُعرَّفة':'Jalons configurés'} ({jalons.length})</div>
      {jalons.length === 0 ? (
        <div className="empty">{lang==='ar'?'لا توجد مراحل بعد — أضف أول مرحلة أعلاه':'Aucun jalon — ajoutez-en un ci-dessus'}</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {jalons.map(j => (
            <div key={j.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,opacity:j.actif?1:0.5}}>
              <div style={{width:44,height:44,borderRadius:12,background:j.actif?'#FAEEDA':'#f0f0ec',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
                {j.type_jalon==='examen'?'📝':'🏅'}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a',direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{j.nom_ar||j.nom}</div>
                <div style={{fontSize:11,color:'#EF9F27',marginTop:2,fontWeight:600}}>{typeLabel(j)}</div>
                {j.condition_obtention==='cumul_puis_examen'&&j.examen_final_id&&(
                  <div style={{fontSize:10,color:'#534AB7',marginTop:2}}>
                    🎯 {lang==='ar'?'الامتحان الختامي:':'Examen final:'} {(examens||[]).find(e=>e.id===j.examen_final_id)?.nom||'—'}
                  </div>
                )}
                <div style={{fontSize:10,marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                  <span style={{padding:'1px 6px',borderRadius:10,fontSize:9,fontWeight:600,
                    background:j.condition_obtention==='seance_unique'?'#EEEDFE':'#E1F5EE',
                    color:j.condition_obtention==='seance_unique'?'#534AB7':'#085041'}}>
                    {j.condition_obtention==='cumul_puis_examen'?(lang==='ar'?'🎯 تراكمي + امتحان':'🎯 Cumul + examen'):(lang==='ar'?'📚 تراكمي فقط':'📚 Cumulatif seul')}
                  </span>
                </div>
                <div style={{fontSize:10,color:'#bbb',marginTop:2}}>
                  {lang==='ar'?'تاريخ الإنشاء:':'Créé le:'} {j.created_at ? new Date(j.created_at).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>toggleActif(j)}
                  style={{padding:'4px 8px',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',
                    background:j.actif?'#E1F5EE':'#f0f0ec',color:j.actif?'#085041':'#888',
                    border:`0.5px solid ${j.actif?'#1D9E7530':'#e0e0d8'}`}}>
                  {j.actif ? (lang==='ar'?'نشط':'Actif') : (lang==='ar'?'غير نشط':'Inactif')}
                </button>
                <button onClick={()=>supprimerJalon(j.id)}
                  style={{padding:'4px 8px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',cursor:'pointer',fontSize:11,fontWeight:600}}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Passage niveau mobile (composant léger) ──
function MobilePassageNiveauTab({ user, lang, niveaux, showMsg }) {
  const [regles, setRegles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newR, setNewR] = React.useState({niveau_from:'',niveau_to:'',type_depart:'continuer',hizb_depart_fixe:0,tomon_depart_fixe:1,sourates_acquises_fixe:0,note:''});

  React.useEffect(()=>{ loadRegles(); },[]);
  const loadRegles = async()=>{
    setLoading(true);
    const {data}=await supabase.from('regles_passage_niveau').select('*').eq('ecole_id',user.ecole_id).order('created_at');
    setRegles(data||[]); setLoading(false);
  };
  const getNC=(code)=>niveaux.find(n=>n.code===code)?.couleur||{'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[code]||'#888';
  const typLabel=(t)=>({'continuer':lang==='ar'?'▶️ يستمر من موقعه':'▶️ Continue','debut':lang==='ar'?'🔄 من البداية':'🔄 Début','personnalise':lang==='ar'?'🎯 موقع محدد':'🎯 Personnalisé'})[t]||t;
  const typColor=(t)=>({'continuer':'#1D9E75','debut':'#EF9F27','personnalise':'#534AB7'})[t]||'#888';

  return (
    <div>
      {user.role==='surveillant'&&(
        <button onClick={()=>setShowForm(v=>!v)}
          style={{width:'100%',padding:'13px',background:showForm?'#f5f5f0':'#1D9E75',color:showForm?'#666':'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:12}}>
          {showForm?'✕ '+(lang==='ar'?'إلغاء':'Annuler'):'+ '+(lang==='ar'?'إضافة قاعدة':'Ajouter une règle')}
        </button>
      )}
      {showForm&&user.role==='surveillant'&&(
        <div style={{background:'#fff',borderRadius:14,padding:'16px',marginBottom:14,border:'1.5px solid #1D9E75'}}>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>{lang==='ar'?'من مستوى':'De niveau'} *</label>
            <select style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
              value={newR.niveau_from} onChange={e=>setNewR({...newR,niveau_from:e.target.value})}>
              <option value="">—</option>
              {niveaux.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:6}}>{lang==='ar'?'إلى مستوى':'Vers niveau'} *</label>
            <select style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
              value={newR.niveau_to} onChange={e=>setNewR({...newR,niveau_to:e.target.value})}>
              <option value="">—</option>
              {niveaux.filter(n=>n.code!==newR.niveau_from).map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
            </select>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'موقع الانطلاق':'Départ'} *</label>
            <div style={{display:'flex',gap:6}}>
              {[{v:'continuer',icon:'▶️',l:lang==='ar'?'يستمر':'Continue'},{v:'debut',icon:'🔄',l:lang==='ar'?'البداية':'Début'},{v:'personnalise',icon:'🎯',l:lang==='ar'?'محدد':'Perso.'}].map(opt=>(
                <div key={opt.v} onClick={()=>setNewR({...newR,type_depart:opt.v})}
                  style={{flex:1,padding:'10px 4px',borderRadius:10,textAlign:'center',cursor:'pointer',
                    border:`2px solid ${newR.type_depart===opt.v?typColor(opt.v):'#e0e0d8'}`,
                    background:newR.type_depart===opt.v?typColor(opt.v)+'15':'#fff'}}>
                  <div style={{fontSize:16}}>{opt.icon}</div>
                  <div style={{fontSize:10,fontWeight:600,color:newR.type_depart===opt.v?typColor(opt.v):'#666',marginTop:2}}>{opt.l}</div>
                </div>
              ))}
            </div>
          </div>
          {newR.type_depart==='personnalise'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div><label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>Hizb</label>
                <input type="number" min="0" max="60" style={{width:'100%',padding:'11px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                  value={newR.hizb_depart_fixe} onChange={e=>setNewR({...newR,hizb_depart_fixe:e.target.value})}/></div>
              <div><label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>Tomon</label>
                <select style={{width:'100%',padding:'11px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
                  value={newR.tomon_depart_fixe} onChange={e=>setNewR({...newR,tomon_depart_fixe:e.target.value})}>
                  {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>T.{n}</option>)}
                </select></div>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'ملاحظة':'Note'}</label>
            <input style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
              value={newR.note} onChange={e=>setNewR({...newR,note:e.target.value})} placeholder={lang==='ar'?'سبب القاعدة...':'Ex: Primaire → Collège'}/>
          </div>
          <button onClick={async()=>{
            if(!newR.niveau_from||!newR.niveau_to) return showMsg('error',lang==='ar'?'اختر المستويين':'Choisissez les niveaux');
            setSaving(true);
            await supabase.from('regles_passage_niveau').insert({ecole_id:user.ecole_id,...newR,hizb_depart_fixe:parseInt(newR.hizb_depart_fixe)||0,tomon_depart_fixe:parseInt(newR.tomon_depart_fixe)||1,sourates_acquises_fixe:parseInt(newR.sourates_acquises_fixe)||0,actif:true});
            await loadRegles();
            setNewR({niveau_from:'',niveau_to:'',type_depart:'continuer',hizb_depart_fixe:0,tomon_depart_fixe:1,sourates_acquises_fixe:0,note:''});
            setShowForm(false); setSaving(false);
            showMsg('success',lang==='ar'?'تمت إضافة القاعدة':'Règle ajoutée !');
          }} disabled={saving}
            style={{width:'100%',padding:'13px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            {saving?'...':(lang==='ar'?'حفظ القاعدة':'Enregistrer la règle')}
          </button>
        </div>
      )}
      {loading?<div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>
        :regles.length===0?(
          <div style={{textAlign:'center',padding:'2rem',background:'#fff',borderRadius:12,color:'#aaa'}}>
            <div style={{fontSize:32,marginBottom:8}}>🎓</div>
            <div style={{fontSize:13}}>{lang==='ar'?'لا توجد قواعد بعد':'Aucune règle configurée'}</div>
            <div style={{fontSize:11,marginTop:4,color:'#ccc'}}>{lang==='ar'?'الطالب يستمر من موقعه افتراضياً':'Par défaut : continue depuis sa position'}</div>
          </div>
        ):regles.map(r=>{
          const fc=getNC(r.niveau_from); const tc=getNC(r.niveau_to); const dc=typColor(r.type_depart);
          return(
            <div key={r.id} style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,border:'0.5px solid #e0e0d8',opacity:r.actif?1:0.5}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:fc+'20',color:fc}}>{r.niveau_from}</span>
                <span style={{color:'#aaa'}}>→</span>
                <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:tc+'20',color:tc}}>{r.niveau_to}</span>
                <span style={{flex:1}}/>
                <span style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:dc+'15',color:dc}}>{typLabel(r.type_depart)}</span>
              </div>
              {r.note&&<div style={{fontSize:11,color:'#aaa',fontStyle:'italic',marginBottom:6}}>{r.note}</div>}
              <div style={{display:'flex',gap:6}}>
                <button onClick={async()=>{await supabase.from('regles_passage_niveau').update({actif:!r.actif}).eq('id',r.id);setRegles(prev=>prev.map(x=>x.id===r.id?{...x,actif:!x.actif}:x));}}
                  style={{padding:'4px 10px',borderRadius:6,fontSize:10,fontWeight:600,cursor:'pointer',border:'none',background:r.actif?'#E1F5EE':'#f0f0ec',color:r.actif?'#085041':'#888'}}>
                  {r.actif?(lang==='ar'?'نشط':'Actif'):(lang==='ar'?'غير نشط':'Inactif')}
                </button>
                <button onClick={async()=>{await supabase.from('regles_passage_niveau').delete().eq('id',r.id);setRegles(prev=>prev.filter(x=>x.id!==r.id));}}
                  style={{padding:'4px 8px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'none',cursor:'pointer',fontSize:11}}>🗑</button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

export default function Gestion({ user, navigate, goBack, lang = 'fr', isMobile, initialTab, setGestionTab }) {
  const { toast } = useToast();
  const [tab, setTabLocal] = useState(isMobile ? (initialTab && initialTab !== 'parametres' ? initialTab : 'eleves') : (initialTab || 'parametres'));
  const setTab = (t) => { setTabLocal(t); if(setGestionTab) setGestionTab(t); };
  const [searchEleve, setSearchEleve] = useState('');
  const [parents, setParents] = useState([]);
  const [formParent, setFormParent] = useState({prenom:'',nom:'',identifiant:'',mot_de_passe:'',telephone:'',eleve_ids:[]});
  const [showFormParent, setShowFormParent] = useState(false);
  const [confirmModal, setConfirmModal] = useState({isOpen:false,title:'',message:'',onConfirm:null,confirmColor:'#E24B4A',confirmLabel:''});
  const showConfirm = (title, message, onConfirm, confirmLabel, confirmColor) => setConfirmModal({isOpen:true,title,message,onConfirm,confirmLabel:confirmLabel||(lang==='ar'?'حذف':'Supprimer'),confirmColor:confirmColor||'#E24B4A'});
  const hideConfirm = () => setConfirmModal(m=>({...m,isOpen:false,onConfirm:null}));
  const [editingParentId, setEditingParentId] = useState(null);
  const [searchParent, setSearchParent] = useState('');
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editEleve, setEditEleve] = useState(null);
  const [showAcquisSelector, setShowAcquisSelector] = useState(false);
  const [editShowAcquisSelector, setEditShowAcquisSelector] = useState(false);

  const [newEleve, setNewEleve] = useState({ prenom: '', nom: '', niveau: 'Débutant', code_niveau: '', eleve_id_ecole: '', instituteur_referent_id: '', hizb_depart: 0, tomon_depart: 1, sourates_acquises: 0, telephone: '', date_inscription: '' });
  const [newInst, setNewInst] = useState({ prenom: '', nom: '', identifiant: '', mot_de_passe: '' });
  const [ecoleConfig, setEcoleConfig] = useState({ mdp_defaut_instituteurs: 'ecole2024', mdp_defaut_parents: 'parent2024', sens_recitation_defaut: 'desc' });
  // Hooks niveaux dynamiques
  const [niveauxDyn, setNiveauxDyn] = useState([]);
  // Programmes de chaque niveau (map code_niveau => liste de lignes programmes)
  // Utilisé pour afficher l'aide "acquis par bloc" dans AcquisSelector (Étape C)
  const [programmesParNiveau, setProgrammesParNiveau] = useState({});
  // Hooks formulaires mobiles
  const [showFormEleve,  setShowFormEleve]  = useState(false);
  const [showFormInst,   setShowFormInst]   = useState(false);
  const [mobileEditEleve,setMobileEditEleve]= useState(null);
  const [editInstituteur, setEditInstituteur] = useState(null);
  const [formEditInst, setFormEditInst] = useState({prenom:'',nom:'',identifiant:'',mot_de_passe:''});

  // ── Barème de notes ──
  const [bareme, setBareme] = useState({ unites: {...BAREME_DEFAUT}, examens: {}, ensembles: {}, jalons: {} });
  const [baremeLoaded, setBaremeLoaded] = useState(false);
  const [savingBareme, setSavingBareme] = useState(false);

  // ── Périodes / Notes ──
  const [periodes, setPeriodes] = useState([]);
  const [newPeriode, setNewPeriode] = useState({ nom_ar: '', date_debut: '', date_fin: '' });
  const [savingPeriode, setSavingPeriode] = useState(false);

  // ── Jalons / Certificats ──
  const [jalons, setJalons] = useState([]);
  const [ensemblesDisp, setEnsemblesDisp] = useState([]);
  const [examensDisp, setExamensDisp] = useState([]);
  const [newJalon, setNewJalon] = useState({ nom_ar: '', type_jalon: 'hizb', hizb_ids: [], ensemble_id: '', examen_id: '' });
  const [savingJalon, setSavingJalon] = useState(false);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    supabase.from('niveaux').select('id,code,nom,type,couleur,sens_recitation')
      .eq('ecole_id', user.ecole_id).order('ordre')
      .then(async ({data}) => {
        if(data) {
          setNiveauxDyn(data);
          // Auto-select du premier niveau si le formulaire est vide
          // Évite que le dropdown affiche une valeur fantôme comme '1' inexistant
          if (data.length > 0) {
            setNewEleve(prev => prev.code_niveau ? prev : { ...prev, code_niveau: data[0].code });
          }
          // Charger tous les programmes de l'école et les grouper par niveau (pour Étape C)
          try {
            const { data: progData } = await supabase.from('programmes')
              .select('niveau_id, reference_id, ordre, bloc_numero, bloc_nom, bloc_sens, type_contenu')
              .eq('ecole_id', user.ecole_id)
              .order('ordre');
            if (progData) {
              const map = {};
              const niveauxById = Object.fromEntries(data.map(n => [n.id, n]));
              for (const ligne of progData) {
                const niveau = niveauxById[ligne.niveau_id];
                if (niveau) {
                  if (!map[niveau.code]) map[niveau.code] = [];
                  map[niveau.code].push(ligne);
                }
              }
              setProgrammesParNiveau(map);
            }
          } catch(e) { /* silencieux, l'aide bloc ne s'affichera juste pas */ }
        }
      });
  }, []);
  useEffect(() => {
    loadBareme(supabase, user.ecole_id).then(b => { setBareme(b); setBaremeLoaded(true); });
    supabase.from('periodes_notes').select('*').eq('ecole_id', user.ecole_id).order('date_debut')
      .then(({data}) => { if(data) setPeriodes(data); });
    supabase.from('jalons').select('*').eq('ecole_id', user.ecole_id).order('created_at')
      .then(({data}) => { if(data) setJalons(data); });
    supabase.from('ensembles_sourates').select('id,nom').eq('ecole_id', user.ecole_id).order('nom')
      .then(({data}) => { if(data) setEnsemblesDisp(data); });
    supabase.from('examens').select('id,nom').eq('ecole_id', user.ecole_id).eq('actif', true).order('nom')
      .then(({data}) => { if(data) setExamensDisp(data); });
  }, []);

  const loadData = async () => {
    const { data: ecData } = await supabase.from('ecoles').select('mdp_defaut_instituteurs,mdp_defaut_parents,sens_recitation_defaut').eq('id', user.ecole_id).maybeSingle();
    if (ecData) setEcoleConfig(prev => ({...prev, ...ecData}));
    setLoading(true);
    try {
    const { data: e } = await supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole,hizb_depart,tomon_depart,sourates_acquises,instituteur_referent_id,ecole_id,telephone,date_inscription')
        .eq('ecole_id', user.ecole_id).order('nom');
    const { data: i } = await supabase.from('utilisateurs').select('id,prenom,nom,identifiant,role').eq('role', 'instituteur').eq('ecole_id', user.ecole_id);
    setEleves(e || []);
    setInstituteurs(i || []);
    const { data: pd, error: pdErr } = await supabase.from('utilisateurs')
        .select('id,prenom,nom,identifiant')
        .eq('role','parent').eq('ecole_id', user.ecole_id);
    const { data: pliens } = await supabase.from('parent_eleve')
        .select('parent_id,eleve_id');
    const liensMap = {};
    (pliens||[]).forEach(l => { if(!liensMap[l.parent_id]) liensMap[l.parent_id]=[]; liensMap[l.parent_id].push(l.eleve_id); });
    setParents((pd||[]).map(p=>({...p, eleve_ids:liensMap[p.id]||[]})));
    setLoading(false);
  } catch (e) {
    console.error('[Gestion] Erreur chargement:', e);
    setLoading(false);
  }
};

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const ajouterEleve = async () => {
    if (!newEleve.prenom?.trim()) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    if (!newEleve.nom?.trim()) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    if (!newEleve.code_niveau) return showMsg('error', t(lang, 'tous_champs_obligatoires'));
    // Protection : le code_niveau DOIT correspondre à un niveau réellement existant
    // (évite les valeurs fantômes comme '1' quand le niveau n'existe pas)
    const niveauExiste = (niveauxDyn || []).some(n => n.code === newEleve.code_niveau);
    if (!niveauExiste) {
      return showMsg('error', lang==='ar'
        ? `المستوى "${newEleve.code_niveau}" غير موجود. اختر مستوى من القائمة.`
        : `Niveau "${newEleve.code_niveau}" inexistant. Choisissez un niveau dans la liste.`);
    }
    if (!newEleve.eleve_id_ecole?.trim()) return showMsg('error', lang==='ar'?'رقم تعريف الطالب إلزامي':"L'ID élève est obligatoire");
    if (!newEleve.instituteur_referent_id) return showMsg('error', lang==='ar'?'يجب اختيار الأستاذ المرجع':'Veuillez sélectionner un instituteur référent');

    // ⑦ Vérifier unicité numéro élève
    const { data: existing } = await supabase.from('eleves')
      .select('id').eq('eleve_id_ecole', newEleve.eleve_id_ecole.trim()).eq('ecole_id', user.ecole_id).maybeSingle();
    if (existing) return showMsg('error', lang==='ar'?'رقم التعريف مستخدم مسبقاً، اختر رقماً آخر':'Ce numéro élève existe déjà, choisissez-en un autre');

    const { error } = await supabase.from('eleves').insert({
      prenom: newEleve.prenom, nom: newEleve.nom, niveau: newEleve.niveau, ecole_id: user.ecole_id,
      code_niveau: newEleve.code_niveau,  // garanti valide par validation ci-dessus
      eleve_id_ecole: newEleve.eleve_id_ecole || null,
      instituteur_referent_id: newEleve.instituteur_referent_id || null,
      hizb_depart: parseInt(newEleve.hizb_depart) || 0,
      tomon_depart: parseInt(newEleve.tomon_depart) || 1,
      sourates_acquises: parseInt(newEleve.sourates_acquises) || 0,
      telephone: newEleve.telephone?.trim() || null,
      date_inscription: newEleve.date_inscription || null
    });
    if (error) {
      // Afficher la vraie cause de l'erreur pour faciliter le debug
      console.error('[ajouterEleve] Erreur insertion élève:', error);
      const detail = error.message || error.details || error.hint || 'inconnue';
      return showMsg('error', (lang==='ar' ? 'خطأ: ' : 'Erreur: ') + detail);
    }
    // Récupérer l'élève créé par son numéro (RLS bloque .select() après insert)
    const { data: eleveData } = await supabase.from('eleves')
      .select('id').eq('eleve_id_ecole', newEleve.eleve_id_ecole.trim()).eq('ecole_id', user.ecole_id).maybeSingle();

    // ⑥ Créer compte parent automatiquement
    const mdpParent = ecoleConfig?.mdp_defaut_parents || 'parent2024';
    const loginParent = newEleve.eleve_id_ecole.trim();
    const { data: parentData, error: parentErr } = await supabase.from('utilisateurs').insert({
      prenom: newEleve.prenom, nom: newEleve.nom,
      identifiant: loginParent, mot_de_passe: mdpParent,
      role: 'parent', ecole_id: user.ecole_id, statut_compte: 'actif'
    }).select().single();
    if (parentErr) showMsg('error', 'Erreur création parent: '+parentErr.message);
    if (parentData?.id && eleveData?.id) {
      const { error: lienErr } = await supabase.from('parent_eleve').insert({
        parent_id: parentData.id, eleve_id: eleveData.id
      });
    }

    showMsg('success', lang==='ar'?`✅ تم إضافة الطالب — حساب ولي الأمر: ${loginParent} / ${mdpParent}`:`✅ Élève ajouté — Compte parent: ${loginParent} / ${mdpParent}`);
    setNewEleve({ prenom: '', nom: '', niveau: 'Débutant', code_niveau: (niveauxDyn && niveauxDyn[0]?.code) || '', eleve_id_ecole: '', instituteur_referent_id: '', hizb_depart: 0, tomon_depart: 1, sourates_acquises: 0 });
    setShowAcquisSelector(false);
    loadData();
  };

  const modifierEleve = async () => {
    if (!editEleve.prenom?.trim()) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    if (!editEleve.nom?.trim()) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    if (!editEleve.code_niveau) return showMsg('error', t(lang, 'tous_champs_obligatoires'));
    if (!editEleve.eleve_id_ecole?.trim()) return showMsg('error', lang==='ar'?'رقم تعريف الطالب إلزامي':lang==='en'?'Student ID is required':"L'ID élève est obligatoire");
    if (!editEleve.instituteur_referent_id) return showMsg('error', lang==='ar'?'يجب اختيار الأستاذ المرجع':lang==='en'?'Please select a teacher':'Veuillez sélectionner un instituteur référent');
    const { error } = await supabase.from('eleves').update({
      prenom: editEleve.prenom, nom: editEleve.nom, niveau: editEleve.niveau,
      code_niveau: editEleve.code_niveau || '1',
      eleve_id_ecole: editEleve.eleve_id_ecole || null,
      instituteur_referent_id: editEleve.instituteur_referent_id || null,
      hizb_depart: parseInt(editEleve.hizb_depart) || 0,
      tomon_depart: parseInt(editEleve.tomon_depart) || 1,
      sourates_acquises: parseInt(editEleve.sourates_acquises) || 0,
      telephone: editEleve.telephone?.trim() || null,
      date_inscription: editEleve.date_inscription || null
    }).eq('id', editEleve.id);
    if (error) return showMsg('error', t(lang, 'erreur_ajout'));
    showMsg('success', t(lang, 'eleve_modifie'));
    setEditEleve(null);
    setEditShowAcquisSelector(false);
    loadData();
  };

  const supprimerEleve = (id) => {
    const eleve = eleves.find(e=>e.id===id);
    const nom = eleve ? eleve.prenom+' '+eleve.nom : '';
    // Count linked data
    showConfirm(
      lang==='ar'?'⚠️ حذف الطالب':'⚠️ Supprimer eleve',
      lang==='ar'
        ? 'سيتم حذف جميع بيانات '+nom+' (الاستظهارات، الأهداف، الاشتراكات). هذا الإجراء لا رجعة منه!'
        : (lang==='ar'?'سيتم حذف جميع بيانات '+nom+' نهائياً':'Toutes les données de '+nom+' seront supprimées. Action irréversible !'),
      async () => {
        hideConfirm();
        // Step 2: second confirmation for critical data
        showConfirm(
          lang==='ar'?'تأكيد نهائي — حذف '+nom:'Confirmation finale — Supprimer '+nom,
          lang==='ar'?'هل أنت متأكد تماماً؟ لا يمكن التراجع عن هذا الإجراء.':'Êtes-vous absolument sûr ? Cette action est définitive et irréversible.',
          async () => {
            // Supprimer toutes les données liées (ordre important pour contourner les FK)
            const tablesLiees = [
              'exceptions_recitation',
              'exceptions_hizb',
              'recitations_sourates',
              'validations',
              'apprentissages',
              'cotisations',
              'parent_eleve',
              'certificats_eleves',  // Étape D - les certificats doivent être supprimés
              'points_eleves',       // points/bonus/malus liés
              'passages_niveaux',    // historique passages
              'resultats_examens',   // résultats examens
            ];
            const erreurs = [];
            for (const table of tablesLiees) {
              try {
                const { error } = await supabase.from(table).delete().eq('eleve_id', id);
                if (error) erreurs.push(`${table}: ${error.message}`);
              } catch(e) {
                // Table n'existe peut-être pas - on ignore silencieusement
                console.warn(`[supprimerEleve] ${table} ignorée:`, e.message);
              }
            }
            // Détacher des objectifs (ne pas supprimer, juste null)
            await supabase.from('objectifs_globaux').update({eleve_id:null}).eq('eleve_id', id).catch(()=>{});
            // Enfin supprimer l'élève lui-même
            const { error: errFinal } = await supabase.from('eleves').delete().eq('id', id);
            if (errFinal) {
              console.error('[supprimerEleve] Echec suppression:', errFinal);
              showMsg('error', (lang==='ar' ? 'خطأ في الحذف: ' : 'Erreur suppression: ') + (errFinal.message || 'inconnue'));
              hideConfirm();
              return;
            }
            if (erreurs.length > 0) {
              console.warn('[supprimerEleve] Erreurs liées (élève supprimé malgré tout):', erreurs);
            }
            showMsg('success', t(lang, 'eleve_retire'));
            hideConfirm();
            loadData();
          },
          lang==='ar'?'حذف نهائي':'Supprimer définitivement',
          '#E24B4A'
        );
      },
      lang==='ar'?'نعم، متابعة':'Oui, continuer',
      '#EF9F27'
    );
  };

  const ajouterInstituteur = async () => {
    if (!newInst.prenom || !newInst.nom)
      return showMsg('error', lang==='ar'?'الاسم واللقب إلزاميان':'Prénom et nom obligatoires');
    // Générer login automatique : prenom.nom
    const normalize = s => {
      // Essayer normalisation latine (accents)
      const latin = s.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
        .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
      if (latin.length >= 2) return latin;
      // Fallback: utiliser le texte tel quel (arabe, etc.) nettoyé
      return s.trim().replace(/\s+/g,'_').replace(/[^\u0600-\u06ff\u0750-\u077fa-z0-9_]/gi,'').toLowerCase();
    };
    const baseLogin = normalize(newInst.prenom)+'_'+normalize(newInst.nom);
    // Trouver un login unique
    let login = baseLogin; let suffix = 2;
    while (true) {
      const {data:ex} = await supabase.from('utilisateurs')
        .select('id').eq('identifiant',login).eq('ecole_id',user.ecole_id).maybeSingle();
      if (!ex) break;
      login = baseLogin + suffix; suffix++;
    }
    const mdp = (newInst.mot_de_passe && newInst.mot_de_passe.trim()) ? newInst.mot_de_passe.trim() : (ecoleConfig?.mdp_defaut_instituteurs || 'ecole2024');
    const { error } = await supabase.from('utilisateurs').insert({
      prenom: newInst.prenom, nom: newInst.nom,
      identifiant: login, mot_de_passe: mdp, role: 'instituteur',
      ecole_id: user.ecole_id, statut_compte: 'actif'
    });
    if (error) return showMsg('error', error.message);
    showMsg('success', `✅ ${lang==='ar'?'تم الإضافة — المعرف:':'Ajouté — Login :'} ${login} ${lang==='ar'?'/ كلمة السر:':'/ MDP :'} ${mdp}`);
    setNewInst({ prenom: '', nom: '', identifiant: '', mot_de_passe: '' });
    loadData();
  };

  const supprimerInstituteur = (inst) => {
    const nbEleves = eleves.filter(e=>e.instituteur_referent_id===inst.id).length;
    const msg = nbEleves > 0
      ? (lang==='ar'?`هذا الأستاذ مرتبط بـ ${nbEleves} طالب. سيتم فصلهم عنه.`:`Cet instituteur a ${nbEleves} élève(s). Ils seront détachés.`)
      : (lang==='ar'?'هل تريد حذف هذا الأستاذ؟':'Supprimer cet instituteur ?');
    showConfirm(
      lang==='ar'?'حذف الأستاذ':"Supprimer instituteur",
      msg,
      async () => {
        // Détacher tous les élèves d'abord
        if (nbEleves > 0) {
          const { error: errDetach } = await supabase.from('eleves')
            .update({instituteur_referent_id: null})
            .eq('instituteur_referent_id', inst.id);
          if (errDetach) {
            console.error('[supprimerInstituteur] Detachement eleves:', errDetach);
            showMsg('error', (lang==='ar' ? 'خطأ في فصل الطلاب: ' : 'Erreur détachement élèves: ') + errDetach.message);
            hideConfirm();
            return;
          }
        }
        // Détacher des objectifs
        await supabase.from('objectifs_globaux').update({instituteur_id: null}).eq('instituteur_id', inst.id).catch(()=>{});
        // Autres tables qui référencent l'instituteur (si elles existent)
        await supabase.from('validations').update({valide_par: null}).eq('valide_par', inst.id).catch(()=>{});
        await supabase.from('certificats_eleves').update({valide_par: null}).eq('valide_par', inst.id).catch(()=>{});
        // Enfin supprimer l'instituteur
        const { error: errFinal } = await supabase.from('utilisateurs').delete().eq('id', inst.id);
        if (errFinal) {
          console.error('[supprimerInstituteur] Echec suppression:', errFinal);
          showMsg('error', (lang==='ar' ? 'خطأ في الحذف: ' : 'Erreur suppression: ') + (errFinal.message || 'inconnue'));
          hideConfirm();
          return;
        }
        showMsg('success', t(lang, 'instituteur_retire'));
        hideConfirm();
        loadData();
      }
    );
  };


  const supprimerParent = (parentId) => {
    const p = parents.find(x=>x.id===parentId);
    const nom = p ? p.prenom+' '+p.nom : '';
    showConfirm(
      lang==='ar'?'حذف ولي الأمر':'Supprimer le parent',
      (lang==='ar'?'هل تريد حذف حساب ':'Supprimer le compte de ')+nom+' ?',
      async () => {
        await supabase.from('parent_eleve').delete().eq('parent_id', parentId);
        await supabase.from('utilisateurs').delete().eq('id', parentId);
        hideConfirm();
        toast.success(lang==='ar'?'تم الحذف':'Parent supprimé');
        loadData();
      },
      lang==='ar'?'حذف':'Supprimer',
      '#E24B4A'
    );
  };

  const instNom = (id) => { const i = instituteurs.find(x => x.id === id); return i ? `${i.prenom} ${i.nom}` : '—'; };


  const exportParentsExcel = async () => {
    if (!window.XLSX) {
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['#',lang==='ar'?'الاسم':'Prénom',lang==='ar'?'اللقب':'Nom',lang==='ar'?'المعرف':'Identifiant',lang==='ar'?'الهاتف':'Téléphone',lang==='ar'?'الأبناء':'Enfants'],
      ...parents.map((p,i)=>[i+1,p.prenom,p.nom,p.identifiant,p.telephone||'—',eleves.filter(e=>(p.eleve_ids||[]).includes(e.id)).map(e=>e.prenom+' '+e.nom).join(', ')])
    ]);
    ws['!cols']=[{wch:4},{wch:16},{wch:16},{wch:18},{wch:14},{wch:30}];
    XLSX.utils.book_append_sheet(wb,ws,(lang==='ar'?'الآباء':'Parents'));
    XLSX.writeFile(wb,'parents_'+new Date().toISOString().split('T')[0]+'.xlsx');
  };

  const exportParentsPDF = () => {
    const w = window.open('','_blank','width=1000,height=800');
    if (!w) { toast.warning(lang==='ar'?'يرجى السماح بالنوافذ المنبثقة':'Autorisez les popups pour exporter'); return; }
    const rows = parents.map((p,i) => {
      const enfants = eleves.filter(e=>(p.eleve_ids||[]).includes(e.id)).map(e=>e.prenom+' '+e.nom).join(', ') || '—';
      const bg = i%2===0?'#fff':'#f9f9f6';
      return '<tr style="background:'+bg+'">'
        +'<td>'+(i+1)+'</td>'
        +'<td><strong>'+p.prenom+' '+p.nom+'</strong></td>'
        +'<td style="color:#888">'+(p.identifiant||'—')+'</td>'
        +'<td style="color:#888">'+(p.telephone||'—')+'</td>'
        +'<td style="color:#555;font-size:10px">'+enfants+'</td>'
        +'</tr>';
    }).join('');
    const html = '<!DOCTYPE html><html dir="'+(lang==='ar'?'rtl':'ltr')+'" lang="'+(lang==='ar'?'ar':'fr')+'"><head><meta charset="UTF-8"><title>Liste Parents</title>'
      +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Tajawal,Arial,sans-serif;padding:20px;font-size:12px}'
      +'.header{background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px}'
      +'h1{font-size:18px;font-weight:800;margin-bottom:4px}'
      +'table{width:100%;border-collapse:collapse}th{background:#534AB7;color:#fff;padding:8px;text-align:start;font-size:11px}'
      +'td{padding:7px 8px;border-bottom:1px solid #f0f0ec;font-size:11px}'
      +'.footer{margin-top:16px;font-size:9px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:8px;text-align:center}'
      +'</style></head><body>'
      +'<div class="header"><h1>👨‍👩‍👦 '+(lang==='ar'?'قائمة أولياء الأمور':'Liste des Parents')+'</h1>'
      +'<div style="font-size:11px;opacity:0.8">'+parents.length+' '+(lang==='ar'?'ولي أمر':'parent(s)')+' · '+new Date().toLocaleDateString('fr-FR')+'</div></div>'
      +'<table><thead><tr>'
      +'<th>#</th><th>'+(lang==='ar'?'الاسم':'Nom complet')+'</th><th>'+(lang==='ar'?'المعرف':'Identifiant')+'</th>'
      +'<th>'+(lang==='ar'?'الهاتف':'Téléphone')+'</th><th>'+(lang==='ar'?'الأبناء':'Enfants')+'</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table>'
      +'<div class="footer">Généré le '+new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})+' · متابعة التحفيظ</div>'
      +'</body></html>';
    w.document.write(html); w.document.close();
    setTimeout(function(){ w.print(); }, 600);
  };

  const NIVEAU_LABELS = {'5B':(lang==='ar'?'تمهيدي':'Préscolaire'),'5A':'Primaire 1-2','2M':'Primaire 3-4','2':'Primaire 5-6','1':(lang==='ar'?'إعدادي/ثانوي':'Collège/Lycée')};

  // Export élèves Excel
  const exportElevesExcel = async () => {
    if (!window.XLSX) {
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const headers = ['#',
      lang==='ar'?'الاسم':'Prénom', lang==='ar'?'اللقب':'Nom',
      lang==='ar'?'رقم التعريف':'N° Élève',
      lang==='ar'?'المستوى الدراسي':'Niveau scolaire',
      lang==='ar'?'الصف':'Classe',
      lang==='ar'?'الأستاذ المرجع':'Instituteur référent',
      lang==='ar'?'هاتف ولي الأمر':'Tél. parent',
      lang==='ar'?'تاريخ التسجيل':'Date inscription',
      lang==='ar'?'المكتسبات':'Acquis antérieurs',
    ];
    const rows = eleves.map((e,i) => {
      const inst = instituteurs.find(x=>x.id===e.instituteur_referent_id);
      const isSour = (niveauxDyn||[]).find(n=>n.code===e.code_niveau)?.type==='sourate'||['5B','5A','2M'].includes(e.code_niveau||'');
      const acquis = isSour ? (e.sourates_acquises||0)+' '+(lang==='ar'?'محفوظ':'sourates acquises') : 'Hizb '+e.hizb_depart+', T.'+e.tomon_depart;
      const dateInscr = e.date_inscription ? new Date(e.date_inscription).toLocaleDateString('fr-FR') : '—';
      return [i+1, e.prenom, e.nom, e.eleve_id_ecole||'—', e.code_niveau||'?',
        (niveauxDyn||[]).find(n=>n.code===e.code_niveau)?.nom || NIVEAU_LABELS[e.code_niveau||'']||'—',
        inst?inst.prenom+' '+inst.nom:'—',
        e.telephone||'—', dateInscr, acquis];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{wch:4},{wch:14},{wch:14},{wch:10},{wch:8},{wch:20},{wch:22},{wch:14},{wch:14},{wch:18}];
    // Style header row
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C=range.s.c; C<=range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({r:0,c:C})];
      if (cell) cell.s = {font:{bold:true},fill:{fgColor:{rgb:'085041'}},font:{color:{rgb:'FFFFFF'},bold:true}};
    }
    XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'الطلاب':'Élèves');
    XLSX.writeFile(wb, 'eleves_'+new Date().toISOString().split('T')[0]+'.xlsx');
  };

  // Export instituteurs Excel
  const exportInstituteursExcel = async () => {
    if (!window.XLSX) {
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', lang==='ar'?'الاسم':'Prénom', lang==='ar'?'اللقب':'Nom', lang==='ar'?'المعرف':'Identifiant', lang==='ar'?'عدد الطلاب':'Nb élèves'],
      ...instituteurs.map((inst,i) => {
        const nbEleves = eleves.filter(e=>e.instituteur_referent_id===inst.id).length;
        return [i+1, inst.prenom, inst.nom, inst.identifiant||'—', nbEleves];
      })
    ]);
    ws['!cols'] = [{wch:4},{wch:16},{wch:16},{wch:18},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws, lang==='ar'?'الأساتذة':'Instituteurs');
    XLSX.writeFile(wb, 'instituteurs_'+new Date().toISOString().split('T')[0]+'.xlsx');
  };

  // Export PDF élèves
  const exportElevesPDF = () => {
    const w = window.open('','_blank','width=1200,height=800');
    if (!w) { toast.warning(lang==='ar'?'يرجى السماح بالنوافذ المنبثقة':'Autorisez les popups pour exporter'); return; }
    const rows = eleves.map((e,i) => {
      const inst = instituteurs.find(x=>x.id===e.instituteur_referent_id);
      const nc = (niveauxDyn||[]).find(n=>n.code===e.code_niveau)?.couleur || {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[e.code_niveau||'']||'#888';
      const isSour = (niveauxDyn||[]).find(n=>n.code===e.code_niveau)?.type==='sourate'||['5B','5A','2M'].includes(e.code_niveau||'');
      const acquis = isSour ? (e.sourates_acquises||0)+' '+(lang==='ar'?'محفوظ':'sour.') : 'H.'+e.hizb_depart+' / T.'+e.tomon_depart;
      const niveauLabel = e.niveau==='Avancé'||e.niveau==='متقدم'?(lang==='ar'?'متقدم':'Avancé'):e.niveau==='Intermédiaire'||e.niveau==='متوسط'?(lang==='ar'?'متوسط':'Interm.'):(lang==='ar'?'مبتدئ':'Débutant');
      const niveauColor = e.niveau==='Avancé'||e.niveau==='متقدم'?'#085041':e.niveau==='Intermédiaire'||e.niveau==='متوسط'?'#378ADD':'#EF9F27';
      const bg = i%2===0?'#fff':'#f9f9f6';
      return `<tr style="background:${bg}">
        <td style="color:#bbb;font-size:10px;text-align:center">${i+1}</td>
        <td><strong>${e.prenom} ${e.nom}</strong></td>
        <td style="color:#888;font-size:11px">${e.eleve_id_ecole?'#'+e.eleve_id_ecole:'—'}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:${nc}20;color:${nc}">${e.code_niveau||'?'}</span></td>
        <td><span style="font-size:10px;font-weight:600;color:${niveauColor}">${niveauLabel}</span></td>
        <td style="font-size:11px;color:#444">${inst?inst.prenom+' '+inst.nom:'—'}</td>
        <td style="font-size:11px;color:#534AB7;font-weight:600">${acquis}</td>
        <td style="font-size:11px;color:#555">${e.telephone||'<span style="color:#ddd">—</span>'}</td>
        <td style="font-size:11px;color:#555">${e.date_inscription?new Date(e.date_inscription).toLocaleDateString('fr-FR'):'<span style="color:#ddd">—</span>'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html dir="${lang==='ar'?'rtl':'ltr'}" lang="${lang==='ar'?'ar':'fr'}">
<head><meta charset="UTF-8"><title>Liste Élèves</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Tajawal,Arial,sans-serif;padding:16px;font-size:12px;color:#1a1a1a}
  .header{background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;padding:14px 20px;border-radius:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
  h1{font-size:17px;font-weight:800}
  table{width:100%;border-collapse:collapse}
  th{background:#085041;color:#fff;padding:7px 8px;text-align:start;font-size:10px;font-weight:600;letter-spacing:0.3px}
  td{padding:6px 8px;border-bottom:1px solid #f0f0ec;vertical-align:middle}
  .footer{margin-top:14px;font-size:9px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:8px;text-align:center}
  @media print{body{padding:8px}}
</style></head><body>
<div class="header">
  <h1>👥 ${lang==='ar'?'قائمة الطلاب المسجلين':'Liste des Élèves Inscrits'}</h1>
  <div style="font-size:11px;opacity:0.85">${eleves.length} ${lang==='ar'?'طالب':'élève(s)'} · ${new Date().toLocaleDateString('fr-FR')}</div>
</div>
<table><thead><tr>
  <th style="width:3%">#</th>
  <th style="width:16%">${lang==='ar'?'الاسم الكامل':'Nom complet'}</th>
  <th style="width:8%">${lang==='ar'?'رقم التعريف':'N° Élève'}</th>
  <th style="width:7%">${lang==='ar'?'الصف':'Classe'}</th>
  <th style="width:8%">${lang==='ar'?'المستوى':'Niveau'}</th>
  <th style="width:16%">${lang==='ar'?'الأستاذ المرجع':'Instituteur'}</th>
  <th style="width:10%">${lang==='ar'?'المكتسبات':'Acquis'}</th>
  <th style="width:16%">${lang==='ar'?'هاتف ولي الأمر':'Tél. parent'}</th>
  <th style="width:12%">${lang==='ar'?'تاريخ التسجيل':'Inscription'}</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Généré le ${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})} · متابعة التحفيظ</div>
</body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(function(){ w.print(); }, 600);
  };

  // Export PDF instituteurs
  const exportInstituteursPDF = () => {
    const w = window.open('','_blank','width=900,height=700');
    if (!w) { toast.warning(lang==='ar'?'يرجى السماح بالنوافذ المنبثقة':'Autorisez les popups pour exporter'); return; }
    const rows = instituteurs.map((inst,i) => {
      const nbEleves = eleves.filter(e=>e.instituteur_referent_id===inst.id).length;
      const elevesInst = eleves.filter(e=>e.instituteur_referent_id===inst.id);
      const niveauxCodes = [...new Set(elevesInst.map(e=>e.code_niveau||'?'))].map(c=>`<span style="display:inline-block;padding:1px 6px;border-radius:10px;font-size:9px;font-weight:700;background:#E1F5EE;color:#085041;margin:1px">${c}</span>`).join(' ');
      const elevesListe = elevesInst.slice(0,8).map(e=>e.prenom+' '+e.nom).join(' · ')+(elevesInst.length>8?` (+${elevesInst.length-8})`:'') || '—';
      const bg = i%2===0?'#fff':'#f9f9f6';
      return `<tr style="background:${bg}">
        <td style="color:#bbb;text-align:center;font-size:10px">${i+1}</td>
        <td><strong>${inst.prenom} ${inst.nom}</strong><div style="font-size:9px;color:#aaa">${inst.identifiant||''}</div></td>
        <td style="text-align:center"><span style="font-size:16px;font-weight:800;color:#1D9E75">${nbEleves}</span></td>
        <td>${niveauxCodes}</td>
        <td style="font-size:10px;color:#888">${elevesListe}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html dir="${lang==='ar'?'rtl':'ltr'}" lang="${lang==='ar'?'ar':'fr'}">
<head><meta charset="UTF-8"><title>Liste Instituteurs</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Tajawal,Arial,sans-serif;padding:16px;font-size:12px}
.header{background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;padding:14px 20px;border-radius:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
h1{font-size:17px;font-weight:800}table{width:100%;border-collapse:collapse}
th{background:#085041;color:#fff;padding:7px 10px;text-align:start;font-size:10px;font-weight:600}
td{padding:7px 10px;border-bottom:1px solid #f0f0ec;vertical-align:middle;font-size:11px}
.footer{margin-top:14px;font-size:9px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:8px;text-align:center}
@media print{body{padding:8px}}</style></head><body>
<div class="header"><h1>👨‍🏫 ${lang==='ar'?'قائمة الأساتذة':'Liste des Instituteurs'}</h1>
<div style="font-size:11px;opacity:0.85">${instituteurs.length} ${lang==='ar'?'أستاذ':'instituteur(s)'} · ${new Date().toLocaleDateString('fr-FR')}</div></div>
<table><thead><tr>
  <th style="width:4%">#</th>
  <th style="width:20%">${lang==='ar'?'الأستاذ':'Instituteur'}</th>
  <th style="width:8%">${lang==='ar'?'عدد الطلاب':'Élèves'}</th>
  <th style="width:14%">${lang==='ar'?'المستويات':'Niveaux'}</th>
  <th>${lang==='ar'?'قائمة الطلاب':'Liste élèves'}</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Généré le ${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})} · متابعة التحفيظ</div>
</body></html>`;
    w.document.write(html); w.document.close();
    setTimeout(function(){ w.print(); }, 600);
  }



  // Constantes niveaux dynamiques — avec fallback si niveaux pas encore chargés
  const FALLBACK_NC = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'};
  const FALLBACK_NL = {'5B':'Préscolaire','5A':'Prim. 1-2','2M':'Prim. 3-4','2':'Prim. 5-6','1':'Collège'};
  const niveauxActifs = niveauxDyn.length > 0 ? niveauxDyn : Object.keys(FALLBACK_NC).map(code=>({id:code,code,nom:FALLBACK_NL[code]||code,couleur:FALLBACK_NC[code],type:'hizb'}));
  const niveaux = niveauxActifs.map(n=>({value:n.code, label:`${n.code} — ${n.nom}`}));
  const NC = Object.fromEntries(niveauxActifs.map(n=>[n.code, n.couleur||FALLBACK_NC[n.code]||'#888']));
  const NL = Object.fromEntries(niveauxActifs.map(n=>[n.code, n.nom||n.code]));
  const NIVEAUX_M = niveauxActifs.map(n=>n.code);

  // Navigation immédiate pour onglets liens mobiles (DOIT être avant if(isMobile) — règle hooks React)
  useEffect(() => {
    if (!isMobile) return;
    // Naviguer vers la page dédiée en sauvegardant tab:'eleves' pour que goBack revienne correctement
    if (tab==='niveaux_link')   { navigate('niveaux',  null, {tab:'eleves'}); setTab('eleves'); }
    if (tab==='ensembles_link') { navigate('ensembles',null, {tab:'eleves'}); setTab('eleves'); }
    if (tab==='examens_link')   { navigate('examens',  null, {tab:'eleves'}); setTab('eleves'); }
  }, [tab, isMobile]); // eslint-disable-line

  if (isMobile) {
    // Couleurs dynamiques depuis niveauxActifs, fallback hardcoded
    const getNC = (code) => (niveauxActifs||[]).find(n=>n.code===code)?.couleur ||
      {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[code] || '#888';

    const resetFormEleve = () => {
      setNewEleve({prenom:'',nom:'',niveau:'Débutant',code_niveau:(niveauxDyn && niveauxDyn[0]?.code) || '',eleve_id_ecole:'',
        instituteur_referent_id:'',hizb_depart:0,tomon_depart:1,sourates_acquises:0,
        telephone:'',date_inscription:''});
      setEditEleve(null); setMobileEditEleve(null);
    };
    const handleSaveEleve = async () => {
      if (editEleve) { await modifierEleve(); setShowFormEleve(false); resetFormEleve(); }
      else           { await ajouterEleve();  setShowFormEleve(false); resetFormEleve(); }
    };
    const startEditEleve = (e) => {
      setEditEleve({...e}); setMobileEditEleve(e);
      setShowFormEleve(true); window.scrollTo(0,0);
    };

    const TABS_MOBILE = [
      {k:'eleves',        l:lang==='ar'?'الطلاب':'Élèves'},
      {k:'instituteurs',  l:lang==='ar'?'الأساتذة':'Profs'},
      {k:'parents',       l:lang==='ar'?'الآباء':'Parents'},
      {k:'jalons',        l:lang==='ar'?'الشهادات':'Jalons'},
      {k:'passage_niveau',l:lang==='ar'?'الانتقال':'Passage'},
      {k:'niveaux_link',  l:lang==='ar'?'المستويات':'Niveaux'},
      {k:'ensembles_link',l:lang==='ar'?'مجموعات السور':'Ensembles'},
      {k:'bareme',        l:lang==='ar'?'النقاط':'Barème'},
      {k:'examens_link',  l:lang==='ar'?'الامتحانات':'Examens'},
    ];

    if (loading) return <div style={{padding:'3rem',textAlign:'center',color:'#888'}}>...</div>;

    // ─── Composant champ input réutilisable ───
    const FI = ({label, val, onChange, ph, type='text', required=false}) => (
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>
          {label}{required&&<span style={{color:'#E24B4A'}}> *</span>}
        </label>
        <input type={type}
          style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',
            fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
          value={val} onChange={onChange} placeholder={ph}/>
      </div>
    );

    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>

        {/* ─── HEADER ─── */}
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#fff'}}>⚙️ {lang==='ar'?'الإدارة':'Administration'}</div>
            {tab==='eleves'&&user.role==='surveillant'&&(
              <button onClick={()=>{resetFormEleve();setShowFormEleve(v=>!v);}}
                style={{background:showFormEleve?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.25)',color:'#fff',
                  border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {showFormEleve?'✕':(lang==='ar'?'+ إضافة':'+ Ajouter')}
              </button>
            )}
            {tab==='instituteurs'&&user.role==='surveillant'&&(
              <button onClick={()=>setShowFormInst(v=>!v)}
                style={{background:'rgba(255,255,255,0.25)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {showFormInst?'✕':(lang==='ar'?'+ إضافة':'+ Ajouter')}
              </button>
            )}
            {tab==='parents'&&user.role==='surveillant'&&(
              <button onClick={()=>setShowFormParent(v=>!v)}
                style={{background:'rgba(255,255,255,0.25)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {showFormParent?'✕':(lang==='ar'?'+ إضافة':'+ Ajouter')}
              </button>
            )}
          </div>
          {msg.text&&(
            <div style={{margin:'0 0 10px',padding:'10px 14px',borderRadius:10,fontSize:13,
              background:msg.type==='error'?'rgba(226,75,74,0.9)':'rgba(29,158,117,0.9)',color:'#fff'}}>
              {msg.text}
            </div>
          )}
        </div>
        {/* Tabs scrollables — barre séparée sous le header */}
        <div style={{display:'flex',gap:0,overflowX:'auto',scrollbarWidth:'none',
          background:'#064e3b',position:'sticky',top:72,zIndex:99,
          borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
          {TABS_MOBILE.map(({k,l})=>(
            <div key={k} onClick={()=>setTab(k)}
              style={{padding:'10px 14px',fontSize:11,fontWeight:600,cursor:'pointer',flexShrink:0,
                whiteSpace:'nowrap',
                color:tab===k?'#4AE4A8':'rgba(255,255,255,0.65)',
                borderBottom:tab===k?'2.5px solid #4AE4A8':'2.5px solid transparent',
                background:'transparent',transition:'all 0.15s'}}>
              {l}
            </div>
          ))}
        </div>

        {/* ─── ONGLET ÉLÈVES ─── */}
        {tab==='eleves'&&(
          <div style={{padding:'12px'}}>
            {showFormEleve&&user.role==='surveillant'&&(
              <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
                border:`1.5px solid ${mobileEditEleve?'#378ADD':'#1D9E75'}`}}>
                <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                  {mobileEditEleve?(lang==='ar'?'تعديل الطالب':'✏️ Modifier'):(lang==='ar'?'إضافة طالب':'👤 Nouvel élève')}
                </div>

                {/* Prénom + Nom côte à côte */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:0}}>
                  {[{label:lang==='ar'?'الاسم':'Prénom',key:'prenom'},{label:lang==='ar'?'اللقب':'Nom',key:'nom'}].map(f=>(
                    <div key={f.key} style={{marginBottom:12}}>
                      <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{f.label} <span style={{color:'#E24B4A'}}>*</span></label>
                      <input style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                        value={editEleve?editEleve[f.key]||'':newEleve[f.key]}
                        onChange={e=>editEleve?setEditEleve(x=>({...x,[f.key]:e.target.value})):setNewEleve(x=>({...x,[f.key]:e.target.value}))}
                        placeholder={f.label}/>
                    </div>
                  ))}
                </div>

                {/* Niveau scolaire — chips dynamiques */}
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'المستوى الدراسي':'Niveau scolaire'} <span style={{color:'#E24B4A'}}>*</span></label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {(niveauxActifs||[]).map(n=>{
                      const nc=n.couleur||getNC(n.code);
                      const cur=editEleve?editEleve.code_niveau:newEleve.code_niveau;
                      return(
                        <div key={n.code} onClick={()=>editEleve?setEditEleve(x=>({...x,code_niveau:n.code})):setNewEleve(x=>({...x,code_niveau:n.code}))}
                          style={{padding:'7px 12px',borderRadius:20,cursor:'pointer',flexShrink:0,
                            background:cur===n.code?nc:'#f5f5f0',color:cur===n.code?'#fff':'#666',
                            border:`1.5px solid ${cur===n.code?nc:'#e0e0d8'}`,fontWeight:cur===n.code?700:400,fontSize:12}}>
                          {n.code}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ID + Référent */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:0}}>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'رقم التعريف':'ID élève'} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                      value={editEleve?editEleve.eleve_id_ecole||'':newEleve.eleve_id_ecole}
                      onChange={e=>editEleve?setEditEleve(x=>({...x,eleve_id_ecole:e.target.value})):setNewEleve(x=>({...x,eleve_id_ecole:e.target.value}))}
                      placeholder="001"/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'الأستاذ المرجع':'Référent'} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
                      value={editEleve?editEleve.instituteur_referent_id||'':newEleve.instituteur_referent_id}
                      onChange={e=>editEleve?setEditEleve(x=>({...x,instituteur_referent_id:e.target.value})):setNewEleve(x=>({...x,instituteur_referent_id:e.target.value}))}>
                      <option value="">— {lang==='ar'?'اختر':'Choisir'} —</option>
                      {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                    </select>
                  </div>
                </div>

                {/* Téléphone parent + Date inscription */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:0}}>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'هاتف ولي الأمر':'Tél. parent'}</label>
                    <input type="tel" style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                      value={editEleve?editEleve.telephone||'':newEleve.telephone||''}
                      onChange={e=>editEleve?setEditEleve(x=>({...x,telephone:e.target.value})):setNewEleve(x=>({...x,telephone:e.target.value}))}
                      placeholder="06XXXXXXXX"/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'تاريخ التسجيل':'Inscription'}</label>
                    <input type="date" style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}}
                      value={editEleve?editEleve.date_inscription||'':newEleve.date_inscription||''}
                      onChange={e=>editEleve?setEditEleve(x=>({...x,date_inscription:e.target.value})):setNewEleve(x=>({...x,date_inscription:e.target.value}))}/>
                  </div>
                </div>

                {/* Hizb/Tomon si niveau hizb */}
                {!isSourateNiveauDyn(editEleve?editEleve.code_niveau:newEleve.code_niveau, niveauxActifs||[])&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                    {[{label:lang==='ar'?'حزب الانطلاق':'Hizb départ',key:'hizb_depart',max:60},
                      {label:lang==='ar'?'الثُّمن':'Tomon',key:'tomon_depart',max:8}
                    ].map(f=>(
                      <div key={f.key}>
                        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{f.label}</label>
                        <input type="number" min="0" max={f.max}
                          style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',boxSizing:'border-box'}}
                          value={editEleve?editEleve[f.key]||0:newEleve[f.key]}
                          onChange={e=>editEleve?setEditEleve(x=>({...x,[f.key]:e.target.value})):setNewEleve(x=>({...x,[f.key]:e.target.value}))}/>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{display:'flex',gap:8,marginTop:4}}>
                  <button onClick={()=>{setShowFormEleve(false);resetFormEleve();}}
                    style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    {lang==='ar'?'إلغاء':'Annuler'}
                  </button>
                  <button onClick={handleSaveEleve}
                    style={{flex:2,padding:'13px',background:mobileEditEleve?'#378ADD':'#1D9E75',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                    {mobileEditEleve?(lang==='ar'?'تحديث ✓':'Mettre à jour ✓'):(lang==='ar'?'حفظ':'Enregistrer')}
                  </button>
                </div>
              </div>
            )}

            {/* Recherche */}
            <input style={{width:'100%',padding:'12px 16px',borderRadius:12,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box',background:'#fff',marginBottom:8}}
              placeholder={lang==='ar'?'بحث عن طالب...':'Rechercher un élève...'}
              value={searchEleve||''} onChange={e=>setSearchEleve(e.target.value)}/>
            <div style={{fontSize:12,color:'#888',marginBottom:8,paddingLeft:4}}>
              {eleves.filter(e=>!searchEleve||`${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes((searchEleve||'').toLowerCase())).length} {lang==='ar'?'طالب':'élève(s)'}
            </div>

            {/* Liste élèves */}
            {eleves.filter(e=>!searchEleve||`${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes((searchEleve||'').toLowerCase())).map(e=>{
              const nc=getNC(e.code_niveau);
              const isSour=isSourateNiveauDyn(e.code_niveau,niveauxActifs||[]);
              const inst=instituteurs.find(i=>i.id===e.instituteur_referent_id);
              return(
                <div key={e.id} style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:10,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  <div onClick={()=>navigate('fiche',e,{tab})} style={{cursor:'pointer',width:40,height:40,borderRadius:'50%',background:`${nc}20`,color:nc,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0}}>
                    {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                  </div>
                  <div onClick={()=>navigate('fiche',e,{tab})} style={{flex:1,minWidth:0,cursor:'pointer'}}>
                    <div style={{fontWeight:700,fontSize:13}}>{e.prenom} {e.nom}</div>
                    <div style={{display:'flex',gap:5,marginTop:2,alignItems:'center',flexWrap:'wrap'}}>
                      <span style={{padding:'1px 6px',borderRadius:10,background:`${nc}20`,color:nc,fontSize:10,fontWeight:700}}>{e.code_niveau||'?'}</span>
                      {e.eleve_id_ecole&&<span style={{fontSize:10,color:'#bbb'}}>#{e.eleve_id_ecole}</span>}
                      {isSour&&e.sourates_acquises>0&&<span style={{fontSize:10,color:'#1D9E75',fontWeight:600}}>📖 {e.sourates_acquises}</span>}
                      {!isSour&&<span style={{fontSize:10,color:'#888'}}>H.{e.hizb_depart} T.{e.tomon_depart}</span>}
                    </div>
                    {(e.telephone||e.date_inscription)&&(
                      <div style={{display:'flex',gap:8,marginTop:2,fontSize:10,color:'#aaa'}}>
                        {e.telephone&&<span>📞 {e.telephone}</span>}
                        {e.date_inscription&&<span>📅 {new Date(e.date_inscription).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short'})}</span>}
                      </div>
                    )}
                  </div>
                  {user.role==='surveillant'&&(
                    <div style={{display:'flex',gap:5,flexShrink:0}}>
                      <button onClick={()=>startEditEleve(e)} style={{background:'#E6F1FB',color:'#378ADD',border:'none',borderRadius:8,padding:'7px 9px',fontSize:12,cursor:'pointer'}}>✏️</button>
                      <button onClick={()=>supprimerEleve(e.id)} style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,padding:'7px 9px',fontSize:12,cursor:'pointer'}}>🗑</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── ONGLET INSTITUTEURS ─── */}
        {tab==='instituteurs'&&(
          <div style={{padding:'12px'}}>
            {showFormInst&&user.role==='surveillant'&&(
              <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,border:'1.5px solid #378ADD'}}>
                <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>👨‍🏫 {lang==='ar'?'إضافة أستاذ':'Nouvel instituteur'}</div>
                {[{label:lang==='ar'?'الاسم':'Prénom',key:'prenom'},{label:lang==='ar'?'اللقب':'Nom',key:'nom'},{label:'Identifiant',key:'identifiant',ph:'ex: m.karim'}].map(f=>(
                  <FI key={f.key} label={f.label+' *'} val={newInst[f.key]} ph={f.ph||f.label}
                    onChange={e=>setNewInst(x=>({...x,[f.key]:e.target.value}))} required/>
                ))}
                <FI label={lang==='ar'?'كلمة المرور':'Mot de passe *'} val={newInst.mot_de_passe} type="password" ph="••••••••"
                  onChange={e=>setNewInst(x=>({...x,mot_de_passe:e.target.value}))}/>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setShowFormInst(false)} style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{lang==='ar'?'إلغاء':'Annuler'}</button>
                  <button onClick={async()=>{await ajouterInstituteur();setShowFormInst(false);}} style={{flex:2,padding:'13px',background:'#085041',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{lang==='ar'?'حفظ':'Enregistrer'}</button>
                </div>
              </div>
            )}
            {instituteurs.length===0?(
              <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12}}>
                <div style={{fontSize:36,marginBottom:10}}>👨‍🏫</div>
                <div style={{fontSize:14}}>{lang==='ar'?'لا يوجد أساتذة':'Aucun instituteur'}</div>
              </div>
            ):instituteurs.map(inst=>{
              const nb=eleves.filter(e=>e.instituteur_referent_id===inst.id).length;
              return(
                <div key={inst.id} style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:8,border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:42,height:42,borderRadius:'50%',background:'#E6F1FB',color:'#0C447C',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,flexShrink:0}}>
                    {((inst.prenom||'?')[0])+((inst.nom||'?')[0])}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14}}>{inst.prenom} {inst.nom}</div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>{inst.identifiant} · {nb} {lang==='ar'?'طالب':'élève(s)'}</div>
                  </div>
                  {user.role==='surveillant'&&(
                    <button onClick={()=>supprimerInstituteur(inst)} style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,padding:'8px 10px',fontSize:12,cursor:'pointer'}}>🗑</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── ONGLET PARENTS ─── */}
        {tab==='parents'&&(
          <div style={{padding:'12px'}}>
            {showFormParent&&user.role==='surveillant'&&(
              <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,border:`1.5px solid ${editingParentId?'#378ADD':'#EF9F27'}`}}>
                <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                  {editingParentId?(lang==='ar'?'تعديل ولي الأمر':'✏️ Modifier parent'):(lang==='ar'?'إضافة ولي أمر':'👨‍👩‍👦 Nouveau parent')}
                </div>
                {[{label:lang==='ar'?'الاسم':'Prénom',key:'prenom'},{label:lang==='ar'?'اللقب':'Nom',key:'nom'},{label:'Identifiant',key:'identifiant',ph:'parent.nom'},{label:lang==='ar'?'الهاتف':'Téléphone',key:'telephone',ph:'06xxxxxxxx',type:'tel'}].map(f=>(
                  <FI key={f.key} label={f.key==='telephone'?f.label:f.label+' *'} val={formParent[f.key]||''} ph={f.ph||f.label} type={f.type||'text'}
                    onChange={e=>setFormParent(x=>({...x,[f.key]:e.target.value}))}/>
                ))}
                {!editingParentId&&(
                  <FI label={lang==='ar'?'كلمة المرور *':'Mot de passe *'} val={formParent.mot_de_passe||''} type="password" ph="••••••••"
                    onChange={e=>setFormParent(x=>({...x,mot_de_passe:e.target.value}))}/>
                )}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'الأبناء المرتبطون':'Enfants liés'}</label>
                  {eleves.map(e=>{
                    const sel=(formParent.eleve_ids||[]).includes(e.id);
                    const nc=getNC(e.code_niveau);
                    return(
                      <div key={e.id} onClick={()=>{
                        const ids=formParent.eleve_ids||[];
                        setFormParent(x=>({...x,eleve_ids:sel?ids.filter(i=>i!==e.id):[...ids,e.id]}));
                      }} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',marginBottom:5,
                        borderRadius:10,background:sel?`${nc}10`:'#f9f9f6',border:`1px solid ${sel?nc:'#e0e0d8'}`,cursor:'pointer'}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:sel?nc:'#ddd',flexShrink:0}}/>
                        <div style={{flex:1,fontSize:13,fontWeight:sel?700:400}}>{e.prenom} {e.nom}</div>
                        <span style={{padding:'1px 6px',borderRadius:8,fontSize:10,background:`${nc}20`,color:nc,fontWeight:700}}>{e.code_niveau}</span>
                        {sel&&<span style={{color:nc,fontSize:14}}>✓</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{setShowFormParent(false);setEditingParentId(null);setFormParent({prenom:'',nom:'',identifiant:'',mot_de_passe:'',telephone:'',eleve_ids:[]});}}
                    style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{lang==='ar'?'إلغاء':'Annuler'}</button>
                  <button onClick={async()=>{
                    if(editingParentId) await modifierParent();
                    else await ajouterParent();
                    setShowFormParent(false);setEditingParentId(null);setFormParent({prenom:'',nom:'',identifiant:'',mot_de_passe:'',telephone:'',eleve_ids:[]});loadData();
                  }} style={{flex:2,padding:'13px',background:editingParentId?'#378ADD':'#EF9F27',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                    {lang==='ar'?'حفظ':'Enregistrer'}
                  </button>
                </div>
              </div>
            )}
            {parents.length===0?(
              <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12}}>
                <div style={{fontSize:36,marginBottom:10}}>👨‍👩‍👦</div>
                <div style={{fontSize:14}}>{lang==='ar'?'لا يوجد آباء':'Aucun parent'}</div>
              </div>
            ):parents.map(p=>{
              const enfants=eleves.filter(e=>(p.eleve_ids||[]).includes(e.id));
              return(
                <div key={p.id} style={{background:'#fff',borderRadius:12,padding:'13px 14px',marginBottom:8,border:'0.5px solid #e0e0d8'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:40,height:40,borderRadius:'50%',background:'#FAEEDA',color:'#EF9F27',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,flexShrink:0}}>
                      {((p.prenom||'?')[0])+((p.nom||'?')[0])}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13}}>{p.prenom} {p.nom}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:1}}>{p.telephone||p.identifiant}</div>
                    </div>
                    {user.role==='surveillant'&&(
                      <div style={{display:'flex',gap:5}}>
                        <button onClick={()=>{setEditingParentId(p.id);setFormParent({prenom:p.prenom,nom:p.nom,identifiant:p.identifiant,mot_de_passe:'',telephone:p.telephone||'',eleve_ids:eleves.filter(e=>(p.eleve_ids||[]).includes(e.id)).map(e=>e.id)});setShowFormParent(true);window.scrollTo(0,0);}}
                          style={{background:'#E6F1FB',color:'#378ADD',border:'none',borderRadius:8,padding:'6px 9px',fontSize:12,cursor:'pointer'}}>✏️</button>
                        <button onClick={async()=>{await supabase.from('utilisateurs').delete().eq('id',p.id);loadData();}}
                          style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,padding:'6px 9px',fontSize:12,cursor:'pointer'}}>🗑</button>
                      </div>
                    )}
                  </div>
                  {enfants.length>0&&(
                    <div style={{marginTop:8,display:'flex',gap:5,flexWrap:'wrap'}}>
                      {enfants.map(e=>{const nc=getNC(e.code_niveau);return(
                        <span key={e.id} style={{padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:`${nc}15`,color:nc}}>
                          {e.prenom} {e.nom}
                        </span>
                      );})}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── ONGLET JALONS/CERTIFICATS ─── */}
        {tab==='jalons'&&(
          <div style={{padding:'12px'}}>
            <div style={{fontSize:12,color:'#888',marginBottom:12,padding:'10px 12px',background:'#fff',borderRadius:10}}>
              {lang==='ar'?'تكوين المراحل التي تُمنح عندها شهادة للطالب تلقائياً':'Jalons déclenchant automatiquement un certificat'}
            </div>
            {user.role==='surveillant'&&(
              <div style={{background:'#fff',borderRadius:14,padding:'16px',marginBottom:14,border:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:14,fontWeight:700,color:'#534AB7',marginBottom:12}}>🏅 {lang==='ar'?'إضافة مرحلة':'Ajouter un jalon'}</div>
                <FI label={lang==='ar'?'اسم الشهادة *':'Nom certificat *'} val={newJalon.nom_ar}
                  ph={lang==='ar'?'مثال: شهادة إتمام الأحزاب':'Ex: Certificat Hizb 1-10'}
                  onChange={e=>setNewJalon({...newJalon,nom_ar:e.target.value})}/>
                {/* Type */}
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'نوع المرحلة':'Type'} *</label>
                  <div style={{display:'flex',gap:6}}>
                    {[{v:'hizb',l:'🕌 Hizb'},{v:'ensemble_sourates',l:'📖 '+( lang==='ar'?'سور':'Sourates')},{v:'examen',l:'📝 '+(lang==='ar'?'امتحان':'Examen')}].map(opt=>(
                      <div key={opt.v} onClick={()=>setNewJalon({...newJalon,type_jalon:opt.v,hizb_ids:[],ensemble_id:'',examen_id:''})}
                        style={{flex:1,padding:'8px 4px',borderRadius:10,textAlign:'center',cursor:'pointer',fontSize:11,fontWeight:600,
                          border:`2px solid ${newJalon.type_jalon===opt.v?'#534AB7':'#e0e0d8'}`,
                          background:newJalon.type_jalon===opt.v?'#EEEDFE':'#fff',
                          color:newJalon.type_jalon===opt.v?'#534AB7':'#666'}}>
                        {opt.l}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Condition */}
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'شرط الحصول':'Condition'} *</label>
                  <div style={{display:'flex',gap:6}}>
                    {[{v:'cumul',icon:'📚',l:lang==='ar'?'تراكمي':'Cumulatif'},{v:'cumul_puis_examen',icon:'🎯',l:lang==='ar'?'تراكمي+امتحان':'Cumul+examen'}].map(opt=>(
                      <div key={opt.v} onClick={()=>setNewJalon({...newJalon,condition_obtention:opt.v})}
                        style={{flex:1,padding:'10px 8px',borderRadius:10,textAlign:'center',cursor:'pointer',
                          border:`2px solid ${newJalon.condition_obtention===opt.v?'#534AB7':'#e0e0d8'}`,
                          background:newJalon.condition_obtention===opt.v?'#EEEDFE':'#fff'}}>
                        <div style={{fontSize:18,marginBottom:3}}>{opt.icon}</div>
                        <div style={{fontSize:10,fontWeight:600,color:newJalon.condition_obtention===opt.v?'#534AB7':'#666'}}>{opt.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Examen final si cumul_puis_examen */}
                {newJalon.condition_obtention==='cumul_puis_examen'&&(
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'الامتحان الختامي *':'Examen final *'}</label>
                    <select style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
                      value={newJalon.examen_final_id||''} onChange={e=>setNewJalon({...newJalon,examen_final_id:e.target.value})}>
                      <option value="">{lang==='ar'?'— اختر —':'— Choisir —'}</option>
                      {(examensDisp||[]).map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
                    </select>
                  </div>
                )}
                {/* Hizb selector */}
                {newJalon.type_jalon==='hizb'&&(
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>
                      {lang==='ar'?'الأحزاب المطلوبة':'Hizb requis'} *
                      {newJalon.hizb_ids.length>0&&<span style={{color:'#1D9E75',marginRight:6}}> ({newJalon.hizb_ids.length})</span>}
                    </label>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4}}>
                      {(() => {
                        const sensEcole = ecoleConfig?.sens_recitation_defaut || 'desc';
                        const hizbList = sensEcole === 'asc'
                          ? Array.from({length:60},(_,i)=>i+1)
                          : Array.from({length:60},(_,i)=>60-i);
                        return hizbList.map(n=>{
                        const sel=(newJalon.hizb_ids||[]).includes(n);
                        return(
                          <div key={n} onClick={()=>{const ids=newJalon.hizb_ids||[];setNewJalon({...newJalon,hizb_ids:sel?ids.filter(h=>h!==n):[...ids,n]});}}
                            style={{borderRadius:6,padding:'5px 2px',textAlign:'center',cursor:'pointer',fontSize:10,fontWeight:700,
                              background:sel?'#085041':'#f0f0ec',color:sel?'#fff':'#888',border:`0.5px solid ${sel?'#085041':'#e0e0d8'}`}}>
                            {n}
                          </div>
                        );
                      });
                      })()}
                    </div>
                  </div>
                )}
                {/* Ensemble sourates */}
                {newJalon.type_jalon==='ensemble_sourates'&&(
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'مجموعة السور *':'Ensemble *'}</label>
                    <select style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
                      value={newJalon.ensemble_id} onChange={e=>setNewJalon({...newJalon,ensemble_id:e.target.value})}>
                      <option value="">{lang==='ar'?'— اختر مجموعة —':'— Choisir —'}</option>
                      {(ensemblesDisp||[]).map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
                    </select>
                  </div>
                )}
                {/* Examen direct */}
                {newJalon.type_jalon==='examen'&&(
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'الامتحان *':'Examen *'}</label>
                    <select style={{width:'100%',padding:'11px 12px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
                      value={newJalon.examen_id} onChange={e=>setNewJalon({...newJalon,examen_id:e.target.value})}>
                      <option value="">{lang==='ar'?'— اختر امتحاناً —':'— Choisir —'}</option>
                      {(examensDisp||[]).map(e=><option key={e.id} value={e.id}>{e.nom}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={async()=>{
                  setSavingJalon(true);
                  const payload={ecole_id:user.ecole_id,nom:newJalon.nom_ar.trim(),nom_ar:newJalon.nom_ar.trim(),
                    type_jalon:newJalon.type_jalon,hizb_ids:newJalon.type_jalon==='hizb'?newJalon.hizb_ids:null,
                    ensemble_id:newJalon.type_jalon==='ensemble_sourates'?newJalon.ensemble_id:null,
                    examen_id:newJalon.type_jalon==='examen'?newJalon.examen_id:null,
                    condition_obtention:newJalon.condition_obtention||'cumul',
                    examen_final_id:newJalon.condition_obtention==='cumul_puis_examen'?(newJalon.examen_final_id||null):null,
                    actif:true};
                  await supabase.from('jalons').insert(payload);
                  const {data}=await supabase.from('jalons').select('*').eq('ecole_id',user.ecole_id).order('created_at');
                  if(data)setJalons(data);
                  setNewJalon({nom_ar:'',type_jalon:'hizb',hizb_ids:[],ensemble_id:'',examen_id:'',condition_obtention:'cumul',examen_final_id:'',description_condition:''});
                  setSavingJalon(false);
                  showMsg('success',lang==='ar'?'تمت إضافة المرحلة':'Jalon ajouté !');
                }} disabled={savingJalon}
                  style={{width:'100%',padding:'13px',background:'#085041',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                  {savingJalon?'...':(lang==='ar'?'إضافة المرحلة':'Ajouter le jalon')}
                </button>
              </div>
            )}
            {/* Liste jalons */}
            {jalons.length===0?(
              <div style={{textAlign:'center',color:'#aaa',padding:'2rem',background:'#fff',borderRadius:12}}>
                <div style={{fontSize:32,marginBottom:8}}>🏅</div>
                <div style={{fontSize:13}}>{lang==='ar'?'لا توجد مراحل بعد':'Aucun jalon'}</div>
              </div>
            ):jalons.map(j=>(
              <div key={j.id} style={{background:'#fff',borderRadius:12,padding:'13px 14px',marginBottom:8,border:'0.5px solid #e0e0d8',opacity:j.actif?1:0.5}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:22}}>{j.type_jalon==='examen'?'📝':'🏅'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,direction:'rtl',fontFamily:"'Tajawal',Arial,sans-serif"}}>{j.nom_ar||j.nom}</div>
                    <div style={{fontSize:10,color:'#EF9F27',marginTop:2,fontWeight:600}}>
                      {j.type_jalon==='hizb'?`Hizb: ${(j.hizb_ids||[]).sort((a,b)=>a-b).join(', ')}`
                        :j.type_jalon==='ensemble_sourates'?`📖 ${(ensemblesDisp||[]).find(e=>e.id===j.ensemble_id)?.nom||'—'}`
                        :`📝 ${(examensDisp||[]).find(e=>e.id===j.examen_id)?.nom||'—'}`}
                    </div>
                    <span style={{display:'inline-block',marginTop:3,padding:'1px 7px',borderRadius:10,fontSize:9,fontWeight:600,
                      background:j.condition_obtention==='cumul_puis_examen'?'#EEEDFE':'#E1F5EE',
                      color:j.condition_obtention==='cumul_puis_examen'?'#534AB7':'#085041'}}>
                      {j.condition_obtention==='cumul_puis_examen'?(lang==='ar'?'🎯 تراكمي+امتحان':'🎯 Cumul+examen'):(lang==='ar'?'📚 تراكمي':'📚 Cumulatif')}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={async()=>{await supabase.from('jalons').update({actif:!j.actif}).eq('id',j.id);setJalons(prev=>prev.map(x=>x.id===j.id?{...x,actif:!x.actif}:x));}}
                      style={{padding:'5px 8px',borderRadius:6,fontSize:10,fontWeight:600,cursor:'pointer',border:'none',
                        background:j.actif?'#E1F5EE':'#f0f0ec',color:j.actif?'#085041':'#888'}}>
                      {j.actif?(lang==='ar'?'نشط':'Actif'):(lang==='ar'?'غير نشط':'Inactif')}
                    </button>
                    <button onClick={async()=>{await supabase.from('jalons').delete().eq('id',j.id);setJalons(prev=>prev.filter(x=>x.id!==j.id));}}
                      style={{padding:'5px 7px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'none',cursor:'pointer',fontSize:11}}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── ONGLET PASSAGE NIVEAU ─── */}
        {tab==='passage_niveau'&&(
          <div style={{padding:'12px'}}>
            <div style={{background:'#E1F5EE',borderRadius:12,padding:'12px',marginBottom:12,fontSize:12,color:'#085041'}}>
              ℹ️ {lang==='ar'
                ?'عند تغيير مستوى طالب، يبحث النظام عن قاعدة مطابقة ويطبق موقع الانطلاق المحدد تلقائياً.'
                :"Lors du changement de niveau, le système applique automatiquement la règle configurée."}
            </div>
            <MobilePassageNiveauTab user={user} lang={lang} niveaux={niveauxActifs||[]} showMsg={showMsg}/>
          </div>
        )}

        {/* ─── LIENS VERS PAGES DÉDIÉES ─── */}
        {tab==='bareme'&&(
          <div style={{padding:'12px'}}>
            <BaremeTab user={user} lang={lang} bareme={bareme} setBareme={setBareme} saving={savingBareme} setSaving={setSavingBareme} showMsg={showMsg}/>
          </div>
        )}


      </div>
    );
  }

  return (
    <div>
      <div className="page-title">{t(lang, 'gestion')}</div>
      {msg.text && <div className={msg.type === 'error' ? 'error-box' : 'success-box'}>{msg.text}</div>}



      {tab === 'parametres' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
          {[
            {icon:'📚', label:lang==='ar'?'المستويات':'Niveaux',
             desc:lang==='ar'?'إدارة مستويات المدرسة وألوانها':"Configurer les niveaux de l'école",
             action:()=>navigate('niveaux',null,{tab}), color:'#085041', bg:'#E1F5EE'},
            {icon:'📦', label:lang==='ar'?'مجموعات السور':'Ensembles',
             desc:lang==='ar'?'تجميع السور في مجموعات':'Grouper les sourates par ensemble',
             action:()=>navigate('ensembles',null,{tab}), color:'#D85A30', bg:'#FAECE7'},
            {icon:'⭐', label:lang==='ar'?'النقاط':'Barème',
             desc:lang==='ar'?'تحديد نظام التنقيط لكل معيار':'Paramétrer les points par critère',
             action:()=>setTab('bareme'), color:'#EF9F27', bg:'#FAEEDA'},
            {icon:'📝', label:lang==='ar'?'الامتحانات':'Examens',
             desc:lang==='ar'?'تكوين الامتحانات والحدود':'Configurer les examens et seuils',
             action:()=>navigate('examens',null,{tab}), color:'#378ADD', bg:'#E6F1FB'},
            {icon:'🏅', label:lang==='ar'?'الشهادات':'Jalons',
             desc:lang==='ar'?'تكوين مراحل منح الشهادات':'Configurer les jalons certificats',
             action:()=>setTab('jalons'), color:'#534AB7', bg:'#EEEDFE'},
            {icon:'👨‍🏫', label:lang==='ar'?'الأساتذة':'Instituteurs',
             desc:lang==='ar'?'إدارة حسابات الأساتذة':'Gérer les comptes instituteurs',
             action:()=>setTab('instituteurs'), color:'#378ADD', bg:'#E6F1FB'},
            {icon:'👨‍🎓', label:lang==='ar'?'الطلاب':'Élèves',
             desc:lang==='ar'?'إدارة قائمة الطلاب وإضافتهم':'Gérer et ajouter les élèves',
             action:()=>setTab('eleves'), color:'#1D9E75', bg:'#E1F5EE'},
            {icon:'👨‍👩‍👦', label:lang==='ar'?'الآباء':'Parents',
             desc:lang==='ar'?'إدارة حسابات أولياء الأمور':'Gérer les comptes parents',
             action:()=>setTab('parents'), color:'#534AB7', bg:'#EEEDFE'},
            {icon:'🎓', label:lang==='ar'?'قواعد الانتقال':'Règles passage',
             desc:lang==='ar'?'تكوين قواعد انتقال الطلاب بين المستويات':'Configurer les règles de passage de niveau',
             action:()=>setTab('passage_niveau'), color:'#1D9E75', bg:'#E1F5EE'},
            {icon:'🔄', label:lang==='ar'?'اتجاه التحفيظ':'Sens de récitation',
             desc:lang==='ar'?'تحديد اتجاه الحفظ للمستويات (تنازلي / تصاعدي)':'Définir le sens (décroissant / croissant) par niveau',
             action:()=>setTab('sens_recitation'), color:'#085041', bg:'#E1F5EE'},
            {icon:'📥', label:lang==='ar'?'استيراد جماعي':'Import en masse',
             desc:lang==='ar'?'استيراد المستويات والطلاب والمدرسين والآباء من ملف Excel':'Importer niveaux, élèves, instituteurs, parents depuis Excel',
             action:()=>navigate('import_masse',null,{tab}), color:'#EF9F27', bg:'#FAEEDA'},

          ].map((item,idx)=>(
            <div key={idx} onClick={item.action}
              style={{background:'#fff',borderRadius:14,padding:'1.1rem',
                border:`0.5px solid ${item.color}25`,cursor:'pointer',
                display:'flex',alignItems:'center',gap:12,
                transition:'all 0.15s',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)';}}>
              <div style={{width:48,height:48,borderRadius:12,background:item.bg,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:22,flexShrink:0}}>
                {item.icon}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:'#1a1a1a',marginBottom:3}}>{item.label}</div>
                <div style={{fontSize:11,color:'#999',lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.desc}</div>
              </div>
              <span style={{color:item.color,fontSize:16,flexShrink:0}}>›</span>
            </div>
          ))}
        </div>
      )}

      {tab !== 'parametres' && tab !== '' && (
        <button onClick={()=>setTab('parametres')} className="back-link" style={{marginBottom:'0.75rem'}}>
          {lang==='ar'?'← الرئيسية':'← Accueil الإدارة'}
        </button>
      )}
      {tab === 'eleves' && (
        <div>
          {/* Formulaire ajout / modification */}
          {!editEleve ? (
            <>
              <div className="section-label">{t(lang, 'ajouter_eleve')}</div>
              <div className="card">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 20px'}}>
                  {/* Ligne 1 : Prénom + Nom */}
                  <div className="field-group">
                    <label className="field-lbl">{t(lang,'prenom')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={newEleve.prenom} onChange={e=>setNewEleve({...newEleve,prenom:e.target.value})} placeholder={t(lang,'prenom')}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang,'nom_label')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={newEleve.nom} onChange={e=>setNewEleve({...newEleve,nom:e.target.value})} placeholder={t(lang,'nom_label')}/>
                  </div>
                  {/* Ligne 2 : Niveau + Niveau scolaire */}
                  <div className="field-group">
                    <label className="field-lbl">{t(lang,'niveau')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={newEleve.niveau} onChange={e=>setNewEleve({...newEleve,niveau:e.target.value})}>
                      <option value="Débutant">{lang==='ar'?'مبتدئ':'Débutant'}</option>
                      <option value="Intermédiaire">{lang==='ar'?'متوسط':'Intermédiaire'}</option>
                      <option value="Avancé">{lang==='ar'?'متقدم':'Avancé'}</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المستوى الدراسي':'Niveau scolaire'} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={newEleve.code_niveau} onChange={e=>setNewEleve({...newEleve,code_niveau:e.target.value})}>
                      {niveauxActifs.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
                    </select>
                  </div>
                  {/* Ligne 3 : ID + Référent */}
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم تعريف الطالب':'ID Élève'} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={newEleve.eleve_id_ecole} onChange={e=>setNewEleve({...newEleve,eleve_id_ecole:e.target.value})} placeholder={lang==='ar'?'رقم التعريف':'ID défini par la direction'}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang,'referent')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={newEleve.instituteur_referent_id} onChange={e=>setNewEleve({...newEleve,instituteur_referent_id:e.target.value})}>
                      <option value="">{t(lang,'choisir')}</option>
                      {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                    </select>
                  </div>
                  {/* Ligne 4 : Téléphone parent + Date inscription */}
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'هاتف ولي الأمر (اختياري)':lang==='en'?'Parent phone (optional)':'Tél. parent (optionnel)'}</label>
                    <input className="field-input" type="tel" value={newEleve.telephone||''} onChange={e=>setNewEleve({...newEleve,telephone:e.target.value})} placeholder="06XXXXXXXX"/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'تاريخ التسجيل (اختياري)':lang==='en'?'Enrollment date (optional)':"Date d'inscription (optionnel)"}</label>
                    <input className="field-input" type="date" value={newEleve.date_inscription||''} onChange={e=>setNewEleve({...newEleve,date_inscription:e.target.value})}/>
                  </div>
                </div>

                {/* Acquis antérieurs */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label className="field-lbl" style={{ margin: 0 }}>{t(lang, 'acquis_anterieurs')}</label>
                    <button onClick={() => setShowAcquisSelector(!showAcquisSelector)}
                      style={{ padding: '4px 12px', border: '0.5px solid #e0e0d8', borderRadius: 6, background: showAcquisSelector ? '#E1F5EE' : '#fff', fontSize: 11, cursor: 'pointer', color: showAcquisSelector ? '#085041' : '#666' }}>
                      {showAcquisSelector ? '▲ Réduire' : `▼ Hizb ${newEleve.hizb_depart}, T.${newEleve.tomon_depart}`}
                    </button>
                  </div>
                  {showAcquisSelector && (
                    <AcquisSelector
                      codeNiveau={newEleve.code_niveau} niveauxDyn={niveauxDyn}
                      hizb={newEleve.hizb_depart} tomon={newEleve.tomon_depart} lang={lang}
                      sens={(niveauxDyn.find(n=>n.code===newEleve.code_niveau)?.sens_recitation) || ecoleConfig?.sens_recitation_defaut || 'desc'}
                      programmeNiveau={programmesParNiveau[newEleve.code_niveau] || []}
                      onHizbChange={h => setNewEleve({ ...newEleve, hizb_depart: h })}
                      onTomonChange={tv => setNewEleve({ ...newEleve, tomon_depart: tv })}
                      souratesAcquises={newEleve.sourates_acquises}
                      onSouratesChange={n => setNewEleve({ ...newEleve, sourates_acquises: n })}
                    />
                  )}
                </div>

                <div style={{fontSize:11,color:'#888',marginBottom:8}}>
                  <span style={{color:'#E24B4A'}}>*</span> {lang==='ar'?'حقول إلزامية':lang==='en'?'Required fields':'Champs obligatoires'}
                </div>
                <button className="btn-primary" onClick={ajouterEleve}>{t(lang, 'ajouter_eleve_btn')}</button>
              </div>
            </>
          ) : (
            <>
              <div className="section-label">{t(lang, 'modifier_eleve')}</div>
              <div className="card">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 20px'}}>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang,'prenom')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={editEleve.prenom} onChange={e=>setEditEleve({...editEleve,prenom:e.target.value})}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang,'nom_label')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={editEleve.nom} onChange={e=>setEditEleve({...editEleve,nom:e.target.value})}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang,'niveau')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={editEleve.niveau} onChange={e=>setEditEleve({...editEleve,niveau:e.target.value})}>
                      <option value="Débutant">{lang==='ar'?'مبتدئ':'Débutant'}</option>
                      <option value="Intermédiaire">{lang==='ar'?'متوسط':'Intermédiaire'}</option>
                      <option value="Avancé">{lang==='ar'?'متقدم':'Avancé'}</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المستوى الدراسي':'Niveau scolaire'} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={editEleve.code_niveau||'1'} onChange={e=>{
                      const oldNiv=editEleve.code_niveau||'1'; const newNiv=e.target.value;
                      const wasSourate=['5B','5A','2M'].includes(oldNiv);
                      const isNowHizb=!['5B','5A'].includes(newNiv)&&niveauxActifs.find(n=>n.code===newNiv)?.type!=='sourate';
                      if(wasSourate&&isNowHizb){
                        showConfirm(lang==='ar'?'⚠️ تغيير نظام الطالب':'⚠️ Changement de système',
                          lang==='ar'?'هذا الطالب ينتقل من نظام السور إلى نظام الحزب والثُّمن.':'Cet élève passe du système Sourates au système Hizb/Tomon.',
                          ()=>{setEditEleve({...editEleve,code_niveau:newNiv,hizb_depart:0,tomon_depart:1,sourates_acquises:0});setEditShowAcquisSelector(true);hideConfirm();},
                          lang==='ar'?'متابعة':'Continuer','#EF9F27');
                      } else { setEditEleve({...editEleve,code_niveau:newNiv}); }
                    }}>
                      {niveauxActifs.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم تعريف الطالب':'ID Élève'} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={editEleve.eleve_id_ecole||''} onChange={e=>setEditEleve({...editEleve,eleve_id_ecole:e.target.value})} placeholder={lang==='ar'?'رقم التعريف':'ID élève'}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang,'referent')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={editEleve.instituteur_referent_id||''} onChange={e=>setEditEleve({...editEleve,instituteur_referent_id:e.target.value})}>
                      <option value="">{t(lang,'choisir')}</option>
                      {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'هاتف ولي الأمر (اختياري)':'Tél. parent (optionnel)'}</label>
                    <input className="field-input" type="tel" value={editEleve.telephone||''} onChange={e=>setEditEleve({...editEleve,telephone:e.target.value})} placeholder="06XXXXXXXX"/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'تاريخ التسجيل (اختياري)':"Date d'inscription (optionnel)"}</label>
                    <input className="field-input" type="date" value={editEleve.date_inscription||''} onChange={e=>setEditEleve({...editEleve,date_inscription:e.target.value})}/>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label className="field-lbl" style={{ margin: 0 }}>{t(lang, 'acquis_anterieurs')}</label>
                    <button onClick={() => setEditShowAcquisSelector(!editShowAcquisSelector)}
                      style={{ padding: '4px 12px', border: '0.5px solid #e0e0d8', borderRadius: 6, background: editShowAcquisSelector ? '#E1F5EE' : '#fff', fontSize: 11, cursor: 'pointer', color: editShowAcquisSelector ? '#085041' : '#666' }}>
                      {editShowAcquisSelector ? '▲ Réduire' : `▼ Hizb ${editEleve.hizb_depart}, T.${editEleve.tomon_depart}`}
                    </button>
                  </div>
                  {editShowAcquisSelector && (
                    <AcquisSelector
                      codeNiveau={editEleve.code_niveau||'1'} niveauxDyn={niveauxDyn}
                      hizb={editEleve.hizb_depart} tomon={editEleve.tomon_depart} lang={lang}
                      sens={(niveauxDyn.find(n=>n.code===editEleve.code_niveau)?.sens_recitation) || ecoleConfig?.sens_recitation_defaut || 'desc'}
                      programmeNiveau={programmesParNiveau[editEleve.code_niveau] || []}
                      onHizbChange={h => setEditEleve({ ...editEleve, hizb_depart: h })}
                      onTomonChange={tv => setEditEleve({ ...editEleve, tomon_depart: tv })}
                      souratesAcquises={editEleve.sourates_acquises||0}
                      onSouratesChange={n => setEditEleve({ ...editEleve, sourates_acquises: n })}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={modifierEleve}>{t(lang, 'enregistrer_modifications')}</button>
                  <button className="btn-secondary" onClick={() => { setEditEleve(null); setEditShowAcquisSelector(false); }}>{t(lang, 'annuler')}</button>
                </div>
              </div>
            </>
          )}

          {/* Liste élèves */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
            <div className="section-label" style={{margin:0}}>{t(lang, 'eleves_inscrits')} ({eleves.length})</div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={exportElevesExcel}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#f5f5f0',
                  color:'#085041',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                📊 Excel
              </button>
              <button onClick={exportElevesPDF}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#f5f5f0',
                  color:'#534AB7',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                🖨️ PDF
              </button>
            </div>
          </div>
          {loading ? <div className="loading">...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{width:'20%'}}>{t(lang,'eleve')}</th>
                  <th style={{width:'11%'}}>{lang==='ar'?'المستوى':'Niveau'}</th>
                  <th style={{width:'14%'}}>{t(lang,'referent')}</th>
                  <th style={{width:'14%'}}>{lang==='ar'?'المكتسبات':'Acquis'}</th>
                  <th style={{width:'14%'}}>{lang==='ar'?'هاتف ولي الأمر':'Tél. parent'}</th>
                  <th style={{width:'13%'}}>{lang==='ar'?'تاريخ التسجيل':'Inscription'}</th>
                  <th style={{width:'14%'}}></th>
                </tr></thead>
                <tbody>
                  {eleves.length === 0 && <tr><td colSpan={5} className="empty">{t(lang, 'aucun_eleve')}</td></tr>}
                  {eleves.map(e => {
                    const nc = (niveauxDyn||[]).find(n=>n.code===e.code_niveau)?.couleur || {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[e.code_niveau]||'#888';
                    const isSour = (niveauxDyn||[]).find(n=>n.code===e.code_niveau)?.type==='sourate' || ['5B','5A','2M'].includes(e.code_niveau||'');
                    const niv = e.niveau==='Avancé'||e.niveau==='متقدم' ? {label:lang==='ar'?'متقدم':'Avancé',bg:'#E1F5EE',color:'#085041'} : e.niveau==='Intermédiaire'||e.niveau==='متوسط' ? {label:lang==='ar'?'متوسط':'Interm.',bg:'#E6F1FB',color:'#378ADD'} : {label:lang==='ar'?'مبتدئ':'Débutant',bg:'#FAEEDA',color:'#EF9F27'};
                    return (
                    <tr key={e.id} style={{background:editEleve?.id===e.id?'#E1F5EE':'#fff',borderBottom:'0.5px solid #f0f0ec'}}>
                      {/* Élève */}
                      <td style={{padding:'8px 12px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:32,height:32,borderRadius:'50%',background:`${nc}20`,color:nc,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11,flexShrink:0}}>
                            {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                          </div>
                          <div>
                            <div style={{fontWeight:600,fontSize:13}}>{e.prenom} {e.nom}</div>
                            {e.eleve_id_ecole&&<div style={{fontSize:10,color:'#bbb'}}>#{e.eleve_id_ecole}</div>}
                          </div>
                        </div>
                      </td>
                      {/* Niveau */}
                      <td style={{padding:'8px 12px'}}>
                        <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'flex-start'}}>
                          <span style={{padding:'1px 7px',borderRadius:20,fontSize:11,fontWeight:700,background:`${nc}20`,color:nc}}>{e.code_niveau||'?'}</span>
                          <span style={{padding:'1px 6px',borderRadius:20,fontSize:9,fontWeight:500,background:niv.bg,color:niv.color}}>{niv.label}</span>
                        </div>
                      </td>
                      {/* Référent */}
                      <td style={{fontSize:11,color:'#555',padding:'8px 12px'}}>{instNom(e.instituteur_referent_id)}</td>
                      {/* Acquis */}
                      <td style={{padding:'8px 12px'}}>
                        {isSour
                          ? <div style={{fontSize:11,fontWeight:600,color:'#1D9E75'}}>📖 {e.sourates_acquises||0}<div style={{fontSize:9,color:'#aaa',fontWeight:400}}>{lang==='ar'?'سور':'sourates'}</div></div>
                          : <div style={{fontSize:11,color:'#534AB7',fontWeight:600}}>H.{e.hizb_depart}<div style={{fontSize:9,color:'#888',fontWeight:400}}>T.{e.tomon_depart}</div></div>
                        }
                      </td>
                      {/* Téléphone */}
                      <td style={{padding:'8px 12px'}}>
                        {e.telephone
                          ? <div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#555'}}>
                              <span>📞</span><span>{e.telephone}</span>
                            </div>
                          : <span style={{fontSize:10,color:'#ddd'}}>—</span>
                        }
                      </td>
                      {/* Date inscription */}
                      <td style={{padding:'8px 12px'}}>
                        {e.date_inscription
                          ? <div style={{fontSize:11,color:'#555'}}>
                              <div>📅 {new Date(e.date_inscription).toLocaleDateString(lang==='ar'?'ar-MA':'fr-FR',{day:'2-digit',month:'short'})}</div>
                              <div style={{fontSize:9,color:'#aaa'}}>{new Date(e.date_inscription).getFullYear()}</div>
                            </div>
                          : <span style={{fontSize:10,color:'#ddd'}}>—</span>
                        }
                      </td>
                      {/* Actions */}
                      <td style={{padding:'8px 10px'}}>
                        <div style={{display:'flex',gap:4}}>
                          <button onClick={()=>{setEditEleve({...e});setEditShowAcquisSelector(false);window.scrollTo(0,0);}}
                            style={{padding:'4px 8px',background:'#E6F1FB',color:'#378ADD',border:'none',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>
                            ✏️ {t(lang,'modifier_btn')}
                          </button>
                          <button onClick={()=>supprimerEleve(e.id)}
                            style={{padding:'4px 7px',background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:6,cursor:'pointer',fontSize:12}}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'instituteurs' && (
        <div>
          <div className="section-label">{t(lang, 'ajouter_instituteur')}</div>
          <div className="card">
            <div className="form-grid">
              <div className="field-group"><label className="field-lbl">{t(lang, 'prenom')}</label><input className="field-input" value={newInst.prenom} onChange={e => setNewInst({...newInst,prenom:e.target.value})} placeholder={t(lang,'prenom')}/></div>
              <div className="field-group"><label className="field-lbl">{t(lang, 'nom_label')}</label><input className="field-input" value={newInst.nom} onChange={e => setNewInst({...newInst,nom:e.target.value})} placeholder={t(lang,'nom_label')}/></div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'المعرّف (مولَّد تلقائياً)':'Login (généré automatiquement)'}</label>
                <div className="field-input" style={{background:'#f5f5f0',color:'#085041',fontWeight:600,cursor:'default'}}>
                  {newInst.prenom&&newInst.nom
                    ? (()=>{
                      const norm=s=>{const l=s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');return l.length>=2?l:s.trim().replace(/\s+/g,'_').toLowerCase();};
                      return norm(newInst.prenom)+'_'+norm(newInst.nom);
                    })()
                    : <span style={{color:'#aaa',fontStyle:'italic'}}>{lang==='ar'?'أدخل الاسم واللقب أولاً':'Saisir prénom et nom dabord'}</span>}
                </div>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'كلمة السر (اتركها فارغة للمرور الافتراضي)':'Mot de passe (vide = MDP par défaut)'}</label>
                <input className="field-input" type="password" value={newInst.mot_de_passe} onChange={e => setNewInst({...newInst,mot_de_passe:e.target.value})} placeholder="••••••••"/>
              </div>
            </div>
            <button className="btn-primary" onClick={ajouterInstituteur}>{t(lang, 'ajouter_instituteur_btn')}</button>
          </div>

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem'}}>
            <div className="section-label" style={{margin:0}}>{t(lang, 'instituteurs_actifs')} ({instituteurs.length})</div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={exportInstituteursExcel}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#f5f5f0',
                  color:'#085041',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                📊 Excel
              </button>
              <button onClick={exportInstituteursPDF}
                style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#f5f5f0',
                  color:'#534AB7',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                🖨️ PDF
              </button>
            </div>
          </div>
          {loading ? <div className="loading">...</div> : (
            <>{editInstituteur && (
              <div style={{background:'#fff',border:'1.5px solid #378ADD',borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
                <div style={{fontSize:13,fontWeight:600,color:'#378ADD',marginBottom:'0.75rem'}}>✏️ {lang==='ar'?'تعديل الأستاذ':'Modifier instituteur'}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div className="field-group"><label className="field-lbl">{lang==='ar'?'الاسم':'Prénom'}</label><input className="field-input" value={formEditInst.prenom} onChange={e=>setFormEditInst(f=>({...f,prenom:e.target.value}))}/></div>
                  <div className="field-group"><label className="field-lbl">{lang==='ar'?'اللقب':'Nom'}</label><input className="field-input" value={formEditInst.nom} onChange={e=>setFormEditInst(f=>({...f,nom:e.target.value}))}/></div>
                  <div className="field-group"><label className="field-lbl">{lang==='ar'?'المعرف':'Identifiant'}</label><input className="field-input" value={formEditInst.identifiant} onChange={e=>setFormEditInst(f=>({...f,identifiant:e.target.value}))}/></div>
                  <div className="field-group"><label className="field-lbl">{lang==='ar'?'كلمة المرور (اتركها فارغة إن لم تغيرها)':'Mot de passe (vide = inchangé)'}</label><input className="field-input" type="password" value={formEditInst.mot_de_passe} onChange={e=>setFormEditInst(f=>({...f,mot_de_passe:e.target.value}))}/></div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn-primary" style={{width:'auto',padding:'7px 16px',fontSize:12}} onClick={async()=>{
                    const upd={prenom:formEditInst.prenom,nom:formEditInst.nom,identifiant:formEditInst.identifiant};
                    if(formEditInst.mot_de_passe) upd.mot_de_passe=formEditInst.mot_de_passe;
                    await supabase.from('utilisateurs').update(upd).eq('id',editInstituteur);
                    setEditInstituteur(null);
                    showMsg('success',lang==='ar'?'تم تحديث بيانات الأستاذ':'Instituteur mis à jour');
                    loadData();
                  }}>✓ {lang==='ar'?'حفظ':'Enregistrer'}</button>
                  <button onClick={()=>setEditInstituteur(null)} style={{padding:'7px 14px',border:'0.5px solid #e0e0d8',borderRadius:8,background:'#fff',fontSize:12,cursor:'pointer'}}>✕ {lang==='ar'?'إلغاء':'Annuler'}</button>
                </div>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{width:'40%'}}>{t(lang, 'nom_label')}</th>
                  <th style={{width:'40%'}}>{t(lang, 'identifiant_label')}</th>
                  <th style={{width:'20%'}}></th>
                </tr></thead>
                <tbody>
                  {instituteurs.length === 0 && <tr><td colSpan={3} className="empty">{t(lang, 'aucun_instituteur')}</td></tr>}
                  {instituteurs.map(i => (
                    <tr key={i.id}>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={i.prenom} nom={i.nom}/>{i.prenom} {i.nom}</div></td>
                      <td style={{fontSize:12,color:'#888'}}>{i.identifiant}</td>
                      <td style={{display:'flex',gap:4,alignItems:'center',padding:'8px 4px'}}>
                        <button onClick={()=>{setEditInstituteur(i.id);setFormEditInst({prenom:i.prenom,nom:i.nom,identifiant:i.identifiant,mot_de_passe:''});}}
                          style={{padding:'4px 10px',background:'#E6F1FB',color:'#378ADD',border:'0.5px solid #378ADD30',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏️ {lang==='ar'?'تعديل':'Modifier'}</button>
                        <button className="action-btn danger" onClick={() => supprimerInstituteur(i)}>{t(lang, 'retirer')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {tab === 'parents' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'1rem'}}>
            <button className="btn-primary" style={{width:'auto',padding:'8px 16px',fontSize:13}} onClick={()=>setShowFormParent(v=>!v)}>
              {showFormParent?'✕':'+  '}{lang==='ar'?'إضافة ولي أمر':'Ajouter un parent'}
            </button>
          </div>

          {showFormParent&&(
            <div style={{background:'#fff',border:'1.5px solid #1D9E75',borderRadius:16,padding:'1.5rem',marginBottom:'1.25rem'}}>
              <div style={{fontSize:14,fontWeight:600,color:'#085041',marginBottom:'1rem'}}>
                {editingParentId?'✏️':'👨‍👩‍👦'} {editingParentId?(lang==='ar'?'تعديل ولي الأمر':'Modifier le parent'):(lang==='ar'?'إضافة ولي أمر جديد':'Nouveau parent')}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div className="field-group"><label className="field-lbl">{lang==='ar'?'الاسم':'Prénom'} *</label><input className="field-input" value={formParent.prenom} onChange={e=>setFormParent(f=>({...f,prenom:e.target.value}))} placeholder={lang==='ar'?'الاسم':'Prénom'}/></div>
                <div className="field-group"><label className="field-lbl">{lang==='ar'?'اللقب':'Nom'} *</label><input className="field-input" value={formParent.nom} onChange={e=>setFormParent(f=>({...f,nom:e.target.value}))} placeholder={lang==='ar'?'اللقب':'Nom'}/></div>
                <div className="field-group"><label className="field-lbl">{lang==='ar'?'المعرف':'Identifiant'} *</label><input className="field-input" value={formParent.identifiant} onChange={e=>setFormParent(f=>({...f,identifiant:e.target.value}))} placeholder="parent.nom"/></div>
                <div className="field-group"><label className="field-lbl">{lang==='ar'?'كلمة المرور':'Mot de passe'} *</label><input className="field-input" type="password" value={formParent.mot_de_passe} onChange={e=>setFormParent(f=>({...f,mot_de_passe:e.target.value}))} placeholder="••••••"/></div>
                <div className="field-group"><label className="field-lbl">{lang==='ar'?'الهاتف':'Téléphone'}</label><input className="field-input" value={formParent.telephone} onChange={e=>setFormParent(f=>({...f,telephone:e.target.value}))} placeholder="06xxxxxxxx"/></div>
              </div>
              <div className="field-group" style={{marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <label className="field-lbl" style={{marginBottom:0}}>{lang==='ar'?'الأبناء المرتبطون':'Enfants liés'}</label>
                  {formParent.eleve_ids.length>0&&(
                    <span style={{fontSize:11,fontWeight:700,color:'#1D9E75',background:'#E1F5EE',padding:'2px 10px',borderRadius:20}}>
                      ✓ {formParent.eleve_ids.length} {lang==='ar'?'محدد':'sélectionné(s)'}
                    </span>
                  )}
                </div>
                {/* Recherche */}
                <div style={{position:'relative',marginBottom:6}}>
                  <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#bbb'}}>🔍</span>
                  <input className="field-input" style={{paddingRight:32}}
                    placeholder={lang==='ar'?'ابحث بالاسم أو رقم التعريف...':'Nom, prénom ou #ID...'}
                    value={formParent.searchEleve||''}
                    onChange={e=>setFormParent(f=>({...f,searchEleve:e.target.value}))}/>
                </div>
                {/* Élèves sélectionnés (badges) */}
                {formParent.eleve_ids.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:6,padding:'6px 8px',background:'#f0faf6',borderRadius:8,border:'0.5px solid #9FE1CB'}}>
                    {formParent.eleve_ids.map(eid=>{
                      const el=eleves.find(x=>x.id===eid);
                      if(!el) return null;
                      const nc={'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[el.code_niveau||'1']||'#888';
                      return(
                        <span key={eid} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:nc+'20',color:nc,border:'0.5px solid '+nc+'40'}}>
                          {el.eleve_id_ecole?'#'+el.eleve_id_ecole+' · ':''}{el.prenom} {el.nom}
                          <span onClick={()=>setFormParent(f=>({...f,eleve_ids:f.eleve_ids.filter(x=>x!==eid)}))} style={{cursor:'pointer',marginLeft:2,fontWeight:900,color:nc}}>×</span>
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* Liste filtrée */}
                <div style={{maxHeight:220,overflowY:'auto',border:'0.5px solid #e0e0d8',borderRadius:10,background:'#fff'}}>
                  {(()=>{
                    const search=(formParent.searchEleve||'').toLowerCase();
                    const filtered=eleves.filter(e=>!search||(e.prenom+' '+e.nom).toLowerCase().includes(search)||String(e.eleve_id_ecole||'').includes(search));
                    if(filtered.length===0) return <div style={{padding:12,textAlign:'center',fontSize:12,color:'#bbb'}}>{lang==='ar'?'لا نتائج':'Aucun résultat'}</div>;
                    return filtered.map(e=>{
                      const sel=formParent.eleve_ids.includes(e.id);
                      const nc={'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[e.code_niveau||'1']||'#888';
                      return(
                        <div key={e.id} onClick={()=>setFormParent(f=>({...f,eleve_ids:sel?f.eleve_ids.filter(x=>x!==e.id):[...f.eleve_ids,e.id]}))}
                          style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',cursor:'pointer',borderBottom:'0.5px solid #f5f5f0',
                            background:sel?nc+'08':'#fff',transition:'background 0.1s'}}>
                          {/* Checkbox */}
                          <div style={{width:18,height:18,borderRadius:4,border:'1.5px solid '+(sel?nc:'#d0d0c8'),background:sel?nc:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
                            {sel&&<span style={{color:'#fff',fontSize:11,lineHeight:1}}>✓</span>}
                          </div>
                          {/* ID */}
                          {e.eleve_id_ecole&&<span style={{fontSize:11,color:'#bbb',minWidth:38,fontWeight:500}}>#{e.eleve_id_ecole}</span>}
                          {/* Nom */}
                          <span style={{flex:1,fontSize:13,fontWeight:sel?600:400,color:sel?nc:'#1a1a1a'}}>{e.prenom} {e.nom}</span>
                          {/* Badge niveau */}
                          <span style={{padding:'1px 7px',borderRadius:10,fontSize:10,fontWeight:700,background:nc+'18',color:nc,flexShrink:0}}>{e.code_niveau||'?'}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
                {eleves.length===0&&<div style={{fontSize:11,color:'#E24B4A',marginTop:4}}>⚠️ {lang==='ar'?'لا يوجد طلاب مسجلون بعد':'Aucun élève enregistré'}</div>}
              </div>
              <button className="btn-primary" onClick={async()=>{
                if(!formParent.prenom||!formParent.nom||!formParent.identifiant) { toast.warning(lang==='ar'?'يرجى ملء الحقول المطلوبة':'Remplissez les champs obligatoires'); return; }
                if(!editingParentId && !formParent.mot_de_passe) { toast.warning(lang==='ar'?'كلمة المرور مطلوبة':'Mot de passe requis'); return; }
                let pid = editingParentId;
                if(editingParentId) {
                  const upd={prenom:formParent.prenom,nom:formParent.nom,identifiant:formParent.identifiant};
                  if(formParent.mot_de_passe) upd.mot_de_passe=formParent.mot_de_passe;
                  const {error:ue}=await supabase.from('utilisateurs').update(upd).eq('id',editingParentId);
                  if(ue){ toast.error(ue.message||'Erreur utilisateur'); return; }
                  await supabase.from('parent_eleve').delete().eq('parent_id',editingParentId);
                } else {
                  const {data:pd,error:pe}=await supabase.from('utilisateurs').insert({prenom:formParent.prenom,nom:formParent.nom,identifiant:formParent.identifiant,mot_de_passe:formParent.mot_de_passe,role:'parent',ecole_id:user.ecole_id,statut_compte:'actif'}).select().single();
                  if(pe){ toast.error(pe.message||'Erreur parent'); return; }
                  toast.success(lang==='ar'?'✅ تم حفظ ولي الأمر':'✅ Parent enregistré avec succès');
                  pid=pd.id;
                }
                if(formParent.eleve_ids.length>0){
                  await supabase.from('parent_eleve').insert(formParent.eleve_ids.map(eid=>({parent_id:pid,eleve_id:eid})));
                }
                setShowFormParent(false);
                setEditingParentId(null);
                setFormParent({prenom:'',nom:'',identifiant:'',mot_de_passe:'',telephone:'',eleve_ids:[],searchEleve:''});
                const {data:pd2}=await supabase.from('utilisateurs').select('id,prenom,nom,identifiant').eq('role','parent').eq('ecole_id',user.ecole_id);
                const {data:pl2}=await supabase.from('parent_eleve').select('parent_id,eleve_id');
                const lm2={}; (pl2||[]).forEach(l=>{if(!lm2[l.parent_id])lm2[l.parent_id]=[];lm2[l.parent_id].push(l.eleve_id);});
                setParents((pd2||[]).map(p=>({...p,eleve_ids:lm2[p.id]||[]})));
              }}>
                {editingParentId?('✓ '+(lang==='ar'?'تحديث':'Mettre à jour')):('✓ '+(lang==='ar'?'إضافة':'Ajouter'))}
              </button>
            </div>
          )}

          <input className="field-input" style={{marginBottom:8}} placeholder={'🔍 '+(lang==='ar'?'بحث عن ولي أمر...':'Rechercher un parent...')} value={searchParent} onChange={e=>setSearchParent(e.target.value)}/>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div style={{fontSize:12,color:'#888'}}>{parents.length} {lang==='ar'?'ولي أمر':'parent(s)'}</div>
            <button onClick={exportParentsExcel}
              style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#f5f5f0',
                color:'#085041',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>
              📊 Excel
            </button>
            <button onClick={exportParentsPDF}
              style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',background:'#f5f5f0',
                color:'#534AB7',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>
              🖨️ PDF
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {parents.filter(p=>!searchParent||(p.prenom+' '+p.nom).toLowerCase().includes(searchParent.toLowerCase())||p.identifiant.includes(searchParent)||p.telephone?.includes(searchParent)).map(p=>(
              <div key={p.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:40,height:40,borderRadius:'50%',background:'#E1F5EE',color:'#085041',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>
                  {(p.prenom[0]||'')+(p.nom[0]||'')}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{p.prenom} {p.nom}</div>
                  <div style={{fontSize:11,color:'#888',marginTop:2}}>
                    {lang==='ar'?'المعرف:':'ID: '}<strong>{p.identifiant}</strong>
                    {p.telephone&&' · '+p.telephone}
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                    {eleves.filter(e=>(p.eleve_ids||[]).includes(e.id)).map(e=>(
                      <span key={e.id} style={{padding:'1px 6px',borderRadius:8,fontSize:10,background:'#E1F5EE',color:'#085041'}}>
                        👦 {e.prenom} {e.nom}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <button onClick={()=>{
                    setFormParent({prenom:p.prenom,nom:p.nom,identifiant:p.identifiant,mot_de_passe:p.mot_de_passe||'',telephone:p.telephone||'',eleve_ids:p.eleve_ids||[],searchEleve:''});
                    setEditingParentId(p.id);
                    setShowFormParent(true);
                    window.scrollTo(0,0);
                  }} style={{padding:'4px 8px',borderRadius:6,background:'#E6F1FB',color:'#378ADD',border:'0.5px solid #378ADD30',cursor:'pointer',fontSize:11,fontWeight:600}}>✏️ {lang==='ar'?'تعديل':'Modifier'}</button>
                  <button onClick={()=>showConfirm(
                    lang==='ar'?'حذف ولي الأمر':'Supprimer le parent',
                    (lang==='ar'?'هل تريد حذف حساب ':'Supprimer le compte de ')+(p.prenom+' '+p.nom)+'?',
                    async()=>{
                      await supabase.from('parent_eleve').delete().eq('parent_id',p.id);
                      await supabase.from('utilisateurs').delete().eq('id',p.id);
                      setParents(prev=>prev.filter(x=>x.id!==p.id));
                      hideConfirm();
                    }
                  )} style={{padding:'4px 8px',borderRadius:6,background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A30',cursor:'pointer',fontSize:11,fontWeight:600}}>🗑 {lang==='ar'?'حذف':'Suppr.'}</button>
                </div>
              </div>
            ))}
            {parents.length===0&&<div className="empty">{lang==='ar'?'لا أولياء أمور مسجلون':'Aucun parent enregistré'}</div>}
          </div>
        </div>
      )}
      {tab === 'bareme' && (
        <BaremeTab
          user={user} lang={lang}
          bareme={bareme} setBareme={setBareme}
          saving={savingBareme} setSaving={setSavingBareme}
          showMsg={showMsg}
        />
      )}

      {tab === 'jalons' && (
        <JalonsTab
          user={user} lang={lang}
          jalons={jalons} setJalons={setJalons}
          ensembles={ensemblesDisp}
          examens={examensDisp}
          newJalon={newJalon} setNewJalon={setNewJalon}
          savingJalon={savingJalon} setSavingJalon={setSavingJalon}
          showMsg={showMsg}
        />
      )}
      {tab === 'passage_niveau' && (
        <PassageNiveauTab
          user={user} lang={lang}
          niveaux={niveauxActifs||[]}
          showMsg={showMsg}
        />
      )}
      {tab === 'sens_recitation' && (
        <SensRecitationTab
          user={user} lang={lang}
          ecoleConfig={ecoleConfig} setEcoleConfig={setEcoleConfig}
          niveaux={niveauxActifs||[]} setNiveaux={setNiveauxDyn}
          showMsg={showMsg}
        />
      )}
    </div>
  );
}