import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { ALL_TEMPLATES, TEMPLATES_BY_SHEET_NAME, normalizeRow, detectDuplicates } from '../lib/importTemplates';
import BackButton from '../components/BackButton';

export default function ImportMasse({ user, navigate, goBack, lang='fr', isMobile }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState('intro'); // intro | preview | importing | done
  const [parseResult, setParseResult] = useState(null); // résultat du parsing + validation
  const [modeUpsert, setModeUpsert] = useState(false); // mettre à jour les doublons ?
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // ─── Téléchargement du modèle vierge ──────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    ALL_TEMPLATES.forEach(t => {
      // Ligne 1 : en-têtes
      const headers = t.columns.map(c => c.required ? `${c.key} *` : c.key);
      // Ligne 2 : aide
      const helps = t.columns.map(c => lang === 'ar' ? c.help_ar : c.help_fr);
      // Ligne 3 : exemple
      const examples = t.columns.map(c => c.example || '');

      const aoa = [headers, helps, examples];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Styling des largeurs
      ws['!cols'] = t.columns.map(c => ({ wch: Math.max(c.key.length + 4, 20) }));

      // Ligne 2 en italique/gris (aide)
      Object.keys(ws).forEach(cell => {
        if (cell.match(/^[A-Z]+2$/)) {
          ws[cell].s = { font: { italic: true, color: { rgb: '888888' }, sz: 10 } };
        }
      });

      XLSX.utils.book_append_sheet(wb, ws, t.sheet_name);
    });

    // Onglet Instructions
    const instructions = [
      [lang === 'ar' ? 'تعليمات الاستيراد' : 'Instructions d\'import'],
      [''],
      [lang === 'ar' ? '1. املأ كل ورقة بالبيانات المناسبة. الحقول المميزة بـ * إجبارية.' : '1. Remplissez chaque onglet avec vos données. Les colonnes marquées * sont obligatoires.'],
      [lang === 'ar' ? '2. لا تغيّر أسماء الأعمدة ولا ترتيبها.' : '2. Ne modifiez pas les noms de colonnes ni leur ordre.'],
      [lang === 'ar' ? '3. احذف الأسطر 2 و 3 (المساعدة والمثال) قبل الاستيراد (اختياري).' : '3. Vous pouvez supprimer les lignes 2 (aide) et 3 (exemple) avant l\'import (optionnel).'],
      [lang === 'ar' ? '4. ترتيب الاستيراد المقترح: Niveaux → Instituteurs → Eleves → Parents → Programmes.' : '4. Ordre recommandé : Niveaux → Instituteurs → Élèves → Parents → Programmes.'],
      [lang === 'ar' ? '5. المدرسون والآباء يحصلون على كلمة المرور الافتراضية للمدرسة.' : '5. Les instituteurs et parents reçoivent le mot de passe par défaut de l\'école.'],
      [lang === 'ar' ? '6. يمكنك ترك الأوراق التي لا تريد استيرادها فارغة (سيتم تجاهلها).' : '6. Vous pouvez laisser vides les onglets que vous ne voulez pas importer.'],
    ];
    const wsInst = XLSX.utils.aoa_to_sheet(instructions);
    wsInst['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsInst, lang === 'ar' ? 'تعليمات' : 'Instructions');

    // Générer et télécharger
    const fileName = `import_modele_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(lang === 'ar' ? '✅ تم تحميل النموذج' : '✅ Modèle téléchargé');
  };

  // ─── Parse + validation du fichier uploadé ────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // Charger le contexte DB (niveaux, instituteurs, élèves existants)
      toast.info(lang === 'ar' ? 'جاري التحقق...' : 'Analyse en cours...');
      const [{ data: niveauxDB }, { data: instituteursDB }, { data: elevesDB }, { data: utilisateursDB }, { data: souratesDB }] = await Promise.all([
        supabase.from('niveaux').select('id,code,nom,type,sens_recitation').eq('ecole_id', user.ecole_id),
        supabase.from('utilisateurs').select('id,identifiant,role').eq('ecole_id', user.ecole_id).eq('role', 'instituteur'),
        supabase.from('eleves').select('id,eleve_id_ecole').eq('ecole_id', user.ecole_id),
        supabase.from('utilisateurs').select('id,identifiant,role').eq('ecole_id', user.ecole_id),
        supabase.from('sourates').select('id,numero'),
      ]);

      const result = {
        sheets: [],
        totalValid: 0,
        totalErrors: 0,
      };

      // Lignes du fichier par onglet, pour les validations croisées (élèves peuvent référencer niveaux du fichier)
      const fileData = {};

      // Fonction de nettoyage des clés (enlever suffixe " *" pour colonnes obligatoires)
      const cleanKeys = (row) => {
        const out = {};
        Object.entries(row || {}).forEach(([k, v]) => {
          out[k.replace(/\s*\*\s*$/, '').trim()] = v;
        });
        return out;
      };

      // Première passe : parser tous les onglets connus
      ALL_TEMPLATES.forEach(t => {
        const ws = wb.Sheets[t.sheet_name];
        if (!ws) return;
        const rows = XLSX.utils.sheet_to_json(ws, { header: 0, defval: '' });
        // Normaliser + nettoyer les clés dès le début
        fileData[t.sheet_name] = rows.map(r => cleanKeys(normalizeRow(r)));
      });

      // Deuxième passe : validation + transformation
      // Les "xxxFichier" du ctx contiennent les lignes avec clés propres (sans " *")
      const ctx = {
        ecole_id: user.ecole_id,
        niveauxDB: niveauxDB || [],
        niveauxFichier: fileData['Niveaux'] || [],
        instituteursDB: instituteursDB || [],
        instituteursFichier: fileData['Instituteurs'] || [],
        elevesDB: elevesDB || [],
        elevesFichier: fileData['Eleves'] || [],
        souratesDB: souratesDB || [],
        utilisateursDB: utilisateursDB || [],
      };

      ALL_TEMPLATES.forEach(t => {
        const rawRows = fileData[t.sheet_name];
        if (!rawRows || rawRows.length === 0) return;

        // rawRows a déjà les clés nettoyées (sans " *") grâce au pré-traitement
        const parsed = rawRows.map((cleanRow, idx) => {
          const errors = [];

          // Détection ligne d'aide/exemple : si une valeur required fait plus de 40 chars ou contient des mots d'aide
          const firstReq = t.columns.find(c => c.required);
          if (firstReq) {
            const v = (cleanRow[firstReq.key] || '').toString();
            if (v.length > 40 || /obligatoire|format|example|help/i.test(v)) {
              return { rowNum: idx + 2, skip: true };
            }
          }

          // Ligne entièrement vide → skip silencieux
          const hasAnyValue = t.columns.some(c => {
            const v = cleanRow[c.key];
            return v !== undefined && v !== null && v.toString().trim() !== '';
          });
          if (!hasAnyValue) return { rowNum: idx + 2, skip: true };

          // Validation
          const validationErrors = t.validate(cleanRow, ctx);
          errors.push(...validationErrors);

          // Vérifier doublons avec DB (selon unique_key)
          if (t.unique_key && cleanRow[t.unique_key]) {
            const val = cleanRow[t.unique_key].toString().trim().toLowerCase();
            if (t.table === 'niveaux') {
              if ((niveauxDB||[]).some(n => (n.code||'').toLowerCase() === val)) {
                errors.push(`Niveau "${val}" existe déjà en base`);
              }
            } else if (t.sheet_name === 'Instituteurs' || t.sheet_name === 'Parents') {
              if ((utilisateursDB||[]).some(u => (u.identifiant||'').toLowerCase() === val)) {
                errors.push(`Identifiant "${val}" déjà utilisé`);
              }
            } else if (t.table === 'eleves') {
              if ((elevesDB||[]).some(e => (e.eleve_id_ecole||'').toLowerCase() === val)) {
                errors.push(`Numéro d'élève "${val}" déjà utilisé`);
              }
            }
          }

          let dbRow = null;
          if (errors.length === 0) {
            try { dbRow = t.toDBRow(cleanRow, ctx); }
            catch (e) { errors.push(`Erreur transformation : ${e.message}`); }
          }

          return {
            rowNum: idx + 2, // +2 car ligne 1 = entête, idx commence à 0
            original: cleanRow,
            dbRow,
            errors,
            valid: errors.length === 0,
          };
        }).filter(p => !p.skip);

        // Doublons au sein du fichier lui-même
        const fileDups = detectDuplicates(parsed.map(p => p.original), t.unique_key);
        fileDups.forEach(dup => {
          parsed[dup.rowIdx].errors.push(`Doublon dans le fichier : "${dup.value}" déjà à la ligne ${parsed[dup.firstIdx].rowNum}`);
          parsed[dup.rowIdx].valid = false;
        });

        const valid = parsed.filter(p => p.valid).length;
        const errs = parsed.length - valid;
        result.sheets.push({
          template: t,
          rows: parsed,
          valid,
          errors: errs,
        });
        result.totalValid += valid;
        result.totalErrors += errs;
      });

      setParseResult(result);
      setStep('preview');
    } catch (err) {
      console.error(err);
      toast.error((lang === 'ar' ? 'خطأ في قراءة الملف: ' : 'Erreur lecture fichier : ') + (err.message || 'inconnue'));
    }
    // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Exécution de l'import ────────────────────────────────────
  const executeImport = async () => {
    if (!parseResult) return;
    setImporting(true);
    const results = { created: {}, failed: {}, logs: [] };

    try {
      // Charger le mot de passe par défaut de l'école (pour instituteurs/parents)
      const { data: ecole } = await supabase.from('ecoles')
        .select('mdp_defaut_instituteurs, mdp_defaut_parents')
        .eq('id', user.ecole_id).maybeSingle();
      const mdpInst = ecole?.mdp_defaut_instituteurs || 'ecole2024';
      const mdpParent = ecole?.mdp_defaut_parents || 'parent2024';

      // Pour lier les élèves aux instituteurs créés dans le même import
      const instByIdentifiant = {};

      // Itérer dans l'ordre
      for (const sheet of parseResult.sheets.sort((a, b) => a.template.order - b.template.order)) {
        const t = sheet.template;
        const validRows = sheet.rows.filter(r => r.valid);
        if (validRows.length === 0) continue;

        results.logs.push(`📂 ${t.sheet_name} : ${validRows.length} ligne(s) à traiter...`);

        // Cas spéciaux selon la table
        if (t.table === 'utilisateurs' && t.sheet_name === 'Instituteurs') {
          // Hasher le mot de passe par défaut une fois
          let hashedMdp;
          try {
            const res = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'hash_password', password: mdpInst }),
            });
            const data = await res.json();
            hashedMdp = data.hashed;
          } catch (e) {
            results.logs.push(`  ❌ Impossible de hasher le mot de passe : ${e.message}`);
            results.failed[t.sheet_name] = validRows.length;
            continue;
          }

          // Insérer tous les instituteurs en batch
          const toInsert = validRows.map(r => ({ ...r.dbRow, mot_de_passe: hashedMdp }));
          const { data, error } = await supabase.from('utilisateurs').insert(toInsert).select('id,identifiant');
          if (error) {
            results.failed[t.sheet_name] = toInsert.length;
            results.logs.push(`  ❌ Échec insertion instituteurs : ${error.message}`);
          } else {
            results.created[t.sheet_name] = data.length;
            // Indexer pour les élèves suivants
            (data||[]).forEach(u => { instByIdentifiant[u.identifiant.toLowerCase()] = u.id; });
          }
          continue;
        }

        if (t.table === 'utilisateurs' && t.sheet_name === 'Parents') {
          // Hasher le mot de passe parent une fois
          let hashedMdp;
          try {
            const res = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'hash_password', password: mdpParent }),
            });
            const data = await res.json();
            hashedMdp = data.hashed;
          } catch (e) {
            results.logs.push(`  ❌ Impossible de hasher le mot de passe : ${e.message}`);
            results.failed[t.sheet_name] = validRows.length;
            continue;
          }

          // Insérer les parents 1 par 1 (car on doit aussi créer parent_eleve)
          let ok = 0, ko = 0;
          for (const r of validRows) {
            const payload = { ...r.dbRow, mot_de_passe: hashedMdp };
            const enfants = payload._enfants_attente || [];
            delete payload._enfants_attente;
            try {
              const { data: p, error } = await supabase.from('utilisateurs').insert(payload).select('id').single();
              if (error) throw new Error(error.message);
              const parentId = p.id;
              // Lier aux enfants
              for (const numEnfant of enfants) {
                const { data: eleve } = await supabase.from('eleves')
                  .select('id').eq('ecole_id', user.ecole_id).eq('eleve_id_ecole', numEnfant).maybeSingle();
                if (eleve) {
                  await supabase.from('parent_eleve').insert({ parent_id: parentId, eleve_id: eleve.id });
                }
              }
              ok++;
            } catch (e) {
              ko++;
              results.logs.push(`  ❌ ${payload.identifiant} : ${e.message}`);
            }
          }
          results.created[t.sheet_name] = ok;
          results.failed[t.sheet_name] = ko;
          continue;
        }

        if (t.table === 'eleves') {
          // Résoudre les instituteur_identifiant vers les UUIDs créés ou existants
          const toInsert = validRows.map(r => {
            const payload = { ...r.dbRow };
            const idAttente = payload._instituteur_identifiant_attente;
            delete payload._instituteur_identifiant_attente;
            if (idAttente && !payload.instituteur_referent_id && instByIdentifiant[idAttente]) {
              payload.instituteur_referent_id = instByIdentifiant[idAttente];
            }
            return payload;
          });
          const { error } = await supabase.from('eleves').insert(toInsert);
          if (error) {
            results.failed[t.sheet_name] = toInsert.length;
            results.logs.push(`  ❌ Échec insertion élèves : ${error.message}`);
          } else {
            results.created[t.sheet_name] = toInsert.length;
          }
          continue;
        }

        if (t.table === 'niveaux') {
          const toInsert = validRows.map(r => r.dbRow);
          const { data, error } = await supabase.from('niveaux').insert(toInsert).select();
          if (error) {
            results.failed[t.sheet_name] = toInsert.length;
            results.logs.push(`  ❌ Échec insertion niveaux : ${error.message}`);
          } else {
            results.created[t.sheet_name] = toInsert.length;
          }
          continue;
        }

        if (t.table === 'programmes') {
          // Résoudre niveau_id
          const { data: niveauxUpdated } = await supabase.from('niveaux')
            .select('id,code,type').eq('ecole_id', user.ecole_id);
          const toInsert = validRows.map(r => {
            const payload = { ...r.dbRow };
            if (!payload.niveau_id && payload._code_niveau_attente) {
              const niv = (niveauxUpdated||[]).find(n => (n.code||'').toUpperCase() === payload._code_niveau_attente);
              payload.niveau_id = niv?.id || null;
            }
            delete payload._code_niveau_attente;
            return payload;
          }).filter(p => p.niveau_id);
          if (toInsert.length > 0) {
            const { error } = await supabase.from('programmes').insert(toInsert);
            if (error) {
              results.failed[t.sheet_name] = toInsert.length;
              results.logs.push(`  ❌ Échec insertion programmes : ${error.message}`);
            } else {
              results.created[t.sheet_name] = toInsert.length;
            }
          }
          continue;
        }
      }

      setImportResult(results);
      setStep('done');
      toast.success(lang === 'ar' ? '✅ تم الاستيراد' : '✅ Import terminé');
    } catch (err) {
      console.error(err);
      toast.error((lang === 'ar' ? 'خطأ في الاستيراد: ' : 'Erreur d\'import : ') + (err.message || ''));
    } finally {
      setImporting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{padding: isMobile ? '12px' : '1.5rem', maxWidth: 1200, margin: '0 auto'}}>
      <BackButton onClick={goBack} lang={lang} isMobile={isMobile} />

      <h1 style={{fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#085041', marginBottom: 8}}>
        📥 {lang === 'ar' ? 'استيراد جماعي' : 'Import en masse'}
      </h1>
      <p style={{fontSize: 13, color: '#666', marginBottom: 24, lineHeight: 1.5}}>
        {lang === 'ar'
          ? 'استورد المستويات والطلاب والمدرسين والآباء من ملف Excel واحد. الأخطاء يتم الإبلاغ عنها بدقة دون حظر الأسطر الصحيحة.'
          : 'Importez niveaux, élèves, instituteurs, parents et programmes depuis un seul fichier Excel. Les erreurs sont signalées ligne par ligne sans bloquer les données valides.'}
      </p>

      {/* ÉTAPE 1 : INTRO + DOWNLOAD */}
      {step === 'intro' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.5rem'}}>
            <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:10}}>
              1️⃣ {lang === 'ar' ? 'حمّل النموذج' : 'Téléchargez le modèle'}
            </div>
            <p style={{fontSize:12,color:'#666',marginBottom:14}}>
              {lang === 'ar'
                ? 'ملف Excel يحتوي على ورقة لكل نوع من البيانات (Niveaux, Instituteurs, Eleves, Parents, Programmes) مع الأعمدة المطلوبة والأمثلة.'
                : 'Fichier Excel contenant un onglet par type de données (Niveaux, Instituteurs, Élèves, Parents, Programmes) avec les colonnes attendues et des exemples.'}
            </p>
            <button onClick={downloadTemplate}
              style={{padding:'12px 24px',background:'linear-gradient(135deg,#085041,#1D9E75)',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              ⬇️ {lang === 'ar' ? 'تحميل النموذج (.xlsx)' : 'Télécharger le modèle (.xlsx)'}
            </button>
          </div>

          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.5rem'}}>
            <div style={{fontSize:15,fontWeight:700,color:'#085041',marginBottom:10}}>
              2️⃣ {lang === 'ar' ? 'املأ الملف واستورده' : 'Remplissez puis importez'}
            </div>
            <p style={{fontSize:12,color:'#666',marginBottom:14}}>
              {lang === 'ar'
                ? 'بعد ملء البيانات، حمّل الملف هنا للتحقق التلقائي. ستظهر لك الأخطاء بالضبط قبل الاستيراد.'
                : 'Une fois rempli, uploadez le fichier ici pour une vérification automatique. Les erreurs s\'afficheront précisément avant l\'import.'}
            </p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
              onChange={handleFileSelect}
              style={{display:'none'}} />
            <button onClick={() => fileInputRef.current?.click()}
              style={{padding:'12px 24px',background:'#378ADD',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              📂 {lang === 'ar' ? 'اختيار ملف Excel' : 'Choisir un fichier Excel'}
            </button>
          </div>

          <div style={{background:'#FAEEDA',border:'0.5px solid #EF9F27',borderRadius:14,padding:'1rem 1.25rem'}}>
            <div style={{fontSize:12,color:'#633806',lineHeight:1.6}}>
              <strong>{lang === 'ar' ? '💡 ملاحظات:' : '💡 Notes :'}</strong>
              <ul style={{margin:'6px 0 0 0',paddingInlineStart:20}}>
                <li>{lang === 'ar' ? 'الملف لا يُخزَّن في الخادم — يتم معالجته في المتصفح فقط.' : 'Le fichier n\'est pas stocké sur le serveur — il est traité dans le navigateur uniquement.'}</li>
                <li>{lang === 'ar' ? 'المدرسون والآباء يستخدمون كلمة المرور الافتراضية للمدرسة.' : 'Les instituteurs et parents utilisent le mot de passe par défaut de l\'école.'}</li>
                <li>{lang === 'ar' ? 'يمكنك ترك الأوراق التي لا تستورد فارغة.' : 'Vous pouvez laisser vides les onglets que vous n\'importez pas.'}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ÉTAPE 2 : PREVIEW */}
      {step === 'preview' && parseResult && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:'#fff',border:'0.5px solid #e0e0d8',borderRadius:14,padding:'1.25rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:10}}>
              <div style={{fontSize:15,fontWeight:700,color:'#085041'}}>
                📊 {lang === 'ar' ? 'نتيجة التحقق' : 'Résultat de la validation'}
              </div>
              <div style={{display:'flex',gap:10,fontSize:13,fontWeight:700}}>
                <span style={{color:'#1D9E75'}}>✅ {parseResult.totalValid} {lang==='ar'?'صحيحة':'valides'}</span>
                {parseResult.totalErrors > 0 && (
                  <span style={{color:'#E24B4A'}}>❌ {parseResult.totalErrors} {lang==='ar'?'خطأ':'erreurs'}</span>
                )}
              </div>
            </div>

            {/* Détails par onglet */}
            {parseResult.sheets.map(sheet => (
              <div key={sheet.template.sheet_name} style={{marginTop:14,borderTop:'0.5px solid #e0e0d8',paddingTop:12}}>
                <div style={{fontWeight:700,fontSize:13,color:'#333',marginBottom:6}}>
                  📂 {lang === 'ar' ? sheet.template.label_ar : sheet.template.label_fr}
                  <span style={{marginInlineStart:10,fontSize:12,color:'#1D9E75',fontWeight:600}}>
                    {sheet.valid} ✅
                  </span>
                  {sheet.errors > 0 && (
                    <span style={{marginInlineStart:6,fontSize:12,color:'#E24B4A',fontWeight:600}}>
                      {sheet.errors} ❌
                    </span>
                  )}
                </div>
                {/* Afficher les lignes avec erreurs */}
                {sheet.rows.filter(r => !r.valid).length > 0 && (
                  <div style={{background:'#FCEBEB',borderRadius:8,padding:'8px 12px',marginTop:6}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#A32D2D',marginBottom:4}}>
                      {lang === 'ar' ? 'الأسطر التي بها أخطاء:' : 'Lignes avec erreurs :'}
                    </div>
                    <div style={{maxHeight:150,overflowY:'auto'}}>
                      {sheet.rows.filter(r => !r.valid).map((r, idx) => (
                        <div key={idx} style={{fontSize:11,color:'#A32D2D',marginBottom:3,fontFamily:'monospace'}}>
                          <strong>{lang==='ar'?'السطر':'Ligne'} {r.rowNum} :</strong> {r.errors.join(' · ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Boutons action */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button onClick={() => { setParseResult(null); setStep('intro'); }}
              style={{padding:'10px 20px',border:'0.5px solid #e0e0d8',borderRadius:10,background:'#fff',color:'#666',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              ← {lang === 'ar' ? 'رجوع' : 'Retour'}
            </button>
            {parseResult.totalValid > 0 && (
              <button onClick={executeImport} disabled={importing}
                style={{padding:'10px 20px',background:'#1D9E75',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:importing?'wait':'pointer',fontFamily:'inherit',opacity:importing?0.7:1}}>
                {importing
                  ? (lang === 'ar' ? '⏳ جاري الاستيراد...' : '⏳ Import en cours...')
                  : `✅ ${lang === 'ar' ? `استيراد ${parseResult.totalValid} سطر صحيح` : `Importer les ${parseResult.totalValid} lignes valides`}`
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* ÉTAPE 3 : RÉSULTAT */}
      {step === 'done' && importResult && (
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:'#E1F5EE',border:'0.5px solid #1D9E75',borderRadius:14,padding:'1.5rem'}}>
            <div style={{fontSize:18,fontWeight:800,color:'#085041',marginBottom:10}}>
              🎉 {lang === 'ar' ? 'الاستيراد اكتمل' : 'Import terminé'}
            </div>
            {Object.entries(importResult.created).map(([sheet, count]) => (
              <div key={sheet} style={{fontSize:13,color:'#085041',marginBottom:4}}>
                ✅ <strong>{sheet}</strong> : {count} {lang==='ar'?'سطر تم إنشاؤه':'ligne(s) créée(s)'}
              </div>
            ))}
            {Object.entries(importResult.failed).filter(([_, c]) => c > 0).length > 0 && (
              <div style={{marginTop:10,paddingTop:10,borderTop:'0.5px solid #9FE1CB'}}>
                {Object.entries(importResult.failed).filter(([_, c]) => c > 0).map(([sheet, count]) => (
                  <div key={sheet} style={{fontSize:13,color:'#A32D2D',marginBottom:4}}>
                    ❌ <strong>{sheet}</strong> : {count} {lang==='ar'?'فشل':'échec(s)'}
                  </div>
                ))}
              </div>
            )}
            {importResult.logs.length > 0 && (
              <details style={{marginTop:12}}>
                <summary style={{cursor:'pointer',fontSize:12,color:'#085041',fontWeight:600}}>
                  📋 {lang === 'ar' ? 'سجل التنفيذ' : 'Journal d\'exécution'}
                </summary>
                <div style={{marginTop:8,background:'#fff',borderRadius:8,padding:'10px',maxHeight:250,overflowY:'auto'}}>
                  {importResult.logs.map((l, i) => (
                    <div key={i} style={{fontSize:11,fontFamily:'monospace',marginBottom:3,color:'#555'}}>{l}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={() => { setImportResult(null); setParseResult(null); setStep('intro'); }}
              style={{padding:'10px 20px',background:'#378ADD',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              🔄 {lang === 'ar' ? 'استيراد جديد' : 'Nouvel import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
