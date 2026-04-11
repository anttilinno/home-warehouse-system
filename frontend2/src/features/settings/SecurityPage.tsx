import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import {
  RetroPanel,
  RetroButton,
  RetroInput,
  RetroBadge,
  HazardStripe,
  RetroDialog,
  useToast,
  type RetroDialogHandle,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { get, patch, del } from "@/lib/api";
import type { Session, OAuthAccount } from "@/lib/types";

const KNOWN_PROVIDERS = ["google", "github"];

export function SecurityPage() {
  const { t } = useLingui();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();

  // --- Password section ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>(
    undefined
  );
  const [newPasswordError, setNewPasswordError] = useState<string | undefined>(
    undefined
  );
  const [savingPassword, setSavingPassword] = useState(false);

  const handlePasswordUpdate = async () => {
    setPasswordError(undefined);
    setNewPasswordError(undefined);
    setSavingPassword(true);
    try {
      const body: Record<string, string> = { new_password: newPassword };
      if (user?.has_password) {
        body.current_password = currentPassword;
      }
      await patch("/users/me/password", body);
      addToast(t`PASSWORD UPDATED`, "success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.includes("400") ||
        message.toLowerCase().includes("incorrect") ||
        message.toLowerCase().includes("wrong")
      ) {
        setPasswordError(t`Current password is incorrect`);
      } else if (
        message.toLowerCase().includes("complexity") ||
        message.toLowerCase().includes("length") ||
        message.toLowerCase().includes("requirement")
      ) {
        setNewPasswordError(t`Password does not meet requirements`);
      } else {
        addToast(t`Failed to update password`, "error");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  // --- Sessions section ---
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const data = await get<Session[]>("/users/me/sessions");
      setSessions(data);
    } catch {
      addToast(t`Failed to load sessions.`, "error");
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await del(`/users/me/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      addToast(t`SESSION REVOKED`, "success");
    } catch {
      addToast(t`Failed to revoke session`, "error");
    }
  };

  const handleRevokeAllOthers = async () => {
    try {
      await del("/users/me/sessions");
      await fetchSessions();
      addToast(t`OTHER SESSIONS REVOKED`, "success");
    } catch {
      addToast(t`Failed to revoke sessions`, "error");
    }
  };

  // --- Connected accounts section ---
  const [accounts, setAccounts] = useState<OAuthAccount[]>([]);

  const fetchAccounts = async () => {
    try {
      const data = await get<{ accounts: OAuthAccount[] }>("/auth/oauth/accounts");
      setAccounts(data.accounts ?? []);
    } catch {
      addToast(t`Failed to load connected accounts.`, "error");
    }
  };

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlink = async (provider: string) => {
    try {
      await del(`/auth/oauth/accounts/${provider}`);
      await fetchAccounts();
      await refreshUser();
      addToast(t`ACCOUNT UNLINKED`, "success");
    } catch {
      addToast(t`Failed to unlink account`, "error");
    }
  };

  const handleLinkProvider = (provider: string) => {
    window.location.href = `/api/auth/oauth/${provider}?action=link`;
  };

  // --- Account deletion section ---
  const deleteDialogRef = useRef<RetroDialogHandle>(null);

  const handleDeleteAccount = async () => {
    try {
      await del("/users/me");
      await logout();
    } catch {
      addToast(t`Failed to delete account`, "error");
    }
  };

  const isUnlinkDisabled =
    accounts.length <= 1 && !user?.has_password;

  return (
    <div className="max-w-[600px] mx-auto p-lg flex flex-col gap-md">
      <RetroButton variant="neutral" onClick={() => navigate("/settings")}>
        {t`BACK`}
      </RetroButton>
      <RetroPanel showHazardStripe title={t`SECURITY`}>
        <div className="flex flex-col gap-lg">
          {/* Section 1: Change / Set Password */}
          <div>
            <h3 className="font-bold uppercase text-[14px] text-retro-ink mb-md">
              {user?.has_password ? t`CHANGE PASSWORD` : t`SET PASSWORD`}
            </h3>
            <div className="flex flex-col gap-md">
              {user?.has_password && (
                <div>
                  <label
                    htmlFor="current-password"
                    className="font-bold uppercase text-[14px] text-retro-ink mb-xs block"
                  >
                    {t`CURRENT PASSWORD`}
                  </label>
                  <RetroInput
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPasswordError(undefined);
                    }}
                    error={passwordError}
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="new-password"
                  className="font-bold uppercase text-[14px] text-retro-ink mb-xs block"
                >
                  {t`NEW PASSWORD`}
                </label>
                <RetroInput
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setNewPasswordError(undefined);
                  }}
                  error={newPasswordError}
                />
              </div>
              <RetroButton
                variant="primary"
                disabled={savingPassword}
                onClick={handlePasswordUpdate}
              >
                {user?.has_password ? t`UPDATE PASSWORD` : t`SET PASSWORD`}
              </RetroButton>
            </div>
          </div>

          <HazardStripe />

          {/* Section 2: Active Sessions */}
          <div>
            <h3 className="font-bold uppercase text-[14px] text-retro-ink mb-md">
              {t`ACTIVE SESSIONS`}
            </h3>
            {sessionsLoading ? (
              <p className="font-mono text-[14px] text-retro-gray">
                {t`Loading...`}
              </p>
            ) : (
              <div className="flex flex-col gap-sm">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="border-retro-thick border-retro-ink bg-retro-cream p-sm flex items-center justify-between"
                  >
                    <div>
                      <p className="font-mono text-[14px] text-retro-ink">
                        {session.device_info}
                      </p>
                      <p className="text-retro-gray text-[14px] font-mono">
                        {session.ip_address && `${session.ip_address} · `}
                        {session.last_active_at}
                      </p>
                    </div>
                    <div>
                      {session.is_current ? (
                        <RetroBadge variant="success">{t`CURRENT`}</RetroBadge>
                      ) : (
                        <RetroButton
                          variant="danger"
                          onClick={() => handleRevokeSession(session.id)}
                        >
                          {t`REVOKE`}
                        </RetroButton>
                      )}
                    </div>
                  </div>
                ))}
                <RetroButton variant="danger" onClick={handleRevokeAllOthers}>
                  {t`REVOKE ALL OTHERS`}
                </RetroButton>
              </div>
            )}
          </div>

          <HazardStripe />

          {/* Section 3: Connected Accounts */}
          <div>
            <h3 className="font-bold uppercase text-[14px] text-retro-ink mb-md">
              {t`CONNECTED ACCOUNTS`}
            </h3>
            <div className="flex flex-col gap-sm">
              {KNOWN_PROVIDERS.map((provider) => {
                const linked = accounts.find(
                  (a) => a.provider === provider
                );
                if (linked) {
                  return (
                    <div
                      key={provider}
                      className="border-retro-thick border-retro-ink bg-retro-cream p-sm flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold uppercase text-[14px] text-retro-ink">
                          {provider}
                        </p>
                        {linked.email && (
                          <p className="text-retro-gray text-[14px] font-mono">
                            {linked.email}
                          </p>
                        )}
                      </div>
                      <RetroButton
                        variant="danger"
                        disabled={isUnlinkDisabled}
                        onClick={() => handleUnlink(provider)}
                        title={
                          isUnlinkDisabled
                            ? t`Cannot unlink last auth method`
                            : undefined
                        }
                      >
                        {t`UNLINK`}
                      </RetroButton>
                    </div>
                  );
                }
                return (
                  <RetroButton
                    key={provider}
                    variant="neutral"
                    onClick={() => handleLinkProvider(provider)}
                  >
                    {t`LINK`} {provider.toUpperCase()}
                  </RetroButton>
                );
              })}
            </div>
          </div>

          <HazardStripe />

          {/* Section 4: Account Deletion */}
          <div>
            <RetroButton
              variant="danger"
              onClick={() => deleteDialogRef.current?.open()}
            >
              {t`DELETE ACCOUNT`}
            </RetroButton>
          </div>
        </div>
      </RetroPanel>

      <RetroDialog ref={deleteDialogRef}>
        <p className="font-mono text-[14px] text-retro-ink">
          {t`This will permanently delete your account and all associated data. This action cannot be undone.`}
        </p>
        <div className="flex gap-sm mt-md">
          <RetroButton variant="danger" onClick={handleDeleteAccount}>
            {t`CONFIRM DELETE`}
          </RetroButton>
          <RetroButton
            variant="neutral"
            onClick={() => deleteDialogRef.current?.close()}
          >
            {t`KEEP ACCOUNT`}
          </RetroButton>
        </div>
      </RetroDialog>
    </div>
  );
}
