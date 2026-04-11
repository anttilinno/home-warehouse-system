import { useLingui } from "@lingui/react/macro";
import { useRouteLoading } from "./useRouteLoading";

export function LoadingBar() {
  const { t } = useLingui();
  const { isLoading, progress } = useRouteLoading();

  if (!isLoading && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label={t`Loading page`}
      className="fixed top-0 left-0 h-[4px] bg-retro-amber z-40 transition-all ease-out"
      style={{
        width: `${progress}%`,
        opacity: progress >= 100 ? 0 : 1,
        transitionDuration: progress >= 100 ? "200ms" : "300ms",
      }}
    />
  );
}
