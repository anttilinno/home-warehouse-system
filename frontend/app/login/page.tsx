"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginCatchAll() {
  const router = useRouter();

  useEffect(() => {
    // Default to English for catch-all login route
    router.replace('/en/login');
  }, [router]);

  return <div className="flex items-center justify-center min-h-screen">Redirecting...</div>;
}