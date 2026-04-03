import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import { getInitiales } from '../lib/helpers';
import { t } from '../lib/i18n';

const CATEGORIES = [
  { val: 'salaire',     label: 'Salaires / Honoraires', labelAr: 'الرواتب',       icon: '👨‍🏫', color: '#534AB7' },
  { val: 'fournitures', label: 'Fournitures scolaires',  labelAr: 'اللوازم',       icon: '📚', color: '#378ADD' },
  { val: 'entretien',   label: 'Entretien / Réparations',labelAr: 'الصيانة',       icon: '🔧', color: '#EF9F27' },
  { val: 'utilities',   label: 'Utilities',               labelAr: 'الفواتير',      icon: '💡', color: '#1D9E75' },
  { val: 'evenement',   label: 'Événements',              labelAr: 'الفعاليات',     icon: '🎉', color: '#E24B4A' },
  { val: 'autre',       label: 'Autre',                   labelAr: 'أخرى',         icon: '📦', color: '#888'    },
];

const STATUTS = [
  { val: 'paye',     label: 'Payé',          labelAr: 'مدفوع',       color: '#1D9E75', bg: '#E1F5EE' },
  { val: 'partiel',  label: 'Partiel',        labelAr: 'جزئي',        color: '#EF9F27', bg: '#FAEEDA' },
  { val: 'non_paye', label: 'Non payé',       labelAr: 'غير مدفوع',   color: '#E24B4A', bg: '#FCEBEB' },
  { val: 'exonere',  label: 'Exonéré',        labelAr: 'معفى',        color: '#888',    bg: '#f5f5f0' },
];

const TYPE_PERIODES = [
  { val: 'mois',      label: 'Mois',       labelAr: 'شهر' },
  { val: 'trimestre', label: 'Trimestre',  labelAr: 'فصل' },
  { val: 'semestre',  label: 'Semestre',   labelAr: 'نصف سنة' },
  { val: 'annee',     label: 'Année',      labelAr: 'سنة' },
];

const MOIS = [
  { val:'01', fr:'Janvier', ar:'يناير' }, { val:'02', fr:'Février', ar:'فبراير' },
  { val:'03', fr:'Mars',    ar:'مارس'  }, { val:'04', fr:'Avril',   ar:'أبريل'  },
  { val:'05', fr:'Mai',     ar:'ماي'   }, { val:'06', fr:'Juin',    ar:'يونيو'  },
  { val:'07', fr:'Juillet', ar:'يوليوز'}, { val:'08', fr:'Août',    ar:'غشت'   },
  { val:'09', fr:'Septembre',ar:'شتنبر'}, { val:'10', fr:'Octobre', ar:'أكتوبر' },
  { val:'11', fr:'Novembre',ar:'نونبر' }, { val:'12', fr:'Décembre',ar:'دجنبر' },
];
const TRIMESTRES = [
  { val:'T1', fr:'T1 (Jan-Mar)', ar:'الفصل 1' },
  { val:'T2', fr:'T2 (Avr-Jun)', ar:'الفصل 2' },
  { val:'T3', fr:'T3 (Jul-Sep)', ar:'الفصل 3' },
  { val:'T4', fr:'T4 (Oct-Déc)', ar:'الفصل 4' },
];
const SEMESTRES = [
  { val:'S1', fr:'S1 (Jan-Jun)', ar:'النصف 1' },
  { val:'S2', fr:'S2 (Jul-Déc)', ar:'النصف 2' },
];

const getAnnees = () => {
  const current = new Date().getFullYear();
  return [current-1, current, current+1].map(y=>({ val:String(y), fr:String(y), ar:String(y) }));
};

const buildPeriodeStr = (typePeriode, valPeriode, annee) => {
  if (!typePeriode || !valPeriode || !annee) return '';
  if (typePeriode === 'mois') return valPeriode + '-' + annee;
  if (typePeriode === 'annee') return annee;
  return valPeriode + '-' + annee;
};

function Avatar({ prenom, nom, size=34, bg='#E1F5EE', color='#085041' }) {
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,fontSize:size*0.33,flexShrink:0}}>{getInitiales(prenom,nom)}</div>;
}

