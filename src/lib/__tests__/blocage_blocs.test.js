import { verifierBlocageExamen, depuisDebutNiveau } from '../helpers';
function fake(db) {
  return { from(t) { let rows = [...(db[t]||[])]; let single=false; const b = {
    select(){return b;}, eq(c,v){rows=rows.filter(r=>r[c]===v);return b;}, in(c,vs){rows=rows.filter(r=>vs.includes(r[c]));return b;},
    order(){return b;}, limit(n){rows=rows.slice(0,n);return b;}, maybeSingle(){single=true;return b;},
    then(res,rej){return Promise.resolve({data: single?(rows[0]||null):rows, error:null}).then(res,rej);} }; return b; } };
}
const prog = [];
for (let h=60; h>=46; h--) prog.push({ niveau_id:'n1', ecole_id:'e', reference_id:String(h), ordre:61-h, bloc_numero:1, bloc_sens:'desc', type_contenu:'hizb' });
for (let h=31; h<=45; h++) prog.push({ niveau_id:'n1', ecole_id:'e', reference_id:String(h), ordre:100+h, bloc_numero:2, bloc_sens:'asc', type_contenu:'hizb' });
const db = { niveaux:[{id:'n1',ecole_id:'e',code:'X',type:'hizb',sens_recitation:'desc'}], programmes: prog,
  examens:[{id:'x2',ecole_id:'e',niveau_id:'n1',bloquant:true,nom:'Examen bloc 2',contenu_ids:Array.from({length:15},(_,i)=>31+i)},
           {id:'x1',ecole_id:'e',niveau_id:'n1',bloquant:true,nom:'Examen bloc 1',contenu_ids:Array.from({length:15},(_,i)=>46+i)}],
  resultats_examens:[{examen_id:'x1',eleve_id:'s',statut:'reussi'}] };
test('multi-blocs : pas de blocage apres un seul Hizb', async () => {
  const eleve = { id:'s', code_niveau:'X', hizb_depart:35 };
  const r = await verifierBlocageExamen(fake(db), { eleve, ecole_id:'e', validations:[{type_validation:'hizb_complet',hizb_valide:35,date_validation:'2026-10-20T10:00:00'}], recitations:[] });
  expect(r).toBeNull();
});
test('multi-blocs : blocage quand le bloc 2 est fini', async () => {
  const eleve = { id:'s', code_niveau:'X', hizb_depart:35 };
  const vals = []; for (let h=35; h<=45; h++) vals.push({type_validation:'hizb_complet',hizb_valide:h,date_validation:'2026-10-20T10:00:00'});
  const r = await verifierBlocageExamen(fake(db), { eleve, ecole_id:'e', validations:vals, recitations:[] });
  expect(r && r.examen.id).toBe('x2');
});
test('sans programme : regle en ligne droite inchangee', async () => {
  const db2 = { ...db, programmes: [], examens:[{id:'x3',ecole_id:'e',niveau_id:'n1',bloquant:true,nom:'E',contenu_ids:[59,58]}], resultats_examens:[] };
  const r = await verifierBlocageExamen(fake(db2), { eleve:{id:'s',code_niveau:'X',hizb_depart:58}, ecole_id:'e', validations:[{type_validation:'hizb_complet',hizb_valide:58,date_validation:'2026-10-20'}], recitations:[] });
  expect(r && r.examen.id).toBe('x3');
});
test('fuseau : recitation 30 min apres le passage gardee', () => {
  const rows = depuisDebutNiveau([{ date_validation:'2026-10-23T10:30:00' }, { date_validation:'2026-10-23T09:30:00' }], { debut_niveau_at:'2026-10-23T10:00:00+00:00' });
  expect(rows.length).toBe(1);
});

