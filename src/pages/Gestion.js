import React, { useState, useEffect } from 'react';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import { getInitiales, calcEtatEleve, calcPoints } from '../lib/helpers';
import { SOURATES_5B, SOURATES_5A, SOURATES_2M, isSourateNiveau } from '../lib/sourates';
import { t } from '../lib/i18n';

function Avatar({ prenom, nom, size = 28 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: size * 0.33, flexShrink: 0 }}>
      {getInitiales(prenom, nom)}
    </div>
  );
}

// Sélecteur acquis antérieurs — adapté selon le niveau
function AcquisSelector({ codeNiveau, hizb, tomon, onHizbChange, onTomonChange, souratesAcquises, onSouratesChange, lang, niveauxDyn=[] }) {
  const _niv = niveauxDyn.find(n=>n.code===codeNiveau);
  const isSourate = _niv ? _niv.type==='sourate' : ['5B','5A','2M'].includes(codeNiveau);

  if (isSourate) {
    const souratesNiveau = codeNiveau === '5B' ? SOURATES_5B : codeNiveau === '5A' ? SOURATES_5A : SOURATES_2M;
    const souratesOrdonnees = [...souratesNiveau].sort((a,b) => b.numero - a.numero);
    const nbAcquis = souratesAcquises || 0;
    // Sourates acquired = last N sourates (from 114 downward)
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
  return (
    <div style={{background:'#f9f9f6',borderRadius:12,padding:'1rem',border:'0.5px solid #e0e0d8'}}>
      <div style={{fontSize:11,color:'#888',marginBottom:10,textAlign:'center'}}>{lang==='ar'?'موقع الطالب في القرآن قبل بدء المتابعة':lang==='en'?'Position in Quran before tracking':'Position dans le Coran avant de commencer le suivi'}</div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:500}}>{lang==='ar'?'انقر على أول حزب محفوظ (من 60 نحو 1)':'Cliquez sur le premier Hizb mémorisé (60 → 1)'}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>onHizbChange(Math.min(60,hizb+1))} style={{width:32,height:32,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:16,fontWeight:700}}>−</button>
          <div style={{flex:1,display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3}}>
            {Array.from({length:60},(_,i)=>60-i).map(n=>(
              <div key={n} onClick={()=>onHizbChange(n===hizb?0:n)} style={{height:28,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:n===hizb?700:400,cursor:'pointer',background:(hizb>0&&n>=hizb)?'#1D9E75':'#f0f0ec',color:(hizb>0&&n>=hizb)?'#fff':'#999',fontWeight:n===hizb?800:400,border:n===hizb&&hizb>0?'2px solid #085041':'none',transition:'all 0.1s'}}>
                {n}
              </div>
            ))}
          </div>
          <button onClick={()=>onHizbChange(Math.max(0,hizb-1))} style={{width:32,height:32,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:16,fontWeight:700}}>+</button>
        </div>
        <div style={{textAlign:'center',marginTop:6,fontSize:14,fontWeight:700,color:'#1D9E75'}}>{hizb===0?(lang==='ar'?'لا توجد مكتسبات سابقة':'Aucun acquis antérieur'):`${lang==='ar'?'الحزب المختار':'Hizb sélectionné'} : ${hizb} — ${lang==='ar'?'المحفوظ':'Acquis'} : ${hizb} ${lang==='ar'?'إلى 60':'à 60'}`}</div>
      </div>
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


