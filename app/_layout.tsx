import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Stack, SplashScreen, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { loadSession, clearSession } from '@/lib/session';
import { fetchMe } from '@/lib/auth-client';
import { SessionContext } from '@/components/SessionContext';
import { BottomSheetProvider } from '@/components/BottomSheet';
import { useAppFonts } from '@/lib/fonts';
import { colors } from '@/lib/theme';
import '../global.css';

// Hold the splash until the JS bundle is ready + the font has decoded, so
// users never see a system-font flash before Inter appears.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // `session` is the current authenticated user (or null when signed out).
  // `authChecked` flips true once we've completed the boot-time session
  // check — both for the local cached case and the no-local-session case.
  // The redirect effect waits for `authChecked` so we never bounce through
  // the sign-in screen for a frame while the boot check is still running.
  // (Previously, `hydrated` was used alone, which let the redirect fire
  // after the local session was read but BEFORE the server-side /me
  // check completed — that's the split-second flash you were seeing.)
  const [session, setSession] = useState<import('@/lib/types').Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const fontsLoaded = useAppFonts();

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 5_000,
          },
        },
      }),
    []
  );

  // React Query focus tracking on RN.
  useEffect(() => {
    function onAppStateChange(status: AppStateStatus) {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    }
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  // Boot-time session restore. Three terminal states, all of which flip
  // `authChecked` to true:
  //   1. No local session      → setSession(null), authChecked = true
  //   2. Local + server OK    → setSession(merged), authChecked = true
  //   3. Local + server 401   → clearSession(), setSession(null), authChecked = true
  // We never let `authChecked` become true while a session is set without
  // first verifying the server, so the redirect effect always has the
  // freshest possible view before deciding where to land.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadSession();
      if (cancelled) return;
      if (!local) {
        setSession(null);
        setAuthChecked(true);
        return;
      }
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (!me) {
          await clearSession();
          setSession(null);
        } else {
          setSession({
            ...local,
            userId: me.userId,
            email: me.email,
            name: me.name,
            companyId: me.companyId,
            domain: me.domain ?? undefined,
          });
        }
      } catch {
        // Network error during boot: trust the local session, log a
        // warning so the user knows they're on a stale identity. The
        // next API call will 401 and the per-screen route guards will
        // bounce them to /.
        console.warn('[auth] fetchMe failed during boot, using cached session');
        setSession(local);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the native splash once the font is decoded. We do this regardless
  // of the session/redirect state so the user always sees Otto's splash
  // for a beat before the auth screen paints.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Auth-gated route guard. Only runs after the boot check completes so we
  // never flash through the wrong screen on cold start.
  useEffect(() => {
    if (!authChecked) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/' as never);
    } else if (session && inAuthGroup) {
      router.replace('/scan' as never);
    }
  }, [authChecked, session, segments, router]);

  return (
    // GestureHandlerRootView is required by @gorhom/bottom-sheet (drag
    // gestures). It must wrap anything that renders a sheet.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <SessionContext.Provider value={{ session, setSession, authChecked }}>
            <BottomSheetProvider>
              {/* fontFamily: 'Inter' cascades to every nested <Text> via RN's
                  text-inheritance. Tailwind's `font-sans` class resolves to
                  the same value (see tailwind.config.js). The `as TextStyle`
                  cast is required because RN's `ViewStyle` doesn't expose
                  fontFamily even though RN honours it on plain Views. */}
              <SafeAreaView
                className="flex-1"
                style={{ fontFamily: 'Inter' } as import('react-native').TextStyle}>
                <StatusBar style="auto" />
                <View
                  className="flex-1"
                  style={
                    {
                      backgroundColor: colors.bg,
                      fontFamily: 'Inter',
                    } as import('react-native').TextStyle
                  }>
                  {/* Boot gate. While authChecked is false we render a blank
                      spinner over the white background so the user never
                      sees a flash of /scan or / before the session check
                      completes. The Stack below renders once authChecked
                      is true and stays out of the way. */}
                  {!authChecked ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.bg,
                      }}
                      pointerEvents="auto">
                      <ActivityIndicator color={colors.accent} size="large" />
                    </View>
                  ) : null}
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.bg },
                    }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(app)" />
                  </Stack>
                </View>
              </SafeAreaView>
            </BottomSheetProvider>
          </SessionContext.Provider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
