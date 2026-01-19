"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

export function Hero() {
  const t = useTranslations("hero");

  const highlights = [
    t("highlights.workspaces"),
    t("highlights.scanning"),
    t("highlights.loans"),
    t("highlights.export"),
  ];

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]" />

      <Container>
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center rounded-full border bg-muted px-4 py-1.5 text-sm">
            <span className="mr-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {t("badge")}
            </span>
            <span className="text-muted-foreground">{t("badgeText")}</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {t("titleStart")}{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t("titleHighlight")}
            </span>{" "}
            {t("titleEnd")}
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            {t("subtitle")}
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                {t("ctaPrimary")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/features">{t("ctaSecondary")}</Link>
            </Button>
          </div>

          {/* Highlights */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {highlights.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Image / Screenshot */}
        <div className="mt-16 md:mt-24">
          <div className="relative mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-muted/50 to-muted shadow-2xl">
              <Image
                src="/images/dashboard-preview.png"
                alt={t("dashboardPreview")}
                width={1920}
                height={1200}
                className="w-full h-auto"
                priority
              />
            </div>

            {/* Decorative elements */}
            <div className="absolute -left-4 -top-4 -z-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute -bottom-4 -right-4 -z-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
          </div>
        </div>
      </Container>
    </section>
  );
}
