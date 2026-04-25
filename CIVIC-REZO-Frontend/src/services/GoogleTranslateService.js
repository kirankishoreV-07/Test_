const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

const buildTranslateUrl = (text, targetLanguage) => {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: targetLanguage,
    dt: 't',
    q: text
  });

  return `${GOOGLE_TRANSLATE_URL}?${params.toString()}`;
};

const parseGoogleTranslateResponse = (payload) => {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return null;
  }

  return payload[0]
    .map((entry) => (Array.isArray(entry) ? entry[0] : ''))
    .join('')
    .trim();
};

export const translateText = async (text, targetLanguage) => {
  const sourceText = String(text || '').trim();
  if (!sourceText) return '';

  const response = await fetch(buildTranslateUrl(sourceText, targetLanguage));
  if (!response.ok) {
    throw new Error(`Google translate request failed (${response.status})`);
  }

  const payload = await response.json();
  const translated = parseGoogleTranslateResponse(payload);
  return translated || sourceText;
};

export const translateBatch = async (texts, targetLanguage, options = {}) => {
  const concurrency = Number(options.concurrency || 6);
  const safeTexts = Array.isArray(texts) ? texts : [];
  const output = new Array(safeTexts.length);
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < safeTexts.length) {
      const next = currentIndex;
      currentIndex += 1;

      const sourceText = String(safeTexts[next] || '').trim();
      if (!sourceText) {
        output[next] = '';
        continue;
      }

      try {
        output[next] = await translateText(sourceText, targetLanguage);
      } catch {
        output[next] = sourceText;
      }
    }
  };

  const workers = [];
  for (let index = 0; index < concurrency; index += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return output;
};
