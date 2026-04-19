// Phase 65 Plan 05 Task 2 — UpcSuggestionBanner behavioral tests.
// Each case exercises D-13..D-16 + D-23 (BRAND [USE] writes to form.brand —
// NOT form.description — no "Brand: " prefix workaround).
//
// Test harness strategy: wrap the banner in a tiny <FormProvider> so
// useFormContext().setValue is available; spy on methods.setValue to assert
// exact arguments.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useForm, FormProvider } from "react-hook-form";
import type { ItemCreateValues } from "@/features/items/forms/schemas";
import type { BarcodeProduct } from "@/lib/api/barcode";
import { UpcSuggestionBanner } from "../UpcSuggestionBanner";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

interface HarnessProps {
  data: BarcodeProduct;
  onSetValue: ReturnType<typeof vi.fn>;
}

function BannerHarness({ data, onSetValue }: HarnessProps) {
  const methods = useForm<ItemCreateValues>({
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      brand: "",
      description: "",
      category_id: "",
    } as ItemCreateValues,
  });
  // Replace methods.setValue with the spy so tests can assert exact args.
  const originalSetValue = methods.setValue;
  methods.setValue = ((...args: Parameters<typeof originalSetValue>) => {
    onSetValue(...args);
    return originalSetValue.apply(methods, args);
  }) as typeof originalSetValue;

  return (
    <FormProvider {...methods}>
      <UpcSuggestionBanner data={data} />
    </FormProvider>
  );
}

const fullData: BarcodeProduct = {
  found: true,
  barcode: "5449000000996",
  name: "Coca-Cola",
  brand: "The Coca-Cola Company",
  category: "beverages",
  image_url: null,
};

afterEach(() => cleanup());

describe("UpcSuggestionBanner render contract (D-13)", () => {
  it("renders yellow HazardStripe + h2 SUGGESTIONS AVAILABLE", () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    const heading = screen.getByRole("heading", {
      name: /SUGGESTIONS AVAILABLE/i,
    });
    expect(heading).toBeInTheDocument();
    // Yellow HazardStripe variant renders data-variant="yellow" on the stripe div.
    const stripe = document.querySelector('[data-variant="yellow"]');
    expect(stripe).toBeInTheDocument();
  });

  it("D-16: renders null when data.found === false (caller gating safety net)", () => {
    const onSetValue = vi.fn();
    const { container } = renderWithI18n(
      <BannerHarness
        data={{
          found: false,
          barcode: "5449000000996",
          name: "",
          brand: null,
          category: null,
          image_url: null,
        }}
        onSetValue={onSetValue}
      />,
    );
    expect(
      screen.queryByText(/SUGGESTIONS AVAILABLE/i),
    ).not.toBeInTheDocument();
    // Banner rendered nothing — harness adds no other DOM, so the wrapper is empty.
    expect(container.textContent).toBe("");
  });
});

