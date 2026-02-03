"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi, CanDeleteResponse } from "@/lib/api/auth";
import { useAuth } from "@/lib/contexts/auth-context";
import { toast } from "sonner";

export function DeleteAccountDialog() {
  const t = useTranslations("settings.dangerZone");
  const { logout } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [canDeleteData, setCanDeleteData] = useState<CanDeleteResponse | null>(
    null
  );

  const handleOpenChange = async (isOpen: boolean) => {
    if (isOpen) {
      setIsLoading(true);
      try {
        const response = await authApi.canDeleteAccount();
        setCanDeleteData(response);
      } catch {
        toast.error(t("deleteError"));
        setOpen(false);
        return;
      } finally {
        setIsLoading(false);
      }
    } else {
      setConfirmText("");
      setCanDeleteData(null);
    }
    setOpen(isOpen);
  };

  const handleDelete = async () => {
    if (confirmText.toUpperCase() !== "DELETE") return;

    setIsDeleting(true);
    try {
      await authApi.deleteAccount(confirmText);
      toast.success(t("deleted"));
      await logout();
      router.push("/");
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmDisabled =
    confirmText.toUpperCase() !== "DELETE" || isDeleting;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{t("deleteButton")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {canDeleteData?.can_delete === false
              ? t("cannotDelete")
              : t("deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
            ) : canDeleteData?.can_delete === false ? (
              <div className="space-y-3">
                <p>{t("cannotDeleteDescription")}</p>
                <ul className="list-disc pl-5 space-y-1">
                  {canDeleteData.blocking_workspaces.map((ws) => (
                    <li key={ws.id} className="font-medium">
                      {ws.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              t("deleteWarning")
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {canDeleteData?.can_delete && (
          <div className="space-y-3 py-4">
            <label
              htmlFor="confirm-delete"
              className="text-sm text-muted-foreground"
            >
              {t("typeConfirm", { word: "DELETE" })}
            </label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t("confirmPlaceholder")}
              disabled={isDeleting}
              className="min-h-[44px]"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {t("cancel")}
          </AlertDialogCancel>
          {canDeleteData?.can_delete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isConfirmDisabled}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? t("deleting") : t("confirmDelete")}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
