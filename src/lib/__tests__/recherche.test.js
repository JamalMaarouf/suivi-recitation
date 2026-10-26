import { normaliserRecherche, correspondRecherche } from '../recherche';

describe('recherche tolerante', () => {
  test('majuscules et numero', () => {
    expect(correspondRecherche('74a', 'Ali', 'Abzid', '74A')).toBe(true);
    expect(correspondRecherche('tqw-74a', 'TQW-74A')).toBe(true);
  });
  test('hamza, alif maqsura, ta marbuta', () => {
    expect(correspondRecherche('احمد', 'أحمد', 'العلوي')).toBe(true);
    expect(correspondRecherche('ادم', 'آدم')).toBe(true);
    expect(correspondRecherche('اسماعيل', 'إسماعيل')).toBe(true);
    expect(correspondRecherche('مصطفي', 'مصطفى')).toBe(true);
    expect(correspondRecherche('حمزه', 'حمزة')).toBe(true);
  });
  test('ordre des mots, espaces et harakat', () => {
    expect(correspondRecherche('  alami   youssef ', 'Youssef', 'Alami')).toBe(true);
    expect(correspondRecherche('محمد', 'مُحَمَّد')).toBe(true);
    expect(correspondRecherche('youssef tazi', 'Youssef', 'Alami')).toBe(false);
  });
  test('chiffres arabes et accents latins', () => {
    expect(correspondRecherche('٧٤', '74A')).toBe(true);
    expect(correspondRecherche('ecole', 'École')).toBe(true);
  });
  test('vide et valeurs nulles', () => {
    expect(correspondRecherche('', 'x')).toBe(true);
    expect(correspondRecherche('a', null, undefined)).toBe(false);
    expect(normaliserRecherche(null)).toBe('');
  });
});
