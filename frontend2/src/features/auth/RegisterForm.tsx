import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "./AuthContext";
import { RetroButton, RetroInput } from "@/components/retro";

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="7" r="3" stroke="#1A1A1A" strokeWidth="1.5" fill="none" />
    <path
      d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"
      stroke="#1A1A1A"
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
);

const EnvelopeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect
      x="2"
      y="4"
      width="16"
      height="12"
      rx="1"
      stroke="#1A1A1A"
      strokeWidth="1.5"
      fill="none"
    />
    <path d="M2 5l8 5 8-5" stroke="#1A1A1A" strokeWidth="1.5" fill="none" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect
      x="4"
      y="8"
      width="12"
      height="9"
      rx="1"
      stroke="#1A1A1A"
      strokeWidth="1.5"
      fill="none"
    />
    <path
      d="M7 8V6a3 3 0 016 0v2"
      stroke="#1A1A1A"
      strokeWidth="1.5"
      fill="none"
    />
    <circle cx="10" cy="13" r="1.5" fill="#1A1A1A" />
  </svg>
);

export function RegisterForm() {
  const { t } = useLingui();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t`Passwords do not match.`);
      return;
    }

    setIsSubmitting(true);

    try {
      await register({ email, password, full_name: name });
      navigate("/", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : "";
      if (message.includes("409") || message.includes("already exists")) {
        setError(
          t`An account with this email already exists. Try logging in instead.`
        );
      } else if (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("connection")
      ) {
        setError(
          t`Connection failed. Check your network and try again.`
        );
      } else {
        setError(t`Something went wrong. Try again in a moment.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      <div>
        <label htmlFor="register-name" className="sr-only">
          {t`Full name`}
        </label>
        <RetroInput
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t`FULL NAME`}
          required
          icon={<PersonIcon />}
        />
      </div>

      <div>
        <label htmlFor="register-email" className="sr-only">
          {t`Email`}
        </label>
        <RetroInput
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t`EMAIL ADDRESS`}
          required
          icon={<EnvelopeIcon />}
        />
      </div>

      <div>
        <label htmlFor="register-password" className="sr-only">
          {t`Password`}
        </label>
        <RetroInput
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t`PASSWORD`}
          required
          icon={<LockIcon />}
        />
      </div>

      <div>
        <label htmlFor="register-confirm-password" className="sr-only">
          {t`Confirm password`}
        </label>
        <RetroInput
          id="register-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t`CONFIRM PASSWORD`}
          required
          icon={<LockIcon />}
        />
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-retro-red text-[14px] my-sm"
        >
          {error}
        </p>
      )}

      <RetroButton type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t`PROCESSING...` : t`CREATE ACCOUNT`}
      </RetroButton>
    </form>
  );
}
