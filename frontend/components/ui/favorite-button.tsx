'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { favoritesApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  entityType: 'ITEM' | 'LOCATION' | 'CONTAINER';
  entityId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function FavoriteButton({
  entityType,
  entityId,
  className = '',
  size = 'md',
  showLabel = false,
  label = 'Favorite',
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    checkFavoriteStatus();
  }, [entityType, entityId]);

  const checkFavoriteStatus = async () => {
    try {
      setLoading(true);
      const result = await favoritesApi.check(entityType, entityId);
      setIsFavorited(result.is_favorited);
    } catch (err) {
      console.error('Failed to check favorite status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (toggling) return;

    try {
      setToggling(true);
      const result = await favoritesApi.toggle(entityType, entityId);
      setIsFavorited(result.is_favorited);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <button
        disabled
        className={cn(
          'inline-flex items-center gap-1 text-muted-foreground',
          className
        )}
      >
        <Heart className={cn(sizeClasses[size], 'animate-pulse')} />
        {showLabel && <span className="text-sm">{label}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={toggling}
      className={cn(
        'inline-flex items-center gap-1 transition-colors',
        isFavorited
          ? 'text-red-500 hover:text-red-600'
          : 'text-muted-foreground hover:text-red-500',
        toggling && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        className={cn(
          sizeClasses[size],
          'transition-all',
          isFavorited && 'fill-current',
          toggling && 'animate-pulse'
        )}
      />
      {showLabel && <span className="text-sm">{label}</span>}
    </button>
  );
}
