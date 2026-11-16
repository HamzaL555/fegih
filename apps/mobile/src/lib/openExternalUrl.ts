import i18next from 'i18next';
import { Alert, Linking } from 'react-native';

/**
 * Opens a URL outside the app.
 *
 * `Linking.openURL` rejects when no browser/handler can accept the URL (for
 * example a malformed deep link or a desktop machine without a mail client).
 * Callers must not leave that rejection unhandled: log the cause and tell the
 * user instead of silently doing nothing.
 *
 * Returns `true` when the URL was handed off, `false` when it could not be.
 */
export async function openExternalUrl(url: string, context: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error(`[Fegih] Could not open ${context}:`, error);
    Alert.alert(i18next.t('remote.errorTitle'), i18next.t('errors.generic'));
    return false;
  }
}
