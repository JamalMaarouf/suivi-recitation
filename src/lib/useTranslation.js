// React hook for dynamic translation
import { useState, useEffect, useRef, useCallback } from 'react';
import { translateBatch, extractPageTexts, getCache, clearTranslationCache } from './translator';

export function useTranslation(lang) {
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(false);
  const [translations, setTranslations] = useState({});
  const prevLang = useRef('fr');
  const originalContent = useRef(null);

  // When lang changes, translate the current page
  const translatePage = useCallback(async (targetLang) => {
    if (targetLang === 'fr') {
      // Restore to French — just re-render (React handles this)
      setTranslated(false);
      setTranslations({});
      return;
    }

    // Check cache first
    const cache = JSON.parse(localStorage.getItem('suivi_trans_cache') || '{}');
    if (cache[targetLang] && Object.keys(cache[targetLang]).length > 50) {
      setTranslations(cache[targetLang]);
      setTranslated(true);
      return;
    }

    setTranslating(true);

    // Collect all static UI strings from i18n.js French values
    const { translations: i18nTrans } = await import('./i18n.js');
    const frStrings = i18nTrans.fr;

    const textsToTranslate = Object.entries(frStrings)
      .filter(([k]) => !['dir','lang','flag','name'].includes(k))
      .map(([key, text]) => ({ key, text: String(text) }));

    try {
      const langNames = { ar: 'Arabic (formal Islamic/Quranic context, RTL)', en: 'English' };
      const toTranslate = textsToTranslate.map(({ key, text }) => `${key}|||${text}`).join('\n');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 6000,
          system: `You are a professional translator for an Islamic Quran memorization tracking application.
Translate all UI strings from French to ${langNames[targetLang]}.
RULES:
- Keep these words unchanged: Hizb, Tomon, Roboe, Nisf, Jouz, Hizb
- For Arabic: use formal Modern Standard Arabic (فصحى), suitable for Islamic education
- Keep emojis as-is
- Keep format markers like ↑ ↓ → ← ✓ ✕ as-is  
- Keep numbers and % as-is
- Translate naturally, not word by word
- Return ONLY: key|||translation (one per line, nothing else)`,
          messages: [{
            role: 'user',
            content: `Translate to ${langNames[targetLang]}:\n\n${toTranslate}`
          }]
        })
      });

      const data = await response.json();
      const rawText = data.content?.[0]?.text || '';
      const result = {};
      rawText.split('\n').forEach(line => {
        const idx = line.indexOf('|||');
        if (idx > 0) {
          const key = line.substring(0, idx).trim();
          const val = line.substring(idx + 3).trim();
          if (key && val) result[key] = val;
        }
      });

      // Merge with existing cache
      const newCache = { ...cache, [targetLang]: result };
      localStorage.setItem('suivi_trans_cache', JSON.stringify(newCache));

      setTranslations(result);
      setTranslated(true);
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setTranslating(false);
    }
  }, []);

  useEffect(() => {
    if (lang !== prevLang.current) {
      prevLang.current = lang;
      translatePage(lang);
    }
  }, [lang, translatePage]);

  // Load from cache on mount if non-French
  useEffect(() => {
    if (lang !== 'fr') {
      const cache = JSON.parse(localStorage.getItem('suivi_trans_cache') || '{}');
      if (cache[lang] && Object.keys(cache[lang]).length > 10) {
        setTranslations(cache[lang]);
        setTranslated(true);
      } else {
        translatePage(lang);
      }
    }
  }, []);

  const tDyn = useCallback((key) => {
    if (lang === 'fr') return null;
    return translations[key] || null;
  }, [translations, lang]);

  return { translating, translated, tDyn, retranslate: () => translatePage(lang) };
}

export function clearCache() {
  localStorage.removeItem('suivi_trans_cache');
}
