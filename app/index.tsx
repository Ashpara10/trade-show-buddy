import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/components/SessionContext';
import { Spinner } from '@/components/ui/Button';
import { sendCode, verifyCode, fetchMe, logout } from '@/lib/auth-client';
import { loadSession, saveSession, clearSession } from '@/lib/session';
import { colors, text } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Session } from '@/lib/types';

const OTTO_FAVICON = require('@/assets/favicon.png');

type Step = 'form' | 'sending' | 'awaiting-code' | 'verifying';

export default function RegisterScreen() {
  const router = useRouter();
  const { setSession, session, authChecked } = useSession();

  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [gateSession, setGateSession] = useState<Session | null>(null);
  const [gateHydrated, setGateHydrated] = useState(false);
  const codeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === 'awaiting-code') {
      setTimeout(() => codeInputRef.current?.focus(), 50);
    }
  }, [step]);

  // Validate the local session against the server (mirror of @tsb/RegistrationGate).
  // We never want to render the form on top of a ghost-logged-in state where
  // /api/auth/me would 401. The root _layout already does this once at boot,
  // but the gate duplicates the check so the page can also self-render the
  // "Welcome back" view without depending on root context state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadSession();
      if (cancelled) return;
      if (!local) {
        setGateSession(null);
        setGateHydrated(true);
        return;
      }
      try {
        const me = await fetchMe();
        if (cancelled) return;
        if (!me) {
          await clearSession();
          setSession(null);
          setGateSession(null);
        } else {
          const fresh: Session = {
            ...local,
            userId: me.userId,
            email: me.email,
            name: me.name,
            companyId: me.companyId,
            domain: me.domain ?? undefined,
          };
          setSession(fresh);
          await saveSession(fresh);
          setGateSession(fresh);
        }
      } catch {
        // Network error — trust the local mirror, no auto-redirect.
        setGateSession(local);
      } finally {
        if (!cancelled) setGateHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSession]);

  // Auth guard: if a session is established (from boot OR the gate above),
  // route into the scanner. Only fires after authChecked is true so we
  // never flash through the sign-in screen for a frame.
  useEffect(() => {
    if (authChecked && session) router.replace('/scan' as never);
  }, [authChecked, session, router]);

  async function handleSendCode(isResend: boolean) {
    setError('');
    setStep('sending');
    setStatusMessage(isResend ? 'Sending a new code…' : 'Connecting…');
    try {
      await sendCode({ name, email }, setStatusMessage);
      setCode('');
      setResendCooldown(30);
      setStep('awaiting-code');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStep(isResend ? 'awaiting-code' : 'form');
    }
  }

  async function handleVerifyCode(submittedCode: string) {
    setError('');
    setStep('verifying');
    try {
      const s = await verifyCode({ email, code: submittedCode });
      setSession(s);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/scan' as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify the code.');
      setCode('');
      setStep('awaiting-code');
      setTimeout(() => codeInputRef.current?.focus(), 50);
    }
  }

  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setCode(digits);
    if (digits.length === 4) void handleVerifyCode(digits);
  }

  async function onSignOut() {
    try {
      await logout();
    } catch {
      /* even if server logout fails, clear locally */
    }
    await clearSession();
    setSession(null);
    setGateSession(null);
    setStep('form');
  }

  // ─── Loading state (sending email or verifying) ──────────────────────────
  if (step === 'sending' || step === 'verifying') {
    const headline = step === 'verifying' ? 'Verifying your code…' : statusMessage;
    return (
      <SafeAreaView className="flex-1 bg-otto-bg">
        <View className="flex-1 items-center justify-center gap-6 px-6 py-16">
          <Spinner />
          <View className="min-h-[3rem] items-center">
            <Text className={`${text.bodyStrong} text-center text-otto-text`}>{headline}</Text>
            {step === 'sending' && (
              <Text className={`${text.bodyMuted} mt-2 text-center`}>
                First-time setup takes 30–60 seconds. Hang tight.
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Auth gate (welcome back) ─────────────────────────────────────────────
  // Mirrors the web's <RegistrationGate> wrapper: if the local session is
  // valid (server says yes), show "Continue to scanner" + a small
  // "sign in as someone else" link. Otherwise fall through to the form.
  if (gateHydrated && gateSession) {
    return (
      <SafeAreaView className="flex-1 bg-otto-bg">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled">
          <View className="mx-auto w-full max-w-md gap-8 px-5 py-10">
            <View className="items-start gap-3">
              <Image
                source={OTTO_FAVICON}
                style={{ width: 48, height: 48, borderRadius: 12 }}
                contentFit="cover"
                accessibilityLabel="Otto"
              />
              <Text className={text.labelAccent}>Otto - Your AI Chief of Staff For Sales</Text>
              <Text className={cn(text.headingLg)}>Otto Networking Buddy</Text>
            </View>

            <View className="gap-5 rounded-2xl border border-otto-border bg-otto-card p-6">
              <View className="gap-1">
                <Text className={text.bodyMuted}>Welcome back</Text>
                <Text className={cn(text.bodyStrong, 'text-otto-text')}>{gateSession.name}</Text>
                <Text className={text.bodyMuted}>{gateSession.email}</Text>
              </View>
              <PrimaryGreenButton
                label="Continue to scanner"
                onPress={() => router.replace('/scan' as never)}
              />
              <Pressable accessibilityRole="button" onPress={() => void onSignOut()}>
                <Text className="text-center text-[15px] text-otto-muted underline">
                  Sign in as someone else
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-otto-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled">
          <View className="mx-auto w-full max-w-md gap-8 px-5 py-10">
            <View className="items-start gap-3">
              <Image
                source={OTTO_FAVICON}
                style={{ width: 48, height: 48, borderRadius: 12 }}
                contentFit="cover"
                accessibilityLabel="Otto"
              />
              <Text className={text.labelAccent}>Otto - Your AI Chief of Staff For Sales</Text>
              <Text className={cn(text.headingLg)}>Otto Networking Buddy</Text>
              <View className="gap-2">
                <Bullet text="Meet people" arrow="Scan their LI Profile QR" />
                <Bullet text="Get instant contextual talking points" />
                <Bullet text="Everything saved in one place" arrow="Export" />
              </View>
            </View>

            {step === 'awaiting-code' ? (
              <OtpCard
                email={email}
                code={code}
                onCodeChange={onCodeChange}
                onChangeEmail={() => {
                  setStep('form');
                  setCode('');
                  setError('');
                }}
                onResend={() => resendCooldown === 0 && void handleSendCode(true)}
                onVerify={() => void handleVerifyCode(code)}
                resendCooldown={resendCooldown}
                error={error}
                codeInputRef={codeInputRef}
              />
            ) : (
              <View className="gap-5 rounded-2xl border border-otto-border bg-otto-card p-6">
                <View className="gap-2">
                  <Text className={text.bodyStrong}>Your name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    autoComplete="name"
                    autoCapitalize="words"
                    placeholder="Jane Doe"
                    placeholderTextColor={colors.muted}
                    className="rounded-xl border border-otto-border bg-otto-card px-4 py-3 text-otto-text focus:border-otto-accent"
                    style={{ fontSize: 17 }}
                  />
                </View>
                <View className="gap-2">
                  <Text className={text.bodyStrong}>Work email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoComplete="email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="jane@yourcompany.com"
                    placeholderTextColor={colors.muted}
                    className="rounded-xl border border-otto-border bg-otto-card px-4 py-3 text-otto-text focus:border-otto-accent"
                    style={{ fontSize: 17 }}
                  />
                  <Text className={text.smallMuted}>
                    We&apos;ll email you a 4-digit code to verify it&apos;s really you. Personal
                    email addresses won&apos;t work.
                  </Text>
                </View>

                {error ? <ErrorBanner message={error} /> : null}

                <PrimaryGreenButton
                  label="Send verification code"
                  onPress={() => void handleSendCode(false)}
                  disabled={!name.trim() || !email.trim()}
                />
              </View>
            )}

            <AppFooter />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PrimaryGreenButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      className={cn(
        'min-h-[52px] flex-row items-center justify-center rounded-xl px-5 py-3.5',
        disabled ? 'bg-otto-accent/50' : 'bg-otto-accent active:bg-otto-accent-hover'
      )}>
      <Text
        className={cn(
          'text-[17px] font-semibold',
          disabled ? 'text-otto-bg/70' : 'text-otto-bg'
        )}>
        {label}
      </Text>
    </Pressable>
  );
}

function OtpCard({
  email,
  code,
  onCodeChange,
  onChangeEmail,
  onResend,
  onVerify,
  resendCooldown,
  error,
  codeInputRef,
}: {
  email: string;
  code: string;
  onCodeChange: (v: string) => void;
  onChangeEmail: () => void;
  onResend: () => void;
  onVerify: () => void;
  resendCooldown: number;
  error: string;
  codeInputRef: React.RefObject<TextInput | null>;
}) {
  return (
    <View className="gap-5 rounded-2xl border border-otto-border bg-otto-card p-6">
      <View className="gap-2">
        <Text className={text.bodyMuted}>We sent a 4-digit code to</Text>
        <Text className={cn(text.bodyStrong, 'text-otto-text')} numberOfLines={2}>
          {email}
        </Text>
        <Text className={text.smallMuted}>
          Check your inbox (and spam folder, just in case).
        </Text>
      </View>

      <View className="gap-2">
        <Text className={text.bodyStrong}>Verification code</Text>
        <TextInput
          ref={codeInputRef}
          value={code}
          onChangeText={onCodeChange}
          keyboardType="number-pad"
          maxLength={4}
          placeholder="••••"
          placeholderTextColor={colors.muted}
          className="rounded-xl border border-otto-border bg-otto-card px-4 py-4 text-center text-otto-text focus:border-otto-accent"
          style={{ fontSize: 28, letterSpacing: 24, fontVariant: ['tabular-nums'] }}
        />
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <View className="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" onPress={onChangeEmail}>
          <Text className="text-[15px] text-otto-muted underline">Use a different email</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={resendCooldown > 0}
          onPress={onResend}>
          <Text
            className={cn(
              'text-[15px] font-medium',
              resendCooldown > 0 ? 'text-otto-muted' : 'text-otto-accent underline'
            )}>
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>

      <PrimaryGreenButton
        label="Verify and continue"
        onPress={onVerify}
        disabled={code.length !== 4}
      />
    </View>
  );
}

function Bullet({ text: label, arrow }: { text: string; arrow?: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className={text.bodyMuted}>{label}</Text>
      {arrow ? (
        <>
          <Text style={{ color: colors.accent, fontSize: 16, lineHeight: 22 }}>→</Text>
          <Text className={text.bodyMuted}>{arrow}</Text>
        </>
      ) : null}
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <Text className={`${text.body} text-red-700`}>{message}</Text>
    </View>
  );
}

function AppFooter() {
  return (
    <View className="mt-2 items-center gap-1.5">
      <Text className={`${text.small} text-center text-otto-muted`}>
        By sellers for sellers{'  '}
        <Text
          className="font-medium text-otto-text underline"
          onPress={() => Linking.openURL('https://ottosales.ai').catch(() => {})}>
          ottosales.ai
        </Text>
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => Linking.openURL('https://bit.ly/4trmlqQ').catch(() => {})}>
        <Text className="text-[15px] font-medium text-otto-accent underline">
          Connect with the Otto team →
        </Text>
      </Pressable>
    </View>
  );
}
