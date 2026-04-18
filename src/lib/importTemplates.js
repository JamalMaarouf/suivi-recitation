// ═══════════════════════════════════════════════════════════════
// IMPORT TEMPLATES - Définition des tables importables en masse
// ═══════════════════════════════════════════════════════════════
// Pour chaque table, on définit :
//   - sheet_name : nom de l'onglet dans le fichier XLSX
//   - label_ar / label_fr : libellés affichés
//   - order : ordre de traitement (dépendances : niveaux avant instituteurs avant élèves...)
//   - columns : définition des colonnes (nom, obligatoire, type, aide, exemple)
//   - validate(row, context) : validation métier (retourne un tableau d'erreurs)
//   - toDBRow(row, context) : transforme une ligne du fichier en ligne DB
//   - unique_key : clé qui identifie un doublon (pour le mode upsert)

// ─── NIVEAUX ─────────────────────────────────────────────────────
export const TEMPLATE_NIVEAUX = {
  sheet_name: 'Niveaux',
  table: 'niveaux',
  label_ar: 'المستويات',
  label_fr: 'Niveaux',
  order: 1,
  unique_key: 'code',
  columns: [
    { key: 'code',    required: true,  type: 'string', help_fr: 'Code unique du niveau (ex: 5B, 5A, 2M, 2, 1)', help_ar: 'رمز فريد للمستوى', example: 'N1' },
    { key: 'nom',     required: true,  type: 'string', help_fr: 'Nom du niveau',                                help_ar: 'اسم المستوى',     example: 'Préscolaire' },
    { key: 'type',    required: true,  type: 'enum',   options: ['hizb', 'sourate'], help_fr: 'Type : hizb ou sourate', help_ar: 'النوع: hizb أو sourate', example: 'hizb' },
    { key: 'couleur', required: false, type: 'color',  help_fr: 'Code couleur (ex: #1D9E75)',                   help_ar: 'رمز اللون',        example: '#1D9E75' },
    { key: 'ordre',   required: false, type: 'integer', help_fr: 'Ordre d\'affichage (1, 2, 3...)',             help_ar: 'ترتيب العرض',      example: '1' },
    { key: 'sens_recitation', required: false, type: 'enum', options: ['desc', 'asc', ''], help_fr: 'Sens : desc, asc ou vide (utilise le défaut école)', help_ar: 'الاتجاه: desc أو asc أو فارغ', example: 'desc' },
  ],
  validate(row, ctx) {
    const errs = [];
    // code : unique dans le fichier + pas déjà en DB
    if (!row.code || !row.code.toString().trim()) errs.push('Code obligatoire');
    if (!row.nom || !row.nom.toString().trim()) errs.push('Nom obligatoire');
    if (!['hizb', 'sourate'].includes((row.type||'').toString().toLowerCase())) {
      errs.push('Type invalide (doit être "hizb" ou "sourate")');
    }
    if (row.couleur && !/^#[0-9A-Fa-f]{6}$/.test(row.couleur.toString())) {
      errs.push(`Couleur "${row.couleur}" invalide (format attendu : #RRGGBB)`);
    }
    if (row.sens_recitation && !['desc', 'asc', ''].includes(row.sens_recitation.toString().toLowerCase())) {
      errs.push(`Sens invalide "${row.sens_recitation}" (attendu : desc, asc ou vide)`);
    }
    // Unicité du code : vérifiée par le composant (accès à la liste DB)
    return errs;
  },
  toDBRow(row, ctx) {
    return {
      code: row.code.toString().trim().toUpperCase(),
      nom: row.nom.toString().trim(),
      type: row.type.toString().trim().toLowerCase(),
      couleur: (row.couleur||'').toString().trim() || '#1D9E75',
      ordre: parseInt(row.ordre) || 99,
      sens_recitation: row.sens_recitation ? row.sens_recitation.toString().trim().toLowerCase() : null,
      ecole_id: ctx.ecole_id,
    };
  },
};

