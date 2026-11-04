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
import { registerFormSchema, isEmail, type RegisterValues } from '@/schemas/authSchemas';
import { useAuthStore } from '@/store/authStore';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const [serverError, setServerError] = useState<unknown>();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: '',
      contact: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      // The API takes `email` and `phone` as separate fields; the single
      // "e-poçt / telefon" input is split here.
      const contact = values.contact.trim();
      await register({
        username: values.username.trim(),
        ...(isEmail(contact) ? { email: contact } : { phone: contact }),
        displayName: values.displayName || undefined,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/auth/welcome' as never);
    } catch (error) {
      setServerError(error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });

  return (
    <AppScreen title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <Card>
        <Controller
          control={control}
          name="username"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField
              label={t('auth.username')}
              placeholder={t('auth.usernamePlaceholder')}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              error={errors.username ? t('auth.fieldRequired') : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="contact"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField
              label={t('auth.emailPhone')}
              placeholder={t('auth.emailPhonePlaceholder')}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              error={errors.contact ? t('auth.invalidEmailPhone') : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField
              label={t('profile.displayName')}
              placeholder={t('auth.displayNamePlaceholder')}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              textContentType="name"
              error={errors.displayName ? t('auth.fieldRequired') : undefined}
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
              textContentType="newPassword"
              error={errors.password ? t('auth.passwordLength') : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <PasswordField
              label={t('auth.confirmPassword')}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              autoCapitalize="none"
              textContentType="newPassword"
              error={errors.confirmPassword ? t('auth.passwordsDoNotMatch') : undefined}
            />
          )}
        />
        {serverError ? <ErrorBanner error={serverError} onDismiss={() => setServerError(undefined)} /> : null}
        <Button label={t('auth.createAccount')} onPress={() => void onSubmit()} loading={isSubmitting} />
      </Card>
      <View style={styles.footer}>
        <AppText color={colors.textMuted}>{t('auth.haveAccount')}</AppText>
        <Button label={t('auth.signIn')} variant="ghost" onPress={() => router.push('/auth/login')} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: 20, alignItems: 'center' },
});
