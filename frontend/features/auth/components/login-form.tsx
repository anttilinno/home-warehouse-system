"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const email = watch("email");
  const password = watch("password");

  const isEmailValid = email && !errors.email && touchedFields.email;
  const isPasswordValid = password && !errors.password && touchedFields.password;

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      await authApi.login(data.email, data.password);

      toast.success("Login successful! Redirecting...");

      // Redirect to dashboard - don't reset loading since we're navigating
      router.push("/dashboard");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      toast.error("Login failed", {
        description: errorMessage,
      });
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            disabled={isLoading}
            className={errors.email ? "pr-10 border-destructive" : isEmailValid ? "pr-10 border-green-500" : ""}
            {...register("email")}
          />
          {touchedFields.email && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isEmailValid ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : errors.email ? (
                <X className="h-4 w-4 text-destructive" />
              ) : null}
            </div>
          )}
        </div>
        {errors.email && touchedFields.email && (
          <p className="text-sm text-destructive">{t("invalidEmail")}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("password")}</Label>
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary"
          >
            {t("forgotPassword")}
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("passwordPlaceholder")}
            autoComplete="current-password"
            disabled={isLoading}
            className={errors.password ? "pr-20 border-destructive" : isPasswordValid ? "pr-20 border-green-500" : "pr-10"}
            {...register("password")}
          />
          <div className="absolute right-0 top-0 h-full flex items-center gap-1 pr-3">
            {touchedFields.password && (
              <>
                {isPasswordValid ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : errors.password ? (
                  <X className="h-4 w-4 text-destructive" />
                ) : null}
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-full px-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
        {errors.password && touchedFields.password && (
          <p className="text-sm text-destructive">{t("passwordRequired")}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("signIn")}
      </Button>
    </form>
  );
}
