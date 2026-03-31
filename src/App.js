import React, { useState, useEffect } from 'react';
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
import RecitationSourate from './pages/RecitationSourate';
import GestionObjectifs from './pages/GestionObjectifs';
import ValidationRapide from './pages/ValidationRapide';
import { t, getDir } from './lib/i18n';
import { setSouratesDB } from './lib/sourates';
import { supabase } from './lib/supabase';
import './App.css';

export const LangContext = React.createContext({ lang: 'fr', setLang: () => {} });

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [selectedInstituteur, setSelectedInstituteur] = useState(null);
  const [compareEleves, setCompareEleves] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [lang, setLangRaw] = useState(() => localStorage.getItem('suivi_lang') || 'fr');

  useEffect(() => {
    const saved = localStorage.getItem('suivi_user');
    if (saved) setUser(JSON.parse(saved));
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    // Load sourates from DB for 5B/5A levels
    supabase.from('sourates').select('*').then(({ data }) => {
      if (data) setSouratesDB(data);
    });
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
  const handleLogout = () => { setUser(null); localStorage.removeItem('suivi_user'); setPage('dashboard'); };

  const navigate = (p, data = null) => {
    setPage(p);
    if (p === 'fiche' || p === 'enregistrer') setSelectedEleve(data);
    if (p === 'profil_instituteur') setSelectedInstituteur(data);
    if (p === 'comparaison') setCompareEleves(data || []);
    window.scrollTo(0, 0);
  };

  const LangSelector = () => (
    <div style={{ display: 'flex', gap: 4 }}>
      {[
        { code: 'fr', flag: '🇫🇷', label: 'Français' },
        { code: 'ar', flag: '🇸🇦', label: 'العربية' },
        { code: 'en', flag: '🇬🇧', label: 'English' },
      ].map(l => (
        <button key={l.code} onClick={() => setLang(l.code)} title={l.label}
          style={{
            padding: '4px 8px', border: `1.5px solid ${lang === l.code ? '#1D9E75' : '#e0e0d8'}`,
            borderRadius: 6, background: lang === l.code ? '#E1F5EE' : '#fff',
            fontSize: 14, cursor: 'pointer', fontWeight: lang === l.code ? 700 : 400,
            transition: 'all 0.15s'
          }}>
          {l.flag}
        </button>
      ))}
    </div>
  );

  if (!user) return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Login onLogin={handleLogin} lang={lang} LangSelector={LangSelector} />
    </LangContext.Provider>
  );

  const pageProps = { user, navigate, lang };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="app-container" dir={getDir(lang)}>

        {!isMobile && (
          <nav className="top-nav">
            <div className="nav-brand" onClick={() => navigate('dashboard')}>
              <div className="nav-logo"></div>
              <span>{t(lang, 'app_name')}</span>
            </div>
            <div className="nav-right">
              <span className="nav-user">
                {user.prenom} · <em>{t(lang, user.role === 'surveillant' ? 'role_surveillant' : 'role_instituteur')}</em>
              </span>
              <LangSelector />
              <button className="nav-btn" onClick={() => navigate('validation_rapide')}>⚡ {t(lang, 'express')}</button>
              <button className="nav-btn" onClick={() => navigate('seance')}>📋 {t(lang, 'seance')}</button>
              <button className="nav-btn" onClick={() => navigate('calendrier')}>📅 {t(lang, 'calendrier')}</button>
              {user.role === 'surveillant' && <>
                <button className="nav-btn" onClick={() => navigate('rapport_mensuel')}>📊 {t(lang, 'rapport')}</button>
                {user.role==='surveillant' && <button className="nav-btn" onClick={() => navigate('objectifs')} style={{background:'#085041',color:'#fff',fontWeight:600}}>🎯 {lang==='ar'?'الأهداف':lang==='en'?'Objectives':'Objectifs'}</button>}
                <button className="nav-btn" onClick={() => navigate('gestion')}>⚙️ {t(lang, 'gestion')}</button>
              </>}
              <button className="nav-btn nav-btn-logout" onClick={handleLogout}>{t(lang, 'deconnexion')}</button>
            </div>
          </nav>
        )}

        <main className={isMobile ? 'main-content-mobile' : 'main-content'}>
          {page === 'dashboard'         && <Dashboard {...pageProps} />}
          {page === 'fiche'             && selectedEleve   && <FicheEleve eleve={selectedEleve} {...pageProps} />}
          {page === 'objectifs'          && <GestionObjectifs user={user} navigate={navigate} lang={lang} />}
          {page === 'enregistrer'       && (
            ['5B','5A'].includes(selectedEleve?.code_niveau||'')
              ? <RecitationSourate eleve={selectedEleve} {...pageProps} />
              : <EnregistrerRecitation eleve={selectedEleve} {...pageProps} />
          )}
          {page === 'validation_rapide' && <ValidationRapide {...pageProps} />}
          {page === 'gestion'           && user.role === 'surveillant' && <Gestion {...pageProps} />}
          {page === 'honneur'           && <TableauHonneur {...pageProps} />}
          {page === 'seance'            && <Seance {...pageProps} />}
          {page === 'calendrier'        && <Calendrier {...pageProps} />}
          {page === 'profil_instituteur'&& selectedInstituteur && <ProfilInstituteur instituteur={selectedInstituteur} {...pageProps} />}
          {page === 'comparaison'       && <Comparaison eleves={compareEleves} {...pageProps} />}
          {page === 'rapport_mensuel'   && <RapportMensuel {...pageProps} />}
        </main>

        {isMobile && (
          <nav className="bottom-nav" dir={getDir(lang)}>
            {[
              { key: 'dashboard',        icon: '🏠', labelKey: 'tableau_de_bord' },
              { key: 'validation_rapide', icon: '⚡', labelKey: 'express' },
              { key: 'seance',           icon: '📋', labelKey: 'seance' },
              { key: 'calendrier',       icon: '📅', labelKey: 'calendrier' },
              { key: 'honneur',          icon: '🏆', labelKey: 'honneur' },
            ].map(tab => (
              <div key={tab.key}
                className={`bottom-nav-item ${page === tab.key ? 'active' : ''}`}
                onClick={() => navigate(tab.key)}>
                <span className="bottom-nav-icon">{tab.icon}</span>
                <span className="bottom-nav-label">{t(lang, tab.labelKey)}</span>
              </div>
            ))}
          </nav>
        )}
      </div>
    </LangContext.Provider>
  );
}
