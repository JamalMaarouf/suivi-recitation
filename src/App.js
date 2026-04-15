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
  const LANGS = [
    { code: 'fr', flag: '🇫🇷', label: 'FR' },
    { code: 'ar', flag: '🇸🇦', label: 'AR' },
    { code: 'en', flag: '🇬🇧', label: 'EN' },
  ];
  const currentLang = LANGS.find(l=>l.code===lang) || LANGS[0];

  const LangSelector = () => (
    <div style={{ position:'relative' }}>
      <button onClick={() => setShowLangMenu(v=>!v)}
        style={{ padding:'4px 8px', border:'1.5px solid #e0e0d8', borderRadius:6,
          background:'#fff', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:4,
          fontWeight:600, color:'#555' }}>
        {currentLang.flag} {currentLang.label} ▾
      </button>
      {showLangMenu && (
        <div style={{ position:'absolute', top:'110%', right:0, background:'#fff', border:'0.5px solid #e0e0d8',
          borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', zIndex:999, overflow:'hidden', minWidth:100 }}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }}
              style={{ display:'block', width:'100%', padding:'8px 14px', border:'none', background:lang===l.code?'#E1F5EE':'#fff',
                color:lang===l.code?'#085041':'#555', fontWeight:lang===l.code?700:400, cursor:'pointer',
                textAlign:'left', fontSize:13 }}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (!user) return (
    <ToastProvider isMobile={isMobile}>
    <LangContext.Provider value={{ lang, setLang }}>
      {showInscription
        ? <InscriptionEcole onBack={()=>setShowInscription(false)} lang={lang}/>
        : <Login onLogin={handleLogin} lang={lang} LangSelector={LangSelector} onShowInscription={()=>setShowInscription(true)}/>
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
          <nav className="top-nav">
            <div className="nav-brand" onClick={() => navigate('dashboard')}>
              <div className="nav-logo"></div>
              <span>{t(lang, 'app_name')}</span>
            </div>
            <div className="nav-right" style={{flex:1,display:'flex',alignItems:'center',gap:4,flexWrap:'nowrap',overflow:'hidden'}}>
              {/* Menus navigation */}
              <div style={{display:'flex',alignItems:'center',gap:3,flex:1,overflow:'hidden'}}>
                {[
                  {p:'validation_rapide', label:'⚡ '+t(lang,'express'),                          roles:['surveillant','instituteur']},
                  {p:'muraja',            label:'📖 '+(lang==='ar'?'مراجعة جماعية':"Muraja'a"),   roles:['surveillant','instituteur']},
                  {p:'seance',            label:'📋 '+t(lang,'seance'),                            roles:['surveillant','instituteur']},
                  {p:'rapport_mensuel',   label:'📊 '+t(lang,'rapport'),                           roles:['surveillant','instituteur']},
                  {p:'historique_seances',label:'📈 '+(lang==='ar'?'السجل':(t(lang,'historique')||'Historique')), roles:['surveillant','instituteur']},
                  {p:'resultats_examens', label:'🏅 '+(lang==='ar'?'نتائج الامتحانات':'Résultats'),roles:['surveillant','instituteur']},
                  {p:'objectifs',         label:'🎯 '+(lang==='ar'?'الأهداف':'Objectifs'),         roles:['surveillant']},
                  {p:'finance',           label:'💰 '+(lang==='ar'?'المالية':'Finance'),            roles:['surveillant']},
                  {p:'liste_certificats', label:'🏅 '+(lang==='ar'?'الشهادات':'Certificats'),      roles:['surveillant']},
                  {p:'liste_notes',       label:'⭐ '+(lang==='ar'?'النقاط':'Notes'),              roles:['surveillant']},
                  {p:'gestion',           label:'⚙️ '+t(lang,'gestion'),                           roles:['surveillant']},
                ].filter(b=>b.roles.includes(user.role)).map(b=>(
                  <button key={b.p}
                    className={`nav-btn ${page===b.p?'active':''}`}
                    style={{whiteSpace:'nowrap',padding:'4px 8px',fontSize:11}}
                    onClick={() => navigate(b.p)}>
                    {b.label}
                  </button>
                ))}
              </div>
              {/* Droite : langue + admin + logout */}
              <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                <LangSelector />
                {showInstallBtn && (
                  <button onClick={handleInstall} className="nav-btn" style={{fontSize:11,padding:'4px 8px'}}>
                    📲
                  </button>
                )}
                <button onClick={()=>navigate('profil_mobile')}
                  style={{display:'flex',alignItems:'center',gap:5,padding:'4px 8px',
                    background:'#1D9E75',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',
                    fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
                  <span style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,0.25)',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800}}>
                    {user.prenom?user.prenom[0].toUpperCase():'?'}
                  </span>
                  {user.prenom} · <em style={{fontStyle:'normal',opacity:0.85,fontSize:10}}>{t(lang, user.role==='surveillant'?'role_surveillant':'role_instituteur')}</em>
                </button>
                <button className="nav-btn nav-btn-logout" style={{fontSize:11,padding:'4px 8px'}} onClick={handleLogout}>{t(lang,'deconnexion')}</button>
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
