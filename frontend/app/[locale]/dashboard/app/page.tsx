"use client";

import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { Link } from "@/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";

export default function AppPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("app");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (isRetro) {
    return (
      <>
        {/* Header */}
        <header className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="ArrowLeft" className="w-4 h-4" />
            </Link>
            <h1 className="retro-title">{t("title")}</h1>
          </div>
          <p className="text-muted-foreground font-mono text-xs">
            &gt; {t("subtitle")}
          </p>
        </header>

        {/* Download Expo Go Section */}
        <div className="bg-card border-4 border-border retro-shadow-md mb-4">
          <div className="border-b-4 border-border px-3 py-2 bg-secondary flex items-center gap-2">
            <Icon name="Download" className="w-3 h-3" style={{ color: NES_BLUE }} />
            <h2 className="retro-heading">{t("downloadExpoGo")}</h2>
          </div>
          <div className="p-4">
            <p className="text-sm mb-4">{t("expoGoDescription")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Expo Go */}
              <a
                href="https://expo.dev/go"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border-4 border-border hover:border-primary transition-colors bg-card"
              >
                <div
                  className="w-12 h-12 border-2 border-border flex items-center justify-center"
                  style={{ backgroundColor: `${NES_BLUE}20` }}
                >
                  <Icon name="Smartphone" className="w-6 h-6" style={{ color: NES_BLUE }} />
                </div>
                <div>
                  <p className="font-bold">Expo Go</p>
                  <p className="retro-small text-muted-foreground">expo.dev</p>
                </div>
              </a>
              {/* Google Play */}
              <a
                href="https://play.google.com/store/apps/details?id=host.exp.exponent"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border-4 border-border hover:border-primary transition-colors bg-card"
              >
                <div
                  className="w-12 h-12 border-2 border-border flex items-center justify-center"
                  style={{ backgroundColor: `${NES_GREEN}20` }}
                >
                  <Icon name="Smartphone" className="w-6 h-6" style={{ color: NES_GREEN }} />
                </div>
                <div>
                  <p className="font-bold">Google Play</p>
                  <p className="retro-small text-muted-foreground">Android</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* How to Use Section */}
        <div className="bg-card border-4 border-border retro-shadow-md mb-4">
          <div className="border-b-4 border-border px-3 py-2 bg-secondary flex items-center gap-2">
            <Icon name="HelpCircle" className="w-3 h-3" style={{ color: NES_GREEN }} />
            <h2 className="retro-heading">{t("howToUse")}</h2>
          </div>
          <div className="p-4 space-y-4">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div
                className="w-8 h-8 border-2 border-border flex items-center justify-center flex-shrink-0 text-white font-bold"
                style={{ backgroundColor: NES_BLUE }}
              >
                1
              </div>
              <div>
                <p className="font-bold">{t("step1Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step1Description")}</p>
              </div>
            </div>
            {/* Step 2 */}
            <div className="flex gap-3">
              <div
                className="w-8 h-8 border-2 border-border flex items-center justify-center flex-shrink-0 text-white font-bold"
                style={{ backgroundColor: NES_GREEN }}
              >
                2
              </div>
              <div>
                <p className="font-bold">{t("step2Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step2Description")}</p>
              </div>
            </div>
            {/* Step 3 */}
            <div className="flex gap-3">
              <div
                className="w-8 h-8 border-2 border-border flex items-center justify-center flex-shrink-0 text-white font-bold"
                style={{ backgroundColor: NES_YELLOW, color: '#000' }}
              >
                3
              </div>
              <div>
                <p className="font-bold">{t("step3Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step3Description")}</p>
              </div>
            </div>
            {/* Step 4 */}
            <div className="flex gap-3">
              <div
                className="w-8 h-8 border-2 border-border flex items-center justify-center flex-shrink-0 text-white font-bold"
                style={{ backgroundColor: NES_RED }}
              >
                4
              </div>
              <div>
                <p className="font-bold">{t("step4Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step4Description")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-card border-4 border-border retro-shadow-md mb-4">
          <div className="border-b-4 border-border px-3 py-2 bg-secondary flex items-center gap-2">
            <Icon name="Sparkles" className="w-3 h-3" style={{ color: NES_YELLOW }} />
            <h2 className="retro-heading">{t("features")}</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Icon name="QrCode" className="w-4 h-4" style={{ color: NES_BLUE }} />
              <span className="text-sm">{t("featureBarcode")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Scan" className="w-4 h-4" style={{ color: NES_GREEN }} />
              <span className="text-sm">{t("featureQR")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Camera" className="w-4 h-4" style={{ color: NES_YELLOW }} />
              <span className="text-sm">{t("featurePhoto")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Wifi" className="w-4 h-4" style={{ color: NES_RED }} />
              <span className="text-sm">{t("featureOffline")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Bell" className="w-4 h-4" style={{ color: NES_BLUE }} />
              <span className="text-sm">{t("featureNotifications")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Zap" className="w-4 h-4" style={{ color: NES_GREEN }} />
              <span className="text-sm">{t("featureQuickAdd")}</span>
            </div>
          </div>
        </div>

        {/* Quick Setup Section */}
        <div className="bg-card border-4 border-border retro-shadow-md">
          <div className="border-b-4 border-border px-3 py-2 bg-secondary flex items-center gap-2">
            <Icon name="QrCode" className="w-3 h-3" />
            <h2 className="retro-heading">{t("qrSetup")}</h2>
          </div>
          <div className="p-4">
            <p className="text-sm mb-3">{t("qrSetupDescription")}</p>
            <div className="border-2 border-border bg-muted/50 p-3 font-mono text-sm mb-3">
              <p className="text-muted-foreground mb-1"># {t("runCommand")}</p>
              <p className="text-foreground">cd mobile && npx expo start</p>
            </div>
            <div className="border-2 border-dashed border-muted p-4 text-center mb-3">
              <Icon name="QrCode" className="w-16 h-16 mx-auto text-muted-foreground mb-2" />
              <p className="retro-small text-muted-foreground">{t("qrPlaceholder")}</p>
            </div>
            <p className="retro-small text-muted-foreground border-t border-dashed border-muted pt-3">
              &gt; TIP: {t("qrTip")}
            </p>
          </div>
        </div>
      </>
    );
  }

  // Standard theme
  return (
    <>
      <div className="mb-8 border-l-4 border-primary pl-4 py-1">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowLeft" className="w-5 h-5" />
          </Link>
          <h1 className="text-4xl font-bold text-foreground leading-none">{t("title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Download Expo Go Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon name="Download" className="w-5 h-5 text-primary" />
          {t("downloadExpoGo")}
        </h2>
        <p className="text-muted-foreground mb-4">{t("expoGoDescription")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://expo.dev/go"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon name="Smartphone" className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg">Expo Go</p>
              <p className="text-sm text-muted-foreground">expo.dev</p>
            </div>
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=host.exp.exponent"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <div className="w-14 h-14 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Icon name="Smartphone" className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-lg">Google Play</p>
              <p className="text-sm text-muted-foreground">Android</p>
            </div>
          </a>
        </div>
      </div>

      {/* How to Use Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon name="HelpCircle" className="w-5 h-5 text-primary" />
          {t("howToUse")}
        </h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-bold">{t("step1Title")}</p>
              <p className="text-sm text-muted-foreground">{t("step1Description")}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-bold">{t("step2Title")}</p>
              <p className="text-sm text-muted-foreground">{t("step2Description")}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-bold">{t("step3Title")}</p>
              <p className="text-sm text-muted-foreground">{t("step3Description")}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0">
              4
            </div>
            <div>
              <p className="font-bold">{t("step4Title")}</p>
              <p className="text-sm text-muted-foreground">{t("step4Description")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon name="Sparkles" className="w-5 h-5 text-primary" />
          {t("features")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Icon name="QrCode" className="w-5 h-5 text-primary" />
            <span>{t("featureBarcode")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Scan" className="w-5 h-5 text-primary" />
            <span>{t("featureQR")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Camera" className="w-5 h-5 text-primary" />
            <span>{t("featurePhoto")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Wifi" className="w-5 h-5 text-primary" />
            <span>{t("featureOffline")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Bell" className="w-5 h-5 text-primary" />
            <span>{t("featureNotifications")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Zap" className="w-5 h-5 text-primary" />
            <span>{t("featureQuickAdd")}</span>
          </div>
        </div>
      </div>

      {/* Quick Setup Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon name="QrCode" className="w-5 h-5 text-primary" />
          {t("qrSetup")}
        </h2>
        <p className="text-muted-foreground mb-4">{t("qrSetupDescription")}</p>
        <div className="bg-muted/50 border border-border rounded-lg p-4 font-mono text-sm mb-4">
          <p className="text-muted-foreground mb-1"># {t("runCommand")}</p>
          <p className="text-foreground">cd mobile && npx expo start</p>
        </div>
        <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center mb-4">
          <Icon name="QrCode" className="w-20 h-20 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t("qrPlaceholder")}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t("qrTip")}</p>
      </div>
    </>
  );
}
