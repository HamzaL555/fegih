import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/providers/ThemeProvider';
import { loginSchema, type LoginValues } from '@/schemas/authSchemas';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [serverError, setServerError] = useState<unknown>();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      await login(values);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (error) {
      setServerError(error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });

  return (
    <AppScreen title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <Card>
        <Controller
          control={control}
          name="identifier"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField
              label={t('auth.identifierLabel')}
              placeholder={t('auth.identifierPlaceholder')}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="next"
              error={errors.identifier ? t('auth.fieldRequired') : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <PasswordField
              label={t('auth.password')}
              placeholder={t('auth.passwordPlaceholder')}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              autoCapitalize="none"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={() => void onSubmit()}
              error={errors.password ? t('auth.passwordLength') : undefined}
            />
          )}
        />
        {serverError ? <ErrorBanner error={serverError} onDismiss={() => setServerError(undefined)} /> : null}
        <Button label={t('auth.signIn')} onPress={() => void onSubmit()} loading={isSubmitting} />
      </Card>
      <View style={styles.footer}>
        <AppText color={colors.textMuted}>{t('auth.noAccount')}</AppText>
        <Button label={t('auth.createAccount')} variant="ghost" onPress={() => router.push('/auth/register')} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: 20, alignItems: 'center' },
});
