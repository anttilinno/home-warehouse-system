import { useEffect, useRef } from "react";
import { tinykeys } from "tinykeys";

// TUI-05 open chord owner. ONE window-level tinykeys listener, mounted once,
// fires the palette open even while a form input is focused, and prevents the
// literal key from being typed. Stays in the MAIN bundle (tinykeys ~2.4KB) — the
// palette body itself is React.lazy-loaded by ShellChrome (16-03).
//
// RENDER-LOOP LANDMINE (recurring 4× bug): the subscription lives in
// useEffect([], …) mounted ONCE; the latest open() is read through `openRef`
// (updated in a separate ref-sync effect). NO fresh fns/objects in the chord
// effect deps — a fresh closure there re-subscribes every render and double-fires.
//
// OVERRIDE A (16-RESEARCH): tinykeys@4 ignores keydown from input/textarea/
// select/[contenteditable] by default (it bins on currentTarget). We bind to
// window, so the default would swallow the chord while typing — pass
// `{ ignore: () => false }` to make the global chord fire from anywhere.

export function usePaletteChord(open: () => void): void {
  // Stash the latest open() so the subscription effect's deps stay [].
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  useEffect(() => {
    const unsubscribe = tinykeys(
      window,
      {
        "$mod+k": (event) => {
          event.preventDefault();
          openRef.current();
        },
        F2: (event) => {
          event.preventDefault();
          openRef.current();
        },
      },
      // OVERRIDE A — fire even from a focused input (global chord).
      { ignore: () => false },
    );
    return unsubscribe; // StrictMode-safe clean teardown.
  }, []); // mount once — NO fresh fns in deps (render-loop landmine).
}
