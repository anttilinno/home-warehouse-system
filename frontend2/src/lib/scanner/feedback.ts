/**
 * Scanner Feedback Utilities
 *
 * Audio + raw-haptic feedback for barcode scans. 1:1 parity port of the legacy
 * `frontend/lib/scanner/feedback.ts` (singleton AudioContext sine oscillator;
 * success = 880Hz/100ms/0.25, error = 300Hz/200ms/0.3; raw `navigator.vibrate`).
 *
 * iOS notes (Pitfall 4):
 * - AudioContext starts SUSPENDED; `resume()` must run inside a real user
 *   gesture. This module does NOT resume at import — call `primeAudio()` from a
 *   `pointerdown` handler to unlock it. `playBeep` also opportunistically
 *   resumes, but the gesture-time prime is what actually unlocks iOS.
 * - iOS Safari has no `navigator.vibrate`; the raw vibrate path here fails
 *   silently. The richer ios-haptics path is wired in the 11-03 useScanFeedback
 *   hook, NOT here — this module owns beep + raw vibrate only.
 */

let audioContext: AudioContext | null = null;
let audioInitialized = false;

/**
 * Lazily construct the singleton AudioContext. Safe to call repeatedly. Does
 * NOT resume — kept gesture-free so it can run outside a user gesture without
 * iOS rejecting it (resume happens in `primeAudio`/`getAudioContext`).
 */
function initAudioContext(): void {
  if (audioInitialized || typeof window === "undefined") {
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      audioInitialized = true;
    }
  } catch {
    // AudioContext unavailable — beeps no-op (feedback degrades gracefully).
  }
}

/**
 * Get-or-create the AudioContext, resuming it if suspended. The resume here is
 * best-effort; the reliable iOS unlock is `primeAudio()` called from a gesture.
 */
function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    initAudioContext();
  }

  if (audioContext?.state === "suspended") {
    audioContext.resume().catch(() => {
      // Ignore resume errors (iOS rejects resume outside a gesture).
    });
  }

  return audioContext;
}

/**
 * Unlock audio from a user gesture (`pointerdown`). Constructs the singleton
 * context if needed and resumes it. Call ONCE per `/scan` mount from a
 * pointerdown handler — NEVER from module scope or a `useEffect` (iOS rejects
 * resume outside a gesture; Pitfall 4).
 */
export function primeAudio(): void {
  if (!audioContext) {
    initAudioContext();
  }
  if (audioContext?.state === "suspended") {
    audioContext.resume().catch(() => {
      // Ignore — a later gesture-driven prime can retry.
    });
  }
}

/**
 * Play a sine-oscillator beep via the Web Audio API.
 *
 * @param frequency Tone frequency in Hz.
 * @param duration  Duration in milliseconds.
 * @param volume    Gain from 0 to 1.
 */
export function playBeep(
  frequency: number = 800,
  duration: number = 150,
  volume: number = 0.3,
): void {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.value = volume;

    const startTime = ctx.currentTime;
    const endTime = startTime + duration / 1000;

    oscillator.start(startTime);
    oscillator.stop(endTime);

    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch {
    // Audio failure is non-fatal — scan still resolves visually.
  }
}

/** Success beep: higher pitch, short (880Hz / 100ms / 0.25). */
export function playSuccessBeep(): void {
  playBeep(880, 100, 0.25);
}

/** Error beep: lower pitch, longer (300Hz / 200ms / 0.3). */
export function playErrorBeep(): void {
  playBeep(300, 200, 0.3);
}

/**
 * Raw Vibration API haptic. No-op (silent) where unsupported (iOS Safari).
 * This is the independent `navigator.vibrate` path the legacy file keeps
 * alongside ios-haptics; the ios-haptics path lives in the 11-03 hook.
 *
 * @param pattern Duration in ms, or a `[vibrate, pause, …]` pattern array.
 */
export function triggerHaptic(pattern: number | number[] = 50): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore vibration errors.
  }
}

/** Combined success feedback: success beep + a short raw vibrate. */
export function triggerScanFeedback(): void {
  playSuccessBeep();
  triggerHaptic(50);
}
