import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';

import { AppHeader } from '@/components/AppHeader';
import { TabIndicatorProvider } from '@/components/TabIndicator';
import { useSession } from '@/components/SessionContext';
import { useLogout } from '@/lib/queries';
import { clearSession } from '@/lib/session';
import { colors } from '@/lib/theme';

// Persistent shell for /scan and /dashboard. Renders the AppHeader once
// and uses TabIndicatorProvider to share the animated tab indicator + the
// swipe gesture between the header and the page content. expo-router
// keeps this layout mounted across in-group navigations so the underline
// indicator stays smooth and the navbar doesn't re-mount on every tab
// switch.
export default function AppLayout() {
  const router = useRouter();
  const { setSession } = useSession();
  const logout = useLogout();

  const signOut = useCallback(async () => {
    try {
      await logout.mutateAsync();
    } catch {
      /* even if server logout fails, clear locally */
    }
    await clearSession();
    setSession(null);
    router.replace('/' as never);
  }, [logout, router, setSession]);

  return (
    <TabIndicatorProvider>
      {({ panGesture }) => (
        <SafeAreaView
          className="flex-1"
          style={{ backgroundColor: colors.bg }}
          edges={['top']}>
          <AppHeader onSignOut={signOut} />
          {/* GestureDetector wraps the Stack so swipes anywhere in the
              page area drive the tab indicator. Vertical scrolls still
              work because the gesture has a vertical-fail offset. */}
          <GestureDetector gesture={panGesture}>
            <View collapsable={false} style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                  animation: 'fade',
                  animationDuration: 200,
                }}>
                <Stack.Screen name="scan" />
                <Stack.Screen name="dashboard" />
              </Stack>
            </View>
          </GestureDetector>
        </SafeAreaView>
      )}
    </TabIndicatorProvider>
  );
}
