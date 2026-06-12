import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { post, setRefreshToken } from "@/lib/api";
import type { AuthTokenResponse } from "@/lib/types";
import { BrandMark } from "@/components/BrandMark";
import { BevelButton, RetroInput, Window } from "@/components/retro";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type LoginForm = z.infer<typeof loginSchema>;

// Centered login window on the cream desktop (sketch 007). Provider-free —
// the full AuthProvider/OAuth stack is Phase 5 scope; this page only needs
// the cookie set + refresh token stored.
export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useLingui();
  const [authError, setAuthError] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setAuthError(false);
    try {
      const data = await post<AuthTokenResponse>("/auth/login", values);
      setRefreshToken(data.refresh_token);
      navigate("/");
    } catch {
      setAuthError(true);
    }
  });

  return (
    <main className="grid min-h-screen place-items-center p-sp-4">
      <Window
        title={<Trans>Log in</Trans>}
        className="w-full max-w-[400px]"
        bodyClassName="grid gap-sp-4 p-sp-5"
      >
        <div className="text-center">
          <BrandMark />

          <div className="mt-sp-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
            <Trans>home inventory terminal · v3.0</Trans>
          </div>
        </div>

        {authError && (
          <p
            role="alert"
            className="border-2 border-danger bg-danger-bg px-sp-3 py-sp-2 text-[13px] font-semibold text-danger"
          >
            <Trans>Wrong email or password. Try again.</Trans>
          </p>
        )}

        <form onSubmit={onSubmit} className="grid gap-sp-4" noValidate>
          <RetroInput
            label={<Trans>Email</Trans>}
            type="email"
            mono
            autoComplete="email"
            error={errors.email && t`Enter a valid email address.`}
            {...register("email")}
          />
          <RetroInput
            label={<Trans>Password</Trans>}
            type="password"
            mono
            autoComplete="current-password"
            error={errors.password && t`Password is required.`}
            {...register("password")}
          />
          <BevelButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="justify-center py-[9px]"
          >
            <Trans>Log in</Trans>
          </BevelButton>
        </form>
      </Window>
    </main>
  );
}
