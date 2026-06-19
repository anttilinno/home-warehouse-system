import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import { BevelButton } from "@/components/retro";

// Shared load/error boundary for the taxonomy tabs (TAX refactor). Every tab
// (Categories/Locations/Containers/Labels) opened with the same error block
// (title + "Something went wrong" + RETRY) and the same "Loading…" line — only
// the error title differed. This renders that boundary and falls through to the
// tab body once the query has settled. Behavior is identical to the inlined
// blocks: error wins over loading, RETRY calls onRetry.
export function TaxonomyTabState({
  isError,
  isLoading,
  errorTitle,
  onRetry,
  children,
}: Readonly<{
  isError: boolean;
  isLoading: boolean;
  /** e.g. "COULDN'T LOAD CATEGORIES" */
  errorTitle: ReactNode;
  onRetry: () => void;
  children: ReactNode;
}>) {
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-sp-3">
        <p className="text-14 font-semibold text-danger">{errorTitle}</p>
        <p className="text-13 text-fg-muted">
          <Trans>Something went wrong. Try again.</Trans>
        </p>
        <BevelButton onClick={onRetry}>
          <Trans>RETRY</Trans>
        </BevelButton>
      </div>
    );
  }

  if (isLoading) {
    return (
      <p className="font-mono text-13 text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  }

  return <>{children}</>;
}
