import React, { useState, useEffect, Suspense, lazy } from 'react';

// ErrorBoundary pour débogage
class DebugErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:20,background:'#FCEBEB',color:'#A32D2D',borderRadius:12,margin:20,fontFamily:'monospace',fontSize:13}}>
          <b>Erreur : </b>{this.state.error.message}<br/><br/>
          <pre style={{fontSize:11,overflow:'auto',maxHeight:300}}>{this.state.error.stack}</pre>
          <button onClick={()=>this.setState({error:null})} style={{marginTop:10,padding:'6px 14px',background:'#E24B4A',color:'#fff',border:'none',borderRadius:6,cursor:'pointer'}}>Fermer</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Pages critiques — chargées immédiatement ──────────────────────────────
import Login               from './pages/Login';
import Dashboard           from './pages/Dashboard';
import FicheEleve          from './pages/FicheEleve';
import EnregistrerRecitation from './pages/EnregistrerRecitation';
import Seance              from './pages/Seance';
import ValidationRapide    from './pages/ValidationRapide';
import PortailParent       from './pages/PortailParent';
import ProfilMobile        from './pages/ProfilMobile';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import InscriptionEcole    from './pages/InscriptionEcole';

// ── Pages secondaires — chargées à la demande (lazy) ─────────────────────
const Gestion             = lazy(() => import('./pages/Gestion'));
const TableauHonneur      = lazy(() => import('./pages/TableauHonneur'));
const Calendrier          = lazy(() => import('./pages/Calendrier'));
const ProfilInstituteur   = lazy(() => import('./pages/ProfilInstituteur'));
const Comparaison         = lazy(() => import('./pages/Comparaison'));
const RapportMensuel      = lazy(() => import('./pages/RapportMensuel'));
const RecitationSourate   = lazy(() => import('./pages/RecitationSourate'));
const GestionObjectifs    = lazy(() => import('./pages/GestionObjectifs'));
const HistoriqueSeances   = lazy(() => import('./pages/HistoriqueSeances'));
const Finance             = lazy(() => import('./pages/Finance'));
const ValidationCollective= lazy(() => import('./pages/ValidationCollective'));
const MurajaDashboard     = lazy(() => import('./pages/MurajaDashboard'));
const ElevesInactifs      = lazy(() => import('./pages/ElevesInactifs'));
const GestionNiveaux      = lazy(() => import('./pages/GestionNiveaux'));
const GestionExamens      = lazy(() => import('./pages/GestionExamens'));
const GestionEnsembles    = lazy(() => import('./pages/GestionEnsembles'));
const GestionBlocs        = lazy(() => import('./pages/GestionBlocs'));
const ResultatsExamens    = lazy(() => import('./pages/ResultatsExamens'));
const ListeCertificats    = lazy(() => import('./pages/ListeCertificats'));
const ListeNotes          = lazy(() => import('./pages/ListeNotes'));
import { t, getDir } from './lib/i18n';
import { isSourateNiveauDyn } from './lib/helpers';
import { ToastProvider } from './lib/toast';
import { supabase } from './lib/supabase';
import './App.css';

// PWA Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App Error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:20,background:'#fff',color:'#E24B4A',fontFamily:'Arial'}}>
          <h2>🚨 Erreur de rendu</h2>
          <pre style={{fontSize:12,background:'#f5f5f5',padding:10,borderRadius:8,overflowX:'auto'}}>
            {this.state.error.toString()}
          </pre>
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button onClick={()=>this.setState({error:null})} style={{padding:'6px 12px',cursor:'pointer',borderRadius:6,border:'1px solid #ccc'}}>
              🔄 Réessayer
            </button>
            <button onClick={()=>{this.setState({error:null});window.history.back();}} style={{padding:'6px 12px',cursor:'pointer',borderRadius:6,border:'1px solid #ccc',background:'#f5f5f0'}}>
              ← Retour
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


export const LangContext = React.createContext({ lang: 'fr', setLang: () => {} });