// ─── INSTITUTEURS ────────────────────────────────────────────────
export const TEMPLATE_INSTITUTEURS = {
  sheet_name: 'Instituteurs',
  table: 'utilisateurs',
  label_ar: 'المدرسون',
  label_fr: 'Instituteurs',
  order: 2,
  unique_key: 'identifiant',
  columns: [
    { key: 'prenom',      required: true, type: 'string',  help_fr: 'Prénom',                                  help_ar: 'الاسم الشخصي', example: 'Ahmed' },
    { key: 'nom',         required: true, type: 'string',  help_fr: 'Nom de famille',                          help_ar: 'الاسم العائلي', example: 'Alami' },
    { key: 'identifiant', required: true, type: 'string',  help_fr: 'Identifiant de connexion (unique)',       help_ar: 'معرف الدخول (فريد)', example: 'ahmed.alami' },
  ],
  validate(row, ctx) {
    const errs = [];
    if (!row.prenom || !row.prenom.toString().trim()) errs.push('Prénom obligatoire');
    if (!row.nom || !row.nom.toString().trim()) errs.push('Nom obligatoire');
    if (!row.identifiant || !row.identifiant.toString().trim()) errs.push('Identifiant obligatoire');
    if (row.identifiant && /[\s@]/.test(row.identifiant.toString())) {
      errs.push('Identifiant ne doit pas contenir d\'espaces ni de @');
    }
    return errs;
  },
  toDBRow(row, ctx) {
    return {
      prenom: row.prenom.toString().trim(),
      nom: row.nom.toString().trim(),
      identifiant: row.identifiant.toString().trim().toLowerCase(),
      role: 'instituteur',
      ecole_id: ctx.ecole_id,
      // mot_de_passe : bcrypt du mdp_defaut_instituteurs — géré par le composant
    };
  },
};

// ─── ÉLÈVES ──────────────────────────────────────────────────────
export const TEMPLATE_ELEVES = {
  sheet_name: 'Eleves',
  table: 'eleves',
  label_ar: 'الطلاب',
  label_fr: 'Élèves',
  order: 3,
  unique_key: 'eleve_id_ecole',
  columns: [
    { key: 'prenom',                  required: true,  type: 'string',  help_fr: 'Prénom',                           help_ar: 'الاسم الشخصي',    example: 'Youssef' },
    { key: 'nom',                     required: true,  type: 'string',  help_fr: 'Nom de famille',                   help_ar: 'الاسم العائلي',    example: 'Benali' },
    { key: 'eleve_id_ecole',          required: true,  type: 'string',  help_fr: 'Numéro d\'élève dans l\'école (unique)', help_ar: 'رقم الطالب (فريد)', example: 'EL001' },
    { key: 'code_niveau',             required: true,  type: 'string',  help_fr: 'Code du niveau (doit exister)',    help_ar: 'رمز المستوى',       example: '1' },
    { key: 'hizb_depart',             required: false, type: 'integer', help_fr: 'Hizb de départ (0-60)',            help_ar: 'حزب الانطلاق',      example: '0' },
    { key: 'tomon_depart',            required: false, type: 'integer', help_fr: 'Tomon de départ (1-8)',            help_ar: 'الثُمن',             example: '1' },
    { key: 'sourates_acquises',       required: false, type: 'integer', help_fr: 'Nombre de sourates déjà acquises', help_ar: 'عدد السور المكتسبة', example: '0' },
    { key: 'instituteur_identifiant', required: false, type: 'string',  help_fr: 'Identifiant de l\'instituteur référent', help_ar: 'معرف المدرس المرجعي', example: 'ahmed.alami' },
  ],
  validate(row, ctx) {
    const errs = [];
    if (!row.prenom || !row.prenom.toString().trim()) errs.push('Prénom obligatoire');
    if (!row.nom || !row.nom.toString().trim()) errs.push('Nom obligatoire');
    if (!row.eleve_id_ecole || !row.eleve_id_ecole.toString().trim()) errs.push('Numéro d\'élève obligatoire');
    if (!row.code_niveau) errs.push('Code niveau obligatoire');
    else {
      // Vérifier que le niveau existe (dans DB ou dans le même import)
      const niveauxDispo = [...(ctx.niveauxDB||[]), ...(ctx.niveauxFichier||[])];
      const codeN = row.code_niveau.toString().trim().toUpperCase();
      if (!niveauxDispo.some(n => (n.code||'').toUpperCase() === codeN)) {
        errs.push(`Niveau "${codeN}" inexistant (ni en base ni dans l'onglet Niveaux)`);
      }
    }
    const hizbD = parseInt(row.hizb_depart);
    if (!isNaN(hizbD) && (hizbD < 0 || hizbD > 60)) errs.push('hizb_depart doit être entre 0 et 60');
    const tomonD = parseInt(row.tomon_depart);
    if (!isNaN(tomonD) && (tomonD < 1 || tomonD > 8)) errs.push('tomon_depart doit être entre 1 et 8');

    // Instituteur référent : doit exister si fourni
    if (row.instituteur_identifiant) {
      const instId = row.instituteur_identifiant.toString().trim().toLowerCase();
      const instDispo = [...(ctx.instituteursDB||[]), ...(ctx.instituteursFichier||[])];
      if (!instDispo.some(i => (i.identifiant||'').toLowerCase() === instId)) {
        errs.push(`Instituteur "${instId}" inexistant`);
      }
    }
    return errs;
  },
  toDBRow(row, ctx) {
    const codeN = row.code_niveau.toString().trim().toUpperCase();
    const niveauDB = (ctx.niveauxDB||[]).find(n => (n.code||'').toUpperCase() === codeN);
    const niveauFile = (ctx.niveauxFichier||[]).find(n => (n.code||'').toUpperCase() === codeN);
    // Pour le nom du niveau dans la colonne 'niveau' d'eleves
    const niveauNom = niveauDB?.nom || niveauFile?.nom || codeN;

    // Instituteur référent
    let instRefId = null;
    if (row.instituteur_identifiant) {
      const instId = row.instituteur_identifiant.toString().trim().toLowerCase();
      const inst = (ctx.instituteursDB||[]).find(i => (i.identifiant||'').toLowerCase() === instId);
      // NB : les instituteurs nouvellement créés dans le même import seront associés APRÈS l'import
      instRefId = inst?.id || null;
    }

    return {
      prenom: row.prenom.toString().trim(),
      nom: row.nom.toString().trim(),
      eleve_id_ecole: row.eleve_id_ecole.toString().trim(),
      code_niveau: codeN,
      niveau: niveauNom,
      hizb_depart: parseInt(row.hizb_depart) || 0,
      tomon_depart: parseInt(row.tomon_depart) || 1,
      sourates_acquises: parseInt(row.sourates_acquises) || 0,
      instituteur_referent_id: instRefId,
      ecole_id: ctx.ecole_id,
      // marqueur interne pour relier l'instituteur après import si nécessaire
      _instituteur_identifiant_attente: row.instituteur_identifiant && !instRefId
        ? row.instituteur_identifiant.toString().trim().toLowerCase()
        : null,
    };
  },
};

