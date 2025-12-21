"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterCatchAll() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/en/register');
  }, [router]);

  return <div className="flex items-center justify-center min-h-screen">Redirecting...</div>;
}