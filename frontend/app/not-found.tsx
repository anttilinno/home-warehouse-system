"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { tokenStorage } from '@/lib/api';

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Extract current locale from pathname, fallback to 'en'
    const currentLocale = pathname.startsWith('/') ? pathname.split('/')[1] : 'en';
    const locale = ['en', 'et', 'ru'].includes(currentLocale) ? currentLocale : 'en';

    // Check authentication and redirect appropriately
    const token = tokenStorage.getToken();
    if (token) {
      // Authenticated user gets 404, redirect to dashboard
      router.replace(`/${locale}/dashboard`);
    } else {
      // Unauthenticated user, redirect to landing page
      router.replace(`/${locale}`);
    }
  }, [router, pathname]);

  return <div className="flex items-center justify-center min-h-screen">Page not found, redirecting...</div>;
}