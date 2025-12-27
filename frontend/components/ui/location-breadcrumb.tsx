'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, MapPin } from 'lucide-react';
import { locationsApi, BreadcrumbItem } from '@/lib/api';

interface LocationBreadcrumbProps {
  locationId: string;
  className?: string;
  showIcon?: boolean;
  clickable?: boolean;
}

export function LocationBreadcrumb({
  locationId,
  className = '',
  showIcon = true,
  clickable = true,
}: LocationBreadcrumbProps) {
  const router = useRouter();
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (locationId) {
      fetchBreadcrumb();
    }
  }, [locationId]);

  const fetchBreadcrumb = async () => {
    try {
      setLoading(true);
      const data = await locationsApi.getBreadcrumb(locationId);
      setBreadcrumb(data);
    } catch (err) {
      console.error('Failed to fetch breadcrumb:', err);
      setBreadcrumb([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationClick = (id: string) => {
    if (clickable) {
      router.push(`/dashboard/locations?highlight=${id}`);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-1 text-sm text-muted-foreground ${className}`}>
        {showIcon && <MapPin className="w-4 h-4" />}
        <span className="animate-pulse">...</span>
      </div>
    );
  }

  if (breadcrumb.length === 0) {
    return null;
  }

  return (
    <nav className={`flex items-center gap-1 text-sm ${className}`} aria-label="Location path">
      {showIcon && <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      <ol className="flex items-center gap-1 flex-wrap">
        {breadcrumb.map((item, index) => (
          <li key={item.id} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
            {clickable ? (
              <button
                onClick={() => handleLocationClick(item.id)}
                className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                {item.name}
              </button>
            ) : (
              <span className="text-muted-foreground">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
