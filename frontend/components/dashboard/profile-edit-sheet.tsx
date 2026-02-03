"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
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
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { toast } from "sonner";

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditSheet({ open, onOpenChange }: ProfileEditSheetProps) {
  const t = useTranslations("settings.account");
  const { user, refreshUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Reset form when user data changes or sheet opens
  useEffect(() => {
    if (user && open) {
      reset({
        full_name: user.full_name,
        email: user.email,
      });
    }
  }, [user, open, reset]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-6 px-4 overflow-y-auto">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
