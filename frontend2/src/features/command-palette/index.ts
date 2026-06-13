// Command-palette feature barrel.
//
// DEFAULT export = the lazy palette BODY (CommandPalette). 16-03's ShellChrome
// does `const CommandPalette = lazy(() => import("@/features/command-palette"))`
// so the cmdk + radix-dialog tree lands in the `palette` chunk, not the entry.
//
// NAMED export = usePaletteChord — the tiny tinykeys open-chord owner that STAYS
// in the main bundle (16-03 calls it directly to flip the open state).
export { default } from "./CommandPalette";
export { usePaletteChord } from "./usePaletteChord";
export type { CommandPaletteProps } from "./CommandPalette";
