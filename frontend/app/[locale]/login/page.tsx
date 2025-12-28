"use client";

import { useState, useEffect } from "react";
import { useRouter, Link } from "@/navigation";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { authApi, oauthApi, getTranslatedErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type Locale } from "@/i18n";

export default function LoginPage() {
  const t = useTranslations('auth');
  const te = useTranslations(); // For error translations
  const currentLocale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const router = useRouter();
  const { login } = useAuth();

  // Check for OAuth errors in URL
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError === 'oauth_denied') {
      setError(t('oauthDenied'));
    } else if (oauthError) {
      setError(t('oauthError'));
    }

    // Handle OAuth callback token
    const token = searchParams.get('token');
    const language = searchParams.get('language');
    if (token) {
      // OAuth login succeeded - redirect to dashboard
      const userLocale = (language || 'en') as Locale;
      if (userLocale !== currentLocale) {
        router.replace("/dashboard", { locale: userLocale });
      } else {
        router.push("/dashboard");
      }
    }
  }, [searchParams, t, router, currentLocale]);

  // Fetch available OAuth providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const providers = await oauthApi.getProviders();
        setAvailableProviders(providers.filter(p => p.enabled).map(p => p.provider));
      } catch {
        // OAuth not configured - no providers available
      }
    };
    fetchProviders();
  }, []);

  const handleOAuthLogin = (provider: string) => {
    const loginUrl = oauthApi.getLoginUrl(provider, `${window.location.origin}/${currentLocale}/dashboard`);
    window.location.href = loginUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await authApi.login(email, password);

      // Use auth context to handle login with user data and workspaces
      login(response.access_token, response.user, response.workspaces);

      // Redirect to dashboard with user's preferred locale
      const userLocale = (response.user.language || "en") as Locale;
      if (userLocale !== currentLocale) {
        // Switch to user's preferred language
        router.replace("/dashboard", { locale: userLocale });
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error('Login error:', err);

      // Translate the error message
      let errorMessage = 'Login failed';
      if (err instanceof Error) {
        errorMessage = getTranslatedErrorMessage(err.message, te);
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">{t('welcomeBack')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('signInDescription')}
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('enterEmail')}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                {t('password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-3 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('enterPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                {t('forgotPassword')}
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              {t('signIn')}
            </button>
          </form>

          {/* OAuth Buttons */}
          {availableProviders.length > 0 && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">
                    {t('orContinueWith')}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {availableProviders.includes('google') && (
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('google')}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-md bg-background hover:bg-muted transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="text-sm font-medium">{t('continueWithGoogle')}</span>
                  </button>
                )}
                {availableProviders.includes('github') && (
                  <button
                    type="button"
                    onClick={() => handleOAuthLogin('github')}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-md bg-background hover:bg-muted transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                    <span className="text-sm font-medium">{t('continueWithGithub')}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('dontHaveAccount')}{" "}
              <Link
                href="/register"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {t('signUpHere')}
              </Link>
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}