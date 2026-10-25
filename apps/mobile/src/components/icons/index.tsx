import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

/**
 * Icon set for the tab bar and the in-app menu.
 *
 * Drawn as inline SVG because `@expo/vector-icons` is not a dependency and the
 * app already ships `react-native-svg`. Every icon takes `color` + `size` so the
 * tab bar can tint active and inactive states from the theme.
 */
export type IconProps = { color: string; size?: number; strokeWidth?: number };

// Re-exported so screens can import every glyph from one module.
export { EyeIcon, EyeOffIcon } from './PasswordIcons';
export { BankIcon, CardIcon, LockIcon, TruckIcon } from './PaymentIcons';

const stroke = (w = 1.8) => ({
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/* ---------- Tab bar ---------- */

export function HomeIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10.5 12 3l9 7.5" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function QuizIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={3} width={16} height={18} rx={3} {...stroke(strokeWidth)} stroke={color} />
      <Path d="M8 8h8M8 12h5" {...stroke(strokeWidth)} stroke={color} />
      <Circle cx={15.5} cy={16.5} r={2.4} stroke={color} {...stroke(strokeWidth)} />
      <Path d="m17.2 18.2 1.6 1.6" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function TrophyIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1a3.5 3.5 0 0 1-3.5 3.5" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M12 14v3M9 20h6M10 17h4l.5 3h-5l.5-3Z" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function StoreIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8h16l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3L4 8Z" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} {...stroke(strokeWidth)} stroke={color} />
      <Path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

/* ---------- In-app menu ---------- */

export function BookIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H11v17H5.5A2.5 2.5 0 0 0 3 22V5.5Z" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H13v17h5.5A2.5 2.5 0 0 1 21 22V5.5Z" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function MosqueIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2c2 1.6 3 3 3 4.5a3 3 0 0 1-6 0C9 5 10 3.6 12 2Z" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M4 21v-7a8 8 0 0 1 16 0v7" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M9 21v-4a3 3 0 0 1 6 0v4" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M2 21h20" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function CompassIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} {...stroke(strokeWidth)} stroke={color} />
      <Polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" {...stroke(strokeWidth)} stroke={color} fill={color} />
    </Svg>
  );
}

export function CalendarIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={15} rx={3} {...stroke(strokeWidth)} stroke={color} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function ClockIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} {...stroke(strokeWidth)} stroke={color} />
      <Path d="M12 7v5l3.5 2" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function TasbeehIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} {...stroke(strokeWidth)} stroke={color} />
      <Circle cx={12} cy={12} r={8} stroke={color} {...stroke(strokeWidth)} strokeDasharray="2.5 3" />
    </Svg>
  );
}

export function ChatIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M8.5 10h7M8.5 13h4" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function PhoneIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function SettingsIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.2} {...stroke(strokeWidth)} stroke={color} />
      <Path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9 2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2 2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.2 1Z" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function GiftIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={9} width={18} height={12} rx={2} {...stroke(strokeWidth)} stroke={color} />
      <Path d="M3 13h18M12 9v12" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M12 9S10.5 3 8 3a2.5 2.5 0 0 0 0 6M12 9s1.5-6 4-6a2.5 2.5 0 0 1 0 6" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function NotificationIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" {...stroke(strokeWidth)} stroke={color} />
      <Path d="M10.5 20a2 2 0 0 0 3 0" {...stroke(strokeWidth)} stroke={color} />
    </Svg>
  );
}

export function SparkIcon({ color, size = 24, strokeWidth }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" {...stroke(strokeWidth)} stroke={color} fill={color} />
    </Svg>
  );
}