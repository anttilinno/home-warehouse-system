import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "./AuthContext";
import { RetroButton, RetroInput } from "@/components/retro";

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

export function LoginForm() {
  const { t } = useLingui();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("seeder@test.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);
      const from =
        (location.state as { from?: { pathname: string } })?.from?.pathname ||
        "/";
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : "";
      if (message.includes("401") || message.includes("invalid")) {
        setError(
          t`Invalid email or password. Check your credentials and try again.`
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
        <label htmlFor="login-email" className="sr-only">
          {t`Email`}
        </label>
        <RetroInput
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t`EMAIL ADDRESS`}
          required
          icon={<EnvelopeIcon />}
        />
      </div>

      <div>
        <label htmlFor="login-password" className="sr-only">
          {t`Password`}
        </label>
        <RetroInput
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t`PASSWORD`}
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

      <RetroButton type="submit" variant="primary" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t`PROCESSING...` : t`LOG IN`}
      </RetroButton>
    </form>
  );
}
