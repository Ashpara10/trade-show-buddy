import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useRouter, useSegments } from 'expo-router';

// ── Tab config ──────────────────────────────────────────────────────────────
// Single source of truth for the (app) shell. Keep this list in lock-step
// with the screens under app/(app)/.

export type TabSpec = {
  key: string;
  label: string;
  href: string;
};

export const TABS: TabSpec[] = [
  { key: 'scan', label: 'Scan', href: '/scan' },
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
];

// ── Snap spring ─────────────────────────────────────────────────────────────
// Same curve as Framer Motion's `type: 'spring', stiffness: 300, damping: 30`.
// Feels snappy without overshoot — the indicator glides and lands.

const SPRING_CFG = { damping: 32, stiffness: 320, mass: 0.8, overshootClamping: true } as const;

// Snap animation used when the active tab changes via tap, or when a swipe
// commits. We use a spring for both the position and the width so the bar
// feels like a single physical object, like Framer's shared `layoutId`.
const SETTLE_CFG = { duration: 280, easing: Easing.out(Easing.cubic) } as const;

// Swipe commit thresholds. Dragged distance as a fraction of one tab's
// width — past 25% we commit. Velocity-based fast flicks also commit.
const COMMIT_FRACTION = 0.25;
const VELOCITY_COMMIT = 600; // px/s

// ── Context shape ───────────────────────────────────────────────────────────
// We expose the underline style + the per-tab measurement callback so the
// header can render the indicator and the tabs can report their positions.
// The swipe gesture is provided as a render prop on the provider so the
// layout can wrap the Stack in a single GestureDetector.

export type TabIndicatorValue = {
  count: number;
  activeIndex: number;
  activeKey: string;
  /**
   * Called by each tab's onLayout. Coordinates are in the indicator row's
   * local space. The provider uses them to compute the indicator's
   * target position and width.
   */
  setTabRect: (index: number, x: number, width: number) => void;
  /**
   * Animated style for the underline bar. Spans the active tab's width
   * and centres itself on the active tab. Apply directly to a
   * <Animated.View>.
   */
  underlineStyle: ReturnType<typeof useAnimatedStyle>;
  /**
   * Jump to a specific tab by index. No-op if already on that tab.
   */
  jumpTo: (index: number) => void;
  /**
   * Drives the indicator's width in pixels. Exposed so the AppHeader can
   * report its row's width onLayout.
   */
  rowWidth: SharedValue<number>;
};

const Ctx = createContext<TabIndicatorValue | null>(null);

export function useTabIndicator(): TabIndicatorValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTabIndicator must be used inside <TabIndicatorProvider>');
  return v;
}

// ── Provider ────────────────────────────────────────────────────────────────

type ProviderProps = {
  /**
   * Render the gesture-detected page body. The provider passes the pan
   * gesture down so the consumer can wrap their content in a single
   * <GestureDetector>. Keeping this a render prop (rather than nesting
   * the children inside the provider) lets the layout control where the
   * gesture boundary lives.
   */
  children: (api: { panGesture: ReturnType<typeof Gesture.Pan> }) => ReactNode;
};

