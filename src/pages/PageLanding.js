// ─── LANDING PAGE ──────────────────────────────────────────────────────────────
// Page d'accueil publique pour les visiteurs non-connectes.
// Aesthetic : "Editorial refined" - element traditionnel + sobriete moderne.
//   - Pas un SaaS generique (Stripe-like avec gradients violets)
//   - Pas du religieux lourd (calligraphies/motifs charges)
//   - Synthese : elegance editoriale + accents dores discrets + generosite spatiale
// Bilingue FR/AR avec toggle.
import React, { useState, useEffect } from 'react';

export default function PageLanding({ onGoToLogin }) {
  const [lang, setLangRaw] = useState(() => localStorage.getItem('suivi_lang') || 'fr');
  const setLang = (l) => { setLangRaw(l); localStorage.setItem('suivi_lang', l); };
  const isAr = lang === 'ar';

  // Charger Google Fonts une seule fois
  useEffect(() => {
    if (document.getElementById('landing-fonts')) return;
    const link = document.createElement('link');
    link.id = 'landing-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Manrope:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap';
    document.head.appendChild(link);
  }, []);

  // Definir dir et fond pour la landing
  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.body.style.background = '#FAF7F2';
    document.body.style.margin = 0;
  }, [isAr, lang]);

  const T = {
    // Couleurs
    bg: '#FAF7F2',         // creme chaude
    bgAlt: '#F5EFE5',      // creme plus marquee
    bgDeep: '#0A2F26',     // vert tres profond (footer/CTA)
    primary: '#085041',
    primaryLight: '#1D9E75',
    gold: '#C8941A',       // or plus discret/sobre
    goldLight: '#EF9F27',
    text: '#1A1A1A',
    textBody: '#525252',
    textMuted: '#8A8A8A',
    // Typo
    fontDisplay: isAr ? "'Tajawal', sans-serif" : "'Fraunces', Georgia, serif",
    fontBody: isAr ? "'Tajawal', sans-serif" : "'Manrope', -apple-system, sans-serif",
  };

  // Container max-width et padding standards
  const containerStyle = {
    maxWidth: 1140,
    margin: '0 auto',
    padding: '0 24px',
  };

  return (
    <div style={{
      background: T.bg,
      color: T.text,
      fontFamily: T.fontBody,
      minHeight: '100vh',
      direction: isAr ? 'rtl' : 'ltr',
      lineHeight: 1.6,
    }}>

      {/* ─────────────── NAV / HEADER ─────────────── */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(250,247,242,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{...containerStyle, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12}}>
          {/* Logo */}
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19,
            }}>📖</div>
            <div style={{
              fontFamily: T.fontDisplay,
              fontSize: isAr ? 18 : 17,
              fontWeight: 700,
              letterSpacing: isAr ? 0 : -0.3,
              color: T.text,
            }}>
              {isAr ? 'متابعة التحفيظ' : 'Suivi Récitation'}
            </div>
          </div>

          {/* Langues + CTA login */}
          <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <div style={{display: 'flex', gap: 4, fontSize: 12, fontFamily: T.fontBody}}>
              <button onClick={() => setLang('fr')}
                style={{
                  background: lang === 'fr' ? T.text : 'transparent',
                  color: lang === 'fr' ? T.bg : T.textMuted,
                  border: 'none', padding: '6px 12px', borderRadius: 20,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}>FR</button>
              <button onClick={() => setLang('ar')}
                style={{
                  background: lang === 'ar' ? T.text : 'transparent',
                  color: lang === 'ar' ? T.bg : T.textMuted,
                  border: 'none', padding: '6px 12px', borderRadius: 20,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}>AR</button>
            </div>
            <button onClick={onGoToLogin}
              style={{
                background: T.primary,
                color: '#fff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: T.fontBody,
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(8,80,65,0.2)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              {isAr ? 'دخول المدرسة' : 'Espace école →'}
            </button>
          </div>
        </div>
      </nav>

      {/* ─────────────── HERO ─────────────── */}
      <section style={{
        position: 'relative',
        padding: '80px 0 100px',
        overflow: 'hidden',
      }}>
        {/* Decoration motif zellige discret en arriere-plan */}
        <div style={{
          position: 'absolute',
          top: '10%',
          [isAr ? 'left' : 'right']: '-100px',
          width: 400, height: 400,
          background: `radial-gradient(circle, ${T.gold}15 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '5%',
          [isAr ? 'right' : 'left']: '-80px',
          width: 300, height: 300,
          background: `radial-gradient(circle, ${T.primaryLight}10 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{...containerStyle, position: 'relative', textAlign: 'center'}}>
          {/* Mini-badge "Pour les ecoles coraniques" */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(8,80,65,0.06)',
            color: T.primary,
            padding: '7px 16px',
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.5,
            marginBottom: 28,
            border: `1px solid rgba(8,80,65,0.1)`,
          }}>
            <span style={{width: 6, height: 6, borderRadius: '50%', background: T.primaryLight, animation: 'pulse 2s infinite'}}/>
            {isAr ? 'مصمم خصيصا للمدارس القرآنية' : 'Conçu pour les écoles coraniques'}
          </div>

          {/* Tagline principale */}
          <h1 style={{
            fontFamily: T.fontDisplay,
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: isAr ? 800 : 600,
            lineHeight: 1.1,
            letterSpacing: isAr ? 0 : -1.5,
            color: T.text,
            margin: '0 auto 24px',
            maxWidth: 880,
          }}>
            {isAr ? (
              <>
                متابعة تحفيظ القرآن،<br/>
                <em style={{
                  fontStyle: 'normal',
                  color: T.primary,
                  fontFamily: T.fontDisplay,
                }}>بتصميم عصري</em>
                {' '}للمدارس القرآنية.
              </>
            ) : (
              <>
                Le suivi de récitation du Coran,<br/>
                <em style={{
                  fontStyle: 'italic',
                  color: T.primary,
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontWeight: 500,
                }}>repensé</em>
                {' '}pour les écoles modernes.
              </>
            )}
          </h1>

          {/* Sous-tagline */}
          <p style={{
            fontSize: 'clamp(15px, 1.6vw, 19px)',
            color: T.textBody,
            maxWidth: 680,
            margin: '0 auto 44px',
            lineHeight: 1.55,
            fontWeight: 400,
          }}>
            {isAr
              ? 'من التسجيل بنقرتين إلى الشهادات الرسمية، مرورًا بلوحة الشرف لتحفيز الطلاب. كل ما يحتاجه المراقبون والأساتذة والأولياء والطلاب.'
              : 'De la saisie en deux clics aux certificats officiels, en passant par le tableau d\'honneur. Tout ce dont surveillants, instituteurs, parents et élèves ont besoin.'}
          </p>

          {/* CTA Group */}
          <div style={{display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16}}>
            <button onClick={onGoToLogin}
              style={{
                background: T.primary,
                color: '#fff',
                border: 'none',
                padding: '15px 32px',
                borderRadius: 100,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: T.fontBody,
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px rgba(8,80,65,0.25)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(8,80,65,0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(8,80,65,0.25)';
              }}>
              {isAr ? 'سجل مدرستك مجانا' : 'Inscrire mon école gratuitement'}
              <span style={{fontSize: 18}}>{isAr ? '←' : '→'}</span>
            </button>
            <a href="#decouvrir" style={{
              background: 'transparent',
              color: T.text,
              border: `1px solid rgba(0,0,0,0.15)`,
              padding: '15px 28px',
              borderRadius: 100,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: T.fontBody,
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center',
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {isAr ? 'اكتشف الميزات' : 'Découvrir les fonctionnalités'}
            </a>
          </div>

          {/* Trust signal */}
          <div style={{
            fontSize: 12,
            color: T.textMuted,
            marginTop: 20,
            letterSpacing: 0.3,
          }}>
            {isAr ? '🎁 مجاني • بدون بطاقة ائتمان • تثبيت في دقائق' : '🎁 Gratuit • Sans carte bancaire • Mise en route en minutes'}
          </div>

          {/* Screenshot Dashboard (placeholder pour l'instant) */}
          <div style={{
            marginTop: 64,
            position: 'relative',
            maxWidth: 1080,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${T.bgAlt}, ${T.bg})`,
              borderRadius: 14,
              padding: '64px 40px',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 24px 60px -20px rgba(8,80,65,0.25), 0 8px 24px -8px rgba(0,0,0,0.08)',
              minHeight: 420,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column',
              gap: 16,
              color: T.textMuted,
              fontSize: 13,
              fontFamily: T.fontBody,
            }}>
              <div style={{fontSize: 64, opacity: 0.3}}>📊</div>
              <div>{isAr ? '[ صورة لوحة القيادة هنا ]' : '[ Capture du Dashboard ici ]'}</div>
              <div style={{fontSize: 11, opacity: 0.7}}>
                {isAr ? 'سيتم إضافتها لاحقا' : 'À ajouter plus tard avec capture Chrome DevTools + Screely'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── PROBLEME ─────────────── */}
      <section style={{
        background: T.bgAlt,
        padding: '90px 0',
        position: 'relative',
      }}>
        <div style={containerStyle}>
          <div style={{textAlign: 'center', maxWidth: 720, margin: '0 auto'}}>
            <div style={{
              fontFamily: T.fontBody,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              color: T.gold,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}>
              {isAr ? '— التحدي —' : '— Le problème —'}
            </div>
            <h2 style={{
              fontFamily: T.fontDisplay,
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: isAr ? 700 : 600,
              lineHeight: 1.2,
              letterSpacing: isAr ? 0 : -0.8,
              color: T.text,
              margin: '0 0 20px',
            }}>
              {isAr
                ? 'متابعة 50 طالبا في دفتر، لم تعد كافية.'
                : 'Suivre 50 élèves avec un cahier, ce n\'est plus suffisant.'}
            </h2>
            <p style={{
              fontSize: 17,
              color: T.textBody,
              lineHeight: 1.65,
              margin: '0 0 48px',
            }}>
              {isAr
                ? 'الأساتذة يقضون ساعات في الجرد بدل التدريس. الأولياء لا يعلمون أين وصل أبناؤهم. الطلاب يفقدون التحفيز. والمراقب لا يملك رؤية واضحة عن أداء المدرسة.'
                : 'Les instituteurs passent des heures à faire l\'inventaire au lieu d\'enseigner. Les parents ne savent pas où en sont leurs enfants. Les élèves perdent leur motivation. Et le surveillant n\'a pas de vue claire sur la performance de l\'école.'}
            </p>
          </div>

          {/* 3 cards probleme */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            maxWidth: 980,
            margin: '0 auto',
          }}>
            {[
              {icon: '📚', titreFr: 'Cahiers perdus', titreAr: 'دفاتر مفقودة',
               descFr: 'Un cahier oublié, et c\'est tout l\'historique d\'un élève qui s\'envole.',
               descAr: 'دفتر منسي، يضيع معه كل تاريخ الطالب.'},
              {icon: '⏰', titreFr: 'Temps perdu', titreAr: 'وقت ضائع',
               descFr: 'Compter manuellement les hizb et tomon récités chaque semaine prend des heures.',
               descAr: 'حساب الأحزاب والأثمان المسجلة يدويا كل أسبوع يستغرق ساعات.'},
              {icon: '👨‍👩‍👧', titreFr: 'Parents déconnectés', titreAr: 'أولياء غير مطلعين',
               descFr: 'Les parents ne voient pas la progression de leurs enfants au quotidien.',
               descAr: 'الأولياء لا يرون تقدم أبنائهم بشكل يومي.'},
            ].map((card, i) => (
              <div key={i} style={{
                background: '#fff',
                borderRadius: 14,
                padding: '32px 28px',
                border: '1px solid rgba(0,0,0,0.05)',
                textAlign: 'center',
              }}>
                <div style={{fontSize: 36, marginBottom: 16, opacity: 0.85}}>{card.icon}</div>
                <h3 style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 19,
                  fontWeight: 700,
                  color: T.text,
                  margin: '0 0 10px',
                  letterSpacing: isAr ? 0 : -0.3,
                }}>{isAr ? card.titreAr : card.titreFr}</h3>
                <p style={{
                  fontSize: 14,
                  color: T.textBody,
                  margin: 0,
                  lineHeight: 1.55,
                }}>{isAr ? card.descAr : card.descFr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── SOLUTION (3 piliers) ─────────────── */}
      <section id="decouvrir" style={{
        background: T.bg,
        padding: '100px 0',
      }}>
        <div style={containerStyle}>
          <div style={{textAlign: 'center', maxWidth: 760, margin: '0 auto 64px'}}>
            <div style={{
              fontFamily: T.fontBody,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              color: T.gold,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}>
              {isAr ? '— الحل —' : '— La solution —'}
            </div>
            <h2 style={{
              fontFamily: T.fontDisplay,
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: isAr ? 700 : 600,
              lineHeight: 1.2,
              letterSpacing: isAr ? 0 : -0.8,
              color: T.text,
              margin: '0 0 20px',
            }}>
              {isAr
                ? 'كل المعلومات. في مكان واحد. لكل واحد.'
                : 'Toutes les informations. Au même endroit. Pour chacun.'}
            </h2>
            <p style={{
              fontSize: 17,
              color: T.textBody,
              lineHeight: 1.65,
              margin: 0,
            }}>
              {isAr
                ? 'تطبيق ويب بسيط، يستخدمه المراقب من حاسوبه، والأستاذ من هاتفه، والولي من جواله. بدون تثبيت، بدون تعقيد.'
                : 'Une application web simple. Utilisée par le surveillant sur son ordinateur, l\'instituteur sur son téléphone, le parent sur son mobile. Sans installation, sans complication.'}
            </p>
          </div>

          {/* 3 piliers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 32,
            maxWidth: 1080,
            margin: '0 auto',
          }}>
            {[
              {
                num: '01',
                titreFr: 'Saisie ultra-rapide',
                titreAr: 'تسجيل سريع جدا',
                descFr: 'Validez la récitation d\'un élève en deux clics. Conçu pour être utilisé en pleine séance, sans casser le rythme pédagogique.',
                descAr: 'سجل استظهار طالب بنقرتين فقط. مصمم للاستخدام أثناء الحصة، دون كسر الإيقاع التربوي.',
              },
              {
                num: '02',
                titreFr: 'Suivi minutieux',
                titreAr: 'متابعة دقيقة',
                descFr: 'Chaque tomon, chaque hizb, chaque absence est traçable. Historique complet par élève sur toute sa scolarité.',
                descAr: 'كل ثُمن، كل حزب، كل غياب قابل للتتبع. تاريخ كامل لكل طالب طوال مساره الدراسي.',
              },
              {
                num: '03',
                titreFr: 'Tout le monde gagne',
                titreAr: 'الجميع يستفيد',
                descFr: 'Surveillant pilote, instituteur enseigne, parent informé, élève motivé. Quatre rôles, une application qui les unit.',
                descAr: 'المراقب يقود، الأستاذ يدرس، الولي مطلع، الطالب متحمس. أربعة أدوار، تطبيق واحد يوحدهم.',
              },
            ].map((p, i) => (
              <div key={i} style={{
                position: 'relative',
                padding: '40px 32px 36px',
                background: '#fff',
                borderRadius: 16,
                border: `1px solid rgba(8,80,65,0.08)`,
                transition: 'all 0.3s ease',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 20px 40px -16px rgba(8,80,65,0.18)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                <div style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 14,
                  fontWeight: 600,
                  color: T.gold,
                  letterSpacing: 2,
                  marginBottom: 18,
                }}>{p.num}</div>
                <h3 style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 24,
                  fontWeight: isAr ? 700 : 600,
                  color: T.text,
                  margin: '0 0 14px',
                  letterSpacing: isAr ? 0 : -0.5,
                  lineHeight: 1.25,
                }}>{isAr ? p.titreAr : p.titreFr}</h3>
                <p style={{
                  fontSize: 15,
                  color: T.textBody,
                  lineHeight: 1.65,
                  margin: 0,
                }}>{isAr ? p.descAr : p.descFr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── FEATURE 01 : VALIDATION RAPIDE ─────────────── */}
      <section style={{
        background: T.bgAlt,
        padding: '110px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decoration : grand cercle vert tres tenu */}
        <div style={{
          position: 'absolute',
          top: '-200px',
          [isAr ? 'left' : 'right']: '-200px',
          width: 600, height: 600,
          background: `radial-gradient(circle, ${T.primaryLight}08 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />

        <div style={containerStyle}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            gap: 64,
            alignItems: 'center',
            position: 'relative',
          }}>
            {/* COLONNE TEXTE */}
            <div style={{order: isAr ? 2 : 1}}>
              {/* Mini-eyebrow numerotation */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 24,
              }}>
                <span style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.gold,
                  letterSpacing: 2,
                }}>01</span>
                <span style={{
                  width: 30, height: 1,
                  background: T.gold,
                  opacity: 0.5,
                }} />
                <span style={{
                  fontFamily: T.fontBody,
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.gold,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}>{isAr ? 'تسجيل سريع' : 'Validation rapide'}</span>
              </div>

              <h2 style={{
                fontFamily: T.fontDisplay,
                fontSize: 'clamp(28px, 3.5vw, 42px)',
                fontWeight: isAr ? 700 : 600,
                lineHeight: 1.15,
                letterSpacing: isAr ? 0 : -0.8,
                color: T.text,
                margin: '0 0 24px',
              }}>
                {isAr ? (
                  <>سجّل استظهار طالب<br/>
                  <em style={{fontStyle: 'normal', color: T.primary}}>بنقرتين فقط.</em></>
                ) : (
                  <>Validez une récitation<br/>
                  <em style={{
                    fontStyle: 'italic',
                    color: T.primary,
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontWeight: 500,
                  }}>en deux clics.</em></>
                )}
              </h2>

              <p style={{
                fontSize: 17,
                color: T.textBody,
                lineHeight: 1.65,
                margin: '0 0 32px',
              }}>
                {isAr
                  ? 'في خضم الحصة، ليس للأستاذ وقت يضيعه. الواجهة مصممة للعمل بسرعة: ابحث عن الطالب، اختر الثُمن أو الحزب، احفظ. النقاط تُحسب تلقائيا.'
                  : 'En pleine séance, l\'instituteur n\'a pas le temps à perdre. L\'interface est pensée pour aller vite : on cherche l\'élève, on sélectionne le tomon ou le hizb, on valide. Les points sont calculés automatiquement.'}
              </p>

              {/* Liste de benefits */}
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}>
                {[
                  {fr: 'Recherche instantanée par nom ou numéro', ar: 'بحث فوري بالاسم أو الرقم'},
                  {fr: 'Calcul automatique des points selon barème', ar: 'حساب تلقائي للنقاط حسب السلم'},
                  {fr: 'Détection des hizb complets et certificats à délivrer', ar: 'كشف الأحزاب المكتملة والشهادات الواجب تسليمها'},
                  {fr: 'Mode hors-ligne : continue de fonctionner sans connexion', ar: 'وضع عدم الاتصال: يعمل دون انترنت'},
                ].map((b, i) => (
                  <li key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    fontSize: 15,
                    color: T.textBody,
                    lineHeight: 1.5,
                  }}>
                    <span style={{
                      flexShrink: 0,
                      width: 22, height: 22,
                      borderRadius: '50%',
                      background: `${T.primaryLight}20`,
                      color: T.primary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      marginTop: 1,
                    }}>✓</span>
                    <span>{isAr ? b.ar : b.fr}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* COLONNE VISUEL : placeholder capture validation rapide */}
            <div style={{order: isAr ? 1 : 2, position: 'relative'}}>
              {/* Card decoratif derriere */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`,
                borderRadius: 18,
                transform: 'rotate(-2deg) scale(1.02)',
                opacity: 0.08,
              }} />
              <div style={{
                position: 'relative',
                background: '#fff',
                borderRadius: 18,
                padding: '48px 32px',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 24px 60px -20px rgba(8,80,65,0.2), 0 8px 24px -8px rgba(0,0,0,0.08)',
                minHeight: 380,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}>
                <div style={{fontSize: 56, opacity: 0.3}}>⚡</div>
                <div style={{
                  fontFamily: T.fontBody,
                  fontSize: 13,
                  color: T.textMuted,
                  textAlign: 'center',
                }}>
                  {isAr ? '[ صورة شاشة التسجيل السريع ]' : '[ Capture Validation rapide ]'}
                </div>
                <div style={{
                  fontSize: 11,
                  color: T.textMuted,
                  opacity: 0.7,
                  textAlign: 'center',
                }}>
                  {isAr ? 'سيتم إضافتها قريبا' : 'À ajouter avec capture Chrome DevTools + Screely'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── PLACEHOLDER : Suite landing en cours ─────────────── */}
      <section style={{
        background: T.bgDeep,
        color: '#fff',
        padding: '80px 0',
        textAlign: 'center',
      }}>
        <div style={containerStyle}>
          <div style={{
            fontFamily: T.fontDisplay,
            fontSize: 18,
            opacity: 0.6,
            marginBottom: 12,
          }}>
            {isAr ? '🚧 المزيد من الميزات قريبا' : '🚧 D\'autres fonctionnalités bientôt'}
          </div>
          <div style={{fontSize: 13, opacity: 0.4}}>
            Fiche élève • Murajaʼa de groupe • Certificats • Tableau honneur TV • Pour qui • Tarifs • CTA à venir
          </div>
        </div>
      </section>

      {/* Animation pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.4); }
        }
        h1 em { display: inline-block; }
        @media (max-width: 640px) {
          h1 br { display: none; }
        }
      `}</style>
    </div>
  );
}
