import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

const S = { green:'#1D9E75', purple:'#534AB7', amber:'#EF9F27', red:'#E24B4A', gray:'#888', border:'#e0e0d8' };

export default function SuperAdminDashboard({ user, navigate, lang, onLogout, isMobile, startImpersonation }) {
  const [ecoles, setEcoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState('ecoles'); // 'ecoles' | 'attente' | 'creer' | 'audit'
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ nom:'', ville:'', pays:'Maroc', telephone:'', email:'', identifiant:'', mot_de_passe:'', prenom_surveillant:'', nom_surveillant:'' });
  const [saving, setSaving] = useState(false);
  const [editingEcole, setEditingEcole] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [resetPwd, setResetPwd] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState(null);

  // NEW : santé système + KPIs + alertes
  const [sante, setSante] = useState({ supabase: 'loading', backup: 'loading' });
  const [kpisGlobaux, setKpisGlobaux] = useState({ total_eleves: 0, total_instituteurs: 0, total_parents: 0, total_validations_7j: 0, total_ecoles_actives: 0 });
  const [auditLogs, setAuditLogs] = useState([]);
  const [alertesActives, setAlertesActives] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null); // pour confirmation forte

  // RGPD audit (P1.2) : logs des exports RGPD de toutes les écoles
  const [rgpdLogs, setRgpdLogs] = useState([]);
  const [rgpdStats, setRgpdStats] = useState({ total: 0, mois: 0, anomalies: 0 });
  const [rgpdFilterEcole, setRgpdFilterEcole] = useState('tous');
  const [rgpdFilterPeriode, setRgpdFilterPeriode] = useState(30);
  const [rgpdLoading, setRgpdLoading] = useState(false);
  const [purgeLogs, setPurgeLogs] = useState([]);

  // Corbeille (P1.2) : éléments soft-deleted (élèves + utilisateurs)
  const [corbeilleEleves, setCorbeilleEleves] = useState([]);
  const [corbeilleUsers, setCorbeilleUsers] = useState([]);
  const [corbeilleLoading, setCorbeilleLoading] = useState(false);
  const [corbeilleFilterEcole, setCorbeilleFilterEcole] = useState('tous');
  const [restoring, setRestoring] = useState(null);

  useEffect(() => { loadData(); }, []);

  // ─── Lazy load des logs RGPD quand on ouvre l'onglet ─────────────
  useEffect(() => {
    if (vue === 'rgpd') {
      loadRgpdLogs();
    }
    // eslint-disable-next-line
  }, [vue, rgpdFilterEcole, rgpdFilterPeriode]);

  // ─── Lazy load de la corbeille quand on ouvre l'onglet ────────────
  useEffect(() => {
    if (vue === 'corbeille') {
      loadCorbeille();
    }
    // eslint-disable-next-line
  }, [vue, corbeilleFilterEcole]);

  const loadCorbeille = async () => {
    setCorbeilleLoading(true);
    try {
      // Import dynamique de supabaseRaw : bypass du filtre auto deleted_at IS NULL
      // (sinon le wrapper exclut justement ce qu'on veut afficher !)
      const { supabaseRaw } = await import('../lib/supabase');
      let q1 = supabaseRaw.from('eleves').select('id,prenom,nom,ecole_id,deleted_at,deleted_by');
      if (corbeilleFilterEcole !== 'tous') q1 = q1.eq('ecole_id', corbeilleFilterEcole);
      const { data: el, error: e1 } = await q1.not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(500);
      if (e1) console.warn('[corbeille eleves]', e1);
      setCorbeilleEleves(el || []);

      let q2 = supabaseRaw.from('utilisateurs').select('id,prenom,nom,role,ecole_id,deleted_at,deleted_by,identifiant');
      if (corbeilleFilterEcole !== 'tous') q2 = q2.eq('ecole_id', corbeilleFilterEcole);
      const { data: us, error: e2 } = await q2.not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(500);
      if (e2) console.warn('[corbeille users]', e2);
      setCorbeilleUsers(us || []);
    } catch (err) {
      console.error('[loadCorbeille]', err);
    }
    setCorbeilleLoading(false);
  };

  const handleRestore = async (table, id, label) => {
    if (!window.confirm(`Restaurer "${label}" ? Il redeviendra visible et utilisable.`)) return;
    setRestoring(id);
    try {
      // L'update direct fonctionne via le wrapper (le filtre auto ne touche que les select).
      const { error } = await supabase.from(table).update({ deleted_at: null, deleted_by: null }).eq('id', id);
      if (error) {
        alert('Erreur: ' + error.message);
      } else {
        try { await logAudit({ user_id: user.id, action: 'restore_'+table, details: { id, label } }); } catch {}
        await loadCorbeille();
      }
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
    setRestoring(null);
  };

  const loadRgpdLogs = async () => {
    setRgpdLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - rgpdFilterPeriode);

      let query = supabase
        .from('exports_rgpd')
        .select('*')
        .gte('exported_at', since.toISOString())
        .order('exported_at', { ascending: false })
        .limit(500);

      if (rgpdFilterEcole !== 'tous') {
        query = query.eq('ecole_id', rgpdFilterEcole);
      }

      const [logsRes, purgesRes, usersRes] = await Promise.all([
        query,
        supabase.from('purges_rgpd_log').select('*').order('purged_at', { ascending: false }).limit(10),
        supabase.from('utilisateurs').select('id,prenom,nom,role'),
      ]);

      // Enrichir les logs avec nom utilisateur + nom école
      const usersMap = {};
      (usersRes.data || []).forEach(u => { usersMap[u.id] = u; });
      const ecolesMap = {};
      ecoles.forEach(e => { ecolesMap[e.id] = e; });

      const enriched = (logsRes.data || []).map(log => ({
        ...log,
        _user_nom: usersMap[log.user_id]
          ? `${usersMap[log.user_id].prenom || ''} ${usersMap[log.user_id].nom || ''}`.trim()
          : '—',
        _ecole_nom: ecolesMap[log.ecole_id]?.nom || '—',
      }));

      setRgpdLogs(enriched);
      setPurgeLogs(purgesRes.data || []);

      // Stats
      const moisDebut = new Date();
      moisDebut.setDate(1); moisDebut.setHours(0, 0, 0, 0);
      const thisMonth = enriched.filter(l => new Date(l.exported_at) >= moisDebut).length;

      // Anomalies : user avec > 10 exports dans la fenêtre filtrée
      const countByUser = {};
      enriched.forEach(l => {
        countByUser[l.user_id] = (countByUser[l.user_id] || 0) + 1;
      });
      const anomalies = Object.values(countByUser).filter(c => c > 10).length;

      setRgpdStats({ total: enriched.length, mois: thisMonth, anomalies });
    } catch (err) {
      console.error('[RGPD audit] load error:', err);
    }
    setRgpdLoading(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1) Charger KPIs consolidés via RPC (optimisé, 1 seule requête)
      const [statsRes, ecolesRes, survsRes, santeRes, backupRes, alertesRes] = await Promise.all([
        supabase.rpc('get_stats_ecoles_super_admin'),
        supabase.from('ecoles').select('*').order('created_at', { ascending: false }),
        supabase.from('utilisateurs').select('id,prenom,nom,identifiant,statut_compte,ecole_id').eq('role','surveillant'),
        supabase.from('sante_systeme').select('*').eq('check_type', 'ping_supabase').order('created_at', { ascending: false }).limit(1),
        supabase.from('sante_systeme').select('*').eq('check_type', 'backup').order('created_at', { ascending: false }).limit(1),
        supabase.from('alertes').select('*').is('resolved_at', null).order('created_at', { ascending: false }).limit(20),
      ]);

      const statsMap = {};
      (statsRes?.data || []).forEach(s => { statsMap[s.ecole_id] = s; });

      const survByEcole = {};
      (survsRes?.data || []).forEach(s => { survByEcole[s.ecole_id] = s; });

      // Enrichir chaque école avec ses stats
      const ecolesEnrichies = (ecolesRes?.data || []).map(e => {
        const s = statsMap[e.id] || {};
        return {
          ...e,
          surveillant: survByEcole[e.id] || null,
          nb_eleves: Number(s.nb_eleves || 0),
          nb_instituteurs: Number(s.nb_instituteurs || 0),
          nb_parents: Number(s.nb_parents || 0),
          nb_validations_total: Number(s.nb_validations_total || 0),
          nb_validations_7j: Number(s.nb_validations_7j || 0),
          nb_validations_30j: Number(s.nb_validations_30j || 0),
          derniere_validation: s.derniere_validation,
          derniere_connexion: s.derniere_connexion,
          nb_certificats: Number(s.nb_certificats || 0),
        };
      });
      setEcoles(ecolesEnrichies);

      // 2) KPIs globaux (somme de toutes les écoles actives)
      const actives = ecolesEnrichies.filter(e => (e.statut || 'active') === 'active');
      setKpisGlobaux({
        total_ecoles_actives: actives.length,
        total_eleves: actives.reduce((sum, e) => sum + e.nb_eleves, 0),
        total_instituteurs: actives.reduce((sum, e) => sum + e.nb_instituteurs, 0),
        total_parents: actives.reduce((sum, e) => sum + e.nb_parents, 0),
        total_validations_7j: actives.reduce((sum, e) => sum + e.nb_validations_7j, 0),
      });

      // 3) Santé Supabase (dernier ping)
      const lastPing = santeRes?.data?.[0];
      let supabaseStatus = 'unknown';
      if (lastPing) {
        const ageHours = (Date.now() - new Date(lastPing.created_at).getTime()) / (1000 * 60 * 60);
        if (lastPing.status === 'ok' && ageHours < 72) supabaseStatus = 'ok';
        else if (ageHours < 168) supabaseStatus = 'warning';
        else supabaseStatus = 'error';
      } else {
        supabaseStatus = 'unknown';
      }

      // 4) Santé Backup (dernier backup)
      const lastBackup = backupRes?.data?.[0];
      let backupStatus = 'unknown';
      let backupDetail = 'Aucun backup enregistré';
      if (lastBackup) {
        const ageHours = (Date.now() - new Date(lastBackup.created_at).getTime()) / (1000 * 60 * 60);
        if (lastBackup.status === 'ok' && ageHours < 28) {
          backupStatus = 'ok';
          backupDetail = `Dernier : ${formatAgeShort(lastBackup.created_at)}`;
        } else if (ageHours < 48) {
          backupStatus = 'warning';
          backupDetail = `${formatAgeShort(lastBackup.created_at)} (bientôt manqué)`;
        } else {
          backupStatus = 'error';
          backupDetail = `Manqué depuis ${Math.round(ageHours)}h`;
        }
      }

      setSante({
        supabase: supabaseStatus,
        supabaseLastPing: lastPing,
        backup: backupStatus,
        backupDetail: backupDetail,
        backupLast: lastBackup,
      });

      // 5) Alertes actives
      setAlertesActives(alertesRes?.data || []);

      setLoading(false);
    } catch (e) {
      console.error('[SuperAdminDashboard.js] Erreur chargement:', e);
      setLoading(false);
    }
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

  // ─── Actions critiques avec confirmation forte + audit ──────────

  // Demande de confirmation (ouvre la modal)
  const demanderConfirmation = (type, ecole) => {
    const configs = {
      suspendre: {
        title: '⚠️ Suspendre l\'école',
        description: `L'école "${ecole.nom}" sera marquée comme suspendue. Le surveillant ne pourra plus se connecter tant qu'elle n'est pas réactivée.`,
        warnings: [
          `${ecole.nb_eleves || 0} élève(s) concerné(s)`,
          `${ecole.nb_instituteurs || 0} instituteur(s) concerné(s)`,
          `Les données ne sont PAS supprimées`,
        ],
        confirmLabel: 'Suspendre',
        confirmColor: S.amber,
        expectedText: ecole.nom,
        onConfirm: () => executeSuspendreEcole(ecole),
      },
      reactiver: {
        title: '✅ Réactiver l\'école',
        description: `L'école "${ecole.nom}" redeviendra active. Le surveillant pourra à nouveau se connecter.`,
        warnings: [],
        confirmLabel: 'Réactiver',
        confirmColor: S.green,
        expectedText: null, // pas besoin de retaper le nom pour une action réversible
        onConfirm: () => executeReactiverEcole(ecole),
      },
    };
    setConfirmAction({ type, ecole, ...configs[type], typedText: '', checked1: false, checked2: false });
  };

  const executeSuspendreEcole = async (ecole) => {
    const { error: e1 } = await supabase.from('ecoles').update({ statut: 'suspendue' }).eq('id', ecole.id);
    if (e1) { showMsg('Erreur: ' + e1.message); return; }
    const surv = ecole.surveillant || null;
    if (surv) await supabase.from('utilisateurs').update({ statut_compte: 'suspendu' }).eq('id', surv.id);

    // Audit log
    await logAudit(supabase, {
      actor: user,
      action: 'suspendre_ecole',
      target_type: 'ecole',
      target_id: ecole.id,
      target_label: ecole.nom,
      metadata: {
        surveillant_id: surv?.id || null,
        nb_eleves: ecole.nb_eleves || 0,
        nb_instituteurs: ecole.nb_instituteurs || 0,
      },
    });

    showMsg('✅ École suspendue');
    setConfirmAction(null);
    loadData();
  };

  const executeReactiverEcole = async (ecole) => {
    const { error } = await supabase.from('ecoles').update({ statut: 'active' }).eq('id', ecole.id);
    if (error) { showMsg('Erreur: ' + error.message); return; }
    const surv = ecole.surveillant || null;
    if (surv) await supabase.from('utilisateurs').update({ statut_compte: 'actif' }).eq('id', surv.id);

    await logAudit(supabase, {
      actor: user,
      action: 'reactiver_ecole',
      target_type: 'ecole',
      target_id: ecole.id,
      target_label: ecole.nom,
    });

    showMsg('✅ École réactivée');
    setConfirmAction(null);
    loadData();
  };

  // Anciennes fonctions : on les redirige vers la nouvelle confirmation
  const suspendreEcole = (ecole) => demanderConfirmation('suspendre', ecole);
  const reactiverEcole = (ecole) => demanderConfirmation('reactiver', ecole);

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

  // ─── Impersonification : "Voir comme surveillant" ──────────
  // Bascule l'utilisateur vers le compte surveillant de l'école,
  // avec un flag _impersonating pour tracer l'action et afficher
  // le bandeau rouge. Tout est logué dans audit_log (traçabilité).
  const handleImpersonate = async (ecole) => {
    if (!startImpersonation) return;
    const surv = ecole.surveillant;
    if (!surv) {
      showMsg("Erreur : cette école n'a pas de surveillant associé");
      return;
    }
    // Log audit AVANT de basculer (tant qu'on est encore super admin)
    try {
      await logAudit({
        actor_user_id: user.id,
        actor_role: 'super_admin',
        action: 'impersonate_start',
        target_type: 'utilisateur',
        target_id: surv.id,
        target_label: `Voir comme ${surv.prenom} ${surv.nom} (${ecole.nom})`,
        metadata: {
          ecole_id: ecole.id,
          ecole_nom: ecole.nom,
          surveillant_identifiant: surv.identifiant,
        },
      });
    } catch (err) {
      console.warn('[impersonate] audit log failed', err);
    }
    // Charger les infos complètes du surveillant (mot_de_passe exclu)
    const { data: fullUser, error } = await supabase
      .from('utilisateurs')
      .select('id,prenom,nom,identifiant,role,statut_compte,ecole_id,email,telephone')
      .eq('id', surv.id)
      .single();
    if (error || !fullUser) {
      showMsg('Erreur : impossible de charger le surveillant');
      return;
    }
    startImpersonation(fullUser, ecole.nom);
  };

  const inp = {width:'100%',padding:'8px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  const lbl = {fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:4};

  const StatCard = ({icon, val, label, color='#1a1a1a'}) => (
    <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'14px 16px',textAlign:'center'}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:800,color,marginTop:4}}>{val}</div>
      <div style={{fontSize:11,color:'#888',marginTop:2}}>{label}</div>
    </div>
  );

  // ─── Helpers santé système ──────────────────────────────────────
  const formatAgeShort = (timestamp) => {
    if (!timestamp) return 'inconnu';
    const age = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(age / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days >= 1) return `il y a ${days}j`;
    if (hrs >= 1) return `il y a ${hrs}h`;
    if (mins >= 1) return `il y a ${mins}min`;
    return 'à l\'instant';
  };

  const SanteIndicator = ({ label, status, detail }) => {
    const config = {
      ok:      { bg:'#E1F5EE', border:'#1D9E7540', color:'#085041', icon:'🟢', text:'OK' },
      warning: { bg:'#FAEEDA', border:'#EF9F2740', color:'#633806', icon:'🟡', text:'Warning' },
      error:   { bg:'#FCEBEB', border:'#E24B4A40', color:'#A32D2D', icon:'🔴', text:'Erreur' },
      loading: { bg:'#f5f5f0', border:'#e0e0d8',  color:'#888',    icon:'⏳', text:'Chargement...' },
      unknown: { bg:'#f5f5f0', border:'#e0e0d8',  color:'#888',    icon:'⚪', text:'Inconnu' },
    };
    const c = config[status] || config.unknown;
    return (
      <div style={{background:c.bg,border:`0.5px solid ${c.border}`,borderRadius:10,padding:'10px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
          <span style={{fontSize:14}}>{c.icon}</span>
          <span style={{fontSize:12,fontWeight:700,color:c.color}}>{label}</span>
        </div>
        <div style={{fontSize:11,color:c.color,opacity:0.8,lineHeight:1.4}}>{detail}</div>
      </div>
    );
  };

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
            <>
              <button onClick={()=>handleImpersonate(ecole)}
                disabled={!ecole.surveillant}
                title={!ecole.surveillant ? 'Pas de surveillant associé' : 'Consulter cette école en tant que surveillant (lecture seule)'}
                style={{padding:'7px 12px',background:ecole.surveillant?'#FFF5D9':'#f5f5f0',color:ecole.surveillant?'#B7791F':'#bbb',border:`0.5px solid ${ecole.surveillant?'#EF9F27':'#e0e0d8'}30`,borderRadius:8,fontSize:12,fontWeight:600,cursor:ecole.surveillant?'pointer':'not-allowed'}}>
                👁️ Voir comme
              </button>
              <button onClick={()=>suspendreEcole(ecole)}
                style={{padding:'7px 14px',background:'#FCEBEB',color:S.red,border:`0.5px solid ${S.red}30`,borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                🚫 Suspendre
              </button>
            </>
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
      {isMobile && (
        <div style={{background:'linear-gradient(135deg,#085041,#1D9E75)',padding:'48px 16px 20px',marginBottom:0}}>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.8)',marginBottom:4}}>Super Admin</div>
          <div style={{fontSize:22,fontWeight:800,color:'#fff',marginBottom:12}}>Vue globale</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={runBackup} disabled={backupLoading}
              style={{padding:'10px 16px',background:'rgba(255,255,255,0.2)',color:'#fff',
                border:'1px solid rgba(255,255,255,0.3)',borderRadius:10,fontSize:13,fontWeight:700,
                cursor:'pointer',fontFamily:'inherit'}}>
              {backupLoading?'⏳...':'💾 Backup'}
            </button>
            <button onClick={onLogout}
              style={{padding:'10px 16px',background:'rgba(255,255,255,0.1)',color:'#fff',
                border:'1px solid rgba(255,255,255,0.2)',borderRadius:10,fontSize:13,cursor:'pointer'}}>
              🚪
            </button>
          </div>
        </div>
      )}

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

      {/* ─── Santé système ───────────────────────────────────── */}
      {!loading && (
        <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'1rem 1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5}}>
            🏥 Santé système
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
            <SanteIndicator
              label="Supabase"
              status={sante.supabase}
              detail={sante.supabaseLastPing
                ? `Dernier ping : ${formatAgeShort(sante.supabaseLastPing.created_at)}`
                : 'Aucun ping enregistré'}
            />
            <SanteIndicator
              label="Vercel"
              status="ok"
              detail="Application en ligne"
            />
            <SanteIndicator
              label="Backup"
              status={sante.backup}
              detail={sante.backupDetail || 'Aucun backup enregistré'}
            />
          </div>
        </div>
      )}

      {/* ─── Alertes actives ─────────────────────────────────── */}
      {!loading && alertesActives.length > 0 && (
        <div style={{marginBottom:'1.25rem'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5,display:'flex',alignItems:'center',gap:6}}>
            🚨 Alertes actives ({alertesActives.length})
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {alertesActives.slice(0, 5).map(a => {
              const bg = a.niveau === 'critique' ? '#FCEBEB' : a.niveau === 'warning' ? '#FAEEDA' : '#E1F5EE';
              const border = a.niveau === 'critique' ? '#E24B4A40' : a.niveau === 'warning' ? '#EF9F2740' : '#1D9E7540';
              const color = a.niveau === 'critique' ? '#A32D2D' : a.niveau === 'warning' ? '#633806' : '#085041';
              const emoji = a.niveau === 'critique' ? '🔴' : a.niveau === 'warning' ? '🟠' : '🔵';
              return (
                <div key={a.id} style={{background:bg,border:`0.5px solid ${border}`,borderRadius:10,padding:'10px 14px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontSize:14}}>{emoji}</span>
                    <span style={{fontSize:13,fontWeight:700,color}}>{a.titre}</span>
                    <span style={{fontSize:10,color:color,opacity:0.7,marginLeft:'auto'}}>
                      {formatAgeShort(a.created_at)}
                    </span>
                  </div>
                  <div style={{fontSize:11,color,opacity:0.85,whiteSpace:'pre-wrap',lineHeight:1.4}}>
                    {a.message.length > 200 ? a.message.substring(0, 200) + '...' : a.message}
                  </div>
                </div>
              );
            })}
            {alertesActives.length > 5 && (
              <div style={{fontSize:11,color:'#888',textAlign:'center',padding:6}}>
                ... et {alertesActives.length - 5} autre(s) alerte(s)
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── KPIs globaux ────────────────────────────────────── */}
      {!loading && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:'1.25rem'}}>
          <StatCard icon="🏫" val={ecoles.length} label="Écoles total"/>
          <StatCard icon="✅" val={actives.length} label="Actives" color={S.green}/>
          <StatCard icon="⏳" val={enAttente.length} label="En attente" color={S.amber}/>
          <StatCard icon="🚫" val={suspendues.length} label="Suspendues" color={S.red}/>
          <StatCard icon="🎓" val={kpisGlobaux.total_eleves} label="Élèves actifs" color={S.purple}/>
          <StatCard icon="⚡" val={kpisGlobaux.total_validations_7j} label="Validations 7j" color="#378ADD"/>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:0,background:'#f0f0ec',borderRadius:10,padding:3,marginBottom:'1.25rem',overflowX:'auto'}}>
        {[
          {k:'ecoles', label:`🏫 Toutes les écoles (${ecoles.length})`},
          {k:'attente', label:`⏳ En attente (${enAttente.length})`, alert:enAttente.length>0},
          {k:'creer', label:'➕ Créer une école'},
          {k:'rgpd', label:'🔐 Audit RGPD'},
          {k:'corbeille', label:'🗑️ Corbeille'},
        ].map(tab => (
          <div key={tab.k} onClick={()=>setVue(tab.k)}
            style={{flex:1,padding:'8px 12px',borderRadius:8,textAlign:'center',fontSize:12,fontWeight:600,cursor:'pointer',
              background:vue===tab.k?'#fff':'transparent',
              color:tab.alert&&vue!==tab.k?S.amber:vue===tab.k?'#1a1a1a':'#888',
              boxShadow:vue===tab.k?'0 1px 4px rgba(0,0,0,0.08)':'none',
              transition:'all 0.15s',whiteSpace:'nowrap'}}>
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

      {/* ─── Vue : Audit RGPD ─────────────────────────────────── */}
      {vue === 'rgpd' && (
        <div>
          {/* Info bandeau */}
          <div style={{background:'#F0EEFF',border:'0.5px solid #534AB730',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#4A3F9E',lineHeight:1.5}}>
            <strong>🔐 Registre des exports RGPD</strong> — Conforme articles 20 et 30 du RGPD.
            Logs conservés 3 ans puis purgés automatiquement (art. 5 RGPD).
          </div>

          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
            <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px'}}>
              <div style={{fontSize:22,fontWeight:800,color:S.purple}}>{rgpdStats.total}</div>
              <div style={{fontSize:10,color:'#888'}}>📦 Exports (période)</div>
            </div>
            <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,padding:'12px 14px'}}>
              <div style={{fontSize:22,fontWeight:800,color:S.green}}>{rgpdStats.mois}</div>
              <div style={{fontSize:10,color:'#888'}}>📅 Ce mois</div>
            </div>
            <div style={{background:'#fff',border:`0.5px solid ${rgpdStats.anomalies>0?S.red:'#e0e0d8'}`,borderRadius:12,padding:'12px 14px'}}>
              <div style={{fontSize:22,fontWeight:800,color:rgpdStats.anomalies>0?S.red:'#888'}}>{rgpdStats.anomalies}</div>
              <div style={{fontSize:10,color:rgpdStats.anomalies>0?S.red:'#888'}}>⚠️ Utilisateurs {'>'}10 exports</div>
            </div>
          </div>

          {/* Filtres */}
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            <select value={rgpdFilterEcole} onChange={e=>setRgpdFilterEcole(e.target.value)}
              style={{padding:'7px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:12,fontFamily:'inherit',minWidth:180}}>
              <option value="tous">🏫 Toutes les écoles</option>
              {ecoles.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
            <select value={rgpdFilterPeriode} onChange={e=>setRgpdFilterPeriode(parseInt(e.target.value))}
              style={{padding:'7px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:12,fontFamily:'inherit'}}>
              <option value={7}>📅 7 derniers jours</option>
              <option value={30}>📅 30 derniers jours</option>
              <option value={90}>📅 3 derniers mois</option>
              <option value={365}>📅 1 an</option>
              <option value={1095}>📅 3 ans (tout)</option>
            </select>
            <button onClick={loadRgpdLogs}
              style={{padding:'7px 14px',background:'#E1F5EE',color:'#085041',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
              🔄 Actualiser
            </button>
          </div>

          {/* Tableau */}
          {rgpdLoading ? (
            <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>Chargement...</div>
          ) : rgpdLogs.length === 0 ? (
            <div style={{textAlign:'center',padding:'2rem',color:'#888',background:'#fafaf7',borderRadius:12,border:'0.5px dashed #e0e0d8'}}>
              Aucun export RGPD sur la période sélectionnée
            </div>
          ) : (
            <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:12,overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#f5f5f0',borderBottom:'0.5px solid #e0e0d8'}}>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#888'}}>Date</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#888'}}>Utilisateur</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#888'}}>Rôle</th>
                      <th style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#888'}}>École</th>
                      <th style={{padding:'10px 12px',textAlign:'center',fontWeight:700,color:'#888'}}>Scope</th>
                      <th style={{padding:'10px 12px',textAlign:'center',fontWeight:700,color:'#888'}}>Volumes</th>
                      <th style={{padding:'10px 12px',textAlign:'right',fontWeight:700,color:'#888'}}>Taille</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rgpdLogs.map(log => {
                      const d = new Date(log.exported_at);
                      const dateStr = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
                      const scopeLabel = log.export_scope === 'self_plus_children' ? 'Soi + enfants' : 'Soi';
                      const scopeColor = log.export_scope === 'self_plus_children' ? '#378ADD' : '#888';
                      const roleBg = {
                        parent:'#FAEEDA', instituteur:'#E6F1FB',
                        surveillant:'#E1F5EE', super_admin:'#F0EEFF'
                      }[log.export_role] || '#f5f5f0';
                      const roleColor = {
                        parent:'#EF9F27', instituteur:'#378ADD',
                        surveillant:'#1D9E75', super_admin:'#534AB7'
                      }[log.export_role] || '#666';
                      const sizeKb = log.file_size_bytes ? Math.round(log.file_size_bytes / 1024) : 0;
                      return (
                        <tr key={log.id} style={{borderBottom:'0.5px solid #f0f0ec'}}>
                          <td style={{padding:'10px 12px',whiteSpace:'nowrap'}}>{dateStr}</td>
                          <td style={{padding:'10px 12px',fontWeight:600}}>{log._user_nom}</td>
                          <td style={{padding:'10px 12px'}}>
                            <span style={{padding:'2px 8px',borderRadius:8,background:roleBg,color:roleColor,fontWeight:700,fontSize:10}}>
                              {log.export_role}
                            </span>
                          </td>
                          <td style={{padding:'10px 12px',color:'#555'}}>{log._ecole_nom}</td>
                          <td style={{padding:'10px 12px',textAlign:'center'}}>
                            <span style={{fontSize:11,color:scopeColor,fontWeight:600}}>{scopeLabel}</span>
                          </td>
                          <td style={{padding:'10px 12px',textAlign:'center',fontSize:11,color:'#666'}}>
                            {log.nb_enfants > 0 && <span>{log.nb_enfants}👤 </span>}
                            {log.nb_validations > 0 && <span>{log.nb_validations}⭐ </span>}
                            {log.nb_certificats > 0 && <span>{log.nb_certificats}🏅</span>}
                          </td>
                          <td style={{padding:'10px 12px',textAlign:'right',fontSize:11,color:'#888',fontFamily:'monospace'}}>
                            {sizeKb > 0 ? `${sizeKb} KB` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section purges automatiques */}
          {purgeLogs.length > 0 && (
            <div style={{marginTop:20}}>
              <div style={{fontSize:12,fontWeight:700,color:'#888',marginBottom:8,textTransform:'uppercase',letterSpacing:0.5}}>
                🗑️ Dernières purges automatiques
              </div>
              <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:10,padding:'8px 0'}}>
                {purgeLogs.map(p => (
                  <div key={p.id} style={{padding:'6px 14px',borderBottom:'0.5px solid #f0f0ec',fontSize:11,color:'#666',display:'flex',justifyContent:'space-between'}}>
                    <span>{new Date(p.purged_at).toLocaleString('fr-FR')}</span>
                    <span style={{fontWeight:600,color:p.deleted_count>0?S.amber:'#888'}}>
                      {p.deleted_count} log(s) purgé(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export CSV bouton pour audit externe */}
          {rgpdLogs.length > 0 && (
            <div style={{marginTop:20,padding:'12px 16px',background:'#fafaf7',borderRadius:10,border:'0.5px dashed #e0e0d8'}}>
              <div style={{fontSize:11,color:'#666',marginBottom:8}}>
                💡 En cas d'audit CNDP ou demande formelle, vous pouvez exporter ces logs :
              </div>
              <button onClick={() => {
                const headers = ['Date', 'Utilisateur', 'Rôle', 'École', 'Scope', 'Enfants', 'Validations', 'Certificats', 'Taille (octets)', 'User-Agent'];
                const rows = rgpdLogs.map(l => [
                  l.exported_at, l._user_nom, l.export_role, l._ecole_nom,
                  l.export_scope, l.nb_enfants, l.nb_validations, l.nb_certificats,
                  l.file_size_bytes || '', (l.user_agent || '').replace(/[",\n]/g, ' '),
                ]);
                const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `audit_rgpd_${new Date().toISOString().slice(0,10)}.csv`;
                link.click();
              }}
                style={{padding:'7px 14px',background:S.purple,color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
                📥 Exporter CSV ({rgpdLogs.length} logs)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── VUE CORBEILLE — éléments soft-deleted ─────────────────── */}
      {!loading && vue === 'corbeille' && (
        <div>
          <div style={{background:'#FAEEDA',borderRadius:10,padding:'12px 16px',marginBottom:'1rem',fontSize:13,color:'#633806',display:'flex',gap:10,alignItems:'flex-start'}}>
            <span style={{fontSize:18}}>🗑️</span>
            <div>
              <div style={{fontWeight:700,marginBottom:3}}>Corbeille — Éléments supprimés (soft-delete)</div>
              <div style={{fontSize:12,opacity:0.85,lineHeight:1.5}}>
                Les élèves et utilisateurs (parents/instituteurs/surveillants) supprimés via l'app sont conservés ici.
                Vous pouvez les restaurer si la suppression était une erreur. Les données restent en BDD pour
                conformité RGPD (purge automatique possible plus tard).
              </div>
            </div>
          </div>

          {/* Filtre par école */}
          <div style={{marginBottom:'1rem',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:12,fontWeight:600,color:'#666'}}>Filtrer par école :</span>
            <select value={corbeilleFilterEcole} onChange={e=>setCorbeilleFilterEcole(e.target.value)}
              style={{padding:'6px 10px',borderRadius:6,border:'1px solid #ddd',fontSize:12,background:'#fff'}}>
              <option value="tous">Toutes les écoles</option>
              {ecoles.map(e=>(<option key={e.id} value={e.id}>{e.nom}</option>))}
            </select>
            <button onClick={loadCorbeille} disabled={corbeilleLoading}
              style={{padding:'6px 12px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:corbeilleLoading?'default':'pointer'}}>
              🔄 Actualiser
            </button>
          </div>

          {corbeilleLoading && <div style={{textAlign:'center',padding:'2rem',color:'#888'}}>Chargement…</div>}

          {!corbeilleLoading && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              {/* Élèves supprimés */}
              <div style={{background:'#fff',borderRadius:10,padding:'1rem',border:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:10,color:'#173404'}}>
                  🎓 Élèves supprimés ({corbeilleEleves.length})
                </div>
                {corbeilleEleves.length === 0 ? (
                  <div style={{padding:'1.5rem',textAlign:'center',fontSize:12,color:'#888'}}>
                    ✨ Aucun élève dans la corbeille
                  </div>
                ) : (
                  <div style={{maxHeight:480,overflowY:'auto'}}>
                    {corbeilleEleves.map(e => {
                      const ecoleNom = ecoles.find(ec=>ec.id===e.ecole_id)?.nom || e.ecole_id?.slice(0,8);
                      return (
                        <div key={e.id} style={{padding:'10px',borderRadius:8,background:'#f9f9f6',marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:'#173404'}}>
                              {e.prenom} {e.nom}
                            </div>
                            <div style={{fontSize:11,color:'#666'}}>
                              🏫 {ecoleNom} · 🗓️ {e.deleted_at ? new Date(e.deleted_at).toLocaleString('fr-FR') : '-'}
                            </div>
                          </div>
                          <button onClick={()=>handleRestore('eleves', e.id, `${e.prenom} ${e.nom}`)}
                            disabled={restoring===e.id}
                            style={{padding:'6px 10px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:restoring===e.id?'default':'pointer',whiteSpace:'nowrap'}}>
                            {restoring===e.id ? '...' : '↺ Restaurer'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Utilisateurs supprimés */}
              <div style={{background:'#fff',borderRadius:10,padding:'1rem',border:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:10,color:'#173404'}}>
                  👤 Utilisateurs supprimés ({corbeilleUsers.length})
                </div>
                {corbeilleUsers.length === 0 ? (
                  <div style={{padding:'1.5rem',textAlign:'center',fontSize:12,color:'#888'}}>
                    ✨ Aucun utilisateur dans la corbeille
                  </div>
                ) : (
                  <div style={{maxHeight:480,overflowY:'auto'}}>
                    {corbeilleUsers.map(u => {
                      const ecoleNom = ecoles.find(ec=>ec.id===u.ecole_id)?.nom || u.ecole_id?.slice(0,8);
                      const roleLabel = {parent:'👨‍👩 Parent',instituteur:'👨‍🏫 Instituteur',surveillant:'👁️ Surveillant',super_admin:'🔑 Super-admin'}[u.role] || u.role;
                      return (
                        <div key={u.id} style={{padding:'10px',borderRadius:8,background:'#f9f9f6',marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:'#173404'}}>
                              {u.prenom} {u.nom}
                            </div>
                            <div style={{fontSize:11,color:'#666'}}>
                              {roleLabel} · 🏫 {ecoleNom}
                            </div>
                            <div style={{fontSize:10,color:'#888',marginTop:2}}>
                              🗓️ Supprimé le {u.deleted_at ? new Date(u.deleted_at).toLocaleString('fr-FR') : '-'}
                            </div>
                          </div>
                          <button onClick={()=>handleRestore('utilisateurs', u.id, `${u.prenom} ${u.nom}`)}
                            disabled={restoring===u.id}
                            style={{padding:'6px 10px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,fontSize:11,fontWeight:600,cursor:restoring===u.id?'default':'pointer',whiteSpace:'nowrap'}}>
                            {restoring===u.id ? '...' : '↺ Restaurer'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL DE CONFIRMATION FORTE ─────────────────────────── */}
      {confirmAction && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div style={{background:'#fff',borderRadius:16,maxWidth:500,width:'100%',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'1.5rem',borderBottom:'0.5px solid #e0e0d8'}}>
              <div style={{fontSize:18,fontWeight:800,color:confirmAction.confirmColor,marginBottom:6}}>
                {confirmAction.title}
              </div>
              <div style={{fontSize:13,color:'#555',lineHeight:1.5}}>
                {confirmAction.description}
              </div>
            </div>

            {confirmAction.warnings.length > 0 && (
              <div style={{padding:'1rem 1.5rem',background:'#FAEEDA',borderBottom:'0.5px solid #e0e0d8'}}>
                <div style={{fontSize:12,fontWeight:700,color:'#633806',marginBottom:6}}>
                  ⚠️ Conséquences :
                </div>
                {confirmAction.warnings.map((w, i) => (
                  <div key={i} style={{fontSize:12,color:'#633806',marginBottom:3}}>• {w}</div>
                ))}
              </div>
            )}

            <div style={{padding:'1.25rem 1.5rem'}}>
              {confirmAction.expectedText && (
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#555',display:'block',marginBottom:6}}>
                    Tapez <strong style={{color:confirmAction.confirmColor,fontFamily:'monospace'}}>{confirmAction.expectedText}</strong> pour confirmer :
                  </label>
                  <input type="text" value={confirmAction.typedText || ''}
                    onChange={e => setConfirmAction({...confirmAction, typedText: e.target.value})}
                    style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid #e0e0d8',fontSize:14,fontFamily:'inherit'}}
                    placeholder={confirmAction.expectedText}
                    autoFocus
                  />
                </div>
              )}

              <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer',fontSize:12,color:'#555'}}>
                <input type="checkbox" checked={confirmAction.checked1 || false}
                  onChange={e => setConfirmAction({...confirmAction, checked1: e.target.checked})} />
                Je comprends les conséquences de cette action
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,cursor:'pointer',fontSize:12,color:'#555'}}>
                <input type="checkbox" checked={confirmAction.checked2 || false}
                  onChange={e => setConfirmAction({...confirmAction, checked2: e.target.checked})} />
                Cette action sera enregistrée dans le journal d'audit
              </label>

              <div style={{display:'flex',gap:10}}>
                <button onClick={() => setConfirmAction(null)}
                  style={{flex:1,padding:'11px',background:'#fff',color:'#666',border:'1px solid #e0e0d8',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                  Annuler
                </button>
                <button
                  onClick={() => confirmAction.onConfirm()}
                  disabled={
                    !confirmAction.checked1 ||
                    !confirmAction.checked2 ||
                    (confirmAction.expectedText && confirmAction.typedText !== confirmAction.expectedText)
                  }
                  style={{
                    flex:1, padding:'11px',
                    background: (!confirmAction.checked1 || !confirmAction.checked2 || (confirmAction.expectedText && confirmAction.typedText !== confirmAction.expectedText))
                      ? '#e0e0d8'
                      : confirmAction.confirmColor,
                    color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700,
                    cursor: (!confirmAction.checked1 || !confirmAction.checked2 || (confirmAction.expectedText && confirmAction.typedText !== confirmAction.expectedText)) ? 'not-allowed' : 'pointer',
                    fontFamily:'inherit'
                  }}>
                  {confirmAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
