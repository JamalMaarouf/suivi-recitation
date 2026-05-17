// ─── PAGE PUBLIQUE : POLITIQUE DE CONFIDENTIALITE ──────────────────────
// Page legale publique accessible via /privacy.
// Conforme RGPD (UE) + Loi marocaine 09-08 (CNDP).
// Bilingue FR / AR.
// Placeholders [NOM COMPLET], [VILLE], [EMAIL] a remplacer avant Prod.
import React, { useState, useEffect } from 'react';

export const PRIVACY_VERSION = '1.0';
export const PRIVACY_DATE = '2026-05-17';

export default function PagePrivacy({ onBack }) {
  const [lang, setLangRaw] = useState(() => localStorage.getItem('suivi_lang') || 'fr');
  const setLang = (l) => { setLangRaw(l); localStorage.setItem('suivi_lang', l); };
  const isAr = lang === 'ar';

  useEffect(() => {
    if (document.getElementById('privacy-fonts')) return;
    const link = document.createElement('link');
    link.id = 'privacy-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.body.style.background = '#FAF7F2';
    document.body.style.margin = 0;
  }, [isAr, lang]);

  const T = {
    bg: '#FAF7F2',
    primary: '#085041',
    primaryLight: '#1D9E75',
    text: '#1A1A1A',
    textBody: '#525252',
    textMuted: '#8A8A8A',
    border: 'rgba(0,0,0,0.08)',
    fontDisplay: isAr ? "'Tajawal', sans-serif" : "'Fraunces', Georgia, serif",
    fontBody: isAr ? "'Tajawal', sans-serif" : "'Manrope', -apple-system, sans-serif",
  };

  const Section = ({ num, titreFr, titreAr, children }) => (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        fontFamily: T.fontDisplay,
        fontSize: 22,
        fontWeight: 700,
        color: T.text,
        marginBottom: 14,
        letterSpacing: isAr ? 0 : -0.3,
      }}>
        <span style={{ color: T.primary, marginInlineEnd: 10 }}>{num}.</span>
        {isAr ? titreAr : titreFr}
      </h2>
      <div style={{ fontSize: 15, color: T.textBody, lineHeight: 1.75 }}>
        {children}
      </div>
    </section>
  );

  return (
    <div style={{
      background: T.bg,
      color: T.text,
      fontFamily: T.fontBody,
      minHeight: '100vh',
      direction: isAr ? 'rtl' : 'ltr',
      lineHeight: 1.6,
    }}>
      {/* Nav simple */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(250,247,242,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={onBack}
            style={{ background: 'transparent', border: `1px solid ${T.border}`, padding: '8px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600, color: T.text, cursor: 'pointer', fontFamily: T.fontBody }}>
            {isAr ? '← العودة' : '← Retour'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📖</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 700, color: T.text }}>
              {isAr ? 'متابعة التحفيظ' : 'Suivi Récitation'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, fontSize: 12 }}>
            <button onClick={() => setLang('fr')}
              style={{ background: lang === 'fr' ? T.text : 'transparent', color: lang === 'fr' ? T.bg : T.textMuted, border: 'none', padding: '6px 12px', borderRadius: 20, fontWeight: 600, cursor: 'pointer' }}>FR</button>
            <button onClick={() => setLang('ar')}
              style={{ background: lang === 'ar' ? T.text : 'transparent', color: lang === 'ar' ? T.bg : T.textMuted, border: 'none', padding: '6px 12px', borderRadius: 20, fontWeight: 600, cursor: 'pointer' }}>AR</button>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '60px 24px 80px' }}>
        {/* Title */}
        <h1 style={{
          fontFamily: T.fontDisplay,
          fontSize: 'clamp(32px, 5vw, 44px)',
          fontWeight: isAr ? 800 : 700,
          color: T.text,
          margin: '0 0 12px',
          letterSpacing: isAr ? 0 : -1,
          lineHeight: 1.15,
        }}>
          {isAr ? 'سياسة الخصوصية' : 'Politique de Confidentialité'}
        </h1>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 40 }}>
          {isAr ? `الإصدار ${PRIVACY_VERSION} — آخر تحديث: ${PRIVACY_DATE}` : `Version ${PRIVACY_VERSION} — Dernière mise à jour : ${PRIVACY_DATE}`}
        </div>

        {/* Préambule */}
        <div style={{
          background: '#fff',
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 40,
          fontSize: 14,
          color: T.textBody,
          lineHeight: 1.7,
        }}>
          {isAr
            ? 'يلتزم تطبيق « متابعة التحفيظ » بحماية البيانات الشخصية لمستعمليه. توضح هذه السياسة بشفافية كيف تُجمع البيانات، لماذا، ولأي مدة. تتوافق هذه السياسة مع القانون المغربي رقم 09-08 المتعلق بحماية المعطيات ذات الطابع الشخصي، واللائحة الأوروبية العامة لحماية البيانات (RGPD).'
            : 'L\'application « Suivi Récitation » s\'engage à protéger les données personnelles de ses utilisateurs. La présente politique explique en toute transparence quelles données sont collectées, pourquoi, et pour combien de temps. Cette politique est conforme à la loi marocaine n° 09-08 relative à la protection des données à caractère personnel et au Règlement Général sur la Protection des Données (RGPD) européen.'}
        </div>

        <Section num={1} titreFr="Responsable du traitement" titreAr="المسؤول عن المعالجة">
          <p>{isAr
            ? 'المسؤول عن معالجة البيانات الشخصية هو:'
            : 'Le responsable du traitement des données personnelles est :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0' }}>
            <li><strong>[NOM COMPLET]</strong></li>
            <li>{isAr ? 'المقر:' : 'Domicile :'} <strong>[VILLE]</strong>, {isAr ? 'المغرب' : 'Maroc'}</li>
            <li>{isAr ? 'البريد الإلكتروني:' : 'Email :'} <strong>[EMAIL DE CONTACT]</strong></li>
          </ul>
          <p style={{ marginTop: 12 }}>
            {isAr
              ? 'يقوم مقام مسؤول حماية البيانات (DPO) ويمكن الاتصال به على نفس البريد الإلكتروني.'
              : 'Il fait office de Délégué à la Protection des Données (DPO) et peut être contacté à la même adresse email.'}
          </p>
        </Section>

        <Section num={2} titreFr="Données collectées" titreAr="البيانات التي يتم جمعها">
          <p>{isAr
            ? 'تجمع المنصة الأنواع التالية من البيانات:'
            : 'La plateforme collecte les catégories suivantes de données :'}
          </p>
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.primary, marginBottom: 8 }}>
              {isAr ? 'بيانات المدرسة' : 'Données de l\'école'}
            </h3>
            <ul style={{ paddingInlineStart: 24, marginBottom: 16 }}>
              <li>{isAr ? 'اسم المدرسة' : 'Nom de l\'école'}</li>
              <li>{isAr ? 'العنوان (المدينة، البلد)' : 'Adresse (ville, pays)'}</li>
              <li>{isAr ? 'هاتف الاتصال، البريد الإلكتروني' : 'Téléphone de contact, email'}</li>
            </ul>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.primary, marginBottom: 8 }}>
              {isAr ? 'بيانات المستخدمين (المراقبين، الأساتذة)' : 'Données des utilisateurs (surveillants, instituteurs)'}
            </h3>
            <ul style={{ paddingInlineStart: 24, marginBottom: 16 }}>
              <li>{isAr ? 'الاسم، اللقب' : 'Prénom, nom'}</li>
              <li>{isAr ? 'معرف تسجيل الدخول، كلمة المرور (مشفّرة)' : 'Identifiant de connexion, mot de passe (chiffré)'}</li>
              <li>{isAr ? 'الدور (مراقب، أستاذ)' : 'Rôle (surveillant, instituteur)'}</li>
              <li>{isAr ? 'تاريخ ووقت آخر اتصال' : 'Date et heure de dernière connexion'}</li>
            </ul>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.primary, marginBottom: 8 }}>
              {isAr ? 'بيانات الطلاب' : 'Données des élèves'}
            </h3>
            <ul style={{ paddingInlineStart: 24, marginBottom: 16 }}>
              <li>{isAr ? 'الاسم، اللقب' : 'Prénom, nom'}</li>
              <li>{isAr ? 'تاريخ التسجيل، المستوى' : 'Date d\'inscription, niveau'}</li>
              <li>{isAr ? 'هاتف ولي الأمر (اختياري)' : 'Téléphone du parent (optionnel)'}</li>
              <li>{isAr ? 'بيانات الأداء: الاستظهارات، الحضور، الشهادات، النقاط' : 'Données de performance : récitations, présences, certificats, notes'}</li>
            </ul>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.primary, marginBottom: 8 }}>
              {isAr ? 'بيانات الأولياء' : 'Données des parents'}
            </h3>
            <ul style={{ paddingInlineStart: 24 }}>
              <li>{isAr ? 'البريد الإلكتروني (إذا تم تفعيل بوابة الأولياء)' : 'Email (si le portail parent est activé)'}</li>
              <li>{isAr ? 'تاريخ ووقت الاستشارات' : 'Date et heure des consultations'}</li>
            </ul>
          </div>
          <p style={{ marginTop: 16, fontWeight: 600, color: T.primary }}>
            {isAr
              ? '⚠ ملاحظة هامة: التطبيق لا يجمع أية بيانات بنكية، رقم الهوية الوطنية، أو معلومات حساسة (دين، صحة، الخ.).'
              : '⚠ Note importante : l\'Application ne collecte aucune donnée bancaire, numéro de carte d\'identité, ni information sensible (religion, santé, etc.).'}
          </p>
        </Section>

        <Section num={3} titreFr="Finalités du traitement" titreAr="غايات المعالجة">
          <p>{isAr
            ? 'تُجمع البيانات الشخصية للأغراض المشروعة التالية فقط:'
            : 'Les données personnelles sont collectées uniquement pour les finalités légitimes suivantes :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li><strong>{isAr ? 'تتبع تربوي:' : 'Suivi pédagogique :'}</strong> {isAr ? 'تسجيل تقدم الطلاب في تحفيظ القرآن الكريم.' : 'enregistrement de la progression des élèves dans l\'apprentissage du Coran.'}</li>
            <li><strong>{isAr ? 'إصدار الشهادات:' : 'Émission de certificats :'}</strong> {isAr ? 'إنشاء وثائق رسمية (PDF) عند نهاية الامتحانات أو إكمال أحزاب.' : 'génération de documents officiels (PDF) en fin d\'examens ou complétion de hizb.'}</li>
            <li><strong>{isAr ? 'إعلام الأولياء:' : 'Information des parents :'}</strong> {isAr ? 'إرسال إشعارات حول تقدم الأبناء (إن تم تفعيل البوابة).' : 'envoi de notifications sur la progression des enfants (si le portail est activé).'}</li>
            <li><strong>{isAr ? 'الأمن:' : 'Sécurité :'}</strong> {isAr ? 'تسجيل العمليات (audit log) لكشف الاستعمالات الشاذة.' : 'enregistrement des opérations (audit log) pour détecter les usages anormaux.'}</li>
            <li><strong>{isAr ? 'الإحصائيات:' : 'Statistiques :'}</strong> {isAr ? 'إحصائيات تربوية مجمعة، بدون إفصاح فردي خارج المدرسة.' : 'statistiques pédagogiques agrégées, sans divulgation individuelle hors de l\'école.'}</li>
          </ul>
        </Section>

        <Section num={4} titreFr="Base juridique" titreAr="الأساس القانوني">
          <p>{isAr
            ? 'تستند معالجة البيانات إلى الأسس القانونية التالية:'
            : 'Le traitement des données s\'appuie sur les bases juridiques suivantes :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li><strong>{isAr ? 'القبول:' : 'Consentement :'}</strong> {isAr ? 'قبول صريح للشروط العامة وسياسة الخصوصية عند التسجيل.' : 'acceptation explicite des conditions générales et de la politique de confidentialité lors de l\'inscription.'}</li>
            <li><strong>{isAr ? 'التنفيذ التعاقدي:' : 'Exécution contractuelle :'}</strong> {isAr ? 'تقديم خدمة التطبيق للمدرسة.' : 'fourniture du service applicatif à l\'école.'}</li>
            <li><strong>{isAr ? 'المصلحة المشروعة:' : 'Intérêt légitime :'}</strong> {isAr ? 'الأمن، تحسين الخدمة، مكافحة الاحتيال.' : 'sécurité, amélioration du service, lutte contre la fraude.'}</li>
          </ul>
        </Section>

        <Section num={5} titreFr="Destinataires des données" titreAr="مستلمو البيانات">
          <p>{isAr
            ? 'تبقى البيانات سرية. لا تُبيع، لا تُؤجر، ولا تُحول إلى طرف ثالث لأغراض تجارية. يُمكن الوصول إلى البيانات حصريا من قبل:'
            : 'Les données restent confidentielles. Elles ne sont jamais vendues, louées, ni transférées à un tiers à des fins commerciales. L\'accès aux données est exclusivement réservé à :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li>{isAr ? 'المستخدمون المرخصون داخل المدرسة (المراقبون، الأساتذة، الأولياء المعنيون)' : 'Les utilisateurs autorisés au sein de l\'école (surveillants, instituteurs, parents concernés)'}</li>
            <li>{isAr ? 'الناشر، فقط لأغراض الصيانة التقنية والدعم' : 'L\'éditeur, uniquement à des fins de maintenance technique et de support'}</li>
            <li>{isAr ? 'مستضيفو البنية التحتية: Vercel (الولايات المتحدة) و Supabase (الاتحاد الأوروبي)' : 'Les hébergeurs d\'infrastructure : Vercel (États-Unis) et Supabase (Union Européenne)'}</li>
            <li>{isAr ? 'السلطات القضائية، فقط في إطار طلب رسمي ومشروع' : 'Les autorités judiciaires, uniquement dans le cadre d\'une réquisition officielle et légitime'}</li>
          </ul>
        </Section>

        <Section num={6} titreFr="Durée de conservation" titreAr="مدة الاحتفاظ">
          <p>{isAr
            ? 'تُحفظ البيانات طوال مدة استعمال الخدمة من قبل المدرسة. عند إنهاء العقد:'
            : 'Les données sont conservées pendant toute la durée d\'utilisation du service par l\'école. En cas de résiliation :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li>{isAr ? 'مدة 30 يوم لطلب تصدير البيانات قبل الحذف النهائي' : '30 jours pour demander un export des données avant suppression définitive'}</li>
            <li>{isAr ? 'حذف نهائي للبيانات الشخصية (مع تسجيل قانوني للحذف في purges_rgpd_log)' : 'Suppression définitive des données personnelles (avec journalisation légale de la purge dans purges_rgpd_log)'}</li>
            <li>{isAr ? 'احتفاظ مؤقت بإحصائيات مجمعة (بدون بيانات شخصية) لأغراض إحصائية' : 'Conservation temporaire de statistiques agrégées (sans données personnelles) à des fins statistiques'}</li>
          </ul>
        </Section>

        <Section num={7} titreFr="Vos droits" titreAr="حقوقكم">
          <p>{isAr
            ? 'وفقا للقانون المغربي 09-08 واللائحة الأوروبية RGPD، تتمتعون بالحقوق التالية:'
            : 'Conformément à la loi marocaine 09-08 et au RGPD européen, vous disposez des droits suivants :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li><strong>{isAr ? 'حق الاطلاع:' : 'Droit d\'accès :'}</strong> {isAr ? 'الحصول على نسخة من بياناتكم الشخصية.' : 'obtenir une copie de vos données personnelles.'}</li>
            <li><strong>{isAr ? 'حق التصحيح:' : 'Droit de rectification :'}</strong> {isAr ? 'تصحيح بيانات غير صحيحة أو غير مكتملة.' : 'corriger des données inexactes ou incomplètes.'}</li>
            <li><strong>{isAr ? 'حق الحذف:' : 'Droit à l\'effacement :'}</strong> {isAr ? 'طلب حذف بياناتكم (تحت شروط).' : 'demander la suppression de vos données (sous conditions).'}</li>
            <li><strong>{isAr ? 'حق النقل (المادة 20 من RGPD):' : 'Droit à la portabilité (Article 20 RGPD) :'}</strong> {isAr ? 'استرجاع بياناتكم في صيغة JSON. متاح مباشرة في التطبيق عبر زر « تصدير RGPD ».' : 'récupérer vos données au format JSON. Disponible directement dans l\'Application via le bouton « Export RGPD ».'}</li>
            <li><strong>{isAr ? 'حق الاعتراض:' : 'Droit d\'opposition :'}</strong> {isAr ? 'الاعتراض على معالجة بياناتكم لأسباب مشروعة.' : 'vous opposer au traitement de vos données pour des motifs légitimes.'}</li>
            <li><strong>{isAr ? 'حق التحديد:' : 'Droit à la limitation :'}</strong> {isAr ? 'تقييد معالجة بياناتكم في حالات معينة.' : 'restreindre le traitement de vos données dans certains cas.'}</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            {isAr
              ? 'لممارسة هذه الحقوق، اكتبوا إلى:'
              : 'Pour exercer ces droits, écrivez à :'}
            {' '}<strong>[EMAIL DE CONTACT]</strong>
          </p>
          <p style={{ marginTop: 12, fontSize: 13, color: T.textMuted }}>
            {isAr
              ? 'سيتم الرد عليكم في غضون 30 يوما. في حالة عدم رضاكم، يمكنكم تقديم شكوى لدى اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي (CNDP) المغربية: www.cndp.ma'
              : 'Une réponse vous sera apportée sous 30 jours. En cas d\'insatisfaction, vous pouvez introduire une réclamation auprès de la Commission Nationale de contrôle de la Protection des Données à caractère Personnel (CNDP) marocaine : www.cndp.ma'}
          </p>
        </Section>

        <Section num={8} titreFr="Sécurité" titreAr="الأمن">
          <p>{isAr
            ? 'يطبق التطبيق إجراءات أمنية لحماية بياناتكم:'
            : 'L\'Application applique des mesures de sécurité pour protéger vos données :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li>{isAr ? 'اتصال مشفر HTTPS/TLS' : 'Connexion chiffrée HTTPS/TLS'}</li>
            <li>{isAr ? 'تشفير كلمات المرور (لا يمكن استعادتها)' : 'Mots de passe chiffrés (irrécupérables)'}</li>
            <li>{isAr ? 'فصل البيانات بين المدارس (كل مدرسة ترى بياناتها فقط)' : 'Cloisonnement des données entre écoles (chaque école ne voit que ses propres données)'}</li>
            <li>{isAr ? 'سجل التدقيق لكل العمليات الحساسة' : 'Journal d\'audit pour toutes les opérations sensibles'}</li>
            <li>{isAr ? 'نسخ احتياطية يومية' : 'Sauvegardes quotidiennes'}</li>
          </ul>
          <p style={{ marginTop: 12, fontSize: 13, color: T.textMuted }}>
            {isAr
              ? 'في حالة خرق أمني يؤثر على بياناتكم، سيتم إخطاركم في غضون 72 ساعة وفقا للقانون.'
              : 'En cas de violation de sécurité affectant vos données, vous serez notifié dans les 72 heures conformément à la loi.'}
          </p>
        </Section>

        <Section num={9} titreFr="Cookies et traceurs" titreAr="ملفات تعريف الارتباط (Cookies)">
          <p>{isAr
            ? 'يستعمل التطبيق فقط ملفات تعريف الارتباط (cookies) الضرورية لعمله: تسجيل جلسة المستخدم، تفضيل اللغة، الوضع غير المتصل. لا تُستعمل أية cookies تتبع، ولا أية أداة تحليل خارجية (Google Analytics، Facebook Pixel، الخ).'
            : 'L\'Application utilise uniquement les cookies strictement nécessaires à son fonctionnement : enregistrement de la session utilisateur, préférence de langue, mode hors-ligne. Aucun cookie de pistage n\'est utilisé, ni aucun outil d\'analyse externe (Google Analytics, Facebook Pixel, etc.).'}
          </p>
        </Section>

        <Section num={10} titreFr="Mineurs" titreAr="القاصرون">
          <p>{isAr
            ? 'بما أن التطبيق موجه لتعليم القرآن للأطفال، فإنه قد يحتوي على بيانات تخص قاصرين. تلتزم المدرسة بالحصول على موافقة الأولياء قبل إدخال هذه البيانات. الأولياء يمكنهم في أي وقت طلب الاطلاع على بيانات أبنائهم، تصحيحها أو حذفها.'
            : 'L\'Application étant destinée à l\'enseignement du Coran aux enfants, elle peut contenir des données concernant des mineurs. L\'école s\'engage à obtenir l\'accord des parents avant la saisie de ces données. Les parents peuvent à tout moment demander à consulter, rectifier ou supprimer les données de leurs enfants.'}
          </p>
        </Section>

        <Section num={11} titreFr="Transferts internationaux" titreAr="نقل البيانات دوليا">
          <p>{isAr
            ? 'بعض بيانات التطبيق تُستضاف على خوادم خارج المغرب:'
            : 'Certaines données de l\'Application sont hébergées sur des serveurs hors du Maroc :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li><strong>Vercel</strong> {isAr ? '(الولايات المتحدة الأمريكية): الواجهة وملفات النشر.' : '(États-Unis) : l\'interface et les fichiers de déploiement.'}</li>
            <li><strong>Supabase</strong> {isAr ? '(الاتحاد الأوروبي - إيرلندا): قاعدة البيانات والمصادقة.' : '(Union Européenne - Irlande) : la base de données et l\'authentification.'}</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            {isAr
              ? 'هؤلاء المزودون يلتزمون بمعايير حماية البيانات. عند الاقتضاء، نستعمل بنود تعاقدية نموذجية لتأطير عمليات النقل.'
              : 'Ces prestataires respectent les normes de protection des données. Le cas échéant, nous utilisons des clauses contractuelles types pour encadrer les transferts.'}
          </p>
        </Section>

        <Section num={12} titreFr="Modification de la politique" titreAr="تعديل السياسة">
          <p>{isAr
            ? 'قد تُحدّث هذه السياسة. سيتم إخطاركم بأي تعديل جوهري. تاريخ آخر تعديل يظهر في أعلى هذه الصفحة.'
            : 'Cette politique peut être mise à jour. Vous serez notifié de toute modification substantielle. La date de dernière modification figure en haut de cette page.'}
          </p>
        </Section>

        <Section num={13} titreFr="Contact" titreAr="الاتصال">
          <p>{isAr
            ? 'لأي سؤال أو طلب يتعلق بحماية بياناتكم الشخصية:'
            : 'Pour toute question ou demande relative à la protection de vos données personnelles :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0' }}>
            <li>{isAr ? 'البريد الإلكتروني:' : 'Email :'} <strong>[EMAIL DE CONTACT]</strong></li>
            <li>{isAr ? 'CNDP المغرب:' : 'CNDP Maroc :'} <a href="https://www.cndp.ma" target="_blank" rel="noopener noreferrer" style={{ color: T.primary, textDecoration: 'underline' }}>www.cndp.ma</a></li>
          </ul>
        </Section>

        {/* Footer note */}
        <div style={{
          marginTop: 60,
          padding: '20px 24px',
          background: 'rgba(8,80,65,0.04)',
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          fontSize: 13,
          color: T.textMuted,
          textAlign: 'center',
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}>
          {isAr
            ? `الإصدار ${PRIVACY_VERSION} — هذه السياسة سارية المفعول منذ ${PRIVACY_DATE}. تتوافق مع القانون المغربي 09-08 و RGPD.`
            : `Version ${PRIVACY_VERSION} — Cette politique est en vigueur depuis le ${PRIVACY_DATE}. Conforme à la loi marocaine 09-08 et au RGPD.`}
        </div>
      </main>
    </div>
  );
}
