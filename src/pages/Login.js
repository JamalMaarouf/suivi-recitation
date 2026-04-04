import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

export default function Login({ onLogin, lang, LangSelector, onShowInscription }) {
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifiant.trim() || !motDePasse) { setError(t(lang, 'remplir_champs')); return; }
    setLoading(true);

    // Check utilisateurs (surveillant / instituteur / super_admin)
    const { data, error: err } = await supabase
      .from('utilisateurs')
      .select('*, ecole:ecole_id(id,nom,ville,statut)')
      .eq('identifiant', identifiant.trim())
      .eq('mot_de_passe', motDePasse)
      .single();

    if (!err && data) {
      // Compte en attente de validation
      if (data.statut_compte === 'en_attente') {
        setError(lang==='ar'
          ? 'حسابك في انتظار التفعيل من طرف المشرف العام'
          : 'Votre compte est en attente de validation par le super admin.');
        setLoading(false);
        return;
      }
      // Compte suspendu
      if (data.statut_compte === 'suspendu') {
        setError(lang==='ar' ? 'تم تعليق حسابك' : 'Votre compte a été suspendu.');
        setLoading(false);
        return;
      }
      setLoading(false);
      onLogin(data);
      return;
    }

    // Check parents table
    const { data: parentData, error: parentErr } = await supabase
      .from('parents')
      .select('*')
      .eq('identifiant', identifiant.trim())
      .eq('mot_de_passe', motDePasse)
      .single();

    setLoading(false);
    if (!parentErr && parentData) { onLogin({...parentData, role: 'parent'}); return; }

    setError(t(lang, 'identifiant_incorrect'));
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f0',padding:'1rem',position:'relative'}}>
      <div style={{position:'absolute',top:16,right:16}}>
        <LangSelector />
      </div>
      <div style={{width:'100%',maxWidth:380,background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'2rem 1.75rem'}}>
        <div style={{textAlign:'center',marginBottom:'1.75rem'}}>
          <div style={{width:60,height:60,borderRadius:'50%',background:'#1D9E75',margin:'0 auto 0.75rem',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:28}}>📖</span>
          </div>
          <div style={{fontSize:18,fontWeight:700}}>{t(lang,'login_title')}</div>
          <div style={{fontSize:12,color:'#888',marginTop:4}}>{t(lang,'login_subtitle')}</div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-lbl">{t(lang,'identifiant')}</label>
            <input className="field-input" type="text" value={identifiant}
              onChange={e=>setIdentifiant(e.target.value)}
              placeholder={t(lang,'identifiant')} autoComplete="username"/>
          </div>
          <div className="field-group">
            <label className="field-lbl">{t(lang,'mot_de_passe')}</label>
            <input className="field-input" type="password" value={motDePasse}
              onChange={e=>setMotDePasse(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"/>
          </div>
          <button className="btn-primary" type="submit" disabled={loading} style={{marginTop:'0.5rem'}}>
            {loading ? t(lang,'connexion_en_cours') : t(lang,'se_connecter')}
          </button>
        </form>

        <div style={{display:'flex',gap:8,marginTop:'1.25rem'}}>
          <div style={{flex:1,padding:10,borderRadius:8,border:'0.5px solid #e0e0d8',textAlign:'center',background:'#f9f9f6'}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{t(lang,'role_surveillant')}</div>
            <div style={{fontSize:11,color:'#888'}}>{t(lang,'acces_complet')}</div>
          </div>
          <div style={{flex:1,padding:10,borderRadius:8,border:'0.5px solid #e0e0d8',textAlign:'center',background:'#f9f9f6'}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{t(lang,'role_instituteur')}</div>
            <div style={{fontSize:11,color:'#888'}}>{t(lang,'validation_suivi')}</div>
          </div>
        </div>

        {/* Inscription école */}
        <div style={{marginTop:'1.25rem',textAlign:'center',paddingTop:'1rem',borderTop:'0.5px solid #e0e0d8'}}>
          <div style={{fontSize:12,color:'#888',marginBottom:6}}>
            {lang==='ar' ? 'مدرسة جديدة ؟' : lang==='en' ? 'New school?' : 'Nouvelle école ?'}
          </div>
          <button onClick={onShowInscription}
            style={{padding:'8px 20px',background:'#534AB7',color:'#fff',border:'none',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            {lang==='ar' ? '📝 طلب تسجيل مدرسة' : lang==='en' ? '📝 Register your school' : '📝 Inscrire mon école'}
          </button>
        </div>
      </div>
    </div>
  );
}