function StatCard({ icon, val, lbl, color, bg, sub }) {
  return (
    <div style={{background:bg,borderRadius:14,padding:'14px 16px'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <span style={{fontSize:18}}>{icon}</span>
        <span style={{fontSize:11,color,opacity:0.8,fontWeight:500}}>{lbl}</span>
      </div>
      <div style={{fontSize:26,fontWeight:800,color,letterSpacing:'-1px'}}>{val}</div>
      {sub&&<div style={{fontSize:11,color,opacity:0.6,marginTop:2}}>{sub}</div>}
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message}
        onConfirm={confirmModal.onConfirm} onCancel={hideConfirm}
        confirmLabel={confirmModal.confirmLabel} confirmColor={confirmModal.confirmColor} lang={lang}/>
    </div>
  );
}

export default function Finance({ user, navigate, goBack, lang='fr' }) {
  const [onglet, setOnglet] = useState('dashboard');
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [cotisations, setCotisations] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // Forms
  const [showFormCot, setShowFormCot] = useState(false);
  const [showFormDep, setShowFormDep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({isOpen:false,title:'',message:'',onConfirm:null,confirmColor:'#E24B4A',confirmLabel:''});
  const showConfirm = (title, message, onConfirm, confirmLabel, confirmColor) => setConfirmModal({isOpen:true,title,message,onConfirm,confirmLabel:confirmLabel||'Supprimer',confirmColor:confirmColor||'#E24B4A'});
  const hideConfirm = () => setConfirmModal(m=>({...m,isOpen:false,onConfirm:null}));

  const [formCot, setFormCot] = useState({
    eleve_id: '', montant: '', date_paiement: new Date().toISOString().split('T')[0],
    periode: '', typePeriode: 'mois', valPeriode: '', annee: String(new Date().getFullYear()),
    statut: 'paye', note: ''
  });
  const [searchEleveForm, setSearchEleveForm] = useState('');
  const [formDep, setFormDep] = useState({
    montant: '', date_depense: new Date().toISOString().split('T')[0],
    categorie: 'salaire', beneficiaire_id: '', description: '', reference: ''
  });

  // Filters
  const [filterEleve, setFilterEleve] = useState('tous');
  const [filterStatut, setFilterStatut] = useState('tous');
  const [filterIdEleve, setFilterIdEleve] = useState('');
  const [filterPeriode, setFilterPeriode] = useState('');
  const [filterCat, setFilterCat] = useState('tous');
  const [searchEleve, setSearchEleve] = useState('');
  const [dateDebut, setDateDebut] = useState(() => { const d=new Date(); d.setMonth(d.getMonth()-3); return d.toISOString().split('T')[0]; });
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        supabase.from('eleves').select('*, instituteur:instituteur_referent_id(prenom,nom)').order('nom'),
        supabase.from('utilisateurs').select('*').eq('role','instituteur'),
        supabase.from('cotisations').select('*, eleve:eleve_id(id,prenom,nom,code_niveau,eleve_id_ecole), createur:created_by(prenom,nom)').order('date_paiement',{ascending:false}),
        supabase.from('depenses').select('*, beneficiaire:beneficiaire_id(prenom,nom), createur:created_by(prenom,nom)').order('date_depense',{ascending:false}),
      ]);
      setEleves(r1.data||[]);
      setInstituteurs(r2.data||[]);
      setCotisations(r3.data||[]);
      setDepenses(r4.data||[]);
    } catch(e) { console.error(e); showMsg('error', 'Erreur de chargement'); }
    setLoading(false);
  };

  const showMsg = (type, text) => { setMsg({type,text}); setTimeout(()=>setMsg(null),3500); };

  const saveCotisation = async () => {
    if (!formCot.eleve_id || !formCot.montant || !formCot.date_paiement)
      return showMsg('error', lang==='ar'?'يرجى ملء الحقول المطلوبة':'Remplissez les champs obligatoires');
    setSaving(true);
    const { error } = await supabase.from('cotisations').insert({
      eleve_id: formCot.eleve_id,
      montant: parseFloat(formCot.montant),
      date_paiement: formCot.date_paiement,
      periode: buildPeriodeStr(formCot.typePeriode, formCot.valPeriode, formCot.annee) || formCot.periode || null,
      statut: formCot.statut,
      note: formCot.note||null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) return showMsg('error', error.message);
    showMsg('success', lang==='ar'?'تم تسجيل الاشتراك':'Cotisation enregistrée');
    setShowFormCot(false);
    setFormCot({ eleve_id:'', montant:'', date_paiement:new Date().toISOString().split('T')[0], periode:'', typePeriode:'mois', valPeriode:'', annee:String(new Date().getFullYear()), statut:'paye', note:'' });
    setSearchEleveForm('');
    await loadData();
  };

  const saveDepense = async () => {
    if (!formDep.montant || !formDep.date_depense || !formDep.description)
      return showMsg('error', lang==='ar'?'يرجى ملء الحقول المطلوبة':'Remplissez les champs obligatoires');
    setSaving(true);
    const { error } = await supabase.from('depenses').insert({
      montant: parseFloat(formDep.montant),
      date_depense: formDep.date_depense,
      categorie: formDep.categorie,
      beneficiaire_id: formDep.beneficiaire_id||null,
      description: formDep.description,
      reference: formDep.reference||null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) return showMsg('error', error.message);
    showMsg('success', lang==='ar'?'تم تسجيل المصروف':'Dépense enregistrée');
    setShowFormDep(false);
    setFormDep({ montant:'', date_depense:new Date().toISOString().split('T')[0], categorie:'salaire', beneficiaire_id:'', description:'', reference:'' });
    await loadData();
  };

  const deleteCotisation = (id) => showConfirm(
    lang==='ar'?'حذف الاشتراك':'Supprimer la cotisation',
    lang==='ar'?'هل تريد حذف هذا الاشتراك نهائياً؟':'Supprimer définitivement cette cotisation ?',
    async()=>{ await supabase.from('cotisations').delete().eq('id',id); await loadData(); hideConfirm(); }
  );

  const deleteDepense = (id) => showConfirm(
    lang==='ar'?'حذف المصروف':'Supprimer la dépense',
    lang==='ar'?'هل تريد حذف هذا المصروف نهائياً؟':'Supprimer définitivement cette dépense ?',
    async()=>{ await supabase.from('depenses').delete().eq('id',id); await loadData(); hideConfirm(); }
  );

  // Computed stats
  const debut = new Date(dateDebut); debut.setHours(0,0,0,0);
  const fin = new Date(dateFin); fin.setHours(23,59,59,999);

  const cotPeriode = cotisations.filter(c => new Date(c.date_paiement) >= debut && new Date(c.date_paiement) <= fin);
  const depPeriode = depenses.filter(d => new Date(d.date_depense) >= debut && new Date(d.date_depense) <= fin);

  const totalCotisations = cotPeriode.filter(c=>c.statut!=='exonere').reduce((s,c)=>s+parseFloat(c.montant||0),0);
  const totalDepenses = depPeriode.reduce((s,d)=>s+parseFloat(d.montant||0),0);
  const solde = totalCotisations - totalDepenses;

  const nbElevesPayes = new Set(cotPeriode.filter(c=>c.statut==='paye').map(c=>c.eleve_id)).size;
  const nbElevesPartiel = new Set(cotPeriode.filter(c=>c.statut==='partiel').map(c=>c.eleve_id)).size;
  const nbElevesExoneres = new Set(cotPeriode.filter(c=>c.statut==='exonere').map(c=>c.eleve_id)).size;

  // Par catégorie
  const parCategorie = CATEGORIES.map(cat => ({
    ...cat,
    total: depPeriode.filter(d=>d.categorie===cat.val).reduce((s,d)=>s+parseFloat(d.montant||0),0),
    nb: depPeriode.filter(d=>d.categorie===cat.val).length,
  })).filter(c=>c.total>0);

  // Cotisations filtrées
  const cotFiltrees = cotisations.filter(c => {
    if (filterEleve!=='tous' && c.eleve_id!==filterEleve) return false;
    if (filterStatut!=='tous' && c.statut!==filterStatut) return false;
    if (filterPeriode && c.periode && !c.periode.toLowerCase().includes(filterPeriode.toLowerCase())) return false;
    if (filterIdEleve && c.eleve && !String(c.eleve.eleve_id_ecole||'').includes(filterIdEleve) && !(c.eleve.prenom+' '+c.eleve.nom).toLowerCase().includes(filterIdEleve.toLowerCase())) return false;
    return true;
  });

  // Par élève (pour tableau de suivi)
  const parEleve = eleves.filter(e => !searchEleve || (e.prenom+' '+e.nom).toLowerCase().includes(searchEleve.toLowerCase())).map(e => {
    const cotE = cotisations.filter(c=>c.eleve_id===e.id);
    const cotEPeriode = cotPeriode.filter(c=>c.eleve_id===e.id);
    const totalVerse = cotE.filter(c=>c.statut!=='exonere').reduce((s,c)=>s+parseFloat(c.montant||0),0);
    const dernierPaiement = cotE[0]?.date_paiement||null;
    const statutDernier = cotE[0]?.statut||'non_paye';
    return { eleve:e, cotisations:cotE, cotEPeriode, totalVerse, dernierPaiement, statutDernier };
  });

  // Depenses filtrées
  const depFiltrees = depenses.filter(d => {
    if (filterCat!=='tous' && d.categorie!==filterCat) return false;
    return true;
  });

  // Export Excel
  const exportExcel = async () => {
    if (!window.XLSX) {
      await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    }
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();

    // Tableau de bord
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Gestion Financière — متابعة التحفيظ'],
      ['Période: '+dateDebut+' → '+dateFin],
      [],
      ['','Montant'],
      ['Total Cotisations', totalCotisations],
      ['Total Dépenses', totalDepenses],
      ['Solde', solde],
      [],
      ['Élèves payés', nbElevesPayes],
      ['Élèves partiel', nbElevesPartiel],
      ['Élèves exonérés', nbElevesExoneres],
    ]);
    ws1['!cols']=[{wch:24},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws1,'Tableau de bord');

    // Cotisations
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['#','Élève','ID École','Niveau','Montant','Période','Statut','Date','Note'],
      ...cotisations.map((c,i)=>[i+1,c.eleve?(c.eleve.prenom+' '+c.eleve.nom):'—',c.eleve?.eleve_id_ecole||'—',c.eleve?.code_niveau||'—',c.montant,c.periode||'—',c.statut,c.date_paiement,c.note||'—']),
    ]);
    ws2['!cols']=[{wch:4},{wch:22},{wch:10},{wch:8},{wch:10},{wch:14},{wch:10},{wch:14},{wch:20}];
    XLSX.utils.book_append_sheet(wb,ws2,'Cotisations');

    // Dépenses
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['#','Description','Catégorie','Montant','Bénéficiaire','Date','Référence'],
      ...depenses.map((d,i)=>[i+1,d.description,d.categorie,d.montant,d.beneficiaire?(d.beneficiaire.prenom+' '+d.beneficiaire.nom):'—',d.date_depense,d.reference||'—']),
    ]);
    ws3['!cols']=[{wch:4},{wch:28},{wch:16},{wch:10},{wch:20},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws3,'Dépenses');

    // Par élève
    const ws4 = XLSX.utils.aoa_to_sheet([
      ['Élève','ID','Niveau','Total versé','Dernier statut','Dernier paiement'],
      ...parEleve.map(p=>[p.eleve.prenom+' '+p.eleve.nom,p.eleve.eleve_id_ecole||'—',p.eleve.code_niveau||'—',p.totalVerse,p.statutDernier,p.dernierPaiement||'—']),
    ]);
    ws4['!cols']=[{wch:22},{wch:10},{wch:8},{wch:12},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws4,'Suivi par élève');

    XLSX.writeFile(wb,'finance_'+dateDebut+'_'+dateFin+'.xlsx');
  };

  // Export PDF
  const exportPDF = () => {
    const w = window.open('','_blank','width=1100,height=900');
    if (!w) { alert('Autorisez les popups'); return; }

    const maxDep = Math.max(...parCategorie.map(c=>c.total),1);
    const catBars = parCategorie.map((c,i)=>{
      const bw = Math.max(4,Math.round((c.total/maxDep)*300));
      const y = i*28+4;
      return '<text x="110" y="'+(y+14)+'" text-anchor="end" font-size="10" fill="#555">'+c.icon+' '+c.label+'</text>'
        +'<rect x="115" y="'+(y+3)+'" width="'+bw+'" height="16" fill="'+c.color+'" rx="3" opacity="0.8"/>'
        +'<text x="'+(120+bw)+'" y="'+(y+14)+'" font-size="10" fill="'+c.color+'" font-weight="bold">'+c.total.toLocaleString()+' MAD</text>';
    }).join('');
    const depSVG = parCategorie.length>0
      ? '<svg width="480" height="'+(parCategorie.length*28+10)+'" style="display:block">'+catBars+'</svg>'
      : '<p style="color:#bbb">Aucune dépense</p>';

    const lignesCot = cotisations.slice(0,30).map((c,i)=>{
      const st = STATUTS.find(s=>s.val===c.statut)||STATUTS[0];
      const bg = i%2===0?'#fff':'#f9f9f6';
      return '<tr style="background:'+bg+'"><td>'+(i+1)+'</td>'
        +'<td><strong>'+(c.eleve?c.eleve.prenom+' '+c.eleve.nom:'—')+'</strong></td>'
        +'<td style="color:#888">'+(c.eleve?.eleve_id_ecole||'—')+'</td>'
        +'<td><strong style="color:#1D9E75">'+parseFloat(c.montant||0).toLocaleString()+' MAD</strong></td>'
        +'<td>'+(c.periode||'—')+'</td>'
        +'<td><span style="padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700;background:'+st.bg+';color:'+st.color+'">'+st.label+'</span></td>'
        +'<td style="color:#888">'+c.date_paiement+'</td></tr>';
    }).join('');

    const lignesDep = depenses.slice(0,20).map((d,i)=>{
      const cat = CATEGORIES.find(c=>c.val===d.categorie)||CATEGORIES[5];
      const bg = i%2===0?'#fff':'#f9f9f6';
      return '<tr style="background:'+bg+'"><td>'+(i+1)+'</td>'
        +'<td>'+cat.icon+' '+cat.label+'</td>'
        +'<td>'+d.description+'</td>'
        +'<td>'+(d.beneficiaire?d.beneficiaire.prenom+' '+d.beneficiaire.nom:'—')+'</td>'
        +'<td><strong style="color:#E24B4A">'+parseFloat(d.montant||0).toLocaleString()+' MAD</strong></td>'
        +'<td style="color:#888">'+d.date_depense+'</td></tr>';
    }).join('');

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Finance</title>'
      +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#1a1a1a;padding:20px;font-size:12px}'
      +'.header{background:linear-gradient(135deg,#085041,#1D9E75);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px}'
      +'.header h1{font-size:18px;font-weight:800;margin-bottom:4px}'
      +'.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}'
      +'.kpi{border-radius:8px;padding:10px;text-align:center}'
      +'.kpi-val{font-size:22px;font-weight:800}.kpi-lbl{font-size:10px;opacity:0.8;margin-top:2px}'
      +'.sec{border:0.5px solid #e0e0d8;border-radius:10px;padding:14px;margin-bottom:12px}'
      +'.sec h2{font-size:13px;font-weight:600;color:#085041;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #1D9E75}'
      +'table{width:100%;border-collapse:collapse;font-size:11px}'
      +'th{background:#085041;color:#fff;padding:7px 8px;text-align:left}'
      +'td{padding:6px 8px;border-bottom:1px solid #f0f0ec}'
      +'.footer{margin-top:14px;font-size:9px;color:#bbb;border-top:1px solid #e0e0d8;padding-top:8px;text-align:center}'
      +'@media print{.sec{break-inside:avoid}}</style></head><body>'
      +'<div class="header"><h1>💰 Gestion Financière — متابعة التحفيظ</h1><div style="font-size:11px;opacity:0.8">'+dateDebut+' → '+dateFin+'</div></div>'
      +'<div class="kpi-row">'
      +'<div class="kpi" style="background:#E1F5EE"><div class="kpi-val" style="color:#1D9E75">'+totalCotisations.toLocaleString()+'</div><div class="kpi-lbl" style="color:#1D9E75">Cotisations (MAD)</div></div>'
      +'<div class="kpi" style="background:#FCEBEB"><div class="kpi-val" style="color:#E24B4A">'+totalDepenses.toLocaleString()+'</div><div class="kpi-lbl" style="color:#E24B4A">Dépenses (MAD)</div></div>'
      +'<div class="kpi" style="background:'+(solde>=0?'#E1F5EE':'#FCEBEB')+'"><div class="kpi-val" style="color:'+(solde>=0?'#1D9E75':'#E24B4A')+'">'+solde.toLocaleString()+'</div><div class="kpi-lbl" style="color:'+(solde>=0?'#1D9E75':'#E24B4A')+'">Solde (MAD)</div></div>'
      +'<div class="kpi" style="background:#E6F1FB"><div class="kpi-val" style="color:#378ADD">'+nbElevesPayes+'</div><div class="kpi-lbl" style="color:#378ADD">Élèves payés</div></div>'
      +'</div>'
      +(parCategorie.length>0?'<div class="sec"><h2>📊 Dépenses par catégorie</h2>'+depSVG+'</div>':'')
      +'<div class="sec"><h2>📥 Cotisations ('+cotisations.length+')</h2>'
      +'<table><thead><tr><th>#</th><th>Élève</th><th>ID</th><th>Montant</th><th>Période</th><th>Statut</th><th>Date</th></tr></thead>'
      +'<tbody>'+lignesCot+'</tbody></table></div>'
      +'<div class="sec"><h2>📤 Dépenses ('+depenses.length+')</h2>'
      +'<table><thead><tr><th>#</th><th>Catégorie</th><th>Description</th><th>Bénéficiaire</th><th>Montant</th><th>Date</th></tr></thead>'
      +'<tbody>'+lignesDep+'</tbody></table></div>'
      +'<div class="footer">Généré le '+new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})+' · متابعة التحفيظ</div>'
      +'</body></html>';

    w.document.write(html);
    w.document.close();
    setTimeout(function(){ w.print(); }, 800);
  };

  const onglets = [
    { key:'dashboard', label:'Vue générale',   labelAr:'النظرة العامة', icon:'📊' },
    { key:'cotisations', label:'Cotisations',  labelAr:'الاشتراكات',    icon:'📥' },
    { key:'depenses', label:'Dépenses',        labelAr:'المصاريف',      icon:'📤' },
    { key:'suivi', label:'Suivi élèves',       labelAr:'متابعة الطلاب', icon:'👥' },
  ];

  const fmtMAD = (n) => parseFloat(n||0).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2})+' MAD';

  // Double protection - surveillant only
  if (user.role !== 'surveillant') {
    return (
      <div style={{padding:'3rem',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:'1rem'}}>🔒</div>
        <div style={{fontSize:16,fontWeight:600,color:'#E24B4A',marginBottom:8}}>
          {lang==='ar'?'غير مصرح لك بالوصول':lang==='en'?'Access denied':'Accès refusé'}
        </div>
        <div style={{fontSize:13,color:'#888',marginBottom:'1.5rem'}}>
          {lang==='ar'?'هذا القسم مخصص للمراقب العام فقط':lang==='en'?'This section is for the supervisor only':'Cette section est réservée au surveillant général'}
        </div>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>← {t(lang,'retour')}</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',flexWrap:'wrap',gap:8}}>
        <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}>← {t(lang,'retour')}</button>
        <div style={{fontSize:18,fontWeight:700,color:'#085041'}}>💰 {lang==='ar'?'الإدارة المالية':lang==='en'?'Finance':'Gestion Financière'}</div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={exportExcel} style={{padding:'6px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>📥 Excel</button>
          <button onClick={exportPDF} style={{padding:'6px 12px',background:'#534AB7',color:'#fff',border:'none',borderRadius:8,fontSize:11,fontWeight:600,cursor:'pointer'}}>🖨️ PDF</button>
        </div>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',gap:4,background:'#f0f0ec',borderRadius:12,padding:4,marginBottom:'1.25rem',flexWrap:'wrap'}}>
        {onglets.map(o=>(
          <div key={o.key} onClick={()=>setOnglet(o.key)}
            style={{flex:1,padding:'8px 12px',borderRadius:8,fontSize:12,fontWeight:onglet===o.key?600:400,cursor:'pointer',textAlign:'center',
              background:onglet===o.key?'#fff':'transparent',color:onglet===o.key?'#085041':'#888',
              border:onglet===o.key?'0.5px solid #e0e0d8':'none',whiteSpace:'nowrap',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            <span>{o.icon}</span><span>{lang==='ar'?o.labelAr:o.label}</span>
          </div>
        ))}
      </div>

      {msg&&<div style={{padding:'10px 16px',borderRadius:8,marginBottom:'1rem',background:msg.type==='success'?'#E1F5EE':'#FCEBEB',color:msg.type==='success'?'#085041':'#A32D2D',fontSize:13,fontWeight:500}}>{msg.text}</div>}

      {/* Filtre période (global) */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:'1rem'}}>
        <div className="field-group"><label className="field-lbl">{lang==='ar'?'من':'Du'}</label><input className="field-input" type="date" value={dateDebut} onChange={e=>setDateDebut(e.target.value)}/></div>
        <div className="field-group"><label className="field-lbl">{lang==='ar'?'إلى':'Au'}</label><input className="field-input" type="date" value={dateFin} onChange={e=>setDateFin(e.target.value)}/></div>
      </div>

      {loading ? <div className="loading">...</div> : (<>

        {/* ═══ DASHBOARD ═══ */}
        {onglet==='dashboard'&&(
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:'1rem'}}>
              <StatCard icon="📥" val={fmtMAD(totalCotisations)} lbl={lang==='ar'?'إجمالي الاشتراكات':'Total cotisations'} color="#1D9E75" bg="#E1F5EE" sub={cotPeriode.length+' versements'}/>
              <StatCard icon="📤" val={fmtMAD(totalDepenses)} lbl={lang==='ar'?'إجمالي المصاريف':'Total dépenses'} color="#E24B4A" bg="#FCEBEB" sub={depPeriode.length+' opérations'}/>
              <StatCard icon={solde>=0?'✅':'⚠️'} val={fmtMAD(Math.abs(solde))} lbl={lang==='ar'?'الرصيد':'Solde'} color={solde>=0?'#085041':'#E24B4A'} bg={solde>=0?'#E1F5EE':'#FCEBEB'} sub={solde>=0?'Excédent':'Déficit'}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:'1rem'}}>
              {[
                {val:nbElevesPayes, lbl:lang==='ar'?'مدفوع':'Payés', color:'#1D9E75', bg:'#E1F5EE'},
                {val:nbElevesPartiel, lbl:lang==='ar'?'جزئي':'Partiels', color:'#EF9F27', bg:'#FAEEDA'},
                {val:nbElevesExoneres, lbl:lang==='ar'?'معفى':'Exonérés', color:'#888', bg:'#f5f5f0'},
              ].map(k=>(
                <div key={k.lbl} style={{background:k.bg,borderRadius:10,padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.val}</div>
                  <div style={{fontSize:11,color:k.color,opacity:0.8}}>{lang==='ar'?'طالب':lang==='en'?'students':'élèves'} {k.lbl}</div>
                </div>
              ))}
            </div>

            {/* Dépenses par catégorie */}
            {parCategorie.length>0&&(
              <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'1.25rem',marginBottom:'1rem'}}>
                <div style={{fontSize:13,fontWeight:600,color:'#1a1a1a',marginBottom:12}}>{lang==='ar'?'المصاريف حسب الفئة':'Dépenses par catégorie'}</div>
                {parCategorie.map(cat=>(
                  <div key={cat.val} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                    <span style={{fontSize:16,width:24}}>{cat.icon}</span>
                    <div style={{width:100,fontSize:12,color:'#555'}}>{lang==='ar'?cat.labelAr:cat.label}</div>
                    <div style={{flex:1,height:12,background:'#f0f0ec',borderRadius:6,overflow:'hidden'}}>
                      <div style={{height:'100%',width:(cat.total/Math.max(...parCategorie.map(c=>c.total),1)*100)+'%',background:cat.color,borderRadius:6,transition:'width 0.5s'}}/>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:cat.color,minWidth:90,textAlign:'right'}}>{fmtMAD(cat.total)}</div>
                    <div style={{fontSize:11,color:'#bbb',minWidth:30}}>{cat.nb}x</div>
                  </div>
                ))}
              </div>
            )}

            {/* Dernières opérations */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1rem'}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:'#1D9E75'}}>📥 {lang==='ar'?'آخر الاشتراكات':'Dernières cotisations'}</div>
                {cotPeriode.slice(0,5).map(c=>{
                  const st=STATUTS.find(s=>s.val===c.statut)||STATUTS[0];
                  return(
                    <div key={c.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:'0.5px solid #f0f0ec'}}>
                      <div style={{flex:1,fontSize:12,fontWeight:500}}>{c.eleve?c.eleve.prenom+' '+c.eleve.nom:'—'}</div>
                      <span style={{fontSize:11,padding:'1px 6px',borderRadius:8,background:st.bg,color:st.color}}>{st.label}</span>
                      <span style={{fontSize:12,fontWeight:700,color:'#1D9E75'}}>{fmtMAD(c.montant)}</span>
                    </div>
                  );
                })}
                {cotPeriode.length===0&&<div className="empty" style={{fontSize:12}}>Aucune cotisation</div>}
              </div>
              <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1rem'}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:'#E24B4A'}}>📤 {lang==='ar'?'آخر المصاريف':'Dernières dépenses'}</div>
                {depPeriode.slice(0,5).map(d=>{
                  const cat=CATEGORIES.find(c=>c.val===d.categorie)||CATEGORIES[5];
                  return(
                    <div key={d.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:'0.5px solid #f0f0ec'}}>
                      <span style={{fontSize:14}}>{cat.icon}</span>
                      <div style={{flex:1,fontSize:12,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.description}</div>
                      <span style={{fontSize:12,fontWeight:700,color:'#E24B4A'}}>{fmtMAD(d.montant)}</span>
                    </div>
                  );
                })}
                {depPeriode.length===0&&<div className="empty" style={{fontSize:12}}>Aucune dépense</div>}
              </div>
            </div>
          </>
        )}

        {/* ═══ COTISATIONS ═══ */}
        {onglet==='cotisations'&&(
          <>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'1rem'}}>
              <button className="btn-primary" style={{width:'auto',padding:'8px 16px',fontSize:13}} onClick={()=>setShowFormCot(v=>!v)}>
                {showFormCot?'✕':'+  '}{lang==='ar'?'تسجيل اشتراك':'Enregistrer une cotisation'}
              </button>
            </div>

            {showFormCot&&(
              <div style={{background:'#fff',border:'1.5px solid #1D9E75',borderRadius:16,padding:'1.5rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:14,fontWeight:600,color:'#085041',marginBottom:'1rem'}}>📥 {lang==='ar'?'تسجيل اشتراك جديد':'Nouvelle cotisation'}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'الطالب':'Élève'} *</label>
                    <input className="field-input" placeholder={'🔍 '+(lang==='ar'?'بحث بالاسم أو رقم التعريف...':'Nom ou N° élève...')}
                      value={searchEleveForm} onChange={e=>setSearchEleveForm(e.target.value)}
                      style={{marginBottom:6}}/>
                    <select className="field-select" value={formCot.eleve_id} onChange={e=>setFormCot(f=>({...f,eleve_id:e.target.value}))}>
                      <option value="">— {lang==='ar'?'اختر':'Sélectionner'} —</option>
                      {eleves.filter(e=>!searchEleveForm||(e.prenom+' '+e.nom).toLowerCase().includes(searchEleveForm.toLowerCase())||String(e.eleve_id_ecole||'').includes(searchEleveForm)).map(e=>(
                        <option key={e.id} value={e.id}>
                          {e.eleve_id_ecole?'#'+e.eleve_id_ecole+' · ':''}{e.prenom} {e.nom} ({e.code_niveau||'?'})
                        </option>
                      ))}
                    </select>
                    {formCot.eleve_id && (()=>{
                      const el=eleves.find(x=>x.id===formCot.eleve_id);
                      return el?<div style={{marginTop:4,fontSize:11,color:'#1D9E75',fontWeight:500}}>✓ {el.prenom} {el.nom}{el.eleve_id_ecole?' · #'+el.eleve_id_ecole:''}</div>:null;
                    })()}
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المبلغ':'Montant (MAD)'} *</label>
                    <input className="field-input" type="number" min="0" step="0.01" value={formCot.montant} onChange={e=>setFormCot(f=>({...f,montant:e.target.value}))} placeholder="Ex: 150"/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'تاريخ الدفع':'Date de paiement'} *</label>
                    <input className="field-input" type="date" value={formCot.date_paiement} onChange={e=>setFormCot(f=>({...f,date_paiement:e.target.value}))}/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'الفترة':'Période'}</label>
                    <div style={{display:'flex',gap:6,marginBottom:6}}>
                      {TYPE_PERIODES.map(tp=>(
                        <div key={tp.val} onClick={()=>setFormCot(f=>({...f,typePeriode:tp.val,valPeriode:''}))}
                          style={{flex:1,padding:'5px 4px',borderRadius:8,fontSize:11,fontWeight:formCot.typePeriode===tp.val?700:400,cursor:'pointer',textAlign:'center',
                            background:formCot.typePeriode===tp.val?'#1D9E75':'#f5f5f0',color:formCot.typePeriode===tp.val?'#fff':'#888',
                            border:'1px solid '+(formCot.typePeriode===tp.val?'#1D9E75':'#e0e0d8')}}>
                          {lang==='ar'?tp.labelAr:tp.label}
                        </div>
                      ))}
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      {formCot.typePeriode!=='annee'&&(
                        <select className="field-select" style={{flex:2}} value={formCot.valPeriode} onChange={e=>setFormCot(f=>({...f,valPeriode:e.target.value}))}>
                          <option value="">— {lang==='ar'?'اختر':'Choisir'} —</option>
                          {formCot.typePeriode==='mois' && MOIS.map(m=><option key={m.val} value={m.val}>{lang==='ar'?m.ar:m.fr}</option>)}
                          {formCot.typePeriode==='trimestre' && TRIMESTRES.map(t=><option key={t.val} value={t.val}>{lang==='ar'?t.ar:t.fr}</option>)}
                          {formCot.typePeriode==='semestre' && SEMESTRES.map(s=><option key={s.val} value={s.val}>{lang==='ar'?s.ar:s.fr}</option>)}
                        </select>
                      )}
                      <select className="field-select" style={{flex:1}} value={formCot.annee} onChange={e=>setFormCot(f=>({...f,annee:e.target.value}))}>
                        {getAnnees().map(a=><option key={a.val} value={a.val}>{a.fr}</option>)}
                      </select>
                    </div>
                    {buildPeriodeStr(formCot.typePeriode,formCot.valPeriode,formCot.annee)&&(
                      <div style={{marginTop:4,fontSize:11,color:'#1D9E75',fontWeight:600}}>
                        📅 {buildPeriodeStr(formCot.typePeriode,formCot.valPeriode,formCot.annee)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <label className="field-lbl">{lang==='ar'?'الحالة':'Statut'}</label>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
                    {STATUTS.map(s=>(
                      <div key={s.val} onClick={()=>setFormCot(f=>({...f,statut:s.val}))}
                        style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:formCot.statut===s.val?700:400,cursor:'pointer',
                          background:formCot.statut===s.val?s.bg:'#f5f5f0',color:formCot.statut===s.val?s.color:'#888',
                          border:'1.5px solid '+(formCot.statut===s.val?s.color:'#e0e0d8')}}>
                        {lang==='ar'?s.labelAr:s.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="field-group" style={{marginBottom:14}}>
                  <label className="field-lbl">{lang==='ar'?'ملاحظات':'Note'}</label>
                  <input className="field-input" value={formCot.note} onChange={e=>setFormCot(f=>({...f,note:e.target.value}))} placeholder={lang==='ar'?'ملاحظات إضافية...':'Note optionnelle...'}/>
                </div>
                <button className="btn-primary" onClick={saveCotisation} disabled={saving}>
                  {saving?'...':'✓ '+(lang==='ar'?'حفظ':'Enregistrer')}
                </button>
              </div>
            )}

            {/* Filtres */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'بحث بالاسم أو رقم التعريف':'Nom ou N° élève'}</label>
                <input className="field-input" value={filterIdEleve} onChange={e=>setFilterIdEleve(e.target.value)} placeholder={'🔍 '+(lang==='ar'?'اسم أو رقم...':'Nom ou #ID...')}/>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'الطالب':'Élève'}</label>
                <select className="field-select" value={filterEleve} onChange={e=>setFilterEleve(e.target.value)}>
                  <option value="tous">{lang==='ar'?'جميع الطلاب':'Tous les élèves'}</option>
                  {eleves.map(e=><option key={e.id} value={e.id}>{e.eleve_id_ecole?'#'+e.eleve_id_ecole+' · ':''}{e.prenom} {e.nom} ({e.code_niveau||'?'})</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:'1rem'}}>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'الحالة':'Statut'}</label>
                <select className="field-select" value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}>
                  <option value="tous">{lang==='ar'?'جميع الحالات':'Tous'}</option>
                  {STATUTS.map(s=><option key={s.val} value={s.val}>{lang==='ar'?s.labelAr:s.label}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'نوع الفترة':'Type période'}</label>
                <select className="field-select" value={filterPeriode.split('-')[0]||''} onChange={e=>setFilterPeriode(e.target.value)}>
                  <option value="">{lang==='ar'?'كل الفترات':'Toutes les périodes'}</option>
                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m=>{const mo=MOIS.find(x=>x.val===m);return<option key={m} value={m}>{lang==='ar'?mo.ar:mo.fr}</option>;})}
                  {['T1','T2','T3','T4','S1','S2'].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-lbl">{lang==='ar'?'السنة':'Année'}</label>
                <select className="field-select" value={filterPeriode.split('-')[1]||''} onChange={e=>{const base=filterPeriode.split('-')[0]||'';setFilterPeriode(base?(base+'-'+e.target.value):e.target.value);}}>
                  <option value="">{lang==='ar'?'كل السنوات':'Toutes'}</option>
                  {getAnnees().map(a=><option key={a.val} value={a.val}>{a.fr}</option>)}
                </select>
              </div>
            </div>

            <div style={{fontSize:12,color:'#888',marginBottom:8}}>{cotFiltrees.length} {lang==='ar'?'سجل':'entrée(s)'} · {lang==='ar'?'المجموع':'Total'}: <strong style={{color:'#1D9E75'}}>{fmtMAD(cotFiltrees.filter(c=>c.statut!=='exonere').reduce((s,c)=>s+parseFloat(c.montant||0),0))}</strong></div>

            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {cotFiltrees.map(c=>{
                const st=STATUTS.find(s=>s.val===c.statut)||STATUTS[0];
                return(
                  <div key={c.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                    {c.eleve&&<Avatar prenom={c.eleve.prenom} nom={c.eleve.nom} bg={st.bg} color={st.color}/>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{c.eleve?c.eleve.prenom+' '+c.eleve.nom:'—'}{c.eleve?.eleve_id_ecole?<span style={{fontSize:11,color:'#bbb',marginRight:4}}> #{c.eleve.eleve_id_ecole}</span>:null}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>
                        {c.date_paiement}{c.periode?' · '+c.periode:''}{c.note?' · '+c.note:''}
                      </div>
                    </div>
                    <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:st.bg,color:st.color}}>{lang==='ar'?st.labelAr:st.label}</span>
                    <div style={{fontSize:16,fontWeight:800,color:'#1D9E75',minWidth:90,textAlign:'right'}}>{fmtMAD(c.montant)}</div>
                    {user.role==='surveillant'&&<button onClick={()=>deleteCotisation(c.id)} style={{fontSize:10,color:'#E24B4A',background:'none',border:'none',cursor:'pointer',padding:0}}>🗑</button>}
                  </div>
                );
              })}
              {cotFiltrees.length===0&&<div className="empty">{lang==='ar'?'لا توجد اشتراكات':'Aucune cotisation'}</div>}
            </div>
          </>
        )}

        {/* ═══ DÉPENSES ═══ */}
        {onglet==='depenses'&&(
          <>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'1rem'}}>
              <button className="btn-primary" style={{width:'auto',padding:'8px 16px',fontSize:13}} onClick={()=>setShowFormDep(v=>!v)}>
                {showFormDep?'✕':'+  '}{lang==='ar'?'تسجيل مصروف':'Enregistrer une dépense'}
              </button>
            </div>

            {showFormDep&&(
              <div style={{background:'#fff',border:'1.5px solid #E24B4A',borderRadius:16,padding:'1.5rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:14,fontWeight:600,color:'#A32D2D',marginBottom:'1rem'}}>📤 {lang==='ar'?'تسجيل مصروف جديد':'Nouvelle dépense'}</div>
                {/* Catégorie */}
                <div style={{marginBottom:12}}>
                  <label className="field-lbl">{lang==='ar'?'الفئة':'Catégorie'} *</label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
                    {CATEGORIES.map(cat=>(
                      <div key={cat.val} onClick={()=>setFormDep(f=>({...f,categorie:cat.val}))}
                        style={{padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:formDep.categorie===cat.val?700:400,cursor:'pointer',display:'flex',alignItems:'center',gap:4,
                          background:formDep.categorie===cat.val?cat.color+'18':'#f5f5f0',color:formDep.categorie===cat.val?cat.color:'#888',
                          border:'1.5px solid '+(formDep.categorie===cat.val?cat.color:'#e0e0d8')}}>
                        {cat.icon} {lang==='ar'?cat.labelAr:cat.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المبلغ':'Montant (MAD)'} *</label>
                    <input className="field-input" type="number" min="0" step="0.01" value={formDep.montant} onChange={e=>setFormDep(f=>({...f,montant:e.target.value}))} placeholder="Ex: 500"/>
                  </div>
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'التاريخ':'Date'} *</label>
                    <input className="field-input" type="date" value={formDep.date_depense} onChange={e=>setFormDep(f=>({...f,date_depense:e.target.value}))}/>
                  </div>
                  <div className="field-group" style={{gridColumn:'1/-1'}}>
                    <label className="field-lbl">{lang==='ar'?'الوصف':'Description'} *</label>
                    <input className="field-input" value={formDep.description} onChange={e=>setFormDep(f=>({...f,description:e.target.value}))} placeholder={lang==='ar'?'وصف المصروف...':'Décrivez la dépense...'}/>
                  </div>
                  {formDep.categorie==='salaire'&&(
                    <div className="field-group">
                      <label className="field-lbl">{lang==='ar'?'المستفيد (أستاذ)':'Bénéficiaire (instituteur)'}</label>
                      <select className="field-select" value={formDep.beneficiaire_id} onChange={e=>setFormDep(f=>({...f,beneficiaire_id:e.target.value}))}>
                        <option value="">— {lang==='ar'?'اختر':'Sélectionner'} —</option>
                        {instituteurs.map(i=><option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="field-group">
                    <label className="field-lbl">{lang==='ar'?'المرجع (اختياري)':'Référence (optionnel)'}</label>
                    <input className="field-input" value={formDep.reference} onChange={e=>setFormDep(f=>({...f,reference:e.target.value}))} placeholder="Numéro facture, bon..."/>
                  </div>
                </div>
                <button className="btn-primary" style={{background:'#E24B4A'}} onClick={saveDepense} disabled={saving}>
                  {saving?'...':'✓ '+(lang==='ar'?'حفظ':'Enregistrer')}
                </button>
              </div>
            )}

            {/* Filtres catégorie */}
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:'1rem'}}>
              <div onClick={()=>setFilterCat('tous')} style={{padding:'5px 12px',borderRadius:20,fontSize:11,cursor:'pointer',border:'1.5px solid '+(filterCat==='tous'?'#085041':'#e0e0d8'),background:filterCat==='tous'?'#085041':'#fff',color:filterCat==='tous'?'#fff':'#666',fontWeight:filterCat==='tous'?700:400}}>
                {lang==='ar'?'الكل':'Tout'}
              </div>
              {CATEGORIES.map(cat=>(
                <div key={cat.val} onClick={()=>setFilterCat(cat.val)} style={{padding:'5px 12px',borderRadius:20,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4,border:'1.5px solid '+(filterCat===cat.val?cat.color:'#e0e0d8'),background:filterCat===cat.val?cat.color+'18':'#fff',color:filterCat===cat.val?cat.color:'#666',fontWeight:filterCat===cat.val?700:400}}>
                  {cat.icon} {lang==='ar'?cat.labelAr:cat.label}
                </div>
              ))}
            </div>

            <div style={{fontSize:12,color:'#888',marginBottom:8}}>{depFiltrees.length} {lang==='ar'?'سجل':'entrée(s)'} · {lang==='ar'?'المجموع':'Total'}: <strong style={{color:'#E24B4A'}}>{fmtMAD(depFiltrees.reduce((s,d)=>s+parseFloat(d.montant||0),0))}</strong></div>

            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {depFiltrees.map(d=>{
                const cat=CATEGORIES.find(c=>c.val===d.categorie)||CATEGORIES[5];
                return(
                  <div key={d.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderLeft:'4px solid '+cat.color,borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:20}}>{cat.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{d.description}</div>
                      <div style={{fontSize:11,color:'#888',marginTop:2,display:'flex',gap:8,flexWrap:'wrap'}}>
                        <span style={{padding:'1px 6px',borderRadius:8,background:cat.color+'18',color:cat.color,fontSize:10}}>{lang==='ar'?cat.labelAr:cat.label}</span>
                        {d.beneficiaire&&<span>{d.beneficiaire.prenom} {d.beneficiaire.nom}</span>}
                        {d.reference&&<span>Réf: {d.reference}</span>}
                        <span>{d.date_depense}</span>
                      </div>
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:'#E24B4A',minWidth:90,textAlign:'right'}}>{fmtMAD(d.montant)}</div>
                    {user.role==='surveillant'&&<button onClick={()=>deleteDepense(d.id)} style={{fontSize:10,color:'#E24B4A',background:'none',border:'none',cursor:'pointer',padding:0}}>🗑</button>}
                  </div>
                );
              })}
              {depFiltrees.length===0&&<div className="empty">{lang==='ar'?'لا توجد مصاريف':'Aucune dépense'}</div>}
            </div>
          </>
        )}

        {/* ═══ SUIVI ÉLÈVES ═══ */}
        {onglet==='suivi'&&(
          <>
            <input style={{width:'100%',padding:'8px 12px',border:'0.5px solid #e0e0d8',borderRadius:10,fontSize:13,marginBottom:'1rem'}} placeholder={'🔍 '+(lang==='ar'?'بحث عن طالب...':'Rechercher un élève...')} value={searchEleve} onChange={e=>setSearchEleve(e.target.value)}/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:'1rem'}}>
              {STATUTS.map(st=>(
                <div key={st.val} style={{background:st.bg,borderRadius:10,padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:18,fontWeight:800,color:st.color}}>{parEleve.filter(p=>p.statutDernier===st.val).length}</div>
                  <div style={{fontSize:11,color:st.color,opacity:0.8}}>{lang==='ar'?st.labelAr:st.label}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {parEleve.map(p=>{
                const st=STATUTS.find(s=>s.val===p.statutDernier)||STATUTS[2];
                const nc={'5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A'}[p.eleve.code_niveau||'1']||'#888';
                return(
                  <div key={p.eleve.id} style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                    <Avatar prenom={p.eleve.prenom} nom={p.eleve.nom} bg={st.bg} color={st.color}/>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:13,fontWeight:600}}>{p.eleve.prenom} {p.eleve.nom}</span>
                        {p.eleve.eleve_id_ecole&&<span style={{fontSize:11,color:'#bbb'}}>#{p.eleve.eleve_id_ecole}</span>}
                        <span style={{padding:'1px 6px',borderRadius:10,fontSize:10,fontWeight:700,background:nc+'18',color:nc}}>{p.eleve.code_niveau||'?'}</span>
                      </div>
                      <div style={{fontSize:11,color:'#888',marginTop:2}}>
                        {p.cotisations.length} {lang==='ar'?'دفعة':'versement(s)'}
                        {p.dernierPaiement?' · '+lang==='ar'?'آخر دفعة':'Dernier: '+p.dernierPaiement:''}
                      </div>
                    </div>
                    <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:st.bg,color:st.color}}>{lang==='ar'?st.labelAr:st.label}</span>
                    <div style={{fontSize:15,fontWeight:800,color:'#1D9E75',minWidth:80,textAlign:'right'}}>{fmtMAD(p.totalVerse)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </>)}
    </div>
  );
}
