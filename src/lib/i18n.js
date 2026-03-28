// Static translations (fallback) + dynamic translation support
// The app uses static translations for instant render,
// then Claude API translates any missing/new strings dynamically

export const translations = {
  fr: {
    dir: 'ltr', lang: 'fr', flag: '🇫🇷', name: 'Français',
    app_name: 'Suivi Récitation',
    login_title: 'Suivi Récitation',
    login_subtitle: 'Espace instituteurs & surveillance',
    identifiant: 'Identifiant',
    mot_de_passe: 'Mot de passe',
    se_connecter: 'Se connecter',
    connexion_en_cours: 'Connexion...',
    identifiant_incorrect: 'Identifiant ou mot de passe incorrect.',
    remplir_champs: 'Veuillez remplir tous les champs.',
    role_surveillant: 'Surveillant',
    role_instituteur: 'Instituteur',
    acces_complet: 'Accès complet',
    validation_suivi: 'Validation + suivi',
    express: 'Express',
    seance: 'Séance',
    calendrier: 'Calendrier',
    rapport: 'Rapport',
    gestion: 'Gestion',
    deconnexion: 'Déconnexion',
    honneur: 'Honneur',
    comparer: 'Comparer',
    tableau_de_bord: 'Tableau de bord',
    vue_generale: 'Vue générale',
    eleves: 'Élèves',
    instituteurs: 'Instituteurs',
    rapport_tab: 'Rapport',
    score_ecole: "Score global de l'école",
    points_cumules: 'points cumulés',
    tomon_recites: 'Tomon récités',
    hizb_complets: 'Hizb complets',
    tomon_semaine: 'Tomon cette semaine',
    hizb_ce_mois: 'Hizb ce mois',
    attente_hizb: 'Attente Hizb complet',
    inactifs: 'Inactifs +14j',
    podium: 'Podium',
    a_relancer: 'À relancer',
    tous_actifs: 'Tous actifs ✓',
    aucun_attente: 'Aucun en attente ✓',
    activite_recente: 'Activité récente',
    aucune_activite: 'Aucune activité.',
    valider: 'Valider',
    classement: 'Classement',
    score_groupe: 'Score du groupe',
    meilleur_eleve: 'Meilleur élève ⭐',
    alertes: 'Alertes intelligentes',
    eleve: 'Élève',
    niveau: 'Niveau',
    referent: 'Instituteur référent',
    acquis_anterieurs: 'Acquis antérieurs',
    hizb_depart: 'Hizb de départ',
    tomon_depart: 'Tomon de départ',
    inscrit_le: 'Inscrit le',
    position_actuelle: 'Position actuelle',
    hizb_en_cours: 'Hizb en cours',
    tomon_valides: 'Tomon validés',
    prochain: 'Prochain',
    statut: 'Statut',
    actif: 'Actif',
    inactif: 'Inactif',
    jamais: 'Jamais',
    derniere_recitation: 'Dernière récitation',
    badges: 'Badges',
    objectif_mensuel: 'Objectif mensuel',
    definir: 'Définir',
    annuler: 'Annuler',
    enregistrer: 'Enregistrer',
    objectif_atteint: '🎉 Objectif atteint !',
    aucun_objectif: 'Aucun objectif fixé',
    apercu: 'Aperçu',
    apprentissage: 'Apprentissage',
    evolution: 'Évolution',
    activite: 'Activité',
    historique: 'Historique',
    retour: '← Retour',
    imprimer_pdf: '🖨️ PDF',
    enregistrer_recitation: '+ Récitation',
    voir_fiche: 'Voir la fiche',
    retour_dashboard: 'Retour au tableau de bord',
    enregistrer_recitation_titre: 'Enregistrer une récitation',
    selectionner_eleve: "Sélectionner l'élève",
    rechercher_eleve: 'Rechercher un élève...',
    changer: 'Changer',
    tomon_recites_aujourd_hui: "Tomon récités aujourd'hui",
    valider_hizb_complet: 'Valider le Hizb complet',
    bonus_pts: '+100 pts bonus',
    deja_valide: 'Déjà validé',
    recite_aujourd_hui: "Récité aujourd'hui",
    a_venir: 'À venir',
    position_atteinte: 'Position atteinte →',
    continuer: 'Continuer',
    confirmer: '✓ Confirmer la validation',
    modifier: '← Modifier',
    recapitulatif: 'Récapitulatif',
    tomon_recites_label: 'Tomon récités',
    points_gagnes: 'Points gagnés',
    valide_par: 'Validé par',
    date_heure: 'Date & heure',
    hizb_suivant_ouvre: "Hizb suivant s'ouvre",
    nouvelle_recitation: '+ Nouvelle récitation',
    enregistrement: 'Enregistrement...',
    recitation_enregistree: 'Récitation enregistrée !',
    hizb_valide_titre: 'Hizb complet validé !',
    durees_apprentissage: "Durées d'apprentissage",
    ajouter_eleve: 'Ajouter un élève',
    modifier_eleve: "Modifier l'élève",
    eleves_inscrits: 'Élèves inscrits',
    ajouter_instituteur: 'Ajouter un instituteur',
    instituteurs_actifs: 'Instituteurs actifs',
    prenom: 'Prénom',
    nom_label: 'Nom',
    identifiant_label: 'Identifiant',
    ajouter_eleve_btn: "+ Ajouter l'élève",
    ajouter_instituteur_btn: "+ Ajouter l'instituteur",
    modifier_btn: 'Modifier',
    retirer: 'Retirer',
    enregistrer_modifications: 'Enregistrer les modifications',
    acquis_aide: 'Position dans le Coran avant de commencer le suivi',
    hizb_1_60: 'Hizb (1-60)',
    tomon_1_8: 'Tomon (1-8)',
    debutant: 'Débutant',
    intermediaire: 'Intermédiaire',
    avance: 'Avancé',
    choisir: '— Choisir —',
    eleve_ajoute: 'Élève ajouté avec succès.',
    eleve_modifie: 'Élève modifié avec succès.',
    eleve_retire: 'Élève retiré.',
    instituteur_ajoute: 'Instituteur ajouté avec succès.',
    instituteur_retire: 'Instituteur retiré.',
    erreur_ajout: "Erreur lors de l'ajout.",
    prenom_nom_obligatoires: 'Prénom et nom obligatoires.',
    tous_champs_obligatoires: 'Tous les champs sont obligatoires.',
    identifiant_utilise: 'Identifiant déjà utilisé.',
    supprimer_eleve_confirm: "Supprimer cet élève et tout son historique ?",
    supprimer_instituteur_confirm: "Supprimer cet instituteur ?",
    ma_seance: 'Ma séance du jour',
    cette_semaine: 'Cette semaine',
    eleves_vus: 'Élèves vus',
    tomon_valides_label: 'Tomon validés',
    hizb_complets_label: 'Hizb complets',
    pts_generes: 'Points générés',
    classement_seance: 'Classement de la séance',
    detail_validations: 'Détail des validations',
    a_voir_aujourd_hui: "À voir aujourd'hui",
    classement_semaine: 'Classement de la semaine',
    activite_par_jour: 'Activité par jour',
    rapport_mensuel: 'Rapport mensuel',
    imprimer_rapport: '🖨️ Imprimer rapport PDF',
    performance_objectifs: 'Performance et objectifs',
    performance_instituteurs: 'Performance par instituteur',
    objectif_label: 'Objectif',
    atteinte: 'Atteinte',
    score_mois: 'Score mois',
    aucun_instituteur: 'Aucun instituteur.',
    aucun_eleve: 'Aucun élève.',
    tableau_honneur: "Tableau d'honneur",
    gardiens_coran: 'Les Gardiens du Coran',
    classement_score: 'Classement par score de récitation',
    validation_express: '⚡ Validation Express',
    validation_express_aide: 'Recherchez un élève et validez en 2 clics',
    rechercher: 'Rechercher...',
    combien_tomon: 'Combien de Tomon récités ?',
    log_session: 'Log de la session',
    rechercher_commencer: 'Recherchez un élève pour commencer',
    suivi_apprentissage: 'Suivi début → validation par Tomon',
    debut_apprentissage: 'Début apprentissage',
    validation_label: 'Validation',
    duree: 'Durée',
    en_cours: 'En cours',
    duree_moy: 'Durée moy.',
    plus_rapide: 'Plus rapide',
    plus_long: 'Plus long',
    aucun_suivi: 'Aucun suivi enregistré.',
    activite_90: 'Activité — 90 derniers jours',
    faible: 'Faible',
    fort: 'Fort',
    streak_actuel: 'Streak actuel',
    jours_actifs: 'Jours actifs',
    moy_seance: 'Moy/séance',
    score_total: 'Score total',
    nb_eleves: 'élèves',
    hizb: 'Hizb',
    tomon: 'Tomon',
    pts: 'pts',
    pts_abrev: 'pts',
    hizb_abrev: 'Hizb',
    tomon_abrev: 'Tomon',
    hizb_complets_abrev: 'Hizb complets',
    actifs: 'Actifs',
    inactifs_filter: 'Inactifs',
    attente_filter: 'Attente Hizb',
    tous: 'Tous',
    tous_instituteurs: 'Tous les instituteurs',
    tous_statuts: 'Tous les statuts',
    tous_niveaux: 'Tous les niveaux',
    tri_score_desc: 'Score ↓',
    tri_score_asc: 'Score ↑',
    tri_hizb_desc: 'Hizb ↓',
    tri_hizb_asc: 'Hizb ↑',
    tri_nom: 'Nom A→Z',
    tri_recente: 'Récente',
    tri_inactif: 'Inactifs',
    eleves_referents: 'élèves référents',
    voir_profil: 'Voir profil →',
    pas_assez_donnees: 'Pas encore assez de données.',
    aucune_recitation_label: 'Aucune récitation.',
    en_attente: 'En attente',
    jour: 'j',
    jours: 'j',
    classement_complet: 'Classement complet',
    eleves_actifs: 'Élèves actifs',
    traduction_en_cours: 'Traduction en cours...',
    traduction_ok: 'Traduction appliquée ✓',
    effacer_cache: 'Effacer le cache',
    comparer_eleves: 'Comparaison des élèves',
    selectionner_comparer: "Sélectionnez jusqu'à 6 élèves",
    evolution_score: 'Évolution du score',
    tableau_comparatif: 'Tableau comparatif',
    classement_entre_eux: 'Classement entre eux',
  }
};

