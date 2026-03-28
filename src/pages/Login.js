import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login({ onLogin }) {
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('identifiant', identifiant.trim())
      .eq('mot_de_passe', motDePasse)
      .single();
    setLoading(false);
    if (err || !data) {
      setError('Identifiant ou mot de passe incorrect.');
      return;
    }
    onLogin(data);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f0', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', border: '0.5px solid #e0e0d8', borderRadius: 16, padding: '2rem 1.75rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1D9E75', margin: '0 auto 0.75rem' }}></div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Suivi Récitation</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Espace instituteurs & surveillance</div>
        </div>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-lbl">Identifiant</label>
            <input className="field-input" type="text" value={identifiant} onChange={e => setIdentifiant(e.target.value)} placeholder="Votre identifiant" autoComplete="username" />
          </div>
          <div className="field-group">
            <label className="field-lbl">Mot de passe</label>
            <input className="field-input" type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>
          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
          <div style={{ flex: 1, padding: 10, borderRadius: 8, border: '0.5px solid #e0e0d8', textAlign: 'center', background: '#f9f9f6' }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Surveillant</div>
            <div style={{ fontSize: 11, color: '#888' }}>Accès complet</div>
          </div>
          <div style={{ flex: 1, padding: 10, borderRadius: 8, border: '0.5px solid #e0e0d8', textAlign: 'center', background: '#f9f9f6' }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>Instituteur</div>
            <div style={{ fontSize: 11, color: '#888' }}>Validation + suivi</div>
          </div>
        </div>
      </div>
    </div>
  );
}
