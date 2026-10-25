import { StyleProp, Text, TextProps, TextStyle } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function AppText({ variant = 'body', color, style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  const variants: Record<Variant, TextStyle> = {
    display: { fontSize: 30, lineHeight: 36, fontWeight: '800' },
    title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
    subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
    body: { fontSize: 15, lineHeight: 22 },
    caption: { fontSize: 12, lineHeight: 18 },
    label: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  };

  return (
    <Text
      {...props}
      style={[
        { color: color ?? colors.text },
        variants[variant],
        style,
      ]}
    />
  );
}
