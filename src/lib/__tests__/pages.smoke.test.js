// Bloc 6 (oct 2026) : test de fumee - chaque page s'affiche sans planter (mobile + PC,
// surveillant + instituteur) avec une base vide simulee. Detecte les erreurs du type
// 'X before initialization' / hooks / identifiants non definis au premier affichage.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
jest.mock('../supabase', () => {
  const mk = () => { const b = new Proxy(function(){}, {
      get(t, p) {
        if (p === 'then') return (r, j) => Promise.resolve({ data: [], error: null, count: 0 }).then(r, j);
        if (p === 'maybeSingle' || p === 'single') return () => Promise.resolve({ data: null, error: null });
        return () => b;
      },
      apply() { return b; } }); return b; };
  const client = { from: () => mk(), rpc: () => mk(), channel: () => ({ on(){return this;}, subscribe(){return this;} }), removeChannel(){} , auth: { getSession: async()=>({data:{}}) }, storage: { from: () => mk() } };
  return { supabase: client, supabaseRaw: client };
});
global.fetch = () => Promise.resolve({ ok: true, json: async () => ({}) , text: async()=>''});
const pages = require('fs').readdirSync(__dirname + '/../../pages').filter(f => f.endsWith('.js'));
const ToastMod = require('../toast');
const Provider = ToastMod.ToastProvider || (({children}) => children);
const users = [
  { id: 'u1', role: 'surveillant', ecole_id: 'e1', prenom: 'S', nom: 'S', ecole: { id: 'e1', nom: 'X' } },
  { id: 'u2', role: 'instituteur', ecole_id: 'e1', prenom: 'I', nom: 'I', ecole: { id: 'e1', nom: 'X' } },
];
const eleve = { id: 'el1', prenom: 'A', nom: 'B', code_niveau: '5B', ecole_id: 'e1', hizb_depart: 60, tomon_depart: 1, sourates_acquises: 0 };
for (const f of pages) {
  for (const u of users) for (const isMobile of [true, false]) {
    test(`${f} ${u.role} mobile=${isMobile}`, async () => {
      const mod = require('../../pages/' + f);
      const C = mod.default; if (typeof C !== 'function') return;
      const errs = []; const orig = console.error; console.error = (...a) => errs.push(String(a[0]));
      const div = document.createElement('div');
      let thrown = null;
      try {
        await act(async () => {
          createRoot(div).render(<Provider><C user={u} instituteur={users[1]} LangSelector={() => null} parent={{...users[0], role:'parent'}} eleve={eleve} navigate={() => {}} goBack={() => {}} lang="fr" isMobile={isMobile} niveaux={[]} onLogout={()=>{}} /></Provider>);
        });
        await act(async () => { await new Promise(r => setTimeout(r, 30)); });
      } catch (e) { thrown = e; }
      console.error = orig;
      const graves = errs.filter(m => /ReferenceError|TypeError|before initialization|is not defined|Rendered (more|fewer) hooks|Cannot read/.test(m));
      if (thrown || graves.length) throw new Error((thrown && thrown.message) || graves.join(' | ').slice(0, 300));
    });
  }
}
