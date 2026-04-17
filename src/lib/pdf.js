// Utilitaire PDF côté serveur — remplace jsPDF/html2canvas côté client
// Usage: import { openPDF } from '../lib/pdf';
// openPDF('rapport_mensuel', { ecole, mois, annee, eleves, stats }, lang)

export async function openPDF(type, data, lang = 'fr') {
  try {
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data, lang }),
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur génération PDF');
    }
    
    const html = await res.text();
    
    // Ouvre dans un nouvel onglet — l'utilisateur peut imprimer ou "Enregistrer en PDF"
    const win = window.open('', '_blank');
    if (!win) {
      // Popup bloqué — fallback blob
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return;
    }
    win.document.write(html);
    win.document.close();
  } catch (e) {
    console.error('PDF error:', e);
    throw e;
  }
}

// Version impression directe (sans ouvrir un onglet)
export async function downloadPDF(type, data, lang = 'fr', filename = 'document.html') {
  const res = await fetch('/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data, lang }),
  });
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
