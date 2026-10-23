import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { C, HEADER_BG } from '../components/ui/theme';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { getCachedSWR } from '../lib/cache';
import { fetchAll } from '../lib/fetchAll';

export default function Login({ onLogin, lang, LangSelector, onShowInscription }) {
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  // Securite (oct 2026) : message apres une deconnexion pour session expiree / mise a jour
  const [error, setError] = useState(() => {
    try {
      if (sessionStorage.getItem('suivi_session_expiree')) {
        sessionStorage.removeItem('suivi_session_expiree');
        return lang === 'ar' ? 'انتهت الجلسة، يرجى تسجيل الدخول من جديد' : 'Session expirée, merci de vous reconnecter.';
      }
    } catch (e) { /* */ }
    return '';
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifiant.trim() || !motDePasse) { setError(t(lang, 'remplir_champs')); return; }
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          identifiant: identifiant.trim(),
          mot_de_passe: motDePasse,
        }),
      });

      const data = await res.json();

      if (res.status === 403 && data.error === 'compte_en_attente') {
        setError(lang==='ar'
          ? 'حسابك في انتظار التفعيل من طرف المشرف العام'
          : 'Votre compte est en attente de validation par le super admin.');
        setLoading(false);
        return;
      }
      if (res.status === 403 && data.error === 'compte_suspendu') {
        setError(lang==='ar' ? 'تم تعليق حسابك' : 'Votre compte a été suspendu.');
        setLoading(false);
        return;
      }
      // Rate limit dépassé (5 échecs / 15 min)
      if (res.status === 429) {
        const mins = Math.ceil((data.retryAfter || 900) / 60);
        setError(lang==='ar'
          ? `محاولات كثيرة. أعد المحاولة بعد ${mins} دقيقة.`
          : `Trop de tentatives. Réessayez dans ${mins} minute(s).`);
        setLoading(false);
        return;
      }
      if (!res.ok || !data.user) {
        // Si le serveur renvoie le nombre de tentatives restantes, on l'affiche
        // pour avertir l'utilisateur avant le blocage.
        const rem = typeof data.remaining === 'number' ? data.remaining : null;
        if (rem !== null && rem <= 2 && rem > 0) {
          setError(lang==='ar'
            ? `معرف أو كلمة مرور خاطئة. محاولات متبقية: ${rem}`
            : `Identifiant ou mot de passe incorrect. Tentatives restantes : ${rem}.`);
        } else {
          setError(t(lang, 'identifiant_incorrect'));
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      // Securite (oct 2026) : session signee par le serveur, envoyee a chaque requete
      try {
        if (data.token) localStorage.setItem('suivi_token', data.token);
        else localStorage.removeItem('suivi_token');
      } catch (e) { /* stockage indisponible */ }

      // Précharger en arrière-plan les données du Dashboard
      // Quand Dashboard s'affichera, les données seront déjà dans le cache SWR
      const ecoleId = data.user.ecole_id;
      if (ecoleId) {
        // Fire and forget — ne pas attendre, laisser tourner en parallèle du render
        Promise.all([
          getCachedSWR('instituteurs', ecoleId,
            () => supabase.from('utilisateurs').select('id,prenom,nom,role').eq('role','instituteur').eq('ecole_id', ecoleId)),
          getCachedSWR('niveaux', ecoleId,
            () => supabase.from('niveaux').select('id,code,nom,type,couleur').eq('ecole_id', ecoleId).order('ordre')),
          getCachedSWR('validations', ecoleId,
            // Alignement avec Dashboard.js : inclure `ensemble_id` pour le prechargement.
            () => fetchAll(supabase.from('validations').select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,tomon_debut,date_validation,valide_par,ecole_id,ensemble_id,valideur:valide_par(prenom,nom)').eq('ecole_id', ecoleId).order('date_validation',{ascending:false}))),
          getCachedSWR('recitations_sourates_min', ecoleId,
            // Alignement avec Dashboard.js : inclure `points` pour le prechargement du cache.
            () => fetchAll(supabase.from('recitations_sourates').select('eleve_id,date_validation,type_recitation,points,is_muraja').eq('ecole_id', ecoleId).order('date_validation',{ascending:false}))),
        ]).catch(() => { /* silencieux — Dashboard fera le retry normal si échec */ });
      }

      onLogin(data.user);
    } catch (err) {
      // API indisponible — message d'erreur réseau
      setLoading(false);
      setError(lang==='ar'
        ? 'خطأ في الاتصال، يرجى المحاولة مجدداً'
        : 'Erreur de connexion, veuillez réessayer.');
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,padding:'1rem',position:'relative'}}>
      <div style={{position:'absolute',top:16,right:16}}>
        <LangSelector />
      </div>
      <div style={{width:'100%',maxWidth:380,background:C.surface,border:`1px solid ${C.line}`,borderRadius:16,padding:'2rem 1.75rem',boxShadow:'0 8px 30px rgba(11,90,69,0.08)'}}>
        <div style={{textAlign:'center',marginBottom:'1.75rem'}}>
          {/* Charte (oct 2026) : meme marque que l'en-tete de l'app */}
          <div style={{width:60,height:60,borderRadius:16,background:HEADER_BG,margin:'0 auto 0.75rem',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>
            <BookOpen size={28} strokeWidth={2} />
          </div>
          <div style={{fontSize:20,fontWeight:700,color:C.text}}>{t(lang,'login_title')}</div>
          <div style={{fontSize:13,color:C.muted,marginTop:4}}>{t(lang,'login_subtitle')}</div>
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
            style={{padding:'10px 20px',minHeight:44,background:C.surface,color:C.brand,border:`1px solid ${C.brand}`,borderRadius:12,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
            {lang==='ar' ? 'طلب تسجيل مدرسة' : lang==='en' ? 'Register your school' : 'Inscrire mon école'}
          </button>
        </div>
      </div>
    </div>
  );
}
