'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, MessageSquareText, Phone, RefreshCcw, ShieldCheck, X } from 'lucide-react';
import { clientEnv } from '@/lib/env/client';
import { BFF_ENDPOINTS } from '@/lib/api/endpoints';
import { browserApiRequest } from '@/lib/api/browser';
import { VerifiedPhoneUserResponseSchema } from '@/lib/api/schemas/profile';
import { queryKeys } from '@/lib/query/keys';
import { setPhone, sendOtp, verifyOtp } from '@/server/actions/verification';
import { useSession } from '@/providers/session-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AppLocale } from '@/i18n/config';

type VerificationProvider = 'backend' | 'firebase';

function friendlyError(error: unknown, ar: boolean): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  if (code.includes('invalid-phone-number')) return ar ? 'رقم الهاتف غير صالح' : 'The phone number is invalid';
  if (code.includes('invalid-verification-code')) return ar ? 'رمز التحقق غير صحيح' : 'The verification code is invalid';
  if (code.includes('session-expired')) return ar ? 'انتهت صلاحية الرمز، أعد الإرسال' : 'The verification session expired; resend the code';
  if (code.includes('too-many-requests')) return ar ? 'محاولات كثيرة، حاول لاحقًا' : 'Too many attempts; please try again later';
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return ar ? 'تعذّر إكمال التحقق' : 'Phone verification could not be completed';
}

export interface PhoneVerificationPanelProps {
  locale: AppLocale;
  initialPhone: string | null;
  returnTo: string;
}

