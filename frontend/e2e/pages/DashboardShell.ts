import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class DashboardShell extends BasePage {
  // Sidebar locators
  readonly sidebar: Locator;
  readonly sidebarLogo: Locator;

  // Header locators
  readonly header: Locator;
  readonly mobileMenuToggle: Locator;
  readonly workspaceSwitcher: Locator;
  readonly globalSearch: Locator;

  // User menu locators
  readonly userMenu: Locator;
  readonly userMenuDropdown: Locator;

  // Mobile sidebar sheet
  readonly mobileSidebar: Locator;

  // Command palette
  readonly commandPalette: Locator;
  readonly commandPaletteInput: Locator;

  constructor(page: Page, locale = "en") {
    super(page, locale);

    // Sidebar (desktop)
    this.sidebar = page.locator("aside").filter({ has: page.locator("nav") }).first();
    this.sidebarLogo = this.sidebar.locator("button").filter({ hasText: "Home Warehouse" }).first();

    // Header
    this.header = page.locator("header");
    this.mobileMenuToggle = this.header.getByRole("button", { name: /open navigation menu|toggle menu/i });
    this.workspaceSwitcher = this.header.getByRole("combobox");
    this.globalSearch = this.header.getByRole("searchbox", { name: /global search/i });

    // User menu (in sidebar) - button containing the avatar element
    this.userMenu = this.sidebar.locator("button").filter({ has: page.locator('[data-slot="avatar"]') }).first();

    // User menu dropdown content (uses data-slot from shadcn/ui)
    this.userMenuDropdown = page.locator('[data-slot="dropdown-menu-content"]');

    // Mobile sidebar (Sheet component)
    this.mobileSidebar = page.locator("[data-state='open'][role='dialog']").filter({ has: page.locator("nav") });

    // Command palette (uses cmdk CommandDialog)
    this.commandPalette = page.locator("[cmdk-dialog]");
    this.commandPaletteInput = page.locator("[cmdk-input]");
  }

  /**
   * Get a navigation item from the sidebar by its text label
   */
  sidebarNavItem(name: string): Locator {
    return this.sidebar.getByRole("link", { name, exact: false });
  }

  /**
   * Get a navigation item from the mobile sidebar
   */
  mobileNavItem(name: string): Locator {
    return this.mobileSidebar.getByRole("link", { name, exact: false });
  }

  /**
   * Open the user menu dropdown
   */
  async openUserMenu(): Promise<void> {
    // The user menu is a dropdown trigger button in the sidebar bottom section
    // It's the last button in the sidebar that contains an avatar span element
    await this.userMenu.click();
    await this.userMenuDropdown.waitFor({ state: "visible" });
  }

  /**
   * Open the command palette using keyboard shortcut
   */
  async openCommandPalette(): Promise<void> {
    // Use Cmd+K on Mac, Ctrl+K on others
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await this.page.keyboard.press(`${modifier}+k`);
    await this.commandPalette.waitFor({ state: "visible" });
  }

  /**
   * Close the command palette
   */
  async closeCommandPalette(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.commandPalette.waitFor({ state: "hidden" });
  }

  /**
   * Navigate to a route by clicking the sidebar link
   */
  async navigateTo(route: string): Promise<void> {
    const navItem = this.sidebarNavItem(route);
    await navItem.click();
    // Don't use networkidle - SSE connections keep it busy
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Navigate using mobile menu
   */
  async navigateToMobile(route: string): Promise<void> {
    await this.mobileMenuToggle.click();
    await this.mobileSidebar.waitFor({ state: "visible" });
    const navItem = this.mobileNavItem(route);
    await navItem.click();
    // Don't use networkidle - SSE connections keep it busy
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Open mobile menu
   */
  async openMobileMenu(): Promise<void> {
    await this.mobileMenuToggle.click();
    await this.mobileSidebar.waitFor({ state: "visible" });
  }

  /**
   * Close mobile menu by clicking outside
   */
  async closeMobileMenuByClickOutside(): Promise<void> {
    // Click on the overlay/backdrop
    await this.page.locator("[data-state='open'][data-radix-dialog-overlay]").click({ force: true });
  }

  /**
   * Get command palette items
   */
  getCommandPaletteItem(label: string): Locator {
    return this.commandPalette.locator("[cmdk-item]").filter({ hasText: label });
  }

  /**
   * Type in the command palette search
   */
  async searchCommandPalette(query: string): Promise<void> {
    await this.commandPaletteInput.fill(query);
  }

  /**
   * Get all navigation items from sidebar
   */
  getAllNavItems(): Locator {
    return this.sidebar.locator("nav a");
  }

  /**
   * Get workspace name from switcher
   */
  async getWorkspaceName(): Promise<string | null> {
    return this.workspaceSwitcher.textContent();
  }

  /**
   * Open workspace switcher dropdown
   */
  async openWorkspaceSwitcher(): Promise<void> {
    await this.workspaceSwitcher.click();
    // Uses data-slot from shadcn/ui, not radix default
    await this.page.locator('[data-slot="dropdown-menu-content"]').waitFor({ state: "visible" });
  }
}
