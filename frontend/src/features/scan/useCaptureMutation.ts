import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { MK } from "@/lib/offline/mutationKeys";
import { newIdemKey } from "@/lib/offline/idempotency";
import { putCapturePhoto } from "@/lib/offline/photoStore";
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
  code: string;
  body: Record<string, unknown>;
  photo?: File;
}

export function useCaptureMutation() {
  const { currentWorkspaceId } = useWorkspace();
  const wsId = currentWorkspaceId ?? "";
  const { t } = useLingui();
  const queryClient = useQueryClient();
  // Codes whose photo write has started but whose mutation has not been fired
  // yet — the gap the mutation-cache check cannot cover.
  const awaitingPhoto = useRef(new Set<string>());

  const mutation = useMutation<unknown, Error, CaptureVars>({
    mutationKey: MK.captureCreate,
    onSuccess: () => retroToast.success(t`Captured.`),
  });
  const fire = mutation.mutate;

  /**
   * Queues one capture. Returns false — having queued nothing — when the same
   * label is already waiting to be written.
   *
   * Offline that is the ONLY duplicate check there is: resolution needs the
   * network, so a second scan of a label looks exactly like a first one and
   * would queue a second create. Both then drain, and the second dies on a
   * short-code conflict. Online the same check costs nothing and closes the
   * narrower double-tap window before the first create resolves.
   */
  function capture(req: CaptureRequest): boolean {
    const alreadyQueued = queryClient
      .getMutationCache()
      .findAll({ mutationKey: MK.captureCreate, status: "pending" })
      .some(
        (m) =>
          (m.state.variables as CaptureVars | undefined)?.code === req.code,
      );
    // …plus the codes whose photo is still being written to idb. Those have no
    // mutation in the cache yet, so the check above cannot see them.
    if (alreadyQueued || awaitingPhoto.current.has(req.code)) return false;

    // One id for the whole capture: it is the server-side Idempotency-Key AND
    // the idb key its photo is filed under (a capture carries at most one).
    const idemKey = newIdemKey();
    const vars: CaptureVars = {
      wsId,
      idemKey,
      kind: req.kind,
      code: req.code,
      body: req.body,
    };

    if (!req.photo) {
      fire(vars);
      return true;
    }

    // The bytes have to be in idb BEFORE the mutation can run, so this fires
    // on the write — a few ms later, invisible to the loop, which has already
    // advanced. If the write fails, still create the entity without the photo:
    // losing the photo beats losing the capture.
    awaitingPhoto.current.add(req.code);
    const fireOnce = (v: CaptureVars) => {
      fire(v);
      awaitingPhoto.current.delete(req.code);
    };
    void putCapturePhoto(idemKey, req.photo).then(
      () => fireOnce({ ...vars, photoId: idemKey }),
      () => fireOnce(vars),
    );
    return true;
  }

  return { capture, mutation };
}
