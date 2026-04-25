import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../i18n/useTranslation';
import { useAppLanguage } from '../i18n/AppLanguageContext';

const LanguageSwitcher = ({ compact = false }) => {
  const { t } = useTranslation();
  const { language, changeLanguage, supportedLanguages } = useAppLanguage();
  const [visible, setVisible] = useState(false);

  const selectedLanguage = useMemo(
    () => supportedLanguages.find((item) => item.code === language),
    [supportedLanguages, language]
  );

  const handleSelect = async (code) => {
    await changeLanguage(code);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, compact && styles.triggerCompact]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="language-outline" size={18} color="#1F2937" />
        <Text style={styles.triggerText}>
          {compact ? selectedLanguage?.nativeName : `${t('language.title')}: ${selectedLanguage?.nativeName}`}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('language.switcherTitle')}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {supportedLanguages.map((item) => {
              const isSelected = item.code === language;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.item, isSelected && styles.itemSelected]}
                  onPress={() => handleSelect(item.code)}
                >
                  <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>{item.nativeName}</Text>
                  {isSelected ? <Ionicons name="checkmark-circle" size={18} color="#16A34A" /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6
  },
  triggerCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  triggerText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '600'
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 20
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  item: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  itemSelected: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4'
  },
  itemText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600'
  },
  itemTextSelected: {
    color: '#166534'
  }
});

export default LanguageSwitcher;
