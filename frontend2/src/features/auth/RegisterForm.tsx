import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "./AuthContext";

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

  const inputClass =
    "w-full h-[40px] border-retro-thick border-retro-ink bg-retro-cream font-mono text-[14px] text-retro-ink placeholder:text-retro-gray pl-[40px] pr-sm outline-2 outline-offset-2 outline-transparent focus:outline-retro-amber";

  const PersonIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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
      <path
        d="M2 5l8 5 8-5"
        stroke="#1A1A1A"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );

  const LockIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
      <div>
        <label htmlFor="register-name" className="sr-only">
          {t`Full name`}
        </label>
        <div className="relative">
          <span className="absolute left-sm top-1/2 -translate-y-1/2 pointer-events-none">
            <PersonIcon />
          </span>
          <input
            id="register-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t`FULL NAME`}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="register-email" className="sr-only">
          {t`Email`}
        </label>
        <div className="relative">
          <span className="absolute left-sm top-1/2 -translate-y-1/2 pointer-events-none">
            <EnvelopeIcon />
          </span>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t`EMAIL ADDRESS`}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="register-password" className="sr-only">
          {t`Password`}
        </label>
        <div className="relative">
          <span className="absolute left-sm top-1/2 -translate-y-1/2 pointer-events-none">
            <LockIcon />
          </span>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t`PASSWORD`}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="register-confirm-password" className="sr-only">
          {t`Confirm password`}
        </label>
        <div className="relative">
          <span className="absolute left-sm top-1/2 -translate-y-1/2 pointer-events-none">
            <LockIcon />
          </span>
          <input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t`CONFIRM PASSWORD`}
            required
            className={inputClass}
          />
        </div>
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

      <button
        type="submit"
        disabled={isSubmitting}
        aria-disabled={isSubmitting}
        className={`w-full h-[44px] border-retro-thick border-retro-ink text-[14px] font-bold uppercase ${
          isSubmitting
            ? "bg-retro-gray text-retro-gray cursor-not-allowed"
            : "bg-retro-cream text-retro-ink shadow-retro-raised hover:bg-retro-amber hover:cursor-pointer active:shadow-retro-pressed"
        }`}
      >
        {isSubmitting ? t`PROCESSING...` : t`CREATE ACCOUNT`}
      </button>
    </form>
  );
}
