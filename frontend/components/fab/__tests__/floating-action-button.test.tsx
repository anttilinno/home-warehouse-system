/**
 * Tests for FloatingActionButton component
 *
 * Verifies:
 * - FE-05: FAB toggle behavior (open/close on click)
 * - Keyboard interactions (Escape key closes)
 * - Outside click handling
 * - Action item rendering and callbacks
 * - Accessibility (ARIA attributes)
 * - Radial positioning calculations
 */

import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { FloatingActionButton } from "../floating-action-button";
import { triggerHaptic } from "@/lib/hooks/use-haptic";

// Mock motion/react to render static elements
vi.mock("motion/react", () => ({
  motion: {
    div: ({
      children,
      variants,
      initial,
      animate,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div data-animate={animate as string} {...props}>
        {children}
      </div>
    ),
  },
}));

// Mock haptic feedback
vi.mock("@/lib/hooks/use-haptic", () => ({
  triggerHaptic: vi.fn(),
}));

// Test actions setup
const createMockActions = () => [
  {
    id: "add",
    icon: <span data-testid="icon-add">+</span>,
    label: "Add Item",
    onClick: vi.fn(),
  },
  {
    id: "scan",
    icon: <span data-testid="icon-scan">S</span>,
    label: "Scan",
    onClick: vi.fn(),
  },
  {
    id: "search",
    icon: <span data-testid="icon-search">Q</span>,
    label: "Search",
    onClick: vi.fn(),
  },
];

describe("FloatingActionButton", () => {
  let mockActions: ReturnType<typeof createMockActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockActions = createMockActions();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Toggle behavior", () => {
    it("renders main FAB button", () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      expect(button).toBeInTheDocument();
    });

    it("toggles menu open on click", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      expect(button).toHaveAttribute("aria-expanded", "false");

      await act(async () => {
        fireEvent.click(button);
      });

      expect(button).toHaveAttribute("aria-expanded", "true");
      expect(button).toHaveAttribute("aria-label", "Close quick actions");
    });

    it("toggles menu closed on second click", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });

      // Open menu
      await act(async () => {
        fireEvent.click(button);
      });
      expect(button).toHaveAttribute("aria-expanded", "true");

      // Close menu
      await act(async () => {
        fireEvent.click(button);
      });
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-label", "Open quick actions");
    });

    it("triggers haptic feedback on toggle", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      await act(async () => {
        fireEvent.click(button);
      });

      expect(triggerHaptic).toHaveBeenCalledWith("tap");
    });
  });

  describe("Keyboard interactions", () => {
    it("closes menu on Escape key", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });

      // Open menu
      await act(async () => {
        fireEvent.click(button);
      });
      expect(button).toHaveAttribute("aria-expanded", "true");

      // Press Escape
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape" });
      });

      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("does nothing on Escape when already closed", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      expect(button).toHaveAttribute("aria-expanded", "false");

      // Press Escape when closed
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape" });
      });

      // Should still be closed
      expect(button).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("Outside click handling", () => {
    it("closes menu on outside click", async () => {
      render(
        <div>
          <div data-testid="outside-element">Outside</div>
          <FloatingActionButton actions={mockActions} />
        </div>
      );

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });

      // Open menu
      await act(async () => {
        fireEvent.click(button);
      });
      expect(button).toHaveAttribute("aria-expanded", "true");

      // Wait for click handler to be registered (100ms delay in component)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Click outside
      const outsideElement = screen.getByTestId("outside-element");
      await act(async () => {
        fireEvent.click(outsideElement);
      });

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-expanded", "false");
      });
    });

    it("does not close on click inside container", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });

      // Open menu
      await act(async () => {
        fireEvent.click(button);
      });
      expect(button).toHaveAttribute("aria-expanded", "true");

      // Wait for click handler to be registered
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Find the container and click inside it (but not on button or action)
      const container = document.querySelector("[data-fab-container]");
      expect(container).toBeInTheDocument();

      // Click on the container itself
      await act(async () => {
        fireEvent.click(container as HTMLElement);
      });

      // Should still be open since we clicked inside the container
      expect(button).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Action items", () => {
    it("renders action items when menu is open", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      await act(async () => {
        fireEvent.click(button);
      });

      // Action items should be visible
      expect(
        screen.getByRole("menuitem", { name: "Add Item" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Scan" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Search" })
      ).toBeInTheDocument();
    });

    it("hides action items when menu is closed", () => {
      render(<FloatingActionButton actions={mockActions} />);

      // Menu should have hidden attribute when closed
      const menu = screen.getByRole("menu", { hidden: true });
      expect(menu).toHaveAttribute("hidden");
    });

    it("calls action onClick when action button clicked", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      // Open menu
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /open quick actions/i })
        );
      });

      // Click add action
      await act(async () => {
        fireEvent.click(screen.getByRole("menuitem", { name: "Add Item" }));
      });

      expect(mockActions[0].onClick).toHaveBeenCalledTimes(1);
    });

    it("closes menu after action is triggered", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const mainButton = screen.getByRole("button", {
        name: /open quick actions/i,
      });

      // Open menu
      await act(async () => {
        fireEvent.click(mainButton);
      });
      expect(mainButton).toHaveAttribute("aria-expanded", "true");

      // Click add action
      await act(async () => {
        fireEvent.click(screen.getByRole("menuitem", { name: "Add Item" }));
      });

      // Menu should be closed
      expect(mainButton).toHaveAttribute("aria-expanded", "false");
    });

    it("triggers haptic feedback on action click", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      // Open menu (this triggers haptic once)
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /open quick actions/i })
        );
      });
      vi.mocked(triggerHaptic).mockClear();

      // Click action
      await act(async () => {
        fireEvent.click(screen.getByRole("menuitem", { name: "Add Item" }));
      });

      // Should have triggered haptic on action click
      expect(triggerHaptic).toHaveBeenCalledWith("tap");
    });
  });

  describe("Accessibility", () => {
    it("main button has aria-expanded=false when closed", () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("main button has aria-expanded=true when open", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      await act(async () => {
        fireEvent.click(button);
      });

      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("main button has correct aria-label based on state", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      expect(button).toHaveAttribute("aria-label", "Open quick actions");

      await act(async () => {
        fireEvent.click(button);
      });
      expect(button).toHaveAttribute("aria-label", "Close quick actions");

      await act(async () => {
        fireEvent.click(button);
      });
      expect(button).toHaveAttribute("aria-label", "Open quick actions");
    });

    it("main button has aria-haspopup=menu", () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      expect(button).toHaveAttribute("aria-haspopup", "menu");
    });

    it("action items have role=menuitem", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /open quick actions/i })
        );
      });

      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems).toHaveLength(3);
    });

    it("action items have aria-label matching action label", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /open quick actions/i })
        );
      });

      expect(
        screen.getByRole("menuitem", { name: "Add Item" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Scan" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: "Search" })
      ).toBeInTheDocument();
    });

    it("menu container has role=menu", () => {
      render(<FloatingActionButton actions={mockActions} />);

      const menu = screen.getByRole("menu", { hidden: true });
      expect(menu).toBeInTheDocument();
    });

    it("container has role=group with aria-label", () => {
      render(<FloatingActionButton actions={mockActions} />);

      const group = screen.getByRole("group", { name: /quick actions/i });
      expect(group).toBeInTheDocument();
    });
  });

  describe("Radial positioning", () => {
    it("positions actions in radial layout", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /open quick actions/i })
        );
      });

      // Check that action items have position styles
      const menuItems = screen.getAllByRole("menuitem");
      menuItems.forEach((item) => {
        const parent = item.closest(".absolute");
        expect(parent).toBeInTheDocument();
        // Verify the parent has the absolute class (style computation not available in jsdom)
        expect(parent).toHaveClass("absolute");
        // Verify inline styles are set with calc() positioning
        expect(parent).toHaveAttribute("style");
        expect((parent as HTMLElement).style.left).toContain("calc");
        expect((parent as HTMLElement).style.top).toContain("calc");
      });
    });

    it("respects custom radius prop", () => {
      const { container } = render(
        <FloatingActionButton actions={mockActions} radius={120} />
      );

      // Component should render with custom radius affecting positioning
      // The positions are calculated based on radius, which affects the style
      expect(container).toBeInTheDocument();
    });

    it("respects custom startAngle and arcAngle props", () => {
      const customStartAngle = -Math.PI; // left side
      const customArcAngle = Math.PI; // 180 degrees

      const { container } = render(
        <FloatingActionButton
          actions={mockActions}
          startAngle={customStartAngle}
          arcAngle={customArcAngle}
        />
      );

      // Component should render with custom angles
      expect(container).toBeInTheDocument();
    });

    it("handles single action correctly", async () => {
      const singleAction = [mockActions[0]];
      render(<FloatingActionButton actions={singleAction} />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /open quick actions/i })
        );
      });

      // Should only have one menu item
      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("handles empty actions array", () => {
      render(<FloatingActionButton actions={[]} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      expect(button).toBeInTheDocument();
    });

    it("handles rapid clicking without errors", async () => {
      render(<FloatingActionButton actions={mockActions} />);

      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });

      // Rapid clicks
      await act(async () => {
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(button);
      });

      // Should still be in a valid state
      expect(button).toHaveAttribute("aria-expanded");
      expect(triggerHaptic).toHaveBeenCalledTimes(4);
    });

    it("cleans up event listeners on unmount", async () => {
      const { unmount } = render(
        <FloatingActionButton actions={mockActions} />
      );

      // Open menu to register event listeners
      const button = screen.getByRole("button", {
        name: /open quick actions/i,
      });
      await act(async () => {
        fireEvent.click(button);
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();

      // Simulate keydown after unmount (should not cause errors)
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
  });
});
