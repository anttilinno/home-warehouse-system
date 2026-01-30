/**
 * Scanner Feedback Utilities
 *
 * Provides audio and haptic feedback for successful barcode scans.
 * Uses Web Audio API for beep sounds (no external files needed).
 *
 * IMPORTANT:
 * - iOS Safari does not support navigator.vibrate()
 * - AudioContext requires user gesture before first use on iOS
 * - Call initAudioContext() on first user interaction
 */
"use client";

let audioContext: AudioContext | null = null;
let audioInitialized = false;

/**
 * Initialize the AudioContext.
 * Must be called during a user gesture (tap/click) on iOS.
 * Safe to call multiple times.
 */
export function initAudioContext(): void {
  if (audioInitialized || typeof window === "undefined") {
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      audioInitialized = true;
      console.log("[Feedback] AudioContext initialized");
    }
  } catch (error) {
    console.warn("[Feedback] Failed to initialize AudioContext:", error);
  }
}

/**
 * Get or create the AudioContext.
 * Attempts initialization if not done yet.
 */
function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    initAudioContext();
  }

  // Resume if suspended (iOS requires this)
  if (audioContext?.state === "suspended") {
    audioContext.resume().catch(() => {
      // Ignore resume errors
    });
  }

  return audioContext;
}

/**
 * Play a beep sound using Web Audio API.
 *
 * @param frequency - Tone frequency in Hz (default: 800)
 * @param duration - Duration in milliseconds (default: 150)
 * @param volume - Volume from 0 to 1 (default: 0.3)
 */
export function playBeep(
  frequency: number = 800,
  duration: number = 150,
  volume: number = 0.3
): void {
  const ctx = getAudioContext();
  if (!ctx) {
    console.warn("[Feedback] AudioContext not available");
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

    // Cleanup
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch (error) {
    console.warn("[Feedback] Audio beep failed:", error);
  }
}

/**
 * Play a success beep (higher pitch, short duration).
 */
export function playSuccessBeep(): void {
  playBeep(880, 100, 0.25);
}

/**
 * Play an error beep (lower pitch, longer duration).
 */
export function playErrorBeep(): void {
  playBeep(300, 200, 0.3);
}

/**
 * Trigger haptic feedback via the Vibration API.
 *
 * NOTE: Not supported on iOS Safari - fails silently.
 *
 * @param pattern - Vibration duration in ms, or pattern array [vibrate, pause, vibrate...]
 */
export function triggerHaptic(pattern: number | number[] = 50): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) {
    // Vibration API not supported (iOS Safari)
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    // Ignore vibration errors
    console.warn("[Feedback] Haptic feedback failed:", error);
  }
}

/**
 * Trigger combined feedback for successful scan.
 * Plays beep and vibrates (on supported devices).
 */
export function triggerScanFeedback(): void {
  playSuccessBeep();
  triggerHaptic(50);
}
