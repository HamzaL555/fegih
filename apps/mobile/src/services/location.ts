import * as Location from 'expo-location';

let cached: Location.LocationObject | undefined;
let inFlight: Promise<Location.LocationObject> | undefined;

/**
 * Both the Qibla and prayer screens need a position. Each screen used to run
 * its own `requestForegroundPermissionsAsync()` + `getCurrentPositionAsync()`,
 * so entering one screen after the other paid the GPS fix twice and could show
 * two permission prompts.
 */
export async function getSharedLocation(): Promise<Location.LocationObject> {
  if (cached) return cached;
  inFlight ??= (async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Location permission was denied.');
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    cached = current;
    return current;
  })().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

export function peekSharedLocation(): Location.LocationObject | undefined {
  return cached;
}

export function forgetSharedLocation(): void {
  cached = undefined;
}

/**
 * True-north heading from the platform compass, which already applies the local
 * magnetic declination. This is preferred over the raw `Magnetometer` reading,
 * which is magnetic north and can be off by 10-15 degrees in this region.
 */
export async function watchTrueNorthHeading(
  onHeading: (heading: number, accuracy: number) => void,
): Promise<() => void> {
  const probe = await Location.getHeadingAsync();
  if (!probe || (probe.magHeading < 0 && probe.trueHeading < 0)) {
    throw new Error('Heading is not available on this device.');
  }
  const subscription = await Location.watchHeadingAsync((result) => {
    // `trueHeading` needs location permission; fall back to magnetic otherwise.
    const heading = result.trueHeading >= 0 ? result.trueHeading : result.magHeading;
    // expo-location exposes accuracy as 0 (low) .. 3 (high).
    const accuracy = result.accuracy <= 0 ? 99 : result.accuracy === 1 ? 45 : result.accuracy === 2 ? 20 : 5;
    onHeading(normalizeHeading(heading), accuracy);
  });
  return () => subscription.remove();
}

function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}
