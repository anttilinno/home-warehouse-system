"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { DashboardHeader } from "./header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/ui/command-palette";
import { KeyboardShortcutsDialog } from "@/components/ui/keyboard-shortcuts-dialog";
import { SkipLinks } from "@/components/shared/skip-links";
import { InstallBanner, OfflineIndicator, PendingUploadsIndicator } from "@/components/pwa";
import { useCommandPalette } from "@/lib/hooks/use-command-palette";
import { useKeyboardShortcutsDialog } from "@/lib/hooks/use-keyboard-shortcuts-dialog";
import { SSEProvider } from "@/lib/contexts/sse-context";
import { useAuth } from "@/lib/contexts/auth-context";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } =
    useCommandPalette();
  const { open: shortcutsOpen, setOpen: setShortcutsOpen } =
    useKeyboardShortcutsDialog();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show nothing while checking auth or redirecting
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <SSEProvider>
      <div className="min-h-screen bg-muted/30">
        <OfflineIndicator />
        <PendingUploadsIndicator />
        <InstallBanner />
        <SkipLinks />

        {/* Desktop Sidebar */}
        <div className="hidden md:block" id="navigation">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileMenuOpen(false)}
              onNavClick={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div
          className={cn(
            "flex flex-col transition-all duration-300",
            sidebarCollapsed ? "md:ml-16" : "md:ml-64"
          )}
        >
          <DashboardHeader onMenuClick={() => setMobileMenuOpen(true)} />
          <main id="main-content" className="flex-1 p-4 md:p-6">{children}</main>
        </div>

        {/* Command Palette */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />

        {/* Keyboard Shortcuts Help */}
        <KeyboardShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />
      </div>
    </SSEProvider>
  );
}
