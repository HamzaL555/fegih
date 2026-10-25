import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the system "reduce motion" setting.
 *
 * Decorative loops (the drifting backdrop, the spinning tab pulse) look like
 * bugs to people who have asked the OS to calm things down, so every ambient
 * animation checks this first. Starts as `false` and settles after the first
 * read, which lets the first frame render immediately instead of waiting on a
 * native call.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (active) setReduced(value); })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => setReduced(value));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}