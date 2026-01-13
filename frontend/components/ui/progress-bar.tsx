"use client";

import { AppProgressBar as NProgressBar } from "next-nprogress-bar";
import { useTheme } from "next-themes";

export function ProgressBar() {
  const { theme } = useTheme();

  return (
    <NProgressBar
      height="2px"
      color={theme === "dark" ? "#8b5cf6" : "#7c3aed"}
      options={{ showSpinner: false }}
      shallowRouting
    />
  );
}
