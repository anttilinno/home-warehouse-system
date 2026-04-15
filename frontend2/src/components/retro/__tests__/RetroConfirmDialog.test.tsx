import { render, screen, fireEvent, act } from "@testing-library/react";
import { createRef, type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "../RetroConfirmDialog";

i18n.load("en", {});
i18n.activate("en");

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (
    this: HTMLDialogElement
  ) {
    this.removeAttribute("open");
  });
});

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("RetroConfirmDialog", () => {
  it("opens dialog via imperative handle", () => {
    const ref = createRef<RetroConfirmDialogHandle>();
    renderWithI18n(
      <RetroConfirmDialog
        ref={ref}
        variant="destructive"
        title="CONFIRM DELETE"
        body="Are you sure?"
        escapeLabel="KEEP ITEM"
        destructiveLabel="DELETE ITEM"
        onConfirm={() => {}}
      />
    );
    act(() => {
      ref.current!.open();
    });
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });

  it("calls onConfirm when destructive button clicked", async () => {
    const onConfirm = vi.fn();
    const ref = createRef<RetroConfirmDialogHandle>();
    renderWithI18n(
      <RetroConfirmDialog
        ref={ref}
        variant="destructive"
        title="CONFIRM DELETE"
        body="Body"
        escapeLabel="KEEP ITEM"
        destructiveLabel="DELETE ITEM"
        onConfirm={onConfirm}
      />
    );
    act(() => {
      ref.current!.open();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete item/i }));
    });
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when escape button clicked", () => {
    const onCancel = vi.fn();
    const ref = createRef<RetroConfirmDialogHandle>();
    renderWithI18n(
      <RetroConfirmDialog
        ref={ref}
        variant="destructive"
        title="X"
        body="Y"
        escapeLabel="KEEP ITEM"
        destructiveLabel="DELETE ITEM"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );
    act(() => {
      ref.current!.open();
    });
    fireEvent.click(screen.getByRole("button", { name: /keep item/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("swaps destructive label to WORKING… while promise pending", async () => {
    let resolveFn: () => void;
    const confirmPromise = new Promise<void>((r) => {
      resolveFn = r;
    });
    const ref = createRef<RetroConfirmDialogHandle>();
    renderWithI18n(
      <RetroConfirmDialog
        ref={ref}
        variant="destructive"
        title="X"
        body="Y"
        escapeLabel="KEEP ITEM"
        destructiveLabel="DELETE ITEM"
        onConfirm={() => confirmPromise}
      />
    );
    act(() => {
      ref.current!.open();
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /delete item/i }));
    });
    // While promise is pending, label should show WORKING…
    expect(
      screen.getByRole("button", { name: /working/i })
    ).toBeInTheDocument();
    await act(async () => {
      resolveFn!();
      await confirmPromise;
    });
  });

  it("uses danger variant styling on destructive and primary on soft", () => {
    const refD = createRef<RetroConfirmDialogHandle>();
    const { unmount } = renderWithI18n(
      <RetroConfirmDialog
        ref={refD}
        variant="destructive"
        title="D"
        body="B"
        escapeLabel="CANCEL"
        destructiveLabel="DO IT"
        onConfirm={() => {}}
      />
    );
    act(() => {
      refD.current!.open();
    });
    const destructiveBtn = screen.getByRole("button", { name: /do it/i });
    expect(destructiveBtn.className).toContain("bg-retro-red");
    unmount();

    const refS = createRef<RetroConfirmDialogHandle>();
    renderWithI18n(
      <RetroConfirmDialog
        ref={refS}
        variant="soft"
        title="S"
        body="B"
        escapeLabel="CANCEL"
        destructiveLabel="DO IT"
        onConfirm={() => {}}
      />
    );
    act(() => {
      refS.current!.open();
    });
    const softBtn = screen.getByRole("button", { name: /do it/i });
    expect(softBtn.className).toContain("bg-retro-amber");
  });
});
