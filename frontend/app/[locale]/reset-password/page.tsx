"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/navigation";
import { Eye, EyeOff, Lock, CheckCircle, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { authApi, getTranslatedErrorMessage } from "@/lib/api";

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const te = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Redirect if no token provided
  useEffect(() => {
    if (!token) {
      router.push('/forgot-password');
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    setIsLoading(true);

    try {
      await authApi.confirmPasswordReset(token!, password);
      setSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      let errorMessage = t('resetFailed');
      if (err instanceof Error) {
        errorMessage = getTranslatedErrorMessage(err.message, te);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return null; // Will redirect in useEffect
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-4">{t('passwordResetSuccess')}</h1>
            <p className="text-muted-foreground mb-6">
              {t('passwordResetSuccessDescription')}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full px-4 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              {t('signIn')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">{t('resetPassword')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('resetPasswordDescription')}
          </p>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                {t('newPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-12 py-3 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('enterNewPassword')}
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

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-10 pr-12 py-3 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={t('confirmNewPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
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
              {t('resetPassword')}
            </button>
          </form>
        </div>

        {/* Back to Login */}
        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
