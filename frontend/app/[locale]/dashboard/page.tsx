"use client";

import {
  Package,
  MapPin,
  Users,
  Archive
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "@/navigation";
import { useEffect, useState } from "react";
import { dashboardApi, DashboardStats, tokenStorage } from "@/lib/api";
import { Header } from "@/components/header";
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Don't automatically redirect on authentication state changes
  // Logout handlers will manage redirects appropriately
  // Initial unauthenticated access is handled by catch-all routes

  // Also handle the case where authentication fails during API calls
  useEffect(() => {
    if (isAuthenticated && error && error.includes('Authentication required')) {
      // If we get an auth error, redirect to login (next-intl adds locale)
      router.push("/login");
    }
  }, [error, isAuthenticated, router]);

  // Also handle JWT token expiration or invalid tokens
  useEffect(() => {
    if (isAuthenticated && error) {
      // If we get an authentication error, redirect to login
      if (error.includes('401') || error.includes('Unauthorized') || error.includes('token')) {
        tokenStorage.removeToken();
        router.push("/login");
      }
    }
  }, [error, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [isAuthenticated]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await dashboardApi.getStats();
      setStats(data);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);

      // If it's an authentication error, the API client will handle the redirect
      if (errorMessage.includes('Authentication required')) {
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      name: t('totalItems'),
      value: stats?.total_items.toLocaleString() || "0",
      change: "+0", // TODO: Calculate actual change from previous period
      changeType: "neutral" as const,
      icon: Package,
    },
    {
      name: t('locations'),
      value: stats?.total_locations.toString() || "0",
      change: "+0", // TODO: Calculate actual change from previous period
      changeType: "neutral" as const,
      icon: MapPin,
    },
    {
      name: t('activeLoans'),
      value: stats?.active_loans.toString() || "0",
      change: "+0", // TODO: Calculate actual change from previous period
      changeType: "neutral" as const,
      icon: Users,
    },
    {
      name: t('categories'),
      value: stats?.total_categories.toString() || "0",
      change: "+0", // TODO: Calculate actual change from previous period
      changeType: "neutral" as const,
      icon: Archive,
    },
  ];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-card p-6 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.name}
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                </div>
                <Icon className="w-8 h-8 text-primary" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Debug info - can be removed in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-center text-muted-foreground mt-8">
          <p className="text-sm">
            Debug: Items: {stats?.total_items} |
            Locations: {stats?.total_locations} |
            Loans: {stats?.active_loans} |
            Categories: {stats?.total_categories}
          </p>
        </div>
      )}
    </>
  );
}
