import * as Linking from 'expo-linking';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useTheme } from '@/providers/ThemeProvider';
import { APP_SOCIALS } from '@/config/contacts';

/**
 * Contact shortcuts: phone, Instagram, TikTok and the website, each with its
 * own brand mark rather than a plain text link.
 */
export default function ContactsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <AppScreen title={t('contacts.title')} subtitle={t('contacts.subtitle')}>
      <Card style={styles.card}>
        <View style={styles.grid}>
          {APP_SOCIALS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="link"
              accessibilityLabel={t(item.labelKey)}
              onPress={() => {
                if (item.kind === 'phone') void Linking.openURL(`tel:${item.value}`);
                else if (item.kind === 'email') void Linking.openURL(`mailto:${item.value}`);
                else void Linking.openURL(item.url);
              }}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${item.color}1A` }]}>
                <item.Icon color={item.color} size={26} />
              </View>
              <AppText variant="subtitle" style={styles.itemTitle}>{t(item.labelKey)}</AppText>
              <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                {item.display}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="subtitle">{t('contacts.appTitle')}</AppText>
        <AppText color={colors.textMuted} style={styles.about}>
          {t('contacts.appBody')}
        </AppText>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: {
    // Two per row with the 12px gap accounted for.
    width: '47.5%',
    minHeight: 132,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { textAlign: 'center' },
  about: { marginTop: 8 },
});
