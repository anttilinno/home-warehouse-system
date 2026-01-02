"use client";

import { useState, useEffect, useTransition } from "react";
import { Unlink, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { authApi, oauthApi, OAuthAccount, User as UserType } from "@/lib/api";
import { useTranslations, useLocale } from "next-intl";
import { formatDate as formatDateUtil } from "@/lib/date-utils";
import { useRouter, usePathname } from "@/navigation";
import { locales, type Locale } from "@/i18n";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type * as LucideIcons from "lucide-react";
import { NES_GREEN, NES_BLUE } from "@/lib/nes-colors";
import { useThemed, useThemedClasses } from "@/lib/themed";

type IconName = keyof typeof LucideIcons;

const themeOptions: { value: string; iconName: IconName; labelKey: string }[] = [
  { value: "light", iconName: "Sun", labelKey: "themeLight" },
  { value: "dark", iconName: "Moon", labelKey: "themeDark" },
  { value: "retro-light", iconName: "Gamepad2", labelKey: "themeRetroLight" },
  { value: "retro-dark", iconName: "Gamepad2", labelKey: "themeRetroDark" },
];

const languageNames: Record<Locale, string> = {
  en: "English",
  et: "Eesti",
  ru: "Русский",
};

export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading, user: authUser } = useAuth();
  const t = useTranslations('profile');
  const tSettings = useTranslations('settings');
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const themed = useThemed();
  const classes = useThemedClasses();
  const { Card, Button, Input, Label, Select, Form, FormGroup, Error } = themed;

  const [profile, setProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dateFormat, setDateFormat] = useState("DD.MM.YYYY HH:mm");
  const [language, setLanguage] = useState<Locale>("en");
  const [selectedTheme, setSelectedTheme] = useState("system");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // OAuth accounts
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([]);
  const [oauthLoading, setOauthLoading] = useState(true);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
      fetchOAuthData();
    }
  }, [isAuthenticated]);

  const fetchOAuthData = async () => {
    try {
      setOauthLoading(true);
      const [accounts, providers] = await Promise.all([
        oauthApi.getLinkedAccounts(),
        oauthApi.getProviders(),
      ]);
      setOauthAccounts(accounts);
      setAvailableProviders(providers.filter(p => p.enabled).map(p => p.provider));
    } catch (e) {
      const err = e as Error;
      // OAuth not configured - silently ignore
      console.debug('OAuth not configured:', err.message);
    } finally {
      setOauthLoading(false);
    }
  };

  const handleLinkAccount = (provider: string) => {
    const loginUrl = oauthApi.getLoginUrl(provider, window.location.href);
    window.location.href = loginUrl;
  };

  const handleUnlinkAccount = async (accountId: string) => {
    setUnlinkingId(accountId);
    try {
      await oauthApi.unlinkAccount(accountId);
      setOauthAccounts(prev => prev.filter(a => a.id !== accountId));
    } catch (e) {
      const err = e as Error;
      console.error('Failed to unlink account:', err.message);
    } finally {
      setUnlinkingId(null);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await authApi.getProfile();
      setProfile(data);
      setFullName(data.full_name || "");
      setEmail(data.email);
      setDateFormat(data.date_format || "DD.MM.YYYY HH:mm");
      setLanguage((data.language as Locale) || "en");
      setSelectedTheme(data.theme || "system");
      // Note: Theme is applied by ThemeSync component on initial load
      // Don't call setTheme here to avoid overriding user's UI selections
      setError(null);
    } catch (e) {
      const err = e as Error;
      console.error('Failed to fetch profile:', err.message);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const languageChanged = language !== profile?.language;

    try {
      const updated = await authApi.updateProfile({
        full_name: fullName || null,
        email: email !== profile?.email ? email : undefined,
        date_format: dateFormat,
        language: language,
        theme: selectedTheme,
      });
      setProfile(updated);
      setSuccess(t('profileUpdated'));

      // Update localStorage user data
      if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          userData.full_name = updated.full_name;
          userData.email = updated.email;
          userData.date_format = updated.date_format;
          userData.language = updated.language;
          userData.theme = updated.theme;
          localStorage.setItem('user', JSON.stringify(userData));
        }
      }

      // Switch locale if language was changed
      if (languageChanged && language !== currentLocale) {
        startTransition(() => {
          router.replace(pathname, { locale: language });
        });
      }
    } catch (e) {
      const err = e as Error;
      console.error('Failed to update profile:', err.message);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('passwordTooShort'));
      return;
    }

    setChangingPassword(true);

    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(t('passwordChanged'));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      const err = e as Error;
      console.error('Failed to change password:', err.message);
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        {classes.isRetro ? (
          <div className="text-center">
            <div className="text-2xl font-bold animate-pulse retro-heading">LOADING...</div>
            <div className="mt-2 text-sm text-muted-foreground retro-body">Please wait</div>
          </div>
        ) : (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return formatDateUtil(dateString, authUser?.date_format);
  };

  return (
    <>
      {/* Header */}
      <div className={cn("mb-4", !classes.isRetro && "mb-8")}>
        <h1 className={cn(
          classes.isRetro ? "text-xl font-bold uppercase retro-heading" : "text-3xl font-bold text-foreground"
        )}>
          {t('title')}
        </h1>
        <p className={cn(
          "mt-1 text-muted-foreground",
          classes.isRetro ? "font-mono text-xs" : "mt-2"
        )}>
          {classes.isRetro ? "> PLAYER CONFIGURATION MENU" : t('subtitle')}
        </p>
      </div>

      <div className={cn("grid gap-4 w-full", !classes.isRetro && "gap-6")}>
        {/* Player/Profile Card */}
        <Card>
          <div className={cn("p-4", !classes.isRetro && "p-6")}>
            <div className={cn("flex items-center gap-4", classes.isRetro ? "mb-4" : "mb-6")}>
              {classes.isRetro ? (
                <div
                  className="w-16 h-16 flex items-center justify-center border-4 border-border text-white font-bold text-lg retro-heading"
                  style={{ backgroundColor: NES_BLUE }}
                >
                  P1
                </div>
              ) : (
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {profile?.full_name?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div>
                <h2 className={cn(
                  classes.isRetro ? "text-sm font-bold uppercase retro-heading" : "text-xl font-semibold text-foreground"
                )}>
                  {classes.isRetro ? (profile?.full_name || 'PLAYER 1') : profile?.full_name}
                </h2>
                <p className={cn(
                  "text-muted-foreground",
                  classes.isRetro ? "text-xs retro-body" : ""
                )}>
                  {profile?.email}
                </p>
                {classes.isRetro && (
                  <p className="retro-small text-muted-foreground mt-1 retro-body">
                    LVL 99 USER
                  </p>
                )}
              </div>
            </div>

            <div className={cn(
              "flex items-center gap-2 text-sm text-muted-foreground",
              classes.isRetro ? "text-xs border-t-2 border-dashed border-muted pt-3 retro-body" : ""
            )}>
              <Icon name="Clock" className="w-4 h-4" />
              <span>{t('memberSince')} {profile?.created_at ? formatDate(profile.created_at) : '-'}</span>
            </div>
          </div>
        </Card>

        {/* Edit Profile Form */}
        <Card
          title={t('editProfile')}
          icon="Save"
        >
          <div className={cn("p-4", !classes.isRetro && "p-6")}>
            {error && (
              <div className={cn(
                "mb-4 p-3 text-sm",
                classes.isRetro
                  ? "bg-primary/10 text-primary border-4 border-primary retro-small"
                  : "bg-destructive/10 text-destructive rounded-md"
              )}>
                {classes.isRetro ? `! ${error}` : error}
              </div>
            )}

            {success && (
              <div className={cn(
                "mb-4 p-3 text-sm",
                classes.isRetro
                  ? "text-white border-4 border-border retro-small"
                  : "bg-green-500/10 text-green-600 rounded-md"
              )} style={classes.isRetro ? { backgroundColor: NES_GREEN } : undefined}>
                {classes.isRetro ? `+ ${success}` : success}
              </div>
            )}

            <Form onSubmit={handleUpdateProfile}>
              <FormGroup>
                <Label htmlFor="fullName">{t('fullName')}</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('fullNamePlaceholder')}
                />
              </FormGroup>

              <FormGroup>
                <Label htmlFor="email">{t('email')}</Label>
                <div className="relative">
                  <Icon name="Mail" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </FormGroup>

              <FormGroup>
                <Label htmlFor="dateFormat">{t('dateTimeFormat')}</Label>
                <div className="relative">
                  <Icon name="Clock" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Select
                    id="dateFormat"
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="pl-10"
                  >
                    <option value="DD.MM.YYYY HH:mm">
                      {classes.isRetro ? "DD.MM.YYYY HH:mm" : "DD.MM.YYYY HH:mm (31.12.2024 14:30)"}
                    </option>
                    <option value="MM/DD/YYYY h:mm A">
                      {classes.isRetro ? "MM/DD/YYYY h:mm A" : "MM/DD/YYYY h:mm A (12/31/2024 2:30 PM)"}
                    </option>
                    <option value="YYYY-MM-DD HH:mm">
                      {classes.isRetro ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD HH:mm (2024-12-31 14:30)"}
                    </option>
                  </Select>
                </div>
              </FormGroup>

              <FormGroup>
                <Label htmlFor="language">{t('language')}</Label>
                <div className="relative">
                  <Icon name="Globe" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Locale)}
                    disabled={isPending}
                    className="pl-10"
                  >
                    {locales.map((loc) => (
                      <option key={loc} value={loc}>
                        {languageNames[loc]}
                      </option>
                    ))}
                  </Select>
                </div>
              </FormGroup>

              {/* Theme Selection */}
              <FormGroup>
                <Label>{tSettings('appearance')}</Label>
                {!classes.isRetro && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {tSettings('appearanceDescription')}
                  </p>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {themeOptions.map((themeOption) => {
                    const isActive = mounted && selectedTheme === themeOption.value;

                    return (
                      <button
                        key={themeOption.value}
                        type="button"
                        onClick={() => {
                          setSelectedTheme(themeOption.value);
                          setTheme(themeOption.value);
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2 transition-all",
                          classes.isRetro
                            ? cn(
                                "border-4",
                                isActive
                                  ? "border-primary bg-primary/10 retro-shadow"
                                  : "border-border hover:border-primary/50 bg-card"
                              )
                            : cn(
                                "rounded-lg border-2 transition-colors",
                                isActive
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              )
                        )}
                      >
                        <Icon
                          name={themeOption.iconName}
                          className={cn(
                            classes.isRetro ? "w-4 h-4" : "w-5 h-5",
                            isActive ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        <span className={cn(
                          "text-center",
                          classes.isRetro
                            ? cn("text-[10px] font-bold uppercase retro-heading", isActive ? "text-primary" : "text-foreground")
                            : cn("text-xs font-medium", isActive ? "text-primary" : "text-foreground")
                        )}>
                          {tSettings(themeOption.labelKey)}
                        </span>
                        {isActive && (
                          <Icon name="Check" className="w-3 h-3 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </FormGroup>

              <Button
                type="submit"
                variant={classes.isRetro ? "secondary" : "primary"}
                icon="Check"
                disabled={saving}
                style={classes.isRetro ? { backgroundColor: NES_GREEN } : undefined}
              >
                {saving ? t('saving') : t('saveChanges')}
              </Button>
            </Form>
          </div>
        </Card>

        {/* Change Password Form */}
        <Card
          title={t('changePassword')}
          icon="Shield"
        >
          <div className={cn("p-4", !classes.isRetro && "p-6")}>
            {passwordError && (
              <div className={cn(
                "mb-4 p-3 text-sm",
                classes.isRetro
                  ? "bg-primary/10 text-primary border-4 border-primary retro-small"
                  : "bg-destructive/10 text-destructive rounded-md"
              )}>
                {classes.isRetro ? `! ${passwordError}` : passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className={cn(
                "mb-4 p-3 text-sm",
                classes.isRetro
                  ? "text-white border-4 border-border retro-small"
                  : "bg-green-500/10 text-green-600 rounded-md"
              )} style={classes.isRetro ? { backgroundColor: NES_GREEN } : undefined}>
                {classes.isRetro ? `+ ${passwordSuccess}` : passwordSuccess}
              </div>
            )}

            <Form onSubmit={handleChangePassword}>
              <FormGroup>
                <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup>
                <Label htmlFor="newPassword">{t('newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </FormGroup>

              <FormGroup>
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </FormGroup>

              <Button
                type="submit"
                variant="primary"
                icon="Shield"
                disabled={changingPassword}
              >
                {changingPassword ? t('changing') : t('changePasswordButton')}
              </Button>
            </Form>
          </div>
        </Card>

        {/* Linked Accounts - Only show if OAuth is configured */}
        {!oauthLoading && availableProviders.length > 0 && (
          <Card
            title={t('linkedAccounts')}
            icon="ExternalLink"
          >
            <div className={cn("p-4", !classes.isRetro && "p-6")}>
              <p className={cn(
                "mb-4 text-muted-foreground",
                classes.isRetro ? "text-xs retro-body" : "text-sm"
              )}>
                {t('linkedAccountsDescription')}
              </p>

              {/* Existing linked accounts */}
              {oauthAccounts.length > 0 ? (
                <div className={cn("mb-4", classes.isRetro ? "space-y-2" : "space-y-3")}>
                  {oauthAccounts.map((account) => (
                    <div
                      key={account.id}
                      className={cn(
                        "flex items-center justify-between p-3 bg-muted/30",
                        classes.isRetro ? "border-4 border-border" : "rounded-lg border border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {account.provider === 'google' && (
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                        )}
                        {account.provider === 'github' && (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                          </svg>
                        )}
                        <div>
                          <p className={cn(
                            classes.isRetro ? "retro-heading" : "font-medium capitalize"
                          )}>
                            {account.provider}
                          </p>
                          <p className={cn(
                            "text-muted-foreground",
                            classes.isRetro ? "text-xs retro-body" : "text-sm"
                          )}>
                            {account.email || account.display_name}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlinkAccount(account.id)}
                        disabled={unlinkingId === account.id}
                        className={cn(
                          "flex items-center gap-1.5 transition-colors disabled:opacity-50",
                          classes.isRetro
                            ? "px-2 py-1 text-xs text-primary border-2 border-primary hover:bg-primary/10 retro-heading uppercase"
                            : "px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-md"
                        )}
                      >
                        {unlinkingId === account.id ? (
                          classes.isRetro ? (
                            <span className="animate-pulse">...</span>
                          ) : (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )
                        ) : (
                          <Unlink className={cn(classes.isRetro ? "w-3 h-3" : "w-4 h-4")} />
                        )}
                        {t('unlinkAccount')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={cn(
                  "mb-4 text-muted-foreground",
                  classes.isRetro ? "text-xs retro-body" : "text-sm"
                )}>
                  {t('noLinkedAccounts')}
                </p>
              )}

              {/* Link new account buttons */}
              <div className="flex flex-wrap gap-2">
                {availableProviders.includes('google') && !oauthAccounts.find(a => a.provider === 'google') && (
                  <button
                    type="button"
                    onClick={() => handleLinkAccount('google')}
                    className={cn(
                      "flex items-center gap-2 bg-background hover:bg-muted transition-colors",
                      classes.isRetro
                        ? "px-3 py-2 border-4 border-border retro-heading"
                        : "px-4 py-2 border border-border rounded-md"
                    )}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {classes.isRetro ? "+ Google" : <span className="text-sm">{t('linkAccount')} Google</span>}
                  </button>
                )}
                {availableProviders.includes('github') && !oauthAccounts.find(a => a.provider === 'github') && (
                  <button
                    type="button"
                    onClick={() => handleLinkAccount('github')}
                    className={cn(
                      "flex items-center gap-2 bg-background hover:bg-muted transition-colors",
                      classes.isRetro
                        ? "px-3 py-2 border-4 border-border retro-heading"
                        : "px-4 py-2 border border-border rounded-md"
                    )}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    {classes.isRetro ? "+ GitHub" : <span className="text-sm">{t('linkAccount')} GitHub</span>}
                  </button>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
