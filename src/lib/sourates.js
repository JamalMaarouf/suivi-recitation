// Sourates list - static data from Sourates.xlsx
// Used for display and matching with DB records
export const SOURATES = [
  { numero: 72, nom_ar: 'سورة الجن', niveau_5B: false, niveau_5A: true },
  { numero: 73, nom_ar: 'سورة المزمل', niveau_5B: false, niveau_5A: true },
  { numero: 74, nom_ar: 'سورة المدثر', niveau_5B: false, niveau_5A: true },
  { numero: 75, nom_ar: 'سورة القيامة', niveau_5B: false, niveau_5A: true },
  { numero: 76, nom_ar: 'سورة الإنسان', niveau_5B: false, niveau_5A: true },
  { numero: 77, nom_ar: 'سورة المرسلات', niveau_5B: false, niveau_5A: true },
  { numero: 78, nom_ar: 'سورة النبأ', niveau_5B: true, niveau_5A: true },
  { numero: 79, nom_ar: 'سورة النازعات', niveau_5B: true, niveau_5A: true },
  { numero: 80, nom_ar: 'سورة عبس', niveau_5B: true, niveau_5A: true },
  { numero: 81, nom_ar: 'سورة التكوير', niveau_5B: true, niveau_5A: true },
  { numero: 82, nom_ar: 'سورة الانفطار', niveau_5B: true, niveau_5A: true },
  { numero: 83, nom_ar: 'سورة المطففون', niveau_5B: true, niveau_5A: true },
  { numero: 84, nom_ar: 'سورة الانشقاق', niveau_5B: true, niveau_5A: true },
  { numero: 85, nom_ar: 'سورة البروج', niveau_5B: true, niveau_5A: true },
  { numero: 86, nom_ar: 'سورة الطارق', niveau_5B: true, niveau_5A: true },
  { numero: 87, nom_ar: 'سورة الأعلى', niveau_5B: true, niveau_5A: true },
  { numero: 88, nom_ar: 'سورة الغاشية', niveau_5B: true, niveau_5A: true },
  { numero: 89, nom_ar: 'سورة الفجر', niveau_5B: true, niveau_5A: true },
  { numero: 90, nom_ar: 'سورة البلد', niveau_5B: true, niveau_5A: true },
  { numero: 91, nom_ar: 'سورة الشمس', niveau_5B: true, niveau_5A: true },
  { numero: 92, nom_ar: 'سورة الليل', niveau_5B: true, niveau_5A: true },
  { numero: 93, nom_ar: 'سورة الضحى', niveau_5B: true, niveau_5A: true },
  { numero: 94, nom_ar: 'سورة الشرح', niveau_5B: true, niveau_5A: true },
  { numero: 95, nom_ar: 'سورة التين', niveau_5B: true, niveau_5A: true },
  { numero: 96, nom_ar: 'سورة العلق', niveau_5B: true, niveau_5A: true },
  { numero: 97, nom_ar: 'سورة القدر', niveau_5B: true, niveau_5A: true },
  { numero: 98, nom_ar: 'سورة البينة', niveau_5B: true, niveau_5A: true },
  { numero: 99, nom_ar: 'سورة الزلزلة', niveau_5B: true, niveau_5A: true },
  { numero: 100, nom_ar: 'سورة العاديات', niveau_5B: true, niveau_5A: true },
  { numero: 101, nom_ar: 'سورة القارعة', niveau_5B: true, niveau_5A: true },
  { numero: 102, nom_ar: 'سورة التكاثر', niveau_5B: true, niveau_5A: true },
  { numero: 103, nom_ar: 'سورة العصر', niveau_5B: true, niveau_5A: true },
  { numero: 104, nom_ar: 'سورة الهمزة', niveau_5B: true, niveau_5A: true },
  { numero: 105, nom_ar: 'سورة الفيل', niveau_5B: true, niveau_5A: true },
  { numero: 106, nom_ar: 'سورة قريش', niveau_5B: true, niveau_5A: true },
  { numero: 107, nom_ar: 'سورة الماعون', niveau_5B: true, niveau_5A: true },
  { numero: 108, nom_ar: 'سورة الكوثر', niveau_5B: true, niveau_5A: true },
  { numero: 109, nom_ar: 'سورة الكافرون', niveau_5B: true, niveau_5A: true },
  { numero: 110, nom_ar: 'سورة النصر', niveau_5B: true, niveau_5A: true },
  { numero: 111, nom_ar: 'سورة المسد', niveau_5B: true, niveau_5A: true },
  { numero: 112, nom_ar: 'سورة الإخلاص', niveau_5B: true, niveau_5A: true },
  { numero: 113, nom_ar: 'سورة الفلق', niveau_5B: true, niveau_5A: true },
  { numero: 114, nom_ar: 'سورة الناس', niveau_5B: true, niveau_5A: true },
];

export const SOURATES_5B = SOURATES.filter(s => s.niveau_5B);
export const SOURATES_5A = SOURATES.filter(s => s.niveau_5A);

export function getSouratesForNiveau(niveau) {
  if (niveau === '5B') return SOURATES_5B;
  if (niveau === '5A') return SOURATES_5A;
  return [];
}

// Map numero to DB id (loaded once from Supabase)
let souratesDB = null;

export function setSouratesDB(data) {
  souratesDB = data;
  // Enrich SOURATES with id_db
  SOURATES.forEach(s => {
    const dbRow = data.find(d => d.numero === s.numero);
    s.id_db = dbRow?.id || null;
  });
}

export function getSouratesDB() {
  return souratesDB;
}
