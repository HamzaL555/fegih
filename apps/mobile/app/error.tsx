import i18next from 'i18next';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Route-level fallback used by Expo Router when a screen throws.
 *
 * Like the root `ErrorBoundary`, it deliberately avoids `useTheme`,
 * `AppText`, `Card`, `Button` and `AppScreen`: this file can be rendered while
 * the tree is already failing, and a second throw would blank the app.
 */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const palette = dark
    ? { background: '#0C1717', surface: '#142424', text: '#F0F7F5', muted: '#A7BFBA', danger: '#FF8D85', primary: '#4DB6AC', border: '#294442' }
    : { background: '#F5F8F7', surface: '#FFFFFF', text: '#102A2A', muted: '#607574', danger: '#B42318', primary: '#0F766E', border: '#D5E2DF' };

  const goBack = () => {
    try {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (navigationError) {
      console.error('[Fegih] Could not navigate back from the route error screen:', navigationError);
      if (typeof window !== 'undefined' && window.location) {
        if (window.history.length > 1) window.history.back();
        else window.location.replace('/');
      }
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: palette.background }]} accessibilityRole="alert">
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.danger }]}>{i18next.t('remote.errorTitle')}</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>{i18next.t('errors.server')}</Text>
        {isDevelopment ? (
          <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
            <Text selectable style={[styles.message, { color: palette.text }]}>
              {error?.message || i18next.t('errors.generic')}
            </Text>
            {error?.stack ? (
              <Text selectable style={[styles.stack, { color: palette.muted }]}>
                {error.stack}
              </Text>
            ) : null}
          </ScrollView>
        ) : (
          <Text style={[styles.message, { color: palette.muted }]}>{i18next.t('errors.generic')}</Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={reset}
          style={({ pressed }) => [styles.button, { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.buttonLabel}>{i18next.t('common.retry')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.link}>
          <Text style={[styles.linkLabel, { color: palette.primary }]}>{i18next.t('common.back')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 560, maxHeight: '90%', borderWidth: 1, borderRadius: 16, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  details: { maxHeight: 260, marginBottom: 18 },
  detailsContent: { gap: 10 },
  message: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  stack: { fontSize: 12, lineHeight: 17, fontFamily: 'monospace' },
  button: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  buttonLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  link: { marginTop: 14, alignItems: 'center', paddingVertical: 6 },
  linkLabel: { fontSize: 14, fontWeight: '600' },
});
