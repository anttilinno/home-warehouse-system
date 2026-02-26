"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { PawPrint } from "./paw-print";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  const [wiggle, setWiggle] = useState(false);

  return (
    <Link
      href="/"
      className={`flex items-center gap-2 ${className ?? ""}`}
      onMouseEnter={() => setWiggle(true)}
      onAnimationEnd={() => setWiggle(false)}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
        <PawPrint
          size={20}
          className={`text-primary-foreground ${wiggle ? "animate-wiggle" : ""}`}
        />
      </div>
      {showText && (
        <span className="text-xl font-bold tracking-tight font-[family-name:var(--font-quicksand)]">
          Home Warehouse
        </span>
      )}
    </Link>
  );
}
