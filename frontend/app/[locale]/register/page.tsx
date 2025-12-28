"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, Link } from "@/navigation";
import { Eye, EyeOff, Mail, Lock, User, UserCheck, Check, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { authApi, oauthApi, getTranslatedErrorMessage } from "@/lib/api";
import { checkPasswordStrength, PasswordStrength, useAuth } from "@/lib/auth";
import { type Locale } from "@/i18n";

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const te = useTranslations(); // For error translations
  const tp = useTranslations('passwordStrength');
  const currentLocale = useLocale() as Locale;
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string> & { general?: string }>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  // Initialize to true if there's a token in URL to prevent form flash
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).has('token');
    }
    return false;
  });
  const oauthProcessingRef = useRef(false);
  const router = useRouter();
  const { login } = useAuth();

  // Handle OAuth callback token
  useEffect(() => {
    // Guard against multiple executions
    if (oauthProcessingRef.current) return;

    const oauthError = searchParams.get('error');
    if (oauthError === 'oauth_denied') {
      setErrors({ general: t('oauthDenied') });
      return;
    } else if (oauthError) {
      setErrors({ general: t('oauthError') });
      return;
    }

    // Handle OAuth callback token
    const token = searchParams.get('token');
    const language = searchParams.get('language');
    if (token) {
      // Mark as processing to prevent re-execution
      oauthProcessingRef.current = true;
      setIsProcessingOAuth(true);

      const completeOAuthLogin = async () => {
        try {
          const { tokenStorage } = await import('@/lib/api');
          tokenStorage.setToken(token);

          // Fetch user data and workspaces
          const [userData, workspacesData] = await Promise.all([
            authApi.getProfile(),
            authApi.getWorkspaces(),
          ]);

          // Complete login with all data
          login(token, userData, workspacesData);

          // Redirect to dashboard with correct locale
          const userLocale = (userData.language || language || 'en') as Locale;
          if (userLocale !== currentLocale) {
            router.replace("/dashboard", { locale: userLocale });
          } else {
            router.push("/dashboard");
          }
        } catch (err) {
          console.error('OAuth registration completion failed:', err);
          setErrors({ general: t('oauthError') });
          setIsProcessingOAuth(false);
          oauthProcessingRef.current = false;
          const { tokenStorage } = await import('@/lib/api');
          tokenStorage.removeToken();
        }
      };

      completeOAuthLogin();
    }
  }, [searchParams, t, router, currentLocale, login]);

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
    // Redirect back to register page to process the token, then redirect to dashboard
    const loginUrl = oauthApi.getLoginUrl(provider, `${window.location.origin}/${currentLocale}/register`);
    window.location.href = loginUrl;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = tv('firstNameRequired');
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = tv('lastNameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = tv('emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = tv('emailInvalid');
    }

    if (!formData.password) {
      newErrors.password = tv('passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = tv('passwordMinLength');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = tv('passwordsDontMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Register the user with current locale as their preferred language
      await authApi.register({
        email: formData.email,
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        password: formData.password,
        language: currentLocale,
      });

      // Show redirecting state
      setIsRedirecting(true);

      // Auto-login immediately after successful registration
      const loginResponse = await authApi.login(formData.email, formData.password);

      // Use auth context to handle login with workspaces
      login(loginResponse.access_token, loginResponse.user, loginResponse.workspaces);

      // Redirect to dashboard (stay in current locale since we just registered with it)
      router.push("/dashboard");
    } catch (err) {
      console.error('Registration error:', err);

      // Translate the error message
      let errorMessage = 'Registration failed';
      if (err instanceof Error) {
        errorMessage = getTranslatedErrorMessage(err.message, te);
      }

      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Update password strength when password changes
    if (field === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Show loading screen while processing OAuth (check both state and URL param)
  if (isProcessingOAuth || searchParams.get('token')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('signingIn')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">{t('createAccount')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('joinDescription')}
          </p>
        </div>

        {/* Register Form */}
        <div className="bg-card border border-border rounded-lg shadow-sm p-8">
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                  {t('firstName')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.firstName ? "border-red-500" : "border-border"
                    }`}
                    placeholder={t('john')}
                  />
                </div>
                {errors.firstName && (
                  <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                  {t('lastName')}
                </label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.lastName ? "border-red-500" : "border-border"
                    }`}
                    placeholder={t('doe')}
                  />
                </div>
                {errors.lastName && (
                  <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>

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
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.email ? "border-red-500" : "border-border"
                  }`}
                  placeholder={t('johnDoeExample')}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
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
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.password ? "border-red-500" : "border-border"
                  }`}
                  placeholder={t('createStrongPassword')}
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
              {errors.password && (
                <p className="text-sm text-red-500 mt-1">{errors.password}</p>
              )}

              {/* Password Strength Indicator */}
              {passwordStrength && formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{tp('title')}</span>
                    <span className={`text-sm font-medium ${
                      passwordStrength.score === 0 ? 'text-red-500' :
                      passwordStrength.score === 1 ? 'text-orange-500' :
                      passwordStrength.score === 2 ? 'text-yellow-500' :
                      passwordStrength.score === 3 ? 'text-blue-500' :
                      'text-green-500'
                    }`}>
                      {passwordStrength.score === 0 ? tp('veryWeak') :
                       passwordStrength.score === 1 ? tp('weak') :
                       passwordStrength.score === 2 ? tp('fair') :
                       passwordStrength.score === 3 ? tp('good') :
                       tp('strong')}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        passwordStrength.score === 0 ? 'bg-red-500' :
                        passwordStrength.score === 1 ? 'bg-orange-500' :
                        passwordStrength.score === 2 ? 'bg-yellow-500' :
                        passwordStrength.score === 3 ? 'bg-blue-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                    />
                  </div>

                  {/* Criteria checklist */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center space-x-2">
                      {passwordStrength.criteria.length ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-gray-400" />
                      )}
                      <span className={passwordStrength.criteria.length ? 'text-green-700' : 'text-gray-500'}>
                        {tp('length')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {passwordStrength.criteria.uppercase ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-gray-400" />
                      )}
                      <span className={passwordStrength.criteria.uppercase ? 'text-green-700' : 'text-gray-500'}>
                        {tp('uppercase')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {passwordStrength.criteria.lowercase ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-gray-400" />
                      )}
                      <span className={passwordStrength.criteria.lowercase ? 'text-green-700' : 'text-gray-500'}>
                        {tp('lowercase')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {passwordStrength.criteria.number ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-gray-400" />
                      )}
                      <span className={passwordStrength.criteria.number ? 'text-green-700' : 'text-gray-500'}>
                        {tp('number')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {passwordStrength.criteria.special ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-gray-400" />
                      )}
                      <span className={passwordStrength.criteria.special ? 'text-green-700' : 'text-gray-500'}>
                        {tp('special')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
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
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  className={`w-full pl-10 pr-12 py-3 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.confirmPassword ? "border-red-500" : "border-border"
                  }`}
                  placeholder={t('confirmYourPassword')}
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
              {errors.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isRedirecting}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(isLoading || isRedirecting) ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              {isRedirecting ? t('signingIn') : t('createAccountButton')}
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

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('alreadyHaveAccount')}{" "}
              <Link
                href="/login"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {t('signInHere')}
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
