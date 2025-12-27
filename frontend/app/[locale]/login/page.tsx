"use client";

import { useState } from "react";
import { useRouter, Link } from "@/navigation";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { authApi, getTranslatedErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type Locale } from "@/i18n";

export default function LoginPage() {
  const t = useTranslations('auth');
  const te = useTranslations(); // For error translations
  const currentLocale = useLocale() as Locale;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

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