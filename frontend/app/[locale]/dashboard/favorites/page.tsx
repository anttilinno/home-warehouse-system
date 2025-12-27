"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Heart, RefreshCw, Package, MapPin, Box, Trash2 } from "lucide-react";
import { favoritesApi, FavoriteWithDetails } from "@/lib/api";
import { formatDate as formatDateUtil } from "@/lib/date-utils";

export default function FavoritesPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const t = useTranslations("favorites");
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await favoritesApi.list();
      setFavorites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFavorites();
    }
  }, [isAuthenticated]);

  const handleRemove = async (favorite: FavoriteWithDetails) => {
    try {
      setRemoving(favorite.id);
      await favoritesApi.remove(favorite.favorite_type, favorite.entity_id);
      setFavorites((prev) => prev.filter((f) => f.id !== favorite.id));
    } catch (err) {
      console.error("Failed to remove favorite:", err);
    } finally {
      setRemoving(null);
    }
  };

  const handleNavigate = (favorite: FavoriteWithDetails) => {
    switch (favorite.favorite_type) {
      case "ITEM":
        router.push(`/dashboard/items?highlight=${favorite.entity_id}`);
        break;
      case "LOCATION":
        router.push(`/dashboard/locations?highlight=${favorite.entity_id}`);
        break;
      case "CONTAINER":
        router.push(`/dashboard/containers?highlight=${favorite.entity_id}`);
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "ITEM":
        return <Package className="h-5 w-5 text-blue-500" />;
      case "LOCATION":
        return <MapPin className="h-5 w-5 text-green-500" />;
      case "CONTAINER":
        return <Box className="h-5 w-5 text-purple-500" />;
      default:
        return <Heart className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ITEM":
        return t("typeItem");
      case "LOCATION":
        return t("typeLocation");
      case "CONTAINER":
        return t("typeContainer");
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    return formatDateUtil(dateString, user?.date_format);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={loadFavorites}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("subtitle")} ({favorites.length})
          </p>
        </div>
        <button
          onClick={loadFavorites}
          className="px-3 py-2 border rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          {t("refresh")}
        </button>
      </div>

      {favorites.length === 0 ? (
        <div className="bg-card p-8 rounded-lg border text-center">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("noFavorites")}</h3>
          <p className="text-muted-foreground">{t("noFavoritesDescription")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="bg-card p-4 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => handleNavigate(favorite)}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getIcon(favorite.favorite_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium">{favorite.entity_name}</h3>
                      {favorite.entity_description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {favorite.entity_description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                          {getTypeLabel(favorite.favorite_type)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("addedOn")} {formatDate(favorite.created_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(favorite);
                      }}
                      disabled={removing === favorite.id}
                      className="flex-shrink-0 p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title={t("remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
