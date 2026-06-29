import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { HugeiconsIcon } from '@hugeicons/react-native';

import Logo from './Logo';
import { cn } from '@/lib/utils';
import { TABS, useTabIndicator } from './TabIndicator';
import { Logout05Icon } from '@hugeicons/core-free-icons';

type Props = {
  onSignOut: () => void;
};

export function AppHeader({ onSignOut }: Props) {
  const { activeKey, setTabRect, underlineStyle, jumpTo, rowWidth } =
    useTabIndicator();

  return (
    <View className="border-b  border-otto-border bg-otto-bg">
      {/* Row 1: Logo on the left, sign-out icon on the right. */}
      <View className="flex-row items-center justify-between px-8 mb-4 ">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Home"
          onPress={() => jumpTo(0)}
          hitSlop={8}>
          <View className="flex-row items-center gap-2">
            <Logo className="h-7 w-7" onlyIcon color="#1c1917" />
            {/* <Text className="text-[15px] text-otto-muted">Networking Buddy</Text> */}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={onSignOut}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-otto-card-hover">
          <HugeiconsIcon icon={Logout05Icon} />
        </Pressable>
      </View>

      {/* Row 2: Tab bar. The row is `relative` so the absolutely-positioned
          underline can sit on top. We measure each tab onLayout (relative
          to the row) and the indicator's animated style centres itself
          on the active tab's measured rect. The underline's width matches
          the active tab's measured width, just like Framer Motion's shared
          `layoutId` indicator. */}
      <View
        className="relative flex-row"
        onLayout={(e) => {
          rowWidth.value = e.nativeEvent.layout.width;
        }}>
        {TABS.map((tab, i) => {
          const isActive = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => jumpTo(i)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setTabRect(i, x, width);
              }}
              className="flex-1 items-center pb-2 pt-1">
              <Text
                className={cn(
                  'text-[15px] font-medium',
                  isActive ? 'text-otto-text' : 'text-otto-muted'
                )}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Animated underline indicator. Width and translateX are
            computed by the provider's animated style. The bar uses
            the same height/colour regardless of which tab is active,
            so the only thing that changes is its position and width —
            just like Framer's `layoutId`. */}
        <Animated.View pointerEvents="none" style={underlineStyle} />
      </View>
    </View>
  );
}

function LogoutIcon() {
  // Simple ↪ glyph. Stays sharp at any DPI and matches the muted color.
  return (
    <View className="h-5 w-5 items-center justify-center">
      <Text style={{ color: '#78716c', fontSize: 18, lineHeight: 20 }}>↪</Text>
    </View>
  );
}