// ─── PARENTS ─────────────────────────────────────────────────────
export const TEMPLATE_PARENTS = {
  sheet_name: 'Parents',
  table: 'utilisateurs',
  label_ar: 'الآباء',
  label_fr: 'Parents',
  order: 4,
  unique_key: 'identifiant',
  columns: [
    { key: 'prenom',          required: true, type: 'string', help_fr: 'Prénom',                              help_ar: 'الاسم الشخصي',  example: 'Khalid' },
    { key: 'nom',             required: true, type: 'string', help_fr: 'Nom de famille',                      help_ar: 'الاسم العائلي',  example: 'Benali' },
    { key: 'identifiant',     required: true, type: 'string', help_fr: 'Identifiant de connexion (unique)',   help_ar: 'معرف الدخول',    example: 'khalid.benali' },
    { key: 'enfant1_eleve_id', required: true, type: 'string', help_fr: 'Numéro d\'élève du 1er enfant',       help_ar: 'رقم الابن الأول', example: 'EL001' },
    { key: 'enfant2_eleve_id', required: false, type: 'string', help_fr: 'Numéro d\'élève du 2e enfant (optionnel)', help_ar: 'رقم الابن الثاني', example: '' },
    { key: 'enfant3_eleve_id', required: false, type: 'string', help_fr: 'Numéro d\'élève du 3e enfant (optionnel)', help_ar: 'رقم الابن الثالث', example: '' },
  ],
  validate(row, ctx) {
    const errs = [];
    if (!row.prenom || !row.prenom.toString().trim()) errs.push('Prénom obligatoire');
    if (!row.nom || !row.nom.toString().trim()) errs.push('Nom obligatoire');
    if (!row.identifiant || !row.identifiant.toString().trim()) errs.push('Identifiant obligatoire');
    if (row.identifiant && /[\s@]/.test(row.identifiant.toString())) {
      errs.push('Identifiant ne doit pas contenir d\'espaces ni de @');
    }
    if (!row.enfant1_eleve_id) errs.push('Au moins un enfant est obligatoire (enfant1_eleve_id)');
    // Vérifier que les enfants existent
    const elevesDispo = [...(ctx.elevesDB||[]), ...(ctx.elevesFichier||[])];
    ['enfant1_eleve_id', 'enfant2_eleve_id', 'enfant3_eleve_id'].forEach((key, idx) => {
      if (row[key]) {
        const numE = row[key].toString().trim();
        if (!elevesDispo.some(e => (e.eleve_id_ecole||'').trim() === numE)) {
          errs.push(`Enfant "${numE}" (${key}) inexistant`);
        }
      }
    });
    return errs;
  },
  toDBRow(row, ctx) {
    return {
      prenom: row.prenom.toString().trim(),
      nom: row.nom.toString().trim(),
      identifiant: row.identifiant.toString().trim().toLowerCase(),
      role: 'parent',
      ecole_id: ctx.ecole_id,
      // Liens aux enfants gérés APRÈS la création dans parent_eleve
      _enfants_attente: ['enfant1_eleve_id', 'enfant2_eleve_id', 'enfant3_eleve_id']
        .map(k => row[k] ? row[k].toString().trim() : null)
        .filter(Boolean),
    };
  },
};

