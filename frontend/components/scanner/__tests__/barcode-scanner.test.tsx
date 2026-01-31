/**
 * Tests for BarcodeScanner component
 *
 * Verifies:
 * - FE-04: Scanner component behaviors (camera interaction, decode callbacks, error states)
 * - Initialization states (loading, success, error)
 * - Permission handling (denied, error callback)
 * - Scanner callbacks (onScan, onError)
 * - Pause overlay display
 * - Torch controls (visibility, toggle)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

// Mock next/dynamic BEFORE importing the component
vi.mock("next/dynamic", () => ({
  default: () => {
    const MockScanner = (props: {
      onScan: (r: unknown[]) => void;
      onError: (e: Error) => void;
      paused?: boolean;
    }) => (
      <div data-testid="mock-scanner" data-paused={props.paused}>
        <button
          data-testid="simulate-scan"
          onClick={() => props.onScan([{ rawValue: "TEST123" }])}
        >
          Simulate Scan
        </button>
        <button
          data-testid="simulate-error"
          onClick={() => props.onError(new Error("Test error"))}
        >
          Simulate Error
        </button>
        <button
          data-testid="simulate-permission-denied"
          onClick={() => {
            const error = new Error("Permission denied");
            error.name = "NotAllowedError";
            props.onError(error);
          }}
        >
          Simulate Permission Denied
        </button>
      </div>
    );
    MockScanner.displayName = "MockScanner";
    return MockScanner;
  },
}));

// Mock lib/scanner
const mockInitBarcodePolyfill = vi.fn();
vi.mock("@/lib/scanner", () => ({
  initBarcodePolyfill: () => mockInitBarcodePolyfill(),
  SUPPORTED_FORMATS: ["qr_code", "ean_13", "ean_8"],
}));

// Setup navigator.mediaDevices mock
const createMockStream = (hasTorch: boolean = false) => {
  const mockTrack = {
    stop: vi.fn(),
    getCapabilities: vi.fn().mockReturnValue({ torch: hasTorch }),
  };
  return {
    getTracks: () => [mockTrack],
    getVideoTracks: () => [mockTrack],
  };
};

// Save original userAgent
const originalUserAgent = navigator.userAgent;

describe("BarcodeScanner", () => {
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInitBarcodePolyfill.mockResolvedValue(undefined);

    // Setup default mock for getUserMedia
    mockGetUserMedia = vi.fn().mockResolvedValue(createMockStream(false));

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
      configurable: true,
    });

    // Reset userAgent to non-iOS
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original userAgent
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
  });

  // Helper to import component fresh (after mocks are set up)
  const importComponent = async () => {
    const module = await import("../barcode-scanner");
    return module.BarcodeScanner;
  };

  describe("Initialization", () => {
    it("shows loading state during initialization", async () => {
      // Make initialization hang
      mockInitBarcodePolyfill.mockReturnValue(new Promise(() => {}));

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} />);

      expect(screen.getByText("Initializing scanner...")).toBeInTheDocument();
    });

    it("renders scanner after successful initialization", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });
    });

    it("shows error state when polyfill initialization fails", async () => {
      const errorMessage = "Polyfill init failed";
      mockInitBarcodePolyfill.mockRejectedValue(new Error(errorMessage));

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();
      const onError = vi.fn();

      render(<BarcodeScanner onScan={onScan} onError={onError} />);

      await waitFor(() => {
        expect(screen.getByText("Scanner Error")).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("Permission handling", () => {
    it("handles permission denied error (NotAllowedError)", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();
      const onError = vi.fn();

      render(<BarcodeScanner onScan={onScan} onError={onError} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      // Simulate permission denied via scanner error
      fireEvent.click(screen.getByTestId("simulate-permission-denied"));

      await waitFor(() => {
        expect(screen.getByText("Camera Access Denied")).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalled();
    });

    it("shows camera access denied message with instructions", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("simulate-permission-denied"));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Please allow camera access in your browser settings to use the scanner."
          )
        ).toBeInTheDocument();
      });
    });

    it("calls onError callback on permission denied", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();
      const onError = vi.fn();

      render(<BarcodeScanner onScan={onScan} onError={onError} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("simulate-permission-denied"));

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "NotAllowedError",
        })
      );
    });
  });

  describe("Scanner behavior", () => {
    it("calls onScan when barcode detected", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("simulate-scan"));

      expect(onScan).toHaveBeenCalledWith([{ rawValue: "TEST123" }]);
    });

    it("calls onError when scanner error occurs", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();
      const onError = vi.fn();

      render(<BarcodeScanner onScan={onScan} onError={onError} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("simulate-error"));

      expect(onError).toHaveBeenCalledWith(new Error("Test error"));
    });

    it("shows pause overlay when paused prop is true", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} paused={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      expect(screen.getByText("Scanner paused")).toBeInTheDocument();
    });

    it("hides pause overlay when paused prop is false", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} paused={false} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      expect(screen.queryByText("Scanner paused")).not.toBeInTheDocument();
    });
  });

  describe("Torch control", () => {
    it("shows torch button when torch is supported", async () => {
      // Set up torch-supported stream
      mockGetUserMedia.mockResolvedValue(createMockStream(true));
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      // The torch button should be visible
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /flashlight/i })
        ).toBeInTheDocument();
      });
    });

    it("hides torch button when torch is not supported", async () => {
      // Set up stream without torch
      mockGetUserMedia.mockResolvedValue(createMockStream(false));
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      // Give time for torch check to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No torch button
      expect(
        screen.queryByRole("button", { name: /flashlight/i })
      ).not.toBeInTheDocument();
    });

    it("toggles torch state on button click", async () => {
      mockGetUserMedia.mockResolvedValue(createMockStream(true));
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      // Wait for torch button to appear
      const torchButton = await waitFor(() =>
        screen.getByRole("button", { name: /flashlight/i })
      );

      // Initially should show "Turn on flashlight"
      expect(torchButton).toHaveAttribute(
        "aria-label",
        "Turn on flashlight"
      );

      // Click to toggle
      fireEvent.click(torchButton);

      // Should now show "Turn off flashlight"
      expect(torchButton).toHaveAttribute(
        "aria-label",
        "Turn off flashlight"
      );
    });

    it("hides torch button when paused", async () => {
      mockGetUserMedia.mockResolvedValue(createMockStream(true));
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} paused={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      // Give time for torch check to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Torch button should be hidden when paused
      expect(
        screen.queryByRole("button", { name: /flashlight/i })
      ).not.toBeInTheDocument();
    });

    it("skips torch detection on iOS devices", async () => {
      // Set iOS user agent
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        writable: true,
        configurable: true,
      });

      mockGetUserMedia.mockResolvedValue(createMockStream(true));
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      // Give time for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // getUserMedia should NOT be called for torch check on iOS
      // (component skips torch detection on iOS)
      // Torch button should not appear
      expect(
        screen.queryByRole("button", { name: /flashlight/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Scanning indicator", () => {
    it("shows scanning indicator when not paused", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} paused={false} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      expect(screen.getByText("Scanning")).toBeInTheDocument();
    });

    it("hides scanning indicator when paused", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      render(<BarcodeScanner onScan={onScan} paused={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      expect(screen.queryByText("Scanning")).not.toBeInTheDocument();
    });
  });

  describe("Custom props", () => {
    it("applies custom className to container", async () => {
      mockInitBarcodePolyfill.mockResolvedValue(undefined);

      const BarcodeScanner = await importComponent();
      const onScan = vi.fn();

      const { container } = render(
        <BarcodeScanner onScan={onScan} className="custom-class" />
      );

      await waitFor(() => {
        expect(screen.getByTestId("mock-scanner")).toBeInTheDocument();
      });

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });
});
