// Reusable Vitest helpers for stubbing `navigator.mediaDevices` and the
// `MediaStreamTrack.getCapabilities().torch` surface. Consumed by every Phase
// 64 test that exercises torch feature-detection or camera-stream lifecycle.
//
// Example usage:
//   import { installMediaDevicesMock, setTorchCapability } from "@/test/mocks/media-devices";
//   const { track, restore, getUserMedia } = installMediaDevicesMock({ torchSupported: true });
//   afterEach(() => restore());
import { vi } from "vitest";

interface FakeTrackState {
  torch: boolean; // current torch on/off state (only relevant when supported)
  torchSupported: boolean; // reported by getCapabilities()
  stopped: boolean;
  appliedConstraints: MediaTrackConstraintSet[];
}

export interface FakeMediaStreamTrack {
  stop: () => void;
  getCapabilities: () => { torch?: boolean };
  applyConstraints: (c: {
    advanced?: MediaTrackConstraintSet[];
  }) => Promise<void>;
  readonly __state: FakeTrackState;
}

export interface FakeMediaStream {
  getTracks: () => FakeMediaStreamTrack[];
  getVideoTracks: () => FakeMediaStreamTrack[];
}

export function makeFakeTrack(
  opts: { torchSupported?: boolean } = {},
): FakeMediaStreamTrack {
  const state: FakeTrackState = {
    torch: false,
    torchSupported: opts.torchSupported ?? false,
    stopped: false,
    appliedConstraints: [],
  };
  return {
    stop: vi.fn(() => {
      state.stopped = true;
    }),
    getCapabilities: vi.fn(() =>
      state.torchSupported ? { torch: true } : {},
    ),
    applyConstraints: vi.fn(
      async (c: { advanced?: MediaTrackConstraintSet[] }) => {
        if (c.advanced) state.appliedConstraints.push(...c.advanced);
        const torchRequest = c.advanced?.find(
          (a) => (a as unknown as { torch?: boolean }).torch !== undefined,
        );
        if (torchRequest) {
          if (!state.torchSupported) {
            throw new DOMException("NotSupported", "NotSupportedError");
          }
          state.torch = (torchRequest as unknown as { torch: boolean }).torch;
        }
      },
    ),
    __state: state,
  };
}

export function makeFakeStream(track: FakeMediaStreamTrack): FakeMediaStream {
  const tracks = [track];
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
  };
}

// Install a fake navigator.mediaDevices on globalThis.
// Returns { track, stream, getUserMedia, restore } for test control.
export function installMediaDevicesMock(
  opts: { torchSupported?: boolean } = {},
): {
  track: FakeMediaStreamTrack;
  stream: FakeMediaStream;
  getUserMedia: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const track = makeFakeTrack({ torchSupported: opts.torchSupported });
  const stream = makeFakeStream(track);
  const getUserMedia = vi.fn(
    async (_constraints?: MediaStreamConstraints) => stream,
  );
  const prev = (globalThis as unknown as { navigator?: Navigator }).navigator;
  const mediaDevices = { getUserMedia } as unknown as MediaDevices;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { ...prev, mediaDevices },
  });
  return {
    track,
    stream,
    getUserMedia,
    restore: () => {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: prev,
      });
    },
  };
}

// Flip torch capability on an already-installed fake track.
export function setTorchCapability(
  track: FakeMediaStreamTrack,
  supported: boolean,
): void {
  track.__state.torchSupported = supported;
}
