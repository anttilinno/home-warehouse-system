/**
 * Scanner library barrel.
 *
 * Re-exports the pure logic + browser-API utilities ported 1:1 from the legacy
 * `/frontend` scanner. The hooks (11-03) and components (11-04/05) import from
 * here. `init-polyfill` is a side-effect module — import it directly where the
 * polyfill must be registered (e.g. the scanner component), not via the barrel.
 */

export {
  playBeep,
  playSuccessBeep,
  playErrorBeep,
  primeAudio,
  triggerHaptic,
  triggerScanFeedback,
} from "./feedback";

export {
  getScanHistory,
  addToScanHistory,
  updateScanHistory,
  removeFromScanHistory,
  clearScanHistory,
  getLastScan,
} from "./scan-history";

export { SUPPORTED_FORMATS } from "./types";
export type { BarcodeFormat, SupportedFormat, ScanHistoryEntry } from "./types";
