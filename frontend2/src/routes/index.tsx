import { Routes, Route } from "react-router";

// Library-mode RR7 (NOT framework mode — AP-1). The placeholder shell is the
// single Phase 1 page; later phases (2 tokens, 3 chrome, 4 atoms, 5+ features)
// add real routes against this baseline.

function PlaceholderShell() {
  return (
    <main style={{ padding: 16, fontFamily: "monospace" }}>
      <h1>frontend2 — v3.0 placeholder shell</h1>
      <p>
        Phase 1 scaffold OK. Tokens (Phase 2), chrome (Phase 3), atoms
        (Phase 4) follow.
      </p>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PlaceholderShell />} />
      <Route path="*" element={<PlaceholderShell />} />
    </Routes>
  );
}
