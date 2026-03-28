import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getInitiales } from '../lib/helpers';

export default function Gestion({ user, navigate }) {
  const [tab, setTab] = useState('eleves');
  const [eleves, setEleves] = useState([]);
  const [instituteurs, setInstituteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [newEleve, setNewEleve] = useState({ prenom: '', nom: '', niveau: 'Débutant', instituteur_referent_id: '', hizb_depart: 1, tomon_depart: 1 });
  const [newInst, setNewInst] = useState({ prenom: '', nom: '', identifiant: '', mot_de_passe: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: e } = await supabase.from('eleves').select('*').order('nom');
    const { data: i } = await supabase.from('utilisateurs').select('*').eq('role', 'instituteur').order('nom');
    setEleves(e || []);
    setInstituteurs(i || []);
    setLoading(false);
  };

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

  const ajouterEleve = async () => {
    if (!newEleve.prenom || !newEleve.nom) return showMsg('error', 'Prénom et nom obligatoires.');
    const { error } = await supabase.from('eleves').insert({
      prenom: newEleve.prenom, nom: newEleve.nom, niveau: newEleve.niveau,
      instituteur_referent_id: newEleve.instituteur_referent_id || null,
      hizb_depart: parseInt(newEleve.hizb_depart) || 1,
      tomon_depart: parseInt(newEleve.tomon_depart) || 1
    });
    if (error) return showMsg('error', 'Erreur lors de l\'ajout.');
    showMsg('success', 'Élève ajouté avec succès.');
    setNewEleve({ prenom: '', nom: '', niveau: 'Débutant', instituteur_referent_id: '', hizb_depart: 1, tomon_depart: 1 });
    loadData();
  };

  const supprimerEleve = async (id) => {
    if (!window.confirm('Supprimer cet élève et tout son historique ?')) return;
    await supabase.from('validations').delete().eq('eleve_id', id);
    await supabase.from('eleves').delete().eq('id', id);
    showMsg('success', 'Élève retiré.');
    loadData();
  };

  const ajouterInstituteur = async () => {
    if (!newInst.prenom || !newInst.nom || !newInst.identifiant || !newInst.mot_de_passe)
      return showMsg('error', 'Tous les champs sont obligatoires.');
    const { error } = await supabase.from('utilisateurs').insert({
      prenom: newInst.prenom, nom: newInst.nom,
      identifiant: newInst.identifiant, mot_de_passe: newInst.mot_de_passe,
      role: 'instituteur'
    });
    if (error) return showMsg('error', error.message.includes('unique') ? 'Identifiant déjà utilisé.' : 'Erreur lors de l\'ajout.');
    showMsg('success', 'Instituteur ajouté avec succès.');
    setNewInst({ prenom: '', nom: '', identifiant: '', mot_de_passe: '' });
    loadData();
  };

  const supprimerInstituteur = async (id) => {
    if (!window.confirm('Supprimer cet instituteur ?')) return;
    await supabase.from('instituteurs').delete().eq('id', id);
    await supabase.from('utilisateurs').delete().eq('id', id);
    showMsg('success', 'Instituteur retiré.');
    loadData();
  };

  const instNom = (id) => {
    const i = instituteurs.find(x => x.id === id);
    return i ? `${i.prenom} ${i.nom}` : '—';
  };

  return (
    <div>
      <div className="page-title">Gestion</div>
      {msg.text && <div className={msg.type === 'error' ? 'error-box' : 'success-box'}>{msg.text}</div>}

      <div className="tabs-row">
        <div className={`tab ${tab === 'eleves' ? 'active' : ''}`} onClick={() => setTab('eleves')}>Élèves</div>
        <div className={`tab ${tab === 'instituteurs' ? 'active' : ''}`} onClick={() => setTab('instituteurs')}>Instituteurs</div>
      </div>

      {tab === 'eleves' && (
        <div>
          <div className="section-label">Ajouter un élève</div>
          <div className="card">
            <div className="form-grid">
              <div className="field-group">
                <label className="field-lbl">Prénom</label>
                <input className="field-input" value={newEleve.prenom} onChange={e => setNewEleve({ ...newEleve, prenom: e.target.value })} placeholder="Prénom" />
              </div>
              <div className="field-group">
                <label className="field-lbl">Nom</label>
                <input className="field-input" value={newEleve.nom} onChange={e => setNewEleve({ ...newEleve, nom: e.target.value })} placeholder="Nom" />
              </div>
              <div className="field-group">
                <label className="field-lbl">Niveau</label>
                <select className="field-select" value={newEleve.niveau} onChange={e => setNewEleve({ ...newEleve, niveau: e.target.value })}>
                  <option>Débutant</option>
                  <option>Intermédiaire</option>
                  <option>Avancé</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-lbl">Instituteur référent</label>
                <select className="field-select" value={newEleve.instituteur_referent_id} onChange={e => setNewEleve({ ...newEleve, instituteur_referent_id: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {instituteurs.map(i => <option key={i.id} value={i.id}>{i.prenom} {i.nom}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-lbl">Hizb de départ (1-60)</label>
                <input className="field-input" type="number" min="1" max="60" value={newEleve.hizb_depart} onChange={e => setNewEleve({ ...newEleve, hizb_depart: e.target.value })} />
              </div>
              <div className="field-group">
                <label className="field-lbl">Tomon de départ</label>
                <select className="field-select" value={newEleve.tomon_depart} onChange={e => setNewEleve({ ...newEleve, tomon_depart: e.target.value })}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <button className="btn-primary" onClick={ajouterEleve}>+ Ajouter l'élève</button>
          </div>

          <div className="section-label">Élèves inscrits ({eleves.length})</div>
          {loading ? <div className="loading">Chargement...</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Élève</th>
                    <th style={{ width: '18%' }}>Niveau</th>
                    <th style={{ width: '22%' }}>Référent</th>
                    <th style={{ width: '18%' }}>Départ</th>
                    <th style={{ width: '12%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eleves.length === 0 && <tr><td colSpan={5} className="empty">Aucun élève.</td></tr>}
                  {eleves.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitiales(e.prenom, e.nom)}</div>
                          {e.prenom} {e.nom}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${e.niveau === 'Avancé' ? 'badge-green' : e.niveau === 'Intermédiaire' ? 'badge-blue' : 'badge-amber'}`}>{e.niveau}</span>
                      </td>
                      <td style={{ fontSize: 12, color: '#888' }}>{instNom(e.instituteur_referent_id)}</td>
                      <td style={{ fontSize: 12, color: '#888' }}>Hizb {e.hizb_depart}, T.{e.tomon_depart}</td>
                      <td>
                        <button className="action-btn danger" onClick={() => supprimerEleve(e.id)}>Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'instituteurs' && (
        <div>
          <div className="section-label">Ajouter un instituteur</div>
          <div className="card">
            <div className="form-grid">
              <div className="field-group">
                <label className="field-lbl">Prénom</label>
                <input className="field-input" value={newInst.prenom} onChange={e => setNewInst({ ...newInst, prenom: e.target.value })} placeholder="Prénom" />
              </div>
              <div className="field-group">
                <label className="field-lbl">Nom</label>
                <input className="field-input" value={newInst.nom} onChange={e => setNewInst({ ...newInst, nom: e.target.value })} placeholder="Nom" />
              </div>
              <div className="field-group">
                <label className="field-lbl">Identifiant</label>
                <input className="field-input" value={newInst.identifiant} onChange={e => setNewInst({ ...newInst, identifiant: e.target.value })} placeholder="ex: m.karim" />
              </div>
              <div className="field-group">
                <label className="field-lbl">Mot de passe</label>
                <input className="field-input" type="password" value={newInst.mot_de_passe} onChange={e => setNewInst({ ...newInst, mot_de_passe: e.target.value })} placeholder="••••••••" />
              </div>
            </div>
            <button className="btn-primary" onClick={ajouterInstituteur}>+ Ajouter l'instituteur</button>
          </div>

          <div className="section-label">Instituteurs actifs ({instituteurs.length})</div>
          {loading ? <div className="loading">Chargement...</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>Nom</th>
                    <th style={{ width: '35%' }}>Identifiant</th>
                    <th style={{ width: '30%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instituteurs.length === 0 && <tr><td colSpan={3} className="empty">Aucun instituteur.</td></tr>}
                  {instituteurs.map(i => (
                    <tr key={i.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{getInitiales(i.prenom, i.nom)}</div>
                          {i.prenom} {i.nom}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: '#888' }}>{i.identifiant}</td>
                      <td>
                        <button className="action-btn danger" onClick={() => supprimerInstituteur(i.id)}>Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
