import { useNavigation, useRouter } from 'expo-router';
import { PropsWithChildren } from 'react';
import { Pressable, RefreshControl, ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { AnimatedBackdrop } from '@/components/AnimatedBackdrop';
import { useResponsive } from '@/hooks/useResponsive';
import { useTheme } from '@/providers/ThemeProvider';

export interface AppScreenProps extends ScrollViewProps {
  title?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Renders an explicit back affordance. Defaults to "history depth > 1". */
  showBack?: boolean;
  right?: React.ReactNode;
  /** Ambient motion behind the content. Off for dense data screens. */
  backdrop?: boolean;
}

export function AppScreen({
  children,
  title,
  subtitle,
  refreshing = false,
  onRefresh,
  showBack,
  right,
  backdrop = true,
  contentContainerStyle,
  ...props
}: PropsWithChildren<AppScreenProps>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { contentWidth, isPhone } = useResponsive();
  const router = useRouter();
  const navigation = useNavigation();
  // Every push screen is rendered inside a headerless Stack, so iOS users had
  // no way back at all.
  const canGoBack = showBack ?? (navigation?.canGoBack?.() ?? false);
  const goBack = () => {
    if (navigation?.canGoBack?.()) {
      if (router.canGoBack()) router.back();
      else navigation.goBack();
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Behind everything, so it can never intercept a touch. */}
      <AnimatedBackdrop enabled={backdrop} />
      {canGoBack ? (
        <View style={styles.header}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={12} style={styles.back}>
            <AppText variant="title" color={colors.primary}>‹</AppText>
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        {...props}
        contentContainerStyle={[styles.content, { maxWidth: contentWidth }, contentContainerStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
      >
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            {title ? <AppText variant="title" style={styles.title}>{title}</AppText> : null}
            {subtitle ? <AppText color={colors.textMuted} style={styles.subtitle}>{subtitle}</AppText> : null}
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenSection({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.section, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 0, minHeight: 40 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 4, paddingBottom: 40, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  titleBlock: { flex: 1 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 4 },
  section: { marginTop: 22 },
});
