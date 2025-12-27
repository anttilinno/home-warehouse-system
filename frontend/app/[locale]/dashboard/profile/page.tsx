"use client";

import { useState, useEffect } from "react";
import { User, Save, Lock, Mail, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { authApi, User as UserType } from "@/lib/api";
import { useTranslations } from "next-intl";
import { formatDate as formatDateUtil } from "@/lib/date-utils";

export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading, user: authUser } = useAuth();
  const t = useTranslations('profile');

  const [profile, setProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dateFormat, setDateFormat] = useState("DD.MM.YYYY HH:mm");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await authApi.getProfile();
      setProfile(data);
      setFullName(data.full_name || "");
      setEmail(data.email);
      setDateFormat(data.date_format || "DD.MM.YYYY HH:mm");
      setError(null);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const updated = await authApi.updateProfile({
        full_name: fullName || null,
        email: email !== profile?.email ? email : undefined,
        date_format: dateFormat,
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
          localStorage.setItem('user', JSON.stringify(userData));
        }
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
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
    } catch (err) {
      console.error('Failed to change password:', err);
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Profile Information */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">
                {profile?.full_name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {profile?.full_name}
              </h2>
              <p className="text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{t('memberSince')} {profile?.created_at ? formatDate(profile.created_at) : '-'}</span>
          </div>
        </div>

        {/* Edit Profile Form */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('editProfile')}
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 text-green-600 rounded-md text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('fullName')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('fullNamePlaceholder')}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('dateTimeFormat')}
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="DD.MM.YYYY HH:mm">DD.MM.YYYY HH:mm (31.12.2024 14:30)</option>
                  <option value="MM/DD/YYYY h:mm A">MM/DD/YYYY h:mm A (12/31/2024 2:30 PM)</option>
                  <option value="YYYY-MM-DD HH:mm">YYYY-MM-DD HH:mm (2024-12-31 14:30)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t('saving') : t('saveChanges')}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {t('changePassword')}
          </h3>

          {passwordError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="mb-4 p-3 bg-green-500/10 text-green-600 rounded-md text-sm">
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('currentPassword')}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('newPassword')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('confirmPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              {changingPassword ? t('changing') : t('changePasswordButton')}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
