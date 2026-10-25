import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { EyeIcon, EyeOffIcon } from '@/components/icons';
import { useTheme } from '@/providers/ThemeProvider';

export interface PasswordFieldProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  /** Text of the reveal toggle, for screen readers. */
  showLabel?: string;
  hideLabel?: string;
  /** Placeholder shown when the field is revealed. */
  placeholder?: string;
}

/**
 * A password input with a reveal toggle.
 *
 * Every password field in the app goes through here rather than setting
 * `secureTextEntry` directly, so the affordance is consistent and nobody has to
 * retype a long password to check a typo.
 *
 * The toggle is absolutely positioned over the input rather than placed beside
 * it, which keeps the field the same width as every other input in a form.
 */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(
  { label, error, showLabel = 'Parolu göstər', hideLabel = 'Parolu gizlət', style, ...props },
  ref,
) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="label" color={colors.textMuted} style={styles.label}>
          {label}
        </AppText>
      ) : null}

      <View style={styles.wrapper}>
        <TextInput
          ref={ref}
          secureTextEntry={!visible}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }, style]}
        />
        <Pressable
          onPress={() => setVisible((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={visible ? hideLabel : showLabel}
          accessibilityState={{ selected: visible }}
          hitSlop={10}
          style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.6 : 1 }]}
        >
          {visible ? <EyeOffIcon color={colors.primary} size={21} /> : <EyeIcon color={colors.textMuted} size={21} />}
        </Pressable>
      </View>

      {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 14 },
  label: { marginBottom: 7 },
  wrapper: { position: 'relative', justifyContent: 'center' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 14,
    // Room for the toggle so text never runs underneath it.
    paddingHorizontal: 15,
    paddingRight: 48,
    fontSize: 16,
  },
  toggle: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});