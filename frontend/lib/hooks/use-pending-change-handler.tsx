import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";

export interface PendingChangeResponse {
  pending_change_id?: string;
}

export interface UsePendingChangeHandlerOptions {
  entityType: string;
  action: "create" | "update" | "delete";
  onSuccess?: () => void;
  successMessage?: string;
  successDescription?: string;
}

/**
 * Hook to handle form submissions that may return 202 (pending approval)
 * or 200/201 (immediately applied).
 *
 * Usage:
 * ```tsx
 * const { handleResponse } = usePendingChangeHandler({
 *   entityType: "item",
 *   action: "create",
 *   onSuccess: () => router.push("/dashboard/items")
 * });
 *
 * const response = await itemsApi.create(workspaceId, data);
 * handleResponse(response, 201); // or 202 if pending
 * ```
 */
export function usePendingChangeHandler(options: UsePendingChangeHandlerOptions) {
  const t = useTranslations("pendingChange.toast");
  const router = useRouter();

  const handleResponse = (
    response: any,
    statusCode: number,
    customPendingMessage?: string
  ) => {
    if (statusCode === 202) {
      // Change is pending approval
      const pendingChangeId = response?.pending_change_id;

      toast.info(
        customPendingMessage || t("pendingTitle"),
        {
          description: t("submittedDescription", {
            action: options.action,
            entityType: options.entityType,
          }),
          action: {
            label: "View My Changes",
            onClick: () => router.push("/dashboard/my-changes"),
          },
          duration: 6000,
        }
      );

      // Store the pending change ID if needed
      return {
        isPending: true,
        pendingChangeId,
      };
    } else {
      // Change was applied immediately (201 Created or 200 OK)
      toast.success(
        options.successMessage || "Success",
        {
          description: options.successDescription || "Your change has been saved.",
        }
      );

      // Call the success callback
      if (options.onSuccess) {
        options.onSuccess();
      }

      return {
        isPending: false,
      };
    }
  };

  return {
    handleResponse,
  };
}

/**
 * Component that shows a banner when a change is pending approval.
 * Show this after a form submission that returned 202.
 */
export function PendingChangeBanner({ pendingChangeId }: { pendingChangeId?: string }) {
  const t = useTranslations("pendingChange.banner");
  const router = useRouter();

  if (!pendingChangeId) return null;

  return (
    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
          <svg
            className="h-5 w-5 text-yellow-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
            {t("title")}
          </h3>
          <p className="mt-1 text-sm text-yellow-800 dark:text-yellow-200">
            {t("description")}
          </p>
          <button
            onClick={() => router.push("/dashboard/my-changes")}
            className="mt-2 text-sm font-medium text-yellow-900 underline dark:text-yellow-100 hover:no-underline"
          >
            {t("viewChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
