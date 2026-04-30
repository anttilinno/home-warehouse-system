"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import {
  useShortcutsContext,
  type Shortcut,
} from "@/components/layout/shortcuts-context";

function isInputFocused(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

function formatHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function ShortcutChip({ shortcut }: { shortcut: Shortcut }) {
  return (
    <button
      type="button"
      onClick={shortcut.action}
      className="bb-shortcut inline-flex flex-shrink-0 items-center gap-1.5 px-0 py-1 text-[12px] font-medium tracking-wide text-foreground transition-colors hover:text-foreground/80"
    >
      <span
        className={cn(
          "bb-key inline-block px-1.5 py-0.5 text-[11px] font-bold leading-none tracking-wide",
          shortcut.danger
            ? "bg-destructive text-white"
            : "bg-primary text-primary-foreground"
        )}
      >
        {shortcut.key}
      </span>
      <span className="bb-label uppercase font-bold tracking-[0.1em] text-[12px]">
        {shortcut.label}
      </span>
    </button>
  );
}

export function Bottombar() {
  const { shortcuts } = useShortcutsContext();

  // Live local clock + session elapsed (since mount). Both values are seeded
  // in the first effect run (avoids Date.now in render body, also avoids any
  // SSR vs client time mismatch). The single state object keeps the effect
  // to one setState per tick.
  const [time, setTime] = useState<{ start: number; now: Date } | null>(null);
  useEffect(() => {
    const start = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only seed; SSR/client time mismatch ruled out by null initial state
    setTime({ start, now: new Date() });
    const id = setInterval(() => {
      setTime((prev) => (prev ? { start: prev.start, now: new Date() } : prev));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const sessionElapsed = time
    ? formatHHMMSS(Math.floor((time.now.getTime() - time.start) / 1000))
    : "00:00:00";
  const localClock = time
    ? formatHHMMSS(
        time.now.getHours() * 3600 +
          time.now.getMinutes() * 60 +
          time.now.getSeconds()
      )
    : "00:00:00";

  const helpShortcut: Shortcut = useMemo(
    () => ({
      key: "F1",
      label: "Help",
      action: () => {
        // Re-fire as a real F1 keydown so useKeyboardShortcutsDialog opens.
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "F1" }));
      },
    }),
    []
  );

  // Keyboard binding for per-route shortcuts.
  // F1 is owned by useKeyboardShortcutsDialog (it listens for both `?` and F1).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isInputFocused(event.target)) return;

      const eventKey = event.key.toUpperCase();
      const match = shortcuts.find((s) => s.key.toUpperCase() === eventKey);
      if (!match) return;

      event.preventDefault();
      match.action();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts]);

  return (
    <footer
      className="bottombar hidden md:flex items-center gap-4 border-t bg-background px-4 h-9 text-xs overflow-hidden"
      aria-label="Keyboard shortcuts"
    >
      <div className="bb-shortcuts flex flex-1 min-w-0 items-center gap-3 flex-nowrap overflow-hidden">
        {shortcuts.map((s, i) => (
          <ShortcutChip key={`${s.key}-${i}`} shortcut={s} />
        ))}
        <ShortcutChip shortcut={helpShortcut} />
      </div>
      <div className="bb-status flex items-center gap-4 flex-shrink-0 uppercase font-bold tracking-[0.12em] text-[11px] text-muted-foreground">
        <span>
          SESSION <b className="text-foreground font-bold">{sessionElapsed}</b>
        </span>
        <span aria-hidden className="text-muted-foreground/60">|</span>
        <span>
          LOCAL <b className="text-foreground font-bold">{localClock}</b>
        </span>
      </div>
    </footer>
  );
}
