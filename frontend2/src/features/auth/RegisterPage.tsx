import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { post, setRefreshToken } from "@/lib/api";
import type { AuthTokenResponse } from "@/lib/types";
import { BrandMark } from "@/components/BrandMark";
import {
  BevelButton,
  RetroInput,
  Window,
  retroToast,
} from "@/components/retro";
import { SocialLoginButtons } from "./SocialLoginButtons";

// Register form (AUTH-02, 05-UI-SPEC §2). Mirrors the LoginPage chrome — a
// second centered Window (CREATE ACCOUNT) on the cream desktop — composing the
// same RetroInput + BevelButton + Window atoms. zod v4 idioms (top-level
// z.email(), Pitfall 7); confirm-password matches via .refine.

const registerSchema = z
  .object({
    full_name: z.string().min(1),
    email: z.email(),
    password: z.string().min(8),
    confirm: z.string().min(1),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "mismatch",
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useLingui();
  const [emailTaken, setEmailTaken] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setEmailTaken(false);
    try {
      const data = await post<AuthTokenResponse>("/auth/register", {
        email: values.email,
        full_name: values.full_name,
        password: values.password,
      });
      setRefreshToken(data.refresh_token);
      retroToast.success(t`Account created — welcome.`);
      navigate("/");
    } catch {
      // Duplicate email (or other 4xx) → surface the conflict band.
      setEmailTaken(true);
    }
  });

  return (
    <main className="grid min-h-screen place-items-center p-sp-4">
      <Window
        title={<Trans>Create account</Trans>}
        className="w-full max-w-[400px]"
        bodyClassName="grid gap-sp-4 p-sp-5"
      >
        <div className="text-center">
          <BrandMark />
          <div className="mt-sp-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
            <Trans>home inventory terminal · v3.0</Trans>
          </div>
        </div>

        {emailTaken && (
          <p
            role="alert"
            className="border-2 border-danger bg-danger-bg px-sp-3 py-sp-2 text-[13px] font-semibold text-danger"
          >
            <Trans>That email is already registered.</Trans>{" "}
            <Link
              to="/login"
              className="underline underline-offset-2 hover:no-underline"
            >
              <Trans>Log in</Trans>
            </Link>
          </p>
        )}

        <form onSubmit={onSubmit} className="grid gap-sp-4" noValidate>
          <RetroInput
            label={<Trans>Full name</Trans>}
            type="text"
            autoComplete="name"
            error={errors.full_name && t`Enter your name.`}
            {...register("full_name")}
          />
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
            autoComplete="new-password"
            error={errors.password && t`Use at least 8 characters.`}
            {...register("password")}
          />
          {!errors.password && (
            <p className="-mt-sp-2 text-[12px] text-fg-muted">
              <Trans>At least 8 characters.</Trans>
            </p>
          )}
          <RetroInput
            label={<Trans>Confirm password</Trans>}
            type="password"
            mono
            autoComplete="new-password"
            error={errors.confirm && t`Passwords don't match.`}
            {...register("confirm")}
          />
          <BevelButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="justify-center py-[9px]"
          >
            <Trans>Create account</Trans>
          </BevelButton>
        </form>

        <div
          aria-hidden="true"
          className="flex items-center gap-sp-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted"
        >
          <span className="h-px flex-1 border-t border-dotted border-fg-faint" />
          <Trans>OR</Trans>
          <span className="h-px flex-1 border-t border-dotted border-fg-faint" />
        </div>

        <SocialLoginButtons mode="register" />

        <p className="text-center text-[13px] text-fg-muted">
          <Trans>Already have an account?</Trans>{" "}
          <Link
            to="/login"
            className="font-semibold text-accent-blue-deep underline-offset-2 hover:underline"
          >
            <Trans>Log in</Trans>
          </Link>
        </p>
      </Window>
    </main>
  );
}
