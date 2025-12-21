"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/api';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = tokenStorage.getToken();
    if (token) {
      // Redirect authenticated users to dashboard (keep current locale if possible)
      // For now, redirect to English dashboard - could be enhanced to detect preferred locale
      router.replace('/en/dashboard');
    } else {
      // Redirect unauthenticated users to landing page
      router.replace('/en');
    }
  }, [router]);

  return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
}