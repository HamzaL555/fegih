import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Polygon, Stop, Text as SvgText } from 'react-native-svg';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useUserLocation } from '@/hooks/useUserLocation';
import { signedDelta as angleSignedDelta, stepToward } from '@/lib/angle';
import { watchTrueNorthHeading } from '@/services/location';
import { useTheme } from '@/providers/ThemeProvider';
import { calculateQiblaBearing } from '@/utils/qibla';

const AnimatedG = Animated.createAnimatedComponent(G);

const SIZE = 320;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 150;
const RING_WIDTH = 15;
const LETTER_RADIUS = 108;
/** Ticks must stop short of the ring's inner edge (142.5) or they are hidden. */
const TICK_OUTER = 133;

const EMERALD = '#0E9E6E';
const MINT = '#D6EFE1';
const MINT_DEEP = '#BFE4D1';
const NAVY = '#1C3A6E';
const TICK = '#2C4E86';
const RED = '#E8263C';

const CARDINALS = [
  { label: 'N', angle: -90 },
  { label: 'E', angle: 0 },
  { label: 'S', angle: 90 },
  { label: 'W', angle: 180 },
];

function polar(angleDegrees: number, radius: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) };
}

/** Signed difference in [-180, 180); the needle must never take the long way. */
const signedDelta = angleSignedDelta;

type CompassState = 'waiting' | 'active' | 'magnetic' | 'unavailable';

/** How many degrees the needle may sit from qibla and still count as aligned. */
const ALIGN_TOLERANCE = 2;

