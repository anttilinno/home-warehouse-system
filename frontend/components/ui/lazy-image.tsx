"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Blur data URL for placeholder (optional) */
  placeholder?: string;
  /** Root margin for intersection observer. Default: "50px" */
  rootMargin?: string;
  /** Threshold for intersection observer. Default: 0.01 */
  threshold?: number;
  /** Custom class for the container */
  containerClassName?: string;
}

/**
 * LazyImage component with intersection observer and blur-up technique
 * Shows a blurred placeholder while loading and fades in the final image
 */
export function LazyImage({
  src,
  alt,
  placeholder,
  rootMargin = "50px",
  threshold = 0.01,
  className,
  containerClassName,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Create intersection observer
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(img);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {/* Placeholder */}
      {placeholder && !isLoaded && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 w-full h-full object-cover blur-sm scale-110 transition-opacity duration-300",
            isLoaded && "opacity-0"
          )}
        />
      )}

      {/* Skeleton loader */}
      {!placeholder && !isLoaded && (
        <div
          className={cn(
            "absolute inset-0 bg-muted animate-pulse transition-opacity duration-300",
            isLoaded && "opacity-0"
          )}
        />
      )}

      {/* Actual image */}
      <img
        ref={imgRef}
        src={isInView ? src : undefined}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setIsLoaded(true)}
        {...props}
      />
    </div>
  );
}
