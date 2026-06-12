import { useContext } from "react";
import {
  WorkspaceContext,
  type WorkspaceContextValue,
} from "./WorkspaceProvider";

// useWorkspace — the D-12 consumer hook. Every workspace-scoped entity hook
// reads `currentWorkspaceId` here and includes it in its query key. Throws when
// used outside a WorkspaceProvider so a missing-provider bug fails loudly at
// render rather than silently serving a null wsId.
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (ctx === null) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
