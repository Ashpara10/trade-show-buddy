import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { text } from '@/lib/theme';

type Props = {
  onScan: (decoded: string) => void;
  onClose?: () => void;
  active: boolean;
};

// CameraView instance with the (undocumented) zoom helpers exposed by
// expo-camera on Android + iOS 16+. We call them via `any` because the
// types only include the JS-side wrapper. Failures are silent — the
// slider simply stays hidden.
type CameraWithZoom = CameraView & {
  setZoomRatioAsync?: (ratio: number) => Promise<void>;
};

// Mirror of @tsb QrScanner.tsx — back camera, QR-only, auto-stop on first
// read, continuous autofocus + zoom capability probing.
export function QrScanner({ onScan, onClose, active }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0);
  const [zoomMax, setZoomMax] = useState(0);
  const scannedRef = useRef(false);
  const cameraRef = useRef<CameraWithZoom | null>(null);

  useEffect(() => {
    if (!active) return;
    scannedRef.current = false;
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [active, permission, requestPermission]);

  // Probe zoom capabilities once the camera is mounted.
  useEffect(() => {
    if (!active || !permission?.granted) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const cam = cameraRef.current;
      if (!cam?.setZoomRatioAsync) return;
      let max = 0;
      for (const z of [0, 0.25, 0.5, 0.75, 1]) {
        if (cancelled) return;
        try {
          await cam.setZoomRatioAsync(z);
          max = z;
        } catch {
          /* device doesn't support this zoom level — stop probing */
          break;
        }
      }
      if (!cancelled && max > 0) {
        setZoomMax(max);
        setZoom(0);
      }
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [active, permission]);

  if (!active) return null;

  if (!permission) {
    return (
      <View className="absolute inset-0 z-40 items-center justify-center bg-black">
        <Text className="text-white">Preparing camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="absolute inset-0 z-40 items-center justify-center gap-6 bg-otto-bg p-6">
        <Text className={`${text.heading} text-center`}>Camera permission needed</Text>
        <Text className={`${text.bodyMuted} text-center`}>
          We use the camera only to read LinkedIn QR codes. Nothing is uploaded until you tap Scan.
        </Text>
        <View className="flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={requestPermission}
            className="min-h-[52px] flex-row items-center justify-center rounded-2xl bg-otto-accent px-6 active:opacity-90">
            <Text className="text-base font-semibold text-white">Grant access</Text>
          </Pressable>
          {onClose && (
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="min-h-[52px] flex-row items-center justify-center rounded-2xl border border-otto-border bg-otto-card px-6">
              <Text className="text-base font-semibold text-otto-text">Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="absolute inset-0 z-40 bg-black">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        autofocus="on"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          scannedRef.current
            ? undefined
            : (ev) => {
                const v = ev?.data;
                if (v) {
                  scannedRef.current = true;
                  onScan(v);
                }
              }
        }
      />
      <View className="absolute inset-x-0 top-0 flex-row items-center justify-between px-5 pb-4 pt-12">
        <Text className="text-base font-semibold text-white">Scan their LinkedIn QR</Text>
        {onClose && (
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="rounded-lg bg-black/40 px-3 py-2">
            <Text className="text-sm font-medium text-white">Cancel</Text>
          </Pressable>
        )}
      </View>

      {zoomMax > 0 && (
        <View className="absolute inset-x-6 bottom-24 flex-row items-center gap-3 rounded-full bg-black/50 px-4 py-2">
          <Text className="text-xs font-medium text-white/80">Zoom</Text>
          <View className="flex-1 flex-row items-center">
            {([0, 0.25, 0.5, 0.75, 1] as const)
              .filter((s) => s <= zoomMax + 0.01)
              .map((step) => (
                <Pressable
                  key={step}
                  accessibilityRole="button"
                  onPress={() => {
                    setZoom(step);
                    cameraRef.current?.setZoomRatioAsync?.(step).catch(() => {});
                  }}
                  className={`h-9 flex-1 items-center justify-center rounded-md ${
                    Math.abs(zoom - step) < 0.01 ? 'bg-white/20' : ''
                  }`}>
                  <Text className="text-xs text-white">{step}x</Text>
                </Pressable>
              ))}
          </View>
        </View>
      )}

      <Text className="absolute inset-x-0 bottom-6 px-6 text-center text-xs text-white/70">
        Ask them to open LinkedIn → tap their profile photo → tap the QR icon.
      </Text>
    </View>
  );
}

export function formatCameraError(err: unknown): string {
  if (typeof err === 'string') {
    if (/transition/i.test(err)) return 'Scanner is initializing. Tap Cancel and try again.';
    return `Camera error: ${err}`;
  }
  if (err instanceof Error) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Camera permission was denied. Enable Camera in Settings → Apps.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No camera detected on this device.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'Camera is being used by another app. Close other apps and try again.';
    }
    return `Camera error (${err.name}): ${err.message || 'no details'}.`;
  }
  return 'Camera unavailable.';
}

// Avoid unused import warning when Platform isn't referenced.
void Platform;
