import React, { useState, useEffect } from 'react';
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
function AcquisSelector({ codeNiveau, hizb, tomon, onHizbChange, onTomonChange, souratesAcquises, onSouratesChange, lang }) {
  const isSourate = ['5B','5A','2M'].includes(codeNiveau);

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
            style={{width:36,height:36,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:18}}>−</button>
          <div style={{flex:1,textAlign:'center'}}>
            <div style={{fontSize:32,fontWeight:800,color:'#1D9E75'}}>{nbAcquis}</div>
            <div style={{fontSize:11,color:'#888'}}>/ {souratesNiveau.length} {lang==='ar'?'سورة':lang==='en'?'surahs':'sourates'}</div>
          </div>
          <button onClick={()=>onSouratesChange(Math.min(souratesNiveau.length, nbAcquis+1))}
            style={{width:36,height:36,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:18}}>+</button>
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
        <div style={{fontSize:12,color:'#888',marginBottom:6,fontWeight:500}}>{lang==='ar'?'الحزب (1-60)':lang==='en'?'Hizb (1-60)':'Hizb (1-60)'}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>onHizbChange(Math.max(1,hizb-1))} style={{width:32,height:32,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:16}}>-</button>
          <div style={{flex:1,display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3}}>
            {Array.from({length:60},(_,i)=>i+1).map(n=>(
              <div key={n} onClick={()=>onHizbChange(n)} style={{height:28,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:n===hizb?700:400,cursor:'pointer',background:n===hizb?'#1D9E75':n<hizb?'#E1F5EE':'#f0f0ec',color:n===hizb?'#fff':n<hizb?'#085041':'#999',transition:'all 0.1s'}}>
                {n}
              </div>
            ))}
          </div>
          <button onClick={()=>onHizbChange(Math.min(60,hizb+1))} style={{width:32,height:32,border:'0.5px solid #e0e0d8',borderRadius:6,background:'#fff',cursor:'pointer',fontSize:16}}>+</button>
        </div>
        <div style={{textAlign:'center',marginTop:6,fontSize:14,fontWeight:700,color:'#1D9E75'}}>Hizb {hizb}</div>
      </div>
      <div>
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
      </div>

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


