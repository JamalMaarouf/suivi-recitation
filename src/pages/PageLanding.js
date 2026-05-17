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

          {/* Screenshot Dashboard - capture reelle AR (a remplacer par capture Test avec donnees riches plus tard) */}
          <div style={{
            marginTop: 64,
            position: 'relative',
            maxWidth: 1080,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {/* Halo lumineux derriere la capture pour effet 'leve' */}
            <div style={{
              position: 'absolute',
              inset: '-40px',
              background: `radial-gradient(ellipse at center, ${T.primaryLight}15 0%, transparent 60%)`,
              pointerEvents: 'none',
              zIndex: 0,
            }} />
            <img
              src="/landing-images/dashboard-ar.png"
              alt={isAr ? 'لوحة قيادة التطبيق' : 'Dashboard de l\'application'}
              style={{
                position: 'relative',
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: 14,
                boxShadow: '0 24px 60px -20px rgba(8,80,65,0.25), 0 8px 24px -8px rgba(0,0,0,0.08)',
                zIndex: 1,
              }}
            />
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

      {/* ─────────────── FEATURE 02 : FICHE ELEVE ─────────────── */}
      <section style={{
        background: T.bg,
        padding: '110px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decoration : grand cercle dore tres tenu */}
        <div style={{
          position: 'absolute',
          bottom: '-150px',
          [isAr ? 'right' : 'left']: '-150px',
          width: 500, height: 500,
          background: `radial-gradient(circle, ${T.gold}10 0%, transparent 60%)`,
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
            {/* COLONNE VISUEL — inverse par rapport a Feature 01 */}
            <div style={{order: isAr ? 2 : 1, position: 'relative'}}>
              {/* Card decorative inclinee dans l'autre sens */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, ${T.gold}, ${T.goldLight})`,
                borderRadius: 18,
                transform: 'rotate(2deg) scale(1.02)',
                opacity: 0.08,
              }} />
              <img
                src="/landing-images/fiche-eleve-ar.png"
                alt={isAr ? 'صفحة الطالب' : 'Fiche élève'}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: 18,
                  boxShadow: '0 24px 60px -20px rgba(8,80,65,0.2), 0 8px 24px -8px rgba(0,0,0,0.08)',
                }}
              />
            </div>

            {/* COLONNE TEXTE */}
            <div style={{order: isAr ? 1 : 2}}>
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
                }}>02</span>
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
                }}>{isAr ? 'صفحة الطالب' : 'Fiche élève'}</span>
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
                  <>كل شيء عن طالب،<br/>
                  <em style={{fontStyle: 'normal', color: T.primary}}>في صفحة واحدة.</em></>
                ) : (
                  <>Tout sur un élève,<br/>
                  <em style={{
                    fontStyle: 'italic',
                    color: T.primary,
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontWeight: 500,
                  }}>sur une seule page.</em></>
                )}
              </h2>

              <p style={{
                fontSize: 17,
                color: T.textBody,
                lineHeight: 1.65,
                margin: '0 0 32px',
              }}>
                {isAr
                  ? 'لا حاجة للتنقل بين الدفاتر. كل ما يخص الطالب: تقدمه، حضوره، شهاداته، نقاطه، تاريخ استظهاراته، تحفه، علاماته. كل شيء، في مكان واحد.'
                  : 'Plus besoin de jongler entre les cahiers. Tout ce qui concerne l\'élève : sa progression, ses présences, ses certificats, ses points, l\'historique de ses récitations, sa mémorisation, ses notes. Tout, en un seul endroit.'}
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
                  {fr: 'Progression par blocs avec barres visuelles', ar: 'تقدم بحسب البلوكات مع أشرطة بصرية'},
                  {fr: 'Onglets dédiés : récitation, présence, examens, certificats', ar: 'تبويبات مخصصة: الاستظهار، الحضور، الامتحانات، الشهادات'},
                  {fr: 'Score intelligent et label de niveau automatique', ar: 'تقييم ذكي ومستوى محتسب تلقائيا'},
                  {fr: 'Export PDF de la fiche complète en un clic', ar: 'تصدير PDF للصفحة كاملة بنقرة واحدة'},
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
                      background: `${T.gold}20`,
                      color: T.gold,
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
          </div>
        </div>
      </section>

      {/* ─────────────── FEATURE 03 : MURAJAʼA DE GROUPE ─────────────── */}
      <section style={{
        background: T.bgAlt,
        padding: '110px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '20%',
          [isAr ? 'left' : 'right']: '-200px',
          width: 500, height: 500,
          background: `radial-gradient(circle, ${T.primaryLight}10 0%, transparent 60%)`,
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
            {/* COLONNE TEXTE (alternance : a gauche en LTR, a droite en RTL) */}
            <div style={{order: isAr ? 2 : 1}}>
              <div style={{display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24}}>
                <span style={{fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 600, color: T.gold, letterSpacing: 2}}>03</span>
                <span style={{width: 30, height: 1, background: T.gold, opacity: 0.5}} />
                <span style={{fontFamily: T.fontBody, fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: 2, textTransform: 'uppercase'}}>
                  {isAr ? 'مراجعة جماعية' : 'Murajaʼa de groupe'}
                </span>
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
                  <>المراجعة الجماعية،<br/>
                  <em style={{fontStyle: 'normal', color: T.primary}}>متتبعة كما يجب.</em></>
                ) : (
                  <>La révision collective,<br/>
                  <em style={{fontStyle: 'italic', color: T.primary, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500}}>tracée comme il se doit.</em></>
                )}
              </h2>

              <p style={{
                fontSize: 17,
                color: T.textBody,
                lineHeight: 1.65,
                margin: '0 0 32px',
              }}>
                {isAr
                  ? 'فريد من نوعه في تطبيقات تحفيظ القرآن: تتبع جلسات المراجعة الجماعية. كل حصة، كل حزب راجعه الفصل، كل غياب، يسجل ويحلل. لا أحد آخر يقدم هذه الميزة.'
                  : 'Unique parmi les applications de tahfîz : le suivi des séances de Murajaʼa collective. Chaque séance, chaque hizb révisé par la classe, chaque absence — tracé et analysé. Aucune autre application n\'offre cette fonctionnalité.'}
              </p>

              <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14}}>
                {[
                  {fr: 'Séance par séance, hizb par hizb, élève par élève', ar: 'حصة بحصة، حزب بحزب، طالب بطالب'},
                  {fr: 'Détection automatique des élèves en retard de révision', ar: 'كشف تلقائي للطلاب المتأخرين في المراجعة'},
                  {fr: 'Statistiques d\'assiduité aux séances de groupe', ar: 'إحصائيات الانتظام في الحصص الجماعية'},
                  {fr: 'Vue unifiée intégrée à la fiche de chaque élève', ar: 'عرض موحد مدمج في صفحة كل طالب'},
                ].map((b, i) => (
                  <li key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 14, fontSize: 15, color: T.textBody, lineHeight: 1.5}}>
                    <span style={{flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: `${T.primaryLight}20`, color: T.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, marginTop: 1}}>✓</span>
                    <span>{isAr ? b.ar : b.fr}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* COLONNE VISUEL — capture Murajaa */}
            <div style={{order: isAr ? 1 : 2, position: 'relative'}}>
              <div style={{position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`, borderRadius: 18, transform: 'rotate(-2deg) scale(1.02)', opacity: 0.08}} />
              <img
                src="/landing-images/muraja-ar.png"
                alt={isAr ? 'لوحة المراجعة الجماعية' : 'Tableau Murajaʼa de groupe'}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: 18,
                  boxShadow: '0 24px 60px -20px rgba(8,80,65,0.2), 0 8px 24px -8px rgba(0,0,0,0.08)',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── FEATURE 04 : CERTIFICATS OFFICIELS ─────────────── */}
      <section style={{
        background: T.bg,
        padding: '110px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '10%',
          [isAr ? 'right' : 'left']: '-200px',
          width: 600, height: 600,
          background: `radial-gradient(circle, ${T.gold}10 0%, transparent 60%)`,
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
            {/* COLONNE VISUEL — 2 captures : PDF certificat + page Verify */}
            <div style={{order: isAr ? 2 : 1, position: 'relative'}}>
              <div style={{position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${T.gold}, ${T.goldLight})`, borderRadius: 18, transform: 'rotate(2deg) scale(1.02)', opacity: 0.08}} />
              <div style={{position: 'relative', display: 'flex', flexDirection: 'column', gap: 16}}>
                {/* Certificat PDF (en arriere : grand format paysage) */}
                <img
                  src="/landing-images/certificat-pdf-ar.png"
                  alt={isAr ? 'نموذج شهادة' : 'Exemple de certificat'}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    borderRadius: 12,
                    boxShadow: '0 16px 40px -16px rgba(200,148,26,0.3), 0 4px 16px -4px rgba(0,0,0,0.08)',
                  }}
                />
                {/* Page Verify (mockup en dessous, plus petit, decale a gauche/droite) */}
                <div style={{
                  position: 'relative',
                  width: '60%',
                  [isAr ? 'marginRight' : 'marginLeft']: 'auto',
                  marginTop: -32,
                  zIndex: 2,
                }}>
                  <img
                    src="/landing-images/verify-page-ar.png"
                    alt={isAr ? 'صفحة التحقق' : 'Page de vérification'}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      borderRadius: 12,
                      boxShadow: '0 20px 40px -12px rgba(8,80,65,0.3), 0 6px 16px -4px rgba(0,0,0,0.1)',
                      border: '4px solid #fff',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* COLONNE TEXTE */}
            <div style={{order: isAr ? 1 : 2}}>
              <div style={{display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24}}>
                <span style={{fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 600, color: T.gold, letterSpacing: 2}}>04</span>
                <span style={{width: 30, height: 1, background: T.gold, opacity: 0.5}} />
                <span style={{fontFamily: T.fontBody, fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: 2, textTransform: 'uppercase'}}>
                  {isAr ? 'شهادات رسمية' : 'Certificats officiels'}
                </span>
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
                  <>شهادات رسمية،<br/>
                  <em style={{fontStyle: 'normal', color: T.gold}}>قابلة للتحقق برمز QR.</em></>
                ) : (
                  <>Certificats officiels,<br/>
                  <em style={{fontStyle: 'italic', color: T.gold, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500}}>vérifiables par QR code.</em></>
                )}
              </h2>

              <p style={{
                fontSize: 17,
                color: T.textBody,
                lineHeight: 1.65,
                margin: '0 0 32px',
              }}>
                {isAr
                  ? 'PDF عالي الجودة، خطوط رسمية، ختم المدرسة، توقيع المدير، رمز QR للتحقق العمومي. كل شهادة تصدرها مدرستك قابلة للتحقق فورا من قبل أي مستلم.'
                  : 'PDF de qualité professionnelle, calligraphies officielles, sceau de l\'école, signature du directeur, QR code de vérification publique. Chaque certificat délivré par votre école est vérifiable instantanément par n\'importe quel destinataire.'}
              </p>

              <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14}}>
                {[
                  {fr: 'Templates haut de gamme : Khatim, Imtihan, Hizb complet', ar: 'قوالب راقية: ختم، امتحان، حزب مكتمل'},
                  {fr: 'Numéro unique inviolable type 2026-0001', ar: 'رقم فريد لا يمكن تزويره بصيغة 2026-0001'},
                  {fr: 'Page publique de vérification (suivi-recitation.com/verify/XXX)', ar: 'صفحة تحقق علنية'},
                  {fr: 'Modifiable : numéro, date, lieu, signataire', ar: 'قابل للتعديل: الرقم، التاريخ، المكان، الموقع'},
                ].map((b, i) => (
                  <li key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 14, fontSize: 15, color: T.textBody, lineHeight: 1.5}}>
                    <span style={{flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: `${T.gold}20`, color: T.gold, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, marginTop: 1}}>✓</span>
                    <span>{isAr ? b.ar : b.fr}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── SECTION SPECIALE : TABLEAU HONNEUR MODE TV ─────────────── */}
      {/* Cette section change de ton : fond sombre, ambiance 'theatre/ceremonie',
          pour mettre en valeur LE differentiateur marketing fort */}
      <section style={{
        background: T.bgDeep,
        color: '#fff',
        padding: '120px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorations lumineuses pour ambiance 'spectacle' */}
        <div style={{position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, background: `radial-gradient(circle, ${T.goldLight}15 0%, transparent 60%)`, pointerEvents: 'none'}} />
        <div style={{position: 'absolute', bottom: '10%', right: '10%', width: 350, height: 350, background: `radial-gradient(circle, ${T.primaryLight}20 0%, transparent 60%)`, pointerEvents: 'none'}} />

        <div style={{...containerStyle, position: 'relative', textAlign: 'center'}}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `${T.goldLight}15`,
            color: T.goldLight,
            padding: '7px 16px',
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            marginBottom: 28,
            border: `1px solid ${T.goldLight}30`,
          }}>
            📺 {isAr ? 'وضع العرض في القاعة' : 'Mode présentation en salle'}
          </div>

          <h2 style={{
            fontFamily: T.fontDisplay,
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: isAr ? 800 : 600,
            lineHeight: 1.1,
            letterSpacing: isAr ? 0 : -1.2,
            color: '#fff',
            margin: '0 auto 24px',
            maxWidth: 880,
          }}>
            {isAr ? (
              <>اعرض لوحة الشرف على شاشة قاعتك،<br/>
              <em style={{fontStyle: 'normal', color: T.goldLight}}>وحفّز طلابك.</em></>
            ) : (
              <>Projetez le tableau d'honneur,<br/>
              <em style={{fontStyle: 'italic', color: T.goldLight, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500}}>motivez vos élèves.</em></>
            )}
          </h2>

          <p style={{
            fontSize: 'clamp(15px, 1.6vw, 18px)',
            color: 'rgba(255,255,255,0.7)',
            maxWidth: 680,
            margin: '0 auto 48px',
            lineHeight: 1.6,
          }}>
            {isAr
              ? 'بنقرة واحدة، يتحول لوحة الشرف إلى وضع عرض كامل: خلفية داكنة احتفالية، أوسمة ذهبية مضيئة، أسماء المتفوقين بحروف كبيرة. اعرضها على التلفاز في قاعتك واصنع لحظة فخر.'
              : 'En un clic, le tableau d\'honneur passe en mode présentation : fond sombre cérémoniel, médailles dorées lumineuses, noms des meilleurs en grands caractères. Diffusez-le sur l\'écran de votre salle et créez un moment de fierté.'}
          </p>

          {/* Visuel mode TV - capture reelle */}
          <div style={{
            position: 'relative',
            maxWidth: 980,
            margin: '0 auto',
          }}>
            <div style={{
              position: 'absolute',
              inset: '-30px',
              background: `radial-gradient(ellipse at center, ${T.goldLight}20 0%, transparent 50%)`,
              pointerEvents: 'none',
            }} />
            <img
              src="/landing-images/honneur-tv-ar.png"
              alt={isAr ? 'لوحة الشرف في وضع العرض' : 'Tableau d\'honneur mode présentation'}
              style={{
                position: 'relative',
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: 14,
                boxShadow: '0 24px 60px -20px rgba(255,215,0,0.2), 0 8px 24px -8px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          </div>

          <div style={{
            marginTop: 40,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            fontStyle: 'italic',
            fontFamily: T.fontDisplay,
          }}>
            ✨ {isAr ? 'فريد من نوعه: لا تطبيق آخر يقدم هذه الميزة' : 'Unique en son genre : aucune autre application ne propose ça'}
          </div>
        </div>
      </section>

      {/* ─────────────── POUR QUI : 4 ROLES ─────────────── */}
      <section style={{
        background: T.bg,
        padding: '110px 0',
        position: 'relative',
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
              {isAr ? '— لمن —' : '— Pour qui —'}
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
                ? 'تطبيق واحد، أربعة أدوار.'
                : 'Une application, quatre rôles.'}
            </h2>
            <p style={{
              fontSize: 17,
              color: T.textBody,
              lineHeight: 1.65,
              margin: 0,
            }}>
              {isAr
                ? 'كل مستخدم يجد ما يحتاجه، بواجهة مصممة خصيصا لدوره.'
                : 'Chaque utilisateur trouve ce dont il a besoin, dans une interface conçue pour son rôle.'}
            </p>
          </div>

          {/* 4 cards roles */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 20,
            maxWidth: 1080,
            margin: '0 auto',
          }}>
            {[
              {
                icon: '👨‍💼',
                colorBg: `${T.primaryLight}12`,
                colorFg: T.primary,
                titreFr: 'Surveillant général',
                titreAr: 'المراقب العام',
                descFr: 'Pilotez votre école. Statistiques globales, certificats, suivi par niveau et par instituteur.',
                descAr: 'قيادة المدرسة. إحصائيات شاملة، الشهادات، متابعة حسب المستوى والأستاذ.',
              },
              {
                icon: '👨‍🏫',
                colorBg: `${T.gold}12`,
                colorFg: T.gold,
                titreFr: 'Instituteur',
                titreAr: 'الأستاذ',
                descFr: 'Validez en classe. Suivez vos élèves au quotidien, identifiez ceux à relancer.',
                descAr: 'سجّل في القسم. تابع طلابك يوميا، حدد من يحتاج إلى مراجعة.',
              },
              {
                icon: '👨‍👩‍👧',
                colorBg: '#534AB712',
                colorFg: '#534AB7',
                titreFr: 'Parent',
                titreAr: 'الولي',
                descFr: 'Restez informé. Voyez la progression de votre enfant et soyez impliqué dans son parcours.',
                descAr: 'كن مطّلعا. شاهد تقدم ابنك واشترك في مساره.',
              },
              {
                icon: '🎓',
                colorBg: '#378ADD12',
                colorFg: '#378ADD',
                titreFr: 'Élève',
                titreAr: 'الطالب',
                descFr: 'Restez motivé. Voyez votre progression, vos certificats, et votre place au tableau d\'honneur.',
                descAr: 'حافظ على حماسك. شاهد تقدمك، شهاداتك، ومكانتك في لوحة الشرف.',
              },
            ].map((r, i) => (
              <div key={i} style={{
                background: '#fff',
                borderRadius: 14,
                padding: '32px 24px',
                border: '1px solid rgba(0,0,0,0.06)',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                cursor: 'default',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 32px -12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                {/* Icone dans cercle colore */}
                <div style={{
                  width: 64, height: 64,
                  borderRadius: '50%',
                  background: r.colorBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  margin: '0 auto 20px',
                }}>{r.icon}</div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: r.colorFg,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}>{isAr ? r.titreAr : r.titreFr}</div>
                <p style={{
                  fontSize: 14,
                  color: T.textBody,
                  margin: 0,
                  lineHeight: 1.55,
                }}>{isAr ? r.descAr : r.descFr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── TARIFS ─────────────── */}
      <section style={{
        background: T.bgAlt,
        padding: '110px 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '-100px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 700, height: 400,
          background: `radial-gradient(ellipse, ${T.gold}10 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />

        <div style={{...containerStyle, position: 'relative'}}>
          <div style={{textAlign: 'center', maxWidth: 760, margin: '0 auto 56px'}}>
            <div style={{
              fontFamily: T.fontBody,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              color: T.gold,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}>
              {isAr ? '— التسعير —' : '— Tarifs —'}
            </div>
            <h2 style={{
              fontFamily: T.fontDisplay,
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: isAr ? 700 : 600,
              lineHeight: 1.2,
              letterSpacing: isAr ? 0 : -0.8,
              color: T.text,
              margin: 0,
            }}>
              {isAr
                ? 'مجاني. بدون استثناء.'
                : 'Gratuit. Sans exception.'}
            </h2>
          </div>

          {/* Card tarif centrale */}
          <div style={{
            maxWidth: 540,
            margin: '0 auto',
            background: '#fff',
            borderRadius: 24,
            padding: 'clamp(40px, 5vw, 56px)',
            border: `2px solid ${T.gold}30`,
            boxShadow: '0 24px 60px -16px rgba(200,148,26,0.15), 0 8px 24px -8px rgba(0,0,0,0.06)',
            position: 'relative',
            textAlign: 'center',
          }}>
            {/* Ribbon en haut */}
            <div style={{
              position: 'absolute',
              top: -14,
              left: '50%',
              transform: 'translateX(-50%)',
              background: `linear-gradient(135deg, ${T.gold}, ${T.goldLight})`,
              color: '#fff',
              padding: '6px 20px',
              borderRadius: 100,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              boxShadow: '0 4px 12px rgba(200,148,26,0.3)',
            }}>
              🎁 {isAr ? 'هدية للمدارس' : 'Offert aux écoles'}
            </div>

            {/* Prix */}
            <div style={{margin: '16px 0 28px'}}>
              <div style={{
                fontFamily: T.fontDisplay,
                fontSize: 'clamp(56px, 8vw, 84px)',
                fontWeight: 700,
                lineHeight: 1,
                color: T.primary,
                letterSpacing: -3,
              }}>
                {isAr ? 'مجاني' : 'Gratuit'}
              </div>
              <div style={{
                fontSize: 14,
                color: T.textMuted,
                marginTop: 12,
              }}>
                {isAr ? 'لا رسوم • لا قيود • لا بطاقة ائتمان' : 'Aucun frais. Aucune limite. Aucune carte bancaire.'}
              </div>
            </div>

            {/* Liste de features */}
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 36px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              textAlign: isAr ? 'right' : 'left',
            }}>
              {[
                {fr: 'Élèves illimités', ar: 'طلاب بلا حدود'},
                {fr: 'Instituteurs illimités', ar: 'أساتذة بلا حدود'},
                {fr: 'Certificats illimités avec QR vérification', ar: 'شهادات بلا حدود مع رمز QR للتحقق'},
                {fr: 'Mode hors-ligne inclus', ar: 'وضع عدم الاتصال مضمّن'},
                {fr: 'Bilingue FR/AR avec RTL natif', ar: 'ثنائي اللغة فرنسي/عربي مع RTL أصلي'},
                {fr: 'Tableau d\'honneur mode présentation', ar: 'لوحة الشرف بوضع العرض'},
              ].map((f, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 15,
                  color: T.text,
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
                  }}>✓</span>
                  <span>{isAr ? f.ar : f.fr}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button onClick={onGoToLogin}
              style={{
                width: '100%',
                background: T.primary,
                color: '#fff',
                border: 'none',
                padding: '16px 24px',
                borderRadius: 100,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: T.fontBody,
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px rgba(8,80,65,0.25)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(8,80,65,0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(8,80,65,0.25)';
              }}>
              {isAr ? 'سجل مدرستي مجانا' : 'Inscrire mon école gratuitement'} {isAr ? '←' : '→'}
            </button>

            {/* Note future */}
            <div style={{
              marginTop: 28,
              padding: '16px 20px',
              background: `${T.gold}08`,
              border: `1px solid ${T.gold}20`,
              borderRadius: 10,
              fontSize: 12,
              color: T.textBody,
              lineHeight: 1.55,
              fontStyle: 'italic',
            }}>
              {isAr
                ? 'في المستقبل، قد يُطلب مساهمة رمزية للمشاركة في تكاليف الاستضافة. المدارس المسجلة قبل هذا التحول ستستفيد من شروط امتيازية.'
                : 'À l\'avenir, une contribution forfaitaire modique pourra être demandée pour participer aux frais d\'hébergement. Les écoles inscrites avant cette transition bénéficieront de conditions privilégiées.'}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── CTA FINAL ─────────────── */}
      <section style={{
        background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryLight} 100%)`,
        color: '#fff',
        padding: '100px 0',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        {/* Halos decoratifs */}
        <div style={{position: 'absolute', top: '-100px', left: '10%', width: 400, height: 400, background: `radial-gradient(circle, ${T.goldLight}20 0%, transparent 60%)`, pointerEvents: 'none'}} />
        <div style={{position: 'absolute', bottom: '-100px', right: '10%', width: 400, height: 400, background: `radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%)`, pointerEvents: 'none'}} />

        <div style={{...containerStyle, position: 'relative'}}>
          <h2 style={{
            fontFamily: T.fontDisplay,
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: isAr ? 800 : 600,
            lineHeight: 1.1,
            letterSpacing: isAr ? 0 : -1.2,
            color: '#fff',
            margin: '0 auto 24px',
            maxWidth: 880,
          }}>
            {isAr ? (
              <>هل أنتم مستعدون لتحويل<br/>
              <em style={{fontStyle: 'normal', color: T.goldLight}}>متابعة مدرستكم؟</em></>
            ) : (
              <>Prêts à transformer<br/>
              <em style={{fontStyle: 'italic', color: T.goldLight, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500}}>le suivi de votre école ?</em></>
            )}
          </h2>

          <p style={{
            fontSize: 'clamp(15px, 1.6vw, 18px)',
            color: 'rgba(255,255,255,0.85)',
            maxWidth: 600,
            margin: '0 auto 44px',
            lineHeight: 1.6,
          }}>
            {isAr
              ? 'تسجيل في 3 دقائق. لا بطاقة ائتمان. بيانات في أمان.'
              : 'Inscription en 3 minutes. Aucune carte bancaire. Données en sécurité.'}
          </p>

          <button onClick={onGoToLogin}
            style={{
              background: '#fff',
              color: T.primary,
              border: 'none',
              padding: '18px 44px',
              borderRadius: 100,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: T.fontBody,
              transition: 'all 0.2s ease',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
            }}>
            {isAr ? 'سجل مدرستي الآن' : 'Inscrire mon école maintenant'} {isAr ? '←' : '→'}
          </button>
        </div>
      </section>

      {/* ─────────────── FOOTER ─────────────── */}
      <footer style={{
        background: T.bgDeep,
        color: 'rgba(255,255,255,0.7)',
        padding: '64px 0 32px',
        fontSize: 13,
      }}>
        <div style={containerStyle}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 40,
            marginBottom: 48,
          }}>
            {/* Colonne 1 : Brand */}
            <div>
              <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16}}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 19,
                }}>📖</div>
                <div style={{
                  fontFamily: T.fontDisplay,
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#fff',
                }}>
                  {isAr ? 'متابعة التحفيظ' : 'Suivi Récitation'}
                </div>
              </div>
              <p style={{margin: 0, lineHeight: 1.6, fontSize: 13, color: 'rgba(255,255,255,0.6)'}}>
                {isAr
                  ? 'تطبيق متابعة تحفيظ القرآن، مصمم خصيصا للمدارس القرآنية الحديثة.'
                  : 'L\'application de suivi de récitation du Coran, conçue pour les écoles coraniques modernes.'}
              </p>
            </div>

            {/* Colonne 2 : Navigation */}
            <div>
              <div style={{fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: 0.5}}>
                {isAr ? 'التطبيق' : 'Application'}
              </div>
              <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10}}>
                <li><a href="#decouvrir" style={{color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13}}>
                  {isAr ? 'الميزات' : 'Fonctionnalités'}
                </a></li>
                <li>
                  <button onClick={onGoToLogin} style={{background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13, padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: isAr ? 'right' : 'left'}}>
                    {isAr ? 'دخول' : 'Connexion'}
                  </button>
                </li>
                <li>
                  <button onClick={onGoToLogin} style={{background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13, padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: isAr ? 'right' : 'left'}}>
                    {isAr ? 'تسجيل مدرسة' : 'Inscrire une école'}
                  </button>
                </li>
              </ul>
            </div>

            {/* Colonne 3 : Ressources */}
            <div>
              <div style={{fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: 0.5}}>
                {isAr ? 'موارد' : 'Ressources'}
              </div>
              <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10}}>
                <li>
                  <span style={{color: 'rgba(255,255,255,0.5)', fontSize: 13}}>
                    {isAr ? 'التحقق من شهادة' : 'Vérifier un certificat'}
                  </span>
                  <span style={{fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 6}}>
                    {isAr ? '(عبر QR)' : '(via QR code)'}
                  </span>
                </li>
                <li style={{color: 'rgba(255,255,255,0.4)', fontSize: 12, fontStyle: 'italic'}}>
                  {isAr ? 'البريد الإلكتروني للاتصال قريبا' : 'Email de contact à venir'}
                </li>
              </ul>
            </div>

            {/* Colonne 4 : Langues */}
            <div>
              <div style={{fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: 0.5}}>
                {isAr ? 'اللغة' : 'Langue'}
              </div>
              <div style={{display: 'flex', gap: 8}}>
                <button onClick={() => setLang('fr')}
                  style={{
                    background: lang === 'fr' ? T.primaryLight : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: T.fontBody,
                  }}>Français</button>
                <button onClick={() => setLang('ar')}
                  style={{
                    background: lang === 'ar' ? T.primaryLight : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: T.fontBody,
                  }}>العربية</button>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{
            paddingTop: 32,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
          }}>
            <div>
              © 2026 {isAr ? 'متابعة التحفيظ' : 'Suivi Récitation'}. {isAr ? 'كل الحقوق محفوظة.' : 'Tous droits réservés.'}
            </div>
            <div style={{fontStyle: 'italic', fontSize: 11}}>
              {isAr ? 'مع كل الحب للمدارس القرآنية 💚' : 'Avec amour pour les écoles coraniques 💚'}
            </div>
          </div>
        </div>
      </footer>

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