export function PhoneVerificationPanel({ locale, initialPhone, returnTo }: PhoneVerificationPanelProps) {
  const ar = locale === 'ar';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refetch: refetchSession } = useSession();
  const [phone, setPhoneValue] = React.useState(initialPhone ?? '+20');
  const [code, setCode] = React.useState('');
  const [stage, setStage] = React.useState<'phone' | 'code' | 'success'>('phone');
  const [provider, setProvider] = React.useState<VerificationProvider>('backend');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = React.useState(0);
  const [now, setNow] = React.useState(0);
  const confirmationRef = React.useRef<import('firebase/auth').ConfirmationResult | null>(null);
  const authRef = React.useRef<import('firebase/auth').Auth | null>(null);
  const recaptchaRef = React.useRef<import('firebase/auth').RecaptchaVerifier | null>(null);

  const firebaseConfigured = Boolean(
    clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY &&
      clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID
  );
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  React.useEffect(() => {
    if (!cooldownUntil) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  React.useEffect(() => () => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    confirmationRef.current = null;
  }, []);

  const finish = async () => {
    setStage('success');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile() }),
      refetchSession(),
    ]);
    window.setTimeout(() => {
      router.replace(returnTo);
      router.refresh();
    }, 500);
  };

  const startBackend = async () => {
    setPending(true);
    setError(null);
    const result = await setPhone({ phone });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setProvider('backend');
    setStage('code');
    setCooldownUntil(Date.now() + 60_000);
    setNow(Date.now());
  };

  const startFirebase = async () => {
    if (!firebaseConfigured) return;
    setPending(true);
    setError(null);
    try {
      const [{ getApps, initializeApp }, firebaseAuth] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      const app = getApps()[0] ?? initializeApp({
        apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY!,
        authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID!,
        ...(clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
          ? { storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }
          : {}),
        ...(clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
          ? { messagingSenderId: clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }
          : {}),
      });
      const auth = firebaseAuth.getAuth(app);
      authRef.current = auth;
      recaptchaRef.current?.clear();
      const verifier = new firebaseAuth.RecaptchaVerifier(auth, 'phone-recaptcha', {
        size: 'invisible',
      });
      recaptchaRef.current = verifier;
      confirmationRef.current = await firebaseAuth.signInWithPhoneNumber(auth, phone, verifier);
      setProvider('firebase');
      setStage('code');
      setCooldownUntil(Date.now() + 60_000);
      setNow(Date.now());
    } catch (caught) {
      setError(friendlyError(caught, ar));
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setPending(false);
    }
  };

  const confirmCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(ar ? 'أدخل رمزًا مكوّنًا من ٦ أرقام' : 'Enter the 6-digit verification code');
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (provider === 'backend') {
        const result = await verifyOtp({ purpose: 'PHONE_VERIFY', code });
        if (!result.ok) throw result.error;
      } else {
        const confirmation = confirmationRef.current;
        if (!confirmation) throw new Error(ar ? 'انتهت جلسة التحقق' : 'Verification session expired');
        const credential = await confirmation.confirm(code);
        const idToken = await credential.user.getIdToken(true);
        try {
          await browserApiRequest({
            path: BFF_ENDPOINTS.authPhoneVerify(),
            method: 'POST',
            input: { idToken, phone },
            outputSchema: VerifiedPhoneUserResponseSchema,
          });
        } finally {
          if (authRef.current) {
            const { signOut } = await import('firebase/auth');
            await signOut(authRef.current).catch(() => undefined);
          }
        }
      }
      confirmationRef.current = null;
      await finish();
    } catch (caught) {
      setCode('');
      setError(friendlyError(caught, ar));
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    if (cooldownSeconds > 0 || pending) return;
    if (provider === 'firebase') {
      await startFirebase();
      return;
    }
    setPending(true);
    setError(null);
    const result = await sendOtp({ purpose: 'PHONE_VERIFY' });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCooldownUntil(Date.now() + 60_000);
    setNow(Date.now());
  };

  return (
    <Card className="border-primary/30" data-testid="phone-verification-panel">
      <CardHeader className="flex-row items-start justify-between space-y-0 border-b">
        <div>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />{ar ? 'تأكيد رقم الهاتف' : 'Verify your phone'}</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">{ar ? 'يلزم رقم موثّق للبيع وإرسال طلبات التواصل.' : 'A verified number is required to sell and send buyer inquiries.'}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label={ar ? 'إغلاق' : 'Close'} onClick={() => router.replace(`/${locale}/profile`)}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="pt-6">
        {error ? <Alert variant="destructive" role="alert" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert> : null}

        {stage === 'phone' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verification-phone">{ar ? 'رقم الهاتف بصيغة دولية' : 'Phone number in international format'}</Label>
              <Input id="verification-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(event) => setPhoneValue(event.target.value)} disabled={pending} placeholder="+201012345678" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={startBackend} disabled={pending} className="flex-1" data-testid="send-phone-code">
                {pending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="me-2 h-4 w-4" />}
                {ar ? 'إرسال رمز التحقق' : 'Send verification code'}
              </Button>
              {firebaseConfigured ? (
                <Button type="button" variant="outline" onClick={startFirebase} disabled={pending} className="flex-1" data-testid="firebase-phone-code">
                  <Phone className="me-2 h-4 w-4" />{ar ? 'التحقق عبر Firebase' : 'Verify with Firebase'}
                </Button>
              ) : null}
            </div>
          </div>
        ) : stage === 'code' ? (
          <form onSubmit={confirmCode} className="space-y-4">
            <p className="text-sm text-muted-foreground">{ar ? 'أدخل الرمز المرسل إلى الرقم' : 'Enter the code sent to'} <bdi dir="ltr" className="font-semibold text-foreground">{phone}</bdi></p>
            <div className="space-y-2">
              <Label htmlFor="phone-code">{ar ? 'رمز التحقق' : 'Verification code'}</Label>
              <Input id="phone-code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="text-center font-mono text-xl tracking-[0.35em]" disabled={pending} />
            </div>
            <Button type="submit" className="w-full" disabled={pending} data-testid="confirm-phone-code">
              {pending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}{ar ? 'تأكيد الرقم' : 'Confirm phone'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" disabled={pending || cooldownSeconds > 0} onClick={resend}>
              <RefreshCcw className="me-2 h-4 w-4" />
              {cooldownSeconds > 0 ? (ar ? `إعادة الإرسال خلال ${cooldownSeconds}ث` : `Resend in ${cooldownSeconds}s`) : (ar ? 'إعادة إرسال الرمز' : 'Resend code')}
            </Button>
          </form>
        ) : (
          <div className="py-4 text-center" role="status" data-testid="phone-verification-success">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h3 className="mt-4 text-lg font-bold">{ar ? 'تم تأكيد رقم الهاتف' : 'Phone verified'}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{ar ? 'سيتم إعادتك إلى الصفحة المطلوبة.' : 'Returning you to your requested page.'}</p>
          </div>
        )}
        <div id="phone-recaptcha" />
      </CardContent>
    </Card>
  );
}