export default function QiblaScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { location, isLoading, error: locationError, retry } = useUserLocation();

  const [compassState, setCompassState] = useState<CompassState>('waiting');
  const [sensorError, setSensorError] = useState<unknown>();
  const [retryToken, setRetryToken] = useState(0);
  const [heading, setHeading] = useState<number>();
  const [accuracy, setAccuracy] = useState<number>();
  /**
   * User calibration for a compass that reads a few degrees off. Added to the
   * sensor heading so the needle can be aligned by hand when there is no
   * location permission-based true north available.
   */
  const [calibration, setCalibration] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  /** Raw reference captured when calibration starts. */
  const calibrationRef = useRef<number | undefined>(undefined);

  /**
   * Reanimated smooths between sensor samples. `watchHeadingAsync` delivers
   * roughly 10-20 readings per second while the display refreshes at 60+, so
   * animating the shared value gives continuous motion without a React
   * re-render per frame.
   */
  const dialTurns = useSharedValue(0);
  const needleTurns = useSharedValue(0);
  /**
   * Unwrapped copies of both rotations (values that keep growing instead of
   * snapping back at ±180).
   *
   * Heading wraps at 360, so animating straight to `-heading` made the dial
   * travel the long way whenever the reading crossed north — 359° -> 1° became
   * a 358° spin instead of a 2° one, and the needle never settled. Accumulating
   * the shortest signed delta keeps the value monotonic, so every frame takes
   * the short way and the needle comes to rest as soon as the device stops.
   */
  const dialUnwrapped = useRef(0);
  const needleUnwrapped = useRef(0);

  const qibla = useMemo(
    () => (location ? calculateQiblaBearing(location.coords.latitude, location.coords.longitude) : undefined),
    [location],
  );

  const applyHeading = useCallback((raw: number, headingAccuracy?: number) => {
    setHeading(raw);
    if (headingAccuracy !== undefined) setAccuracy(headingAccuracy);
  }, []);

  /**
   * Heading source. `Location.watchHeadingAsync` is the primary path: it works
   * on real devices and applies the local magnetic declination. The raw
   * magnetometer is only a fallback.
   *
   * A previous version drove the dial from Reanimated's `useAnimatedSensor`
   * instead. That reported `isAvailable: true` but never produced a value
   * (`yaw` stayed 0) inside Expo Go, so the needle simply never moved.
   */
  useEffect(() => {
    if (!location || qibla === undefined) return;

    let mounted = true;
    let stop: (() => void) | undefined;
    let magnetometerCleanup: (() => void) | undefined;
    setCompassState('waiting');
    setSensorError(undefined);

    void (async () => {
      const handle = (next: number, nextAccuracy?: number) => {
        if (!mounted) return;
        applyHeading(next, nextAccuracy);
        setCompassState(nextAccuracy === undefined ? 'magnetic' : 'active');
      };

      try {
        stop = await watchTrueNorthHeading(handle);
        return;
      } catch {
        // fall through to the raw magnetometer
      }

      try {
        const { Magnetometer } = await import('expo-sensors');
        if (!(await Magnetometer.isAvailableAsync())) throw new Error('unavailable');
        Magnetometer.setUpdateInterval(100);
        const subscription = Magnetometer.addListener(({ x, y }) => {
          if (!mounted) return;
          handle(((Math.atan2(y, x) * (180 / Math.PI)) % 360 + 360) % 360);
        });
        magnetometerCleanup = () => subscription.remove();
      } catch (error) {
        if (mounted) {
          setSensorError(error);
          setCompassState('unavailable');
        }
      }
    })();

    return () => {
      mounted = false;
      stop?.();
      magnetometerCleanup?.();
    };
  }, [location, qibla, retryToken, applyHeading]);

  // Feed the sensor into the animated values. Kept out of the render path.
  useEffect(() => {
    if (heading === undefined || qibla === undefined) return;
    // Shortest signed step from where the dial currently *is*, so the value
    // only ever creeps forward by a few degrees per sample and never resets.
    dialUnwrapped.current = stepToward(dialUnwrapped.current, -heading);
    needleUnwrapped.current = stepToward(needleUnwrapped.current, signedDelta(heading, qibla + calibration));
    /**
     * The needle follows the sensor continuously.
     *
     * The heading arrives ten to twenty times a second, so the transition has
     * to be long enough to still be running when the next sample arrives —
     * otherwise every sample restarts a ninety millisecond animation that never
     * finishes and the needle looks frozen. Retargeting a running transition
     * is seamless: it continues from wherever it had got to.
     */
    dialTurns.value = withTiming(dialUnwrapped.current, { duration: 180, easing: Easing.out(Easing.quad) });
    needleTurns.value = withTiming(needleUnwrapped.current, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [heading, qibla, calibration, dialTurns, needleTurns]);

  const dialProps = useAnimatedProps(() => ({ rotation: dialTurns.value }));
  const needleProps = useAnimatedProps(() => ({ rotation: needleTurns.value }));

  const ticks = useMemo(
    () => Array.from({ length: 60 }, (_, index) => {
      const angle = index * 6 - 90;
      const long = index % 15 === 0;
      const start = polar(angle, TICK_OUTER - (long ? 15 : 8));
      const end = polar(angle, TICK_OUTER);
      return { key: `tick-${index}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y, width: long ? 3 : 1.6 };
    }),
    [],
  );

  // Everything below is only meaningful once both a position and a heading exist.
  const ready = qibla !== undefined && heading !== undefined;
  const relative = ready ? signedDelta(heading!, qibla! + calibration) : undefined;
  const absoluteRelative = relative === undefined ? undefined : ((relative % 360) + 360) % 360;
  const aligned = absoluteRelative !== undefined && absoluteRelative <= ALIGN_TOLERANCE;

  const startCalibration = () => {
    if (heading !== undefined && qibla !== undefined) calibrationRef.current = signedDelta(heading, qibla + calibration);
    setCalibrating(true);
  };

  /** Keeps the needle on qibla using whatever the user is pointing at now. */
  const applyCalibration = () => {
    if (calibrationRef.current !== undefined) setCalibration(calibration + calibrationRef.current);
    setCalibrating(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const tickContent = (
    <>
      {ticks.map((tick) => (
        <Line key={tick.key} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} stroke={TICK} strokeWidth={tick.width} strokeLinecap="round" />
      ))}
      {CARDINALS.map((cardinal) => {
        const point = polar(cardinal.angle, LETTER_RADIUS);
        return (
          <SvgText key={cardinal.label} x={point.x} y={point.y} fill={NAVY} fontSize={34} fontWeight="700" textAnchor="middle" alignmentBaseline="central">
            {cardinal.label}
          </SvgText>
        );
      })}
    </>
  );

  return (
    <AppScreen title={t('qibla.title')} subtitle={t('qibla.subtitle')}>
      {isLoading || (!location && !locationError) ? (
        <Card><AppText>{t('prayer.locationLoading')}</AppText></Card>
      ) : null}

      {locationError ? (
        <Card>
          <ErrorBanner error={new Error(t('qibla.locationDenied'))} />
          <Button label={t('prayer.enableLocation')} onPress={() => void retry()} variant="secondary" style={styles.button} />
        </Card>
      ) : null}

      {qibla !== undefined ? (
        <Card style={styles.compassCard}>
          <View style={styles.canvas}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Defs>
                <LinearGradient id="dialFill" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={MINT} />
                  <Stop offset="1" stopColor={MINT_DEEP} />
                </LinearGradient>
              </Defs>

              <Circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS - RING_WIDTH / 2} fill="url(#dialFill)" />
              <G opacity={0.1}>
                {[-45, 0, 45, 90, 135].map((offset) => {
                  const a = polar(offset, OUTER_RADIUS);
                  const b = polar(offset + 180, OUTER_RADIUS);
                  return <Line key={`lat-${offset}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={EMERALD} strokeWidth={1.2} />;
                })}
                {[46, 92].map((radius) => (
                  <Circle key={`ring-${radius}`} cx={CENTER} cy={CENTER} r={radius} fill="none" stroke={EMERALD} strokeWidth={1.2} />
                ))}
              </G>

              <Circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS - RING_WIDTH / 2} fill="none" stroke={EMERALD} strokeWidth={RING_WIDTH} />

              <AnimatedG animatedProps={dialProps} originX={CENTER} originY={CENTER}>
                {tickContent}
              </AnimatedG>
              <AnimatedG animatedProps={needleProps} originX={CENTER} originY={CENTER}>
                <Line x1={CENTER} y1={-OUTER_RADIUS - 6} x2={CENTER} y2={-OUTER_RADIUS - 30} stroke={RED} strokeWidth={2} strokeDasharray="5 5" />
                <SvgText x={CENTER} y={-OUTER_RADIUS - 46} fontSize={38} textAnchor="middle" alignmentBaseline="central">🕋</SvgText>
                <Polygon points={`${CENTER},${CENTER - 82} ${CENTER - 21},${CENTER + 20} ${CENTER},${CENTER + 8}`} fill={RED} />
                <Polygon points={`${CENTER},${CENTER - 82} ${CENTER + 46},${CENTER + 6} ${CENTER},${CENTER + 8}`} fill={RED} opacity={0.85} />
                <Polygon points={`${CENTER},${CENTER - 70} ${CENTER - 13},${CENTER + 9} ${CENTER},${CENTER}`} fill="#FFFFFF" opacity={0.95} />
              </AnimatedG>

              <Circle cx={CENTER} cy={CENTER} r={12} fill={MINT_DEEP} />
              <Circle cx={CENTER} cy={CENTER} r={5.5} fill={EMERALD} />
            </Svg>
          </View>

          {ready ? (
            <>
              <View style={[styles.badge, { backgroundColor: aligned ? colors.success : colors.surfaceElevated }]}>
                <AppText variant="subtitle" color={aligned ? colors.primaryContrast : colors.text}>
                  {aligned ? t('qibla.aligned') : t('qibla.turnDevice')}
                </AppText>
              </View>

              <View style={styles.readout}>
                <View style={styles.readoutItem}>
                  <AppText variant="caption" color={colors.textMuted}>{t('qibla.qiblaDirection')}</AppText>
                  <AppText variant="subtitle" color={colors.primary}>{Math.round(qibla!)}{t('qibla.degree')}</AppText>
                </View>
                <View style={styles.readoutItem}>
                  <AppText variant="caption" color={colors.textMuted}>{t('qibla.heading')}</AppText>
                  <AppText variant="subtitle">{Math.round(heading!)}{t('qibla.degree')}</AppText>
                </View>
                {/* How far the device still has to turn. This is the number
                    people actually read while walking, and it is the one that
                    changes as the needle moves. */}
                <View style={styles.readoutItem}>
                  <AppText variant="caption" color={colors.textMuted}>{t('qibla.turnBy')}</AppText>
                  <AppText variant="subtitle" color={colors.secondary}>
                    {absoluteRelative !== undefined ? Math.round(absoluteRelative) : 0}
                    {t('qibla.degree')}
                  </AppText>
                </View>
                <View style={styles.readoutItem}>
                  <AppText variant="caption" color={colors.textMuted}>{t('qibla.remaining')}</AppText>
                  <AppText variant="subtitle" color={aligned ? colors.success : colors.text}>
                    {absoluteRelative === undefined ? '—' : `${absoluteRelative}${t('qibla.degree')}`}
                  </AppText>
                </View>
              </View>
            </>
          ) : (
            <AppText color={colors.textMuted} style={styles.status}>{t('qibla.compassStarting')}</AppText>
          )}

          <AppText
            variant="caption"
            color={compassState === 'active' ? colors.success : colors.textMuted}
            style={styles.status}
          >
            {compassState === 'waiting' && t('qibla.compassStarting')}
            {compassState === 'active' && t('qibla.compassTrueNorth')}
            {compassState === 'magnetic' && t('qibla.compassMagneticOnly')}
            {compassState === 'unavailable' && t('qibla.compassUnavailable')}
            {accuracy !== undefined && accuracy > 25 ? ` · ±${Math.round(accuracy)}°` : ''}
          </AppText>

          {sensorError ? <ErrorBanner error={new Error(t('qibla.unavailable'))} /> : null}
          {compassState === 'unavailable' ? (
            <Button label={t('qibla.retryCompass')} onPress={() => { setCompassState('waiting'); setRetryToken((token) => token + 1); }} variant="secondary" />
          ) : null}

          {/* Manual calibration for a compass that reads a few degrees off. */}
          {ready && compassState !== 'unavailable' ? (
            calibrating ? (
              <View style={styles.calibration}>
                <AppText variant="caption" color={colors.textMuted} style={styles.status}>
                  {t('qibla.calibrationHint')}
                </AppText>
                <View style={styles.calibrationRow}>
                  <Button label={t('qibla.calibrationCancel')} onPress={() => setCalibrating(false)} variant="ghost" style={styles.flex} />
                  <Button label={t('qibla.calibrationSave')} onPress={applyCalibration} variant="secondary" style={styles.flex} />
                </View>
              </View>
            ) : (
              <Button label={t('qibla.calibrationStart')} onPress={startCalibration} variant="ghost" style={styles.button} />
            )
          ) : null}
          {calibration !== 0 ? (
            <AppText variant="caption" color={colors.textMuted} style={styles.status}>
              {t('qibla.calibrationValue', { degrees: Math.round(calibration) })}
            </AppText>
          ) : null}
        </Card>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  button: { marginTop: 12 },
  compassCard: { alignItems: 'center', marginTop: 12, paddingVertical: 20, gap: 14 },
  canvas: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  readout: { flexDirection: 'row', gap: 12, width: '100%' },
  readoutItem: { flex: 1, alignItems: 'center', gap: 2 },
  status: { textAlign: 'center' },
  calibration: { width: '100%', gap: 8 },
  calibrationRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});