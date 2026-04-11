import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import {
  RetroPanel,
  RetroButton,
  RetroInput,
  useToast,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { patch, del } from "@/lib/api";
import type { User } from "@/lib/types";

export function ProfilePage() {
  const { t } = useLingui();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    setAvatarLoading(true);
    try {
      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
        // DO NOT set Content-Type header — browser sets it with boundary
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await refreshUser();
      addToast(t`AVATAR UPLOADED`, "success");
    } catch {
      addToast(t`Failed to upload avatar`, "error");
    } finally {
      setAvatarLoading(false);
    }
    // Reset file input so same file can be re-selected
    e.target.value = "";
  };

  const handleAvatarRemove = async () => {
    setAvatarLoading(true);
    try {
      await del("/users/me/avatar");
      await refreshUser();
      addToast(t`AVATAR REMOVED`, "success");
    } catch {
      addToast(t`Failed to remove avatar`, "error");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSave = async () => {
    setEmailError(undefined);
    setSaving(true);
    try {
      await patch<User>("/users/me", { full_name: name, email });
      await refreshUser();
      addToast(t`CHANGES SAVED`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("409") || message.toLowerCase().includes("email")) {
        setEmailError(t`Email already in use`);
      } else {
        addToast(
          t`Failed to save changes. Check your connection and try again.`,
          "error"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.full_name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-md">
      <RetroButton variant="neutral" onClick={() => navigate("/settings")}>
        {t`BACK`}
      </RetroButton>
      <RetroPanel showHazardStripe title={t`PROFILE`}>
        <div className="flex flex-col gap-md">
          {/* Avatar section */}
          <div className="flex flex-col gap-sm items-start">
            <div className="w-[80px] h-[80px] border-retro-thick border-retro-ink overflow-hidden">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="User avatar"
                  className="object-cover w-full h-full"
                />
              ) : (
                <div
                  aria-label="User avatar"
                  className="bg-retro-charcoal text-retro-cream font-bold text-[32px] uppercase flex items-center justify-center w-full h-full"
                >
                  {initials}
                </div>
              )}
            </div>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload avatar image"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div className="flex gap-sm mt-md">
              <RetroButton
                variant="primary"
                disabled={avatarLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                {t`UPLOAD`}
              </RetroButton>
              {user?.avatar_url && (
                <RetroButton
                  variant="danger"
                  disabled={avatarLoading}
                  onClick={handleAvatarRemove}
                >
                  {t`REMOVE`}
                </RetroButton>
              )}
            </div>
          </div>

          {/* Name field */}
          <div className="flex flex-col gap-md">
            <div>
              <label
                htmlFor="profile-name"
                className="font-bold uppercase text-[14px] text-retro-ink mb-xs block"
              >
                {t`NAME`}
              </label>
              <RetroInput
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Email field */}
            <div>
              <label
                htmlFor="profile-email"
                className="font-bold uppercase text-[14px] text-retro-ink mb-xs block"
              >
                {t`EMAIL`}
              </label>
              <RetroInput
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(undefined);
                }}
                error={emailError}
              />
            </div>
          </div>

          {/* Save button */}
          <RetroButton
            variant="primary"
            className="w-full mt-md"
            disabled={saving}
            onClick={handleSave}
          >
            {t`SAVE CHANGES`}
          </RetroButton>
        </div>
      </RetroPanel>
    </div>
  );
}
