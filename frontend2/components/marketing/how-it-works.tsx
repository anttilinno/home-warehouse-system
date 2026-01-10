"use client";

import { useTranslations } from "next-intl";
import { UserPlus, FolderPlus, Search } from "lucide-react";

import { Container } from "@/components/layout/container";

const stepIcons = [UserPlus, FolderPlus, Search];

export function HowItWorks() {
  const t = useTranslations("howItWorks");

  const steps = [
    {
      step: "01",
      icon: stepIcons[0],
      title: t("step1.title"),
      description: t("step1.description"),
    },
    {
      step: "02",
      icon: stepIcons[1],
      title: t("step2.title"),
      description: t("step2.description"),
    },
    {
      step: "03",
      icon: stepIcons[2],
      title: t("step3.title"),
      description: t("step3.description"),
    },
  ];

  return (
    <section className="border-y bg-muted/30 py-20 md:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((item, index) => (
            <div key={item.step} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-12 hidden h-0.5 w-full -translate-x-1/2 bg-border md:block" />
              )}

              <div className="relative flex flex-col items-center text-center">
                {/* Step number & icon */}
                <div className="relative mb-6">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-background">
                    <item.icon className="h-10 w-10 text-primary" />
                  </div>
                  <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {item.step}
                  </span>
                </div>

                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
