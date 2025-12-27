"use client";

import { useState } from "react";
import { Link } from "@/navigation";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { authApi, getTranslatedErrorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const te = useTranslations();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await authApi.requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      console.error('Password reset request error:', err);
      let errorMessage = t('resetRequestFailed');
      if (err instanceof Error) {
        errorMessage = getTranslatedErrorMessage(err.message, te);
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-4">{t('checkYourEmail')}</h1>
            <p className="text-muted-foreground mb-6">
              {t('resetLinkSent')}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToLogin')}
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
          <h1 className="text-3xl font-bold text-foreground">{t('forgotPassword')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('forgotPasswordDescription')}
          </p>
        </div>

        {/* Form */}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              {t('sendResetLink')}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
