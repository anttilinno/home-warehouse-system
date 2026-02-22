"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

function PasswordChangeForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("settings.security.password");
  const tOAuth = useTranslations("auth.oauth.setPassword");
  const { refreshUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unified schema: current_password always present as string,
  // but only validated as required when hasPassword is true
  const passwordSchema = z
    .object({
      current_password: z.string(),
      new_password: z.string().min(8, t("validationMinLength")),
      confirm_password: z.string(),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: t("validationMismatch"),
      path: ["confirm_password"],
    })
    .refine(
      (data) => !hasPassword || data.current_password.length > 0,
      {
        message: t("currentPassword"),
        path: ["current_password"],
      },
    );

  type FormValues = z.infer<typeof passwordSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      if (hasPassword) {
        await authApi.changePassword(data.current_password, data.new_password);
      } else {
        await authApi.changePassword("", data.new_password);
      }
      reset();
      if (hasPassword) {
        toast.success(t("successMessage"));
      } else {
        toast.success(tOAuth("success"));
        // Refresh user to update has_password, which will remount this form
        await refreshUser();
      }
    } catch (error: unknown) {
      if (hasPassword) {
        // Check for 400 status indicating incorrect current password
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          error.status === 400
        ) {
          toast.error(t("errorIncorrect"));
        } else {
          toast.error(t("errorFailed"));
        }
      } else {
        toast.error(tOAuth("error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {!hasPassword && (
        <p className="text-sm text-muted-foreground">
          {tOAuth("description")}
        </p>
      )}

      {hasPassword && (
        <div className="space-y-2">
          <Label htmlFor="current_password">{t("currentPassword")}</Label>
          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            {...register("current_password")}
            className={
              errors.current_password
                ? "border-destructive min-h-[44px]"
                : "min-h-[44px]"
            }
            disabled={isSubmitting}
          />
          {errors.current_password && (
            <p className="text-sm text-destructive">
              {errors.current_password.message}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="new_password">
          {hasPassword ? t("newPassword") : tOAuth("newPassword")}
        </Label>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          {...register("new_password")}
          className={
            errors.new_password
              ? "border-destructive min-h-[44px]"
              : "min-h-[44px]"
          }
          disabled={isSubmitting}
        />
        {errors.new_password && (
          <p className="text-sm text-destructive">
            {errors.new_password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">
          {hasPassword ? t("confirmPassword") : tOAuth("confirmPassword")}
        </Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          {...register("confirm_password")}
          className={
            errors.confirm_password
              ? "border-destructive min-h-[44px]"
              : "min-h-[44px]"
          }
          disabled={isSubmitting}
        />
        {errors.confirm_password && (
          <p className="text-sm text-destructive">
            {errors.confirm_password.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {hasPassword ? t("changeButton") : tOAuth("setButton")}
      </Button>
    </form>
  );
}

export function PasswordChange() {
  const { user } = useAuth();
  const hasPassword = user?.has_password !== false;

  // Key on has_password so React remounts the form when state changes
  // (e.g., after OAuth-only user sets their first password)
  return <PasswordChangeForm key={String(hasPassword)} hasPassword={hasPassword} />;
}
