"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { toast } from "sonner";

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const createPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      current_password: z.string().min(1, t("currentPassword")),
      new_password: z.string().min(8, t("validationMinLength")),
      confirm_password: z.string(),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: t("validationMismatch"),
      path: ["confirm_password"],
    });

type PasswordFormValues = z.infer<ReturnType<typeof createPasswordSchema>>;

interface ProfileEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditSheet({ open, onOpenChange }: ProfileEditSheetProps) {
  const t = useTranslations("settings.account");
  const tPassword = useTranslations("settings.security.password");
  const { user, refreshUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || "",
      email: user?.email || "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isDirty: isPasswordDirty },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(createPasswordSchema(tPassword)),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  // Reset forms when user data changes or sheet opens
  useEffect(() => {
    if (user && open) {
      reset({
        full_name: user.full_name,
        email: user.email,
      });
      resetPassword({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    }
  }, [user, open, reset, resetPassword]);

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      await authApi.updateProfile(data);
      await refreshUser();
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsPasswordSubmitting(true);
    try {
      await authApi.changePassword(data.current_password, data.new_password);
      resetPassword();
      toast.success(tPassword("successMessage"));
    } catch (error: unknown) {
      // Check for 400 status indicating incorrect current password
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 400
      ) {
        toast.error(tPassword("errorIncorrect"));
      } else {
        toast.error(tPassword("errorFailed"));
      }
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-6 px-4 overflow-y-auto max-h-[calc(100vh-100px)]">
          {/* Avatar Upload Section */}
          <div className="flex justify-center">
            <AvatarUpload />
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">{t("fullName")}</Label>
              <Input
                id="full_name"
                {...register("full_name")}
                className={errors.full_name ? "border-destructive min-h-[44px]" : "min-h-[44px]"}
                disabled={isSubmitting}
              />
              {errors.full_name && (
                <p className="text-sm text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                className={errors.email ? "border-destructive min-h-[44px]" : "min-h-[44px]"}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </form>

          <Separator />

          {/* Password Change Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {tPassword("title")}
            </h3>
            <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">{tPassword("currentPassword")}</Label>
                <Input
                  id="current_password"
                  type="password"
                  autoComplete="current-password"
                  {...registerPassword("current_password")}
                  className={
                    passwordErrors.current_password
                      ? "border-destructive min-h-[44px]"
                      : "min-h-[44px]"
                  }
                  disabled={isPasswordSubmitting}
                />
                {passwordErrors.current_password && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.current_password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password">{tPassword("newPassword")}</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  {...registerPassword("new_password")}
                  className={
                    passwordErrors.new_password
                      ? "border-destructive min-h-[44px]"
                      : "min-h-[44px]"
                  }
                  disabled={isPasswordSubmitting}
                />
                {passwordErrors.new_password && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.new_password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">{tPassword("confirmPassword")}</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  {...registerPassword("confirm_password")}
                  className={
                    passwordErrors.confirm_password
                      ? "border-destructive min-h-[44px]"
                      : "min-h-[44px]"
                  }
                  disabled={isPasswordSubmitting}
                />
                {passwordErrors.confirm_password && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.confirm_password.message}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={isPasswordSubmitting || !isPasswordDirty} className="w-full">
                {isPasswordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tPassword("changeButton")}
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
