"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

interface AuthRedirectProps {
  children: React.ReactNode;
}

/**
 * Redirects authenticated users to dashboard.
 * Used on landing page to skip it for logged-in users.
 */
export function RedirectIfAuthenticated({ children }: AuthRedirectProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Extract locale from pathname (e.g., /en -> en, /ru -> ru)
      const locale = pathname.split('/')[1] || 'en';
      router.replace(`/${locale}/dashboard`);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  // Show nothing while checking auth or redirecting
  if (isLoading || isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
