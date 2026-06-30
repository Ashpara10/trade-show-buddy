import {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
// BottomSheetModalMethods is the ref type for BottomSheetModal but
// not re-exported from the package's main index. Pull it from the deep path.
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Easing } from 'react-native-reanimated';

// ─── Reusable bottom-sheet wrapper ──────────────────────────────────────────
//
// One <BottomSheetModal> mounted at the root of the app, driven by a tiny
// context. Anything in the tree can call `useBottomSheet().open(content)`
// to render *any* children in the same sheet — picker, confirm dialog,
// full-screen form, you name it. The sheet is closed by tapping the
// backdrop, dragging it down, or calling `close()`.
//
// Implementation note: BottomSheetModal's body is only mounted when
// `present()` is called (the modal uses a Portal that's gated on an
// internal `mount` flag). So `open()` must:
//   1. setState the new content first
//   2. wait a frame so React commits the new props
//   3. call `ref.current?.present()` to actually mount the Portal
// `index` is then driven by state — when we want the sheet closed,
// set index to -1; when we want it open, set it to the target snap
// point. After the first `present()`, the state-driven `index` works
// because the underlying BottomSheet is already mounted.

export type BottomSheetOptions = {
  /** Snap points in % or px. Default: ['50%', '80%']. */
  snapPoints?: (string | number)[];
  /** Optional title shown in the header row (tappable to close). */
  title?: string;
  /** Initial snap index. Default 0. */
  initialIndex?: number;
  /** Disable drag-to-close. Default false. */
  enableDismiss?: boolean;
  /** Optional callback fired when the user dismisses (tap backdrop, drag down). */
  onDismiss?: () => void;
};

type BottomSheetApi = {
  /** Open the sheet with the given content. Replaces any current content. */
  open: (content: ReactNode, options?: BottomSheetOptions) => void;
  /** Close the sheet. Safe to call when already closed. */
  close: () => void;
};

const BottomSheetContext = createContext<BottomSheetApi | null>(null);

/** Hook: any component below <BottomSheetProvider> can call this to
 *  show / hide the shared bottom sheet. */
export function useBottomSheet(): BottomSheetApi {
  const ctx = useContext(BottomSheetContext);
  if (!ctx) {
    throw new Error('useBottomSheet() must be called inside <BottomSheetProvider>.');
  }
  return ctx;
}

// ─── Provider component ─────────────────────────────────────────────────────

/**
 * Mount once near the root of the app, *inside* the GestureHandlerRootView
 * (bottom-sheet requires it). Renders a single shared <BottomSheetModal>
 * whose body is whatever the caller most recently passed to `open()`.
 */
export function BottomSheetProvider({ children }: { children: ReactNode }) {
  // The BottomSheetModal body is only mounted when the library's internal
  // `mount` flag is true, and that flag is only flipped by calling
  // `present()`. So our state needs to:
  //   - `content`  : what to render inside the sheet body
  //   - `isOpen`    : whether the modal's Portal should be open
  //   - `options`   : snap points, title, etc. — captured at open() time
  // On open(): setContent + setOptions + setIsOpen(true) in the same render,
  // then call present() on the next frame. The present() call mounts the
  // Portal and the underlying BottomSheet renders with the index we set
  // via state. Without the present() call the body never mounts.
  const [content, setContent] = useState<ReactNode>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<BottomSheetOptions>({});
  const ref = useRef<BottomSheetModalMethods>(null);

  const close = useCallback(() => {
    // Set isOpen=false first; the modal's index transitions to -1 which
    // triggers the dismiss animation. onDismiss fires after the
    // animation completes and clears content.
    setIsOpen(false);
  }, []);

  const open = useCallback<BottomSheetApi['open']>((next, opts = {}) => {
    setOptions(opts);
    setContent(next);
    setIsOpen(true);
    // Wait one frame so React commits the new props (new content, new
    // snapPoints, isOpen=true) to the modal before we call present().
    // Without this, on first open the present() lands before the modal
    // has mounted, and the Portal is never attached.
    requestAnimationFrame(() => {
      ref.current?.present();
    });
  }, []);

  const api = useMemo<BottomSheetApi>(() => ({ open, close }), [open, close]);

  return (
    <BottomSheetModalProvider>
      <BottomSheetContext.Provider value={api}>
        {children}
        <BottomSheetModal
          ref={ref}
          // Drive the snap from state: -1 closed, 0 (or options.initialIndex)
          // open. The library's BottomSheet inside the Portal animates
          // between these values when index changes.
          index={isOpen ? (options.initialIndex ?? 0) : -1}
          snapPoints={options.snapPoints ?? ['50%', '80%']}
          enablePanDownToClose={options.enableDismiss !== false}
          enableDynamicSizing={false}
          // Snappier animation: 180ms — fast enough that picking an
          // event in the dashboard filter feels instant (the dashboard
          // row updates behind the sheet as it dismisses), slow enough
          // to still read as a smooth slide. Easing.bezier(0.16, 1, 0.3, 1)
          // is the iOS "spring-like" curve — fast initial movement, slow
          // landing, no overshoot.
          animationConfigs={{
            duration: 180,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }}
          onDismiss={() => {
            setIsOpen(false);
            setContent(null);
            options.onDismiss?.();
          }}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              pressBehavior="close"
              opacity={0.45}
            />
          )}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.handle}>
          {/* Per gorhom v5 + Reanimated 4, the BottomSheetScrollView must be
              the DIRECT child of the sheet body for the scroll/pan gesture
              handoff to work. Wrapping it in a BottomSheetView (a plain
              View) was the root cause of the "swipe up changes snap and
              content won't scroll" issue — the sheet's pan handler was
              winning because the gesture detector couldn't find a
              scrollable descendant at the top level.

              We always render a BottomSheetScrollView here. If the caller
              passes non-scrollable content, the scroll view simply doesn't
              scroll (content is shorter than the viewport). If the caller
              passes a BottomSheetScrollView of their own, that nested
              scroll view won't engage — but in practice our callers either
              pass plain content (event pickers, etc.) or a flat list of
              cards (no nested scroll view needed).

              The optional title is rendered as the first child so it
              scrolls with the content. This matches the gorhom example
              pattern and keeps the gesture composition simple. */}
          <BottomSheetScrollView
            style={styles.body}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator>
            {options.title ? (
              <View style={styles.header}>
                <Text className="text-base font-semibold text-otto-text">{options.title}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={close}
                  hitSlop={12}>
                  <Text className="text-2xl leading-none text-otto-muted">×</Text>
                </Pressable>
              </View>
            ) : null}
            {content}
          </BottomSheetScrollView>
        </BottomSheetModal>
      </BottomSheetContext.Provider>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#ffffff',
  },
  handle: {
    backgroundColor: '#d6d3d1',
    width: 40,
  },
  body: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    marginBottom: 12,
  },
});

// Re-export the library's hook so callers can access snapToIndex/expand etc.
// in advanced use cases without re-importing the lib.
export { useBottomSheetModal as useBottomSheetInternals } from '@gorhom/bottom-sheet';
