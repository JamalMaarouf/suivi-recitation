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
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [selectedEleve, setSelectedEleve] = useState(null);
  const [selectedInstituteur, setSelectedInstituteur] = useState(null);
  const [compareEleves, setCompareEleves] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('suivi_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (u) => {
    setUser(u);
    localStorage.setItem('suivi_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('suivi_user');
    setPage('dashboard');
  };

  const navigate = (p, data = null) => {
    setPage(p);
    if (p === 'fiche' || p === 'enregistrer') setSelectedEleve(data);
    if (p === 'profil_instituteur') setSelectedInstituteur(data);
    if (p === 'comparaison') setCompareEleves(data || []);
    window.scrollTo(0, 0);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  const isMobile = window.innerWidth < 768;

  return (
    <div className="app-container">
      {/* Top nav — desktop only */}
      {!isMobile && (
        <nav className="top-nav">
          <div className="nav-brand" onClick={() => navigate('dashboard')}>
            <div className="nav-logo"></div>
            <span>Suivi Récitation</span>
          </div>
          <div className="nav-right">
            <span className="nav-user">{user.prenom} · <em>{user.role}</em></span>
            <button className="nav-btn" onClick={() => navigate('seance')}>Ma séance</button>
            <button className="nav-btn" onClick={() => navigate('calendrier')}>Calendrier</button>
            {user.role === 'surveillant' && (
              <button className="nav-btn" onClick={() => navigate('gestion')}>Gestion</button>
            )}
            <button className="nav-btn nav-btn-logout" onClick={handleLogout}>Déconnexion</button>
          </div>
        </nav>
      )}

      <main className={isMobile ? 'main-content-mobile' : 'main-content'}>
        {page === 'dashboard' && <Dashboard user={user} navigate={navigate} />}
        {page === 'fiche' && selectedEleve && <FicheEleve eleve={selectedEleve} user={user} navigate={navigate} />}
        {page === 'enregistrer' && <EnregistrerRecitation user={user} eleve={selectedEleve} navigate={navigate} />}
        {page === 'gestion' && user.role === 'surveillant' && <Gestion user={user} navigate={navigate} />}
        {page === 'honneur' && <TableauHonneur navigate={navigate} />}
        {page === 'seance' && <Seance user={user} navigate={navigate} />}
        {page === 'calendrier' && <Calendrier user={user} navigate={navigate} />}
        {page === 'profil_instituteur' && selectedInstituteur && <ProfilInstituteur instituteur={selectedInstituteur} user={user} navigate={navigate} />}
        {page === 'comparaison' && <Comparaison eleves={compareEleves} user={user} navigate={navigate} />}
      </main>

      {/* Bottom nav — mobile */}
      {isMobile && (
        <nav className="bottom-nav">
          {[
            { key: 'dashboard', icon: '🏠', label: 'Accueil' },
            { key: 'enregistrer', icon: '✍️', label: 'Valider' },
            { key: 'seance', icon: '📋', label: 'Séance' },
            { key: 'calendrier', icon: '📅', label: 'Calendrier' },
            { key: 'honneur', icon: '🏆', label: 'Honneur' },
          ].map(t => (
            <div key={t.key} className={`bottom-nav-item ${page === t.key ? 'active' : ''}`} onClick={() => navigate(t.key)}>
              <span className="bottom-nav-icon">{t.icon}</span>
              <span className="bottom-nav-label">{t.label}</span>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
