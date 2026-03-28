import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FicheEleve from './pages/FicheEleve';
import EnregistrerRecitation from './pages/EnregistrerRecitation';
import Gestion from './pages/Gestion';
import TableauHonneur from './pages/TableauHonneur';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [selectedEleve, setSelectedEleve] = useState(null);

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

  const navigate = (p, eleve = null) => {
    setPage(p);
    if (eleve) setSelectedEleve(eleve);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-container">
      <nav className="top-nav">
        <div className="nav-brand" onClick={() => navigate('dashboard')}>
          <div className="nav-logo"></div>
          <span>Suivi Récitation</span>
        </div>
        <div className="nav-right">
          <span className="nav-user">{user.prenom} · <em>{user.role}</em></span>
          {user.role === 'surveillant' && (
            <button className="nav-btn" onClick={() => navigate('gestion')}>Gestion</button>
          )}
          <button className="nav-btn nav-btn-logout" onClick={handleLogout}>Déconnexion</button>
        </div>
      </nav>

      <main className="main-content">
        {page === 'dashboard' && (
          <Dashboard user={user} navigate={navigate} />
        )}
        {page === 'fiche' && selectedEleve && (
          <FicheEleve eleve={selectedEleve} user={user} navigate={navigate} />
        )}
        {page === 'enregistrer' && (
          <EnregistrerRecitation user={user} eleve={selectedEleve} navigate={navigate} />
        )}
        {page === 'gestion' && user.role === 'surveillant' && (
          <Gestion user={user} navigate={navigate} />
        )}
        {page === 'honneur' && (
          <TableauHonneur navigate={navigate} />
        )}
      </main>
    </div>
  );
}
