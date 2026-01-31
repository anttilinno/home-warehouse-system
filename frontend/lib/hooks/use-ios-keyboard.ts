"use client";

import { useState, useEffect, useCallback } from "react";

interface ViewportOffset {
  top: number;
  height: number;
  keyboardHeight: number;
}

/**
 * Hook for detecting iOS keyboard using Visual Viewport API.
 * Provides offset values and style helpers for fixed bottom elements.
 *
 * @returns { offset, isKeyboardOpen, getFixedBottomStyle }
 */
export function useIOSKeyboard() {
  const [offset, setOffset] = useState<ViewportOffset>({
    top: 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    keyboardHeight: 0,
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // Only run on iOS Safari in browser
    if (typeof window === "undefined") return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const vv = visualViewport;
    if (!isIOS || !vv) {
      return;
    }

    const handleResize = () => {
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - vv.height;

      setOffset({
        top: vv.offsetTop,
        height: vv.height,
        keyboardHeight: Math.max(0, keyboardHeight),
      });
      setIsKeyboardOpen(keyboardHeight > 100);
    };

    // Known iOS 26 bug workaround: also listen for blur events
    const handleBlur = (e: FocusEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Small delay to let keyboard animation complete
        setTimeout(() => {
          if (
            !document.activeElement ||
            (!(document.activeElement instanceof HTMLInputElement) &&
              !(document.activeElement instanceof HTMLTextAreaElement))
          ) {
            setOffset({
              top: 0,
              height: window.innerHeight,
              keyboardHeight: 0,
            });
            setIsKeyboardOpen(false);
          }
        }, 100);
      }
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    document.addEventListener("blur", handleBlur, true);

    // Initial check
    handleResize();

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
      document.removeEventListener("blur", handleBlur, true);
    };
  }, []);

  // Style generator for fixed bottom elements
  const getFixedBottomStyle = useCallback((): React.CSSProperties => {
    if (!isKeyboardOpen) {
      return { position: "fixed", bottom: 0 };
    }
    return {
      position: "fixed",
      bottom: offset.keyboardHeight,
      transition: "bottom 0.1s ease-out",
    };
  }, [isKeyboardOpen, offset.keyboardHeight]);

  return { offset, isKeyboardOpen, getFixedBottomStyle };
}
