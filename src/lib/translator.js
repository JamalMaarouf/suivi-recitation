// Dynamic translation engine using Claude API
// Translates all UI text on demand with caching

const CACHE_KEY = 'suivi_translations_cache';
const CACHE_VERSION = '1.0';

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION) return {};
    return parsed.data || {};
  } catch { return {}; }
}

function setCache(lang, translations) {
  try {
    const existing = getCache();
    existing[lang] = translations;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, data: existing }));
  } catch {}
}

function getCached(lang, key) {
  const cache = getCache();
  return cache[lang]?.[key] || null;
}

// Translate a batch of strings via Claude API
export async function translateBatch(texts, targetLang) {
  if (targetLang === 'fr') return null; // French is default, no translation needed

  const langNames = { ar: 'Arabic (RTL, formal Islamic context)', en: 'English' };
  const langName = langNames[targetLang] || targetLang;

  // Check cache first
  const cache = getCache();
  const cached = cache[targetLang] || {};
  const missing = {};
  texts.forEach(({ key, text }) => {
    if (!cached[key]) missing[key] = text;
  });

  if (Object.keys(missing).length === 0) return cached;

  // Prepare translation request
  const toTranslate = Object.entries(missing)
    .map(([key, text]) => `${key}|||${text}`)
    .join('\n');

  const systemPrompt = `You are a professional translator specializing in Islamic educational applications.
Translate the UI strings from French to ${langName}.
Context: This is a Quran memorization tracking app (حفظ القرآن).
Keep these terms unchanged: Hizb, Tomon, Roboe, Nisf, Supabase, Vercel.
For Arabic: use formal Modern Standard Arabic (فصحى). Keep numbers as digits.
Return ONLY the translations in this exact format: key|||translation
One per line. No explanations, no extra text.`;

  const userPrompt = `Translate these UI strings to ${langName}:\n\n${toTranslate}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '';

    // Parse translations
    const newTranslations = { ...cached };
    rawText.split('\n').forEach(line => {
      const parts = line.split('|||');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const translation = parts[1].trim();
        if (key && translation) newTranslations[key] = translation;
      }
    });

    // Save to cache
    setCache(targetLang, newTranslations);
    return newTranslations;
  } catch (err) {
    console.error('Translation error:', err);
    return cached;
  }
}

// Extract all text nodes from the DOM that need translation
export function extractPageTexts() {
  const texts = [];
  const seen = new Set();

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text.length > 1 && text.length < 200 && !seen.has(text) && !/^\d+$/.test(text)) {
        // Skip pure numbers, emojis only, dates
        const hasLetters = /[a-zA-ZÀ-ÿ]/.test(text);
        if (hasLetters) {
          seen.add(text);
          const key = text.substring(0, 50).replace(/[^a-zA-ZÀ-ÿ0-9]/g, '_').toLowerCase();
          texts.push({ key: `dyn_${key}`, text, node });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip scripts, styles, inputs
      const tag = node.tagName?.toLowerCase();
      if (['script','style','input','textarea','select'].includes(tag)) return;
      // Skip elements with data-notranslate
      if (node.getAttribute?.('data-notranslate') === 'true') return;
      node.childNodes.forEach(processNode);
    }
  }

  const mainContent = document.querySelector('.main-content, .main-content-mobile, main');
  if (mainContent) processNode(mainContent);

  return texts;
}

// Apply translations to DOM
export function applyTranslations(translations, texts) {
  texts.forEach(({ text, node, key }) => {
    const translated = translations[`dyn_${text.substring(0, 50).replace(/[^a-zA-ZÀ-ÿ0-9]/g, '_').toLowerCase()}`];
    if (translated && node.parentNode) {
      node.textContent = node.textContent.replace(text, translated);
    }
  });
}

// Store original FR text to allow switching back
let originalTexts = new Map();

export function saveOriginalTexts() {
  const mainContent = document.querySelector('.main-content, .main-content-mobile, main');
  if (!mainContent) return;
  originalTexts.set('html', mainContent.innerHTML);
}

export function restoreOriginalTexts() {
  const mainContent = document.querySelector('.main-content, .main-content-mobile, main');
  if (!mainContent) return;
  const saved = originalTexts.get('html');
  if (saved) mainContent.innerHTML = saved;
}

export function clearTranslationCache() {
  localStorage.removeItem(CACHE_KEY);
}
