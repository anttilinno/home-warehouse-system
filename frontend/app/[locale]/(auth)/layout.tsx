import { setRequestLocale } from "next-intl/server";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { PawPrint } from "@/components/shared/paw-print";
import { KittenMascot } from "@/components/shared/pet-mascots";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

const pawDecorations = [
  { size: 28, top: "8%", left: "12%", rotate: -20, opacity: 0.12, delay: "0s" },
  { size: 18, top: "18%", right: "8%", rotate: 35, opacity: 0.10, delay: "0.5s" },
  { size: 34, bottom: "15%", left: "6%", rotate: 10, opacity: 0.10, delay: "1s" },
  { size: 22, top: "45%", right: "5%", rotate: -30, opacity: 0.08, delay: "1.5s" },
  { size: 16, bottom: "30%", right: "15%", rotate: 45, opacity: 0.10, delay: "0.8s" },
  { size: 26, top: "70%", left: "18%", rotate: -10, opacity: 0.10, delay: "1.2s" },
  { size: 20, top: "30%", left: "4%", rotate: 25, opacity: 0.08, delay: "0.3s" },
  { size: 14, bottom: "8%", right: "25%", rotate: -40, opacity: 0.10, delay: "2s" },
];

export default async function AuthLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 via-secondary/30 to-primary/10 p-4">
      {/* Pink/lavender gradient frame */}
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-primary/20 via-secondary/40 to-primary/15 p-3 shadow-xl">
        {/* Scattered paw prints on the frame */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          {pawDecorations.map((paw, i) => (
            <div
              key={i}
              className="absolute animate-float text-primary"
              style={{
                top: paw.top,
                left: paw.left,
                right: paw.right,
                bottom: paw.bottom,
                animationDelay: paw.delay,
                transform: `rotate(${paw.rotate}deg)`,
                opacity: paw.opacity,
              }}
            >
              <PawPrint size={paw.size} />
            </div>
          ))}
        </div>

        {/* Inner white content area */}
        <div className="relative rounded-2xl bg-background/95 backdrop-blur-sm px-6 py-8 space-y-6">
          {/* Top-right controls */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          {/* Hero section with pet photo */}
          <div className="flex flex-col items-center text-center space-y-3 pt-2">
            {/* Heart accent */}
            <div className="absolute top-12 left-8 text-primary/30 text-2xl">&#x2665;</div>

            {/* Circular pet photo */}
            <div className="relative">
              <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary/25 shadow-lg">
                <img
                  src="/pets-hero.jpg"
                  alt="Adorable puppies"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Small paw accent */}
              <div className="absolute -bottom-1 -right-1 bg-primary/15 rounded-full p-1.5">
                <PawPrint size={14} className="text-primary" />
              </div>
            </div>
            {/* App name */}
            <div>
              <h1 className="text-2xl font-bold font-[family-name:var(--font-quicksand)] text-foreground">
                Home Warehouse
              </h1>
              <p className="text-sm text-muted-foreground">Your home&apos;s happy place!</p>
            </div>
          </div>

          {/* Card content from child page */}
          {children}

          {/* Kitten mascot in bottom corner */}
          <div className="absolute bottom-4 right-4 text-primary opacity-15">
            <KittenMascot size={56} />
          </div>

          {/* Bottom decoration */}
          <div className="flex items-center justify-center gap-6 text-muted-foreground/40 text-xs pt-2">
            <span className="flex items-center gap-1.5">
              <PawPrint size={12} />
              Family Friendly
            </span>
            <span className="flex items-center gap-1.5">
              <PawPrint size={12} />
              Secure Play
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
