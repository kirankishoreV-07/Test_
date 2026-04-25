import { useMemo } from 'react';
import { useAppLanguage } from './AppLanguageContext';

export const useTranslation = () => {
  const { language, translate } = useAppLanguage();

  const api = useMemo(
    () => ({
      t: (keyOrText, options) => translate(keyOrText, options),
      i18n: { language }
    }),
    [language, translate]
  );

  return api;
};
