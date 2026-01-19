"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { placeholderColors } from "@/lib/config/constants";

interface LazyPhotoProps {
  src: string;
  thumbnailSrc?: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  sizes?: string;
  priority?: boolean;
  onClick?: () => void;
  blurDataURL?: string;
}

/**
 * LazyPhoto component with intersection observer for lazy loading
 * and blur-up technique for smooth loading experience.
 *
 * Features:
 * - Lazy loading with IntersectionObserver
 * - Blur-up technique with tiny thumbnail placeholder
 * - Smooth transition from blurred to sharp image
 * - Skeleton loading state
 * - Error state handling
 */
export function LazyPhoto({
  src,
  thumbnailSrc,
  alt,
  fill = false,
  width,
  height,
  className,
  objectFit = "cover",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  priority = false,
  onClick,
  blurDataURL,
}: LazyPhotoProps) {
  const [isVisible, setIsVisible] = useState(priority);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "200px", // Start loading 200px before entering viewport
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isVisible]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  // Common image styles
  const imageClassName = cn(
    "transition-all duration-300",
    objectFit === "cover" && "object-cover",
    objectFit === "contain" && "object-contain",
    objectFit === "fill" && "object-fill",
    objectFit === "none" && "object-none",
    objectFit === "scale-down" && "object-scale-down"
  );

  // If there's an error, show placeholder
  if (hasError) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          fill && "absolute inset-0",
          className
        )}
        style={!fill ? { width, height } : undefined}
        onClick={onClick}
      >
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        fill && "absolute inset-0",
        className
      )}
      style={!fill ? { width, height } : undefined}
      onClick={onClick}
    >
      {/* Skeleton placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {/* Blurred thumbnail placeholder */}
      {thumbnailSrc && !isLoaded && isVisible && (
        <Image
          src={thumbnailSrc}
          alt=""
          fill={fill}
          width={!fill ? width : undefined}
          height={!fill ? height : undefined}
          className={cn(imageClassName, "blur-lg scale-110")}
          sizes={sizes}
          aria-hidden="true"
        />
      )}

      {/* Main image - only load when visible */}
      {isVisible && (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          width={!fill ? width : undefined}
          height={!fill ? height : undefined}
          className={cn(
            imageClassName,
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          sizes={sizes}
          onLoad={handleLoad}
          onError={handleError}
          placeholder={blurDataURL ? "blur" : "empty"}
          blurDataURL={blurDataURL}
          priority={priority}
        />
      )}
    </div>
  );
}

/**
 * Generate a tiny placeholder data URL for blur-up effect
 * Uses a 10x10 pixel placeholder with dominant color
 */
export function generatePlaceholderDataURL(
  dominantColor: string = placeholderColors.imageBg
): string {
  // Create a tiny SVG as data URL for placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${dominantColor}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