// Regle 23/10 : examen entierement couvert par les acquis -> pas de blocage, prochain examen normal
test('acquis couvrant un examen entier : pas de blocage', async () => {
  const db3 = { ...db, programmes: [], examens:[{id:'x4',ecole_id:'e',niveau_id:'n1',bloquant:true,nom:'E60-59',contenu_ids:[60,59]},{id:'x5',ecole_id:'e',niveau_id:'n1',bloquant:true,nom:'E58-57',contenu_ids:[58,57]}], resultats_examens:[] };
  const eleve = { id:'s', code_niveau:'X', hizb_depart:58 };
  expect(await verifierBlocageExamen(fake(db3), { eleve, ecole_id:'e', validations:[], recitations:[] })).toBeNull();
  const vals = [{type_validation:'hizb_complet',hizb_valide:58,date_validation:'2026-10-20'},{type_validation:'hizb_complet',hizb_valide:57,date_validation:'2026-10-21'}];
  const r = await verifierBlocageExamen(fake(db3), { eleve, ecole_id:'e', validations:vals, recitations:[] });
  expect(r && r.examen.id).toBe('x5');
});
test('examen a cheval acquis + suivi : bloque quand fini', async () => {
  const db4 = { ...db, programmes: [], examens:[{id:'x6',ecole_id:'e',niveau_id:'n1',bloquant:true,nom:'E',contenu_ids:[60,59,58]}], resultats_examens:[] };
  const r = await verifierBlocageExamen(fake(db4), { eleve:{id:'s',code_niveau:'X',hizb_depart:58}, ecole_id:'e', validations:[{type_validation:'hizb_complet',hizb_valide:58,date_validation:'2026-10-20'}], recitations:[] });
  expect(r && r.examen.id).toBe('x6');
});

// Retour test 26/10 : niveau en blocs (sens 1->60), examen Hizb 36-40 : bloque des que le Hizb 40 est complet
test('blocs asc : examen 36-40 bloque apres le Hizb 40 complet, pas avant', async () => {
  const prog2 = [];
  [[1,31,35],[2,36,40],[3,41,45]].forEach(([b,d,f]) => { for (let h=d; h<=f; h++) prog2.push({ niveau_id:'n2', ecole_id:'e', reference_id:String(h), ordre:h, bloc_numero:b, bloc_sens:'asc', type_contenu:'hizb' }); });
  const db5 = { niveaux:[{id:'n2',ecole_id:'e',code:'L',type:'hizb',sens_recitation:'asc'}], programmes: prog2,
    examens:[{id:'x9',ecole_id:'e',niveau_id:'n2',bloquant:true,nom:'Examen 36-40',contenu_ids:[36,37,38,39,40]}], resultats_examens:[] };
  const eleve = { id:'s', code_niveau:'L', hizb_depart:36 };
  const v = (h) => ({ type_validation:'hizb_complet', hizb_valide:h, date_validation:'2026-10-26T10:00:00' });
  expect(await verifierBlocageExamen(fake(db5), { eleve, ecole_id:'e', validations:[v(36),v(37),v(38),v(39)], recitations:[] })).toBeNull();
  const r = await verifierBlocageExamen(fake(db5), { eleve, ecole_id:'e', validations:[v(36),v(37),v(38),v(39),v(40)], recitations:[] });
  expect(r && r.examen.id).toBe('x9');
});

// Performance (26/10) : parametres memorises -> 2e verification sans appel reseau si aucun examen atteint ;
// les resultats d'examens restent toujours relus.
test('cache : 0 requete au 2e appel sans examen atteint, resultats toujours relus', async () => {
  const base = { niveaux:[{id:'n1',ecole_id:'e',code:'X',type:'hizb',sens_recitation:'desc'}], programmes: [],
    examens:[{id:'x7',ecole_id:'e',niveau_id:'n1',bloquant:true,nom:'E',contenu_ids:[59,58]}], resultats_examens:[] };
  const client = fake(base); let n = 0; const from = client.from; client.from = (t) => { n++; return from(t); };
  const eleve = { id:'s', code_niveau:'X', hizb_depart:59 };
  expect(await verifierBlocageExamen(client, { eleve, ecole_id:'e', validations:[], recitations:[] })).toBeNull();
  const n1 = n;
  expect(await verifierBlocageExamen(client, { eleve, ecole_id:'e', validations:[], recitations:[] })).toBeNull();
  expect(n).toBe(n1); // aucun appel
  const v = (h) => ({ type_validation:'hizb_complet', hizb_valide:h, date_validation:'2026-10-26T10:00:00' });
  const r = await verifierBlocageExamen(client, { eleve, ecole_id:'e', validations:[v(59),v(58)], recitations:[] });
  expect(r && r.examen.id).toBe('x7');
  expect(n).toBe(n1 + 1); // seulement la lecture des resultats
  base.resultats_examens.push({ examen_id:'x7', eleve_id:'s', statut:'reussi' });
  expect(await verifierBlocageExamen(client, { eleve, ecole_id:'e', validations:[v(59),v(58)], recitations:[] })).toBeNull();
});