export default function Gestion({ user, navigate, goBack, lang = 'fr', isMobile }) {
  const { toast } = useToast();
  const [tab, setTab] = useState('eleves');
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

  const [newEleve, setNewEleve] = useState({ prenom: '', nom: '', niveau: 'Débutant', code_niveau: '1', eleve_id_ecole: '', instituteur_referent_id: '', hizb_depart: 0, tomon_depart: 1, sourates_acquises: 0 });
  const [newInst, setNewInst] = useState({ prenom: '', nom: '', identifiant: '', mot_de_passe: '' });
  const [ecoleConfig, setEcoleConfig] = useState({ mdp_defaut_instituteurs: 'ecole2024', mdp_defaut_parents: 'parent2024' });
  // Hooks niveaux dynamiques
  const [niveauxDyn, setNiveauxDyn] = useState([]);
  // Hooks formulaires mobiles
  const [showFormEleve,  setShowFormEleve]  = useState(false);
  const [showFormInst,   setShowFormInst]   = useState(false);
  const [mobileEditEleve,setMobileEditEleve]= useState(null);
  const [editInstituteur, setEditInstituteur] = useState(null);
  const [formEditInst, setFormEditInst] = useState({prenom:'',nom:'',identifiant:'',mot_de_passe:''});

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    supabase.from('niveaux').select('id,code,nom,type,couleur')
      .eq('ecole_id', user.ecole_id).order('ordre')
      .then(({data}) => { if(data) setNiveauxDyn(data); });
  }, []);

  const loadData = async () => {
    const { data: ecData } = await supabase.from('ecoles').select('mdp_defaut_instituteurs,mdp_defaut_parents').eq('id', user.ecole_id).maybeSingle();
    if (ecData) setEcoleConfig(prev => ({...prev, ...ecData}));
    setLoading(true);
    const { data: e } = await supabase.from('eleves').select('id,prenom,nom,code_niveau,eleve_id_ecole,hizb_depart,tomon_depart,sourates_acquises,instituteur_referent_id,ecole_id')
        .eq('ecole_id', user.ecole_id).order('nom');
    const { data: i } = await supabase.from('utilisateurs').select('id,prenom,nom,identifiant,role').eq('role', 'instituteur').eq('ecole_id', user.ecole_id);
    setEleves(e || []);
    setInstituteurs(i || []);
    const { data: pd, error: pdErr } = await supabase.from('utilisateurs')
        .select('id,prenom,nom,identifiant')
        .eq('role','parent').eq('ecole_id', user.ecole_id);
    console.log('Parents query result:', pd, 'Error:', pdErr, 'ecole_id:', user.ecole_id);
    const { data: pliens } = await supabase.from('parent_eleve')
        .select('parent_id,eleve_id');
    console.log('Liens parent_eleve:', pliens);
    const liensMap = {};
    (pliens||[]).forEach(l => { if(!liensMap[l.parent_id]) liensMap[l.parent_id]=[]; liensMap[l.parent_id].push(l.eleve_id); });
    setParents((pd||[]).map(p=>({...p, eleve_ids:liensMap[p.id]||[]})));
    setLoading(false);
  };

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const ajouterEleve = async () => {
    if (!newEleve.prenom?.trim()) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    if (!newEleve.nom?.trim()) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    if (!newEleve.code_niveau) return showMsg('error', t(lang, 'tous_champs_obligatoires'));
    if (!newEleve.eleve_id_ecole?.trim()) return showMsg('error', lang==='ar'?'رقم تعريف الطالب إلزامي':"L'ID élève est obligatoire");
    if (!newEleve.instituteur_referent_id) return showMsg('error', lang==='ar'?'يجب اختيار الأستاذ المرجع':'Veuillez sélectionner un instituteur référent');

    // ⑦ Vérifier unicité numéro élève
    const { data: existing } = await supabase.from('eleves')
      .select('id').eq('eleve_id_ecole', newEleve.eleve_id_ecole.trim()).eq('ecole_id', user.ecole_id).maybeSingle();
    if (existing) return showMsg('error', lang==='ar'?'رقم التعريف مستخدم مسبقاً، اختر رقماً آخر':'Ce numéro élève existe déjà, choisissez-en un autre');

    const { error } = await supabase.from('eleves').insert({
      prenom: newEleve.prenom, nom: newEleve.nom, niveau: newEleve.niveau, ecole_id: user.ecole_id,
      code_niveau: newEleve.code_niveau || '1',
      eleve_id_ecole: newEleve.eleve_id_ecole || null,
      instituteur_referent_id: newEleve.instituteur_referent_id || null,
      hizb_depart: parseInt(newEleve.hizb_depart) || 0,
      tomon_depart: parseInt(newEleve.tomon_depart) || 1,
      sourates_acquises: parseInt(newEleve.sourates_acquises) || 0
    });
    if (error) return showMsg('error', t(lang, 'erreur_ajout'));
    // Récupérer l'élève créé par son numéro (RLS bloque .select() après insert)
    const { data: eleveData } = await supabase.from('eleves')
      .select('id').eq('eleve_id_ecole', newEleve.eleve_id_ecole.trim()).eq('ecole_id', user.ecole_id).maybeSingle();
    console.log('Eleve récupéré:', eleveData);

    // ⑥ Créer compte parent automatiquement
    const mdpParent = ecoleConfig?.mdp_defaut_parents || 'parent2024';
    const loginParent = newEleve.eleve_id_ecole.trim();
    const { data: parentData, error: parentErr } = await supabase.from('utilisateurs').insert({
      prenom: newEleve.prenom, nom: newEleve.nom,
      identifiant: loginParent, mot_de_passe: mdpParent,
      role: 'parent', ecole_id: user.ecole_id, statut_compte: 'actif'
    }).select().single();
    console.log('Parent insert result:', parentData, 'Error:', parentErr?.message);
    if (parentErr) showMsg('error', 'Erreur création parent: '+parentErr.message);
    if (parentData?.id && eleveData?.id) {
      const { error: lienErr } = await supabase.from('parent_eleve').insert({
        parent_id: parentData.id, eleve_id: eleveData.id
      });
      console.log('Lien parent_eleve error:', lienErr?.message);
    }

    showMsg('success', lang==='ar'?`✅ تم إضافة الطالب — حساب ولي الأمر: ${loginParent} / ${mdpParent}`:`✅ Élève ajouté — Compte parent: ${loginParent} / ${mdpParent}`);
    setNewEleve({ prenom: '', nom: '', niveau: 'Débutant', code_niveau: '1', eleve_id_ecole: '', instituteur_referent_id: '', hizb_depart: 0, tomon_depart: 1, sourates_acquises: 0 });
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
      sourates_acquises: parseInt(editEleve.sourates_acquises) || 0
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
            await supabase.from('exceptions_recitation').delete().eq('eleve_id', id).catch(()=>{});
            await supabase.from('exceptions_hizb').delete().eq('eleve_id', id).catch(()=>{});
            await supabase.from('recitations_sourates').delete().eq('eleve_id', id).catch(()=>{});
            await supabase.from('validations').delete().eq('eleve_id', id);
            await supabase.from('apprentissages').delete().eq('eleve_id', id).catch(()=>{});
            await supabase.from('cotisations').delete().eq('eleve_id', id).catch(()=>{});
            await supabase.from('objectifs_globaux').update({eleve_id:null}).eq('eleve_id', id).catch(()=>{});
            await supabase.from('parent_eleve').delete().eq('eleve_id', id).catch(()=>{});
            await supabase.from('eleves').delete().eq('id', id);
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
    console.log('Instituteur créé:', {login, mdp});
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
        // Detach all eleves first
        if (nbEleves > 0) {
          await supabase.from('eleves').update({instituteur_referent_id: null}).eq('instituteur_referent_id', inst.id);
        }
        // Remove from parent_eleve if any
        await supabase.from('objectifs_globaux').update({instituteur_id: null}).eq('instituteur_id', inst.id).catch(()=>{});
        await supabase.from('utilisateurs').delete().eq('id', inst.id);
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

  const NIVEAU_LABELS = {'5B':(lang==='ar'?'تمهيدي':'Préscolaire'),'5A':'Primaire 1-2','2M':'Primaire 3-4','2':'Primaire 5-6','1':(lang==='ar'?'إعدادي/ثانوي':'Collège/Lycée')};

  // Export élèves Excel
  const exportElevesExcel = async () => {
    if (!window.XLSX) {
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [lang==='ar'?'#':'#', lang==='ar'?'الاسم':'Prénom', lang==='ar'?'اللقب':'Nom', lang==='ar'?'رقم التعريف':'N° Élève', lang==='ar'?'المستوى':'Niveau', lang==='ar'?'الصف':'Classe', lang==='ar'?'الأستاذ المرجع':'Instituteur'],
      ...eleves.map((e,i) => {
        const inst = instituteurs.find(x=>x.id===e.instituteur_referent_id);
        return [i+1, e.prenom, e.nom, e.eleve_id_ecole||'—', e.code_niveau||'?', NIVEAU_LABELS[e.code_niveau||'']||'—', inst?inst.prenom+' '+inst.nom:'—'];
      })
    ]);
    ws['!cols'] = [{wch:4},{wch:16},{wch:16},{wch:12},{wch:8},{wch:20},{wch:22}];
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
    const w = window.open('','_blank','width=1000,height=800');
    if (!w) { toast.warning(lang==='ar'?'يرجى السماح بالنوافذ المنبثقة':'Autorisez les popups pour exporter'); return; }
    const rows = eleves.map((e,i) => {
      const inst = instituteurs.find(x=>x.id===e.instituteur_referent_id);
      const nc = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[e.code_niveau||'']||'#888';
      const bg = i%2===0?'#fff':'#f9f9f6';
      return '<tr style="background:'+bg+'">'
        +'<td>'+(i+1)+'</td>'
        +'<td><strong>'+e.prenom+' '+e.nom+'</strong></td>'
        +'<td style="color:#888">'+(e.eleve_id_ecole?'#'+e.eleve_id_ecole:'—')+'</td>'
        +'<td><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:'+nc+'18;color:'+nc+'">'+(e.code_niveau||'?')+'</span></td>'
        +'<td style="color:#555">'+(NIVEAU_LABELS[e.code_niveau||'']||'—')+'</td>'
        +'<td style="color:#888">'+(inst?inst.prenom+' '+inst.nom:'—')+'</td>'
        +'</tr>';
    }).join('');

    const html = '<!DOCTYPE html><html dir="'+(lang==='ar'?'rtl':'ltr')+'" lang="'+(lang==='ar'?'ar':'fr')+'"><head><meta charset="UTF-8"><title>Liste Élèves</title>'
      +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Tajawal,Arial,sans-serif;padding:20px;font-size:12px}'
      +'.header{background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px}'
      +'h1{font-size:18px;font-weight:800;margin-bottom:4px}'
      +'table{width:100%;border-collapse:collapse;margin-top:10px}'
      +'th{background:#085041;color:#fff;padding:8px;text-align:start;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #f0f0ec}'+'th2{font-size:11px}'
      +'td{padding:7px 8px;border-bottom:1px solid #f0f0ec;font-size:11px}'
      +'.footer{margin-top:16px;font-size:9px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:8px;text-align:center}'
      +'@media print{body{padding:10px}}</style></head><body>'
      +'<div class="header"><h1>👥 '+(lang==='ar'?'قائمة الطلاب':lang==='ar'?'قائمة الطلاب':'Liste des Élèves')+'</h1>'
      +'<div style="font-size:11px;opacity:0.8">'+eleves.length+' '+(lang==='ar'?'طالب':'élève(s)')+' · '+new Date().toLocaleDateString('fr-FR')+'</div></div>'
      +'<table><thead><tr>'
      +'<th>#</th><th>'+(lang==='ar'?'الاسم':'Nom complet')+'</th><th>'+(lang==='ar'?'رقم التعريف':'N° Élève')+'</th>'
      +'<th>'+(lang==='ar'?'المستوى':'Niv.')+'</th><th>'+(lang==='ar'?'الصف':'Classe')+'</th><th>'+(lang==='ar'?'الأستاذ':'Instituteur')+'</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table>'
      +'<div class="footer">Généré le '+new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})+' · متابعة التحفيظ</div>'
      +'</body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(function(){ w.print(); }, 600);
  };

  // Export PDF instituteurs
  const exportInstituteursPDF = () => {
    const w = window.open('','_blank','width=1000,height=800');
    if (!w) { toast.warning(lang==='ar'?'يرجى السماح بالنوافذ المنبثقة':'Autorisez les popups pour exporter'); return; }
    const rows = instituteurs.map((inst,i) => {
      const nbEleves = eleves.filter(e=>e.instituteur_referent_id===inst.id).length;
      const elevesInst = eleves.filter(e=>e.instituteur_referent_id===inst.id);
      const niveaux = [...new Set(elevesInst.map(e=>e.code_niveau||'?'))].join(', ');
      const bg = i%2===0?'#fff':'#f9f9f6';
      return '<tr style="background:'+bg+'">'
        +'<td>'+(i+1)+'</td>'
        +'<td><strong>'+inst.prenom+' '+inst.nom+'</strong></td>'
        +'<td style="color:#888">'+(inst.identifiant||'—')+'</td>'
        +'<td style="color:#1D9E75;font-weight:700">'+nbEleves+'</td>'
        +'<td style="color:#555">'+niveaux+'</td>'
        +'</tr>';
    }).join('');

    const html = '<!DOCTYPE html><html dir="'+(lang==='ar'?'rtl':'ltr')+'" lang="'+(lang==='ar'?'ar':'fr')+'"><head><meta charset="UTF-8"><title>Liste Instituteurs</title>'
      +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Tajawal,Arial,sans-serif;padding:20px;font-size:12px}'
      +'.header{background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px}'
      +'h1{font-size:18px;font-weight:800;margin-bottom:4px}'
      +'table{width:100%;border-collapse:collapse;margin-top:10px}'
      +'th{background:#085041;color:#fff;padding:8px;text-align:start;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #f0f0ec}'+'th2{font-size:11px}'
      +'td{padding:7px 8px;border-bottom:1px solid #f0f0ec;font-size:11px}'
      +'.footer{margin-top:16px;font-size:9px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:8px;text-align:center}'
      +'</style></head><body>'
      +'<div class="header"><h1>👨‍🏫 '+(lang==='ar'?'قائمة الأساتذة':'Liste des Instituteurs')+'</h1>'
      +'<div style="font-size:11px;opacity:0.8">'+instituteurs.length+' '+(lang==='ar'?'أستاذ':'instituteur(s)')+' · '+new Date().toLocaleDateString('fr-FR')+'</div></div>'
      +'<table><thead><tr>'
      +'<th>#</th><th>'+(lang==='ar'?'الاسم':'Nom complet')+'</th><th>'+(lang==='ar'?'المعرف':'Identifiant')+'</th>'
      +'<th>'+(lang==='ar'?'عدد الطلاب':'Nb élèves')+'</th><th>'+(lang==='ar'?'المستويات':'Niveaux')+'</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table>'
      +'<div class="footer">Généré le '+new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})+' · متابعة التحفيظ</div>'
      +'</body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(function(){ w.print(); }, 600);
  };



  // Constantes niveaux dynamiques — avec fallback si niveaux pas encore chargés
  const FALLBACK_NC = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'};
  const FALLBACK_NL = {'5B':'Préscolaire','5A':'Prim. 1-2','2M':'Prim. 3-4','2':'Prim. 5-6','1':'Collège'};
  const niveauxActifs = niveauxDyn.length > 0 ? niveauxDyn : Object.keys(FALLBACK_NC).map(code=>({id:code,code,nom:FALLBACK_NL[code]||code,couleur:FALLBACK_NC[code],type:'hizb'}));
  const niveaux = niveauxActifs.map(n=>({value:n.code, label:`${n.code} — ${n.nom}`}));
  const NC = Object.fromEntries(niveauxActifs.map(n=>[n.code, n.couleur||FALLBACK_NC[n.code]||'#888']));
  const NL = Object.fromEntries(niveauxActifs.map(n=>[n.code, n.nom||n.code]));
  const NIVEAUX_M = niveauxActifs.map(n=>n.code);

  if (isMobile) {
    const NC = {'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'};
    const NL = {'5B':lang==='ar'?'\u062a\u0645\u0647\u064a\u062f\u064a':'Pr\u00e9scolaire','5A':'Prim. 1-2','2M':'Prim. 3-4','2':'Prim. 5-6','1':lang==='ar'?'\u0625\u0639\u062f\u0627\u062f\u064a':'Coll\u00e8ge'};
    const NIVEAUX_M = ['5B','5A','2M','2','1'];

    const resetFormEleve = () => {
      setNewEleve({prenom:'',nom:'',niveau:'D\u00e9butant',code_niveau:'1',eleve_id_ecole:'',instituteur_referent_id:'',hizb_depart:0,tomon_depart:1,sourates_acquises:0});
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

    if (loading) return <div style={{padding:'3rem',textAlign:'center',color:'#888'}}>...</div>;

    const FieldInput = ({label, val, onChange, ph, type='text'}) => (
      <div style={{marginBottom:12}}>
        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{label}</label>
        <input type={type}
          style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',
            fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
          value={val} onChange={onChange} placeholder={ph}/>
      </div>
    );

    return (
      <div style={{paddingBottom:80,background:'#f5f5f0',minHeight:'100vh'}}>
        {/* HEADER */}
        <div style={{background:'#fff',padding:'14px 16px 0',borderBottom:'0.5px solid #e0e0d8',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#085041',padding:0}}>\u2190</button>
            <div style={{flex:1,fontSize:17,fontWeight:800,color:'#085041'}}>\u2699\ufe0f {lang==='ar'?'\u0627\u0644\u0625\u062f\u0627\u0631\u0629':'Administration'}</div>
            {tab==='eleves'&&user.role==='surveillant'&&(
              <button onClick={()=>{resetFormEleve();setShowFormEleve(v=>!v);}}
                style={{background:showFormEleve?'#f0f0ec':'#1D9E75',color:showFormEleve?'#666':'#fff',
                  border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {showFormEleve?'\u2715':lang==='ar'?'+ \u0625\u0636\u0627\u0641\u0629':'+ Ajouter'}
              </button>
            )}
            {tab==='instituteurs'&&user.role==='surveillant'&&(
              <button onClick={()=>setShowFormInst(v=>!v)}
                style={{background:showFormInst?'#f0f0ec':'#378ADD',color:showFormInst?'#666':'#fff',
                  border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {showFormInst?'\u2715':lang==='ar'?'+ \u0625\u0636\u0627\u0641\u0629':'+ Ajouter'}
              </button>
            )}
            {tab==='parents'&&user.role==='surveillant'&&(
              <button onClick={()=>setShowFormParent(v=>!v)}
                style={{background:showFormParent?'#f0f0ec':'#EF9F27',color:showFormParent?'#666':'#fff',
                  border:'none',borderRadius:10,padding:'8px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                {showFormParent?'\u2715':lang==='ar'?'+ \u0625\u0636\u0627\u0641\u0629':'+ Ajouter'}
              </button>
            )}
          </div>
          {msg.text&&(
            <div style={{margin:'0 0 10px',padding:'10px 14px',borderRadius:10,fontSize:13,
              background:msg.type==='error'?'#FCEBEB':'#E1F5EE',color:msg.type==='error'?'#E24B4A':'#085041'}}>
              {msg.text}
            </div>
          )}
          <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3}}>
            {[['eleves',lang==='ar'?'\u0627\u0644\u0637\u0644\u0627\u0628':'\u00c9l\u00e8ves'],['instituteurs',lang==='ar'?'\u0627\u0644\u0623\u0633\u0627\u062a\u0630\u0629':'Profs'],['parents',lang==='ar'?'\u0627\u0644\u0622\u0628\u0627\u0621':'Parents']].map(([k,l])=>(
              <div key={k} onClick={()=>setTab(k)}
                style={{flex:1,padding:'8px 4px',borderRadius:8,textAlign:'center',fontSize:12,fontWeight:600,
                  cursor:'pointer',background:tab===k?'#fff':'transparent',color:tab===k?'#1a1a1a':'#888'}}>
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* ELEVES */}
        {tab==='eleves'&&(
          <div style={{padding:'12px'}}>
            {showFormEleve&&user.role==='surveillant'&&(
              <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
                border:`1.5px solid ${mobileEditEleve?'#378ADD':'#1D9E75'}`}}>
                <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                  {mobileEditEleve?(lang==='ar'?'\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0637\u0627\u0644\u0628':'\u270f\ufe0f Modifier \u00e9l\u00e8ve'):(lang==='ar'?'\u0625\u0636\u0627\u0641\u0629 \u0637\u0627\u0644\u0628':'\ud83d\udc64 Nouvel \u00e9l\u00e8ve')}
                </div>
                {[{label:lang==='ar'?'\u0627\u0644\u0627\u0633\u0645':'Pr\u00e9nom *',key:'prenom',ph:lang==='ar'?'\u0627\u0644\u0627\u0633\u0645':'Pr\u00e9nom'},
                  {label:lang==='ar'?'\u0627\u0644\u0644\u0642\u0628':'Nom *',key:'nom',ph:lang==='ar'?'\u0627\u0644\u0644\u0642\u0628':'Nom'},
                ].map(f=>(
                  <div key={f.key} style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{f.label}</label>
                    <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                      value={editEleve?editEleve[f.key]||'':newEleve[f.key]}
                      onChange={e=>editEleve?setEditEleve(x=>({...x,[f.key]:e.target.value})):setNewEleve(x=>({...x,[f.key]:e.target.value}))}
                      placeholder={f.ph}/>
                  </div>
                ))}
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'\u0631\u0642\u0645 \u0627\u0644\u062a\u0639\u0631\u064a\u0641':'ID \u00e9l\u00e8ve *'}</label>
                  <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={editEleve?editEleve.eleve_id_ecole||'':newEleve.eleve_id_ecole}
                    onChange={e=>editEleve?setEditEleve(x=>({...x,eleve_id_ecole:e.target.value})):setNewEleve(x=>({...x,eleve_id_ecole:e.target.value}))}
                    placeholder="001"/>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>{lang==='ar'?'\u0627\u0644\u0645\u0633\u062a\u0648\u0649':'Niveau *'}</label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {NIVEAUX_M.map(n=>{
                      const nc=NC[n]; const cur=editEleve?editEleve.code_niveau:newEleve.code_niveau;
                      return(
                        <div key={n} onClick={()=>editEleve?setEditEleve(x=>({...x,code_niveau:n})):setNewEleve(x=>({...x,code_niveau:n}))}
                          style={{padding:'8px 12px',borderRadius:20,cursor:'pointer',flexShrink:0,textAlign:'center',
                            background:cur===n?nc:'#f5f5f0',color:cur===n?'#fff':'#666',
                            border:`1.5px solid ${cur===n?nc:'#e0e0d8'}`,fontWeight:cur===n?700:400,fontSize:12}}>
                          <div>{n}</div><div style={{fontSize:9,opacity:0.85}}>{NL[n]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'\u0627\u0644\u0623\u0633\u062a\u0627\u0630 \u0627\u0644\u0645\u0631\u062c\u0639':'Instituteur r\u00e9f\u00e9rent *'}</label>
                  <select style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:14,fontFamily:'inherit',background:'#fff',boxSizing:'border-box'}}
                    value={editEleve?editEleve.instituteur_referent_id||'':newEleve.instituteur_referent_id}
                    onChange={e=>editEleve?setEditEleve(x=>({...x,instituteur_referent_id:e.target.value})):setNewEleve(x=>({...x,instituteur_referent_id:e.target.value}))}>
                    <option value="">\u2014 {lang==='ar'?'\u0627\u062e\u062a\u0631 \u0623\u0633\u062a\u0627\u0630\u0627\u064b':'Choisir'} \u2014</option>
                    {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                  </select>
                </div>
                {['2','1','2M'].includes(editEleve?editEleve.code_niveau:newEleve.code_niveau)&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                    {[{label:lang==='ar'?'\u0627\u0644\u062d\u0632\u0628 \u0627\u0644\u0627\u0628\u062a\u062f\u0627\u0626\u064a':'Hizb d\u00e9part',key:'hizb_depart',max:60},
                      {label:lang==='ar'?'\u0627\u0644\u062b\u064f\u0651\u0645\u0646 \u0627\u0644\u0627\u0628\u062a\u062f\u0627\u0626\u064a':'Tomon d\u00e9part',key:'tomon_depart',max:8}
                    ].map(f=>(
                      <div key={f.key}>
                        <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{f.label}</label>
                        <input type="number" min="1" max={f.max}
                          style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                          value={editEleve?editEleve[f.key]||1:newEleve[f.key]}
                          onChange={e=>editEleve?setEditEleve(x=>({...x,[f.key]:e.target.value})):setNewEleve(x=>({...x,[f.key]:e.target.value}))}/>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  <button onClick={()=>{setShowFormEleve(false);resetFormEleve();}}
                    style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    {lang==='ar'?'\u0625\u0644\u063a\u0627\u0621':'Annuler'}
                  </button>
                  <button onClick={handleSaveEleve}
                    style={{flex:2,padding:'13px',background:mobileEditEleve?'#378ADD':'#1D9E75',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                    {mobileEditEleve?(lang==='ar'?'\u062a\u062d\u062f\u064a\u062b':'Mettre \u00e0 jour \u2713'):(lang==='ar'?'\u062d\u0641\u0638':'Enregistrer')}
                  </button>
                </div>
              </div>
            )}
            <input style={{width:'100%',padding:'12px 16px',borderRadius:12,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box',background:'#fff',marginBottom:8}}
              placeholder={lang==='ar'?'\u0628\u062d\u062b \u0639\u0646 \u0637\u0627\u0644\u0628...':'Rechercher un \u00e9l\u00e8ve...'}
              value={searchEleve||''} onChange={e=>setSearchEleve(e.target.value)}/>
            <div style={{fontSize:12,color:'#888',marginBottom:8,paddingLeft:4}}>
              {eleves.filter(e=>!searchEleve||`${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes((searchEleve||'').toLowerCase())).length} {lang==='ar'?'\u0637\u0627\u0644\u0628':'\u00e9l\u00e8ve(s)'}
            </div>
            {eleves.filter(e=>!searchEleve||`${e.prenom} ${e.nom} ${e.eleve_id_ecole||''}`.toLowerCase().includes((searchEleve||'').toLowerCase())).map(e=>{
              const nc=NC[e.code_niveau||'1']||'#888';
              return(
                <div key={e.id} style={{background:'#fff',borderRadius:12,padding:'13px 14px',marginBottom:8,border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:12}}>
                  <div onClick={()=>navigate('fiche',e)} style={{cursor:'pointer',width:42,height:42,borderRadius:'50%',background:`${nc}20`,color:nc,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,flexShrink:0}}>
                    {((e.prenom||'?')[0])+((e.nom||'?')[0])}
                  </div>
                  <div onClick={()=>navigate('fiche',e)} style={{flex:1,minWidth:0,cursor:'pointer'}}>
                    <div style={{fontWeight:700,fontSize:14}}>{e.prenom} {e.nom}</div>
                    <div style={{display:'flex',gap:6,marginTop:3,alignItems:'center',flexWrap:'wrap'}}>
                      <span style={{padding:'2px 8px',borderRadius:10,background:`${nc}20`,color:nc,fontSize:11,fontWeight:700}}>{e.code_niveau||'?'}</span>
                      {e.eleve_id_ecole&&<span style={{fontSize:11,color:'#aaa'}}>#{e.eleve_id_ecole}</span>}
                    </div>
                  </div>
                  {user.role==='surveillant'&&(
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      <button onClick={()=>startEditEleve(e)} style={{background:'#E6F1FB',color:'#378ADD',border:'none',borderRadius:8,padding:'7px 10px',fontSize:13,cursor:'pointer',fontWeight:600}}>\u270f\ufe0f</button>
                      <button onClick={()=>supprimerEleve(e.id)} style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,padding:'7px 10px',fontSize:13,cursor:'pointer'}}>\ud83d\uddd1</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* INSTITUTEURS */}
        {tab==='instituteurs'&&(
          <div style={{padding:'12px'}}>
            {showFormInst&&user.role==='surveillant'&&(
              <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,border:'1.5px solid #378ADD'}}>
                <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>\ud83e\uddd1\u200d\ud83c\udfeb {lang==='ar'?'\u0625\u0636\u0627\u0641\u0629 \u0623\u0633\u062a\u0627\u0630':'Nouvel instituteur'}</div>
                {[{label:lang==='ar'?'\u0627\u0644\u0627\u0633\u0645':'Pr\u00e9nom *',key:'prenom',ph:lang==='ar'?'\u0627\u0644\u0627\u0633\u0645':'Pr\u00e9nom'},
                  {label:lang==='ar'?'\u0627\u0644\u0644\u0642\u0628':'Nom *',key:'nom',ph:lang==='ar'?'\u0627\u0644\u0644\u0642\u0628':'Nom'},
                  {label:lang==='ar'?'\u0627\u0644\u0645\u0639\u0631\u0641':'Identifiant *',key:'identifiant',ph:'ex: m.karim'},
                ].map(f=>(
                  <div key={f.key} style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{f.label}</label>
                    <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                      value={newInst[f.key]} onChange={e=>setNewInst(x=>({...x,[f.key]:e.target.value}))} placeholder={f.ph}/>
                  </div>
                ))}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631':'Mot de passe *'}</label>
                  <input type="password" style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={newInst.mot_de_passe} onChange={e=>setNewInst(x=>({...x,mot_de_passe:e.target.value}))} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"/>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setShowFormInst(false)} style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{lang==='ar'?'\u0625\u0644\u063a\u0627\u0621':'Annuler'}</button>
                  <button onClick={async()=>{await ajouterInstituteur();setShowFormInst(false);}} style={{flex:2,padding:'13px',background:'#378ADD',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{lang==='ar'?'\u062d\u0641\u0638':'Enregistrer'}</button>
                </div>
              </div>
            )}
            {instituteurs.length===0?(
              <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12}}>
                <div style={{fontSize:36,marginBottom:10}}>\ud83e\uddd1\u200d\ud83c\udfeb</div>
                <div style={{fontSize:14}}>{lang==='ar'?'\u0644\u0627 \u064a\u0648\u062c\u062f \u0623\u0633\u0627\u062a\u0630\u0629':'Aucun instituteur'}</div>
              </div>
            ):instituteurs.map(inst=>{
              const nb=eleves.filter(e=>e.instituteur_referent_id===inst.id).length;
              return(
                <div key={inst.id} style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:8,border:'0.5px solid #e0e0d8',display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:'#E6F1FB',color:'#0C447C',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:15,flexShrink:0}}>
                    {((inst.prenom||'?')[0])+((inst.nom||'?')[0])}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14}}>{inst.prenom} {inst.nom}</div>
                    <div style={{fontSize:12,color:'#888',marginTop:2}}>{inst.identifiant} \u00b7 {nb} {lang==='ar'?'\u0637\u0627\u0644\u0628':'\u00e9l\u00e8ve(s)'}</div>
                  </div>
                  {user.role==='surveillant'&&(
                    <button onClick={()=>supprimerInstituteur(inst)} style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,padding:'8px 12px',fontSize:13,cursor:'pointer',fontWeight:600}}>\ud83d\uddd1</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PARENTS */}
        {tab==='parents'&&(
          <div style={{padding:'12px'}}>
            {showFormParent&&user.role==='surveillant'&&(
              <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,border:`1.5px solid ${editingParentId?'#378ADD':'#EF9F27'}`}}>
                <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:14}}>
                  {editingParentId?(lang==='ar'?'\u062a\u0639\u062f\u064a\u0644 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631':'\u270f\ufe0f Modifier parent'):(lang==='ar'?'\u0625\u0636\u0627\u0641\u0629 \u0648\u0644\u064a \u0623\u0645\u0631':'\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66 Nouveau parent')}
                </div>
                {[{label:lang==='ar'?'\u0627\u0644\u0627\u0633\u0645':'Pr\u00e9nom *',key:'prenom',ph:lang==='ar'?'\u0627\u0644\u0627\u0633\u0645':'Pr\u00e9nom'},
                  {label:lang==='ar'?'\u0627\u0644\u0644\u0642\u0628':'Nom *',key:'nom',ph:lang==='ar'?'\u0627\u0644\u0644\u0642\u0628':'Nom'},
                  {label:lang==='ar'?'\u0627\u0644\u0645\u0639\u0631\u0641':'Identifiant *',key:'identifiant',ph:'parent.nom'},
                  {label:lang==='ar'?'\u0627\u0644\u0647\u0627\u062a\u0641':'T\u00e9l\u00e9phone',key:'telephone',ph:'06xxxxxxxx'},
                ].map(f=>(
                  <div key={f.key} style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{f.label}</label>
                    <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                      value={formParent[f.key]} onChange={e=>setFormParent(x=>({...x,[f.key]:e.target.value}))} placeholder={f.ph}/>
                  </div>
                ))}
                {!editingParentId&&(
                  <div style={{marginBottom:14}}>
                    <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:5}}>{lang==='ar'?'\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631':'Mot de passe *'}</label>
                    <input type="password" style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box'}}
                      value={formParent.mot_de_passe} onChange={e=>setFormParent(x=>({...x,mot_de_passe:e.target.value}))} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"/>
                  </div>
                )}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666',display:'block',marginBottom:8}}>
                    {lang==='ar'?'\u0631\u0628\u0637 \u0628\u0627\u0644\u0637\u0644\u0627\u0628':'Lier aux \u00e9l\u00e8ves'}
                    {formParent.eleve_ids?.length>0&&<span style={{marginRight:8,fontSize:11,color:'#1D9E75',fontWeight:700}}> ({formParent.eleve_ids.length} \u2713)</span>}
                  </label>
                  <div style={{maxHeight:160,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
                    {eleves.map(el=>{
                      const nc=NC[el.code_niveau||'1']||'#888';
                      const sel=(formParent.eleve_ids||[]).includes(el.id);
                      return(
                        <div key={el.id} onClick={()=>setFormParent(f=>({...f,eleve_ids:sel?f.eleve_ids.filter(id=>id!==el.id):[...(f.eleve_ids||[]),el.id]}))}
                          style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,cursor:'pointer',
                            background:sel?`${nc}10`:'#f5f5f0',border:`1.5px solid ${sel?nc:'#e0e0d8'}`}}>
                          <div style={{width:20,height:20,borderRadius:5,flexShrink:0,border:`1.5px solid ${sel?nc:'#ccc'}`,background:sel?nc:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {sel&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>\u2713</span>}
                          </div>
                          <div style={{width:30,height:30,borderRadius:'50%',background:`${nc}20`,color:nc,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0}}>
                            {((el.prenom||'?')[0])+((el.nom||'?')[0])}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:600}}>{el.prenom} {el.nom}</div>
                            <span style={{fontSize:11,padding:'1px 6px',borderRadius:8,background:`${nc}20`,color:nc,fontWeight:700}}>{el.code_niveau||'?'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{setShowFormParent(false);setEditingParentId(null);setFormParent({prenom:'',nom:'',identifiant:'',mot_de_passe:'',telephone:'',eleve_ids:[]});}}
                    style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    {lang==='ar'?'\u0625\u0644\u063a\u0627\u0621':'Annuler'}
                  </button>
                  <button onClick={async()=>{
                    if(!formParent.prenom||!formParent.nom||!formParent.identifiant){toast.warning(lang==='ar'?'\u064a\u0631\u062c\u0649 \u0645\u0644\u0621 \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629':'Remplissez les champs obligatoires');return;}
                    if(!editingParentId&&!formParent.mot_de_passe){toast.warning(lang==='ar'?'\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629':'Mot de passe requis');return;}
                    let userId=editingParentId;
                    if(!editingParentId){
                      const{data:ud,error:ue}=await supabase.from('utilisateurs').insert({prenom:formParent.prenom,nom:formParent.nom,identifiant:formParent.identifiant,mot_de_passe:formParent.mot_de_passe,role:'parent',ecole_id:user.ecole_id}).select().single();
                      if(ue){toast.error(ue.message||'Erreur');return;}
                      userId=ud.id;
                    } else {
                      const{error:pe}=await supabase.from('utilisateurs').update({prenom:formParent.prenom,nom:formParent.nom}).eq('id',userId);
                      if(pe){toast.error(pe.message||'Erreur');return;}
                    }
                    await supabase.from('parent_eleve').delete().eq('parent_id',userId);
                    for(const eid of(formParent.eleve_ids||[])){await supabase.from('parent_eleve').insert({parent_id:userId,eleve_id:eid,ecole_id:user.ecole_id}).catch(()=>{});}
                    toast.success(lang==='ar'?'\u062a\u0645 \u0627\u0644\u062d\u0641\u0638':'\u2705 Enregistr\u00e9 !');
                    setShowFormParent(false);setEditingParentId(null);setFormParent({prenom:'',nom:'',identifiant:'',mot_de_passe:'',telephone:'',eleve_ids:[]});loadData();
                  }}
                    style={{flex:2,padding:'13px',background:editingParentId?'#378ADD':'#EF9F27',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                    {editingParentId?(lang==='ar'?'\u062a\u062d\u062f\u064a\u062b':'Mettre \u00e0 jour \u2713'):(lang==='ar'?'\u062d\u0641\u0638':'Enregistrer')}
                  </button>
                </div>
              </div>
            )}
            {parents.length===0?(
              <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12}}>
                <div style={{fontSize:36,marginBottom:10}}>\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66</div>
                <div style={{fontSize:14}}>{lang==='ar'?'\u0644\u0627 \u064a\u0648\u062c\u062f \u0622\u0628\u0627\u0621':'Aucun parent'}</div>
              </div>
            ):parents.map(p=>{
              const enfants=eleves.filter(e=>(p.eleve_ids||[]).includes(e.id));
              return(
                <div key={p.id} style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:8,border:'0.5px solid #e0e0d8'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:enfants.length?8:0}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:'#FAEEDA',color:'#633806',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:15,flexShrink:0}}>
                      {((p.prenom||'?')[0])+((p.nom||'?')[0])}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14}}>{p.prenom} {p.nom}</div>
                      <div style={{fontSize:12,color:'#888'}}>{p.telephone||p.identifiant}</div>
                    </div>
                    {user.role==='surveillant'&&(
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setEditingParentId(p.id);setFormParent({prenom:p.prenom,nom:p.nom,identifiant:p.identifiant,mot_de_passe:'',telephone:p.telephone||'',eleve_ids:eleves.filter(e=>(p.eleve_ids||[]).includes(e.id)).map(e=>e.id)});setShowFormParent(true);window.scrollTo(0,0);}}
                          style={{background:'#E6F1FB',color:'#378ADD',border:'none',borderRadius:8,padding:'7px 10px',fontSize:13,cursor:'pointer',fontWeight:600}}>\u270f\ufe0f</button>
                        <button onClick={()=>supprimerParent&&supprimerParent(p.id)}
                          style={{background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,padding:'7px 10px',fontSize:13,cursor:'pointer'}}>\ud83d\uddd1</button>
                      </div>
                    )}
                  </div>
                  {enfants.length>0&&(
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',paddingLeft:56}}>
                      {enfants.map(e=>{const nc=NC[e.code_niveau||'1']||'#888';return(<span key={e.id} style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:`${nc}20`,color:nc,fontWeight:600}}>{e.prenom} {e.nom}</span>);})}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {confirmModal.isOpen&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:320,width:'100%'}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
              <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={hideConfirm} style={{flex:1,padding:'12px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>{lang==='ar'?'\u0625\u0644\u063a\u0627\u0621':'Annuler'}</button>
                <button onClick={confirmModal.onConfirm} style={{flex:1,padding:'12px',background:confirmModal.confirmColor||'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>{confirmModal.confirmLabel}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }



  return (
    <div>
      <div className="page-title">{t(lang, 'gestion')}</div>
      {msg.text && <div className={msg.type === 'error' ? 'error-box' : 'success-box'}>{msg.text}</div>}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:0,flexWrap:'wrap',gap:8}}>
        <div className="tabs-row" style={{marginBottom:0}}>
          <div className={`tab ${tab === 'eleves' ? 'active' : ''}`} onClick={() => setTab('eleves')}>{t(lang, 'eleves')}</div>
          <div className={`tab ${tab === 'instituteurs' ? 'active' : ''}`} onClick={() => setTab('instituteurs')}>{t(lang, 'instituteurs')}</div>
          <div className={`tab ${tab === 'parents' ? 'active' : ''}`} onClick={() => setTab('parents')}>👨‍👩‍👦 {lang==='ar'?'الآباء':(lang==='ar'?'الآباء':'Parents')}</div>
          <div className={`tab ${tab === 'parametres' ? 'active' : ''}`} onClick={() => setTab('parametres')}>⚙️ {lang==='ar'?'إعدادات':'Paramètres'}</div>
        </div>
        <div style={{display:'flex',gap:6}}>
          {tab==='eleves'&&<>
            <button onClick={exportElevesExcel} style={{padding:'6px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>📥 Excel</button>
            <button onClick={exportElevesPDF} style={{padding:'6px 12px',background:'#534AB7',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>🖨️ PDF</button>
          </>}
          {tab==='instituteurs'&&<>
            <button onClick={exportInstituteursExcel} style={{padding:'6px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>📥 Excel</button>
            <button onClick={exportInstituteursPDF} style={{padding:'6px 12px',background:'#534AB7',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>🖨️ PDF</button>
          </>}
          {tab==='parents'&&<button onClick={exportParentsExcel} style={{padding:'6px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>📥 Excel</button>}
        </div>
      </div>

      {tab === 'parametres' && (
        <div>
          <div style={{fontSize:13,color:'#888',marginBottom:'1.25rem'}}>
            {lang==='ar'?'إعدادات المدرسة — تكوين المستويات والامتحانات':'Configuration école — niveaux, examens et blocs'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:14}}>
            {[
              {icon:'📚', label:lang==='ar'?'المستويات':'Niveaux',
               desc:lang==='ar'?'إدارة مستويات المدرسة وألوانها':"Configurer les niveaux de l'école",
               page:'niveaux', color:'#1D9E75', bg:'#E1F5EE'},
              {icon:'📝', label:lang==='ar'?'الامتحانات':'Examens',
               desc:lang==='ar'?'تكوين الامتحانات والحدود':'Configurer les examens et seuils',
               page:'examens', color:'#EF9F27', bg:'#FAEEDA'},

              {icon:'📦', label:lang==='ar'?'مجموعات السور':'Ensembles',
               desc:lang==='ar'?'تجميع السور في مجموعات':'Grouper les sourates par ensemble',
               page:'ensembles', color:'#D85A30', bg:'#FAECE7'},
              {icon:'🏅', label:lang==='ar'?'نتائج الامتحانات':'Résultats',
               desc:lang==='ar'?'تسجيل ومتابعة نتائج الامتحانات':'Saisir et consulter les résultats',
               page:'resultats_examens', color:'#534AB7', bg:'#EEEDFE'},
            ].map(item=>(
              <div key={item.page} onClick={()=>navigate(item.page)}
                style={{background:'#fff',borderRadius:14,padding:'1.25rem',
                  border:`0.5px solid ${item.color}20`,cursor:'pointer',
                  display:'flex',alignItems:'center',gap:14,
                  transition:'transform 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                <div style={{width:52,height:52,borderRadius:14,background:item.bg,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:24,flexShrink:0}}>
                  {item.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15,color:'#1a1a1a',marginBottom:4}}>{item.label}</div>
                  <div style={{fontSize:12,color:'#888',lineHeight:1.4}}>{item.desc}</div>
                </div>
                <span style={{color:'#ccc',fontSize:18}}>›</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'eleves' && (
        <div>
          {/* Formulaire ajout / modification */}
          {!editEleve ? (
            <>
              <div className="section-label">{t(lang, 'ajouter_eleve')}</div>
              <div className="card">
                <div className="form-grid">
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'prenom')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={newEleve.prenom} onChange={e => setNewEleve({ ...newEleve, prenom: e.target.value })} placeholder={t(lang, 'prenom')} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'nom_label')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={newEleve.nom} onChange={e => setNewEleve({ ...newEleve, nom: e.target.value })} placeholder={t(lang, 'nom_label')} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'niveau')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={newEleve.niveau} onChange={e => setNewEleve({ ...newEleve, niveau: e.target.value })}>
                      <option value="Débutant">{lang==='ar'?'مبتدئ':'Débutant'}</option>
                      <option value="Intermédiaire">{lang==='ar'?'متوسط':'Intermédiaire'}</option>
                      <option value="Avancé">{lang==='ar'?'متقدم':'Avancé'}</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المستوى الدراسي':lang==='en'?'Class level':(lang==='ar'?'الصف الدراسي':'Niveau scolaire')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={newEleve.code_niveau} onChange={e => setNewEleve({ ...newEleve, code_niveau: e.target.value })}>
                      {niveauxActifs.map(n=><option key={n.code} value={n.code}>{n.code} — {n.nom}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم تعريف الطالب':lang==='en'?'Student ID':(lang==='ar'?'رقم التعريف':'ID Élève')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={newEleve.eleve_id_ecole} onChange={e => setNewEleve({ ...newEleve, eleve_id_ecole: e.target.value })} placeholder={lang==='ar'?'رقم التعريف':lang==='en'?'Student ID':'ID défini par la direction'}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'referent')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={newEleve.instituteur_referent_id} onChange={e => setNewEleve({ ...newEleve, instituteur_referent_id: e.target.value })}>
                      <option value="">{t(lang, 'choisir')}</option>
                      {instituteurs.map(i => <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                    </select>
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
                <div className="form-grid">
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'prenom')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={editEleve.prenom} onChange={e => setEditEleve({ ...editEleve, prenom: e.target.value })} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'nom_label')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={editEleve.nom} onChange={e => setEditEleve({ ...editEleve, nom: e.target.value })} />
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'niveau')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={editEleve.niveau} onChange={e => setEditEleve({ ...editEleve, niveau: e.target.value })}>
                      <option value="Débutant">{lang==='ar'?'مبتدئ':'Débutant'}</option>
                      <option value="Intermédiaire">{lang==='ar'?'متوسط':'Intermédiaire'}</option>
                      <option value="Avancé">{lang==='ar'?'متقدم':'Avancé'}</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المستوى الدراسي':lang==='en'?'Class level':(lang==='ar'?'الصف الدراسي':'Niveau scolaire')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={editEleve.code_niveau||'1'} onChange={e => {
                      const oldNiv = editEleve.code_niveau||'1';
                      const newNiv = e.target.value;
                      const wasSourate = ['5B','5A','2M'].includes(oldNiv);
                      const isNowHizb = ['2M','2','1'].includes(newNiv);
                      if (wasSourate && isNowHizb) {
                        showConfirm(
                          lang==='ar'?'⚠️ تغيير نظام الطالب':'⚠️ Changement de système',
                          lang==='ar'?'هذا الطالب ينتقل من نظام السور إلى نظام الحزب والثُّمن. يجب تحديد المكتسبات بالحزب والثُّمن.':'Cet élève passe du système Sourates au système Hizb/Tomon. Les acquis doivent être redéfinis.',
                          ()=>{ setEditEleve({ ...editEleve, code_niveau: newNiv, hizb_depart: 0, tomon_depart: 1, sourates_acquises: 0 });
                          setEditShowAcquisSelector(true);; hideConfirm(); },
                          lang==='ar'?'متابعة':'Continuer',
                          '#EF9F27'
                        );
                      } else {
                        setEditEleve({ ...editEleve, code_niveau: newNiv });
                      }
                    }}>
                      <option value="5B">5B — {lang==='ar'?'تمهيدي':lang==='en'?'Preschool':(lang==='ar'?'تمهيدي':'Préscolaire')}</option>
                      <option value="5A">5A — {lang==='ar'?'ابتدائي 1-2':lang==='en'?'Primary 1-2':'Primaire 1-2'}</option>
                      <option value="2M">2M — {lang==='ar'?'ابتدائي 3-4':lang==='en'?'Primary 3-4':'Primaire 3-4'}</option>
                      <option value="2">2 — {lang==='ar'?'ابتدائي 5-6':lang==='en'?'Primary 5-6':'Primaire 5-6'}</option>
                      <option value="1">1 — {lang==='ar'?'إعدادي/ثانوي':lang==='en'?'Middle/High school':(lang==='ar'?'إعدادي/ثانوي':'Collège/Lycée')}</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم تعريف الطالب':lang==='en'?'Student ID':(lang==='ar'?'رقم التعريف':'ID Élève')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <input className="field-input" value={editEleve.eleve_id_ecole||''} onChange={e => setEditEleve({ ...editEleve, eleve_id_ecole: e.target.value })} placeholder={lang==='ar'?'رقم التعريف':lang==='en'?'Student ID':'ID défini par la direction'}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{t(lang, 'referent')} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={editEleve.instituteur_referent_id || ''} onChange={e => setEditEleve({ ...editEleve, instituteur_referent_id: e.target.value })}>
                      <option value="">{t(lang, 'choisir')}</option>
                      {instituteurs.map(i => <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                    </select>
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
                      codeNiveau={editEleve.code_niveau||'1'}
                      hizb={editEleve.hizb_depart} tomon={editEleve.tomon_depart} lang={lang}
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
          <div className="section-label">{t(lang, 'eleves_inscrits')} ({eleves.length})</div>
          {loading ? <div className="loading">...</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{width:'28%'}}>{t(lang, 'eleve')}</th>
                  <th style={{width:'16%'}}>{t(lang, 'niveau')}</th>
                  <th style={{width:'20%'}}>{t(lang, 'referent')}</th>
                  <th style={{width:'22%'}}>{t(lang, 'acquis_anterieurs')}</th>
                  <th style={{width:'14%'}}></th>
                </tr></thead>
                <tbody>
                  {eleves.length === 0 && <tr><td colSpan={5} className="empty">{t(lang, 'aucun_eleve')}</td></tr>}
                  {eleves.map(e => (
                    <tr key={e.id} style={{ background: editEleve?.id === e.id ? '#E1F5EE' : '' }}>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={e.prenom} nom={e.nom}/>{e.prenom} {e.nom}</div></td>
                      <td><span className={`badge ${e.niveau==='Avancé'||e.niveau==='متقدم'||e.niveau==='Advanced'?'badge-green':e.niveau==='Intermédiaire'||e.niveau==='متوسط'||e.niveau==='Intermediate'?'badge-blue':'badge-amber'}`} style={{fontSize:10}}>{e.niveau}</span></td>
                      <td style={{fontSize:12,color:'#888'}}>{instNom(e.instituteur_referent_id)}</td>
                      <td>
                        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                          <span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:'#E1F5EE',color:'#085041'}}>{e.code_niveau||'1'}</span>
                          {e.eleve_id_ecole&&<span style={{fontSize:11,color:'#888'}}>#{e.eleve_id_ecole}</span>}
                        </div>
                        {['1','2','2M'].includes(e.code_niveau||'1')&&<div style={{fontSize:10,color:'#bbb',marginTop:2}}>Hizb {e.hizb_depart}, T.{e.tomon_depart}</div>}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="action-btn" onClick={() => { setEditEleve({...e}); setEditShowAcquisSelector(false); window.scrollTo(0,0); }}>{t(lang, 'modifier_btn')}</button>
                          <button onClick={() => supprimerEleve(e.id)}
                            style={{padding:'4px 10px',background:'#FCEBEB',color:'#E24B4A',border:'0.5px solid #E24B4A40',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>
                            🗑 {lang==='ar'?'حذف':'Supprimer'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

          <div className="section-label">{t(lang, 'instituteurs_actifs')} ({instituteurs.length})</div>
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
          <div style={{fontSize:12,color:'#888',marginBottom:8}}>{parents.length} {lang==='ar'?'ولي أمر':'parent(s)'}</div>
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
    </div>
  );
}
