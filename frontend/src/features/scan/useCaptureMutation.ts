import { useMutation } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { MK } from "@/lib/offline/mutationKeys";
import { newIdemKey } from "@/lib/offline/idempotency";
import type { CaptureVars } from "@/lib/offline/mutationDefaults";

// The /capture write. No mutationFn here — it lives in the centrally-registered
// default (mutationDefaults.ts) so a capture queued offline still has a request
// to run after a reload, exactly like the other offline creates.
//
// `capture()` FIRES and returns immediately rather than awaiting: offline the
// mutation pauses (networkMode "online"), so an await would never resolve and
// the scanning loop would stall on one label. The success/failure toast is the
// feedback instead, including the replay-failure toast in the registered
// default when a queued capture drains badly.

export interface CaptureRequest {
  kind: "item" | "location";
  body: Record<string, unknown>;
  photo?: File;
}

export function useCaptureMutation() {
  const { currentWorkspaceId } = useWorkspace();
  const wsId = currentWorkspaceId ?? "";
  const { t } = useLingui();

  const mutation = useMutation<unknown, Error, CaptureVars>({
    mutationKey: MK.captureCreate,
    onSuccess: () => retroToast.success(t`Captured.`),
  });
  const fire = mutation.mutate;

  function capture(req: CaptureRequest): void {
    fire({
      wsId,
      idemKey: newIdemKey(),
      kind: req.kind,
      body: req.body,
      photo: req.photo,
    });
  }

  return { capture, mutation };
}
