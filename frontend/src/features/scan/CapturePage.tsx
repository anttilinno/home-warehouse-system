import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { Link } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  StatusPill,
  retroToast,
} from "@/components/retro";
import { BarcodeScanner } from "@/components/scan/BarcodeScanner";
import { ManualBarcodeEntry } from "@/components/scan/ManualBarcodeEntry";
import { ScanViewfinderOverlay } from "@/components/scan/ScanViewfinderOverlay";
import { ScanTorchToggle } from "@/components/scan/ScanTorchToggle";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { shortCodeEntityPath } from "@/lib/api/shortCodes";
import { newIdemKey } from "@/lib/offline/idempotency";
import { generateShortCode } from "@/lib/offline/shortCode";
import { useIsOnline } from "@/lib/offline/useIsOnline";
import { useCaptureMutation } from "./useCaptureMutation";
import { normalizeScanCode } from "./normalizeScanCode";
import { useScanResolve } from "./useScanResolve";
import { useScanFeedback } from "./useScanFeedback";
import { useTorch } from "./useTorch";

// /capture — the one-handed mobile loop: scan a label, snap a photo, move on.
// Everything else (name, category, location, quantity) is desk work, so a
// capture writes the minimum the backend requires and flags the row
// `needs_review: true` — the desktop filter `?needs_review=true` is the queue.
//
// It does NOT re-implement resolution: useScanResolve already funnels a code
// through items-by-barcode → the short-code registry, so a label that is
// already registered short-circuits to "ALREADY REGISTERED" + OPEN instead of
// creating a duplicate.
//
// The camera is mounted ONCE and pause-driven, never unmounted (Pitfall 1 —
// remounting the <video> re-prompts for permission in iOS standalone PWAs).
//
// OFFLINE (the basement case this page exists for): a save is FIRED, never
// awaited — the create+photo pair is one offline-queued mutation, so the loop
// advances to the next label immediately and the write drains on reconnect.
// Awaiting would hang forever, because an offline mutation pauses rather than
// resolving. Resolution can't run offline either, so an unresolvable code is
// offered as new (with the duplicate check called out as skipped) instead of
// spinning on a lookup that will never answer.

// One of OUR printed labels → the code becomes the entity's short_code, so
// scanning it again resolves to what was captured. Anything else is a product
// barcode (EAN/UPC) and goes to `barcode` instead.
//
// The bound is 4..8 — the ENTITY column cap (the item and location handlers
// both declare minLength 4 maxLength 8), NOT the 4..12 of the short_codes
// registry CHECK. A 9..12 char code satisfies the registry but 422s the create.
function isOwnLabel(code: string): boolean {
  return /^[A-Za-z0-9]{4,8}$/.test(code);
}

// What the panel should offer for the code currently in hand. "known" wins over
// "new" — a label that already resolves must never be registered twice.
type CaptureState = "idle" | "resolving" | "known" | "new";

function captureState({
  scanning,
  settled,
  item,
  entity,
  entityPending,
  isOnline,
}: {
  scanning: boolean;
  settled: boolean;
  item: Item | null;
  entity: ShortCodeMatch | null;
  entityPending: boolean;
  isOnline: boolean;
}): CaptureState {
  if (scanning) return "idle";
  // A cached hit still resolves offline; anything else can't, and an offline
  // lookup sits at "pending" forever rather than failing — so waiting for it
  // would freeze the loop. Offer the code as new and say the duplicate check
  // was skipped.
  if (item || entity) return "known";
  if (!isOnline) return "new";
  if (!settled || entityPending) return "resolving";
  return "new";
}

// The minimum body the backend accepts. `sku` and `name` are required
// (minLength 1) and the scanned code is the only thing known at capture time,
// so it stands in for both until the details are filled in on a desktop.
function captureItemBody(code: string): Record<string, unknown> {
  const own = isOwnLabel(code);
  return {
    sku: code,
    name: code,
    needs_review: true,
    short_code: own ? code : generateShortCode(),
    ...(own ? {} : { barcode: code }),
  };
}

