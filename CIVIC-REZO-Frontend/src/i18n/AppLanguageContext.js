import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import englishCommon from './locales/en/common.json';
import { translateBatch } from '../services/GoogleTranslateService';
import {
  APP_LANGUAGE_STORAGE_KEY,
  FALLBACK_LANGUAGE,
  getSpeechLocaleForAppLanguage,
  getSupportedLanguageCode,
  SUPPORTED_LANGUAGES
} from './languageConfig';

const AppLanguageContext = createContext(null);

const TRANSLATION_CACHE_VERSION = 'v1';
const EMPTY_OBJECT = Object.freeze({});

const flattenTranslationTree = (node, prefix = '', output = {}) => {
  Object.entries(node || {}).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      output[nextKey] = value;
      return;
    }
    if (value && typeof value === 'object') {
      flattenTranslationTree(value, nextKey, output);
    }
  });
  return output;
};

const ENGLISH_KEY_MAP = flattenTranslationTree(englishCommon);

const interpolate = (template, options = {}) => {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => {
    const value = options[token];
    return value === undefined || value === null ? '' : String(value);
  });
};

const getCacheKeyForLanguage = (languageCode) => `appTranslations.${TRANSLATION_CACHE_VERSION}.${languageCode}`;

const resolveSourceText = (keyOrText, options = {}) => {
  const key = String(keyOrText || '').trim();
  if (!key) return '';
  const fromDictionary = ENGLISH_KEY_MAP[key];
  if (typeof fromDictionary === 'string') return fromDictionary;
  if (typeof options.defaultValue === 'string') return options.defaultValue;
  return key;
};

export const AppLanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(FALLBACK_LANGUAGE);
  const [ready, setReady] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedByKey, setTranslatedByKey] = useState(EMPTY_OBJECT);
  const translatingLanguagesRef = useRef(new Set());

  useEffect(() => {
    let isMounted = true;

    const bootLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
        const resolvedLanguage = getSupportedLanguageCode(storedLanguage || FALLBACK_LANGUAGE);
        if (isMounted) {
          setLanguage(resolvedLanguage);
        }
      } catch (error) {
        console.warn('Failed to initialize app language:', error?.message || error);
      } finally {
        if (isMounted) {
          setReady(true);
        }
      }
    };

    bootLanguage();

    return () => {
      isMounted = false;
    };
  }, []);

  const hydrateTranslations = useCallback(async (languageCode) => {
    const resolvedLanguage = getSupportedLanguageCode(languageCode);
    if (resolvedLanguage === FALLBACK_LANGUAGE) {
      setTranslatedByKey(EMPTY_OBJECT);
      setIsTranslating(false);
      return;
    }

    const cacheKey = getCacheKeyForLanguage(resolvedLanguage);
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          setTranslatedByKey(parsed);
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to load translation cache:', error?.message || error);
    }

    if (translatingLanguagesRef.current.has(resolvedLanguage)) {
      return;
    }

    translatingLanguagesRef.current.add(resolvedLanguage);
    setIsTranslating(true);

    try {
      const entries = Object.entries(ENGLISH_KEY_MAP).filter(([, text]) => String(text || '').trim().length > 0);
      const translatedValues = await translateBatch(
        entries.map(([, text]) => text),
        resolvedLanguage,
        { concurrency: 5 }
      );

      const nextTranslatedByKey = {};
      entries.forEach(([key, fallbackText], index) => {
        const translated = translatedValues[index];
        nextTranslatedByKey[key] = String(translated || fallbackText);
      });

      await AsyncStorage.setItem(cacheKey, JSON.stringify(nextTranslatedByKey));

      if (resolvedLanguage === languageCode) {
        setTranslatedByKey(nextTranslatedByKey);
      }
    } catch (error) {
      console.warn('Failed to build Google translation cache:', error?.message || error);
      setTranslatedByKey(EMPTY_OBJECT);
    } finally {
      translatingLanguagesRef.current.delete(resolvedLanguage);
      setIsTranslating(false);
    }
  }, []);

  useEffect(() => {
    hydrateTranslations(language);
  }, [language, hydrateTranslations]);

  const changeLanguage = async (nextLanguageCode) => {
    const resolvedLanguage = getSupportedLanguageCode(nextLanguageCode);
    setLanguage(resolvedLanguage);
    await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, resolvedLanguage);
  };

  const translate = useCallback(
    (keyOrText, options = {}) => {
      const sourceText = resolveSourceText(keyOrText, options);
      const key = String(keyOrText || '').trim();

      if (language === FALLBACK_LANGUAGE) {
        return interpolate(sourceText, options);
      }

      const translatedText = translatedByKey[key] || sourceText;
      return interpolate(translatedText, options);
    },
    [language, translatedByKey]
  );

  const value = useMemo(
    () => ({
      ready,
      language,
      changeLanguage,
      translate,
      isTranslating,
      speechLocale: getSpeechLocaleForAppLanguage(language),
      supportedLanguages: SUPPORTED_LANGUAGES
    }),
    [ready, language, translate, isTranslating]
  );

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
};

export const useAppLanguage = () => {
  const context = useContext(AppLanguageContext);
  if (!context) {
    throw new Error('useAppLanguage must be used within AppLanguageProvider');
  }
  return context;
};
