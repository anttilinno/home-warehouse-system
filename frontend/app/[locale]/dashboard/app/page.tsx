"use client";

import { Icon } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import { Link } from "@/navigation";
import { useTranslations } from "next-intl";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useThemed, useThemedClasses } from "@/lib/themed";

export default function AppPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations("app");
  const themed = useThemed();
  const classes = useThemedClasses();
  const { Button, Card } = themed;
  const { isInstallable, isInstalled, install } = useInstallPrompt();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className={classes.loadingText}>Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <>
      {/* Header */}
      {classes.isRetro ? (
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
      ) : (
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
      )}

      {/* Install PWA Section */}
      <Card
        title={t("installPwa")}
        icon="Download"
        className="mb-4 md:mb-6"
      >
        {isInstalled ? (
          <div className={
            classes.isRetro
              ? "flex items-center gap-3 p-3 border-4 border-border bg-card"
              : "flex items-center gap-4 p-4 border border-border rounded-lg bg-green-50 dark:bg-green-950"
          }>
            <div
              className={
                classes.isRetro
                  ? "w-12 h-12 border-2 border-border flex items-center justify-center"
                  : "w-14 h-14 bg-green-500/20 rounded-lg flex items-center justify-center"
              }
              style={classes.isRetro ? { backgroundColor: `${NES_GREEN}20` } : undefined}
            >
              <Icon
                name="Check"
                className={classes.isRetro ? "w-6 h-6" : "w-7 h-7 text-green-500"}
                style={classes.isRetro ? { color: NES_GREEN } : undefined}
              />
            </div>
            <div>
              <p className={classes.isRetro ? "font-bold" : "font-bold text-lg"}>{t("alreadyInstalled")}</p>
              <p className={classes.isRetro ? "retro-small text-muted-foreground" : "text-sm text-muted-foreground"}>
                {t("alreadyInstalledDesc")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className={classes.isRetro ? "text-sm mb-4" : "text-muted-foreground mb-4"}>
              {t("pwaDescription")}
            </p>
            {isInstallable ? (
              <Button onClick={install} icon="Download">
                {t("installNow")}
              </Button>
            ) : (
              <div className={
                classes.isRetro
                  ? "p-3 border-4 border-border bg-muted/50"
                  : "p-4 bg-muted rounded-lg"
              }>
                <p className="text-sm">{t("installInstructions")}</p>
              </div>
            )}
          </>
        )}
      </Card>

      {/* How to Install Section */}
      {!isInstalled && (
        <Card
          title={t("howToInstall")}
          icon="HelpCircle"
          className="mb-4 md:mb-6"
        >
          <div className="space-y-4">
            {/* Step 1 */}
            <div className={classes.isRetro ? "flex gap-3" : "flex gap-4"}>
              <div
                className={
                  classes.isRetro
                    ? "w-8 h-8 border-2 border-border flex items-center justify-center flex-shrink-0 text-white font-bold"
                    : "w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0"
                }
                style={classes.isRetro ? { backgroundColor: NES_BLUE } : undefined}
              >
                1
              </div>
              <div>
                <p className="font-bold">{t("step1Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step1Description")}</p>
              </div>
            </div>
            {/* Step 2 */}
            <div className={classes.isRetro ? "flex gap-3" : "flex gap-4"}>
              <div
                className={
                  classes.isRetro
                    ? "w-8 h-8 border-2 border-border flex items-center justify-center flex-shrink-0 text-white font-bold"
                    : "w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0"
                }
                style={classes.isRetro ? { backgroundColor: NES_GREEN } : undefined}
              >
                2
              </div>
              <div>
                <p className="font-bold">{t("step2Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step2Description")}</p>
              </div>
            </div>
            {/* Step 3 */}
            <div className={classes.isRetro ? "flex gap-3" : "flex gap-4"}>
              <div
                className={
                  classes.isRetro
                    ? "w-8 h-8 border-2 border-border flex items-center justify-center flex-shrink-0 text-white font-bold"
                    : "w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0"
                }
                style={classes.isRetro ? { backgroundColor: NES_YELLOW, color: '#000' } : undefined}
              >
                3
              </div>
              <div>
                <p className="font-bold">{t("step3Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step3Description")}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Features Section */}
      <Card
        title={t("features")}
        icon="Sparkles"
        className="mb-4 md:mb-6"
      >
        <div className={
          classes.isRetro
            ? "grid grid-cols-1 md:grid-cols-2 gap-3"
            : "grid grid-cols-2 md:grid-cols-3 gap-4"
        }>
          <div className="flex items-center gap-2">
            <Icon
              name="ScanBarcode"
              className={classes.isRetro ? "w-4 h-4" : "w-5 h-5 text-primary"}
              style={classes.isRetro ? { color: NES_BLUE } : undefined}
            />
            <span className={classes.isRetro ? "text-sm" : undefined}>{t("featureBarcode")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon
              name="QrCode"
              className={classes.isRetro ? "w-4 h-4" : "w-5 h-5 text-primary"}
              style={classes.isRetro ? { color: NES_GREEN } : undefined}
            />
            <span className={classes.isRetro ? "text-sm" : undefined}>{t("featureQR")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon
              name="WifiOff"
              className={classes.isRetro ? "w-4 h-4" : "w-5 h-5 text-primary"}
              style={classes.isRetro ? { color: NES_YELLOW } : undefined}
            />
            <span className={classes.isRetro ? "text-sm" : undefined}>{t("featureOffline")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon
              name="Download"
              className={classes.isRetro ? "w-4 h-4" : "w-5 h-5 text-primary"}
              style={classes.isRetro ? { color: NES_RED } : undefined}
            />
            <span className={classes.isRetro ? "text-sm" : undefined}>{t("featureInstallable")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon
              name="Smartphone"
              className={classes.isRetro ? "w-4 h-4" : "w-5 h-5 text-primary"}
              style={classes.isRetro ? { color: NES_BLUE } : undefined}
            />
            <span className={classes.isRetro ? "text-sm" : undefined}>{t("featureHomeScreen")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon
              name="Zap"
              className={classes.isRetro ? "w-4 h-4" : "w-5 h-5 text-primary"}
              style={classes.isRetro ? { color: NES_GREEN } : undefined}
            />
            <span className={classes.isRetro ? "text-sm" : undefined}>{t("featureFast")}</span>
          </div>
        </div>
      </Card>

      {/* Scanner Section */}
      <Card
        title={t("scanner")}
        icon="ScanBarcode"
      >
        <p className={classes.isRetro ? "text-sm mb-3" : "text-muted-foreground mb-4"}>
          {t("scannerDescription")}
        </p>
        <p className={
          classes.isRetro
            ? "retro-small text-muted-foreground border-t border-dashed border-muted pt-3"
            : "text-sm text-muted-foreground"
        }>
          {classes.isRetro && <>&gt; TIP: </>}
          {t("scannerTip")}
        </p>
      </Card>
    </>
  );
}
