import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, Image, StyleSheet, View } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ListRow, RowDescription, RowTitle } from '@/components/ListRow';
import { RemoteState } from '@/components/RemoteState';
import { StatCard } from '@/components/StatCard';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { messagesApi, usersApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useNotificationPermission } from '@/providers/NotificationProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { passwordSchema, profileSchema, type PasswordValues, type ProfileValues } from '@/schemas/profileSchemas';
import { useAuthStore } from '@/store/authStore';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { requestPermission } = useNotificationPermission();
  const status = useAuthStore((state) => state.status);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const logout = useAuthStore((state) => state.logout);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const [imageUri, setImageUri] = useState<string>();
  const [actionError, setActionError] = useState<unknown>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const profileQuery = useRemoteQuery({
    queryKey: ['users', 'me'],
    queryFn: () => usersApi.me(),
    enabled: status === 'authenticated',
  });
  /** Unread support replies, shown next to the messages entry. */
  const unreadQuery = useRemoteQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messagesApi.unreadCount(),
    enabled: status === 'authenticated',
    staleTime: 30_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const unreadMessages = unreadQuery.data?.unreadCount ?? 0;
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '', bio: '' },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) => useAuthStore.getState().changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      setSuccessMessage(t('profile.passwordChanged'));
      setActionError(undefined);
      passwordForm.reset();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: setActionError,
  });
  const saveProfile = profileForm.handleSubmit(async (values) => {
    setActionError(undefined);
    setSuccessMessage(undefined);
    try {
      await updateProfile({ ...values, ...(imageUri ? { avatarUrl: imageUri } : {}) });
      await queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      setSuccessMessage(t('profile.profileUpdated'));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setActionError(error);
    }
  });

  if (status !== 'authenticated') {
    return <AppScreen title={t('profile.title')}><AuthRequired /></AppScreen>;
  }

  const user = profileQuery.data;
  const chooseImage = async () => {
    setActionError(undefined);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setActionError(new Error(t('common.required')));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('profile.deleteConfirmTitle'), t('profile.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.deleteAccount'), style: 'destructive', onPress: () => void handleDelete() },
    ]);
  };

  const handleDelete = async () => {
    try {
      await deleteAccount();
      router.replace('/auth/login');
    } catch (error) {
      setActionError(error);
    }
  };

  return (
    <AppScreen
      title={t('profile.title')}
      refreshing={profileQuery.isRefetching}
      onRefresh={() => void profileQuery.refetch()}
    >
      <RemoteState
        isLoading={profileQuery.isPending}
        isError={profileQuery.isError}
        error={profileQuery.error}
        onRetry={() => void profileQuery.refetch()}
        loadingLabel={t('remote.loading')}
      >
        {user ? (
          <View>
            <Card>
              <View style={styles.identity}>
                {imageUri || user.avatarUrl ? <Image source={{ uri: imageUri ?? user.avatarUrl ?? undefined }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarPlaceholder]} />}
                <View style={styles.identityText}>
                  <AppText variant="title">{user.displayName || user.username}</AppText>
                  <AppText color={colors.textMuted}>{user.email || user.phone || user.username}</AppText>
                </View>
              </View>
              <Button label={t('profile.chooseImage')} onPress={() => void chooseImage()} variant="secondary" />
            </Card>

            <View style={styles.stats}>
              <StatCard label={t('profile.points')} value={user.points ?? user.totalPoints} />
              <StatCard label={t('profile.level')} value={user.level} />
              <StatCard label={t('profile.streak')} value={user.streak} />
            </View>

            <ScreenSection>
              <AppText variant="subtitle" style={styles.sectionTitle}>{t('profile.editProfile')}</AppText>
              <Card>
                <Controller
                  control={profileForm.control}
                  name="displayName"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextField label={t('profile.displayName')} value={value ?? ''} onBlur={onBlur} onChangeText={onChange} placeholder={user.displayName ?? ''} error={profileForm.formState.errors.displayName ? t('common.required') : undefined} />
                  )}
                />
                <Controller
                  control={profileForm.control}
                  name="bio"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextField label={t('profile.bio')} value={value ?? ''} onBlur={onBlur} onChangeText={onChange} placeholder={user.bio ?? ''} multiline numberOfLines={4} style={styles.multiline} error={profileForm.formState.errors.bio ? t('common.required') : undefined} />
                  )}
                />
                {actionError ? <ErrorBanner error={actionError} onDismiss={() => setActionError(undefined)} /> : null}
                {successMessage ? <AppText color={colors.success} style={styles.success}>{successMessage}</AppText> : null}
                <Button label={t('common.save')} onPress={() => void saveProfile()} loading={profileForm.formState.isSubmitting} />
              </Card>
            </ScreenSection>

            <ScreenSection>
              <AppText variant="subtitle" style={styles.sectionTitle}>{t('profile.changePassword')}</AppText>
              <Card>
                <Controller
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field: { onBlur, onChange, value } }) => <PasswordField label={t('profile.currentPassword')} value={value} onBlur={onBlur} onChangeText={onChange} error={passwordForm.formState.errors.currentPassword ? t('common.required') : undefined} />}
                />
                <Controller
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field: { onBlur, onChange, value } }) => <PasswordField label={t('profile.newPassword')} value={value} onBlur={onBlur} onChangeText={onChange} error={passwordForm.formState.errors.newPassword ? t('auth.passwordLength') : undefined} />}
                />
                <Controller
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field: { onBlur, onChange, value } }) => <PasswordField label={t('auth.confirmPassword')} value={value} onBlur={onBlur} onChangeText={onChange} error={passwordForm.formState.errors.confirmPassword ? t('auth.passwordsDoNotMatch') : undefined} />}
                />
                <Button label={t('profile.changePassword')} onPress={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))} loading={passwordMutation.isPending} variant="secondary" />
              </Card>
            </ScreenSection>

            <ScreenSection>
              <Card style={styles.menu}>
                <ListRow onPress={() => router.push('/orders')}><RowTitle>{t('profile.orders')}</RowTitle></ListRow>
                <ListRow onPress={() => router.push('/favorites')}><RowTitle>{t('profile.favorites')}</RowTitle></ListRow>
                <ListRow onPress={() => router.push('/notifications')}><RowTitle>{t('profile.notifications')}</RowTitle></ListRow>
                {/* Support inbox; the badge comes from the unread counter. */}
                <ListRow onPress={() => router.push('/messages')}><RowTitle>{t('messages.title')}</RowTitle><RowDescription>{unreadMessages > 0 ? t('messages.unread', { count: unreadMessages }) : t('messages.subtitle')}</RowDescription></ListRow>
                <ListRow onPress={() => router.push('/contacts')}><RowTitle>{t('contacts.title')}</RowTitle><RowDescription>{t('contacts.subtitle')}</RowDescription></ListRow>
                <ListRow onPress={() => router.push('/settings')}><RowTitle>{t('profile.settings')}</RowTitle></ListRow>
                <ListRow onPress={() => void requestPermission()}><RowTitle>{t('profile.notifications')}</RowTitle><RowDescription>{t('settings.permissionGranted')}</RowDescription></ListRow>
              </Card>
            </ScreenSection>

            <Button label={t('profile.logout')} onPress={() => void logout().then(() => router.replace('/auth/login'))} variant="secondary" style={styles.dangerButton} />
            <Button label={t('profile.deleteAccount')} onPress={confirmDelete} variant="danger" />
          </View>
        ) : null}
      </RemoteState>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DDE7E4' },
  avatarPlaceholder: { backgroundColor: '#B8D3CD' },
  identityText: { flex: 1, marginLeft: 14 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  sectionTitle: { marginBottom: 10 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  success: { marginVertical: 10 },
  menu: { paddingHorizontal: 16, paddingVertical: 4 },
  dangerButton: { marginTop: 20, marginBottom: 10 },
});
