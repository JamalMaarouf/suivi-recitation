import { useState, useEffect } from 'react';

// oct 2026 : etat de filtre memorise pour la session (sessionStorage).
// Avant : ouvrir une fiche puis revenir remettait tous les filtres a zero.
// Stockage indisponible -> se comporte comme un useState ordinaire.
export default function useEtatMemorise(cle, valeurInitiale) {
  const [valeur, setValeur] = useState(() => {
    try {
      const brut = sessionStorage.getItem('filtre:' + cle);
      return brut !== null ? JSON.parse(brut) : valeurInitiale;
    } catch (e) { return valeurInitiale; }
  });
  useEffect(() => {
    try { sessionStorage.setItem('filtre:' + cle, JSON.stringify(valeur)); } catch (e) { /* */ }
  }, [cle, valeur]);
  return [valeur, setValeur];
}