export default function App() {
  const [user, setUser] = useState(null);
  const [niveauxApp, setNiveauxApp] = useState([]);
  const [showInscription, setShowInscription] = useState(false);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const checkInstall = () => setShowInstallBtn(!!deferredPrompt);
    checkInstall();
    window.addEventListener('appinstalled', () => setShowInstallBtn(false));
  }, []);

  const [page, setPage] = useState('dashboard');
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [selectedInstituteur, setSelectedInstituteur] = useState(null);
  const [compareEleves, setCompareEleves] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [lang, setLangRaw] = useState(() => localStorage.getItem('suivi_lang') || 'fr');
  const [navHistory, setNavHistory] = useState([]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { deferredPrompt = null; setShowInstallBtn(false); }
  };
  const pageRef = React.useRef('dashboard');
  const setPageWithRef = (p) => { pageRef.current = p; setPage(p); };

  useEffect(() => {
    const saved = localStorage.getItem('suivi_user');
    if (saved) setUser(JSON.parse(saved));
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setLang = (newLang) => {
    setLangRaw(newLang);
    localStorage.setItem('suivi_lang', newLang);
    document.documentElement.dir = getDir(newLang);
    document.documentElement.lang = newLang;
  };

  useEffect(() => {
    document.documentElement.dir = getDir(lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const handleLogin = (u) => { setUser(u); localStorage.setItem('suivi_user', JSON.stringify(u)); };
  const handleLogout = () => { setUser(null); localStorage.removeItem('suivi_user'); setPageWithRef('dashboard'); };


  const navigate = (p, data = null) => {
    // Save current page to history before navigating
    setNavHistory(h => [...h.slice(-19), { page: pageRef.current, selectedEleve, selectedInstituteur }]);
    setPageWithRef(p);
    if (p === 'fiche' || p === 'enregistrer') setSelectedEleve(data);
    if (p === 'profil_instituteur') setSelectedInstituteur(data);
    if (p === 'comparaison') setCompareEleves(data || []);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (navHistory.length === 0) { setPageWithRef('dashboard'); return; }
    const prev = navHistory[navHistory.length - 1];
    setNavHistory(h => h.slice(0, -1));
    setPageWithRef(prev.page);
    if (prev.selectedEleve !== undefined) setSelectedEleve(prev.selectedEleve);
    if (prev.selectedInstituteur !== undefined) setSelectedInstituteur(prev.selectedInstituteur);
    window.scrollTo(0, 0);
  };

  const [showLangMenu, setShowLangMenu] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const LANGS = [
    { code: 'fr', flag: '🇫🇷', label: 'FR' },
    { code: 'ar', flag: '🇸🇦', label: 'AR' },
    { code: 'en', flag: '🇬🇧', label: 'EN' },
  ];

  if (!user) return (
    <ToastProvider isMobile={isMobile}>
    <LangContext.Provider value={{ lang, setLang }}>
      {showInscription
        ? <InscriptionEcole onBack={()=>setShowInscription(false)} lang={lang}/>
        : <Login onLogin={handleLogin} lang={lang} LangSelector={() => (
            <div style={{display:'flex',gap:4}}>
              {LANGS.map(l=>(
                <button key={l.code} onClick={()=>setLang(l.code)} title={l.label}
                  style={{padding:'4px 8px',border:`1.5px solid ${lang===l.code?'#1D9E75':'#e0e0d8'}`,
                    borderRadius:6,background:lang===l.code?'#E1F5EE':'#fff',
                    fontSize:14,cursor:'pointer',fontWeight:lang===l.code?700:400}}>
                  {l.flag}
                </button>
              ))}
            </div>
          )} onShowInscription={()=>setShowInscription(true)}/>
      }
    </LangContext.Provider>
    </ToastProvider>
  );

  // Super admin → dashboard dédié
  if (user.role === 'super_admin') return (
    <ToastProvider isMobile={isMobile}>
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="app-container">
        <SuperAdminDashboard user={user} navigate={navigate} lang={lang} onLogout={handleLogout}/>
      </div>
    </LangContext.Provider>
    </ToastProvider>
  );

  const pageProps = { user, navigate, goBack, lang, isMobile };

  return (
    <ToastProvider isMobile={isMobile}>
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="app-container" dir={getDir(lang)}>

        {!isMobile && user.role !== 'parent' && (
          <nav style={{background:'#fff',borderBottom:'0.5px solid #e0e0d8',position:'sticky',top:0,zIndex:200}}>

            {/* ═══ LIGNE 1 : Langue gauche + Profil droite (fonctionne en RTL et LTR) ═══ */}
            <div style={{display:'flex',alignItems:'center',height:52,padding:'0 1.5rem',borderBottom:'0.5px solid #f0f0ec',gap:12}}>

              {/* Langue — tout à gauche */}
              <div style={{position:'relative',flexShrink:0}}>
                <button onClick={e=>{e.stopPropagation();setShowLangMenu(v=>!v);setShowUserMenu(false);}}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',
                    border:'1px solid #e0e0d8',borderRadius:8,background:'#f9f9f6',
                    fontSize:12,cursor:'pointer',fontWeight:600,color:'#555'}}>
                  <span style={{fontSize:15}}>{LANGS.find(l=>l.code===lang)?.flag||'🇫🇷'}</span>
                  <span>{(lang||'fr').toUpperCase()}</span>
                  <span style={{fontSize:9,color:'#aaa'}}>▾</span>
                </button>
                {showLangMenu && (
                  <div style={{position:'absolute',top:'calc(100% + 6px)',left:0,background:'#fff',
                    border:'0.5px solid #e0e0d8',borderRadius:10,
                    boxShadow:'0 12px 32px rgba(0,0,0,0.12)',zIndex:99999,overflow:'hidden',minWidth:140}}>
                    {LANGS.map(l=>(
                      <button key={l.code} onClick={()=>{setLang(l.code);setShowLangMenu(false);}}
                        style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 16px',
                          border:'none',borderLeft:lang===l.code?'3px solid #1D9E75':'3px solid transparent',
                          background:lang===l.code?'#E1F5EE':'#fff',
                          color:lang===l.code?'#085041':'#555',
                          fontWeight:lang===l.code?700:400,cursor:'pointer',fontSize:13}}>
                        <span style={{fontSize:16}}>{l.flag}</span> {l.label}
                        {lang===l.code && <span style={{marginLeft:'auto',color:'#1D9E75',fontSize:11}}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Espace flex — pousse le profil à droite */}
              <div style={{flex:1}} />

              {/* Install btn si dispo */}
              {showInstallBtn && (
                <button onClick={handleInstall}
                  style={{padding:'5px 9px',border:'1px solid #e0e0d8',borderRadius:8,fontSize:11,cursor:'pointer',background:'#f9f9f6',color:'#888',flexShrink:0}}>
                  📲
                </button>
              )}

              {/* Profil — tout à droite */}
              <div style={{position:'relative',flexShrink:0}}>
                <button onClick={e=>{e.stopPropagation();setShowUserMenu(v=>!v);setShowLangMenu(false);}}
                  style={{display:'flex',alignItems:'center',gap:8,padding:'5px 12px 5px 5px',
                    background:'linear-gradient(135deg,#085041,#1D9E75)',
                    border:'none',borderRadius:22,cursor:'pointer',
                    boxShadow:'0 3px 10px rgba(8,80,65,0.25)'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',
                    background:'rgba(255,255,255,0.22)',border:'1.5px solid rgba(255,255,255,0.4)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:13,fontWeight:900,color:'#fff',flexShrink:0}}>
                    {user.prenom?user.prenom[0].toUpperCase():'?'}
                  </div>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:'#fff',lineHeight:1.3,whiteSpace:'nowrap'}}>
                      {user.prenom} {user.nom?.split(' ')[0]}
                    </div>
                    <div style={{fontSize:9,color:'rgba(255,255,255,0.7)',lineHeight:1,whiteSpace:'nowrap'}}>
                      {t(lang,user.role==='surveillant'?'role_surveillant':'role_instituteur')}
                    </div>
                  </div>
                  <span style={{color:'rgba(255,255,255,0.5)',fontSize:9}}>▾</span>
                </button>
                {showUserMenu && (
                  <div style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'#fff',
                    border:'0.5px solid #e0e0d8',borderRadius:14,
                    boxShadow:'0 12px 32px rgba(0,0,0,0.14)',zIndex:99999,minWidth:220,overflow:'hidden'}}>
                    <div style={{padding:'16px',background:'linear-gradient(135deg,#085041,#1D9E75)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{width:42,height:42,borderRadius:'50%',
                          background:'rgba(255,255,255,0.2)',border:'2px solid rgba(255,255,255,0.4)',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:18,fontWeight:900,color:'#fff',flexShrink:0}}>
                          {user.prenom?user.prenom[0].toUpperCase():'?'}
                        </div>
                        <div>
                          <div style={{fontWeight:800,fontSize:14,color:'#fff'}}>{user.prenom} {user.nom}</div>
                          <div style={{fontSize:10,color:'rgba(255,255,255,0.75)',marginTop:2,
                            background:'rgba(255,255,255,0.15)',padding:'1px 8px',borderRadius:10,display:'inline-block'}}>
                            {t(lang,user.role==='surveillant'?'role_surveillant':'role_instituteur')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{padding:'6px 0'}}>
                      <button onClick={()=>{setShowUserMenu(false);navigate('profil_mobile');}}
                        style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'11px 16px',
                          border:'none',background:'#fff',color:'#333',cursor:'pointer',fontSize:13}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f5f5f0'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                        <span style={{width:28,height:28,borderRadius:8,background:'#E1F5EE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>👤</span>
                        <span>{lang==='ar'?'الملف الشخصي':'Mon profil'}</span>
                      </button>
                      <div style={{height:'0.5px',background:'#f0f0ec',margin:'4px 16px'}}/>
                      <button onClick={()=>{setShowUserMenu(false);handleLogout();}}
                        style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'11px 16px',
                          border:'none',background:'#fff',color:'#E24B4A',cursor:'pointer',fontSize:13}}
                        onMouseEnter={e=>e.currentTarget.style.background='#fff5f5'}
                        onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                        <span style={{width:28,height:28,borderRadius:8,background:'#FCEBEB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🚪</span>
                        <span>{t(lang,'deconnexion')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ LIGNE 2 : Menus + Logo متابعة à droite ═══ */}
            <div style={{display:'flex',alignItems:'center',overflowX:'auto',scrollbarWidth:'none',
              background:'linear-gradient(to bottom,#fafafa,#fff)'}}
              onClick={()=>{setShowLangMenu(false);setShowUserMenu(false);}}>

              {/* Menus scrollables */}
              <div style={{display:'flex',alignItems:'center',gap:0,padding:'0 8px',whiteSpace:'nowrap',flex:1}}>
                {[
                  {p:'validation_rapide', icon:'⚡', text:t(lang,'express'),                                          roles:['surveillant','instituteur']},
                  {p:'muraja',            icon:'📖', text:lang==='ar'?'مراجعة جماعية':"Muraja'a",                     roles:['surveillant','instituteur']},
                  {p:'seance',            icon:'📋', text:t(lang,'seance'),                                           roles:['surveillant','instituteur']},
                  {p:'calendrier',        icon:'📅', text:t(lang,'calendrier'),                                       roles:['surveillant','instituteur']},
                  {p:'rapport_mensuel',   icon:'📊', text:t(lang,'rapport'),                                          roles:['surveillant','instituteur']},
                  {p:'historique_seances',icon:'📈', text:t(lang,'historique')||'Historique',                         roles:['surveillant','instituteur']},
                  {p:'resultats_examens', icon:'🏅', text:lang==='ar'?'نتائج الامتحانات':'Résultats',                 roles:['surveillant','instituteur']},
                  {p:'objectifs',         icon:'🎯', text:lang==='ar'?'الأهداف':lang==='en'?'Objectives':'Objectifs', roles:['surveillant']},
                  {p:'finance',           icon:'💰', text:lang==='ar'?'المالية':'Finance',                            roles:['surveillant']},
                  {p:'liste_certificats', icon:'🏅', text:lang==='ar'?'الشهادات':'Certificats',                       roles:['surveillant']},
                  {p:'liste_notes',       icon:'⭐', text:lang==='ar'?'النقاط':'Notes',                               roles:['surveillant']},
                  {p:'gestion',           icon:'⚙️', text:t(lang,'gestion'),                                          roles:['surveillant']},
                ].filter(b=>b.roles.includes(user.role)).map(b=>{
                  const isActive = page===b.p;
                  return (
                    <button key={b.p} onClick={() => navigate(b.p)}
                      style={{display:'flex',alignItems:'center',gap:5,padding:'9px 11px',
                        border:'none',borderBottom:isActive?'2.5px solid #1D9E75':'2.5px solid transparent',
                        background:'transparent',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
                        color:isActive?'#085041':'#666',fontWeight:isActive?700:400,fontSize:12,
                        transition:'color 0.15s'}}>
                      <span style={{fontSize:13}}>{b.icon}</span>
                      <span>{b.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Logo متابعة التحفيظ — à droite des menus */}
              <div onClick={() => navigate('dashboard')}
                style={{display:'flex',alignItems:'center',gap:8,padding:'6px 16px',
                  cursor:'pointer',flexShrink:0,borderLeft:'1px solid #f0f0ec',marginLeft:'auto'}}>
                <div style={{width:26,height:26,borderRadius:7,
                  background:'linear-gradient(135deg,#1D9E75,#085041)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>
                  📖
                </div>
                <div style={{lineHeight:1.2,textAlign:'right'}}>
                  <div style={{fontSize:11,fontWeight:800,color:'#085041',whiteSpace:'nowrap'}}>متابعة التحفيظ</div>
                  <div style={{fontSize:8,color:'#aaa',whiteSpace:'nowrap'}}>{t(lang,'app_name')}</div>
                </div>
              </div>
            </div>
          </nav>
        )}

        <main className={isMobile ? 'main-content-mobile' : 'main-content'}>
          {user.role === 'parent' && <ErrorBoundary><PortailParent parent={user} navigate={navigate} goBack={goBack} lang={lang} onLogout={handleLogout} /></ErrorBoundary>}
          {user.role !== 'parent' && <>
          <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'3rem',color:'#888',fontSize:13}}><span style={{marginRight:8}}>⏳</span>{lang==='ar'?'جاري التحميل...':'Chargement...'}</div>}>
          {page === 'dashboard'         && <Dashboard {...pageProps} />}
          {page === 'fiche'             && (selectedEleve
            ? <ErrorBoundary><FicheEleve eleve={selectedEleve} {...pageProps} /></ErrorBoundary>
            : <div style={{padding:'2rem',textAlign:'center'}}>
                <div className="loading">...</div>
                <button onClick={()=>goBack?goBack():setPageWithRef('dashboard')} className="back-link" style={{marginTop:'1rem'}}>← Retour</button>
              </div>
          )}
          {page === 'objectifs'          && <ErrorBoundary><GestionObjectifs user={user} navigate={navigate} goBack={goBack} lang={lang} isMobile={isMobile} /></ErrorBoundary>}
          {page === 'historique_seances'   && <ErrorBoundary><HistoriqueSeances user={user} navigate={navigate} goBack={goBack} lang={lang} isMobile={isMobile} /></ErrorBoundary>}
          {page === 'finance'             && user.role==='surveillant' && <ErrorBoundary><Finance user={user} navigate={navigate} goBack={goBack} lang={lang} isMobile={isMobile} /></ErrorBoundary>}
          {page === 'enregistrer'       && (
            isSourateNiveauDyn(selectedEleve?.code_niveau||'', niveauxApp)
              ? <RecitationSourate eleve={selectedEleve} {...pageProps} />
              : <EnregistrerRecitation eleve={selectedEleve} {...pageProps} />
          )}
          {page === 'muraja'            && <ValidationCollective {...pageProps} />}
          {page === 'inactifs'           && <ElevesInactifs navigate={navigate} goBack={goBack} lang={lang} user={user} isMobile={isMobile} />}
          {page === 'muraja_dashboard'  && <MurajaDashboard {...pageProps} />}
          {page === 'profil_mobile'    && <ProfilMobile user={user} lang={lang} onLogout={handleLogout} navigate={navigate} goBack={goBack} isMobile={isMobile}/>}
          {page === 'validation_rapide' && <ValidationRapide {...pageProps} />}
          {page === 'honneur'           && <TableauHonneur {...pageProps} />}
          {page === 'seance'            && <Seance {...pageProps} />}
          {page === 'calendrier'        && <Calendrier {...pageProps} />}
          {page === 'profil_instituteur'&& selectedInstituteur && <ProfilInstituteur instituteur={selectedInstituteur} {...pageProps} />}
          {page === 'comparaison'       && <Comparaison eleves={compareEleves} {...pageProps} />}
          {page === 'rapport_mensuel'   && <RapportMensuel {...pageProps} />}
          {page === 'gestion'           && <Gestion {...pageProps} />}
          {page === 'niveaux'           && user.role === 'surveillant' && <GestionNiveaux {...pageProps} />}
          {page === 'ensembles'         && user.role === 'surveillant' && <GestionEnsembles {...pageProps} />}
          {page === 'examens'           && user.role === 'surveillant' && <GestionExamens {...pageProps} />}
          {page === 'blocs'             && user.role === 'surveillant' && <GestionBlocs {...pageProps} />}
          {page === 'resultats_examens' && <ResultatsExamens {...pageProps} data={selectedEleve} />}
          {page === 'liste_certificats' && <ErrorBoundary><Suspense fallback={<div className="loading">...</div>}><ListeCertificats {...pageProps} /></Suspense></ErrorBoundary>}
          {page === 'liste_notes'       && <ErrorBoundary><Suspense fallback={<div className="loading">...</div>}><ListeNotes       {...pageProps} /></Suspense></ErrorBoundary>}
          </Suspense>
          </>
          }
        </main>

        {isMobile && user.role !== 'parent' && (
          <nav className="bottom-nav" dir={getDir(lang)}>
            {(user.role === 'surveillant' ? [
              { key: 'dashboard',        icon: '🏠', label: lang==='ar'?'الرئيسية':'Accueil' },
              { key: 'seance',           icon: '📋', label: lang==='ar'?'الحصة':'Séances' },
              { key: 'validation_rapide',icon: '⚡', label: lang==='ar'?'استظهار':'Express' },
              { key: 'honneur',          icon: '🏆', label: lang==='ar'?'شرف':'Honneur' },
              { key: 'profil_mobile',    icon: '👤', label: lang==='ar'?'حسابي':'Profil' },
            ] : user.role === 'instituteur' ? [
              { key: 'dashboard',        icon: '🏠', label: lang==='ar'?'الرئيسية':'Accueil' },
              { key: 'seance',           icon: '📋', label: lang==='ar'?'الحصة':'Séances' },
              { key: 'validation_rapide',icon: '⚡', label: lang==='ar'?'استظهار':'Valider' },
              { key: 'resultats_examens',icon: '🏅', label: lang==='ar'?'نتائج':'Résultats' },
              { key: 'profil_mobile',    icon: '👤', label: lang==='ar'?'حسابي':'Profil' },
            ] : [
              { key: 'dashboard',        icon: '🏠', label: lang==='ar'?'الرئيسية':'Accueil' },
              { key: 'seance',           icon: '📋', label: lang==='ar'?'الحصة':'Séances' },
              { key: 'validation_rapide',icon: '⚡', label: lang==='ar'?'استظهار':'Express' },
              { key: 'honneur',          icon: '🏆', label: lang==='ar'?'شرف':'Honneur' },
              { key: 'profil_mobile',    icon: '👤', label: lang==='ar'?'حسابي':'Profil' },
            ]).map(tab => (
              <div key={tab.key}
                className={`bottom-nav-item ${page === tab.key ? 'active' : ''}`}
                onClick={() => navigate(tab.key)}>
                <span className="bottom-nav-icon">{tab.icon}</span>
                <span className="bottom-nav-label">{tab.label}</span>
              </div>
            ))}
          </nav>
        )}
      </div>
    </LangContext.Provider>
    </ToastProvider>
  );
}
