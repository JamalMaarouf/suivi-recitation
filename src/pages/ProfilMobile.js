import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

const NIVEAU_COLORS = { '5B':'#534AB7','5A':'#378ADD','2M':'#1D9E75','2':'#EF9F27','1':'#E24B4A' };
const ROLE_LABELS = {
  surveillant: { fr:'Surveillant général', ar:'مراقب عام', color:'#1D9E75', bg:'#E1F5EE' },
  instituteur:  { fr:'Instituteur',        ar:'أستاذ',     color:'#378ADD', bg:'#E6F1FB' },
  super_admin:  { fr:'Super Admin',        ar:'مشرف عام',  color:'#534AB7', bg:'#F0EEFF' },
};

export default function ProfilMobile({ user, lang, onLogout, navigate, goBack }) {
  const [changingPwd, setChangingPwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const role = ROLE_LABELS[user.role] || { fr: user.role, ar: user.role, color:'#888', bg:'#f5f5f0' };
  const initials = ((user.prenom||'?')[0] + (user.nom||'?')[0]).toUpperCase();

  const handleChangePwd = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) {
      setPwdMsg({ ok: false, text: lang==='ar'?'يرجى ملء جميع الحقول':'Remplissez tous les champs' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: lang==='ar'?'كلمتا المرور غير متطابقتين':'Les mots de passe ne correspondent pas' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ ok: false, text: lang==='ar'?'كلمة المرور قصيرة جداً (6 أحرف على الأقل)':'Mot de passe trop court (6 min)' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', user_id: user.id, old_password: oldPwd, new_password: newPwd }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setPwdMsg({ ok: false, text: resData.error || 'Erreur' });
        setSaving(false);
        return;
      }
      setPwdMsg({ ok: true, text: lang==='ar'?'✅ تم تغيير كلمة المرور':'✅ Mot de passe modifié' });
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
      setSaving(false);
      return;
    } catch(e) {}
    // Fallback
    const { error } = await supabase.from('utilisateurs')
      .update({ mot_de_passe: newPwd }).eq('id', user.id);
    if (error) {
      setPwdMsg({ ok: false, text: error.message });
    } else {
      setPwdMsg({ ok: true, text: lang==='ar'?'✅ تم تغيير كلمة المرور':'✅ Mot de passe modifié !' });
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
      setTimeout(() => { setChangingPwd(false); setPwdMsg(null); }, 2000);
    }
    setSaving(false);
  };

  const inp = {
    width:'100%', padding:'13px 16px', borderRadius:12,
    border:'0.5px solid #e0e0d8', fontSize:16,
    fontFamily:'inherit', boxSizing:'border-box',
    background:'#fff', color:'#1a1a1a',
  };
  const lbl = { fontSize:13, fontWeight:600, color:'#666', display:'block', marginBottom:6 };

  return (
    <div style={{paddingBottom:88, minHeight:'100vh', background:'#f5f5f0'}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#374151,#4B5563)', padding:'48px 20px 24px', textAlign:'center', position:'sticky', top:0, zIndex:100}}>
        {/* Avatar */}
        <div style={{width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,0.2)',
          border:'2px solid rgba(255,255,255,0.4)', display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:26, fontWeight:800, color:'#fff', margin:'0 auto 12px'}}>
          {initials}
        </div>
        <div style={{fontSize:20, fontWeight:800, color:'#fff', marginBottom:4}}>
          {user.prenom} {user.nom}
        </div>
        <span style={{padding:'4px 14px', borderRadius:20, fontSize:12, fontWeight:600,
          background:role.bg, color:role.color}}>
          {lang==='ar' ? role.ar : role.fr}
        </span>
        {user.ecole && (
          <div style={{fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:8}}>
            🏫 {user.ecole.nom}
          </div>
        )}
      </div>

      <div style={{padding:'16px'}}>

        {/* Info compte */}
        <div style={{background:'#fff', borderRadius:16, overflow:'hidden',
          border:'0.5px solid #e0e0d8', marginBottom:16}}>
          <div style={{padding:'12px 16px', borderBottom:'0.5px solid #f0f0ec',
            fontSize:11, fontWeight:700, color:'#888', letterSpacing:'0.5px'}}>
            {lang==='ar'?'معلومات الحساب':'INFORMATIONS'}
          </div>
          {[
            { icon:'👤', label: lang==='ar'?'الاسم الكامل':'Nom complet', value: `${user.prenom} ${user.nom}` },
            { icon:'🔑', label: lang==='ar'?'معرف الدخول':'Identifiant', value: user.identifiant },
            { icon:'🎭', label: lang==='ar'?'الدور':'Rôle', value: lang==='ar' ? role.ar : role.fr },
          ].map((row, i) => (
            <div key={i} style={{display:'flex', alignItems:'center', gap:14,
              padding:'14px 16px', borderBottom:'0.5px solid #f0f0ec'}}>
              <span style={{fontSize:20, width:28, textAlign:'center'}}>{row.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11, color:'#888', marginBottom:2}}>{row.label}</div>
                <div style={{fontSize:15, fontWeight:600, color:'#1a1a1a'}}>{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{background:'#fff', borderRadius:16, overflow:'hidden',
          border:'0.5px solid #e0e0d8', marginBottom:16}}>
          <div style={{padding:'12px 16px', borderBottom:'0.5px solid #f0f0ec',
            fontSize:11, fontWeight:700, color:'#888', letterSpacing:'0.5px'}}>
            {lang==='ar'?'الإجراءات':'ACTIONS'}
          </div>

          {/* Changer mot de passe */}
          <div onClick={()=>setChangingPwd(!changingPwd)}
            style={{display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
              borderBottom:'0.5px solid #f0f0ec', cursor:'pointer',
              background: changingPwd ? '#F0EEFF' : '#fff', transition:'background 0.15s'}}>
            <span style={{fontSize:20, width:28, textAlign:'center'}}>🔒</span>
            <div style={{flex:1}}>
              <div style={{fontSize:15, fontWeight:600, color: changingPwd ? '#534AB7' : '#1a1a1a'}}>
                {lang==='ar'?'تغيير كلمة المرور':'Changer le mot de passe'}
              </div>
            </div>
            <span style={{color:'#ccc', fontSize:18}}>{changingPwd ? '▲' : '▶'}</span>
          </div>

          {/* Formulaire changement mdp */}
          {changingPwd && (
            <div style={{padding:'16px', borderBottom:'0.5px solid #f0f0ec', background:'#fafaf8'}}>
              {pwdMsg && (
                <div style={{padding:'10px 14px', borderRadius:10, marginBottom:12, fontSize:13,
                  background: pwdMsg.ok ? '#E1F5EE' : '#FCEBEB',
                  color: pwdMsg.ok ? '#085041' : '#E24B4A',
                  border: `0.5px solid ${pwdMsg.ok ? '#1D9E7530' : '#E24B4A30'}`}}>
                  {pwdMsg.text}
                </div>
              )}
              <div style={{marginBottom:12}}>
                <label style={lbl}>{lang==='ar'?'كلمة المرور الحالية':'Mot de passe actuel'}</label>
                <input type="password" style={inp} value={oldPwd}
                  onChange={e=>setOldPwd(e.target.value)} autoComplete="current-password"/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={lbl}>{lang==='ar'?'كلمة المرور الجديدة':'Nouveau mot de passe'}</label>
                <input type="password" style={inp} value={newPwd}
                  onChange={e=>setNewPwd(e.target.value)} autoComplete="new-password"/>
              </div>
              <div style={{marginBottom:14}}>
                <label style={lbl}>{lang==='ar'?'تأكيد كلمة المرور':'Confirmer le mot de passe'}</label>
                <input type="password" style={inp} value={confirmPwd}
                  onChange={e=>setConfirmPwd(e.target.value)} autoComplete="new-password"/>
              </div>
              <button onClick={handleChangePwd} disabled={saving}
                style={{width:'100%', padding:'14px', background: saving ? '#ccc' : '#534AB7',
                  color:'#fff', border:'none', borderRadius:12, fontSize:15,
                  fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
                {saving ? '...' : (lang==='ar'?'✓ حفظ كلمة المرور':'✓ Enregistrer')}
              </button>
            </div>
          )}

          {/* Gestion de l'école (surveillant only) */}
          {user.role === 'surveillant' && (
            <div onClick={()=>navigate('gestion')}
              style={{display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                borderBottom:'0.5px solid #f0f0ec', cursor:'pointer'}}>
              <span style={{fontSize:20, width:28, textAlign:'center'}}>⚙️</span>
              <div style={{flex:1}}>
                <div style={{fontSize:15, fontWeight:600, color:'#1a1a1a'}}>
                  {lang==='ar'?'إدارة المدرسة':'Gestion de l\'école'}
                </div>
                <div style={{fontSize:12, color:'#888', marginTop:2}}>
                  {lang==='ar'?'الطلاب والمعلمون والأولياء':'Élèves, instituteurs, parents'}
                </div>
              </div>
              <span style={{color:'#ccc', fontSize:18}}>▶</span>
            </div>
          )}

          {/* Finance (surveillant only) */}
          {user.role === 'surveillant' && (
            <div onClick={()=>navigate('finance')}
              style={{display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                borderBottom:'0.5px solid #f0f0ec', cursor:'pointer'}}>
              <span style={{fontSize:20, width:28, textAlign:'center'}}>💰</span>
              <div style={{flex:1}}>
                <div style={{fontSize:15, fontWeight:600, color:'#1a1a1a'}}>
                  {lang==='ar'?'المالية':'Finance'}
                </div>
                <div style={{fontSize:12, color:'#888', marginTop:2}}>
                  {lang==='ar'?'الاشتراكات والمصاريف':'Cotisations et dépenses'}
                </div>
              </div>
              <span style={{color:'#ccc', fontSize:18}}>▶</span>
            </div>
          )}
        </div>

        {/* Déconnexion */}
        <button onClick={onLogout}
          style={{width:'100%', padding:'16px', background:'#FCEBEB',
            color:'#E24B4A', border:'1.5px solid #E24B4A30', borderRadius:16,
            fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
            display:'flex', alignItems:'center', justifyContent:'center', gap:10}}>
          <span style={{fontSize:20}}>🚪</span>
          {lang==='ar'?'تسجيل الخروج':'Déconnexion'}
        </button>

        {/* Version */}
        <div style={{textAlign:'center', marginTop:20, fontSize:11, color:'#bbb'}}>
          Suivi Récitation v3.0 · 2026
        </div>

      </div>
    </div>
  );
}
