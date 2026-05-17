// ─── PAGE PUBLIQUE : CONDITIONS GENERALES D'UTILISATION ──────────────────
// Page legale publique accessible via /terms.
// Bilingue FR / AR avec toggle.
// Placeholders [NOM COMPLET], [VILLE], [EMAIL] a remplacer avant Prod.
import React, { useState, useEffect } from 'react';

// Version des CGU - incrémenter quand on modifie le contenu
// (les ecoles devront re-accepter si la version change)
export const CGU_VERSION = '1.0';
export const CGU_DATE = '2026-05-17';

export default function PageTerms({ onBack }) {
  const [lang, setLangRaw] = useState(() => localStorage.getItem('suivi_lang') || 'fr');
  const setLang = (l) => { setLangRaw(l); localStorage.setItem('suivi_lang', l); };
  const isAr = lang === 'ar';

  useEffect(() => {
    if (document.getElementById('terms-fonts')) return;
    const link = document.createElement('link');
    link.id = 'terms-fonts';
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
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${T.primary}, #1D9E75)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📖</div>
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
          {isAr ? 'الشروط العامة للاستخدام' : 'Conditions Générales d\'Utilisation'}
        </h1>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 40 }}>
          {isAr ? `الإصدار ${CGU_VERSION} — آخر تحديث: ${CGU_DATE}` : `Version ${CGU_VERSION} — Dernière mise à jour : ${CGU_DATE}`}
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
            ? 'بالولوج إلى تطبيق « متابعة التحفيظ » واستعماله، فإن المستعمل (المدرسة أو المستخدم النهائي) يصرح بأنه قد قرأ هذه الشروط العامة وقبلها بشكل كامل ودون تحفظ.'
            : 'En accédant à et en utilisant l\'application « Suivi Récitation », l\'utilisateur (l\'école ou l\'utilisateur final) déclare avoir lu, compris et accepté sans réserve les présentes Conditions Générales d\'Utilisation.'}
        </div>

        <Section num={1} titreFr="Objet" titreAr="الموضوع">
          <p>{isAr
            ? 'يحدد هذا العقد الشروط القانونية لاستعمال تطبيق « متابعة التحفيظ » (يشار إليه فيما يلي بـ « التطبيق »)، الذي يهدف إلى تتبع تحفيظ القرآن الكريم في المدارس القرآنية. يشمل التطبيق وظائف لتسجيل الاستظهار، تتبع الحضور، إصدار الشهادات، والإحصائيات.'
            : 'Le présent contrat définit les conditions juridiques d\'utilisation de l\'application « Suivi Récitation » (ci-après désignée « l\'Application »), destinée au suivi de la mémorisation du Coran dans les écoles coraniques. L\'Application comprend des fonctionnalités d\'enregistrement de récitations, de suivi de présence, d\'émission de certificats, et de statistiques.'}
          </p>
        </Section>

        <Section num={2} titreFr="Éditeur" titreAr="الناشر">
          <p>{isAr
            ? 'يُحرَّر التطبيق وينشر من طرف:'
            : 'L\'Application est éditée et publiée par :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0' }}>
            <li><strong>[NOM COMPLET]</strong> ({isAr ? 'شخص ذاتي' : 'personne physique'})</li>
            <li>{isAr ? 'المقر:' : 'Domicile :'} <strong>[VILLE]</strong>, {isAr ? 'المغرب' : 'Maroc'}</li>
            <li>{isAr ? 'البريد الإلكتروني:' : 'Email :'} <strong>contact@tartily.com</strong></li>
          </ul>
          <p style={{ fontSize: 13, color: T.textMuted, marginTop: 12, fontStyle: 'italic' }}>
            {isAr
              ? 'ملاحظة: يستضاف التطبيق على خوادم Vercel (الولايات المتحدة) وSupabase (الاتحاد الأوروبي).'
              : 'Note : l\'Application est hébergée sur les serveurs Vercel (États-Unis) et Supabase (Union Européenne).'}
          </p>
        </Section>

        <Section num={3} titreFr="Acceptation des conditions" titreAr="قبول الشروط">
          <p>{isAr
            ? 'يُلزم استعمال التطبيق القبول الكامل وغير المشروط لهذه الشروط. عند تسجيل المدرسة، يصادق المراقب العام صراحةً على هذه الشروط بالنقر على خانة التصديق المخصصة لذلك. هذا القبول قابل للإثبات قانونيا (تخزين تاريخ ووقت القبول).'
            : 'L\'utilisation de l\'Application implique l\'acceptation pleine et entière des présentes conditions. Lors de l\'inscription de l\'école, le surveillant général valide expressément ces conditions en cochant la case prévue à cet effet. Cette acceptation est juridiquement opposable (la date et l\'heure d\'acceptation sont enregistrées).'}
          </p>
        </Section>

        <Section num={4} titreFr="Compte utilisateur" titreAr="حساب المستخدم">
          <p>{isAr
            ? 'إنشاء حساب مدرسة يخضع لمصادقة المسؤول العام عن المنصة. تتعهد المدرسة بـ:'
            : 'La création d\'un compte école est soumise à validation par l\'administrateur général de la plateforme. L\'école s\'engage à :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li>{isAr ? 'تقديم معلومات صحيحة ودقيقة ومحدّثة' : 'fournir des informations exactes, précises et à jour'}</li>
            <li>{isAr ? 'الحفاظ على سرية كلمة المرور' : 'préserver la confidentialité de son mot de passe'}</li>
            <li>{isAr ? 'إخطار الناشر فورًا بأي استعمال غير مصرح به للحساب' : 'notifier l\'éditeur immédiatement de toute utilisation non autorisée du compte'}</li>
            <li>{isAr ? 'تحمل المسؤولية الكاملة عن كل النشاط الذي يتم من حسابها' : 'assumer la pleine responsabilité de toute activité effectuée depuis son compte'}</li>
          </ul>
        </Section>

        <Section num={5} titreFr="Utilisation acceptable" titreAr="الاستخدام المقبول">
          <p>{isAr
            ? 'يلتزم المستخدم باستعمال التطبيق فقط للأغراض التربوية المتعلقة بتحفيظ القرآن الكريم. يُمنع منعا كليا:'
            : 'L\'utilisateur s\'engage à utiliser l\'Application uniquement à des fins pédagogiques liées au tahfîz du Saint Coran. Il est strictement interdit de :'}
          </p>
          <ul style={{ paddingInlineStart: 24, margin: '12px 0', lineHeight: 1.8 }}>
            <li>{isAr ? 'استعمال التطبيق لأغراض تجارية بدون موافقة كتابية' : 'utiliser l\'Application à des fins commerciales sans accord écrit'}</li>
            <li>{isAr ? 'محاولة الوصول غير المصرح به لبيانات مدارس أخرى' : 'tenter d\'accéder de manière non autorisée aux données d\'autres écoles'}</li>
            <li>{isAr ? 'إدخال بيانات كاذبة أو مضللة بشكل مقصود' : 'introduire intentionnellement des données fausses ou trompeuses'}</li>
            <li>{isAr ? 'محاولة اختراق أو تعطيل التطبيق بأي طريقة' : 'tenter de pirater ou de perturber l\'Application par quelque moyen que ce soit'}</li>
            <li>{isAr ? 'استعمال التطبيق لأي نشاط مخالف للقانون المغربي' : 'utiliser l\'Application pour toute activité contraire à la législation marocaine'}</li>
          </ul>
        </Section>

        <Section num={6} titreFr="Propriété intellectuelle" titreAr="الملكية الفكرية">
          <p>{isAr
            ? 'يبقى التطبيق وجميع عناصره (الشيفرة المصدرية، التصميم، الشعارات، النصوص، الأيقونات) ملكا حصريا للناشر [NOM COMPLET]. يُمنح للمستخدم حق استعمال غير حصري وغير قابل للنقل، يقتصر على المدة التي يستعمل فيها التطبيق.'
            : 'L\'Application et l\'ensemble de ses éléments (code source, design, logos, textes, icônes) demeurent la propriété exclusive de l\'éditeur [NOM COMPLET]. Il est accordé à l\'utilisateur un droit d\'utilisation non exclusif et non cessible, limité à la durée d\'utilisation de l\'Application.'}
          </p>
          <p style={{ marginTop: 12 }}>
            {isAr
              ? 'بالمقابل، تبقى البيانات التي تُدخلها المدرسة (أسماء الطلاب، الأداءات، الشهادات الصادرة) ملكا للمدرسة. يلتزم الناشر بعدم استعمالها لأغراض أخرى غير تشغيل الخدمة.'
              : 'En revanche, les données saisies par l\'école (noms des élèves, performances, certificats émis) demeurent la propriété de l\'école. L\'éditeur s\'engage à ne pas les utiliser à d\'autres fins que le fonctionnement du service.'}
          </p>
        </Section>

        <Section num={7} titreFr="Disponibilité et maintenance" titreAr="التوفر والصيانة">
          <p>{isAr
            ? 'يبذل الناشر جهوده لضمان توفر التطبيق على مدار 24/7. غير أنه لا يضمن توفرا غير منقطع. قد يخضع التطبيق لتوقفات تقنية للصيانة أو التحديث، يخطر بها مسبقا قدر الإمكان.'
            : 'L\'éditeur fait ses meilleurs efforts pour assurer la disponibilité de l\'Application 24/7. Néanmoins, il ne garantit pas une disponibilité ininterrompue. L\'Application peut faire l\'objet d\'interruptions techniques pour maintenance ou mise à jour, notifiées dans la mesure du possible.'}
          </p>
        </Section>

        <Section num={8} titreFr="Limitation de responsabilité" titreAr="حدود المسؤولية">
          <p>{isAr
            ? 'لا يتحمل الناشر مسؤولية الأضرار غير المباشرة الناتجة عن استعمال التطبيق، بما في ذلك على سبيل المثال لا الحصر: فقدان البيانات بسبب خطأ المستخدم، تعطل بسبب الاتصال بالأنترنت، تأخر في إصدار الشهادات. تظل المدرسة مسؤولة عن صحة المعلومات التي تدخلها.'
            : 'L\'éditeur ne saurait être tenu responsable des dommages indirects résultant de l\'utilisation de l\'Application, incluant notamment : la perte de données causée par une erreur de l\'utilisateur, une indisponibilité due à la connexion Internet, un retard dans l\'émission de certificats. L\'école demeure responsable de l\'exactitude des informations qu\'elle saisit.'}
          </p>
          <p style={{ marginTop: 12 }}>
            {isAr
              ? 'في جميع الأحوال، فإن مسؤولية الناشر، إن وجدت، لن تتجاوز مجموع المبالغ المدفوعة من قبل المستخدم خلال السنة السابقة للحادث (إن وجدت).'
              : 'En tout état de cause, la responsabilité de l\'éditeur, si elle est engagée, ne saurait excéder le total des sommes versées par l\'utilisateur au cours de l\'année précédant l\'incident (le cas échéant).'}
          </p>
        </Section>

        <Section num={9} titreFr="Tarification" titreAr="التسعيرة">
          <p>{isAr
            ? 'التطبيق متاح حاليا مجانا للمدارس القرآنية. قد يفرض الناشر في المستقبل مساهمة رمزية للمشاركة في تكاليف الاستضافة والصيانة. سيتم إخطار المدارس مسبقًا قبل أي تغيير، وستستفيد المدارس المسجلة قبل التحول من شروط امتيازية.'
            : 'L\'Application est actuellement mise gratuitement à disposition des écoles coraniques. L\'éditeur pourra à l\'avenir instaurer une contribution forfaitaire modique pour participer aux frais d\'hébergement et de maintenance. Les écoles seront notifiées préalablement à tout changement, et celles inscrites avant cette transition bénéficieront de conditions privilégiées.'}
          </p>
        </Section>

        <Section num={10} titreFr="Données personnelles" titreAr="البيانات الشخصية">
          <p>{isAr
            ? 'تخضع معالجة البيانات الشخصية لسياسة الخصوصية المنشورة بشكل منفصل، والمتوافقة مع القانون المغربي رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي، وكذا اللائحة العامة الأوروبية لحماية البيانات (RGPD) عند الاقتضاء.'
            : 'Le traitement des données personnelles est régi par la Politique de Confidentialité publiée séparément, conforme à la loi marocaine n° 09-08 relative à la protection des personnes physiques à l\'égard du traitement des données à caractère personnel, ainsi qu\'au Règlement Général sur la Protection des Données (RGPD) le cas échéant.'}
          </p>
        </Section>

        <Section num={11} titreFr="Résiliation" titreAr="الفسخ">
          <p>{isAr
            ? 'يمكن لكل من الناشر والمدرسة فسخ هذا العقد في أي وقت. في حالة الفسخ من طرف المدرسة، يمكنها طلب تصدير بياناتها قبل الحذف. الناشر يحتفظ بحق تعليق أو إنهاء حساب يخالف هذه الشروط.'
            : 'L\'éditeur comme l\'école peuvent résilier le présent contrat à tout moment. En cas de résiliation par l\'école, celle-ci peut demander l\'export de ses données avant suppression. L\'éditeur se réserve le droit de suspendre ou supprimer un compte contrevenant aux présentes conditions.'}
          </p>
        </Section>

        <Section num={12} titreFr="Modification des conditions" titreAr="تعديل الشروط">
          <p>{isAr
            ? 'يحتفظ الناشر بحق تعديل هذه الشروط في أي وقت. ستُخطر المدارس بأي تعديل جوهري عبر بريد إلكتروني أو إشعار في التطبيق. الاستمرار في استعمال التطبيق بعد التعديل يعتبر قبولا للشروط الجديدة.'
            : 'L\'éditeur se réserve le droit de modifier les présentes conditions à tout moment. Les écoles seront notifiées de toute modification substantielle par email ou notification dans l\'Application. Le maintien de l\'utilisation de l\'Application après modification vaut acceptation des nouvelles conditions.'}
          </p>
        </Section>

        <Section num={13} titreFr="Droit applicable et juridiction" titreAr="القانون المطبق والاختصاص القضائي">
          <p>{isAr
            ? 'يخضع هذا العقد للقانون المغربي. في حالة نزاع، يلتزم الطرفان أولا بمحاولة حل ودي. عند تعذر ذلك، تكون محاكم [VILLE] هي المختصة حصريا.'
            : 'Le présent contrat est régi par le droit marocain. En cas de litige, les parties s\'engagent à tenter une résolution amiable. À défaut, les tribunaux de [VILLE] seront seuls compétents.'}
          </p>
        </Section>

        <Section num={14} titreFr="Contact" titreAr="الاتصال">
          <p>{isAr
            ? 'لأي سؤال أو طلب يتعلق بهذه الشروط، يُرجى الاتصال على:'
            : 'Pour toute question ou demande relative à ces conditions, veuillez contacter :'}
            {' '}<strong>contact@tartily.com</strong>
          </p>
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
            ? `الإصدار ${CGU_VERSION} — هذه الشروط سارية المفعول منذ ${CGU_DATE}.`
            : `Version ${CGU_VERSION} — Ces conditions sont en vigueur depuis le ${CGU_DATE}.`}
        </div>
      </main>
    </div>
  );
}