// ─── PROGRAMMES (hizb ou sourates rattachés à un niveau) ──────────
export const TEMPLATE_PROGRAMMES = {
  sheet_name: 'Programmes',
  table: 'programmes',
  label_ar: 'البرامج',
  label_fr: 'Programmes',
  order: 5, // après les niveaux
  unique_key: null, // pas de doublon simple — on ajoute/remplace par niveau
  columns: [
    { key: 'code_niveau',  required: true, type: 'string', help_fr: 'Code du niveau',                              help_ar: 'رمز المستوى',  example: '1' },
    { key: 'reference',    required: true, type: 'string', help_fr: 'Numéro de Hizb (1-60) ou numéro de sourate',  help_ar: 'رقم الحزب أو السورة', example: '60' },
    { key: 'ordre',        required: false, type: 'integer', help_fr: 'Ordre dans le programme',                    help_ar: 'الترتيب',        example: '1' },
  ],
  validate(row, ctx) {
    const errs = [];
    if (!row.code_niveau) errs.push('Code niveau obligatoire');
    else {
      const niveauxDispo = [...(ctx.niveauxDB||[]), ...(ctx.niveauxFichier||[])];
      const codeN = row.code_niveau.toString().trim().toUpperCase();
      const niv = niveauxDispo.find(n => (n.code||'').toUpperCase() === codeN);
      if (!niv) errs.push(`Niveau "${codeN}" inexistant`);
      else {
        // type du niveau détermine comment interpréter reference
        const ref = parseInt(row.reference);
        if (isNaN(ref)) errs.push('Référence doit être un nombre');
        else if (niv.type === 'hizb' && (ref < 1 || ref > 60)) errs.push('Pour un niveau hizb, référence doit être entre 1 et 60');
        else if (niv.type === 'sourate' && (ref < 1 || ref > 114)) errs.push('Pour un niveau sourate, référence doit être entre 1 et 114');
      }
    }
    return errs;
  },
  toDBRow(row, ctx) {
    const codeN = row.code_niveau.toString().trim().toUpperCase();
    const niveauxDispo = [...(ctx.niveauxDB||[]), ...(ctx.niveauxFichier||[])];
    const niv = niveauxDispo.find(n => (n.code||'').toUpperCase() === codeN);
    const isSourate = niv?.type === 'sourate';
    const ref = parseInt(row.reference);
    // Pour niveau sourate : on doit trouver l'UUID de la sourate en DB
    let refId = null;
    if (isSourate) {
      const sourate = (ctx.souratesDB||[]).find(s => s.numero === ref);
      refId = sourate?.id || null;
    } else {
      refId = ref.toString();
    }
    return {
      ecole_id: ctx.ecole_id,
      niveau_id: niv?.id || null, // sera résolu après que le niveau existe
      type_contenu: niv?.type || 'hizb',
      reference_id: refId,
      ordre: parseInt(row.ordre) || 99,
      // marqueur interne
      _code_niveau_attente: niv?.id ? null : codeN,
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// REGISTRE DES TEMPLATES
// ═══════════════════════════════════════════════════════════════
export const ALL_TEMPLATES = [
  TEMPLATE_NIVEAUX,
  TEMPLATE_INSTITUTEURS,
  TEMPLATE_ELEVES,
  TEMPLATE_PARENTS,
  TEMPLATE_PROGRAMMES,
].sort((a, b) => a.order - b.order);

// Map nom_onglet → template pour le parsing
export const TEMPLATES_BY_SHEET_NAME = Object.fromEntries(
  ALL_TEMPLATES.map(t => [t.sheet_name, t])
);

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════

// Normalise une ligne Excel (trim les strings, enlève undefined)
export function normalizeRow(row) {
  const out = {};
  Object.entries(row || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    out[k] = typeof v === 'string' ? v.trim() : v;
  });
  return out;
}

// Détecte les doublons dans un tableau de lignes selon unique_key
export function detectDuplicates(rows, uniqueKey) {
  if (!uniqueKey) return [];
  const seen = new Map();
  const dups = [];
  rows.forEach((row, idx) => {
    const val = (row[uniqueKey] || '').toString().trim().toLowerCase();
    if (!val) return;
    if (seen.has(val)) {
      dups.push({ rowIdx: idx, firstIdx: seen.get(val), key: uniqueKey, value: val });
    } else {
      seen.set(val, idx);
    }
  });
  return dups;
}
