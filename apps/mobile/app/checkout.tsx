import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CardForm, expiryValid, luhnValid, type CardDetails } from '@/components/CardForm';
import { BankIcon, CardIcon, LockIcon, TruckIcon } from '@/components/icons';
import { ErrorBanner } from '@/components/ErrorBanner';
import { PriceText } from '@/components/PriceText';
import { RemoteState } from '@/components/RemoteState';
import { TextField } from '@/components/TextField';
import { cartApi, ordersApi, usersApi } from '@/api';
import { getApiError } from '@/utils/errors';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/providers/ThemeProvider';

type PaymentMethod = 'CARD' | 'CASH_ON_DELIVERY' | 'BANK_TRANSFER';

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const client = useQueryClient();
  const status = useAuthStore((state) => state.status);

  const userQuery = useQuery({ queryKey: ['users', 'me'], queryFn: () => usersApi.me(), enabled: status === 'authenticated' });
  const cartQuery = useQuery({ queryKey: ['cart'], queryFn: () => cartApi.get(), enabled: status === 'authenticated' });
  /**
   * Which payment methods actually work. Card payments need a Stripe key, so
   * offering them without one produced a 503 at the moment of payment.
   */
  const configQuery = useQuery({ queryKey: ['orders', 'payment-config'], queryFn: () => ordersApi.paymentConfig(), enabled: status === 'authenticated' });
  const methods = configQuery.data?.methods ?? [];
  const [method, setMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');

  const [fullName, setFullName] = useState(userQuery.data?.displayName ?? userQuery.data?.username ?? '');
  const [phone, setPhone] = useState(userQuery.data?.phone ?? '');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [card, setCard] = useState<CardDetails>({ number: '', expiry: '', cvc: '', name: '' });
  const [cardDeclined, setCardDeclined] = useState(false);
  const [error, setError] = useState<unknown>();
  const [placed, setPlaced] = useState<string>();

  useEffect(() => {
    if (!userQuery.data) return;
    setFullName((current) => current || userQuery.data.displayName || userQuery.data.username || '');
    setPhone((current) => current || userQuery.data.phone || '');
  }, [userQuery.data]);

  // Never leave the card option selected when the provider is not configured.
  useEffect(() => {
    if (!methods.length) return;
    const allowed = methods.filter((item) => item.available).map((item) => item.id as PaymentMethod);
    if (allowed.length && !allowed.includes(method)) setMethod(allowed[0]!);
  }, [methods, method]);

  const mutation = useMutation({
    mutationFn: () =>
      ordersApi.create({
        shippingAddress: { fullName, phone, city, address, postalCode: postalCode || undefined },
        promoCode: promoCode || undefined,
        paymentMethod: method,
        // Only the simulated card path sends details; cash and transfer have
        // none, and with a real Stripe key the card is collected by Stripe itself.
        card: method === 'CARD' && configQuery.data?.mocked
          ? { number: card.number, expiry: card.expiry, cvc: card.cvc, name: card.name }
          : undefined,
      }),
    onSuccess: async (result) => {
      setError(undefined);
      setCardDeclined(false);
      await client.invalidateQueries({ queryKey: ['cart'] });
      await client.invalidateQueries({ queryKey: ['orders'] });
      if (result.mocked) {
        // Card payment was simulated locally: no provider to hand off to.
        setPlaced(result.order.orderNumber ?? '');
        return;
      }
      if (result.payment?.url) {
        // Real card: hand off to the provider and let the webhook settle it.
        await Linking.openURL(result.payment.url);
        router.replace('/orders');
        return;
      }
      // Cash / bank transfer: the order exists and waits for an admin.
      setPlaced(result.order.orderNumber ?? '');
    },
    onError: (cause) => {
      // Only an actual decline from the bank should light up the card field.
      // Flagging it on every failure would blame the card for an address that
      // failed validation or for a dropped connection.
      setCardDeclined(getApiError(cause)?.code === 'CARD_DECLINED');
      setError(cause);
    },
  });

  const submit = () => {
    setError(undefined);
    setPlaced(undefined);
    setCardDeclined(false);
    if (!fullName || !phone || !city || !address) {
      setError(new Error(t('checkout.required')));
      return;
    }
    if (method === 'CARD' && configQuery.data?.mocked) {
      // Checked here as well as on the field so the button never posts a card
      // the server is going to reject — the API requires these too.
      if (!card.number) {
        setError(new Error(t('checkout.cardRequired')));
        return;
      }
      if (!luhnValid(card.number)) {
        setError(new Error(t('checkout.cardNumberInvalid')));
        return;
      }
      if (!expiryValid(card.expiry)) {
        setError(new Error(t('checkout.cardExpiryInvalid')));
        return;
      }
      if (!/^\d{3,4}$/.test(card.cvc)) {
        setError(new Error(t('checkout.cardCvcInvalid')));
        return;
      }
    }
    mutation.mutate();
  };

  if (status !== 'authenticated') {
    return <AppScreen title={t('checkout.title')}><AuthRequired /></AppScreen>;
  }

  const cart = cartQuery.data;

  return (
    <AppScreen title={t('checkout.title')} subtitle={t('checkout.subtitle')}>
      <RemoteState
        isLoading={cartQuery.isPending}
        isError={cartQuery.isError}
        error={cartQuery.error}
        onRetry={() => void cartQuery.refetch()}
        isEmpty={!cart?.items.length}
        emptyTitle={t('cart.empty')}
        emptyDescription={t('common.empty')}
      >
        {placed ? (
          <Card style={styles.placed}>
            <AppText variant="title" color={colors.success}>{t('checkout.placedTitle')}</AppText>
            <AppText color={colors.textMuted}>{t('checkout.placedBody', { number: placed })}</AppText>
            {configQuery.data?.mocked ? (
              <View style={[styles.mockNote, { backgroundColor: colors.surfaceElevated }]}>
                <AppText variant="caption" color={colors.secondary}>{t('checkout.mockNotice')}</AppText>
              </View>
            ) : null}
            <Button label={t('checkout.viewOrders')} onPress={() => router.replace('/orders')} />
          </Card>
        ) : (
          <Card style={styles.form}>
            <TextField label={t('checkout.fullName')} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <TextField label={t('checkout.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextField label={t('checkout.city')} value={city} onChangeText={setCity} />
            <TextField label={t('checkout.address')} value={address} onChangeText={setAddress} multiline numberOfLines={3} style={styles.multiline} />
            <TextField label={t('checkout.postalCode')} value={postalCode} onChangeText={setPostalCode} />
            <TextField label={t('checkout.promoCode')} value={promoCode} onChangeText={setPromoCode} autoCapitalize="characters" />

            {/* Order summary, including the loyalty discount already applied. */}
            <View style={[styles.summary, { borderTopColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <AppText color={colors.textMuted}>{t('cart.subtotal')}</AppText>
                <PriceText value={cart?.subtotal} currency={cart?.currency} />
              </View>
              {cart?.pointDiscount ? (
                <View style={styles.summaryRow}>
                  <AppText color={colors.success}>{t('cart.pointsDiscount', { percent: cart.discountPercent ?? 0 })}</AppText>
                  <PriceText value={-cart.pointDiscount} currency={cart.currency} />
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <AppText variant="subtitle">{t('cart.total')}</AppText>
                <PriceText value={cart?.total ?? cart?.subtotal} currency={cart?.currency} />
              </View>
            </View>
              <AppText variant="label" color={colors.textMuted}>{t('checkout.paymentMethod')}</AppText>
              {/* One tappable row per method with its own glyph, rather than
                  three unlabelled boxes. The selected row is the only filled
                  one, so the current choice is readable at a glance. */}
              <View style={styles.methods}>
                {methods.map((item) => {
                  const id = item.id as PaymentMethod;
                  const selected = method === id;
                  const Icon = id === 'CARD' ? CardIcon : id === 'CASH_ON_DELIVERY' ? TruckIcon : BankIcon;
                  const label =
                    id === 'CARD'
                      ? t('checkout.methodCard')
                      : id === 'CASH_ON_DELIVERY'
                        ? t('checkout.methodCash')
                        : t('checkout.methodBank');
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: !item.available }}
                      disabled={!item.available}
                      onPress={() => setMethod(id)}
                      style={({ pressed }) => [
                        styles.method,
                        {
                          backgroundColor: selected ? colors.primary : pressed ? colors.surfaceElevated : colors.surface,
                          borderColor: selected ? colors.primary : colors.border,
                          opacity: item.available ? 1 : 0.5,
                        },
                      ]}
                    >
                      <Icon color={selected ? colors.primaryContrast : colors.primary} size={22} />
                      <AppText color={selected ? colors.primaryContrast : colors.text} style={styles.methodLabel}>
                        {label}
                      </AppText>
                      {/* Selection dot, so the row reads as a radio group. */}
                      <View style={[styles.radio, { borderColor: selected ? colors.primaryContrast : colors.border }]}>
                        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primaryContrast }]} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
                          {configQuery.data?.message ? (
                <AppText variant="caption" color={colors.secondary}>{configQuery.data.message}</AppText>
              ) : null}
            </View>

            {/* Card details, only for the card path.
                With a real Stripe key the customer is handed to Stripe's hosted
                checkout, which collects the card itself — asking for it here
                too would mean typing a card number that is then discarded. */}
            {method === 'CARD' ? (
              configQuery.data?.mocked ? (
                <View style={[styles.cardSection, { borderTopColor: colors.border }]}>
                  <CardForm
                    value={card}
                    onChange={(next) => setCard(next)}
                    simulated
                    declined={cardDeclined}
                  />
                </View>
              ) : (
                <View style={[styles.cardSection, styles.stripeNote, { borderTopColor: colors.border }]}>
                  <AppText variant="caption" color={colors.textMuted}>{t('checkout.stripeRedirect')}</AppText>
                </View>
              )
            ) : null}

            {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}

            {/* Pay block: what is charged, then the action. */}
            <View style={[styles.payBlock, { borderTopColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <AppText variant="subtitle">{t('checkout.payAmount')}</AppText>
                <PriceText value={cart?.total ?? cart?.subtotal} currency={cart?.currency} />
              </View>
              <Button label={t('checkout.pay')} onPress={submit} loading={mutation.isPending} />
              <View style={styles.secureNote}>
                <LockIcon color={colors.textMuted} size={14} />
                <AppText variant="caption" color={colors.textMuted} style={styles.secureText}>
                  {t('checkout.secureNote')}
                </AppText>
              </View>
            </View>
          </Card>
        )}
      </RemoteState>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  summary: { gap: 8, borderTopWidth: 1, paddingTop: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  methods: { gap: 10 },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  methodLabel: { flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  /**
   * The form already sits inside a card, so the card fields get a separator
   * instead of a second nested card — two borders one inside the other read as
   * a rendering mistake.
   */
  cardSection: { gap: 14, borderTopWidth: 1, paddingTop: 16 },
  /** Shown when Stripe's hosted page collects the card instead. */
  stripeNote: { gap: 4 },
  /** Amount and action grouped at the bottom, so paying is the last thing seen. */
  payBlock: { gap: 12, borderTopWidth: 1, paddingTop: 16 },
  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secureText: { textAlign: 'center' },
  placed: { gap: 12 },
  mockNote: { borderRadius: 12, padding: 10 },
});
