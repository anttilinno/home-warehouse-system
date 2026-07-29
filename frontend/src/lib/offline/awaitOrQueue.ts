import { onlineManager } from "@tanstack/react-query";
import { msg } from "@lingui/core/macro";
import { i18n } from "@/lib/i18n";
import { retroToast } from "@/components/retro";

// The persisted-queue creates (mutationDefaults.ts) run with networkMode
// "online", so offline they PAUSE: `mutateAsync` never settles, and a form that
// awaits one sits there until reconnect. `/capture` already solved this by
// firing and advancing; this is the same move for the forms, in one place
// rather than four.
//
// Online  → `mutateAsync`, semantics unchanged: the caller gets the server row
//           and a rejection still throws to the form's catch.
// Offline → `mutate` (queued, drained by useResumeOnReconnect) and resolve
//           `null`, so the caller can navigate away. `null` means "queued, no
//           server row yet" — never "failed".
//
// ponytail: the online check races the request — online at the check, offline
// before the bytes leave, and it pauses mid-flight and hangs exactly as before.
// Narrow enough to accept; closing it means threading a timeout through every
// caller.
//
// Only for mutations with a REGISTERED DEFAULT — those survive a reload. An
// update or delete has none, so firing one offline would drop it on the next
// reload; those must keep awaiting.
interface Queueable<TData, TVars> {
  mutate: (vars: TVars) => void;
  mutateAsync: (vars: TVars) => Promise<TData>;
}

export function awaitOrQueue<TData, TVars>(
  mutation: Queueable<TData, TVars>,
  vars: TVars,
): Promise<TData | null> {
  if (onlineManager.isOnline()) return mutation.mutateAsync(vars);
  mutation.mutate(vars);
  // Offline there is no onSuccess toast to fire, and the form is about to
  // navigate away — without this the save looks like it did nothing.
  retroToast.info(i18n._(msg`Saved to the queue — syncs when you're online.`));
  return Promise.resolve(null);
}
