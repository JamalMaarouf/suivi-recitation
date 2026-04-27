import { supabase } from './supabase';

// ══════════════════════════════════════════════════════════════════════
// HELPER RGPD EXPORT
//
// Génère un export JSON complet des données personnelles d'un utilisateur,
// conformément à l'article 20 du RGPD (droit à la portabilité).
//
// SCOPES supportés :
//   - 'self'                : uniquement les données de l'utilisateur
//                             (instituteur, surveillant)
//   - 'self_plus_children'  : données utilisateur + enfants mineurs
//                             (parent -> ses données + celles de ses enfants)
//
// Le JSON produit contient TOUJOURS :
//   - metadata : traçabilité légale (date, exportateur, base juridique)
//   - personne : données personnelles du user
//   - scope-specific : enfants, validations, certificats, consultations...
//
// Usage :
//   const { json, stats } = await generateRgpdExport(user, 'self_plus_children');
//   // json = objet structuré
//   // stats = { nb_enfants, nb_validations, nb_certificats }
//
// Le helper journalise automatiquement dans la table exports_rgpd.
// ══════════════════════════════════════════════════════════════════════

/**
 * Génère l'export RGPD JSON pour un utilisateur.
 *
 * @param {Object} user - L'utilisateur connecté (inclut id, role, ecole_id, etc.)
 * @param {'self'|'self_plus_children'} scope
 * @returns {Promise<{ json: Object, stats: Object, fileName: string }>}
 */
