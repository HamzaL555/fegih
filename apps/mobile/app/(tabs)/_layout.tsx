import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { HomeIcon, ProfileIcon, QuizIcon, StoreIcon, TrophyIcon } from '@/components/icons';
import { useResponsive } from '@/hooks/useResponsive';
import { useTheme } from '@/providers/ThemeProvider';

type IconComponent = (props: { color: string; size?: number }) => React.JSX.Element;

/**
 * The tab bar glyph.
 *
 * Only the icon belongs here. `tabBarLabel` is rendered by the navigator itself
 * directly underneath, so returning text as well printed every caption twice
 * and the two collided. Both run on the UI thread, so the spring still lands
 * while the screen behind it is busy loading.
 */
function TabIcon({ focused, Icon }: { focused: boolean; Icon: IconComponent }) {
  const { colors } = useTheme();
  const progress = useSharedValue(focused ? 1 : 0);

  progress.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 200, mass: 0.55 });

  const glyphStyle = useAnimatedStyle(() => ({
    // Grows and darkens together, so "selected" reads at a glance.
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.14]) }],
    opacity: interpolate(progress.value, [0, 1], [0.6, 1]),
  }));

  // A thin pill under the icon, in the inactive colour until it fills.
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: interpolate(progress.value, [0, 1], [0.2, 1]) }],
  }));

  const color = focused ? colors.primary : colors.textMuted;

  return (
    <Animated.View style={styles.slot}>
      <Animated.View style={glyphStyle}>
        <Icon color={color} size={24} />
      </Animated.View>
      <Animated.View style={[styles.indicator, { backgroundColor: colors.primary }, indicatorStyle]} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { contentWidth, isPhone } = useResponsive();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          // The bar follows the content column, so on a wide screen it does not
          // stretch five tabs across the whole monitor.
          maxWidth: contentWidth,
          alignSelf: 'center',
          width: '100%',
          ...(isPhone ? {} : { borderTopLeftRadius: 18, borderTopRightRadius: 18 }),
        },
        // Captions stay with the navigator so there is exactly one of each and
        // long translations truncate instead of overlapping the glyph.
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: t('tabs.home'),
          tabBarAccessibilityLabel: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={HomeIcon} />,
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: t('tabs.quiz'),
          tabBarLabel: t('tabs.quiz'),
          tabBarAccessibilityLabel: t('tabs.quiz'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={QuizIcon} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('tabs.leaderboard'),
          tabBarLabel: t('tabs.leaderboard'),
          tabBarAccessibilityLabel: t('tabs.leaderboard'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={TrophyIcon} />,
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: t('tabs.store'),
          tabBarLabel: t('tabs.store'),
          tabBarAccessibilityLabel: t('tabs.store'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={StoreIcon} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={ProfileIcon} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  /** Fixed box so the indicator sits at a predictable distance under the glyph. */
  slot: { width: 40, height: 28, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', bottom: -2, width: 16, height: 2.5, borderRadius: 2 },
  item: { paddingVertical: 2 },
  label: { fontSize: 10.5, fontWeight: '700', marginTop: 2, marginBottom: 2 },
});