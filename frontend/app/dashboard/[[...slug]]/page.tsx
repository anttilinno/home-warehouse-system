"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { tokenStorage } from '@/lib/api';

export default function DashboardCatchAll() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Try to detect locale from referrer or use default
    // Since this is a catch-all for non-locale routes, default to 'en'
    const locale = 'en';

    // Check authentication and redirect appropriately
    const token = tokenStorage.getToken();
    if (token) {
      // User is authenticated, redirect to dashboard
      router.replace(`/${locale}/dashboard`);
    } else {
      // User is not authenticated, redirect to login
      router.replace(`/${locale}/login`);
    }
  }, [router, pathname]);

  return <div className="flex items-center justify-center min-h-screen">Redirecting...</div>;
}