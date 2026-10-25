import Svg, { Circle, Path } from 'react-native-svg';

import type { IconProps } from './index';

/**
 * Eye / eye-off pair for password fields.
 *
 * Showing a typed password back is a real accessibility need — people mistype
 * long passwords and have no other way to check — so the toggle belongs in the
 * field itself rather than in every screen's form.
 */
export function EyeIcon({ color, size = 22, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"
        stroke={color}
        strokeWidth={strokeWidth ?? 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3.1" stroke={color} strokeWidth={strokeWidth ?? 1.7} />
    </Svg>
  );
}

export function EyeOffIcon({ color, size = 22, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3l18 18"
        stroke={color}
        strokeWidth={strokeWidth ?? 1.7}
        strokeLinecap="round"
      />
      <Path
        d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.6 17.6 0 0 1-3.4 3.9"
        stroke={color}
        strokeWidth={strokeWidth ?? 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.2 6.6C3.6 8.2 2 12 2 12s3.6 6 10 6a10 10 0 0 0 3.4-.6"
        stroke={color}
        strokeWidth={strokeWidth ?? 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 9.7a3.1 3.1 0 0 0 4.3 4.3"
        stroke={color}
        strokeWidth={strokeWidth ?? 1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}