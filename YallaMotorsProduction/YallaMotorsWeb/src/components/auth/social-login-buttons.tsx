'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/types/common';
import type { RegistrationAccountType } from '@/types/common';
import { clientEnv } from '@/lib/env/client';
import { browserApiRequest } from '@/lib/api/browser';
import { SessionResponseSchema } from '@/lib/api/schemas/auth';
import { sanitizeReturnTo } from '@/lib/auth/return-to';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

interface GoogleIdInitializeConfig {
  client_id: string;
  callback: (response: { credential?: string }) => void;
  cancel_on_tap_outside?: boolean;
}

interface GooglePromptNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
}

interface GoogleGsiWindow {
  accounts: {
    id: {
      initialize: (config: GoogleIdInitializeConfig) => void;
      prompt: (notificationCallback?: (notification: GooglePromptNotification) => void) => void;
    };
  };
}

interface AppleAuthInitConfig {
  clientId: string;
  scope: string;
  redirectURI: string;
  usePopup: boolean;
  state?: string;
  nonce?: string;
}

interface AppleAuthResponse {
  authorization?: {
    code?: string;
    id_token?: string;
    state?: string;
  };
  user?: {
    name?: {
      firstName?: string;
      lastName?: string;
    };
    email?: string;
  };
}

interface AppleIdWindow {
  auth: {
    init: (config: AppleAuthInitConfig) => void;
    signIn: () => Promise<AppleAuthResponse>;
  };
}

interface SocialLoginButtonsProps {
  locale: Locale;
  returnTo?: string | null;
  accountType?: RegistrationAccountType;
  onProviderError?: (error: string) => void;
}

