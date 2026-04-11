import { useRouteError, useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton } from "@/components/retro";

interface ErrorBoundaryPageProps {
  error?: string;
}

export function ErrorBoundaryPage({ error: errorProp }: ErrorBoundaryPageProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const routeError = useRouteError() as { message?: string } | null;

  let errorMessage: string;
  if (routeError) {
    errorMessage =
      typeof routeError === "object" && routeError.message
        ? routeError.message
        : String(routeError);
  } else if (errorProp) {
    errorMessage = errorProp;
  } else {
    errorMessage = t`Something went wrong. Return to the home screen or reload the page to try again.`;
  }

  return (
    <div className="min-h-dvh bg-retro-charcoal flex items-center justify-center p-lg">
      <RetroPanel showHazardStripe className="max-w-[480px] w-full">
        <div className="flex flex-col gap-md">
          <h1 className="text-[20px] font-bold uppercase text-retro-ink">
            SYSTEM ERROR
          </h1>
          <p className="bg-retro-charcoal text-retro-cream p-md border-retro-thick border-retro-ink font-mono text-[14px]">
            {errorMessage}
          </p>
          <RetroButton
            variant="neutral"
            onClick={() => navigate("/")}
          >
            {t`RETURN TO BASE`}
          </RetroButton>
        </div>
      </RetroPanel>
    </div>
  );
}
