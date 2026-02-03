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
import { toast } from "sonner";

export function PasswordChange() {
  const t = useTranslations("settings.security.password");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordSchema = z
    .object({
      current_password: z.string().min(1, t("currentPassword")),
      new_password: z.string().min(8, t("validationMinLength")),
      confirm_password: z.string(),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: t("validationMismatch"),
      path: ["confirm_password"],
    });

  type PasswordFormValues = z.infer<typeof passwordSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await authApi.changePassword(data.current_password, data.new_password);
      reset();
      toast.success(t("successMessage"));
    } catch (error: unknown) {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

      <div className="space-y-2">
        <Label htmlFor="new_password">{t("newPassword")}</Label>
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
        <Label htmlFor="confirm_password">{t("confirmPassword")}</Label>
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
        {t("changeButton")}
      </Button>
    </form>
  );
}
