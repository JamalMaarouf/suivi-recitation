import React, { useState, useEffect, useCallback, useRef } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FicheEleve from './pages/FicheEleve';
import EnregistrerRecitation from './pages/EnregistrerRecitation';
import Gestion from './pages/Gestion';
import TableauHonneur from './pages/TableauHonneur';
import Seance from './pages/Seance';
import Calendrier from './pages/Calendrier';
import ProfilInstituteur from './pages/ProfilInstituteur';
import Comparaison from './pages/Comparaison';
import RapportMensuel from './pages/RapportMensuel';
import ValidationRapide from './pages/ValidationRapide';
import { t, getDir, translateAllKeys, loadCacheIntoMemory, getCachedLangs } from './lib/i18n';
import './App.css';

export const LangContext = React.createContext({ lang: 'fr', setLang: () => {} });

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [selectedInstituteur, setSelectedInstituteur] = useState(null);
  const [compareEleves, setCompareEleves] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [lang, setLangState] = useState(() => localStorage.getItem('suivi_lang') || 'fr');
  const [translating, setTranslating] = useState(false);
  const [transReady, setTransReady] = useState(false);
  const translateTimeout = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('suivi_user');
    if (saved) setUser(JSON.parse(saved));
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    // Load cached translations into memory
    const cachedLangs = getCachedLangs();
    cachedLangs.forEach(l => loadCacheIntoMemory(l));
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setLang = useCallback(async (newLang) => {
    setLangState(newLang);
    localStorage.setItem('suivi_lang', newLang);
    document.documentElement.dir = getDir(newLang);
    document.documentElement.lang = newLang;

    if (newLang === 'fr') {
      setTransReady(true);
      return;
    }

    // Check if already cached
    const cached = loadCacheIntoMemory(newLang);
    if (cached > 20) {
      setTransReady(true);
      return;
    }

    // Translate via Claude API
    setTranslating(true);
    setTransReady(false);
    const success = await translateAllKeys(newLang);
    setTranslating(false);
    setTransReady(true);
    if (success) loadCacheIntoMemory(newLang);
  }, []);

  useEffect(() => {
    document.documentElement.dir = getDir(lang);
    document.documentElement.lang = lang;
    if (lang !== 'fr') {
      const cached = loadCacheIntoMemory(lang);
      if (cached > 20) setTransReady(true);
      else { setTranslating(true); translateAllKeys(lang).then(() => { loadCacheIntoMemory(lang); setTranslating(false); setTransReady(true); }); }
    } else { setTransReady(true); }
  }, []);

  const handleLogin = (u) => { setUser(u); localStorage.setItem('suivi_user', JSON.stringify(u)); };
  const handleLogout = () => { setUser(null); localStorage.removeItem('suivi_user'); setPage('dashboard'); };

  const navigate = (p, data = null) => {
    setPage(p);
    if (p === 'fiche' || p === 'enregistrer') setSelectedEleve(data);
    if (p === 'profil_instituteur') setSelectedInstituteur(data);
    if (p === 'comparaison') setCompareEleves(data || []);
    window.scrollTo(0, 0);
  };

  const LangSelector = () => (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {translating && (
        <span style={{ fontSize: 11, color: '#1D9E75', animation: 'pulse 1s infinite' }}>
          {t(lang, 'traduction_en_cours')}
        </span>
      )}
      {['fr', 'ar', 'en'].map(l => (
        <button key={l} onClick={() => setLang(l)} disabled={translating}
          title={l === 'fr' ? 'Français' : l === 'ar' ? 'العربية' : 'English'}
          style={{ padding: '4px 8px', border: `1.5px solid ${lang === l ? '#1D9E75' : '#e0e0d8'}`, borderRadius: 6, background: lang === l ? '#E1F5EE' : '#fff', fontSize: 14, cursor: translating ? 'wait' : 'pointer', fontWeight: lang === l ? 700 : 400, opacity: translating && lang !== l ? 0.6 : 1, transition: 'all 0.15s' }}>
          {l === 'fr' ? '🇫🇷' : l === 'ar' ? '🇸🇦' : '🇬🇧'}
        </button>
      ))}
    </div>
  );

  // Overlay during translation
  const TranslatingOverlay = () => translating ? (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>📖</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1D9E75' }}>
        {lang === 'ar' ? 'جارٍ الترجمة...' : lang === 'en' ? 'Translating...' : 'Traduction en cours...'}
      </div>
      <div style={{ fontSize: 13, color: '#888', maxWidth: 280, textAlign: 'center' }}>
        {lang === 'ar' ? 'يقوم الذكاء الاصطناعي بترجمة التطبيق كاملاً' : lang === 'en' ? 'AI is translating the entire app' : "L'IA traduit l'application en entier"}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', animation: `bounce 1.2s ${i*0.2}s infinite` }} />
        ))}
      </div>
    </div>
  ) : null;

  if (!user) return (
    <LangContext.Provider value={{ lang, setLang }}>
      <TranslatingOverlay />
      <Login onLogin={handleLogin} lang={lang} LangSelector={LangSelector} />
    </LangContext.Provider>
  );

  const dir = getDir(lang);

  const pageProps = { user, navigate, lang };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="app-container" dir={dir}>
        <TranslatingOverlay />

        {!isMobile && (
          <nav className="top-nav">
            <div className="nav-brand" onClick={() => navigate('dashboard')}>
              <div className="nav-logo"></div>
              <span>{t(lang, 'app_name')}</span>
            </div>
            <div className="nav-right">
              <span className="nav-user">{user.prenom} · <em>{t(lang, user.role === 'surveillant' ? 'role_surveillant' : 'role_instituteur')}</em></span>
              <LangSelector />
              <button className="nav-btn" onClick={() => navigate('validation_rapide')}>⚡ {t(lang, 'express')}</button>
              <button className="nav-btn" onClick={() => navigate('seance')}>📋 {t(lang, 'seance')}</button>
              <button className="nav-btn" onClick={() => navigate('calendrier')}>📅 {t(lang, 'calendrier')}</button>
              {user.role === 'surveillant' && <>
                <button className="nav-btn" onClick={() => navigate('rapport_mensuel')}>📊 {t(lang, 'rapport')}</button>
                <button className="nav-btn" onClick={() => navigate('gestion')}>⚙️ {t(lang, 'gestion')}</button>
              </>}
              <button className="nav-btn nav-btn-logout" onClick={handleLogout}>{t(lang, 'deconnexion')}</button>
            </div>
          </nav>
        )}

        <main className={isMobile ? 'main-content-mobile' : 'main-content'}>
          {page === 'dashboard' && <Dashboard {...pageProps} />}
          {page === 'fiche' && selectedEleve && <FicheEleve eleve={selectedEleve} {...pageProps} />}
          {page === 'enregistrer' && <EnregistrerRecitation eleve={selectedEleve} {...pageProps} />}
          {page === 'validation_rapide' && <ValidationRapide {...pageProps} />}
          {page === 'gestion' && user.role === 'surveillant' && <Gestion {...pageProps} />}
          {page === 'honneur' && <TableauHonneur {...pageProps} />}
          {page === 'seance' && <Seance {...pageProps} />}
          {page === 'calendrier' && <Calendrier {...pageProps} />}
          {page === 'profil_instituteur' && selectedInstituteur && <ProfilInstituteur instituteur={selectedInstituteur} {...pageProps} />}
          {page === 'comparaison' && <Comparaison eleves={compareEleves} {...pageProps} />}
          {page === 'rapport_mensuel' && <RapportMensuel {...pageProps} />}
        </main>

        {isMobile && (
          <nav className="bottom-nav" dir={dir}>
            {[
              { key: 'dashboard', icon: '🏠', labelKey: 'tableau_de_bord' },
              { key: 'validation_rapide', icon: '⚡', labelKey: 'express' },
              { key: 'seance', icon: '📋', labelKey: 'seance' },
              { key: 'calendrier', icon: '📅', labelKey: 'calendrier' },
              { key: 'honneur', icon: '🏆', labelKey: 'honneur' },
            ].map(tab => (
              <div key={tab.key} className={`bottom-nav-item ${page === tab.key ? 'active' : ''}`} onClick={() => navigate(tab.key)}>
                <span className="bottom-nav-icon">{tab.icon}</span>
                <span className="bottom-nav-label">{t(lang, tab.labelKey)}</span>
              </div>
            ))}
          </nav>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </LangContext.Provider>
  );
}
