import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { ToastProvider, useToast } from "../RetroToast";

// Mock crypto.randomUUID for predictable IDs
let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `test-uuid-${uuidCounter++}`
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function ToastTrigger({
  message,
  variant,
}: {
  message: string;
  variant?: "success" | "error" | "info";
}) {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast(message, variant)}>Add Toast</button>
  );
}

function AutoToastTrigger({
  message,
  variant,
}: {
  message: string;
  variant?: "success" | "error" | "info";
}) {
  const { addToast } = useToast();
  useEffect(() => {
    addToast(message, variant);
  }, []);
  return null;
}

describe("RetroToast", () => {
  it("renders toast with message after addToast is called", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Item saved" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Add Toast"));
    expect(screen.getByText("Item saved")).toBeInTheDocument();
  });

  it("renders success variant with green left border", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Success!" variant="success" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Add Toast"));
    const toast = screen.getByText("Success!").closest("div");
    expect(toast?.className).toContain("border-l-retro-green");
    expect(toast?.className).toContain("border-l-[4px]");
  });

  it("renders error variant with red left border", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Error!" variant="error" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Add Toast"));
    const toast = screen.getByText("Error!").closest("div");
    expect(toast?.className).toContain("border-l-retro-red");
  });

  it("renders info variant with blue left border", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Info!" variant="info" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Add Toast"));
    const toast = screen.getByText("Info!").closest("div");
    expect(toast?.className).toContain("border-l-retro-blue");
  });

  it("defaults to info variant when no variant specified", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Default" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Add Toast"));
    const toast = screen.getByText("Default").closest("div");
    expect(toast?.className).toContain("border-l-retro-blue");
  });

  it("clicking X dismiss button removes toast immediately", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Dismiss me" variant="success" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Add Toast"));
    expect(screen.getByText("Dismiss me")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
  });

  it("useToast throws when used outside ToastProvider", () => {
    function BadComponent() {
      useToast();
      return null;
    }

    // Suppress console.error for expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow(
      "useToast must be used within ToastProvider"
    );
    spy.mockRestore();
  });

  it("auto-dismisses toast after 4000ms", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <ToastTrigger message="Auto dismiss" variant="success" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Add Toast"));
    expect(screen.getByText("Auto dismiss")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByText("Auto dismiss")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Auto dismiss")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("toast container has z-50 class", () => {
    render(
      <ToastProvider>
        <AutoToastTrigger message="Z-index test" />
      </ToastProvider>
    );

    const container = screen.getByText("Z-index test").closest("div[class*='z-50']");
    expect(container).not.toBeNull();
  });

  it("toast has correct base styling", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger message="Styled toast" variant="success" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Add Toast"));
    const toast = screen.getByText("Styled toast").closest("div");
    expect(toast?.className).toContain("w-[280px]");
    expect(toast?.className).toContain("border-retro-ink");
    expect(toast?.className).toContain("bg-retro-cream");
    expect(toast?.className).toContain("shadow-retro-raised");
  });
});