function loadExternalScript(src: string, id: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export function SocialLoginButtons({
  locale,
  returnTo,
  accountType = 'CUSTOMER',
  onProviderError,
}: SocialLoginButtonsProps) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [loadingProvider, setLoadingProvider] = React.useState<'google' | 'apple' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const safeReturn = returnTo ? sanitizeReturnTo(returnTo, locale) : `/${locale}`;

  const handleGoogleLogin = async () => {
    setError(null);
    setLoadingProvider('google');

    try {
      // 1. Configured availability check
      const googleClientId = clientEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        const msg = isAr
          ? 'خدمة تسجيل الدخول بواسطة Google غير متوفرة حاليًا، يُرجى استخدام البريد وكلمة المرور'
          : 'Google sign-in is currently unavailable, please use email and password';
        setError(msg);
        onProviderError?.(msg);
        return;
      }

      // 2. Load SDK only after explicit user activation if not already loaded
      let googleObj = (window as unknown as { google?: GoogleGsiWindow }).google;
      if (!googleObj?.accounts?.id) {
        const loaded = await loadExternalScript('https://accounts.google.com/gsi/client', 'google-gsi-script');
        googleObj = (window as unknown as { google?: GoogleGsiWindow }).google;
        if (!loaded || !googleObj?.accounts?.id) {
          const msg = isAr
            ? 'خدمة تسجيل الدخول بواسطة Google غير متوفرة حاليًا، يُرجى استخدام البريد وكلمة المرور'
            : 'Google sign-in is currently unavailable, please use email and password';
          setError(msg);
          onProviderError?.(msg);
          return;
        }
      }

      // 3. Invoke Google Identity Services SDK to obtain real credential
      const realIdToken = await new Promise<string>((resolve, reject) => {
        try {
          googleObj!.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response) => {
              if (
                response?.credential &&
                typeof response.credential === 'string' &&
                response.credential.trim().length > 0
              ) {
                resolve(response.credential.trim());
              } else {
                reject(
                  new Error(
                    isAr
                      ? 'لم يتم استلام رمز التحقق من Google'
                      : 'No credential received from Google'
                  )
                );
              }
            },
            cancel_on_tap_outside: true,
          });

          googleObj!.accounts.id.prompt((notification) => {
            if (
              notification?.isNotDisplayed?.() ||
              notification?.isSkippedMoment?.() ||
              notification?.isDismissedMoment?.()
            ) {
              const reason =
                notification.getNotDisplayedReason?.() ||
                notification.getSkippedReason?.() ||
                notification.getDismissedReason?.() ||
                'Google prompt dismissed';
              reject(new Error(reason));
            }
          });
        } catch (err) {
          reject(err);
        }
      });

      // 4. Exchange only the real credential immediately via the BFF (no token persistence/logging)
      const response = await browserApiRequest({
        path: '/api/bff/auth/google',
        method: 'POST',
        input: {
          idToken: realIdToken,
          accountType,
          returnTo: safeReturn,
        },
        outputSchema: SessionResponseSchema,
      });

      if (response.data) {
        router.push(safeReturn);
      }
    } catch (err) {
      const msg = (err as Error)?.message || (isAr ? 'فشل تسجيل الدخول بواسطة Google' : 'Google sign-in failed');
      setError(msg);
      onProviderError?.(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleAppleLogin = async () => {
    setError(null);
    setLoadingProvider('apple');

    try {
      // 1. Configured availability check
      const appleClientId = clientEnv.NEXT_PUBLIC_APPLE_CLIENT_ID;
      if (!appleClientId) {
        const msg = isAr
          ? 'خدمة تسجيل الدخول بواسطة Apple غير متوفرة حاليًا، يُرجى استخدام البريد وكلمة المرور'
          : 'Apple sign-in is currently unavailable, please use email and password';
        setError(msg);
        onProviderError?.(msg);
        return;
      }

      // 2. Load SDK only after explicit user activation if not already loaded
      let appleObj = (window as unknown as { AppleID?: AppleIdWindow }).AppleID;
      if (!appleObj?.auth) {
        const loaded = await loadExternalScript(
          'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/auth.js',
          'apple-auth-script'
        );
        appleObj = (window as unknown as { AppleID?: AppleIdWindow }).AppleID;
        if (!loaded || !appleObj?.auth) {
          const msg = isAr
            ? 'خدمة تسجيل الدخول بواسطة Apple غير متوفرة حاليًا، يُرجى استخدام البريد وكلمة المرور'
            : 'Apple sign-in is currently unavailable, please use email and password';
          setError(msg);
          onProviderError?.(msg);
          return;
        }
      }

      // 3. Invoke Apple SDK to obtain real credential
      appleObj.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: `${clientEnv.NEXT_PUBLIC_SITE_ORIGIN}/${locale}/login`,
        usePopup: true,
      });

      const appleResponse = await appleObj.auth.signIn();
      const realIdentityToken = appleResponse?.authorization?.id_token;
      if (!realIdentityToken || typeof realIdentityToken !== 'string' || realIdentityToken.trim().length === 0) {
        throw new Error(isAr ? 'لم يتم استلام رمز التحقق من Apple' : 'No identity token received from Apple');
      }

      const firstName = appleResponse.user?.name?.firstName ?? null;
      const lastName = appleResponse.user?.name?.lastName ?? null;

      // 4. Exchange only the real credential immediately via the BFF (no token persistence/logging)
      const response = await browserApiRequest({
        path: '/api/bff/auth/apple',
        method: 'POST',
        input: {
          identityToken: realIdentityToken.trim(),
          firstName,
          lastName,
          accountType,
          returnTo: safeReturn,
        },
        outputSchema: SessionResponseSchema,
      });

      if (response.data) {
        router.push(safeReturn);
      }
    } catch (err) {
      const msg = (err as Error)?.message || (isAr ? 'فشل تسجيل الدخول بواسطة Apple' : 'Apple sign-in failed');
      setError(msg);
      onProviderError?.(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-3 w-full" data-testid="social-login-buttons">
      {error && (
        <Alert variant="destructive" className="text-xs py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
          disabled={loadingProvider !== null}
          data-testid="google-login-button"
          className="w-full gap-2 h-11 text-sm font-medium border-border hover:bg-muted/50"
        >
          {loadingProvider === 'google' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{isAr ? 'متابعة مع Google' : 'Continue with Google'}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleAppleLogin}
          disabled={loadingProvider !== null}
          data-testid="apple-login-button"
          className="w-full gap-2 h-11 text-sm font-medium border-border hover:bg-muted/50"
        >
          {loadingProvider === 'apple' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16.365 1.43c0 1.14-.41 2.1-1.23 2.97-.83.87-2.19 1.54-3.36 1.45-.15-1.12.43-2.31 1.21-3.09.78-.79 2.14-1.36 3.38-1.33zM20.94 17.12c-.5 1.16-.74 1.68-1.39 2.71-.91 1.43-2.19 3.21-3.78 3.23-1.42.02-1.79-.93-3.72-.92-1.94.01-2.34.94-3.76.92-1.59-.02-2.78-1.63-3.69-3.06-2.55-4.02-2.82-8.74-1.25-11.16 1.12-1.73 2.9-2.74 4.57-2.74 1.7 0 2.77.94 4.18.94 1.37 0 2.2-.94 4.17-.94 1.49 0 3.06.81 4.18 2.2-3.67 2.01-3.07 7.24.49 8.82z" />
            </svg>
          )}
          <span>{isAr ? 'متابعة مع Apple' : 'Continue with Apple'}</span>
        </Button>
      </div>
    </div>
  );
}
