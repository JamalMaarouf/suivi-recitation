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
  const db2 = { ...db, programmes: [], examens:[{id:'x3',ecole_id:'e',niveau_id:'n1',bloquant:true,nom:'E',contenu_ids:[60,59]}], resultats_examens:[] };
  const r = await verifierBlocageExamen(fake(db2), { eleve:{id:'s',code_niveau:'X',hizb_depart:58}, ecole_id:'e', validations:[{type_validation:'hizb_complet',hizb_valide:59,date_validation:'2026-10-20'}], recitations:[] });
  expect(r && r.examen.id).toBe('x3');
});
test('fuseau : recitation 30 min apres le passage gardee', () => {
  const rows = depuisDebutNiveau([{ date_validation:'2026-10-23T10:30:00' }, { date_validation:'2026-10-23T09:30:00' }], { debut_niveau_at:'2026-10-23T10:00:00+00:00' });
  expect(rows.length).toBe(1);
});
