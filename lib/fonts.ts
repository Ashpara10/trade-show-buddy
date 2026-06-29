import { useFonts } from 'expo-font';

// Inter is bundled at build time from assets/fonts/. The 4 weights cover
// every Tailwind weight modifier we use (normal/medium/semibold/bold).
// System fallback (San Francisco on iOS, Roboto on Android) renders while
// the bundle is being decoded — this hook lets us hold the splash a beat
// to avoid a font flash.
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Inter: require('@/assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('@/assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('@/assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('@/assets/fonts/Inter-Bold.ttf'),
  });
  return loaded;
}
