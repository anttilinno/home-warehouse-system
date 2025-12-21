"use client";

import { Package, LogIn, LogOut } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/navigation";
import { useAuth } from "@/lib/auth";

export function Header() {
  const t = useTranslations('auth');
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="absolute top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold text-foreground">HMS</span>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="flex items-center justify-center px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                style={{ minWidth: '120px' }}
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="truncate ml-2">Logout</span>
              </button>
            ) : (
              <Link href="/login">
                <button className="flex items-center justify-center px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors" style={{ minWidth: '120px' }}>
                  <LogIn className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate ml-2">{t('signIn')}</span>
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
