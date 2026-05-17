import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function InscriptionEcole({ onBack, lang }) {
  const [form, setForm] = useState({ nom:'', ville:'', pays:'Maroc', telephone:'', email:'', identifiant:'', mot_de_passe:'', prenom_surveillant:'', nom_surveillant:'' });
  const [step, setStep] = useState(1); // 1=infos école, 2=compte surveillant, 3=succès
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // J11-bis : acceptation legale (RGPD + CGU)
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAuthority, setAcceptAuthority] = useState(false);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.ville.trim()) {
      setError(lang==='ar' ? 'يرجى ملء جميع الحقول الإلزامية' : 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifiant.trim() || !form.mot_de_passe || !form.prenom_surveillant.trim()) {
      setError(lang==='ar' ? 'يرجى ملء جميع الحقول الإلزامية' : 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (form.mot_de_passe.length < 6) {
      setError(lang==='ar' ? 'كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل' : 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    // J11-bis : verification acceptation CGU + Confidentialite + Autorite
    if (!acceptCGU || !acceptPrivacy || !acceptAuthority) {
      setError(lang==='ar'
        ? 'يجب قبول الشروط العامة وسياسة الخصوصية والتصريح بالصلاحية للمتابعة'
        : 'Vous devez accepter les CGU, la Politique de Confidentialité et certifier votre autorité pour continuer.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Check identifiant not taken
      const { data: existing } = await supabase
        .from('utilisateurs')
        .select('id')
        .eq('identifiant', form.identifiant.trim())
        .single();
      if (existing) {
        setError(lang==='ar' ? 'هذا المعرف مستخدم بالفعل' : 'Cet identifiant est déjà utilisé.');
        setLoading(false);
        return;
      }

      // Generate code_acces
      const code = 'ECO-' + Math.random().toString(36).substring(2,8).toUpperCase();

      // J11-bis : timestamp acceptation (legal opposable)
      const acceptedAt = new Date().toISOString();

      // 1. Create école (statut en_attente) + traceabilite legale
      const { data: ecole, error: errEcole } = await supabase
        .from('ecoles')
        .insert({
          nom: form.nom.trim(),
          ville: form.ville.trim(),
          pays: form.pays,
          telephone: form.telephone||null,
          email: form.email||null,
          code_acces: code,
          statut: 'en_attente',
          // J11-bis : tracabilite acceptation legale
          cgu_accepted_at: acceptedAt,
          cgu_version: '1.0',
          privacy_accepted_at: acceptedAt,
          privacy_version: '1.0',
        })
        .select()
        .single();
      if (errEcole) throw errEcole;

      // 2. Create surveillant account (statut en_attente)
      const { error: errUser } = await supabase
        .from('utilisateurs')
        .insert({ prenom: form.prenom_surveillant.trim(), nom: form.nom_surveillant.trim()||'', identifiant: form.identifiant.trim(), mot_de_passe: form.mot_de_passe, role: 'surveillant', ecole_id: ecole.id, statut_compte: 'en_attente' });
      if (errUser) throw errUser;

      setStep(3);
    } catch(err) {
      setError((lang==='ar' ? 'خطأ: ' : 'Erreur : ') + err.message);
    }
    setLoading(false);
  };

  const inputStyle = {width:'100%',padding:'9px 12px',borderRadius:8,border:'0.5px solid #e0e0d8',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'};
  const labelStyle = {fontSize:12,fontWeight:600,color:'#444',display:'block',marginBottom:4};

  if (step === 3) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f0',padding:'1rem'}}>
      <div style={{width:'100%',maxWidth:420,background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'2rem',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:'1rem'}}>✅</div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>
          {lang==='ar' ? 'تم إرسال الطلب بنجاح!' : 'Demande envoyée avec succès !'}
        </div>
        <div style={{fontSize:13,color:'#888',marginBottom:'1.5rem',lineHeight:1.6}}>
          {lang==='ar'
            ? 'سيتم مراجعة طلبكم من طرف المشرف العام وإعلامكم في أقرب وقت. بعد التفعيل يمكنكم تسجيل الدخول.'
            : 'Votre demande sera examinée par le super admin. Vous pourrez vous connecter une fois votre compte validé.'}
        </div>
        <button onClick={onBack}
          style={{padding:'10px 24px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13}}>
          {lang==='ar' ? '← العودة لتسجيل الدخول' : '← Retour à la connexion'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f0',padding:'1rem'}}>
      <div style={{width:'100%',maxWidth:440,background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:16,padding:'2rem'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:'1.5rem'}}>
          <button onClick={onBack} className="back-link">{lang==='ar'?'رجوع':'Retour'}</button>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>
              {lang==='ar' ? '📝 تسجيل مدرسة جديدة' : '📝 Inscrire votre école'}
            </div>
            <div style={{fontSize:11,color:'#888'}}>
              {lang==='ar' ? `الخطوة ${step} من 2` : `Étape ${step} sur 2`}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{height:4,background:'#e0e0d8',borderRadius:2,marginBottom:'1.5rem'}}>
          <div style={{height:'100%',width:step===1?'50%':'100%',background:'#085041',borderRadius:2,transition:'width 0.3s'}}/>
        </div>

        {error && <div style={{background:'#FCEBEB',border:'0.5px solid #E24B4A30',borderRadius:8,padding:'10px 12px',marginBottom:'1rem',fontSize:12,color:'#E24B4A'}}>{error}</div>}

        {step === 1 && (
          <form onSubmit={handleStep1}>
            <div style={{fontSize:13,fontWeight:600,color:'#534AB7',marginBottom:'1rem'}}>
              {lang==='ar' ? '🏫 معلومات المدرسة' : '🏫 Informations de l\'école'}
            </div>
            <div style={{display:'grid',gap:12}}>
              <div>
                <label style={labelStyle}>{lang==='ar' ? 'اسم المدرسة *' : 'Nom de l\'école *'}</label>
                <input style={inputStyle} value={form.nom} onChange={e=>set('nom',e.target.value)} placeholder={lang==='ar' ? 'مدرسة القرآن الكريم' : 'École de récitation Al-Quran'}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={labelStyle}>{lang==='ar' ? 'المدينة *' : 'Ville *'}</label>
                  <input style={inputStyle} value={form.ville} onChange={e=>set('ville',e.target.value)} placeholder={lang==='ar' ? 'الدار البيضاء' : 'Casablanca'}/>
                </div>
                <div>
                  <label style={labelStyle}>{lang==='ar' ? 'البلد' : 'Pays'}</label>
                  <input style={inputStyle} value={form.pays} onChange={e=>set('pays',e.target.value)}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>{lang==='ar' ? 'الهاتف' : 'Téléphone'}</label>
                <input style={inputStyle} value={form.telephone} onChange={e=>set('telephone',e.target.value)} placeholder="+212 6XX XXX XXX"/>
              </div>
              <div>
                <label style={labelStyle}>{lang==='ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                <input style={inputStyle} type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="ecole@example.com"/>
              </div>
            </div>
            <button type="submit"
              style={{width:'100%',marginTop:'1.25rem',padding:'11px',background:'#085041',color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontSize:13}}>
              {lang==='ar' ? 'التالي ←' : 'Suivant →'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div style={{fontSize:13,fontWeight:600,color:'#534AB7',marginBottom:'1rem'}}>
              {lang==='ar' ? '👤 حساب المراقب العام' : '👤 Compte du surveillant général'}
            </div>
            <div style={{background:'#F0EEFF',borderRadius:8,padding:'10px 12px',marginBottom:'1rem',fontSize:12,color:'#534AB7'}}>
              {lang==='ar'
                ? `مدرسة: ${form.nom} — ${form.ville}`
                : `École : ${form.nom} — ${form.ville}`}
            </div>
            <div style={{display:'grid',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={labelStyle}>{lang==='ar' ? 'الاسم الأول *' : 'Prénom *'}</label>
                  <input style={inputStyle} value={form.prenom_surveillant} onChange={e=>set('prenom_surveillant',e.target.value)}/>
                </div>
                <div>
                  <label style={labelStyle}>{lang==='ar' ? 'اللقب' : 'Nom'}</label>
                  <input style={inputStyle} value={form.nom_surveillant} onChange={e=>set('nom_surveillant',e.target.value)}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>{lang==='ar' ? 'معرف تسجيل الدخول *' : 'Identifiant de connexion *'}</label>
                <input style={inputStyle} value={form.identifiant} onChange={e=>set('identifiant',e.target.value)} placeholder={lang==='ar' ? 'مثال: ecole_casa' : 'ex: ecole_casa'} autoComplete="off"/>
              </div>
              <div>
                <label style={labelStyle}>{lang==='ar' ? 'كلمة المرور *' : 'Mot de passe *'} <span style={{color:'#888',fontWeight:400}}>(min 6 caractères)</span></label>
                <input style={inputStyle} type="password" value={form.mot_de_passe} onChange={e=>set('mot_de_passe',e.target.value)} autoComplete="new-password"/>
              </div>
            </div>
            <div style={{background:'#FFF3CD',borderRadius:8,padding:'10px 12px',marginTop:'1rem',fontSize:11,color:'#856404'}}>
              ⏳ {lang==='ar'
                ? 'سيتم مراجعة طلبكم وتفعيل حسابكم من طرف المشرف العام'
                : 'Votre demande sera examinée et activée par le super admin avant de pouvoir vous connecter.'}
            </div>

            {/* J11-bis : checkboxes acceptation legale */}
            <div style={{marginTop:'1.25rem',padding:'14px 14px 10px',background:'#F8F8F4',border:'0.5px solid #e0e0d8',borderRadius:10}}>
              <div style={{fontSize:11,fontWeight:700,color:'#444',letterSpacing:0.5,textTransform:'uppercase',marginBottom:10}}>
                {lang==='ar' ? '⚖️ القبول القانوني' : '⚖️ Acceptation légale'}
              </div>
              <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,color:'#444',cursor:'pointer',marginBottom:8,lineHeight:1.5}}>
                <input type="checkbox" checked={acceptCGU} onChange={e=>setAcceptCGU(e.target.checked)}
                  style={{marginTop:2,flexShrink:0,accentColor:'#1D9E75'}}/>
                <span>
                  {lang==='ar' ? 'قرأتُ وأقبل ' : 'J\'ai lu et j\'accepte les '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" style={{color:'#1D9E75',textDecoration:'underline',fontWeight:600}}>
                    {lang==='ar' ? 'الشروط العامة للاستخدام' : 'Conditions Générales d\'Utilisation'}
                  </a>
                </span>
              </label>
              <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,color:'#444',cursor:'pointer',marginBottom:8,lineHeight:1.5}}>
                <input type="checkbox" checked={acceptPrivacy} onChange={e=>setAcceptPrivacy(e.target.checked)}
                  style={{marginTop:2,flexShrink:0,accentColor:'#1D9E75'}}/>
                <span>
                  {lang==='ar' ? 'قرأتُ وأقبل ' : 'J\'ai lu et j\'accepte la '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{color:'#1D9E75',textDecoration:'underline',fontWeight:600}}>
                    {lang==='ar' ? 'سياسة الخصوصية' : 'Politique de Confidentialité'}
                  </a>
                </span>
              </label>
              <label style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,color:'#444',cursor:'pointer',lineHeight:1.5}}>
                <input type="checkbox" checked={acceptAuthority} onChange={e=>setAcceptAuthority(e.target.checked)}
                  style={{marginTop:2,flexShrink:0,accentColor:'#1D9E75'}}/>
                <span>
                  {lang==='ar'
                    ? 'أؤكد أنني أملك الصلاحية القانونية لتسجيل هذه المدرسة وبياناتها'
                    : 'Je certifie avoir l\'autorité pour inscrire cette école et ses données'}
                </span>
              </label>
            </div>
            <div style={{display:'flex',gap:10,marginTop:'1.25rem'}}>
              <button type="button" onClick={()=>{setStep(1);setError('');}}
                style={{padding:'11px 16px',background:'#f5f5f0',color:'#444',border:'0.5px solid #e0e0d8',borderRadius:10,fontWeight:600,cursor:'pointer',fontSize:13}}>
                ←
              </button>
              <button type="submit" disabled={loading || !acceptCGU || !acceptPrivacy || !acceptAuthority}
                style={{flex:1,padding:'11px',background:(loading || !acceptCGU || !acceptPrivacy || !acceptAuthority)?'#ccc':'#1D9E75',color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:(loading || !acceptCGU || !acceptPrivacy || !acceptAuthority)?'not-allowed':'pointer',fontSize:13}}>
                {loading ? '...' : (lang==='ar' ? '✓ إرسال الطلب' : '✓ Envoyer la demande')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