// Dynamic translation function
// Uses cache first, falls back to static, then requests from Claude
const dynamicCache = {};

export function t(lang, key) {
  if (lang === 'fr') return translations.fr[key] || key;
  // Check dynamic cache
  if (dynamicCache[lang]?.[key]) return dynamicCache[lang][key];
  // Check localStorage cache
  try {
    const stored = JSON.parse(localStorage.getItem('suivi_trans_cache') || '{}');
    if (stored[lang]?.[key]) {
      if (!dynamicCache[lang]) dynamicCache[lang] = {};
      dynamicCache[lang][key] = stored[lang][key];
      return stored[lang][key];
    }
  } catch {}
  // Fallback to French
  return translations.fr[key] || key;
}

export function loadCacheIntoMemory(lang) {
  try {
    const stored = JSON.parse(localStorage.getItem('suivi_trans_cache') || '{}');
    if (stored[lang]) {
      dynamicCache[lang] = stored[lang];
      return Object.keys(stored[lang]).length;
    }
  } catch {}
  return 0;
}

export function getDir(lang) {
  if (lang === 'ar') return 'rtl';
  return 'ltr';
}

export function getCachedLangs() {
  try {
    const stored = JSON.parse(localStorage.getItem('suivi_trans_cache') || '{}');
    return Object.keys(stored);
  } catch { return []; }
}

