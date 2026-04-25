export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English', speechLocale: 'en-US' },
  { code: 'hi', nativeName: 'हिंदी', speechLocale: 'hi-IN' },
  { code: 'ta', nativeName: 'தமிழ்', speechLocale: 'ta-IN' },
  { code: 'te', nativeName: 'తెలుగు', speechLocale: 'te-IN' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', speechLocale: 'kn-IN' },
  { code: 'ml', nativeName: 'മലയാളം', speechLocale: 'ml-IN' }
];

export const APP_LANGUAGE_STORAGE_KEY = 'appLanguage';

export const FALLBACK_LANGUAGE = 'en';

export const getSupportedLanguageCode = (value) => {
  const normalized = String(value || '').toLowerCase().split('-')[0];
  const match = SUPPORTED_LANGUAGES.find((lang) => lang.code === normalized);
  return match ? match.code : FALLBACK_LANGUAGE;
};

export const getSpeechLocaleForAppLanguage = (appLanguageCode) => {
  const code = getSupportedLanguageCode(appLanguageCode);
  const match = SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
  return match?.speechLocale || 'en-US';
};