export function TabIndicatorProvider({ children }: ProviderProps) {
  const router = useRouter();
  const segments = useSegments();

  // Active tab resolved from the current route. The route group "(app)" is
  // stripped from segments, so the children are e.g. ['scan'].
  const activeKey = useMemo(() => {
    for (const s of segments) {
      if (TABS.some((t) => t.key === s)) return s;
    }
    return TABS[0].key;
  }, [segments]);
  const activeIndex = useMemo(
    () => Math.max(0, TABS.findIndex((t) => t.key === activeKey)),
    [activeKey]
  );

  // ── Measured tab rects ──────────────────────────────────────────────────
  // The provider needs to know each tab's measured (x, width) within the
  // indicator row so it can compute the underline's target. The AppHeader
  // reports these via setTabRect. We keep them in a ref so the effect that
  // recomputes targets doesn't re-run on every render.
  type Rect = { x: number; w: number };
  const tabRects = useRef<Rect[]>([]);
  const setTabRect = useCallback((index: number, x: number, width: number) => {
    tabRects.current[index] = { x, w: width };
    // Setting a rect is the trigger to recompute the target — the layout
    // might not have measured the row yet on first render, so re-run
    // even if the active index didn't change.
    scheduleSettle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared values for the underline.
  const indicatorX = useSharedValue(0); // centre x in px
  const indicatorW = useSharedValue(0); // width in px
  const rowWidth = useSharedValue(0);

  // ── Imperative navigation ───────────────────────────────────────────────
  const navigateToIndex = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(TABS.length - 1, idx));
      const target = TABS[clamped];
      if (target.key === activeKey) return;
      router.push(target.href as never);
    },
    [activeKey, router]
  );

  // ── Settle the indicator to the active tab ──────────────────────────────
  // Animates the bar to the centre of the active tab. Called on mount,
  // when activeIndex changes, and whenever a new tab rect is measured.
  const settle = useCallback(() => {
    const n = TABS.length;
    const rw = rowWidth.value;
    const rect = tabRects.current[activeIndex];
    let cx: number;
    let cw: number;
    if (rect && rect.w > 0) {
      // Real measurement wins. We use the active tab's centre and width.
      cx = rect.x + rect.w / 2;
      cw = rect.w;
    } else if (rw > 0 && n > 0) {
      // Fall back to a uniform-width computation if the layout hasn't
      // been measured yet.
      const tabW = rw / n;
      cx = activeIndex * tabW + tabW / 2;
      cw = tabW;
    } else {
      return; // nothing to animate to yet
    }
    // Spring for the centre, timing for the width. The width only
    // changes between non-uniform tabs, so a linear easing looks fine
    // for that channel.
    indicatorX.value = withSpring(cx, SPRING_CFG);
    indicatorW.value = withTiming(cw, SETTLE_CFG);
  }, [activeIndex, indicatorW, indicatorX, rowWidth]);

  // Wrap settle in a microtask debounce so a flurry of onLayout calls
  // (e.g. on first render) only triggers one animation.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      settle();
    }, 0);
  }, [settle]);

  // Effect: settle when the active tab changes (tap navigation).
  useEffect(() => {
    scheduleSettle();
  }, [activeIndex, scheduleSettle]);

  // ── Swipe gesture ───────────────────────────────────────────────────────
  // Pan horizontal. We track the drag delta and update indicatorX in real
  // time so the bar follows the finger. On release, decide whether to
  // commit (navigate to the next/prev tab) or snap back.
  const startX = useSharedValue(0); // bar centre at gesture start
  const dragging = useSharedValue(false);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      // Require a noticeable horizontal travel before we engage. This
      // lets vertical ScrollViews still receive their scrolls.
      .activeOffsetX([-12, 12])
      .failOffsetY([-20, 20])
      .onBegin(() => {
        dragging.value = true;
        startX.value = indicatorX.value;
      })
      .onUpdate((e) => {
        const n = TABS.length;
        const w = rowWidth.value;
        if (w <= 0 || n === 0) return;
        const tabW = w / n;
        const minCx = tabW / 2;
        const maxCx = (n - 1) * tabW + tabW / 2;
        const next = Math.max(minCx, Math.min(maxCx, startX.value + e.translationX));
        indicatorX.value = next;
      })
      .onEnd((e) => {
        dragging.value = false;
        const n = TABS.length;
        const w = rowWidth.value;
        if (w <= 0 || n === 0) return;
        const tabW = w / n;
        const dx = indicatorX.value - startX.value;
        const fraction = dx / tabW;
        const commit =
          Math.abs(fraction) >= COMMIT_FRACTION ||
          Math.abs(e.velocityX) >= VELOCITY_COMMIT;
        if (commit) {
          const dir = dx < 0 ? -1 : 1; // left swipe = next tab
          runOnJS(navigateToIndex)(activeIndex + dir);
          // The activeIndex effect will settle the bar to the new tab.
        } else {
          // Snap back to the current tab's centre.
          indicatorX.value = withSpring(startX.value, SPRING_CFG);
        }
      });
  }, [
    activeIndex,
    dragging,
    indicatorX,
    navigateToIndex,
    rowWidth,
    startX,
  ]);

  // ── Underline style ─────────────────────────────────────────────────────
  // Position the bar so its centre sits at `indicatorX` and its width is
  // `indicatorW`. Using a numeric translateX in pixels is more reliable
  // than percentage-based, because we already know the row's measurement.
  const underlineStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 2,
    width: indicatorW.value,
    backgroundColor: '#16a34a',
    transform: [{ translateX: indicatorX.value - indicatorW.value / 2 }],
  }));

  const value = useMemo<TabIndicatorValue>(
    () => ({
      count: TABS.length,
      activeIndex,
      activeKey,
      setTabRect,
      underlineStyle,
      jumpTo: navigateToIndex,
      rowWidth,
    }),
    [activeIndex, activeKey, setTabRect, underlineStyle, navigateToIndex, rowWidth]
  );

  return <Ctx.Provider value={value}>{children({ panGesture })}</Ctx.Provider>;
}

// ── Re-export for the AppHeader, which needs the indicator style + tab
// measurement. The header lives inside the provider so useTabIndicator()
// works for it; the layout uses useTabIndicator() too. This file
// intentionally does NOT export a styled <TabIndicatorBar /> component so
// the header can own the visual treatment (border, padding, etc).

// Helper export so the (app) layout doesn't have to import Animated directly.
export { Animated as TabIndicatorAnimated };