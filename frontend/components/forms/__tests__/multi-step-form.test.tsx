/**
 * Tests for MultiStepForm component
 *
 * Verifies:
 * - FE-03: Form flow regressions prevention
 * - Multi-step navigation (goNext, goBack)
 * - Step validation before advancing
 * - Draft persistence (load, save, clear)
 * - iOS keyboard handling pass-through
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { z } from "zod";
import { MultiStepForm } from "../multi-step-form";
import { useFormContext } from "react-hook-form";

// Mock dependencies
vi.mock("@/lib/hooks/use-form-draft", () => ({
  useFormDraft: vi.fn(),
}));

vi.mock("@/lib/hooks/use-ios-keyboard", () => ({
  useIOSKeyboard: vi.fn(),
}));

vi.mock("uuid", () => ({
  v7: vi.fn(() => "test-draft-id-123"),
}));

// Import mocks after vi.mock declarations
import { useFormDraft } from "@/lib/hooks/use-form-draft";
import { useIOSKeyboard } from "@/lib/hooks/use-ios-keyboard";

// Test schema
const testSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

type TestFormData = z.infer<typeof testSchema>;

const testSteps = [
  { id: "step1", title: "Name" },
  { id: "step2", title: "Email" },
];

const testStepFields: Array<Array<"name" | "email">> = [["name"], ["email"]];

// Mock implementations
const mockLoadDraft = vi.fn();
const mockSaveDraft = vi.fn();
const mockClearDraft = vi.fn();
const mockGetFixedBottomStyle = vi.fn(() => ({ position: "fixed", bottom: 0 }));

// Test child component that exposes form state
function TestFormContent({
  currentStep,
  goNext,
  goBack,
  isFirstStep,
  isLastStep,
  isSubmitting,
  keyboardStyle,
  isKeyboardOpen,
}: {
  currentStep: number;
  goNext: () => Promise<boolean>;
  goBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isSubmitting: boolean;
  keyboardStyle: React.CSSProperties;
  isKeyboardOpen: boolean;
}) {
  const { register, formState } = useFormContext<TestFormData>();

  return (
    <div>
      <div data-testid="current-step">{currentStep}</div>
      <div data-testid="is-first-step">{isFirstStep.toString()}</div>
      <div data-testid="is-last-step">{isLastStep.toString()}</div>
      <div data-testid="is-submitting">{isSubmitting.toString()}</div>
      <div data-testid="is-keyboard-open">{isKeyboardOpen.toString()}</div>
      <div data-testid="keyboard-style">{JSON.stringify(keyboardStyle)}</div>

      {currentStep === 0 && (
        <div>
          <input {...register("name")} data-testid="name-input" />
          {formState.errors.name && (
            <span data-testid="name-error">{formState.errors.name.message}</span>
          )}
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <input {...register("email")} data-testid="email-input" />
          {formState.errors.email && (
            <span data-testid="email-error">
              {formState.errors.email.message}
            </span>
          )}
        </div>
      )}

      <button type="button" onClick={goBack} data-testid="back-btn">
        Back
      </button>
      <button
        type="button"
        onClick={() => goNext()}
        data-testid="next-btn"
        disabled={isLastStep}
      >
        Next
      </button>
      {isLastStep && (
        <button type="submit" data-testid="submit-btn">
          Submit
        </button>
      )}
    </div>
  );
}

describe("MultiStepForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockLoadDraft.mockResolvedValue(null);
    mockSaveDraft.mockImplementation(() => {});
    mockClearDraft.mockResolvedValue(undefined);

    vi.mocked(useFormDraft).mockReturnValue({
      loadDraft: mockLoadDraft,
      saveDraft: mockSaveDraft,
      clearDraft: mockClearDraft,
    });

    vi.mocked(useIOSKeyboard).mockReturnValue({
      offset: { top: 0, height: 800, keyboardHeight: 0 },
      isKeyboardOpen: false,
      getFixedBottomStyle: mockGetFixedBottomStyle,
    });
  });

  describe("Initial state tests", () => {
    it("shows loading skeleton while loading draft", async () => {
      // Keep the draft loading promise unresolved
      mockLoadDraft.mockReturnValue(new Promise(() => {}));

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      // Skeleton should be visible
      expect(screen.queryByTestId("current-step")).not.toBeInTheDocument();
    });

    it("renders first step after draft loads", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });
    });

    it("loads draft data into form on mount", async () => {
      mockLoadDraft.mockResolvedValue({ name: "John Doe", email: "john@test.com" });

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("name-input")).toHaveValue("John Doe");
      });
    });

    it("initializes with default values when no draft", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "Default Name", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("name-input")).toHaveValue("Default Name");
      });
    });
  });

  describe("Navigation tests", () => {
    it("goNext advances to next step", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      });
    });

    it("goBack returns to previous step", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Go to step 2
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      });

      // Go back to step 1
      await act(async () => {
        fireEvent.click(screen.getByTestId("back-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });
    });

    it("goBack on first step calls onCancel", async () => {
      const onCancel = vi.fn();
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          onCancel={onCancel}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("back-btn"));
      });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("clicking step indicator navigates to previous steps only", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Go to step 2
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      });

      // Click step indicator for step 1 (index 0)
      const stepButtons = screen.getAllByRole("button");
      const step1Button = stepButtons.find((btn) =>
        btn.textContent?.includes("Name")
      );
      expect(step1Button).toBeDefined();

      await act(async () => {
        fireEvent.click(step1Button!);
      });

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });
    });
  });

  describe("Validation tests", () => {
    it("validates current step before advancing", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Try to advance without filling name
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });

      // Should still be on step 0
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });
    });

    it("does not advance when validation fails", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Multiple attempts to advance without valid data
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });

      // Should remain on step 0
      expect(screen.getByTestId("current-step")).toHaveTextContent("0");
    });

    it("shows validation errors on invalid step", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Try to advance without filling name
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });

      // Error should be shown
      await waitFor(() => {
        expect(screen.getByTestId("name-error")).toHaveTextContent(
          "Name is required"
        );
      });
    });
  });

  describe("Draft persistence tests", () => {
    it("saves draft when form values change", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Type into the name field
      await act(async () => {
        fireEvent.change(screen.getByTestId("name-input"), {
          target: { value: "John" },
        });
      });

      // saveDraft should be called (debounced in real implementation, mocked here)
      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalled();
      });
    });

    it("clears draft on successful submit", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={onSubmit}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Go to step 2
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      });

      // Fill email and submit
      await act(async () => {
        fireEvent.change(screen.getByTestId("email-input"), {
          target: { value: "john@test.com" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("submit-btn"));
      });

      // clearDraft should be called after submit
      await waitFor(() => {
        expect(mockClearDraft).toHaveBeenCalled();
      });
    });

    it("does not save draft before initial load completes", async () => {
      // Create a resolvable promise to control draft loading timing
      let resolveLoad: (value: null) => void;
      const loadPromise = new Promise<null>((resolve) => {
        resolveLoad = resolve;
      });
      mockLoadDraft.mockReturnValue(loadPromise);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "Initial", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      // saveDraft should not be called while loading
      expect(mockSaveDraft).not.toHaveBeenCalled();

      // Now resolve the load
      await act(async () => {
        resolveLoad!(null);
      });

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });
    });
  });

  describe("Submission tests", () => {
    it("calls onSubmit with form data on last step", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={onSubmit}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Go to step 2
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      });

      // Fill email and submit
      await act(async () => {
        fireEvent.change(screen.getByTestId("email-input"), {
          target: { value: "john@test.com" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("submit-btn"));
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "John",
            email: "john@test.com",
          })
        );
      });
    });

    it("shows isSubmitting state during submit", async () => {
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });
      const onSubmit = vi.fn().mockReturnValue(submitPromise);
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={onSubmit}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Go to step 2
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      });

      // Fill email
      await act(async () => {
        fireEvent.change(screen.getByTestId("email-input"), {
          target: { value: "john@test.com" },
        });
      });

      // Start submitting (don't await)
      act(() => {
        fireEvent.click(screen.getByTestId("submit-btn"));
      });

      // isSubmitting should be true while submitting
      await waitFor(() => {
        expect(screen.getByTestId("is-submitting")).toHaveTextContent("true");
      });

      // Resolve the submit
      await act(async () => {
        resolveSubmit!();
      });

      // isSubmitting should be false after submit completes
      await waitFor(() => {
        expect(screen.getByTestId("is-submitting")).toHaveTextContent("false");
      });
    });

    it("resets isSubmitting after submit completes", async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={onSubmit}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("0");
      });

      // Initially not submitting
      expect(screen.getByTestId("is-submitting")).toHaveTextContent("false");

      // Go to step 2
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("current-step")).toHaveTextContent("1");
      });

      // Fill email and submit
      await act(async () => {
        fireEvent.change(screen.getByTestId("email-input"), {
          target: { value: "john@test.com" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("submit-btn"));
      });

      // Wait for submit to complete
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });

      // isSubmitting should be reset to false
      await waitFor(() => {
        expect(screen.getByTestId("is-submitting")).toHaveTextContent("false");
      });
    });
  });

  describe("Keyboard handling tests", () => {
    it("passes keyboardStyle to children", async () => {
      mockLoadDraft.mockResolvedValue(null);
      const customStyle = { position: "fixed" as const, bottom: 100 };
      mockGetFixedBottomStyle.mockReturnValue(customStyle);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("keyboard-style")).toHaveTextContent(
          JSON.stringify(customStyle)
        );
      });
    });

    it("passes isKeyboardOpen to children", async () => {
      mockLoadDraft.mockResolvedValue(null);
      vi.mocked(useIOSKeyboard).mockReturnValue({
        offset: { top: 0, height: 500, keyboardHeight: 300 },
        isKeyboardOpen: true,
        getFixedBottomStyle: mockGetFixedBottomStyle,
      });

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-keyboard-open")).toHaveTextContent("true");
      });
    });
  });

  describe("Step state tests", () => {
    it("reports isFirstStep correctly", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-first-step")).toHaveTextContent("true");
      });

      // Go to step 2
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("is-first-step")).toHaveTextContent("false");
      });
    });

    it("reports isLastStep correctly", async () => {
      mockLoadDraft.mockResolvedValue(null);

      render(
        <MultiStepForm<TestFormData>
          schema={testSchema}
          defaultValues={{ name: "John", email: "" }}
          steps={testSteps}
          onSubmit={vi.fn()}
          formType="test"
          stepFields={testStepFields}
        >
          {(props) => <TestFormContent {...props} />}
        </MultiStepForm>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-last-step")).toHaveTextContent("false");
      });

      // Go to step 2 (last step)
      await act(async () => {
        fireEvent.click(screen.getByTestId("next-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("is-last-step")).toHaveTextContent("true");
      });
    });
  });
});
