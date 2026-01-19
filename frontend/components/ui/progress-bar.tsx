"use client";

import { AppProgressBar as NProgressBar } from "next-nprogress-bar";

export function ProgressBar() {
  return (
    <NProgressBar
      height="2px"
      color="oklch(var(--primary))"
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
}
