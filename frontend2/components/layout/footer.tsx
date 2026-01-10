"use client";

import { useTranslations } from "next-intl";
import { Package } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/container";

export function Footer() {
  const t = useTranslations("footer");

  const footerNav = {
    product: [
      { title: t("links.features"), href: "/features" },
      { title: t("links.pricing"), href: "/pricing" },
      { title: t("links.changelog"), href: "/changelog" },
    ],
    resources: [
      { title: t("links.documentation"), href: "/docs" },
      { title: t("links.apiReference"), href: "/api" },
      { title: t("links.support"), href: "/support" },
    ],
    company: [
      { title: t("links.about"), href: "/about" },
      { title: t("links.blog"), href: "/blog" },
      { title: t("links.contact"), href: "/contact" },
    ],
    legal: [
      { title: t("links.privacy"), href: "/privacy" },
      { title: t("links.terms"), href: "/terms" },
    ],
  };

  return (
    <footer className="border-t bg-muted/30">
      <Container>
        <div className="py-12 md:py-16">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Package className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold">Home Warehouse</span>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                {t("tagline")}
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold">{t("product")}</h3>
              <ul className="mt-4 space-y-3">
                {footerNav.product.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-sm font-semibold">{t("resources")}</h3>
              <ul className="mt-4 space-y-3">
                {footerNav.resources.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold">{t("company")}</h3>
              <ul className="mt-4 space-y-3">
                {footerNav.company.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-semibold">{t("legal")}</h3>
              <ul className="mt-4 space-y-3">
                {footerNav.legal.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-12 border-t pt-8">
            <p className="text-center text-sm text-muted-foreground">
              {t("copyright", { year: new Date().getFullYear() })}
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
