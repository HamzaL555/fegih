import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/providers/ThemeProvider';

export function AuthRequired() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Card style={styles.card}>
      <AppText variant="subtitle" color={colors.text}>{t('auth.authRequired')}</AppText>
      <Button label={t('common.signIn')} onPress={() => router.push('/auth/login')} style={styles.button} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20 },
  button: { marginTop: 16 },
});