describe("UpcSuggestionBanner per-field acceptance (D-14, D-23)", () => {
  it("D-14: name row renders label NAME + value + [USE] RetroButton", () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    expect(screen.getByText("NAME")).toBeInTheDocument();
    expect(screen.getByText("Coca-Cola")).toBeInTheDocument();
    const useButtons = screen.getAllByRole("button", { name: /\[USE\]/ });
    // NAME row has the first [USE]; BRAND row the second.
    expect(useButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("D-14/D-23: brand row renders when brand non-empty — BRAND label + value + [USE]", () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    expect(screen.getByText("BRAND")).toBeInTheDocument();
    expect(screen.getByText("The Coca-Cola Company")).toBeInTheDocument();
  });

  it("D-14: brand row does NOT render when brand is null/empty", () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness
        data={{ ...fullData, brand: null }}
        onSetValue={onSetValue}
      />,
    );
    expect(screen.queryByText("BRAND")).not.toBeInTheDocument();
    expect(
      screen.queryByText("The Coca-Cola Company"),
    ).not.toBeInTheDocument();
  });

  it("D-14: [USE] click on NAME calls setValue(\"name\", ..., { shouldDirty: true })", async () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    const nameRow = screen.getByText("NAME").closest("div");
    expect(nameRow).not.toBeNull();
    const nameUseButton = within(nameRow as HTMLElement).getByRole("button", {
      name: /\[USE\]/,
    });
    await userEvent.click(nameUseButton);
    expect(onSetValue).toHaveBeenCalledWith("name", "Coca-Cola", {
      shouldDirty: true,
    });
  });

  it("D-14/D-23: [USE] click on BRAND calls setValue(\"brand\", ..., { shouldDirty: true }) — NOT description", async () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    const brandRow = screen.getByText("BRAND").closest("div");
    expect(brandRow).not.toBeNull();
    const brandUseButton = within(brandRow as HTMLElement).getByRole(
      "button",
      { name: /\[USE\]/ },
    );
    await userEvent.click(brandUseButton);
    expect(onSetValue).toHaveBeenCalledWith(
      "brand",
      "The Coca-Cola Company",
      { shouldDirty: true },
    );
    // Anti-workaround: D-23 requires NO setValue("description", ...).
    for (const call of onSetValue.mock.calls) {
      expect(call[0]).not.toBe("description");
    }
  });

  it("D-14/D-23: USE ALL applies name AND brand via first-class setValue calls", async () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    const useAllButton = screen.getByRole("button", { name: /USE ALL/ });
    await userEvent.click(useAllButton);
    expect(onSetValue).toHaveBeenCalledWith("name", "Coca-Cola", {
      shouldDirty: true,
    });
    expect(onSetValue).toHaveBeenCalledWith(
      "brand",
      "The Coca-Cola Company",
      { shouldDirty: true },
    );
    // No description or category_id writes during USE ALL.
    for (const call of onSetValue.mock.calls) {
      expect(call[0]).not.toBe("description");
      expect(call[0]).not.toBe("category_id");
    }
  });

  it("D-14: DISMISS collapses the banner locally (no cache / no form writes)", async () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    expect(
      screen.getByText(/SUGGESTIONS AVAILABLE/i),
    ).toBeInTheDocument();
    const dismissButton = screen.getByRole("button", { name: /DISMISS/ });
    await userEvent.click(dismissButton);
    expect(
      screen.queryByText(/SUGGESTIONS AVAILABLE/i),
    ).not.toBeInTheDocument();
    // DISMISS writes nothing to the form.
    expect(onSetValue).not.toHaveBeenCalled();
  });
});

describe("UpcSuggestionBanner category hint (D-15)", () => {
  it("D-15: non-empty category renders helper text with NO [USE] chip", () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    const helper = screen.getByText(
      /Category hint: beverages — pick manually below\./,
    );
    expect(helper).toBeInTheDocument();
    // The helper row itself should not contain a [USE] button.
    const helperRow = helper.closest("p");
    expect(helperRow).not.toBeNull();
    expect(
      within(helperRow as HTMLElement).queryByRole("button"),
    ).toBeNull();
  });

  it("D-15: empty category does not render the helper row", () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness
        data={{ ...fullData, category: null }}
        onSetValue={onSetValue}
      />,
    );
    expect(
      screen.queryByText(/Category hint:/),
    ).not.toBeInTheDocument();
  });

  it("D-15 + D-23: setValue is NEVER called with \"category_id\" or \"description\" across render + click cycle", async () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness data={fullData} onSetValue={onSetValue} />,
    );
    // Click every button in the banner (USE x2, USE ALL, DISMISS).
    // DISMISS unmounts so click it last.
    const buttons = screen
      .getAllByRole("button")
      .filter(
        (b) =>
          !/DISMISS/i.test(b.textContent ?? ""),
      );
    for (const button of buttons) {
      await userEvent.click(button);
    }
    for (const call of onSetValue.mock.calls) {
      expect(call[0]).not.toBe("category_id");
      expect(call[0]).not.toBe("description");
    }
  });
});

describe("UpcSuggestionBanner data-shape edge cases", () => {
  it("renders only NAME row + USE ALL + DISMISS when brand is null and no category", () => {
    const onSetValue = vi.fn();
    renderWithI18n(
      <BannerHarness
        data={{
          found: true,
          barcode: "5449000000996",
          name: "Coca-Cola",
          brand: null,
          category: null,
          image_url: null,
        }}
        onSetValue={onSetValue}
      />,
    );
    expect(screen.getByText("NAME")).toBeInTheDocument();
    expect(screen.queryByText("BRAND")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Category hint:/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /USE ALL/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /DISMISS/ }),
    ).toBeInTheDocument();
  });
});
