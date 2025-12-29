"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icons";
import {
  containersApi,
  locationsApi,
  getTranslatedErrorMessage,
  Container,
  ContainerCreate,
  ContainerUpdate,
  Location,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ContainersPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const router = useRouter();
  const t = useTranslations("containers");
  const te = useTranslations("errors");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

  // Data state
  const [containers, setContainers] = useState<Container[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null);

  // Lookup map for location names
  const locationMap = useMemo(
    () => new Map(locations.map((loc) => [loc.id, loc])),
    [locations]
  );

  const getLocationName = (locationId: string) => {
    return locationMap.get(locationId)?.name || "Unknown";
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [containersData, locationsData] = await Promise.all([
        containersApi.list(),
        locationsApi.list(),
      ]);
      setContainers(containersData);
      setLocations(locationsData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load containers";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (container: Container) => {
    setSelectedContainer(container);
    setIsEditModalOpen(true);
  };

  const handleDelete = (container: Container) => {
    setSelectedContainer(container);
    setIsDeleteModalOpen(true);
  };

  if (authLoading || loading) {
    if (isRetro) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="retro-small uppercase font-bold animate-pulse retro-heading">
            Loading...
          </p>
        </div>
      );
    }
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
    if (isRetro) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-primary mb-4 retro-body">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-primary text-white border-4 border-border retro-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:retro-shadow-sm transition-all retro-heading"
            >
              {t("tryAgain")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  // Retro NES theme
  if (isRetro) {
    return (
      <>
        {/* Header */}
        <div className="mb-8 bg-primary p-4 border-4 border-border retro-shadow">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-white uppercase retro-heading">
                {t("title")}
              </h1>
              <p className="text-white/80 retro-small mt-1">
                &gt; {containers.length} STORAGE CONTAINERS
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 transition-colors flex items-center gap-2 retro-small uppercase"
              >
                <Icon name="Plus" className="w-4 h-4" />
                {t("addContainer")}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {containers.length === 0 ? (
          <div className="bg-card border-4 border-border retro-shadow p-12 text-center">
            <Icon name="Box" className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground retro-body">{t("noContainers")}</p>
            {canEdit && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 px-4 py-2 bg-primary text-white border-4 border-border retro-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:retro-shadow-sm transition-all inline-flex items-center gap-2 retro-heading"
              >
                <Icon name="Plus" className="w-4 h-4" />
                {t("addContainer")}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card border-4 border-border retro-shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted border-b-4 border-border">
                <tr>
                  <th className="px-4 py-3 text-left retro-small font-bold text-foreground uppercase retro-heading">
                    {t("name")}
                  </th>
                  <th className="px-4 py-3 text-left retro-small font-bold text-foreground uppercase retro-heading">
                    {t("location")}
                  </th>
                  <th className="px-4 py-3 text-left retro-small font-bold text-foreground uppercase retro-heading">
                    {t("capacity")}
                  </th>
                  <th className="px-4 py-3 text-left retro-small font-bold text-foreground uppercase retro-heading">
                    {t("shortCode")}
                  </th>
                  <th className="px-4 py-3 text-right retro-small font-bold text-foreground uppercase retro-heading">
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {containers.map((container, index) => (
                  <tr
                    key={container.id}
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      index < containers.length - 1 && "border-b-2 border-dashed border-border"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon name="Box" className="w-4 h-4 text-muted-foreground" />
                        <span className="retro-body text-foreground">
                          {container.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 retro-body text-foreground">
                        <Icon name="MapPin" className="w-4 h-4 text-muted-foreground" />
                        {container.location_name || getLocationName(container.location_id)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground retro-body">
                      {container.capacity || t("noCapacity")}
                    </td>
                    <td className="px-4 py-3">
                      {container.short_code ? (
                        <span className="px-2 py-1 bg-muted border-2 border-border retro-small font-mono retro-body">
                          {container.short_code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground retro-body">{t("noShortCode")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(container)}
                            title={t("edit")}
                            className="p-2 border-2 border-border hover:bg-muted transition-colors"
                          >
                            <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(container)}
                            title={t("delete")}
                            className="p-2 border-2 border-border hover:bg-primary hover:text-white transition-colors"
                          >
                            <Icon name="Trash2" className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modals */}
        <CreateEditModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchData();
          }}
          locations={locations}
          t={t}
          te={te}
          isRetro={isRetro}
        />

        <CreateEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedContainer(null);
          }}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedContainer(null);
            fetchData();
          }}
          container={selectedContainer}
          locations={locations}
          t={t}
          te={te}
          isRetro={isRetro}
        />

        {selectedContainer && (
          <DeleteConfirmModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedContainer(null);
            }}
            onSuccess={() => {
              setIsDeleteModalOpen(false);
              setSelectedContainer(null);
              fetchData();
            }}
            container={selectedContainer}
            t={t}
            te={te}
            isRetro={isRetro}
          />
        )}
      </>
    );
  }

  // Standard theme
  return (
    <>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Icon name="Plus" className="w-4 h-4" />
            {t("addContainer")}
          </button>
        )}
      </div>

      {/* Table */}
      {containers.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center">
          <Icon name="Box" className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noContainers")}</p>
          {canEdit && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Icon name="Plus" className="w-4 h-4" />
              {t("addContainer")}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("name")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("location")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("capacity")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("shortCode")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("description")}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {containers.map((container) => (
                <tr key={container.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="Box" className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {container.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <Icon name="MapPin" className="w-4 h-4 text-muted-foreground" />
                      {container.location_name || getLocationName(container.location_id)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {container.capacity || t("noCapacity")}
                  </td>
                  <td className="px-4 py-3">
                    {container.short_code ? (
                      <span className="px-2 py-1 bg-muted rounded text-xs font-mono">
                        {container.short_code}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t("noShortCode")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {container.description || t("noDescription")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(container)}
                          title={t("edit")}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(container)}
                          title={t("delete")}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <Icon name="Trash2" className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreateEditModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchData();
        }}
        locations={locations}
        t={t}
        te={te}
        isRetro={false}
      />

      <CreateEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedContainer(null);
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedContainer(null);
          fetchData();
        }}
        container={selectedContainer}
        locations={locations}
        t={t}
        te={te}
        isRetro={false}
      />

      {selectedContainer && (
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedContainer(null);
          }}
          onSuccess={() => {
            setIsDeleteModalOpen(false);
            setSelectedContainer(null);
            fetchData();
          }}
          container={selectedContainer}
          t={t}
          te={te}
          isRetro={false}
        />
      )}
    </>
  );
}

// Create/Edit Modal Component
function CreateEditModal({
  isOpen,
  onClose,
  onSuccess,
  container,
  locations,
  t,
  te,
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  container?: Container | null;
  locations: Location[];
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro: boolean;
}) {
  const isEdit = !!container;
  const [formData, setFormData] = useState<ContainerCreate>({
    name: "",
    location_id: "",
    description: null,
    capacity: null,
    short_code: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (container) {
      setFormData({
        name: container.name,
        location_id: container.location_id,
        description: container.description,
        capacity: container.capacity,
        short_code: container.short_code,
      });
    } else {
      setFormData({
        name: "",
        location_id: locations.length > 0 ? locations[0].id : "",
        description: null,
        capacity: null,
        short_code: null,
      });
    }
    setError(null);
  }, [container, isOpen, locations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && container) {
        const updateData: ContainerUpdate = {
          name: formData.name,
          location_id: formData.location_id,
          description: formData.description,
          capacity: formData.capacity,
          short_code: formData.short_code,
        };
        await containersApi.update(container.id, updateData);
      } else {
        await containersApi.create(formData);
      }
      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (isRetro) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70" />
        <div
          className="relative z-10 w-full max-w-md m-4 bg-card border-4 border-border retro-shadow"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b-4 border-border bg-primary">
            <h2 className="retro-small font-bold text-white uppercase retro-heading">
              {isEdit ? t("editContainer") : t("addContainer")}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 text-white">
              <Icon name="X" className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-primary/10 border-4 border-primary">
                <p className="text-sm text-primary retro-body">{error}</p>
              </div>
            )}

            <div>
              <label className="block retro-small font-bold text-foreground mb-2 uppercase retro-heading">
                {t("name")}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("namePlaceholder")}
                className="w-full px-3 py-2 border-4 border-border bg-background text-foreground retro-body focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block retro-small font-bold text-foreground mb-2 uppercase retro-heading">
                {t("location")}
              </label>
              <select
                value={formData.location_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, location_id: e.target.value }))}
                className="w-full px-3 py-2 border-4 border-border bg-background text-foreground retro-body focus:outline-none focus:border-primary"
                required
              >
                <option value="" disabled>{t("selectLocation")}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block retro-small font-bold text-foreground mb-2 uppercase retro-heading">
                {t("capacity")}
              </label>
              <input
                type="text"
                value={formData.capacity || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value || null }))}
                placeholder={t("capacityPlaceholder")}
                className="w-full px-3 py-2 border-4 border-border bg-background text-foreground retro-body focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block retro-small font-bold text-foreground mb-2 uppercase retro-heading">
                {t("shortCode")}
              </label>
              <input
                type="text"
                value={formData.short_code || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, short_code: e.target.value || null }))}
                placeholder={t("shortCodePlaceholder")}
                maxLength={8}
                className="w-full px-3 py-2 border-4 border-border bg-background text-foreground font-mono retro-body focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block retro-small font-bold text-foreground mb-2 uppercase retro-heading">
                {t("description")}
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value || null }))}
                placeholder={t("descriptionPlaceholder")}
                rows={3}
                className="w-full px-3 py-2 border-4 border-border bg-background text-foreground retro-body focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border-4 border-border hover:bg-muted transition-colors retro-heading"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary text-white border-4 border-border retro-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:retro-shadow-sm transition-all disabled:opacity-50 retro-heading"
              >
                {submitting ? t("saving") : t("save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md m-4 bg-background border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEdit ? t("editContainer") : t("addContainer")}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("name")}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("namePlaceholder")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("location")}</label>
            <select
              value={formData.location_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, location_id: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="" disabled>{t("selectLocation")}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("capacity")}</label>
            <input
              type="text"
              value={formData.capacity || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value || null }))}
              placeholder={t("capacityPlaceholder")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("shortCode")}</label>
            <input
              type="text"
              value={formData.short_code || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, short_code: e.target.value || null }))}
              placeholder={t("shortCodePlaceholder")}
              maxLength={8}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("description")}</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value || null }))}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modal Component
function DeleteConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  container,
  t,
  te,
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  container: Container;
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await containersApi.delete(container.id);
      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (isRetro) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70" />
        <div
          className="relative z-10 w-full max-w-md m-4 bg-card border-4 border-border retro-shadow"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b-4 border-border bg-primary">
            <h2 className="retro-small font-bold text-white uppercase retro-heading">
              {t("deleteConfirmTitle")}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-white/20 text-white">
              <Icon name="X" className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 bg-primary/10 border-4 border-primary">
                <p className="text-sm text-primary retro-body">{error}</p>
              </div>
            )}

            <p className="text-muted-foreground retro-body">{t("deleteConfirmMessage")}</p>

            <div className="p-3 bg-muted border-4 border-border">
              <p className="retro-heading">{container.name}</p>
              {container.location_name && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 retro-body">
                  <Icon name="MapPin" className="w-3 h-3" />
                  {container.location_name}
                </p>
              )}
              {container.description && (
                <p className="text-sm text-muted-foreground mt-1 retro-body">{container.description}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border-4 border-border hover:bg-muted transition-colors retro-heading"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2 bg-primary text-white border-4 border-border retro-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:retro-shadow-sm transition-all disabled:opacity-50 retro-heading"
              >
                {submitting ? t("deleting") : t("deleteConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md m-4 bg-background border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-destructive">{t("deleteConfirmTitle")}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <Icon name="X" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <p className="text-muted-foreground">{t("deleteConfirmMessage")}</p>

          <div className="p-3 bg-muted rounded-md">
            <p className="font-medium">{container.name}</p>
            {container.location_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Icon name="MapPin" className="w-3 h-3" />
                {container.location_name}
              </p>
            )}
            {container.description && (
              <p className="text-sm text-muted-foreground mt-1">{container.description}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {submitting ? t("deleting") : t("deleteConfirmButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
