import { useNavigate } from "react-router";
import { Trans } from "@lingui/react/macro";
import { BevelButton, Window } from "@/components/retro";

// Catch-all 404. Rendered both inside the AppShell (authed, mistyped URL) and
// standalone on the cream desktop (unauthed) — the centered Window works in
// either context. Replaces the old DEV PlaceholderShell that leaked internal
// scaffolding text to users on any bad path.
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className="grid min-h-[60vh] place-items-center p-sp-4">
      <Window
        title={<Trans>File not found</Trans>}
        titlebarVariant="butter"
        className="w-full max-w-[400px]"
        bodyClassName="grid gap-sp-4 p-sp-5 text-center"
      >
        <p className="font-mono text-13 text-fg-muted">
          <Trans>
            The page you were looking for does not exist or has moved.
          </Trans>
        </p>
        <BevelButton variant="primary" onClick={() => navigate("/")}>
          <Trans>Back to dashboard</Trans>
        </BevelButton>
      </Window>
    </main>
  );
}
