import React, { useState, useEffect, useRef } from 'react';

// Cloudflare Turnstile : Site Key publique (peut etre dans le code).
// Active uniquement sur tartily.com (Prod). Sur vercel.app (QA), Turnstile
// n'est pas verifie cote frontend (le widget ne se charge pas), et le
// backend recoit token='bypass' pour autoriser quand meme l'inscription.
const TURNSTILE_SITE_KEY = '0x4AAAAAADWGV3YzG2tM4c_H';

// Detection : sommes-nous sur Prod (Turnstile actif) ou QA/local (bypass) ?
// Turnstile n'accepte que tartily.com cote Cloudflare donc on bypass ailleurs.
function isTurnstileActive() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'tartily.com' || host === 'www.tartily.com';
}

export default function InscriptionEcole({ onBack, lang }) {
  const [form, setForm] = useState({ nom:'', ville:'', pays:'Maroc', telephone:'', email:'', identifiant:'', mot_de_passe:'', prenom_surveillant:'', nom_surveillant:'' });
  const [step, setStep] = useState(1); // 1=infos école, 2=compte surveillant, 3=succès
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // J11-bis : acceptation legale (RGPD + CGU)
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAuthority, setAcceptAuthority] = useState(false);

  // ── Turnstile (CAPTCHA) ─────────────────────────────────────────────
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  // Chargement du script Turnstile + rendu du widget invisible (Prod uniquement)
  // Le widget div n'existe dans le DOM que lorsque step === 2, donc on ne peut
  // pas le rendre au mount. Solution : observer step et rendre quand step=2.
  useEffect(() => {
    if (!isTurnstileActive()) {
      // QA / local dev : pas de Turnstile, on envoie 'bypass' au backend
      setCaptchaToken('bypass');
      return;
    }

    // Charger le script Turnstile une seule fois (idempotent)
    const scriptId = 'cf-turnstile-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Le widget div n'apparait que lorsque step === 2
    // Donc on attend que step === 2 ET que turnstileRef.current soit non-null
    if (step !== 2) return;

    // Render explicite du widget une fois le script charge ET le div present
    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setCaptchaToken(token),
          'error-callback': () => setCaptchaToken(''),
          'expired-callback': () => setCaptchaToken(''),
          theme: 'light',
          size: 'normal',
        });
      } else if (!window.turnstile || !turnstileRef.current) {
        // Attendre que le script se charge OU que le div soit monte
        setTimeout(tryRender, 200);
      }
    };
    tryRender();

    // Cleanup quand on quitte l'etape 2 ou unmount
    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [step]);

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

    // Verification CAPTCHA (Turnstile) - actif sur Prod uniquement
    if (isTurnstileActive() && !captchaToken) {
      setError(lang==='ar'
        ? 'يرجى الانتظار حتى ينتهي التحقق الأمني...'
        : 'Veuillez patienter le temps de la vérification de sécurité...');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // REFACTOR (mai 2026) : appel a l'API /api/inscription au lieu d'appeler
      // directement Supabase. L'API serveur :
      // - Applique un rate-limit par IP (5/h + 20/24h) anti-spam
      // - Verifie le CAPTCHA Turnstile (Prod) ou bypass (QA)
      // - Hash le mot de passe avec bcrypt (au lieu de stocker en clair)
      // - Verifie l'unicite de l'identifiant cote serveur (pas falsifiable)
      // - Fait les INSERT en atomique avec rollback si echec
      const response = await fetch('/api/inscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom.trim(),
          ville: form.ville.trim(),
          pays: form.pays,
          telephone: form.telephone || null,
          email: form.email || null,
          prenom_surveillant: form.prenom_surveillant.trim(),
          nom_surveillant: form.nom_surveillant.trim() || '',
          identifiant: form.identifiant.trim(),
          mot_de_passe: form.mot_de_passe,
          cgu_accepted: acceptCGU,
          privacy_accepted: acceptPrivacy,
          captcha_token: captchaToken,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Gestion des erreurs serveur avec messages adaptes
        if (response.status === 429) {
          // Rate-limit depasse (Q4=b : message avec canal de sortie)
          setError(lang === 'ar'
            ? 'لقد تجاوزتم عدد التسجيلات المسموح به. إذا كنتم مدرسة قرآنية شرعية، يرجى التواصل معنا على contact@tartily.com'
            : 'Vous avez dépassé la limite d\'inscriptions autorisées. Si vous êtes une école coranique légitime, veuillez nous contacter à contact@tartily.com');
        } else if (data.error === 'identifiant_taken') {
          setError(lang === 'ar' ? 'هذا المعرف مستخدم بالفعل' : 'Cet identifiant est déjà utilisé.');
        } else if (data.error === 'password_too_short') {
          setError(lang === 'ar' ? 'كلمة المرور يجب أن تحتوي على 6 أحرف على الأقل' : 'Le mot de passe doit contenir au moins 6 caractères.');
        } else if (data.error === 'legal_not_accepted') {
          setError(lang === 'ar'
            ? 'يجب قبول الشروط العامة وسياسة الخصوصية للمتابعة'
            : 'Vous devez accepter les CGU et la Politique de Confidentialité pour continuer.');
        } else if (data.error === 'missing_fields') {
          setError(lang === 'ar' ? 'يرجى ملء جميع الحقول الإلزامية' : 'Veuillez remplir tous les champs obligatoires.');
        } else {
          // Erreur generique
          setError((lang === 'ar' ? 'خطأ: ' : 'Erreur : ') + (data.message || 'inscription_failed'));
        }
        setLoading(false);
        return;
      }

      // Succes : passage a l'ecran de confirmation
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

            {/* Cloudflare Turnstile (CAPTCHA invisible) - Prod uniquement */}
            {isTurnstileActive() && (
              <div style={{marginTop:'1rem',display:'flex',justifyContent:'center'}}>
                <div ref={turnstileRef}></div>
              </div>
            )}

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
