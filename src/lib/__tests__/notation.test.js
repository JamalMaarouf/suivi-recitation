// Bloc 6 (oct 2026) : tests des fonctions critiques de notation et de blocage.
// Lancer : npm test -- --watchAll=false
import {
  calcPointsPeriode,
  ptsValidation,
  calcEtatEleve,
  verifierBlocageExamen,
  numerosSouratesAcquises,
  ordonnerSouratesProgramme,
} from '../helpers';

const BAREME = {
  unites: { tomon: 10, hizb_complet: 100, sourate: 0, muraja_tomon: 2, muraja_hizb: 15, muraja_sourate: 20, muraja_sequence: 5 },
  ensembles: { ens1: 50 },
  examens: {},
  jalons: { jal1: 30 },
};

const D = '2026-10-01T10:00:00Z';
const DEBUT = new Date('2000-01-01');
const FIN = new Date('2030-01-01');

// ─────────────────────────────────────────────────────────────────
describe('ptsValidation', () => {
  test('tomon : nombre de tomon x bareme', () => {
    expect(ptsValidation({ type_validation: 'tomon', nombre_tomon: 3 }, BAREME)).toBe(30);
  });
  test('hizb complet', () => {
    expect(ptsValidation({ type_validation: 'hizb_complet' }, BAREME)).toBe(100);
  });
  test('muraja tomon et hizb', () => {
    expect(ptsValidation({ type_validation: 'tomon_muraja', nombre_tomon: 4 }, BAREME)).toBe(8);
    expect(ptsValidation({ type_validation: 'hizb_muraja' }, BAREME)).toBe(15);
  });
  test('ensemble valide : bonus de l\'ensemble', () => {
    expect(ptsValidation({ type_validation: 'ensemble_valide', ensemble_id: 'ens1' }, BAREME)).toBe(50);
    expect(ptsValidation({ type_validation: 'ensemble_valide', ensemble_id: 'inconnu' }, BAREME)).toBe(0);
  });
  test('accepte un bareme plat (unites seules) et un bareme absent', () => {
    expect(ptsValidation({ type_validation: 'tomon', nombre_tomon: 2 }, BAREME.unites)).toBe(20);
    expect(ptsValidation({ type_validation: 'tomon', nombre_tomon: 2 }, null)).toBe(0);
    expect(ptsValidation(null, BAREME)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('calcPointsPeriode', () => {
  const validations = [
    { type_validation: 'tomon', nombre_tomon: 3, date_validation: D },
    { type_validation: 'hizb_complet', hizb_valide: 60, date_validation: D },
    { type_validation: 'hizb_complet', hizb_valide: 60, date_validation: D }, // doublon : compte une fois
    { type_validation: 'tomon_muraja', nombre_tomon: 4, date_validation: D },
    { type_validation: 'hizb_muraja', date_validation: D },
    { type_validation: 'ensemble_valide', ensemble_id: 'ens1', date_validation: D },
  ];
  const recitations = [
    { type_recitation: 'complete', points: 25, date_validation: D },
    { type_recitation: 'sequence', points: 5, is_muraja: true, date_validation: D },
  ];
  const certificats = [{ jalon_id: 'jal1', date_obtention: D }];
  const evenements = [
    { type_event: 'examen', points: 40, date_event: D },
    { type_event: 'jalon', points: 999, date_event: D }, // ignore (deja compte via certificats)
  ];

  test('additionne toutes les sources de points', () => {
    const r = calcPointsPeriode(validations, DEBUT, FIN, BAREME, evenements, recitations, certificats);
    expect(r.ptsTomon).toBe(30);
    expect(r.ptsHizb).toBe(100);
    expect(r.ptsMuraTomon).toBe(8);
    expect(r.ptsMuraHizb).toBe(15);
    expect(r.ptsBonusEnsembles).toBe(50);
    expect(r.ptsSourates).toBe(30);
    expect(r.ptsCertificats).toBe(30);
    expect(r.ptsExamens).toBe(40);
    expect(r.total).toBe(30 + 100 + 8 + 15 + 50 + 30 + 30 + 40);
    expect(r.hizbsPeriode).toBe(1);
  });

  test('ne compte que la periode demandee (fin de journee incluse)', () => {
    const vals = [
      { type_validation: 'tomon', nombre_tomon: 1, date_validation: '2026-09-30T23:00:00' },
      { type_validation: 'tomon', nombre_tomon: 2, date_validation: '2026-10-31T22:00:00' },
      { type_validation: 'tomon', nombre_tomon: 5, date_validation: '2026-11-01T08:00:00' },
    ];
    const r = calcPointsPeriode(vals, new Date('2026-10-01T00:00:00'), new Date('2026-10-31T00:00:00'), BAREME);
    expect(r.tomonPeriode).toBe(2);
    expect(r.total).toBe(20);
  });

  test('sans bareme : 0 point (pas de valeur codee en dur)', () => {
    const r = calcPointsPeriode(validations, DEBUT, FIN, null);
    expect(r.total).toBe(0);
  });

  test('somme ptsValidation par ligne = total validations (hors doublon hizb)', () => {
    const sansDoublon = validations.filter((v, i) => i !== 2);
    const somme = sansDoublon.reduce((s, v) => s + ptsValidation(v, BAREME), 0);
    const r = calcPointsPeriode(sansDoublon, DEBUT, FIN, BAREME);
    expect(somme).toBe(r.total);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('calcEtatEleve', () => {
  test('eleve sans acquis (desc) : position et points depuis le suivi', () => {
    const vals = [{ type_validation: 'tomon', nombre_tomon: 3, date_validation: D }];
    const e = calcEtatEleve(vals, 0, 0, 'desc', null, null, BAREME);
    expect(e.hizbEnCours).toBe(60);
    expect(e.prochainTomon).toBe(4);
    expect(e.tomonAcquis).toBe(0);
    expect(e.points.total).toBe(30);
  });

  test('la muraja ne fait pas avancer la memorisation', () => {
    const vals = [{ type_validation: 'tomon_muraja', nombre_tomon: 5, date_validation: D }];
    const e = calcEtatEleve(vals, 0, 0, 'desc', null, null, BAREME);
    expect(e.tomonCumul).toBe(0);
    expect(e.prochainTomon).toBe(1);
  });

  test('acquis anterieurs (desc, depart Hizb 58 tomon 1) comptes dans les points', () => {
    const e = calcEtatEleve([], 58, 1, 'desc', null, null, BAREME);
    // Hizb 60 et 59 acquis = 2 hizb complets, 16 tomon
    expect(e.hizbAcquisComplets).toBe(2);
    expect(e.tomonAcquis).toBe(16);
    expect(e.points.ptsAcquisTotal).toBe(16 * 10 + 2 * 100);
    expect(e.points.ptsDepuisSuivi).toBe(0);
  });

  test('8 tomons sans hizb complet -> en attente de validation du hizb', () => {
    const vals = [{ type_validation: 'tomon', nombre_tomon: 8, date_validation: D }];
    const e = calcEtatEleve(vals, 0, 0, 'desc', null, null, BAREME);
    expect(e.enAttenteHizbComplet).toBe(true);
    expect(e.hizbEnCours).toBe(60);
  });

  test('hizb complet valide -> passe au hizb suivant selon le sens', () => {
    const vals = [
      { type_validation: 'tomon', nombre_tomon: 8, date_validation: '2026-10-01T10:00:00Z' },
      { type_validation: 'hizb_complet', hizb_valide: 60, date_validation: '2026-10-01T11:00:00Z' },
    ];
    expect(calcEtatEleve(vals, 0, 0, 'desc', null, null, BAREME).hizbEnCours).toBe(59);
    const valsAsc = [
      { type_validation: 'tomon', nombre_tomon: 8, date_validation: '2026-10-01T10:00:00Z' },
      { type_validation: 'hizb_complet', hizb_valide: 1, date_validation: '2026-10-01T11:00:00Z' },
    ];
    expect(calcEtatEleve(valsAsc, 0, 0, 'asc', null, null, BAREME).hizbEnCours).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────
// Faux client Supabase minimal : from(table).select().eq().in().order().maybeSingle()
function fauxSupabase(tables) {
  return {
    from(table) {
      const filtres = [];
      const b = {
        select() { return b; },
        eq(col, val) { filtres.push(r => r[col] === val); return b; },
        in(col, vals) { filtres.push(r => vals.includes(r[col])); return b; },
        order() { return b; },
        limit() { return b; },
        _rows() { return (tables[table] || []).filter(r => filtres.every(f => f(r))); },
        maybeSingle() { return Promise.resolve({ data: b._rows()[0] || null, error: null }); },
        then(res, rej) { return Promise.resolve({ data: b._rows(), error: null }).then(res, rej); },
      };
      return b;
    },
  };
}

describe('verifierBlocageExamen (hizb)', () => {
  const tables = {
    niveaux: [{ id: 'n1', ecole_id: 'e1', code: '2M', type: 'hizb', sens_recitation: 'desc' }],
    examens: [{ id: 'x1', ecole_id: 'e1', niveau_id: 'n1', bloquant: true, nom: 'Examen 60-59', contenu_ids: [60, 59] }],
    resultats_examens: [],
  };
  const hizbComplet = (h) => ({ type_validation: 'hizb_complet', hizb_valide: h });

  test('pas de blocage tant que les hizbs de l\'examen ne sont pas tous faits', async () => {
    const r = await verifierBlocageExamen(fauxSupabase(tables), {
      eleve: { id: 'el1', code_niveau: '2M' }, ecole_id: 'e1', validations: [hizbComplet(60)], recitations: [],
    });
    expect(r).toBeNull();
  });

  test('blocage quand tous les hizbs de l\'examen sont valides', async () => {
    const r = await verifierBlocageExamen(fauxSupabase(tables), {
      eleve: { id: 'el1', code_niveau: '2M' }, ecole_id: 'e1', validations: [hizbComplet(60), hizbComplet(59)], recitations: [],
    });
    expect(r).not.toBeNull();
    expect(r.examen.id).toBe('x1');
  });

  test('hizbs acquis avant le suivi (hizb_depart) comptent pour le blocage', async () => {
    // depart Hizb 59 en desc => Hizb 60 acquis ; il valide le 59 => examen atteint
    const r = await verifierBlocageExamen(fauxSupabase(tables), {
      eleve: { id: 'el1', code_niveau: '2M', hizb_depart: 59 }, ecole_id: 'e1', validations: [hizbComplet(59)], recitations: [],
    });
    expect(r && r.examen.id).toBe('x1');
  });

  test('examen deja reussi -> pas de blocage', async () => {
    const t2 = { ...tables, resultats_examens: [{ examen_id: 'x1', eleve_id: 'el1', statut: 'reussi' }] };
    const r = await verifierBlocageExamen(fauxSupabase(t2), {
      eleve: { id: 'el1', code_niveau: '2M' }, ecole_id: 'e1', validations: [hizbComplet(60), hizbComplet(59)], recitations: [],
    });
    expect(r).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
describe('sourates : programme et acquis (oct 2026)', () => {
  const toutes = Array.from({ length: 114 }, (_, i) => ({ id: 1000 + i + 1, numero: i + 1 }));

  test('acquis = N premieres sourates dans le sens du niveau', () => {
    expect([...numerosSouratesAcquises(3, 'desc')]).toEqual([114, 113, 112]);
    expect([...numerosSouratesAcquises(2, 'asc')]).toEqual([1, 2]);
    expect(numerosSouratesAcquises(0, 'desc').size).toBe(0);
  });

  test('liste = programme du niveau, triee selon le sens', () => {
    const prog = new Set([77, 76, 75, 49]);
    expect(ordonnerSouratesProgramme(toutes, prog, 'desc').map(s => s.numero)).toEqual([77, 76, 75, 49]);
    expect(ordonnerSouratesProgramme(toutes, prog, 'asc').map(s => s.numero)).toEqual([49, 75, 76, 77]);
  });

  test('sans programme : les 114 sourates', () => {
    expect(ordonnerSouratesProgramme(toutes, null, 'desc')).toHaveLength(114);
    expect(ordonnerSouratesProgramme(toutes, new Set(), 'desc')[0].numero).toBe(114);
  });

  test('eleve de 5A sans acquis : la sourate en cours est la 1re du programme (77), pas An-Nas', () => {
    const ordre = ordonnerSouratesProgramme(toutes, new Set([77, 76, 75]), 'desc');
    const acquis = numerosSouratesAcquises(0, 'desc');
    expect(ordre.find(s => !acquis.has(s.numero)).numero).toBe(77);
  });
});