// Translate all keys for a language using Claude API
export async function translateAllKeys(targetLang) {
  if (targetLang === 'fr') return true;
  const langNames = {
    ar: 'Arabic (formal Islamic/Quranic Modern Standard Arabic, RTL)',
    en: 'English'
  };

  const frStrings = translations.fr;
  const existing = dynamicCache[targetLang] || {};

  // Find keys not yet translated
  const missing = Object.entries(frStrings)
    .filter(([k]) => !['dir','lang','flag','name'].includes(k) && !existing[k])
    .map(([k, v]) => ({ key: k, text: String(v) }));

  if (missing.length === 0) return true;

  const toTranslate = missing.map(({ key, text }) => `${key}|||${text}`).join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: `You are a professional translator for a Quran memorization tracking application.
Translate UI strings from French to ${langNames[targetLang]}.
Rules:
- Keep unchanged: Hizb, Tomon, Roboe, Nisf, Jouz — these are Quranic terms
- For Arabic: use formal Modern Standard Arabic (فصحى المعاصرة)
- Keep emojis as-is
- Keep symbols: → ← ↑ ↓ ✓ ✕ ⭐ 🔥 + unchanged
- Keep numbers and % unchanged
- Short UI strings — be concise and natural
- Return ONLY lines in format: key|||translation
- One translation per line, nothing else, no preamble`,
        messages: [{ role: 'user', content: `Translate to ${langNames[targetLang]}:\n\n${toTranslate}` }]
      })
    });

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';
    const result = { ...existing };

    rawText.split('\n').forEach(line => {
      const idx = line.indexOf('|||');
      if (idx > 0) {
        const key = line.substring(0, idx).trim();
        const val = line.substring(idx + 3).trim();
        if (key && val && frStrings[key] !== undefined) result[key] = val;
      }
    });

    // Save to memory and localStorage
    dynamicCache[targetLang] = result;
    try {
      const stored = JSON.parse(localStorage.getItem('suivi_trans_cache') || '{}');
      stored[targetLang] = result;
      localStorage.setItem('suivi_trans_cache', JSON.stringify(stored));
    } catch {}

    return true;
  } catch (err) {
    console.error('Translation API error:', err);
    return false;
  }
}
