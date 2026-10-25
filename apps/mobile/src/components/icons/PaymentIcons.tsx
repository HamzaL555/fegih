import Svg, { Line, Path, Rect } from 'react-native-svg';

import type { IconProps } from './index';

/** Payment method glyphs: card, cash on delivery, bank transfer. */
export function CardIcon({ color, size = 22, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2.5" y="5" width="19" height="14" rx="2.6" stroke={color} strokeWidth={strokeWidth ?? 1.8} />
      <Path d="M2.5 9.8h19" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinecap="round" />
      <Path d="M6.2 15h3.2" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function TruckIcon({ color, size = 22, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.8 6.5h10.4v10H2.8z" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinejoin="round" />
      <Path d="M13.2 10h3.9l3.1 3v3.5h-7z" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinejoin="round" />
      <Line x1="13.2" y1="16.5" x2="20.2" y2="16.5" stroke={color} strokeWidth={strokeWidth ?? 1.8} />
      <Path d="M7 16.5a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0ZM17.4 16.5a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Z" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function BankIcon({ color, size = 22, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.2 12 4l9 5.2" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4.6 9.8v8.4M9.5 9.8v8.4M14.5 9.8v8.4M19.4 9.8v8.4" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinecap="round" />
      <Path d="M2.8 20h18.4" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** Lock for the secure-payment note. */
export function LockIcon({ color, size = 16, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" stroke={color} strokeWidth={strokeWidth ?? 1.8} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={color} strokeWidth={strokeWidth ?? 1.8} strokeLinecap="round" />
    </Svg>
  );
}