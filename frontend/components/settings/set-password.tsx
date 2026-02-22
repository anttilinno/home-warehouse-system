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

export function SetPassword() {
  const t = useTranslations("settings.security.password");
  const { refreshUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordSchema = z
    .object({
      new_password: z.string().min(8, t("validationMinLength")),
      confirm_password: z.string(),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: t("validationMismatch"),
      path: ["confirm_password"],
    });

  type SetPasswordFormValues = z.infer<typeof passwordSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = async (data: SetPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await authApi.setPassword(data.new_password);
      reset();
      await refreshUser();
      toast.success(t("setSuccessMessage"));
    } catch {
      toast.error(t("errorFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("noPasswordSet")}
      </p>

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
        {t("setButton")}
      </Button>
    </form>
  );
}
