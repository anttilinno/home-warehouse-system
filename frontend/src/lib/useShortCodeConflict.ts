import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { HttpError } from "@/lib/api";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { shortCodesApi, shortCodeEntityPath } from "@/lib/api/shortCodes";
import { formErrorMessage } from "@/lib/formError";

// A create rejected for a duplicate short code used to say only "short code
// already exists" — true, unhelpful, and a dead end when the label in your hand
// is already stuck to something. This resolves the code against the registry
// and answers with the owner's name plus a way to open it.
//
// Both the mutation's own error toast and the enriched one share
// SHORT_CODE_CONFLICT_TOAST_ID, so sonner REPLACES the generic toast instead of
// stacking a second one (the mutation's onError fires first; the enrichment
// needs a round trip).

export const SHORT_CODE_CONFLICT_TOAST_ID = "short-code-conflict";

/** Backend copy: "short code already exists" (+ " in workspace" for items). */
export function isShortCodeConflict(err: unknown): boolean {
  return (
    err instanceof HttpError &&
    err.status === 400 &&
    /short code already exists/i.test(err.message)
  );
}

/**
 * Returns the message to show in the form's error banner. On a short-code
 * conflict it also fires a toast carrying an OPEN action pointing at the
 * entity that already holds the code.
 */
export function useShortCodeConflict() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const navigate = useNavigate();
  const { t } = useLingui();

  return useCallback(
    async (
      err: unknown,
      code: string | undefined,
      fallback: string,
    ): Promise<string> => {
      const message = formErrorMessage(err, fallback);
      if (!isShortCodeConflict(err) || !code || !wsId) return message;

      // A failed resolve (offline, 500) must not mask the original conflict —
      // fall through to the plain message.
      const match = await shortCodesApi.resolve(wsId, code).catch(() => null);
      if (!match) return message;

      const enriched = t`Short code ${code} is already used by ${match.name}.`;
      retroToast.error(enriched, {
        id: SHORT_CODE_CONFLICT_TOAST_ID,
        action: {
          label: t`OPEN`,
          onClick: () => navigate(shortCodeEntityPath(match)),
        },
      });
      return enriched;
    },
    [wsId, navigate, t],
  );
}
