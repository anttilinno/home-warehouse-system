"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useThemed, useThemedClasses } from "@/lib/themed";
import { Icon } from "@/components/icons";
import { favoritesApi, FavoriteWithDetails } from "@/lib/api";
import { formatDate as formatDateUtil } from "@/lib/date-utils";
import { NES_BLUE, NES_GREEN, NES_RED } from "@/lib/nes-colors";

export default function FavoritesPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const t = useTranslations("favorites");
  const router = useRouter();
  const themed = useThemed();
  const classes = useThemedClasses();
  const { Button, PageHeader, EmptyState } = themed;
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
        router.push(`/dashboard/items/${favorite.entity_id}`);
        break;
      case "LOCATION":
        router.push(`/dashboard/locations?highlight=${favorite.entity_id}`);
        break;
      case "CONTAINER":
        router.push(`/dashboard/containers?highlight=${favorite.entity_id}`);
        break;
    }
  };

  const getIconName = (type: string): "Package" | "MapPin" | "Box" | "Heart" => {
    switch (type) {
      case "ITEM":
        return "Package";
      case "LOCATION":
        return "MapPin";
      case "CONTAINER":
        return "Box";
      default:
        return "Heart";
    }
  };

  const getIconColor = (type: string) => {
    if (classes.isRetro) {
      switch (type) {
        case "ITEM":
          return NES_BLUE;
        case "LOCATION":
          return NES_GREEN;
        case "CONTAINER":
          return NES_RED;
        default:
          return undefined;
      }
    }
    switch (type) {
      case "ITEM":
        return "text-blue-500";
      case "LOCATION":
        return "text-green-500";
      case "CONTAINER":
        return "text-purple-500";
      default:
        return "text-muted-foreground";
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
        <p className={classes.loadingText}>
          {classes.isRetro ? "Loading..." : t("loading")}
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className={`${classes.errorText} mb-4`}>{error}</p>
        <Button
          variant="primary"
          icon="RefreshCw"
          onClick={loadFavorites}
        >
          {t("tryAgain")}
        </Button>
      </div>
    );
  }

  const refreshAction = classes.isRetro ? (
    <button
      onClick={loadFavorites}
      className="px-3 py-2 bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 transition-colors flex items-center gap-2 retro-small uppercase"
    >
      <Icon name="RefreshCw" className="h-4 w-4" />
      {t("refresh")}
    </button>
  ) : (
    <button
      onClick={loadFavorites}
      className="px-3 py-2 border rounded-lg hover:bg-muted transition-colors flex items-center gap-2 text-sm"
    >
      <Icon name="RefreshCw" className="h-4 w-4" />
      {t("refresh")}
    </button>
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={classes.isRetro ? `${favorites.length} SAVED ITEMS` : `${t("subtitle")} (${favorites.length})`}
        actions={refreshAction}
      />

      {favorites.length === 0 ? (
        <EmptyState
          icon="Heart"
          message={t("noFavorites")}
          description={t("noFavoritesDescription")}
        />
      ) : (
        <div className="space-y-3">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className={classes.isRetro
                ? "retro-card retro-hover cursor-pointer"
                : "bg-card p-4 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer"
              }
              onClick={() => handleNavigate(favorite)}
            >
              <div className={classes.isRetro ? "flex items-center gap-4 p-4" : "flex items-start gap-4"}>
                {classes.isRetro ? (
                  <div
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center border-4 border-border"
                    style={{ backgroundColor: getIconColor(favorite.favorite_type) as string }}
                  >
                    <Icon name={getIconName(favorite.favorite_type)} className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <div className="flex-shrink-0 mt-1">
                    <Icon name={getIconName(favorite.favorite_type)} className={`h-5 w-5 ${getIconColor(favorite.favorite_type)}`} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {classes.isRetro ? (
                    <>
                      <h3 className="retro-heading">
                        {favorite.entity_name}
                      </h3>
                      {favorite.entity_description && (
                        <p className="text-sm text-muted-foreground retro-body mt-1 line-clamp-1">
                          {favorite.entity_description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="text-xs px-2 py-1 border-2 border-border retro-heading uppercase"
                          style={{ backgroundColor: getIconColor(favorite.favorite_type) as string, color: "white" }}
                        >
                          {getTypeLabel(favorite.favorite_type)}
                        </span>
                        <span className="text-xs text-muted-foreground retro-body">
                          {t("addedOn")} {formatDate(favorite.created_at)}
                        </span>
                      </div>
                    </>
                  ) : (
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
                        <Icon name="Trash2" className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                {classes.isRetro && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(favorite);
                    }}
                    disabled={removing === favorite.id}
                    className="flex-shrink-0 p-2 border-2 border-border hover:bg-primary hover:text-white text-muted-foreground transition-colors disabled:opacity-50"
                    title={t("remove")}
                  >
                    <Icon name="Trash2" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Retro footer */}
      {classes.isRetro && (
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground retro-heading uppercase">
            Click to navigate
          </p>
        </div>
      )}
    </>
  );
}
