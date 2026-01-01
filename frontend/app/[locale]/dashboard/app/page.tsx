"use client";

import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { Link } from "@/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { RetroButton } from "@/components/retro";

export default function AppPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("app");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");
  const { isInstallable, isInstalled, install } = useInstallPrompt();

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

        {/* Install PWA Section */}
        <div className="bg-card border-4 border-border retro-shadow-md mb-4">
          <div className="border-b-4 border-border px-3 py-2 bg-secondary flex items-center gap-2">
            <Icon name="Download" className="w-3 h-3" style={{ color: NES_BLUE }} />
            <h2 className="retro-heading">{t("installPwa")}</h2>
          </div>
          <div className="p-4">
            {isInstalled ? (
              <div className="flex items-center gap-3 p-3 border-4 border-border bg-card">
                <div
                  className="w-12 h-12 border-2 border-border flex items-center justify-center"
                  style={{ backgroundColor: `${NES_GREEN}20` }}
                >
                  <Icon name="Check" className="w-6 h-6" style={{ color: NES_GREEN }} />
                </div>
                <div>
                  <p className="font-bold">{t("alreadyInstalled")}</p>
                  <p className="retro-small text-muted-foreground">{t("alreadyInstalledDesc")}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm mb-4">{t("pwaDescription")}</p>
                {isInstallable ? (
                  <RetroButton onClick={install} icon="Download">
                    {t("installNow")}
                  </RetroButton>
                ) : (
                  <div className="p-3 border-4 border-border bg-muted/50">
                    <p className="text-sm">{t("installInstructions")}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* How to Install Section */}
        {!isInstalled && (
          <div className="bg-card border-4 border-border retro-shadow-md mb-4">
            <div className="border-b-4 border-border px-3 py-2 bg-secondary flex items-center gap-2">
              <Icon name="HelpCircle" className="w-3 h-3" style={{ color: NES_GREEN }} />
              <h2 className="retro-heading">{t("howToInstall")}</h2>
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
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="bg-card border-4 border-border retro-shadow-md mb-4">
          <div className="border-b-4 border-border px-3 py-2 bg-secondary flex items-center gap-2">
            <Icon name="Sparkles" className="w-3 h-3" style={{ color: NES_YELLOW }} />
            <h2 className="retro-heading">{t("features")}</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Icon name="ScanBarcode" className="w-4 h-4" style={{ color: NES_BLUE }} />
              <span className="text-sm">{t("featureBarcode")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="QrCode" className="w-4 h-4" style={{ color: NES_GREEN }} />
              <span className="text-sm">{t("featureQR")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="WifiOff" className="w-4 h-4" style={{ color: NES_YELLOW }} />
              <span className="text-sm">{t("featureOffline")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Download" className="w-4 h-4" style={{ color: NES_RED }} />
              <span className="text-sm">{t("featureInstallable")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Smartphone" className="w-4 h-4" style={{ color: NES_BLUE }} />
              <span className="text-sm">{t("featureHomeScreen")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Zap" className="w-4 h-4" style={{ color: NES_GREEN }} />
              <span className="text-sm">{t("featureFast")}</span>
            </div>
          </div>
        </div>

        {/* Scanner Section */}
        <div className="bg-card border-4 border-border retro-shadow-md">
          <div className="border-b-4 border-border px-3 py-2 bg-secondary flex items-center gap-2">
            <Icon name="ScanBarcode" className="w-3 h-3" />
            <h2 className="retro-heading">{t("scanner")}</h2>
          </div>
          <div className="p-4">
            <p className="text-sm mb-3">{t("scannerDescription")}</p>
            <p className="retro-small text-muted-foreground border-t border-dashed border-muted pt-3">
              &gt; TIP: {t("scannerTip")}
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

      {/* Install PWA Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon name="Download" className="w-5 h-5 text-primary" />
          {t("installPwa")}
        </h2>
        {isInstalled ? (
          <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-green-50 dark:bg-green-950">
            <div className="w-14 h-14 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Icon name="Check" className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-lg">{t("alreadyInstalled")}</p>
              <p className="text-sm text-muted-foreground">{t("alreadyInstalledDesc")}</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-4">{t("pwaDescription")}</p>
            {isInstallable ? (
              <button
                onClick={install}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Icon name="Download" className="w-5 h-5" />
                {t("installNow")}
              </button>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">{t("installInstructions")}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* How to Install Section */}
      {!isInstalled && (
        <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Icon name="HelpCircle" className="w-5 h-5 text-primary" />
            {t("howToInstall")}
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
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon name="Sparkles" className="w-5 h-5 text-primary" />
          {t("features")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Icon name="ScanBarcode" className="w-5 h-5 text-primary" />
            <span>{t("featureBarcode")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="QrCode" className="w-5 h-5 text-primary" />
            <span>{t("featureQR")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="WifiOff" className="w-5 h-5 text-primary" />
            <span>{t("featureOffline")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Download" className="w-5 h-5 text-primary" />
            <span>{t("featureInstallable")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Smartphone" className="w-5 h-5 text-primary" />
            <span>{t("featureHomeScreen")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Zap" className="w-5 h-5 text-primary" />
            <span>{t("featureFast")}</span>
          </div>
        </div>
      </div>

      {/* Scanner Section */}
      <div className="bg-card p-6 border-2 border-border shadow-sm rounded-lg">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon name="ScanBarcode" className="w-5 h-5 text-primary" />
          {t("scanner")}
        </h2>
        <p className="text-muted-foreground mb-4">{t("scannerDescription")}</p>
        <p className="text-sm text-muted-foreground">{t("scannerTip")}</p>
      </div>
    </>
  );
}
