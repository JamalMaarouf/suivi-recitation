import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { getSouratesForNiveau, getSouratesDesc } from '../lib/sourates';
import { t } from '../lib/i18n';

// Liste des Hizb selon un sens donne (desc = 60->1, asc = 1->60)
const makeHizbList = (sens) => sens === 'asc'
  ? Array.from({length:60}, (_,i) => i+1)
  : Array.from({length:60}, (_,i) => 60-i);

const COULEURS_PRESET = [
  '#534AB7','#378ADD','#1D9E75','#EF9F27','#E24B4A',
  '#D85A30','#085041','#0C447C','#633806','#888'
];

// ═══════════════════════════════════════════════════════════
// BlocEditor — composant extrait pour isoler la logique.
// Note : PAS de React.memo ici car ça cassait l'input en RTL.
// Le composant est simplement extrait pour lisibilité.
// ═══════════════════════════════════════════════════════════
function BlocEditor({
  bloc, idx, nc, lang, isOpen, canDelete, hizbsPris,
  onNomChange, onSensChange, onDelete, onToggleOpen, onToggleHizb,
}) {
  return (
    <div style={{borderRadius:12,background:'#fff',border:`1.5px solid ${nc}40`,overflow:'hidden'}}>
      {/* En-tête du bloc */}
      <div style={{padding:'10px 12px',background:`${nc}10`,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <div style={{width:28,height:28,borderRadius:7,background:nc,color:'#fff',fontSize:12,fontWeight:800,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {idx+1}
        </div>
        <input
          type="text"
          autoComplete="off"
          dir="auto"
          value={bloc.nom || ''}
          onChange={e => onNomChange(idx, e.target.value)}
          placeholder={lang==='ar' ? 'اسم البلوك (اختياري)' : 'Nom du bloc (optionnel)'}
          style={{flex:1,minWidth:120,padding:'6px 10px',borderRadius:8,border:'0.5px solid #e0e0d8',
            fontSize:12,fontFamily:'inherit'}}
        />
        {/* Toggle sens ASC/DESC */}
        <div style={{display:'flex',gap:3,padding:3,background:'#fff',borderRadius:7,border:'0.5px solid #e0e0d8'}}>
          <button type="button" onClick={() => onSensChange(idx, 'asc')}
            style={{padding:'4px 8px',borderRadius:5,border:'none',cursor:'pointer',fontSize:11,
              background: bloc.sens==='asc' ? nc : 'transparent',
              color: bloc.sens==='asc' ? '#fff' : '#888',
              fontWeight: bloc.sens==='asc' ? 700 : 500}}>
            ↑ {lang==='ar' ? 'تصاعدي' : 'Asc'}
          </button>
          <button type="button" onClick={() => onSensChange(idx, 'desc')}
            style={{padding:'4px 8px',borderRadius:5,border:'none',cursor:'pointer',fontSize:11,
              background: bloc.sens==='desc' ? nc : 'transparent',
              color: bloc.sens==='desc' ? '#fff' : '#888',
              fontWeight: bloc.sens==='desc' ? 700 : 500}}>
            ↓ {lang==='ar' ? 'تنازلي' : 'Desc'}
          </button>
        </div>
        {canDelete && (
          <button type="button" onClick={() => {
            if (window.confirm(lang==='ar' ? 'حذف هذا البلوك؟' : 'Supprimer ce bloc ?')) onDelete(idx);
          }}
            style={{padding:'5px 8px',borderRadius:6,border:'none',background:'#FCEBEB',color:'#E24B4A',
              cursor:'pointer',fontSize:12}}>
            🗑
          </button>
        )}
      </div>

      {/* Compteur + bouton ouvrir/fermer */}
      <div style={{padding:'8px 12px',display:'flex',alignItems:'center',gap:8,
        borderBottom: isOpen ? '0.5px solid #e0e0d8' : 'none'}}>
        <div style={{fontSize:11,color:'#666',flex:1}}>
          <strong style={{color:nc}}>{(bloc.hizbs||[]).length}</strong>{' '}
          {lang==='ar' ? 'حزب محدد' : 'Hizb sélectionnés'}
          {(bloc.hizbs||[]).length > 0 && (
            <span style={{color:'#aaa',marginLeft:8}}>
              · {[...bloc.hizbs].sort((a,b) => bloc.sens==='asc' ? a-b : b-a).slice(0,8).join(', ')}
              {bloc.hizbs.length > 8 ? '...' : ''}
            </span>
          )}
        </div>
        <button type="button" onClick={() => onToggleOpen(idx)}
          style={{padding:'5px 12px',borderRadius:7,border:`0.5px solid ${nc}40`,
            background: isOpen ? nc : '#fff',
            color: isOpen ? '#fff' : nc,
            cursor:'pointer',fontSize:11,fontWeight:600}}>
          {isOpen ? (lang==='ar' ? 'إغلاق' : 'Fermer') : (lang==='ar' ? 'اختيار الأحزاب' : 'Choisir Hizb')}
        </button>
      </div>

      {/* Grille de sélection des Hizb (uniquement si ouvert) */}
      {isOpen && (
        <div style={{padding:'10px 12px'}}>
          <div style={{fontSize:10,color:'#888',marginBottom:6}}>
            {lang==='ar' ? 'الأحزاب بالرمادي محجوزة في بلوكات أخرى' : 'Les Hizb grisés sont pris par d\'autres blocs'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:4}}>
            {Array.from({length:60}, (_,i) => i+1).map(h => {
              const selDansBloc = (bloc.hizbs||[]).includes(h);
              const prisAilleurs = hizbsPris.has(h);
              return (
                <div key={h}
                  onClick={() => { if (!prisAilleurs) onToggleHizb(idx, h); }}
                  style={{height:32,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:11,fontWeight: selDansBloc ? 700 : 400,
                    cursor: prisAilleurs ? 'not-allowed' : 'pointer',
                    opacity: prisAilleurs ? 0.35 : 1,
                    background: selDansBloc ? nc : (prisAilleurs ? '#f0f0ec' : '#f5f5f0'),
                    color: selDansBloc ? '#fff' : (prisAilleurs ? '#aaa' : '#666'),
                    border: `1px solid ${selDansBloc ? nc : '#e0e0d8'}`}}>
                  {h}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GestionNiveaux({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const [niveaux, setNiveaux]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [confirmModal, setConfirmModal] = useState({isOpen:false});

  const emptyForm = { code:'', nom:'', type:'hizb', couleur:'#1D9E75', ordre:1, nb_sequences:3 };
  const [form, setForm] = useState(emptyForm);

  // Programme du niveau sélectionné
  const [niveauProgramme, setNiveauProgramme] = useState(null);
  const [programme, setProgramme]             = useState([]);
  const [modeEditionProgramme, setModeEditionProgramme] = useState(false);
  const panneauScrollRef = React.useRef(null);
  const [souratesDB, setSouratesDB]           = useState([]);
  const [savingProg, setSavingProg]           = useState(false);
  const [ecoleConfig, setEcoleConfig]         = useState(null);

  // ─── NOTION DE BLOCS PÉDAGOGIQUES ──────────────────────────
  // Un programme peut être organisé en plusieurs blocs (ex: 60 Hizb
  // découpés en 4 blocs de 15). Chaque bloc a son propre nom et son
  // propre sens de récitation (asc/desc).
  // useBlocs = false : programme continu (1 seul bloc, comportement classique)
  // useBlocs = true  : programme organisé en N blocs pédagogiques
  const [useBlocs, setUseBlocs] = useState(false);
  const [blocs, setBlocs] = useState([
    { numero: 1, nom: '', sens: 'asc', hizbs: [] }
  ]);
  const [blocEnEdition, setBlocEnEdition] = useState(null); // index du bloc dont on édite les hizbs

  useEffect(() => { loadData(); }, []);

  const [formProgramme, setFormProgramme] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
    const [{ data }, { data: sd }, { data: ec }] = await Promise.all([
      supabase.from('niveaux').select('*').eq('ecole_id', user.ecole_id).order('ordre'),
      supabase.from('sourates').select('*').order('numero'),
      supabase.from('ecoles').select('sens_recitation_defaut').eq('id', user.ecole_id).maybeSingle(),
    ]);
    setNiveaux(data || []);
    setSouratesDB(sd || []);
    setEcoleConfig(ec || null);
    } catch (e) {
      console.error("Erreur:", e);
    }
    setLoading(false);
  };

  const ouvrirProgramme = async (n) => {
    setModeEditionProgramme(false);
    setNiveauProgramme(n);

    // Toujours charger les sourates fraiches si niveau sourate
    let sDB = souratesDB;
    if (n.type === 'sourate') {
      const { data: sd } = await supabase.from('sourates').select('*').order('numero');
      if (sd && sd.length > 0) { setSouratesDB(sd); sDB = sd; }
    }

  // Charger le programme
  const { data } = await supabase
    .from('programmes')
    .select('reference_id, ordre, bloc_numero, bloc_nom, bloc_sens')
    .eq('niveau_id', n.id)
    .eq('ecole_id', user.ecole_id)
    .order('ordre');

  if (data && data.length > 0) {
    if (n.type === 'hizb') {
      setProgramme(data.map(d => parseInt(d.reference_id)));
    } else {
      // reference_id = id de la sourate dans la table sourates (clé primaire)
      // On utilise directement ces ids sans conversion
      // Normaliser en strings pour cohérence
      const ids = data.map(d => String(d.reference_id));
      setProgramme(ids);
    }

    // ─── Reconstituer les blocs depuis les données BDD ───
    // Regroupe les lignes par bloc_numero et reconstruit la liste de blocs
    const blocsMap = new Map();
    data.forEach(d => {
      const numBloc = d.bloc_numero || 1;
      if (!blocsMap.has(numBloc)) {
        blocsMap.set(numBloc, {
          numero: numBloc,
          nom: d.bloc_nom || '',
          sens: d.bloc_sens || 'asc',
          hizbs: [],
        });
      }
      blocsMap.get(numBloc).hizbs.push(parseInt(d.reference_id));
    });
    const blocsArray = Array.from(blocsMap.values()).sort((a, b) => a.numero - b.numero);

    // Active le mode blocs si plus d'un bloc détecté
    if (blocsArray.length > 1) {
      setUseBlocs(true);
      setBlocs(blocsArray);
    } else {
      setUseBlocs(false);
      // On garde les blocs vides pour le cas où l'user active le mode blocs
      setBlocs([{ numero: 1, nom: '', sens: 'asc', hizbs: [] }]);
    }
  } else {
    setProgramme([]);
    setUseBlocs(false);
    setBlocs([{ numero: 1, nom: '', sens: 'asc', hizbs: [] }]);
  }
  };

  const fermerProgramme = () => {
    setNiveauProgramme(null);
    setProgramme([]);
    setModeEditionProgramme(false);
  };

  const toggleProgrammeItem = (id) => {
    // Sauvegarder la position de scroll avant le re-render
    const scrollTop = panneauScrollRef.current?.scrollTop || 0;
    setProgramme(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    // Restaurer la position après le re-render
    requestAnimationFrame(() => {
      if (panneauScrollRef.current) {
        panneauScrollRef.current.scrollTop = scrollTop;
      }
    });
  };

  // ─── Helpers gestion des blocs ──────────────────────────
  const ajouterBloc = () => {
    setBlocs(prev => [...prev, {
      numero: prev.length + 1,
      nom: '',
      sens: 'asc',
      hizbs: [],
    }]);
  };

  const supprimerBloc = (index) => {
    setBlocs(prev => {
      const nouveau = prev.filter((_, i) => i !== index);
      // Renuméroter les blocs restants
      return nouveau.map((b, i) => ({ ...b, numero: i + 1 }));
    });
  };

  const modifierBloc = (index, champ, valeur) => {
    setBlocs(prev => prev.map((b, i) => i === index ? { ...b, [champ]: valeur } : b));
  };

  const toggleHizbDansBloc = (indexBloc, hizb) => {
    setBlocs(prev => prev.map((b, i) => {
      if (i !== indexBloc) return b;
      const hizbs = b.hizbs.includes(hizb)
        ? b.hizbs.filter(h => h !== hizb)
        : [...b.hizbs, hizb];
      return { ...b, hizbs };
    }));
  };

  // Retourne les hizbs déjà pris par d'autres blocs (pour les griser)
  const hizbsPrisParAutresBlocs = (indexBlocCourant) => {
    const pris = new Set();
    blocs.forEach((b, i) => {
      if (i !== indexBlocCourant) {
        (b.hizbs || []).forEach(h => pris.add(h));
      }
    });
    return pris;
  };

  const sauvegarderProgramme = async () => {
    if (!niveauProgramme) return;

    // ─── Mode BLOCS ───────────────────────────────────────────
    // Valide chaque bloc, trie son contenu selon son sens, puis
    // construit un ordre global qui concatène tous les blocs.
    if (useBlocs && niveauProgramme.type === 'hizb') {
      // Validation : au moins 1 bloc avec des hizbs
      const blocsNonVides = blocs.filter(b => (b.hizbs || []).length > 0);
      if (blocsNonVides.length === 0) {
        return toast.warning(lang==='ar' ? 'أضف على الأقل حزباً واحداً في بلوك' : 'Ajoutez au moins un Hizb dans un bloc');
      }

      setSavingProg(true);
      // Supprimer l'ancien programme
      await supabase.from('programmes').delete().eq('niveau_id', niveauProgramme.id).eq('ecole_id', user.ecole_id);

      // Construire les lignes : pour chaque bloc, trier ses hizbs selon son sens
      // puis incrémenter l'ordre globalement
      const rows = [];
      let ordreGlobal = 1;
      blocsNonVides.forEach((bloc, idxBloc) => {
        const hizbsTries = [...bloc.hizbs];
        if (bloc.sens === 'asc') {
          hizbsTries.sort((a, b) => a - b);
        } else {
          hizbsTries.sort((a, b) => b - a);
        }
        hizbsTries.forEach(h => {
          rows.push({
            niveau_id: niveauProgramme.id,
            ecole_id: user.ecole_id,
            type_contenu: 'hizb',
            reference_id: String(h),
            ordre: ordreGlobal++,
            obligatoire: true,
            bloc_numero: idxBloc + 1,
            bloc_nom: bloc.nom || null,
            bloc_sens: bloc.sens,
          });
        });
      });

      const { error } = await supabase.from('programmes').insert(rows);
      setSavingProg(false);
      if (error) { toast.error(error.message || 'Erreur'); return; }
      toast.success(lang==='ar' ? '✅ تم حفظ البرنامج مع البلوكات' : '✅ Programme enregistré avec blocs !');
      setModeEditionProgramme(false);
      // Recharger
      await ouvrirProgramme(niveauProgramme);
      loadData();
      return;
    }

    // ─── Mode CONTINU (comportement classique) ────────────────
    if (programme.length === 0) return toast.warning(lang==='ar'?'اختر عناصر البرنامج':'Sélectionnez au moins un élément');
    setSavingProg(true);
    // Supprimer l'ancien programme
    await supabase.from('programmes').delete().eq('niveau_id', niveauProgramme.id).eq('ecole_id', user.ecole_id);

    // Trier le programme avant sauvegarde
    let programmeTrie = [...programme];
    if (niveauProgramme.type === 'sourate') {
      // Trier par numéro de sourate décroissant (114→1)
      programmeTrie.sort((a, b) => {
        const numA = (souratesDB||[]).find(s => String(s.id) === String(a))?.numero || 0;
        const numB = (souratesDB||[]).find(s => String(s.id) === String(b))?.numero || 0;
        return numB - numA;
      });
    } else {
      // Hizb : trier décroissant (60→1)
      programmeTrie.sort((a, b) => b - a);
    }

    // Insérer le nouveau (bloc_numero=1 par défaut, bloc_sens=asc par défaut)
    const rows = programmeTrie.map((id, idx) => ({
      niveau_id: niveauProgramme.id,
      ecole_id: user.ecole_id,
      type_contenu: niveauProgramme.type,
      reference_id: String(id),
      ordre: idx + 1,
      obligatoire: true,
      bloc_numero: 1,
      bloc_nom: null,
      bloc_sens: 'asc',
    }));
    const { error } = await supabase.from('programmes').insert(rows);
    setSavingProg(false);
    if (error) { toast.error(error.message || 'Erreur'); return; }
    toast.success(lang==='ar'?'✅ تم حفظ البرنامج':'✅ Programme enregistré !');
    setModeEditionProgramme(false);
    // Recharger le programme affiché sans fermer le panneau
    const { data: freshData } = await supabase.from('programmes')
      .select('reference_id').eq('niveau_id',niveauProgramme.id).eq('ecole_id',user.ecole_id).order('ordre');
    if (freshData) {
      setProgramme(niveauProgramme.type==='hizb'
        ? freshData.map(d=>parseInt(d.reference_id))
        : freshData.map(d=>d.reference_id)
      );
    }
    loadData();
  };

  const startEdit = async (n) => {
    setEditing(n.id);
    // Charger nb_sequences depuis sequences_config
    let nbSeq = 3;
    if (n.type === 'sourate') {
      const { data: sc } = await supabase.from('sequences_config')
        .select('nb_sequences').eq('niveau_id',n.id).eq('ecole_id',user.ecole_id).maybeSingle();
      if (sc) nbSeq = sc.nb_sequences;
    }
    setForm({ code: n.code, nom: n.nom, type: n.type, couleur: n.couleur, ordre: n.ordre, nb_sequences: nbSeq });
    // Charger le programme existant dans le formulaire
    const { data } = await supabase.from('programmes')
      .select('reference_id').eq('niveau_id', n.id)
      .eq('ecole_id', user.ecole_id).order('ordre');
    if (data && data.length > 0) {
      setFormProgramme(n.type === 'hizb'
        ? data.map(d => parseInt(d.reference_id))
        : data.map(d => d.reference_id)
      );
    } else {
      setFormProgramme([]);
    }
    setShowForm(true);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ ...emptyForm, ordre: (niveaux.length + 1) });
    setFormProgramme([]);
    setShowForm(false);
  };

  // Programme dans le formulaire de création

  const toggleFormProgramme = (id) => {
    setFormProgramme(prev =>
      prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]
    );
  };

  const save = async () => {
    if (!form.code.trim()) return toast.warning(lang==='ar'?'الرمز إلزامي':'Le code est obligatoire');
    if (!form.nom.trim())  return toast.warning(lang==='ar'?'الاسم إلزامي':'Le nom est obligatoire');
    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      nom: form.nom.trim(),
      type: form.type,
      couleur: form.couleur,
      ordre: parseInt(form.ordre) || 1,
      ecole_id: user.ecole_id,
    };
    // nb_sequences → table sequences_config (séparée)
    const nbSeq = form.type==='sourate' ? (parseInt(form.nb_sequences)||3) : null;
    let niveauId = editing;
    let error;
    if (editing) {
      ({ error } = await supabase.from('niveaux').update(payload).eq('id', editing));
    } else {
      const { data: newNiveau, error: insertErr } = await supabase
        .from('niveaux').insert(payload).select().single();
      error = insertErr;
      if (newNiveau) niveauId = newNiveau.id;
    }
    if (error) {
      setSaving(false);
      if (error.code === '23505') toast.error(lang==='ar'?'هذا الرمز موجود بالفعل':'Ce code existe déjà');
      else toast.error(error.message || 'Erreur');
      return;
    }
    // Sauvegarder nb_sequences si niveau sourate
    if (niveauId && nbSeq !== null) {
      await supabase.from('sequences_config').upsert({
        ecole_id: user.ecole_id,
        niveau_id: niveauId,
        nb_sequences: nbSeq,
      }, { onConflict: 'ecole_id,niveau_id' });
    }

    // Sauvegarder le programme si défini dans le formulaire
    if (niveauId && formProgramme.length > 0) {
      await supabase.from('programmes').delete().eq('niveau_id', niveauId).eq('ecole_id', user.ecole_id);
      const rows = formProgramme.map((id, idx) => ({
        niveau_id: niveauId,
        ecole_id: user.ecole_id,
        type_contenu: form.type,
        reference_id: String(id),
        ordre: idx + 1,
        obligatoire: true,
      }));
      await supabase.from('programmes').insert(rows);
    }
    setSaving(false);
    toast.success(editing
      ? (lang==='ar'?'✅ تم تحديث المستوى':'✅ Niveau modifié !')
      : (lang==='ar'?'✅ تم إضافة المستوى':'✅ Niveau ajouté !'));
    setFormProgramme([]);
    resetForm();
    loadData();
  };

  const toggleActif = async (n) => {
    await supabase.from('niveaux').update({ actif: !n.actif }).eq('id', n.id);
    loadData();
  };

  const supprimer = (n) => {
    setConfirmModal({
      isOpen: true,
      title: lang==='ar'?'حذف المستوى':'Supprimer le niveau',
      message: (lang==='ar'?'هل تريد حذف المستوى ':'Supprimer le niveau ') + n.nom + ' (' + n.code + ') ?',
      onConfirm: async () => {
        const { error } = await supabase.from('niveaux').delete().eq('id', n.id);
        if (error) toast.error(lang==='ar'?'لا يمكن الحذف — هناك طلاب مرتبطون':'Impossible — des élèves utilisent ce niveau');
        else { toast.success(lang==='ar'?'تم الحذف':'Niveau supprimé'); loadData(); }
        setConfirmModal({isOpen:false});
      }
    });
  };

  const moveUp = async (n, idx) => {
    if (idx === 0) return;
    const prev = niveaux[idx - 1];
    await supabase.from('niveaux').update({ ordre: n.ordre }).eq('id', prev.id);
    await supabase.from('niveaux').update({ ordre: prev.ordre }).eq('id', n.id);
    loadData();
  };

  const moveDown = async (n, idx) => {
    if (idx === niveaux.length - 1) return;
    const next = niveaux[idx + 1];
    await supabase.from('niveaux').update({ ordre: n.ordre }).eq('id', next.id);
    await supabase.from('niveaux').update({ ordre: next.ordre }).eq('id', n.id);
    loadData();
  };


  // ── PANNEAU PROGRAMME — Affichage + Modification ───────────────
  const PanneauProgramme = () => {
    if (!niveauProgramme) return null;
    const nc = niveauProgramme.couleur || '#1D9E75';
    const souratesNiveau = niveauProgramme.type === 'sourate'
      ? (souratesDB||[]).filter(s => programme.includes(s.id)).sort((a,b)=>b.numero-a.numero)
      : [];

    // Mode affichage
    if (!modeEditionProgramme) {
      return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
          zIndex:1000,display:'flex',
          alignItems:isMobile?'flex-end':'center',
          justifyContent:'center',padding:isMobile?0:'20px'}}>
          <div style={{background:'#fff',
            borderRadius:isMobile?'20px 20px 0 0':'16px',
            width:'100%',maxWidth:640,
            maxHeight:isMobile?'85vh':'80vh',
            display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Header */}
            <div style={{padding:'18px 18px 14px',borderBottom:'0.5px solid #e0e0d8',
              display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${nc}20`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontWeight:800,fontSize:16,color:nc,flexShrink:0}}>
                {niveauProgramme.code}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:16,color:'#1a1a1a'}}>
                  {lang==='ar'?'برنامج المستوى':'Programme du niveau'}
                </div>
                <div style={{fontSize:12,color:'#888',marginTop:2}}>
                  {niveauProgramme.nom} · {programme.length} {lang==='ar'?'محدد':'élément(s)'}
                </div>
              </div>
              <button onClick={()=>{setFormProgramme([...programme]);setModeEditionProgramme(true);}}
                style={{padding:'8px 14px',background:'#E6F1FB',color:'#0C447C',border:'none',
                  borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                ✏️ {lang==='ar'?'تعديل':'Modifier'}
              </button>
              <button onClick={()=>{fermerProgramme();setModeEditionProgramme(false);}}
                style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:'#888',padding:0}}>×</button>
            </div>
            {/* Contenu */}
            <div style={{flex:1,overflowY:'auto',padding:'16px 18px'}}>
              {programme.length===0?(
                <div style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>
                  <div style={{fontSize:32,marginBottom:8}}>📚</div>
                  <div style={{fontSize:14,marginBottom:12}}>
                    {lang==='ar'?'لا يوجد برنامج محدد':'Aucun programme défini'}
                  </div>
                  <button onClick={()=>setModeEditionProgramme(true)}
                    style={{padding:'10px 20px',background:nc,color:'#fff',border:'none',
                      borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    {lang==='ar'?'تحديد البرنامج':'Définir le programme'}
                  </button>
                </div>
              ):niveauProgramme.type==='hizb'?(
                <>
                  {useBlocs && blocs.filter(b => (b.hizbs||[]).length>0).length > 1 ? (
                    // ─── Affichage par BLOCS ──────────────────
                    <>
                      <div style={{fontSize:12,color:'#888',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
                        <span>📚</span>
                        <span>{lang==='ar'?'البرنامج مقسم إلى ':'Programme en '}<strong>{blocs.filter(b=>(b.hizbs||[]).length>0).length}</strong>{lang==='ar'?' بلوكات':' blocs'}</span>
                      </div>
                      {blocs.filter(b => (b.hizbs||[]).length>0).map((bloc, idx) => {
                        const hizbsTries = [...bloc.hizbs].sort((a,b) => bloc.sens==='asc' ? a-b : b-a);
                        return (
                          <div key={idx} style={{marginBottom:14,padding:'12px',borderRadius:10,background:`${nc}08`,border:`1px solid ${nc}25`}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                              <div style={{width:24,height:24,borderRadius:6,background:nc,color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                {bloc.numero}
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13,fontWeight:700,color:'#1a1a1a'}}>
                                  {bloc.nom || (lang==='ar'?`البلوك ${bloc.numero}`:`Bloc ${bloc.numero}`)}
                                </div>
                                <div style={{fontSize:10,color:'#888'}}>
                                  {bloc.hizbs.length} {lang==='ar'?'حزب · ':'Hizb · '}
                                  {bloc.sens==='asc'?(lang==='ar'?'تصاعدي ↑':'Asc ↑'):(lang==='ar'?'تنازلي ↓':'Desc ↓')}
                                </div>
                              </div>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3}}>
                              {hizbsTries.map(h => (
                                <div key={h} style={{height:30,borderRadius:6,display:'flex',alignItems:'center',
                                  justifyContent:'center',fontSize:11,fontWeight:700,
                                  background:`${nc}20`,color:nc,border:`1px solid ${nc}40`}}>
                                  {h}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    // ─── Affichage CONTINU (classique) ─────────
                    <>
                      <div style={{fontSize:12,color:'#888',marginBottom:12}}>
                        {lang==='ar'?'الأحزاب المحددة:':'Hizb sélectionnés :'}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:4}}>
                        {[...programme].sort((a,b)=>a-b).map(h=>(
                          <div key={h} style={{height:36,borderRadius:8,display:'flex',alignItems:'center',
                            justifyContent:'center',fontSize:12,fontWeight:700,
                            background:`${nc}20`,color:nc,border:`1.5px solid ${nc}40`}}>
                            {h}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ):(
                <>
                  <div style={{fontSize:12,color:'#888',marginBottom:12}}>
                    {lang==='ar'?'السور المحددة:':'Sourates sélectionnées :'}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {souratesNiveau.map(s=>(
                      <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,
                        padding:'9px 12px',borderRadius:10,background:`${nc}10`,border:`1.5px solid ${nc}30`}}>
                        <span style={{fontSize:11,color:'#aaa',minWidth:24}}>{s.numero}</span>
                        <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",
                          direction:'rtl',color:nc,fontWeight:600}}>{s.nom_ar}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Mode édition (ancien panneau)
    return (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',
        zIndex:1000,display:'flex',
        alignItems:isMobile?'flex-end':'center',
        justifyContent:'center',padding:isMobile?0:'20px'}}>
        <div style={{background:'#fff',
          borderRadius:isMobile?'20px 20px 0 0':'16px',
          width:'100%',maxWidth:640,
          maxHeight:isMobile?'90vh':'80vh',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Header panneau édition */}
          <div style={{padding:'18px 18px 14px',borderBottom:'0.5px solid #e0e0d8',
            display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            <div style={{width:40,height:40,borderRadius:10,background:`${nc}20`,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontWeight:800,fontSize:16,color:nc,flexShrink:0}}>
              {niveauProgramme.code}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:16,color:'#1a1a1a'}}>
                {lang==='ar'?'برنامج المستوى':'Programme du niveau'}
              </div>
              <div style={{fontSize:12,color:'#888',marginTop:2}}>
                {niveauProgramme.nom} · {niveauProgramme.type==='hizb'
                  ?(lang==='ar'?'أحزاب':'Hizb')
                  :(lang==='ar'?'سور':'Sourates')}
                <span style={{marginLeft:8,fontWeight:600,color:nc}}>
                  {programme.length} {lang==='ar'?'محدد':'sélectionné(s)'}
                </span>
              </div>
            </div>
            <button onClick={fermerProgramme}
              style={{background:'none',border:'none',fontSize:24,cursor:'pointer',
                color:'#888',padding:0,lineHeight:1}}>×</button>
          </div>

          {/* ─── Toggle Mode Continu / Mode Blocs (niveaux Hizb uniquement) ─── */}
          {niveauProgramme.type==='hizb'&&(
            <div style={{padding:'12px 18px 0',flexShrink:0}}>
              <div style={{display:'flex',gap:6,padding:4,background:'#f5f5f0',borderRadius:10}}>
                <button onClick={()=>setUseBlocs(false)}
                  style={{flex:1,padding:'7px 10px',borderRadius:7,border:'none',cursor:'pointer',
                    background:!useBlocs?'#fff':'transparent',
                    color:!useBlocs?nc:'#888',
                    fontSize:12,fontWeight:!useBlocs?700:500,
                    boxShadow:!useBlocs?'0 1px 3px rgba(0,0,0,0.08)':'none',
                    fontFamily:'inherit'}}>
                  📄 {lang==='ar'?'برنامج متصل':'Continu'}
                </button>
                <button onClick={()=>setUseBlocs(true)}
                  style={{flex:1,padding:'7px 10px',borderRadius:7,border:'none',cursor:'pointer',
                    background:useBlocs?'#fff':'transparent',
                    color:useBlocs?nc:'#888',
                    fontSize:12,fontWeight:useBlocs?700:500,
                    boxShadow:useBlocs?'0 1px 3px rgba(0,0,0,0.08)':'none',
                    fontFamily:'inherit'}}>
                  📚 {lang==='ar'?'بلوكات متعددة':'Par blocs'}
                </button>
              </div>
              <div style={{fontSize:10,color:'#888',marginTop:6,fontStyle:'italic'}}>
                {useBlocs
                  ? (lang==='ar'?'كل بلوك له اسم واتجاه خاص (تصاعدي/تنازلي)':'Chaque bloc a son nom et son sens de récitation')
                  : (lang==='ar'?'برنامج عادي بدون تقسيم':'Programme classique sans découpage')}
              </div>
            </div>
          )}

          {/* Sélection rapide Hizb — mode CONTINU uniquement */}
          {niveauProgramme.type==='hizb'&&!useBlocs&&(
            <div style={{padding:'12px 18px 0',flexShrink:0}}>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:4}}>
                <span style={{fontSize:11,color:'#888',alignSelf:'center'}}>
                  {lang==='ar'?'اختيار سريع:':'Sélection rapide :'}
                </span>
                {[1,5,10,15,20,30,60].map(n=>(
                  <button key={n}
                    onClick={()=>setProgramme(Array.from({length:n},(_,i)=>i+1))}
                    style={{padding:'3px 10px',borderRadius:20,
                      border:'0.5px solid #e0e0d8',background:'#f5f5f0',
                      fontSize:11,cursor:'pointer',color:'#666'}}>
                    1→{n}
                  </button>
                ))}
                {programme.length>0&&(
                  <button onClick={()=>setProgramme([])}
                    style={{padding:'3px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',
                      background:'#FCEBEB',fontSize:11,cursor:'pointer',color:'#E24B4A'}}>
                    ✕ {lang==='ar'?'مسح':'Effacer'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Contenu scrollable */}
          <div ref={panneauScrollRef} style={{flex:1,overflowY:'auto',padding:'12px 18px',overscrollBehavior:'contain'}}>

            {/* Grille Hizb — Mode CONTINU */}
            {niveauProgramme.type==='hizb'&&!useBlocs&&(
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:5}}>
                {makeHizbList(niveauProgramme.sens_recitation || ecoleConfig?.sens_recitation_defaut || 'desc').map(h=>{
                  const sel = programme.includes(h);
                  return(
                    <div key={h} onClick={()=>toggleProgrammeItem(h)}
                      style={{height:38,borderRadius:8,display:'flex',
                        alignItems:'center',justifyContent:'center',
                        fontSize:12,fontWeight:sel?700:400,cursor:'pointer',
                        background:sel?nc:'#f5f5f0',
                        color:sel?'#fff':'#666',
                        border:`1.5px solid ${sel?nc:'#e0e0d8'}`,
                        transition:'all 0.1s'}}>
                      {h}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Grille Hizb — Mode BLOCS */}
            {niveauProgramme.type==='hizb'&&useBlocs&&(
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {blocs.map((bloc, idx) => (
                  <BlocEditor
                    key={`bloc-${idx}`}
                    bloc={bloc}
                    idx={idx}
                    nc={nc}
                    lang={lang}
                    isOpen={blocEnEdition === idx}
                    canDelete={blocs.length > 1}
                    hizbsPris={hizbsPrisParAutresBlocs(idx)}
                    onNomChange={(i, v) => modifierBloc(i, 'nom', v)}
                    onSensChange={(i, v) => modifierBloc(i, 'sens', v)}
                    onDelete={supprimerBloc}
                    onToggleOpen={(i) => setBlocEnEdition(prev => prev === i ? null : i)}
                    onToggleHizb={toggleHizbDansBloc}
                  />
                ))}

                {/* Bouton ajouter un bloc */}
                <button onClick={ajouterBloc}
                  style={{padding:'12px',borderRadius:12,border:`1.5px dashed ${nc}80`,background:`${nc}08`,
                    color:nc,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit',
                    display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                  <span style={{fontSize:16}}>+</span>
                  {lang==='ar'?'إضافة بلوك':'Ajouter un bloc'}
                </button>
              </div>
            )}

            {/* Liste Sourates — TOUTES les sourates, cochées si dans le programme */}
            {niveauProgramme.type==='sourate'&&(
              <>
                {/* Barre de sélection rapide */}
                <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center',flexWrap:'wrap'}}>
                  <button onClick={()=>setProgramme(souratesDB.map(s=>String(s.id)))}
                    style={{padding:'4px 12px',borderRadius:20,border:`0.5px solid ${nc}`,
                      background:`${nc}20`,color:nc,fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>
                    {lang==='ar'?'تحديد الكل':'Tout sélectionner'} ({souratesDB.length})
                  </button>
                  {programme.length>0&&(
                    <button onClick={()=>setProgramme([])}
                      style={{padding:'4px 12px',borderRadius:20,border:'0.5px solid #e0e0d8',
                        background:'#FCEBEB',fontSize:11,cursor:'pointer',color:'#E24B4A',fontFamily:'inherit'}}>
                      ✕ {lang==='ar'?'مسح الكل':'Tout décocher'}
                    </button>
                  )}
                  <span style={{fontSize:11,color:nc,fontWeight:700,marginRight:'auto'}}>
                    {programme.length} {lang==='ar'?'محدد':'cochée(s)'}
                  </span>
                </div>
                {/* Liste complète des sourates */}
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {souratesDB.length===0&&(
                    <div style={{textAlign:'center',color:'#aaa',padding:'2rem',fontSize:13}}>
                      {lang==='ar'?'جاري التحميل...':'Chargement...'}
                    </div>
                  )}
                  {[...souratesDB].sort((a,b)=>b.numero-a.numero).map(s=>{
                    const sel = programme.includes(String(s.id));
                    return(
                      <div key={s.id} onClick={()=>toggleProgrammeItem(String(s.id))}
                        style={{display:'flex',alignItems:'center',gap:10,
                          padding:'10px 12px',borderRadius:10,cursor:'pointer',
                          background:sel?`${nc}10`:'#f5f5f0',
                          border:`1.5px solid ${sel?nc:'#e0e0d8'}`}}>
                        <div style={{width:22,height:22,borderRadius:5,flexShrink:0,
                          border:`1.5px solid ${sel?nc:'#ccc'}`,
                          background:sel?nc:'#fff',
                          display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {sel&&<span style={{color:'#fff',fontSize:12,fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:11,color:'#aaa',minWidth:24}}>{s.numero}</span>
                        <span style={{flex:1,fontSize:14,fontFamily:"'Tajawal',Arial",
                          direction:'rtl',color:sel?nc:'#333',
                          fontWeight:sel?600:400}}>{s.nom_ar}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Bouton sauvegarder */}
          <div style={{padding:'14px 18px',borderTop:'0.5px solid #e0e0d8',flexShrink:0,display:'flex',gap:8}}>
            <button onClick={()=>setModeEditionProgramme(false)}
              style={{flex:1,padding:'14px',background:'#f5f5f0',color:'#666',border:'none',
                borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              {lang==='ar'?'إلغاء':'Annuler'}
            </button>
            <button onClick={async()=>{await sauvegarderProgramme();setModeEditionProgramme(false);}}
              disabled={savingProg||programme.length===0}
              style={{flex:2,padding:'14px',
                background:savingProg||programme.length===0?'#ccc':nc,
                color:'#fff',border:'none',borderRadius:12,
                fontSize:15,fontWeight:700,
                cursor:savingProg||programme.length===0?'not-allowed':'pointer',
                fontFamily:'inherit'}}>
              {savingProg?'...':(lang==='ar'?'حفظ البرنامج':'Enregistrer le programme')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── MOBILE ──────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{paddingBottom:80, background:'#f5f5f0', minHeight:'100vh'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 14px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
            <button onClick={()=>goBack?goBack():navigate('dashboard')} style={{background:'rgba(255,255,255,0.22)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,padding:'0',color:'#fff',fontSize:20,cursor:'pointer',flexShrink:0,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{flex:1, fontSize:17, fontWeight:800, color:'#fff'}}>
              📚 {lang==='ar'?'المستويات':'Niveaux'}
            </div>
            <button onClick={()=>{setEditing(null);setForm({...emptyForm,ordre:niveaux.length+1});setShowForm(v=>!v);}}
              style={{background:'rgba(255,255,255,0.25)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,padding:'8px 14px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0,whiteSpace:'nowrap'}}>
              {showForm&&!editing?'✕':'+ Ajouter'}
            </button>
          </div>
        </div>

        <div style={{padding:'12px'}}>
          {/* Formulaire */}
          {showForm && (
            <div style={{background:'#fff',borderRadius:16,padding:'18px',marginBottom:14,
              border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`}}>
              <div style={{fontSize:15,fontWeight:700,color:'#fff',marginBottom:14}}>
                {editing?(lang==='ar'?'تعديل المستوى':'✏️ Modifier niveau'):(lang==='ar'?'إضافة مستوى':'📚 Nouveau niveau')}
              </div>

              {/* Code */}
              <div style={{marginBottom:12}}>
                <label className="field-lbl">
                  {lang==='ar'?'رمز المستوى (مثال: N1, CM2)':'Code (ex: N1, CM2) *'}
                </label>
                <input style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid #e0e0d8',fontSize:15,fontFamily:'inherit',boxSizing:'border-box',textTransform:'uppercase'}}
                  value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))}
                  placeholder="N1"/>
              </div>

              {/* Nom */}
              <div style={{marginBottom:12}}>
                <label className="field-lbl">
                  {lang==='ar'?'اسم المستوى':'Nom du niveau *'}
                </label>
                <input className="field-input"
                  value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
                  placeholder={lang==='ar'?'مثال: مستوى مبتدئ':'Ex: Niveau débutant'}/>
              </div>

              {/* Type */}
              <div style={{marginBottom:12}}>
                <label className="field-lbl">
                  {lang==='ar'?'نوع الاستظهار':'Type de récitation *'}
                </label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {val:'hizb',    icon:'📿', fr:'Hizb / Tomon',  ar:'حزب / ثُمن'},
                    {val:'sourate', icon:'📖', fr:'Sourates',       ar:'سور'},
                  ].map(t=>(
                    <div key={t.val} onClick={()=>setForm(f=>({...f,type:t.val}))}
                      style={{padding:'12px',borderRadius:12,textAlign:'center',cursor:'pointer',
                        background:form.type===t.val?'#E1F5EE':'#f5f5f0',
                        border:`1.5px solid ${form.type===t.val?'#1D9E75':'#e0e0d8'}`,
                        color:form.type===t.val?'#085041':'#666'}}>
                      <div style={{fontSize:22,marginBottom:4}}>{t.icon}</div>
                      <div style={{fontSize:12,fontWeight:form.type===t.val?700:400}}>{lang==='ar'?t.ar:t.fr}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Couleur */}
              <div style={{marginBottom:14}}>
                <label className="field-lbl">
                  {lang==='ar'?'اللون':'Couleur'}
                </label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                  {COULEURS_PRESET.map(col=>(
                    <div key={col} onClick={()=>setForm(f=>({...f,couleur:col}))}
                      style={{width:32,height:32,borderRadius:'50%',background:col,cursor:'pointer',
                        border:`3px solid ${form.couleur===col?'#1a1a1a':'transparent'}`,
                        flexShrink:0}}/>
                  ))}
                  <input type="color" value={form.couleur}
                    onChange={e=>setForm(f=>({...f,couleur:e.target.value}))}
                    style={{width:32,height:32,borderRadius:'50%',border:'none',cursor:'pointer',padding:0,background:'none'}}
                    title="Couleur personnalisée"/>
                </div>
                {/* Aperçu */}
                <div style={{marginTop:10,display:'inline-flex',alignItems:'center',gap:8,
                  padding:'6px 14px',borderRadius:20,background:`${form.couleur}20`,
                  border:`1.5px solid ${form.couleur}40`}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:form.couleur}}/>
                  <span style={{fontSize:13,fontWeight:700,color:form.couleur}}>
                    {form.code||'CODE'} — {form.nom||lang==='ar'?'اسم المستوى':'Nom du niveau'}
                  </span>
                </div>
              </div>


              {/* ── Programme du niveau ── */}
              <div style={{marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#666'}}>
                    📚 {lang==='ar'?'برنامج المستوى':'Programme du niveau'}
                  </label>
                  <span style={{fontSize:12,fontWeight:700,color:formProgramme.length>0?form.couleur:'#aaa'}}>
                    {formProgramme.length>0?`${formProgramme.length} ${lang==='ar'?'محدد':'sélectionné(s)'}`:lang==='ar'?'لم يُحدد':'Non défini'}
                  </span>
                </div>
                {form.type==='hizb'&&(
                  <>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                      {[1,5,10,15,20,30,60].map(n=>(
                        <button key={n} onClick={()=>setFormProgramme(Array.from({length:n},(_,i)=>i+1))}
                          style={{padding:'3px 9px',borderRadius:20,border:'0.5px solid #e0e0d8',
                            background:'#f5f5f0',fontSize:11,cursor:'pointer',color:'#666',fontFamily:'inherit'}}>
                          1→{n}
                        </button>
                      ))}
                      {formProgramme.length>0&&(
                        <button onClick={()=>setFormProgramme([])}
                          style={{padding:'3px 9px',borderRadius:20,border:'0.5px solid #e0e0d8',
                            background:'#FCEBEB',fontSize:11,cursor:'pointer',color:'#E24B4A',fontFamily:'inherit'}}>✕</button>
                      )}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:3}}>
                      {(() => {
                        const nivEdit = editing ? niveaux.find(n=>n.id===editing) : null;
                        const sensForm = nivEdit?.sens_recitation || ecoleConfig?.sens_recitation_defaut || 'desc';
                        return makeHizbList(sensForm).map(h=>{
                        const sel=formProgramme.includes(h);
                        return(
                          <div key={h} onClick={()=>toggleFormProgramme(h)}
                            style={{height:30,borderRadius:6,display:'flex',alignItems:'center',
                              justifyContent:'center',fontSize:11,fontWeight:sel?700:400,cursor:'pointer',
                              background:sel?form.couleur:'#f5f5f0',
                              color:sel?'#fff':'#666',
                              border:`1.5px solid ${sel?form.couleur:'#e0e0d8'}`}}>
                            {h}
                          </div>
                        );
                      });
                      })()}
                    </div>
                  </>
                )}
                {form.type==='sourate'&&(
                  <div style={{maxHeight:180,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                    {getSouratesDesc().map(s=>{
                      const dbS=(souratesDB||[]).find(x=>x.numero===s.numero);
                      if(!dbS) return null;
                      const sel=formProgramme.includes(dbS.id);
                      return(
                        <div key={dbS.id} onClick={()=>toggleFormProgramme(dbS.id)}
                          style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',
                            borderRadius:8,cursor:'pointer',
                            background:sel?`${form.couleur}15`:'#f5f5f0',
                            border:`1.5px solid ${sel?form.couleur:'#e0e0d8'}`}}>
                          <div style={{width:18,height:18,borderRadius:4,flexShrink:0,
                            border:`1.5px solid ${sel?form.couleur:'#ccc'}`,
                            background:sel?form.couleur:'#fff',
                            display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {sel&&<span style={{color:'#fff',fontSize:10,fontWeight:700}}>✓</span>}
                          </div>
                          <span style={{fontSize:10,color:'#aaa',minWidth:20}}>{s.numero}</span>
                          <span style={{flex:1,fontSize:13,fontFamily:"'Tajawal',Arial",direction:'rtl',
                            color:sel?form.couleur:'#333',fontWeight:sel?600:400}}>{s.nom_ar}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Boutons */}
              <div style={{display:'flex',gap:8}}>
                <button onClick={resetForm}
                  style={{flex:1,padding:'13px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  {lang==='ar'?'إلغاء':'Annuler'}
                </button>
                <button onClick={save} disabled={saving}
                  style={{flex:2,padding:'13px',background:saving?'#ccc':editing?'#378ADD':'#1D9E75',
                    color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,
                    cursor:saving?'not-allowed':'pointer',fontFamily:'inherit'}}>
                  {saving?'...':(editing?(lang==='ar'?'تحديث':'Mettre à jour ✓'):(lang==='ar'?'حفظ':'Enregistrer'))}
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>...</div>}

          {/* Liste niveaux */}
          {!loading && niveaux.length === 0 && (
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fff',borderRadius:12}}>
              <div style={{fontSize:40,marginBottom:10}}>📚</div>
              <div style={{fontSize:14,marginBottom:16}}>{lang==='ar'?'لا توجد مستويات بعد':'Aucun niveau configuré'}</div>
              <div style={{fontSize:12,color:'#bbb'}}>{lang==='ar'?'أضف مستوى للبدء':'Ajoutez votre premier niveau pour commencer'}</div>
            </div>
          )}

          {!loading && niveaux.map((n, idx) => (
            <div key={n.id} style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:10,
              border:`0.5px solid ${n.actif?n.couleur+'30':'#e0e0d8'}`,
              opacity: n.actif ? 1 : 0.6}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {/* Badge niveau */}
                <div style={{width:48,height:48,borderRadius:12,background:`${n.couleur}20`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  border:`1.5px solid ${n.couleur}40`,flexShrink:0}}>
                  <span style={{fontSize:14,fontWeight:800,color:n.couleur}}>{n.code}</span>
                </div>
                {/* Infos */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:'#1a1a1a'}}>{n.nom}</div>
                  <div style={{display:'flex',gap:6,marginTop:4,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,
                      background:n.type==='sourate'?'#EEEDFE':'#E6F1FB',
                      color:n.type==='sourate'?'#534AB7':'#0C447C',fontWeight:600}}>
                      {n.type==='sourate'?'📖 Sourates':'📿 Hizb'}
                    </span>
                    <span style={{fontSize:11,color:'#aaa'}}>Ordre {n.ordre}</span>
                    {!n.actif && <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#f0f0ec',color:'#888'}}>
                      {lang==='ar'?'غير نشط':'Inactif'}
                    </span>}
                  </div>
                </div>
                {/* Actions réorder */}
                <div style={{display:'flex',flexDirection:'column',gap:2,flexShrink:0}}>
                  <button onClick={()=>moveUp(n,idx)} disabled={idx===0}
                    style={{background:'#f5f5f0',border:'none',borderRadius:6,padding:'4px 8px',
                      cursor:idx===0?'not-allowed':'pointer',opacity:idx===0?0.3:1,fontSize:12}}>▲</button>
                  <button onClick={()=>moveDown(n,idx)} disabled={idx===niveaux.length-1}
                    style={{background:'#f5f5f0',border:'none',borderRadius:6,padding:'4px 8px',
                      cursor:idx===niveaux.length-1?'not-allowed':'pointer',
                      opacity:idx===niveaux.length-1?0.3:1,fontSize:12}}>▼</button>
                </div>
              </div>
              {/* Boutons actions */}
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={()=>ouvrirProgramme(n)}
                  style={{flex:2,padding:'9px',background:`${n.couleur}20`,color:n.couleur,
                    border:`1.5px solid ${n.couleur}40`,borderRadius:10,fontSize:13,
                    fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                  📚 {lang==='ar'?'البرنامج':'Programme'}
                </button>
                <button onClick={()=>startEdit(n)}
                  style={{flex:1,padding:'9px',background:'#E6F1FB',color:'#0C447C',border:'none',
                    borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  ✏️
                </button>
                <button onClick={()=>supprimer(n)}
                  style={{padding:'9px 12px',background:'#FCEBEB',color:'#E24B4A',border:'none',
                    borderRadius:10,fontSize:13,cursor:'pointer'}}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        <PanneauProgramme/>
        {/* Confirm Modal */}
        {confirmModal.isOpen && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,
            display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:320,width:'100%'}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
              <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setConfirmModal({isOpen:false})}
                  style={{flex:1,padding:'12px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                  {lang==='ar'?'إلغاء':'Annuler'}
                </button>
                <button onClick={confirmModal.onConfirm}
                  style={{flex:1,padding:'12px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  {lang==='ar'?'حذف':'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PC ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="back-link" onClick={()=>goBack?goBack():navigate('dashboard')}></button>
          <div style={{fontSize:20,fontWeight:700}}>📚 {lang==='ar'?'إدارة المستويات':'Gestion des niveaux'}</div>
        </div>
        <button onClick={()=>{setEditing(null);setForm({...emptyForm,ordre:niveaux.length+1});setShowForm(v=>!v);}}
          style={{padding:'8px 18px',background:showForm&&!editing?'#f0f0ec':'#1D9E75',color:showForm&&!editing?'#666':'#fff',
            border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
          {showForm&&!editing?'✕ Annuler':'+ Nouveau niveau'}
        </button>
      </div>

      {/* Formulaire PC */}
      {showForm && (
        <div style={{background:'#fff',border:`1.5px solid ${editing?'#378ADD':'#1D9E75'}`,borderRadius:14,padding:'1.5rem',marginBottom:'1.5rem'}}>
          <div style={{fontSize:15,fontWeight:600,color:'#085041',marginBottom:'1rem'}}>
            {editing?'✏️ Modifier le niveau':'📚 Nouveau niveau'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
            <div>
              <label className="field-lbl">Code *</label>
              <input className="field-input" value={form.code}
                onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="N1"/>
            </div>
            <div>
              <label className="field-lbl">Nom *</label>
              <input className="field-input" value={form.nom}
                onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Niveau débutant"/>
            </div>
            <div>
              <label className="field-lbl">Ordre</label>
              <input className="field-input" type="number" min="1" value={form.ordre}
                onChange={e=>setForm(f=>({...f,ordre:e.target.value}))} inputMode='numeric'/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            <div>
              <label className="field-lbl">Type de récitation *</label>
              <div style={{display:'flex',gap:8}}>
                {[{val:'hizb',icon:'📿',fr:'Hizb / Tomon'},{val:'sourate',icon:'📖',fr:'Sourates'}].map(t=>(
                  <div key={t.val} onClick={()=>setForm(f=>({...f,type:t.val}))}
                    style={{flex:1,padding:'10px',borderRadius:10,textAlign:'center',cursor:'pointer',
                      background:form.type===t.val?'#E1F5EE':'#f5f5f0',
                      border:`1.5px solid ${form.type===t.val?'#1D9E75':'#e0e0d8'}`,
                      color:form.type===t.val?'#085041':'#666'}}>
                    <div style={{fontSize:18}}>{t.icon}</div>
                    <div style={{fontSize:12,fontWeight:form.type===t.val?600:400,marginTop:4}}>{t.fr}</div>
                  </div>
                ))}
              </div>
              {/* Nb séquences pour niveaux sourate */}
              {form.type==='sourate'&&(
                <div style={{marginTop:10}}>
                  <label className="field-lbl">
                    {lang==='ar'?'عدد المقاطع لكل سورة':'Nb de séquences par sourate'}
                  </label>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {[1,2,3,4,5,6].map(n=>(
                      <div key={n} onClick={()=>setForm(f=>({...f,nb_sequences:n}))}
                        style={{width:40,height:40,borderRadius:10,display:'flex',
                          alignItems:'center',justifyContent:'center',cursor:'pointer',
                          fontSize:16,fontWeight:700,
                          background:(form.nb_sequences||3)===n?form.couleur:'#f5f5f0',
                          color:(form.nb_sequences||3)===n?'#fff':'#666',
                          border:`1.5px solid ${(form.nb_sequences||3)===n?form.couleur:'#e0e0d8'}`}}>
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="field-lbl">Couleur</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                {COULEURS_PRESET.map(col=>(
                  <div key={col} onClick={()=>setForm(f=>({...f,couleur:col}))}
                    style={{width:28,height:28,borderRadius:'50%',background:col,cursor:'pointer',
                      border:`3px solid ${form.couleur===col?'#1a1a1a':'transparent'}`,flexShrink:0}}/>
                ))}
                <input type="color" value={form.couleur}
                  onChange={e=>setForm(f=>({...f,couleur:e.target.value}))}
                  style={{width:28,height:28,borderRadius:'50%',border:'none',cursor:'pointer',padding:0}}/>
                <span style={{padding:'4px 12px',borderRadius:20,background:`${form.couleur}20`,
                  color:form.couleur,fontWeight:700,fontSize:12,border:`1px solid ${form.couleur}40`}}>
                  {form.code||'CODE'}
                </span>
              </div>
            </div>
          </div>
          {/* ── Programme du niveau ── */}
          <div style={{marginBottom:18,padding:'16px',background:'#f9f9f6',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <label style={{fontSize:13,fontWeight:700,color:'#085041'}}>
                📚 {lang==='ar'?'برنامج المستوى':'Programme du niveau'}
                <span style={{fontSize:11,fontWeight:400,color:'#888',marginRight:6}}>
                  {lang==='ar'?'(اختياري — يمكن تحديده لاحقاً)':'(optionnel — peut être défini plus tard)'}
                </span>
              </label>
              <span style={{fontSize:12,fontWeight:700,color:formProgramme.length>0?form.couleur:'#aaa'}}>
                {formProgramme.length>0?`${formProgramme.length} ${lang==='ar'?'محدد':'sélectionné(s)'}`:lang==='ar'?'لم يُحدد':'Non défini'}
              </span>
            </div>

            {form.type==='hizb'&&(
              <>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10,alignItems:'center'}}>
                  <span style={{fontSize:11,color:'#888'}}>{lang==='ar'?'اختيار سريع:':'Sélection rapide :'}</span>
                  {[1,5,10,15,20,30,60].map(n=>(
                    <button key={n} onClick={()=>setFormProgramme(Array.from({length:n},(_,i)=>i+1))}
                      style={{padding:'3px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',
                        background:JSON.stringify(formProgramme)===JSON.stringify(Array.from({length:n},(_,i)=>i+1))?form.couleur:'#f5f5f0',
                        color:JSON.stringify(formProgramme)===JSON.stringify(Array.from({length:n},(_,i)=>i+1))?'#fff':'#666',
                        fontSize:11,cursor:'pointer',fontWeight:500}}>
                      1→{n}
                    </button>
                  ))}
                  {formProgramme.length>0&&(
                    <button onClick={()=>setFormProgramme([])}
                      style={{padding:'3px 10px',borderRadius:20,border:'0.5px solid #e0e0d8',
                        background:'#FCEBEB',fontSize:11,cursor:'pointer',color:'#E24B4A'}}>
                      ✕ {lang==='ar'?'مسح':'Effacer'}
                    </button>
                  )}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:4}}>
                  {(() => {
                    const nivEdit = editing ? niveaux.find(n=>n.id===editing) : null;
                    const sensForm = nivEdit?.sens_recitation || ecoleConfig?.sens_recitation_defaut || 'desc';
                    return makeHizbList(sensForm).map(h=>{
                    const sel=formProgramme.includes(h);
                    return(
                      <div key={h} onClick={()=>toggleFormProgramme(h)}
                        style={{height:34,borderRadius:7,display:'flex',alignItems:'center',
                          justifyContent:'center',fontSize:11,fontWeight:sel?700:400,cursor:'pointer',
                          background:sel?form.couleur:'#fff',color:sel?'#fff':'#666',
                          border:`1.5px solid ${sel?form.couleur:'#e0e0d8'}`,transition:'all 0.1s'}}>
                        {h}
                      </div>
                    );
                  });
                  })()}
                </div>
              </>
            )}

            {form.type==='sourate'&&(
              <>
                <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
                  <button onClick={()=>setFormProgramme(getSouratesDesc().map(s=>{const dbS=(souratesDB||[]).find(x=>x.numero===s.numero);return dbS?dbS.id:null;}).filter(Boolean))}
                    style={{padding:'4px 12px',borderRadius:20,border:`0.5px solid ${form.couleur}`,
                      background:`${form.couleur}20`,color:form.couleur,fontSize:11,cursor:'pointer',fontWeight:600}}>
                    {lang==='ar'?'تحديد الكل':'Tout sélectionner'}
                  </button>
                  {formProgramme.length>0&&(
                    <button onClick={()=>setFormProgramme([])}
                      style={{padding:'4px 12px',borderRadius:20,border:'0.5px solid #e0e0d8',
                        background:'#FCEBEB',fontSize:11,cursor:'pointer',color:'#E24B4A'}}>
                      ✕ {lang==='ar'?'مسح':'Effacer'}
                    </button>
                  )}
                </div>
                <div style={{maxHeight:200,overflowY:'auto',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
                  {getSouratesDesc().map(s=>{
                    const dbS=(souratesDB||[]).find(x=>x.numero===s.numero);
                    if(!dbS) return null;
                    const sel=formProgramme.includes(dbS.id);
                    return(
                      <div key={dbS.id} onClick={()=>toggleFormProgramme(dbS.id)}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',
                          borderRadius:8,cursor:'pointer',
                          background:sel?`${form.couleur}10`:'#fff',
                          border:`1.5px solid ${sel?form.couleur:'#e0e0d8'}`}}>
                        <div style={{width:16,height:16,borderRadius:3,flexShrink:0,
                          border:`1.5px solid ${sel?form.couleur:'#ccc'}`,
                          background:sel?form.couleur:'#fff',
                          display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {sel&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:10,color:'#aaa',minWidth:18}}>{s.numero}</span>
                        <span style={{flex:1,fontSize:12,fontFamily:"'Tajawal',Arial",direction:'rtl',
                          color:sel?form.couleur:'#333',fontWeight:sel?600:400,overflow:'hidden',
                          whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{s.nom_ar}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div style={{display:'flex',gap:8}}>
            <button onClick={resetForm}
              style={{padding:'10px 20px',background:'#f5f5f0',color:'#666',border:'none',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:600}}>
              Annuler
            </button>
            <button onClick={save} disabled={saving}
              style={{padding:'10px 24px',background:saving?'#ccc':editing?'#378ADD':'#1D9E75',
                color:'#fff',border:'none',borderRadius:10,cursor:saving?'not-allowed':'pointer',fontSize:13,fontWeight:700}}>
              {saving?'...':(editing?'Mettre à jour ✓':'Enregistrer')}
            </button>
          </div>
        </div>
      )}

      {/* Table PC */}
      {loading ? <div className="loading">...</div> : niveaux.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'#aaa',background:'#fff',borderRadius:12,border:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:48,marginBottom:12}}>📚</div>
          <div style={{fontSize:15,marginBottom:8}}>Aucun niveau configuré</div>
          <div style={{fontSize:13}}>Ajoutez votre premier niveau pour commencer</div>
        </div>
      ) : (
        <div style={{background:'#fff',borderRadius:14,border:'0.5px solid #e0e0d8',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f5f5f0',borderBottom:'0.5px solid #e0e0d8'}}>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Ordre</th>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Code</th>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Nom</th>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Type</th>
                <th style={{padding:'12px 16px',textAlign:'left',fontSize:12,fontWeight:600,color:'#888'}}>Statut</th>
                <th style={{padding:'12px 16px',textAlign:'right',fontSize:12,fontWeight:600,color:'#888'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {niveaux.map((n, idx) => (
                <tr key={n.id} style={{borderBottom:'0.5px solid #f0f0ec',opacity:n.actif?1:0.5}}>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',flexDirection:'column',gap:2}}>
                      <button onClick={()=>moveUp(n,idx)} disabled={idx===0}
                        style={{background:'none',border:'none',cursor:idx===0?'not-allowed':'pointer',opacity:idx===0?0.3:1,fontSize:11,padding:'1px 4px'}}>▲</button>
                      <span style={{textAlign:'center',fontSize:13,fontWeight:500,color:'#888'}}>{n.ordre}</span>
                      <button onClick={()=>moveDown(n,idx)} disabled={idx===niveaux.length-1}
                        style={{background:'none',border:'none',cursor:idx===niveaux.length-1?'not-allowed':'pointer',opacity:idx===niveaux.length-1?0.3:1,fontSize:11,padding:'1px 4px'}}>▼</button>
                    </div>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{padding:'4px 12px',borderRadius:20,background:`${n.couleur}20`,
                      color:n.couleur,fontWeight:700,fontSize:13,border:`1px solid ${n.couleur}40`}}>
                      {n.code}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',fontSize:14,fontWeight:500}}>{n.nom}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{fontSize:12,padding:'3px 10px',borderRadius:20,
                      background:n.type==='sourate'?'#EEEDFE':'#E6F1FB',
                      color:n.type==='sourate'?'#534AB7':'#0C447C',fontWeight:600}}>
                      {n.type==='sourate'?'📖 Sourates':'📿 Hizb'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{fontSize:12,padding:'3px 10px',borderRadius:20,
                      background:n.actif?'#E1F5EE':'#f0f0ec',
                      color:n.actif?'#085041':'#888',fontWeight:600}}>
                      {n.actif?'✓ Actif':'Inactif'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px',textAlign:'right'}}>
                    <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                      <button onClick={()=>ouvrirProgramme(n)}
                        style={{padding:'6px 12px',background:`${n.couleur}20`,color:n.couleur,
                          border:`1px solid ${n.couleur}40`,borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                        📚 {lang==='ar'?'البرنامج':'Programme'}
                      </button>
                      <button onClick={()=>startEdit(n)}
                        style={{padding:'6px 12px',background:'#E6F1FB',color:'#0C447C',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>✏️</button>
                      <button onClick={()=>supprimer(n)}
                        style={{padding:'6px 10px',background:'#FCEBEB',color:'#E24B4A',border:'none',borderRadius:8,fontSize:12,cursor:'pointer'}}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PanneauProgramme/>
      {/* Confirm Modal PC */}
      {confirmModal.isOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:400,width:'100%'}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{confirmModal.title}</div>
            <div style={{fontSize:13,color:'#666',marginBottom:20}}>{confirmModal.message}</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmModal({isOpen:false})}
                style={{padding:'10px 20px',background:'#f5f5f0',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>Annuler</button>
              <button onClick={confirmModal.onConfirm}
                style={{padding:'10px 20px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'}}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
