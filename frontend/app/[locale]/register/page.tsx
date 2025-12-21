"use client";

import { useState } from "react";
import { useRouter, Link } from "@/navigation";
import { Eye, EyeOff, Mail, Lock, User, UserCheck, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { authApi, getTranslatedErrorMessage } from "@/lib/api";
import { checkPasswordStrength, PasswordStrength, useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tv = useTranslations('validation');
  const te = useTranslations(); // For error translations
  const tp = useTranslations('passwordStrength');

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
  const router = useRouter();
  const { login } = useAuth();

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
      // Register the user
      await authApi.register({
        email: formData.email,
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        password: formData.password,
      });

      // Show redirecting state
      setIsRedirecting(true);

      // Auto-login immediately after successful registration
      const loginResponse = await authApi.login(formData.email, formData.password);

      // Use auth context to handle login with workspaces
      login(loginResponse.access_token, loginResponse.user, loginResponse.workspaces);

      // Redirect to dashboard
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
