import { StyleSheet, View } from 'react-native';

/**
 * Temporary verification route. It throws during render so the route-level
 * error boundary (app/error.tsx) and the root ErrorBoundary can be exercised in
 * a real browser. Deleted after verification.
 */
export default function ErrorTestScreen(): React.JSX.Element {
  throw new Error('Artificial ErrorBoundary verification failure');
}

// Keep a style reference so Expo Router treats this as a normal route module.
const styles = StyleSheet.create({ root: { flex: 1 } });
void View;
void styles;
