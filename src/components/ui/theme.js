// ═══════════════════════════════════════════════════════════════════════
// Charte visuelle Tartily (oct 2026) — source unique des couleurs, tailles,
// arrondis et espacements de l'application mobile.
// Regle : un composant n'ecrit jamais une couleur en dur, il prend ces tokens.
// ═══════════════════════════════════════════════════════════════════════

export const C = {
  // Marque
  brand: '#0B5A45',        // en-tetes, boutons principaux
  brand2: '#128A66',       // etats actifs, degrade d'en-tete
  brandSoft: '#E2F1EA',    // fonds de selection
  // Neutres
  bg: '#F4F6F3',           // fond des pages
  surface: '#FFFFFF',      // cartes
  line: '#DDE4DF',         // bordures
  text: '#16241E',         // texte principal
  muted: '#5C6B64',        // texte secondaire
  // Accent
  gold: '#B7791F', goldSoft: '#F8EDD9',      // certificats, honneur
  // Etats (seulement quand le chiffre a un sens)
  good: '#1D7F5C', goodSoft: '#E3F2EA',
  warn: '#A86412', warnSoft: '#FBEEDC',
  crit: '#B83A2E', critSoft: '#F9E4E1',
  info: '#285F9E', infoSoft: '#E3ECF7',
  // Sur fond marque
  onBrand: '#FFFFFF', onBrandMuted: 'rgba(255,255,255,0.80)', onBrandGlass: 'rgba(255,255,255,0.16)',
};

export const HEADER_BG = `linear-gradient(135deg, ${C.brand}, ${C.brand2})`;

// 7 tailles de texte
export const T = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, hero: 32 };

// 3 arrondis
export const R = { sm: 8, md: 12, pill: 999 };

// Espacements
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// Zone tactile minimale (Apple / Google)
export const TOUCH = 44;

export const FONT = "'IBM Plex Sans', 'IBM Plex Sans Arabic', 'Tajawal', 'Segoe UI', Arial, sans-serif";

// Ton d'une tuile chiffre -> couleurs
export const TONES = {
  neutral: { fg: C.text, bg: C.surface, accent: C.muted },
  brand: { fg: C.brand, bg: C.surface, accent: C.brand },
  good: { fg: C.good, bg: C.surface, accent: C.good },
  warn: { fg: C.warn, bg: C.surface, accent: C.warn },
  crit: { fg: C.crit, bg: C.surface, accent: C.crit },
  gold: { fg: C.gold, bg: C.surface, accent: C.gold },
  info: { fg: C.info, bg: C.surface, accent: C.info },
};