export async function generateRgpdExport(user, scope = 'self') {
  if (!user || !user.id) {
    throw new Error('Utilisateur requis pour l\'export RGPD');
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  // ─── 1. Métadonnées légales (toujours présentes) ──────────
  const metadata = {
    document: 'Export RGPD — Données personnelles',
    format_version: '1.0',
    export_date: now.toISOString(),
    exported_by: {
      id: user.id,
      prenom: user.prenom || '',
      nom: user.nom || '',
      role: user.role,
    },
    scope,
    legal_basis: {
      regulation: 'RGPD (UE) 2016/679 — Article 20 (droit à la portabilité)',
      complementary: 'Loi marocaine 09-08 (CNDP)',
      purpose: 'Restitution des données personnelles à la personne concernée',
      retention: 'Les données sont conservées tant que le compte utilisateur est actif. Suppression sur demande.',
    },
    instructions: {
      fr: 'Ce fichier contient l\'ensemble des données personnelles vous concernant, telles qu\'enregistrées dans l\'application « متابعة التحفيظ ». Vous pouvez l\'utiliser pour vos démarches, le transférer à un autre service, ou simplement en prendre connaissance. Pour toute question, contactez l\'administration de votre école.',
      ar: 'يحتوي هذا الملف على جميع البيانات الشخصية المتعلقة بك المسجلة في تطبيق « متابعة التحفيظ ». يمكنك استخدامه لأغراضك، ونقله إلى خدمة أخرى، أو مجرد الاطلاع عليه. لأي سؤال، اتصل بإدارة المدرسة.',
    },
  };

  // ─── 2. Données personnelles du user (toujours présentes) ──
  const [{ data: userData }, { data: ecole }] = await Promise.all([
    supabase.from('utilisateurs')
      .select('id,prenom,nom,role,telephone,identifiant,email,created_at,ecole_id,actif')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('ecoles')
      .select('id,nom,ville,adresse')
      .eq('id', user.ecole_id)
      .maybeSingle(),
  ]);

  const personne = {
    identifiants: {
      id: userData?.id,
      identifiant: userData?.identifiant || null,
      email: userData?.email || null,
    },
    etat_civil: {
      prenom: userData?.prenom || '',
      nom: userData?.nom || '',
    },
    contact: {
      telephone: userData?.telephone || null,
    },
    compte: {
      role: userData?.role,
      actif: userData?.actif !== false,
      cree_le: userData?.created_at || null,
    },
    ecole_rattachement: ecole ? {
      id: ecole.id,
      nom: ecole.nom,
      ville: ecole.ville || null,
    } : null,
  };

  // ─── 3. Structure du JSON final ─────────────────────────────
  const exportJson = {
    metadata,
    personne,
  };

  const stats = {
    nb_enfants: 0,
    nb_validations: 0,
    nb_certificats: 0,
  };

  // ─── 4. Scope 'self_plus_children' : enfants du parent ─────
  if (scope === 'self_plus_children' && user.role === 'parent') {
    // Trouver les enfants liés via parent_eleve
    const { data: liaisons } = await supabase
      .from('parent_eleve')
      .select('eleve_id')
      .eq('parent_id', user.id);

    const eleveIds = (liaisons || []).map(l => l.eleve_id);

    if (eleveIds.length > 0) {
      // Charger tous les enfants en parallèle
      const [
        { data: elevesData },
        { data: validationsData },
        { data: certificatsData },
        { data: recitationsData },
        { data: consultationsData },
      ] = await Promise.all([
        supabase.from('eleves')
          .select('id,prenom,nom,eleve_id_ecole,code_niveau,date_naissance,hizb_depart,tomon_depart,created_at')
          .in('id', eleveIds),
        supabase.from('validations')
          .select('id,eleve_id,type_validation,nombre_tomon,hizb_valide,date_validation,notes')
          .in('eleve_id', eleveIds)
          .order('date_validation', { ascending: false }),
        supabase.from('certificats_eleves')
          .select('id,eleve_id,jalon_id,date_emission,titre,type_certificat')
          .in('eleve_id', eleveIds),
        supabase.from('recitations_sourates')
          .select('id,eleve_id,type_recitation,date_validation')
          .in('eleve_id', eleveIds)
          .order('date_validation', { ascending: false }),
        // Consultations parent (historique de ses visites)
        supabase.from('consultations_parents')
          .select('id,date_visite,eleve_id,duree_secondes')
          .eq('parent_id', user.id)
          .order('date_visite', { ascending: false }),
      ]);

      const eleves = elevesData || [];
      const validations = validationsData || [];
      const certificats = certificatsData || [];
      const recitations = recitationsData || [];
      const consultations = consultationsData || [];

      // Grouper par enfant
      exportJson.enfants = eleves.map(e => ({
        identifiants: {
          id: e.id,
          numero_eleve: e.eleve_id_ecole || null,
        },
        etat_civil: {
          prenom: e.prenom || '',
          nom: e.nom || '',
          date_naissance: e.date_naissance || null,
        },
        scolarite: {
          niveau_actuel: e.code_niveau || null,
          hizb_depart: e.hizb_depart,
          tomon_depart: e.tomon_depart,
          inscrit_le: e.created_at || null,
        },
        validations: validations
          .filter(v => v.eleve_id === e.id)
          .map(v => ({
            id: v.id,
            date: v.date_validation,
            type: v.type_validation,
            nombre_tomon: v.nombre_tomon,
            hizb_valide: v.hizb_valide,
            notes: v.notes || null,
          })),
        recitations_sourates: recitations
          .filter(r => r.eleve_id === e.id)
          .map(r => ({
            id: r.id,
            date: r.date_validation,
            type_recitation: r.type_recitation,
          })),
        certificats: certificats
          .filter(c => c.eleve_id === e.id)
          .map(c => ({
            id: c.id,
            jalon_id: c.jalon_id,
            titre: c.titre,
            type: c.type_certificat,
            date_obtention: c.date_emission,
          })),
      }));

      // Historique des consultations du parent (accès aux fiches)
      exportJson.mon_historique_consultations = consultations.map(c => ({
        id: c.id,
        date_visite: c.date_visite,
        enfant_consulte_id: c.eleve_id || null,
        duree_secondes: c.duree_secondes || null,
      }));

      stats.nb_enfants = eleves.length;
      stats.nb_validations = validations.length;
      stats.nb_certificats = certificats.length;
    } else {
      exportJson.enfants = [];
      exportJson.mon_historique_consultations = [];
    }
  }

  // ─── 5. Stats récapitulatives (fin du document) ────────────
  exportJson.statistiques_export = {
    nb_enfants_inclus: stats.nb_enfants,
    nb_validations_incluses: stats.nb_validations,
    nb_certificats_inclus: stats.nb_certificats,
  };

  // ─── 6. Journalisation audit (async, non bloquant) ─────────
  const fileName = `export_rgpd_${user.prenom || ''}_${user.nom || ''}_${dateStr}.json`
    .toLowerCase()
    .replace(/\s+/g, '_');

  const fileContent = JSON.stringify(exportJson, null, 2);
  const fileSize = new Blob([fileContent]).size;

  // Log d'audit — on n'attend pas la réponse pour ne pas ralentir l'UX
  supabase.from('exports_rgpd').insert({
    user_id: user.id,
    ecole_id: user.ecole_id,
    export_scope: scope,
    export_role: user.role,
    nb_enfants: stats.nb_enfants,
    nb_validations: stats.nb_validations,
    nb_certificats: stats.nb_certificats,
    file_size_bytes: fileSize,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }).then(({ error }) => {
    if (error) console.warn('[RGPD] Audit log failed:', error);
  });

  return { json: exportJson, stats, fileName };
}

/**
 * Déclenche le téléchargement d'un export JSON dans le navigateur.
 */
export function downloadRgpdExport(json, fileName) {
  const blob = new Blob(
    [JSON.stringify(json, null, 2)],
    { type: 'application/json;charset=utf-8' }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
