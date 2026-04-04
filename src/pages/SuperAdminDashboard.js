import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const S = { green:'#1D9E75', purple:'#534AB7', amber:'#EF9F27', red:'#E24B4A', gray:'#888', border:'#e0e0d8' };

export default function SuperAdminDashboard({ user, navigate, lang, onLogout, isMobile }) {
  const [ecoles, setEcoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('ecoles'); // 'ecoles' | 'attente' | 'creer'
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ nom:'', ville:'', pays:'Maroc', telephone:'', email:'', identifiant:'', mot_de_passe:'', prenom_surveillant:'', nom_surveillant:'' });
  const [saving, setSaving] = useState(false);
  const [editingEcole, setEditingEcole] = useState(null); // ecole being edited
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [resetPwd, setResetPwd] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: ecolesData }, { data: survsData }, { data: elevesData }, { data: instsData }] = await Promise.all([
      supabase.from('ecoles').select('*').order('created_at', { ascending: false }),
      supabase.from('utilisateurs').select('id,prenom,nom,identifiant,statut_compte,ecole_id').eq('role','surveillant'),
      supabase.from('eleves').select('ecole_id'),
      supabase.from('utilisateurs').select('ecole_id').eq('role','instituteur'),
    ]);
    // Map surveillants and eleve counts per ecole
    const survByEcole = {};
    (survsData||[]).forEach(s => { survByEcole[s.ecole_id] = s; });
    const counts = {};
    (elevesData||[]).forEach(e => { counts[e.ecole_id] = (counts[e.ecole_id]||0)+1; });
    const instCounts = {};
    (instsData||[]).forEach(i => { instCounts[i.ecole_id] = (instCounts[i.ecole_id]||0)+1; });
    setEcoles((ecolesData||[]).map(e => ({
      ...e,
      surveillant: survByEcole[e.id] || null,
      nb_eleves: counts[e.id]||0,
      nb_instituteurs: instCounts[e.id]||0,
    })));
    setLoading(false);
  };

  const runBackup = async () => {
    setBackupLoading(true);
    setBackupResult(null);
    try {
      const TABLES = [
        'ecoles','utilisateurs','eleves','validations',
        'recitations_sourates','apprentissages','objectifs_globaux',
        'cotisations','depenses','parents','parent_eleve',
        'passages_niveau','exceptions_recitation','exceptions_hizb','sourates',
      ];

      // Fetch all tables directly from Supabase (client-side)
      const results = await Promise.all(TABLES.map(async (table) => {
        try {
          const { data, error } = await supabase.from(table).select('*').limit(50000);
          if (error) return { table, count: 0, error: error.message, data: [] };
          return { table, count: data?.length || 0, data: data || [] };
        } catch(e) {
          return { table, count: 0, error: e.message, data: [] };
        }
      }));

      const now = new Date();
      const dateFilename = now.toISOString().split('T')[0];
      const totalRecords = results.reduce((s, r) => s + r.count, 0);

      const backup = {
        metadata: {
          version: '1.0',
          created_at: now.toISOString(),
          tables: results.map(r => ({ table: r.table, count: r.count, error: r.error || null })),
          total_records: totalRecords,
        },
        data: Object.fromEntries(results.map(r => [r.table, r.data])),
      };

      // Download JSON file
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${dateFilename}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const errors = results.filter(r => r.error);
      setBackupResult({
        ok: totalRecords > 0,
        msg: `✅ Backup téléchargé — ${totalRecords.toLocaleString()} enregistrements · fichier: backup-${dateFilename}.json${errors.length > 0 ? ` (⚠️ ${errors.length} table(s) en erreur)` : ''}`,
      });
    } catch(e) {
      setBackupResult({ ok: false, msg: '❌ Erreur: ' + e.message });
    }
    setBackupLoading(false);
  };

  const showMsg = (m) => { setMsg(m); setTimeout(()=>setMsg(''), 3000); };

  const validerEcole = async (ecole) => {
    const { error } = await supabase
      .from('ecoles')
      .update({ statut: 'active', valide_par: user.id, date_validation: new Date().toISOString() })
      .eq('id', ecole.id);
    if (error) { showMsg('Erreur: ' + error.message); return; }
    // Activer le compte du surveillant
    const surv = ecole.surveillant || null;
    if (surv) {
      await supabase.from('utilisateurs').update({ statut_compte: 'actif' }).eq('id', surv.id);
    }
    showMsg('✅ École validée et compte activé !');
    loadData();
  };

  const suspendreEcole = async (ecole) => {
    await supabase.from('ecoles').update({ statut: 'suspendue' }).eq('id', ecole.id);
    const surv = ecole.surveillant || null;
    if (surv) await supabase.from('utilisateurs').update({ statut_compte: 'suspendu' }).eq('id', surv.id);
    showMsg('École suspendue.');
    loadData();
  };

  const reactiverEcole = async (ecole) => {
    await supabase.from('ecoles').update({ statut: 'active' }).eq('id', ecole.id);
    const surv = ecole.surveillant || null;
    if (surv) await supabase.from('utilisateurs').update({ statut_compte: 'actif' }).eq('id', surv.id);
    showMsg('✅ École réactivée.');
    loadData();
  };

  const saveEditEcole = async () => {
    setEditSaving(true);
    const { error } = await supabase.from('ecoles')
      .update({ nom: editForm.nom, ville: editForm.ville, pays: editForm.pays, telephone: editForm.telephone||null, email: editForm.email||null })
      .eq('id', editingEcole.id);
    if (error) { showMsg('Erreur: '+error.message); setEditSaving(false); return; }
    // Reset password if provided
    if (resetPwd.trim() && editingEcole.surveillant) {
      await supabase.from('utilisateurs')
        .update({ mot_de_passe: resetPwd.trim() })
        .eq('id', editingEcole.surveillant.id);
    }
    showMsg('✅ École modifiée !');
    setEditingEcole(null);
    setResetPwd('');
    loadData();
    setEditSaving(false);
  };

  const creerEcole = async (e) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.identifiant.trim() || !form.mot_de_passe || !form.prenom_surveillant.trim()) {
      showMsg('Veuillez remplir tous les champs obligatoires.'); return;
    }
    setSaving(true);
    try {
      const code = 'ECO-' + Math.random().toString(36).substring(2,8).toUpperCase();
      const { data: ecole, error: errE } = await supabase
        .from('ecoles')
        .insert({ nom:form.nom.trim(), ville:form.ville.trim(), pays:form.pays, telephone:form.telephone||null, email:form.email||null, code_acces:code, statut:'active', valide_par:user.id, date_validation:new Date().toISOString() })
        .select().single();
      if (errE) throw errE;
      const { error: errU } = await supabase
        .from('utilisateurs')
        .insert({ prenom:form.prenom_surveillant.trim(), nom:form.nom_surveillant.trim()||'', identifiant:form.identifiant.trim(), mot_de_passe:form.mot_de_passe, role:'surveillant', ecole_id:ecole.id, statut_compte:'actif' });
      if (errU) throw errU;
      showMsg('✅ École créée et activée !');
      setForm({ nom:'', ville:'', pays:'Maroc', telephone:'', email:'', identifiant:'', mot_de_passe:'', prenom_surveillant:'', nom_surveillant:'' });
      setVue('ecoles');
      loadData();
    } catch(err) { showMsg('Erreur: '+err.message); }
    setSaving(false);
  };

  const enAttente = ecoles.filter(e => e.statut === 'en_attente');
  const actives   = ecoles.filter(e => e.statut === 'active');
  const suspendues= ecoles.filter(e => e.statut === 'suspendue');

  const inp = {width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  const lbl = {fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:4};

  const StatCard = ({icon, val, label, color='#1a1a1a'}) => (
    <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:800,color,marginTop:4}}>{val}</div>
      <div style={{fontSize:11,color:'#888',marginTop:2}}>{label}</div>
    </div>
  );

  const EcoleCard = ({ecole}) => {
    const surv = ecole.surveillant || null;
    const statusColor = ecole.statut==='active' ? S.green : ecole.statut==='en_attente' ? S.amber : S.red;
    const statusLabel = ecole.statut==='active' ? '✅ Active' : ecole.statut==='en_attente' ? '⏳ En attente' : '🚫 Suspendue';
    return (
      <div style={{background:'#fff',border:`0.5px solid ${statusColor}30`,borderRadius:12,padding:'14px 16px',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <div style={{fontSize:15,fontWeight:700}}>{ecole.nom}</div>
            <div style={{fontSize:12,color:'#888'}}>{ecole.ville}{ecole.pays && ecole.pays!=='Maroc' ? ` · ${ecole.pays}` : ''}</div>
          </div>
          <span style={{padding:'2px 10px',borderRadius:10,fontSize:11,fontWeight:600,background:statusColor+'18',color:statusColor}}>
            {statusLabel}
          </span>
        </div>
        <div style={{display:'flex',gap:16,fontSize:12,color:'#888',marginBottom:10,flexWrap:'wrap'}}>
          {surv && <span>👤 {surv.prenom} {surv.nom} <em>({surv.identifiant})</em></span>}
          <span>🎓 {ecole.nb_eleves} élève(s)</span>
          <span>👨‍🏫 {ecole.nb_instituteurs} instituteur(s)</span>
          {ecole.email && <span>✉️ {ecole.email}</span>}
          {ecole.telephone && <span>📞 {ecole.telephone}</span>}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={()=>{setEditingEcole(ecole);setEditForm({nom:ecole.nom,ville:ecole.ville||'',pays:ecole.pays||'Maroc',telephone:ecole.telephone||'',email:ecole.email||''});setResetPwd('');setVue('ecoles');}}
            style={{padding:'7px 12px',background:'#F0EEFF',color:S.purple,border:`0.5px solid ${S.purple}30`,borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            ✏️ Modifier
          </button>
          {ecole.statut === 'en_attente' && (
            <button onClick={()=>validerEcole(ecole)}
              style={{flex:1,padding:'7px',background:S.green,color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
              ✅ Valider & Activer
            </button>
          )}
          {ecole.statut === 'active' && (
            <button onClick={()=>suspendreEcole(ecole)}
              style={{padding:'7px 14px',background:'#FCEBEB',color:S.red,border:`0.5px solid ${S.red}30`,borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
              🚫 Suspendre
            </button>
          )}
          {ecole.statut === 'suspendue' && (
            <button onClick={()=>reactiverEcole(ecole)}
              style={{padding:'7px 14px',background:'#E1F5EE',color:S.green,border:`0.5px solid ${S.green}30`,borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
              ✅ Réactiver
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{maxWidth:800,margin:'0 auto',padding: isMobile ? '0 0 80px' : '1rem',background: isMobile ? '#f5f5f0' : 'transparent',minHeight: isMobile ? '100vh' : 'auto'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:'#534AB7'}}>
            🛡️ Super Admin
          </div>
          <div style={{fontSize:12,color:'#888'}}>Bonjour {user.prenom} — tableau de bord global</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={runBackup} disabled={backupLoading}
            style={{padding:'7px 14px',background:backupLoading?'#e0e0d8':'#085041',color:'#fff',border:'none',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:600}}>
            {backupLoading ? '⏳ Export en cours...' : '💾 Télécharger backup'}
          </button>
          <button onClick={onLogout}
            style={{padding:'7px 14px',background:'#f5f5f0',color:'#666',border:'0.5px solid #e0e0d8',borderRadius:8,fontSize:12,cursor:'pointer'}}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Backup result */}
      {backupResult && (
        <div style={{background:backupResult.ok?'#E1F5EE':'#FCEBEB',border:`0.5px solid ${backupResult.ok?'#1D9E7530':'#E24B4A30'}`,borderRadius:8,padding:'10px 14px',marginBottom:'1rem',fontSize:13,color:backupResult.ok?'#085041':'#E24B4A',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>{backupResult.msg}</span>
          <button onClick={()=>setBackupResult(null)} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:16,padding:0}}>✕</button>
        </div>
      )}
      {/* Message flash */}
      {msg && <div style={{background:'#E1F5EE',border:'0.5px solid #1D9E7530',borderRadius:8,padding:'10px 14px',marginBottom:'1rem',fontSize:13,color:'#085041'}}>{msg}</div>}

      {/* Stats */}
      {!loading && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10,marginBottom:'1.25rem'}}>
          <StatCard icon="🏫" val={ecoles.length} label="Écoles total"/>
          <StatCard icon="✅" val={actives.length} label="Actives" color={S.green}/>
          <StatCard icon="⏳" val={enAttente.length} label="En attente" color={S.amber}/>
          <StatCard icon="🚫" val={suspendues.length} label="Suspendues" color={S.red}/>
          <StatCard icon="🎓" val={ecoles.reduce((a,e)=>a+e.nb_eleves,0)} label="Élèves total" color={S.purple}/>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3,marginBottom:'1.25rem'}}>
        {[
          {k:'ecoles', label:`🏫 Toutes les écoles (${ecoles.length})`},
          {k:'attente', label:`⏳ En attente (${enAttente.length})`, alert:enAttente.length>0},
          {k:'creer', label:'➕ Créer une école'},
        ].map(tab => (
          <div key={tab.k} onClick={()=>setVue(tab.k)}
            style={{flex:1,padding:'8px 12px',borderRadius:8,textAlign:'center',fontSize:12,fontWeight:600,cursor:'pointer',
              background:vue===tab.k?'#fff':'transparent',
              color:tab.alert&&vue!==tab.k?S.amber:vue===tab.k?'#1a1a1a':'#888',
              boxShadow:vue===tab.k?'0 1px 4px rgba(0,0,0,0.08)':'none',
              transition:'all 0.15s'}}>
            {tab.label}
          </div>
        ))}
      </div>

      {loading && <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>Chargement...</div>}

      {/* Vue : Toutes les écoles */}
      {!loading && vue === 'ecoles' && (
        <div>
          {enAttente.length > 0 && (
            <div style={{background:'#FFF3CD',border:'0.5px solid #EF9F2730',borderRadius:10,padding:'10px 14px',marginBottom:'1rem',fontSize:13,color:'#856404',cursor:'pointer'}} onClick={()=>setVue('attente')}>
              ⚠️ {enAttente.length} école(s) en attente de validation → Cliquez pour valider
            </div>
          )}
          {actives.length > 0 && <div style={{fontSize:12,fontWeight:600,color:'#888',marginBottom:8}}>ACTIVES ({actives.length})</div>}
          {actives.map(e => <EcoleCard key={e.id} ecole={e}/>)}
          {suspendues.length > 0 && <div style={{fontSize:12,fontWeight:600,color:'#888',margin:'16px 0 8px'}}>SUSPENDUES ({suspendues.length})</div>}
          {suspendues.map(e => <EcoleCard key={e.id} ecole={e}/>)}
          {ecoles.length === 0 && (
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fafaf8',borderRadius:12}}>
              Aucune école enregistrée.<br/>
              <button onClick={()=>setVue('creer')} style={{marginTop:12,padding:'8px 20px',background:S.purple,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>
                ➕ Créer la première école
              </button>
            </div>
          )}
        </div>
      )}

      {/* Vue : En attente */}
      {!loading && vue === 'attente' && (
        <div>
          {enAttente.length === 0 ? (
            <div style={{textAlign:'center',color:'#aaa',padding:'3rem',background:'#fafaf8',borderRadius:12}}>
              ✅ Aucune demande en attente
            </div>
          ) : enAttente.map(e => <EcoleCard key={e.id} ecole={e}/>)}
        </div>
      )}

      {/* Vue : Créer une école */}
      {vue === 'creer' && (
        <form onSubmit={creerEcole}>
          <div style={{background:'#F0EEFF',borderRadius:10,padding:'12px 14px',marginBottom:'1rem',fontSize:12,color:'#534AB7'}}>
            ℹ️ Le compte sera immédiatement actif (création par super admin).
          </div>
          <div style={{fontSize:13,fontWeight:600,color:'#534AB7',marginBottom:'1rem'}}>🏫 Informations de l'école</div>
          <div style={{display:'grid',gap:12,marginBottom:'1rem'}}>
            <div><label style={lbl}>Nom de l'école *</label><input style={inp} value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Ville *</label><input style={inp} value={form.ville} onChange={e=>setForm(f=>({...f,ville:e.target.value}))}/></div>
              <div><label style={lbl}>Pays</label><input style={inp} value={form.pays} onChange={e=>setForm(f=>({...f,pays:e.target.value}))}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Téléphone</label><input style={inp} value={form.telephone} onChange={e=>setForm(f=>({...f,telephone:e.target.value}))}/></div>
              <div><label style={lbl}>Email</label><input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:'#534AB7',marginBottom:'1rem'}}>👤 Compte surveillant</div>
          <div style={{display:'grid',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Prénom *</label><input style={inp} value={form.prenom_surveillant} onChange={e=>setForm(f=>({...f,prenom_surveillant:e.target.value}))}/></div>
              <div><label style={lbl}>Nom</label><input style={inp} value={form.nom_surveillant} onChange={e=>setForm(f=>({...f,nom_surveillant:e.target.value}))}/></div>
            </div>
            <div><label style={lbl}>Identifiant *</label><input style={inp} value={form.identifiant} onChange={e=>setForm(f=>({...f,identifiant:e.target.value}))} autoComplete="off"/></div>
            <div><label style={lbl}>Mot de passe *</label><input style={inp} type="password" value={form.mot_de_passe} onChange={e=>setForm(f=>({...f,mot_de_passe:e.target.value}))} autoComplete="new-password"/></div>
          </div>
          <button type="submit" disabled={saving}
            style={{width:'100%',marginTop:'1.25rem',padding:'11px',background:saving?'#ccc':S.green,color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontSize:13}}>
            {saving ? '...' : '✅ Créer l\'école'}
          </button>
        </form>
      )}
      {/* Edit Modal */}
      {editingEcole&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}
          onClick={()=>setEditingEcole(null)}>
          <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:S.purple,marginBottom:'1rem'}}>✏️ Modifier — {editingEcole.nom}</div>
            <div style={{display:'grid',gap:10,marginBottom:'1rem'}}>
              <div><label style={{fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:3}}>Nom *</label>
                <input style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}}
                  value={editForm.nom} onChange={e=>setEditForm(f=>({...f,nom:e.target.value}))}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div><label style={{fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:3}}>Ville</label>
                  <input style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={editForm.ville} onChange={e=>setEditForm(f=>({...f,ville:e.target.value}))}/></div>
                <div><label style={{fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:3}}>Pays</label>
                  <input style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={editForm.pays} onChange={e=>setEditForm(f=>({...f,pays:e.target.value}))}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div><label style={{fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:3}}>Téléphone</label>
                  <input style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={editForm.telephone} onChange={e=>setEditForm(f=>({...f,telephone:e.target.value}))}/></div>
                <div><label style={{fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:3}}>Email</label>
                  <input style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box',type:'email'}}
                    value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}/></div>
              </div>
              {editingEcole.surveillant&&(
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:3}}>
                    🔑 Réinitialiser mot de passe de {editingEcole.surveillant.prenom} (laisser vide = inchangé)
                  </label>
                  <input type="password" style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}}
                    value={resetPwd} onChange={e=>setResetPwd(e.target.value)} placeholder="Nouveau mot de passe..." autoComplete="new-password"/>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setEditingEcole(null)} style={{padding:'9px 16px',background:'#f5f5f0',color:'#666',border:'0.5px solid #e0e0d8',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13}}>
                Annuler
              </button>
              <button onClick={saveEditEcole} disabled={editSaving||!editForm.nom.trim()}
                style={{flex:1,padding:'9px',background:editSaving||!editForm.nom.trim()?'#ccc':S.green,color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontSize:13}}>
                {editSaving?'...':'✅ Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