export default function Gestion({ user, navigate, goBack, lang = 'fr' }) {
  const [tab, setTab] = useState('eleves');
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

  const [newEleve, setNewEleve] = useState({ prenom: '', nom: '', niveau: 'Débutant', code_niveau: '1', eleve_id_ecole: '', instituteur_referent_id: '', hizb_depart: 1, tomon_depart: 1, sourates_acquises: 0 });
  const [newInst, setNewInst] = useState({ prenom: '', nom: '', identifiant: '', mot_de_passe: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: e } = await supabase.from('eleves').select('*').order('nom');
    const { data: i } = await supabase.from('utilisateurs').select('*').eq('role', 'instituteur').order('nom');
    setEleves(e || []);
    setInstituteurs(i || []);
    const { data: pd } = await supabase.from('parents').select('*, liens:parent_eleve(eleve_id, eleve:eleve_id(prenom,nom))').order('nom');
    setParents(pd||[]);
    setLoading(false);
  };

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const ajouterEleve = async () => {
    if (!newEleve.prenom?.trim()) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    if (!newEleve.nom?.trim()) return showMsg('error', t(lang, 'prenom_nom_obligatoires'));
    if (!newEleve.code_niveau) return showMsg('error', t(lang, 'tous_champs_obligatoires'));
    if (!newEleve.eleve_id_ecole?.trim()) return showMsg('error', lang==='ar'?'رقم تعريف الطالب إلزامي':lang==='en'?'Student ID is required':"L'ID élève est obligatoire");
    if (!newEleve.instituteur_referent_id) return showMsg('error', lang==='ar'?'يجب اختيار الأستاذ المرجع':lang==='en'?'Please select a teacher':'Veuillez sélectionner un instituteur référent');
    const { error } = await supabase.from('eleves').insert({
      prenom: newEleve.prenom, nom: newEleve.nom, niveau: newEleve.niveau,
      code_niveau: newEleve.code_niveau || '1',
      eleve_id_ecole: newEleve.eleve_id_ecole || null,
      instituteur_referent_id: newEleve.instituteur_referent_id || null,
      hizb_depart: parseInt(newEleve.hizb_depart) || 1,
      tomon_depart: parseInt(newEleve.tomon_depart) || 1,
      sourates_acquises: parseInt(newEleve.sourates_acquises) || 0
    });
    if (error) return showMsg('error', t(lang, 'erreur_ajout'));
    showMsg('success', t(lang, 'eleve_ajoute'));
    setNewEleve({ prenom: '', nom: '', niveau: 'Débutant', instituteur_referent_id: '', hizb_depart: 1, tomon_depart: 1 });
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
      hizb_depart: parseInt(editEleve.hizb_depart) || 1,
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
        ? 'سيتم حذف جميع بيانات '+nom+' (التسميعات، الأهداف، الاشتراكات). هذا الإجراء لا رجعة منه!'
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
    if (!newInst.prenom || !newInst.nom || !newInst.identifiant || !newInst.mot_de_passe)
      return showMsg('error', t(lang, 'tous_champs_obligatoires'));
    const { error } = await supabase.from('utilisateurs').insert({
      prenom: newInst.prenom, nom: newInst.nom,
      identifiant: newInst.identifiant, mot_de_passe: newInst.mot_de_passe, role: 'instituteur'
    });
    if (error) return showMsg('error', error.message.includes('unique') ? t(lang, 'identifiant_utilise') : t(lang, 'erreur_ajout'));
    showMsg('success', t(lang, 'instituteur_ajoute'));
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

  const [editInstituteur, setEditInstituteur] = useState(null);
  const [formEditInst, setFormEditInst] = useState({prenom:'',nom:'',identifiant:'',mot_de_passe:''});

  const instNom = (id) => { const i = instituteurs.find(x => x.id === id); return i ? `${i.prenom} ${i.nom}` : '—'; };
  const niveaux = [
    { value: 'Débutant', label: t(lang, 'debutant') },
    { value: 'Intermédiaire', label: t(lang, 'intermediaire') },
    { value: 'Avancé', label: t(lang, 'avance') },
  ];


  const exportParentsExcel = async () => {
    if (!window.XLSX) {
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['#',lang==='ar'?'الاسم':'Prénom',lang==='ar'?'اللقب':'Nom',lang==='ar'?'المعرف':'Identifiant',lang==='ar'?'الهاتف':'Téléphone',lang==='ar'?'الأبناء':'Enfants'],
      ...parents.map((p,i)=>[i+1,p.prenom,p.nom,p.identifiant,p.telephone||'—',(p.liens||[]).map(l=>l.eleve?l.eleve.prenom+' '+l.eleve.nom:'?').join(', ')])
    ]);
    ws['!cols']=[{wch:4},{wch:16},{wch:16},{wch:18},{wch:14},{wch:30}];
    XLSX.utils.book_append_sheet(wb,ws,'Parents');
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
    if (!w) { alert((lang==='ar'?'يرجى السماح بالنوافذ المنبثقة':'Autorisez les popups')); return; }
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
    if (!w) { alert((lang==='ar'?'يرجى السماح بالنوافذ المنبثقة':'Autorisez les popups')); return; }
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

  return (
    <div>
      <div className="page-title">{t(lang, 'gestion')}</div>
      {msg.text && <div className={msg.type === 'error' ? 'error-box' : 'success-box'}>{msg.text}</div>}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:0,flexWrap:'wrap',gap:8}}>
        <div className="tabs-row" style={{marginBottom:0}}>
          <div className={`tab ${tab === 'eleves' ? 'active' : ''}`} onClick={() => setTab('eleves')}>{t(lang, 'eleves')}</div>
          <div className={`tab ${tab === 'instituteurs' ? 'active' : ''}`} onClick={() => setTab('instituteurs')}>{t(lang, 'instituteurs')}</div>
          <div className={`tab ${tab === 'parents' ? 'active' : ''}`} onClick={() => setTab('parents')}>👨‍👩‍👦 {lang==='ar'?'الآباء':'Parents'}</div>
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
                      {niveaux.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المستوى الدراسي':lang==='en'?'Class level':'Niveau scolaire'} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={newEleve.code_niveau} onChange={e => setNewEleve({ ...newEleve, code_niveau: e.target.value })}>
                      <option value="5B">5B — {lang==='ar'?'تمهيدي':lang==='en'?'Preschool':(lang==='ar'?'تمهيدي':'Préscolaire')}</option>
                      <option value="5A">5A — {lang==='ar'?'ابتدائي 1-2':lang==='en'?'Primary 1-2':'Primaire 1-2'}</option>
                      <option value="2M">2M — {lang==='ar'?'ابتدائي 3-4':lang==='en'?'Primary 3-4':'Primaire 3-4'}</option>
                      <option value="2">2 — {lang==='ar'?'ابتدائي 5-6':lang==='en'?'Primary 5-6':'Primaire 5-6'}</option>
                      <option value="1">1 — {lang==='ar'?'إعدادي/ثانوي':lang==='en'?'Middle/High school':(lang==='ar'?'إعدادي/ثانوي':'Collège/Lycée')}</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'رقم تعريف الطالب':lang==='en'?'Student ID':'ID Élève'} <span style={{color:'#E24B4A'}}>*</span></label>
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
                      codeNiveau={newEleve.code_niveau}
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
                      {niveaux.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المستوى الدراسي':lang==='en'?'Class level':'Niveau scolaire'} <span style={{color:'#E24B4A'}}>*</span></label>
                    <select className="field-select" value={editEleve.code_niveau||'1'} onChange={e => {
                      const oldNiv = editEleve.code_niveau||'1';
                      const newNiv = e.target.value;
                      const wasSourate = ['5B','5A','2M'].includes(oldNiv);
                      const isNowHizb = ['2M','2','1'].includes(newNiv);
                      if (wasSourate && isNowHizb) {
                        showConfirm(
                          lang==='ar'?'⚠️ تغيير نظام الطالب':'⚠️ Changement de système',
                          lang==='ar'?'هذا الطالب ينتقل من نظام السور إلى نظام الحزب والثُّمن. يجب تحديد المكتسبات بالحزب والثُّمن.':'Cet élève passe du système Sourates au système Hizb/Tomon. Les acquis doivent être redéfinis.',
                          ()=>{ setEditEleve({ ...editEleve, code_niveau: newNiv, hizb_depart: 1, tomon_depart: 1, sourates_acquises: 0 });
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
                    <label className="field-lbl">{lang==='ar'?'رقم تعريف الطالب':lang==='en'?'Student ID':'ID Élève'} <span style={{color:'#E24B4A'}}>*</span></label>
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
              <div className="field-group"><label className="field-lbl">{t(lang, 'identifiant_label')}</label><input className="field-input" value={newInst.identifiant} onChange={e => setNewInst({...newInst,identifiant:e.target.value})} placeholder="ex: m.karim"/></div>
              <div className="field-group"><label className="field-lbl">{t(lang, 'mot_de_passe')}</label><input className="field-input" type="password" value={newInst.mot_de_passe} onChange={e => setNewInst({...newInst,mot_de_passe:e.target.value})} placeholder="••••••••"/></div>
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
                if(!formParent.prenom||!formParent.nom||!formParent.identifiant) return alert(lang==='ar'?'يرجى ملء الحقول المطلوبة':'Remplissez les champs obligatoires');
                if(!editingParentId && !formParent.mot_de_passe) return alert(lang==='ar'?'كلمة المرور مطلوبة':'Mot de passe requis');
                let pid = editingParentId;
                if(editingParentId) {
                  const upd={prenom:formParent.prenom,nom:formParent.nom,identifiant:formParent.identifiant,telephone:formParent.telephone||null};
                  if(formParent.mot_de_passe) upd.mot_de_passe=formParent.mot_de_passe;
                  const {error:ue}=await supabase.from('parents').update(upd).eq('id',editingParentId);
                  if(ue){alert(ue.message);return;}
                  await supabase.from('parent_eleve').delete().eq('parent_id',editingParentId);
                } else {
                  const {data:pd,error:pe}=await supabase.from('parents').insert({prenom:formParent.prenom,nom:formParent.nom,identifiant:formParent.identifiant,mot_de_passe:formParent.mot_de_passe,telephone:formParent.telephone||null,created_by:user.id}).select().single();
                  if(pe){alert(pe.message);return;}
                  pid=pd.id;
                }
                if(formParent.eleve_ids.length>0){
                  await supabase.from('parent_eleve').insert(formParent.eleve_ids.map(eid=>({parent_id:pid,eleve_id:eid})));
                }
                setShowFormParent(false);
                setEditingParentId(null);
                setFormParent({prenom:'',nom:'',identifiant:'',mot_de_passe:'',telephone:'',eleve_ids:[],searchEleve:''});
                const {data:pd2}=await supabase.from('parents').select('*, liens:parent_eleve(eleve_id, eleve:eleve_id(prenom,nom))').order('nom');
                setParents(pd2||[]);
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
                    {(p.liens||[]).map(l=>l.eleve&&(
                      <span key={l.eleve_id} style={{padding:'1px 6px',borderRadius:8,fontSize:10,background:'#E1F5EE',color:'#085041'}}>
                        👦 {l.eleve.prenom} {l.eleve.nom}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <button onClick={()=>{
                    const liens=(p.liens||[]).map(l=>l.eleve_id);
                    setFormParent({prenom:p.prenom,nom:p.nom,identifiant:p.identifiant,mot_de_passe:p.mot_de_passe||'',telephone:p.telephone||'',eleve_ids:liens,searchEleve:''});
                    setEditingParentId(p.id);
                    setShowFormParent(true);
                    window.scrollTo(0,0);
                  }} style={{padding:'4px 8px',borderRadius:6,background:'#E6F1FB',color:'#378ADD',border:'0.5px solid #378ADD30',cursor:'pointer',fontSize:11,fontWeight:600}}>✏️ {lang==='ar'?'تعديل':'Modifier'}</button>
                  <button onClick={()=>showConfirm(
                    lang==='ar'?'حذف ولي الأمر':'Supprimer le parent',
                    (lang==='ar'?'هل تريد حذف حساب ':'Supprimer le compte de ')+(p.prenom+' '+p.nom)+'?',
                    async()=>{
                      await supabase.from('parent_eleve').delete().eq('parent_id',p.id);
                      await supabase.from('parents').delete().eq('id',p.id);
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
