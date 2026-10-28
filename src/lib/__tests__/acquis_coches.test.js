import { calcHizbsAcquisAvantArrivee, calcTomonAcquisAvantArrivee, calcEtatEleveAvecBlocs } from '../helpers';

// Niveau a un bloc : Hizb 60 -> 41 (desc). Niveau a deux blocs : 60->41 (desc) puis 1->10 (asc).
const mono = Array.from({ length: 20 }, (_, i) => ({ reference_id: String(60 - i), ordre: i + 1, type_contenu: 'hizb', bloc_numero: 1, bloc_sens: 'asc' }));
const multi = [
  ...Array.from({ length: 20 }, (_, i) => ({ reference_id: String(60 - i), ordre: i + 1, type_contenu: 'hizb', bloc_numero: 1, bloc_sens: 'desc' })),
  ...Array.from({ length: 10 }, (_, i) => ({ reference_id: String(1 + i), ordre: 21 + i, type_contenu: 'hizb', bloc_numero: 2, bloc_sens: 'asc' })),
];

describe('acquis coches un par un (hizbs_acquis)', () => {
  test('regle d\'avant inchangee sans Hizb coches', () => {
    expect([...calcHizbsAcquisAvantArrivee({ hizb_depart: 57 }, mono, 'desc')].sort()).toEqual([58, 59, 60]);
    expect(calcTomonAcquisAvantArrivee({ hizb_depart: 57, tomon_depart: 1 }, mono, 'desc')).toBe(24);
    expect(calcHizbsAcquisAvantArrivee({ hizb_depart: 0 }, mono, 'desc').size).toBe(0);
  });
  test('Hizb coches hors debut du parcours comptes', () => {
    const e = { hizb_depart: 60, hizbs_acquis: [1, 3] };
    expect([...calcHizbsAcquisAvantArrivee(e, multi, 'desc')].sort((a, b) => a - b)).toEqual([1, 3]);
    expect(calcTomonAcquisAvantArrivee({ ...e, tomon_depart: 1 }, multi, 'desc')).toBe(16);
  });
  test('tous les Hizb coches (depart 0) comptes', () => {
    const tous = mono.map(l => Number(l.reference_id));
    expect(calcHizbsAcquisAvantArrivee({ hizb_depart: 0, hizbs_acquis: tous }, mono, 'desc').size).toBe(20);
  });
  test('position : un Hizb coche n\'est pas a reciter (niveau a un bloc)', () => {
    const e = { id: 'x', hizb_depart: 60, tomon_depart: 1, hizbs_acquis: [59] };
    const vals = [{ type_validation: 'hizb_complet', hizb_valide: 60, date_validation: '2026-10-01T10:00:00Z' }];
    for (let k = 0; k < 8; k++) vals.push({ type_validation: 'tomon', nombre_tomon: 1, hizb_validation: 60, date_validation: '2026-09-2' + k + 'T10:00:00Z' });
    const et = calcEtatEleveAvecBlocs(vals, e, mono, 'desc');
    expect(et.hizbEnCours).toBe(58);
  });
  test('position inchangee quand les Hizb coches forment le debut du parcours', () => {
    const e = { id: 'x', hizb_depart: 57, tomon_depart: 1, hizbs_acquis: [60, 59, 58] };
    const sans = calcEtatEleveAvecBlocs([], { ...e, hizbs_acquis: [] }, mono, 'desc');
    const avec = calcEtatEleveAvecBlocs([], e, mono, 'desc');
    expect(avec.hizbEnCours).toBe(sans.hizbEnCours);
    expect(avec.prochainTomon).toBe(sans.prochainTomon);
  });
});

describe('Tomon de depart (niveau a plusieurs blocs)', () => {
  test('repart au Tomon choisi', () => {
    const et = calcEtatEleveAvecBlocs([], { id: 'x', hizb_depart: 58, tomon_depart: 5, hizbs_acquis: [60, 59] }, multi, 'desc');
    expect(et.hizbEnCours).toBe(58);
    expect(et.prochainTomon).toBe(5);
  });
  test('Tomon de depart + Tomon recites', () => {
    const vals = [5, 6].map(k => ({ type_validation: 'tomon', nombre_tomon: 1, hizb_validation: 58, date_validation: `2026-10-0${k}T10:00:00Z` }));
    const et = calcEtatEleveAvecBlocs(vals, { id: 'x', hizb_depart: 58, tomon_depart: 5, hizbs_acquis: [60, 59] }, multi, 'desc');
    expect(et.prochainTomon).toBe(7);
  });
});

describe('ordre du parcours dans le selecteur', () => {
  const { ordreParcoursHizb, calculerHizbDepartDepuisBlocs } = require('../../components/AcquisSelector');
  test('blocs dans l\'ordre, chacun dans son sens', () => {
    const o = ordreParcoursHizb(multi, 'desc');
    expect(o.slice(0, 3)).toEqual([60, 59, 58]);
    expect(o[20]).toBe(1);
    expect(o.length).toBe(30);
  });
  test('monobloc : sens du niveau', () => {
    expect(ordreParcoursHizb(mono, 'desc').slice(0, 2)).toEqual([60, 59]);
  });
  test('un prefixe du parcours donne le depart attendu', () => {
    const o = ordreParcoursHizb(multi, 'desc');
    expect(calculerHizbDepartDepuisBlocs(multi, o.slice(0, 4), 'desc')).toBe(56);
    expect(calculerHizbDepartDepuisBlocs(multi, o.slice(0, 20), 'desc')).toBe(1);
  });
});
