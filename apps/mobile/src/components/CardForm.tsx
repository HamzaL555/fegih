import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/providers/ThemeProvider';

/** Stripe's published test cards. None of them can move real money. */
export const TEST_CARDS = [
  { number: '4242424242424242', label: 'Visa — hər zaman uğurlu', expiry: '12/34', cvc: '123' },
  { number: '5555555555554444', label: 'Mastercard — uğurlu', expiry: '12/34', cvc: '123' },
  { number: '4000000000000002', label: 'Visa — rədd edilir (4002)', expiry: '12/34', cvc: '123' },
  { number: '4000000000009995', label: 'Visa — balans kifayət etmir (9995)', expiry: '12/34', cvc: '123' },
] as const;

export type CardDetails = { number: string; expiry: string; cvc: string; name: string };

/** Luhn checksum — the same rule every card network uses. */
export function luhnValid(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Groups into blocks of four while typing. */
export function formatCardNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
}

/** Keeps this to `MM/YY` and rejects impossible months. */
export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function expiryValid(raw: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(raw.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  // An expired card is as useless as an invalid one, so check it up front.
  const end = new Date(year, month, 0, 23, 59, 59);
  return end.getTime() >= Date.now();
}

/** Only the leading digits of the PAN identify a brand; the rest is opaque. */
export function cardBrand(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6/.test(digits)) return 'Discover';
  return null;
}

export type CardFormProps = {
  value: CardDetails;
  onChange: (next: CardDetails) => void;
  /** Card payments are simulated locally when this is true. */
  simulated: boolean;
  /** Surfaces an API-side decline on the number field. */
  declined?: boolean;
};

export function CardForm({ value, onChange, simulated, declined }: CardFormProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [touched, setTouched] = useState({ number: false, expiry: false, cvc: false });

  const brand = useMemo(() => cardBrand(value.number), [value.number]);
  const numberError = touched.number && !luhnValid(value.number) ? t('checkout.cardNumberInvalid') : undefined;
  const expiryError = touched.expiry && !expiryValid(value.expiry) ? t('checkout.cardExpiryInvalid') : undefined;
  const cvcError = touched.cvc && !/^\d{3,4}$/.test(value.cvc) ? t('checkout.cardCvcInvalid') : undefined;
  const declinedError = declined ? t('checkout.cardDeclined') : undefined;

  const fill = (card: (typeof TEST_CARDS)[number]) =>
    onChange({ ...value, number: card.number, expiry: card.expiry, cvc: card.cvc, name: value.name || 'TEST USER' });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="subtitle">{simulated ? 'Test kartı ilə ödəniş' : 'Kart məlumatları'}</AppText>
        {brand ? (
          <View style={[styles.brand, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
            <AppText variant="caption" color={colors.primary}>{brand}</AppText>
          </View>
        ) : null}
      </View>

      {simulated ? (
        <View style={[styles.notice, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <AppText variant="caption" color={colors.textMuted}>
            Stripe açarı yoxdur, ödəniş lokalda simulyasiya edilir — real pul çıxarılmır. Aşağıdakı test
            kartlarından birini seçin və ya öz nömrənizi yazın.
          </AppText>
          <View style={styles.testCards}>
            {TEST_CARDS.map((card) => (
              <Pressable
                key={card.number}
                accessibilityRole="button"
                onPress={() => fill(card)}
                style={({ pressed }) => [
                  styles.testCard,
                  { borderColor: value.number === card.number ? colors.primary : colors.border, backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
                ]}
              >
                <AppText variant="label" color={colors.text}>{card.label}</AppText>
                <AppText variant="caption" color={colors.textMuted}>{card.number.replace(/(\d{4})\d+(\d{4})/, '$1 •••• $2')}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <TextField
        label="Kart nömrəsi"
        value={value.number}
        onChangeText={(next) => onChange({ ...value, number: formatCardNumber(next) })}
        onBlur={() => setTouched((state) => ({ ...state, number: true }))}
        keyboardType="number-pad"
        placeholder="4242 4242 4242 4242"
        error={declinedError ?? numberError}
        maxLength={23}
      />
      <View style={styles.row}>
        <TextField
          label="Tarix"
          value={value.expiry}
          onChangeText={(next) => onChange({ ...value, expiry: formatExpiry(next) })}
          onBlur={() => setTouched((state) => ({ ...state, expiry: true }))}
          keyboardType="number-pad"
          placeholder="AA/İİ"
          error={expiryError}
          maxLength={5}
          containerStyle={styles.flex}
        />
        <TextField
          label="CVC"
          value={value.cvc}
          onChangeText={(next) => onChange({ ...value, cvc: next.replace(/\D/g, '').slice(0, 4) })}
          onBlur={() => setTouched((state) => ({ ...state, cvc: true }))}
          keyboardType="number-pad"
          placeholder="123"
          error={cvcError}
          maxLength={4}
          containerStyle={styles.flex}
          secureTextEntry
        />
      </View>
      <TextField
        label="Kart sahibinin adı"
        value={value.name}
        onChangeText={(next) => onChange({ ...value, name: next })}
        autoCapitalize="words"
        placeholder={value.name ? undefined : 'TEST USER'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  testCards: { gap: 8 },
  testCard: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 2 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});