export function CapturePage() {
  const { t } = useLingui();
  const { currentWorkspaceId } = useWorkspace();
  const wsId = currentWorkspaceId ?? "";

  const feedback = useScanFeedback();
  const torch = useTorch();
  const {
    handleResolveCode,
    paused,
    banner,
    lookup,
    entityMatch,
    entityPending,
    resume,
  } = useScanResolve({ feedback: feedback.success });

  const { capture } = useCaptureMutation();
  const isOnline = useIsOnline();

  const [photo, setPhoto] = useState<File | null>(null);
  const [captured, setCaptured] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);

  const code = banner?.code ?? "";
  const existingItem = lookup.data ?? null;
  const state = captureState({
    scanning: banner === null,
    settled: lookup.status === "success",
    item: existingItem,
    entity: entityMatch,
    entityPending,
    isOnline,
  });

  const onDecode = useCallback(
    (rawCode: string, format: string) => {
      handleResolveCode(normalizeScanCode(rawCode), format);
    },
    [handleResolveCode],
  );

  // Back to scanning, ready for the next label.
  const next = useCallback(() => {
    setPhoto(null);
    if (photoInput.current) photoInput.current.value = "";
    resume();
  }, [resume]);

  // Fire-and-advance. The write is queued (offline) or in flight (online)
  // either way, so the loop moves to the next label immediately; success and
  // sync-failure toasts carry the outcome. Awaiting here would stall the whole
  // page for the entire time a device has no signal.
  function save(kind: "item" | "location") {
    capture({
      kind,
      body:
        kind === "item"
          ? captureItemBody(code)
          : {
              name: code,
              ...(isOwnLabel(code) ? { short_code: code } : {}),
            },
      photo: photo ?? undefined,
    });
    setCaptured((n) => n + 1);
    next();
  }

  const saveItem = () => save("item");
  const saveLocation = () => save("location");

  function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    retroToast.success(t`Photo attached.`);
  }

  return (
    <div
      className="mx-auto flex max-w-[560px] flex-col gap-sp-4"
      onPointerDown={feedback.primeAudio}
    >
      <Window title={t`RAPID CAPTURE`} titlebarVariant="blue">
        <div className="flex items-center justify-between gap-sp-2 pb-sp-2">
          <p className="text-12 text-fg-muted">
            <Trans>
              Scan, snap, move on. Fill in the details later from a desktop.
            </Trans>
          </p>
          <StatusPill variant={captured > 0 ? "ok" : "info"}>
            {t`${captured} captured`}
          </StatusPill>
        </div>

        <div className="relative aspect-square w-full overflow-hidden border-2 border-border-ink bg-fg-ink">
          <BarcodeScanner
            paused={paused}
            onDecode={onDecode}
            torchSupported={torch.supported}
            torchEnabled={torch.enabled}
          />
          <ScanViewfinderOverlay />
          <div className="absolute right-sp-2 top-sp-2">
            <ScanTorchToggle
              supported={torch.supported}
              enabled={torch.enabled}
              onToggle={torch.toggle}
            />
          </div>
        </div>

        {/* Typed fallback for a damaged/unreadable label — and the only path a
            headless browser can drive, since a real camera can't be scripted.
            Funnels through the same resolve as a live decode. */}
        {!banner && (
          <div className="mt-sp-3">
            <ManualBarcodeEntry onSubmit={onDecode} />
          </div>
        )}

        {banner && (
          <section
            aria-live="polite"
            className="mt-sp-3 flex flex-col gap-sp-3 border-2 border-border-ink bg-bg-panel-2 p-sp-3"
          >
            <span className="font-mono text-14 tabular-nums text-fg-ink">
              {code}
            </span>

            {state === "known" && (
              <CaptureKnown
                item={existingItem}
                entity={entityMatch}
                onNext={next}
              />
            )}

            {state === "new" && (
              <CaptureActions
                photo={photo}
                offline={!isOnline}
                canBeLocation={isOwnLabel(code)}
                photoInput={photoInput}
                onPickPhoto={onPickPhoto}
                onSaveItem={saveItem}
                onSaveLocation={saveLocation}
                onSkip={next}
              />
            )}
          </section>
        )}
      </Window>
    </div>
  );
}

