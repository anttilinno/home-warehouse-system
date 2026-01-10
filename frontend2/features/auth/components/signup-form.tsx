"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signupSchema = z
  .object({
    fullName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

function PasswordRequirement({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <X className="h-3 w-3 text-muted-foreground" />
      )}
      <span className={met ? "text-green-500" : "text-muted-foreground"}>
        {children}
      </span>
    </div>
  );
}

export function SignupForm() {
  const t = useTranslations("auth");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const password = watch("password", "");

  const passwordRequirements = [
    { met: password.length >= 8, label: t("passwordMin8") },
    { met: /[A-Z]/.test(password), label: t("passwordUppercase") },
    { met: /[a-z]/.test(password), label: t("passwordLowercase") },
    { met: /[0-9]/.test(password), label: t("passwordNumber") },
  ];

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    // TODO: Implement actual signup
    console.log("Signup:", data);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t("fullName")}</Label>
        <Input
          id="fullName"
          type="text"
          placeholder={t("fullNamePlaceholder")}
          autoComplete="name"
          disabled={isLoading}
          {...register("fullName")}
        />
        {errors.fullName && (
          <p className="text-sm text-destructive">{t("fullNameRequired")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("emailPlaceholder")}
          autoComplete="email"
          disabled={isLoading}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{t("invalidEmail")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("createPasswordPlaceholder")}
            autoComplete="new-password"
            disabled={isLoading}
            {...register("password")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        <div className="space-y-1 pt-1">
          {passwordRequirements.map((req, i) => (
            <PasswordRequirement key={i} met={req.met}>
              {req.label}
            </PasswordRequirement>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder={t("confirmPasswordPlaceholder")}
          autoComplete="new-password"
          disabled={isLoading}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{t("passwordsNoMatch")}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("createAccount")}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {t("agreeToTerms")}{" "}
        <a href="/terms" className="text-primary hover:underline">
          {t("termsOfService")}
        </a>{" "}
        {t("and")}{" "}
        <a href="/privacy" className="text-primary hover:underline">
          {t("privacyPolicy")}
        </a>
      </p>
    </form>
  );
}