// Unknown-code branch: attach an optional photo, then pick what the label is.
function CaptureActions({
  photo,
  offline,
  canBeLocation,
  photoInput,
  onPickPhoto,
  onSaveItem,
  onSaveLocation,
  onSkip,
}: Readonly<{
  photo: File | null;
  /** Show that the duplicate check was skipped; the save itself still queues. */
  offline: boolean;
  /** False for a product barcode: locations can only hold one of our labels. */
  canBeLocation: boolean;
  photoInput: RefObject<HTMLInputElement | null>;
  onPickPhoto: (e: ChangeEvent<HTMLInputElement>) => void;
  onSaveItem: () => void;
  onSaveLocation: () => void;
  onSkip: () => void;
}>) {
  const { t } = useLingui();

  return (
    <div className="flex flex-col gap-sp-3">
      <div className="flex items-center gap-sp-2">
        <BevelButton type="button" onClick={() => photoInput.current?.click()}>
          {photo ? <Trans>RETAKE PHOTO</Trans> : <Trans>PHOTO</Trans>}
        </BevelButton>
        {photo && (
          <span className="truncate text-12 text-fg-muted">{photo.name}</span>
        )}
        {/* Native capture — no library, opens the rear camera on mobile and a
            file picker everywhere else. */}
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label={t`Attach a photo`}
          onChange={onPickPhoto}
        />
      </div>

      {offline && (
        <p className="text-12 text-fg-muted">
          <Trans>
            Offline — saved to the queue and synced later. Couldn't check
            whether this label is already registered.
          </Trans>
        </p>
      )}

      <div className="flex flex-wrap gap-sp-2">
        <BevelButton type="button" variant="primary" onClick={onSaveItem}>
          <Trans>SAVE AS ITEM</Trans>
        </BevelButton>
        {/* A location has no `barcode` field, so a code that can't be its
            short_code can't be attached to it at all — block the branch rather
            than mint an unrelated code the printed label will never resolve. */}
        <BevelButton
          type="button"
          variant="mint"
          disabled={!canBeLocation}
          title={
            canBeLocation
              ? undefined
              : t`A location needs one of our printed labels (4-8 characters) — this looks like a product barcode.`
          }
          onClick={onSaveLocation}
        >
          <Trans>SAVE AS LOCATION</Trans>
        </BevelButton>
        <BevelButton type="button" variant="neutral" onClick={onSkip}>
          <Trans>SKIP</Trans>
        </BevelButton>
      </div>
    </div>
  );
}

// Already-registered branch: never create a duplicate, just offer the target.
function CaptureKnown({
  item,
  entity,
  onNext,
}: Readonly<{
  item: Item | null;
  entity: ShortCodeMatch | null;
  onNext: () => void;
}>) {
  // One of the two is set (captureState only returns "known" then); the item
  // wins, matching the resolve order.
  const name = item?.name ?? entity?.name ?? "";
  const href = item ? `/items/${item.id}` : shortCodeEntityPath(entity!);

  return (
    <div className="flex flex-col gap-sp-2">
      <span className="font-body text-14 text-fg-ink">
        <Trans>Already registered:</Trans> {name}
      </span>
      <div className="flex flex-wrap gap-sp-2">
        <Link
          to={href}
          className="inline-flex items-center justify-center border-2 border-border-ink px-[14px] py-[6px] font-body text-13 font-semibold uppercase tracking-4 bevel-raised-ink"
        >
          <Trans>OPEN</Trans>
        </Link>
        <BevelButton type="button" variant="neutral" onClick={onNext}>
          <Trans>NEXT</Trans>
        </BevelButton>
      </div>
    </div>
  );
}
