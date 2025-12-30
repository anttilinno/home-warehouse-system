"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import {
  locationsApi,
  getTranslatedErrorMessage,
  Location,
  LocationCreate,
  LocationUpdate,
} from "@/lib/api";
import { Plus, X, MapPin } from "lucide-react";
import { Icon } from "@/components/icons";
import { TreeView } from "@/components/ui/tree-view";
import { LocationSelect } from "@/components/ui/location-select";
import { buildLocationTree, type LocationNode } from "@/lib/location-utils";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED } from "@/lib/nes-colors";
import {
  RetroPageHeader,
  RetroButton,
  RetroEmptyState,
  RetroModal,
  RetroFormGroup,
  RetroLabel,
  RetroInput,
  RetroTextarea,
  RetroError,
} from "@/components/retro";

export default function LocationsPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const router = useRouter();
  const t = useTranslations("locations");
  const te = useTranslations("errors");
  const { toast } = useToast();
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

  // Data state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  // Build location tree for TreeView
  const locationTree = useMemo(
    () => buildLocationTree(locations),
    [locations]
  );

  const handleAddChild = (parentId: string) => {
    setDefaultParentId(parentId);
    setIsCreateModalOpen(true);
  };

  const handleCreateNew = () => {
    setDefaultParentId(null);
    setIsCreateModalOpen(true);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const locationsData = await locationsApi.list();
      setLocations(locationsData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load locations";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (location: LocationNode | Location) => {
    setSelectedLocation(location as Location);
    setIsEditModalOpen(true);
  };

  const handleDelete = (location: LocationNode | Location) => {
    setSelectedLocation(location as Location);
    setIsDeleteModalOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        isRetro && "retro-body"
      )}>
        <div className={cn(
          "text-muted-foreground",
          isRetro && "retro-small uppercase"
        )}>{t("loading")}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className={cn(
        "flex items-center justify-center min-h-[400px]",
        isRetro && "retro-body"
      )}>
        <div className="text-center">
          <p className={cn(
            "text-red-500 mb-4",
            isRetro && "retro-small uppercase"
          )} style={isRetro ? { color: NES_RED } : undefined}>{error}</p>
          <button
            onClick={fetchData}
            className={cn(
              isRetro
                ? "px-4 py-2 border-4 border-border bg-primary text-white retro-small uppercase retro-shadow hover:retro-shadow-sm hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                : "px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            )}
          >
            {t("tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  // Retro theme UI
  if (isRetro) {
    return (
      <>
        <RetroPageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            canEdit && (
              <RetroButton variant="secondary" onClick={handleCreateNew}>
                <Icon name="Plus" className="w-4 h-4" />
                {t("addLocation")}
              </RetroButton>
            )
          }
        />

        {/* Location Tree */}
        {locations.length === 0 ? (
          <RetroEmptyState
            icon={<Icon name="MapPin" className="w-8 h-8 text-white" />}
            iconBgColor={NES_BLUE}
            message={t("noLocations")}
            action={
              canEdit && (
                <RetroButton variant="primary" onClick={handleCreateNew}>
                  <Icon name="Plus" className="w-4 h-4" />
                  {t("addLocation")}
                </RetroButton>
              )
            }
          />
        ) : (
          <div className="retro-card retro-card--shadow overflow-hidden">
            <TreeView
              items={locationTree}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
              disabled={!canEdit}
            />
          </div>
        )}

        {/* Create Modal */}
        <RetroCreateEditModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setDefaultParentId(null);
          }}
          onSuccess={(name: string) => {
            setIsCreateModalOpen(false);
            setDefaultParentId(null);
            fetchData();
            toast({
              title: t("created"),
              description: name,
            });
          }}
          locations={locations}
          defaultParentId={defaultParentId}
          t={t}
          te={te}
        />

        {/* Edit Modal */}
        <RetroCreateEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedLocation(null);
          }}
          onSuccess={(name: string) => {
            setIsEditModalOpen(false);
            setSelectedLocation(null);
            fetchData();
            toast({
              title: t("updated"),
              description: name,
            });
          }}
          location={selectedLocation}
          locations={locations}
          t={t}
          te={te}
        />

        {/* Delete Confirmation Modal */}
        {selectedLocation && (
          <RetroDeleteConfirmModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedLocation(null);
            }}
            onSuccess={(deletedName: string) => {
              setIsDeleteModalOpen(false);
              setSelectedLocation(null);
              fetchData();
              toast({
                title: t("deleted"),
                description: deletedName,
              });
            }}
            location={selectedLocation}
            t={t}
            te={te}
          />
        )}
      </>
    );
  }

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
            onClick={handleCreateNew}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("addLocation")}
          </button>
        )}
      </div>

      {/* Location Tree */}
      {locations.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noLocations")}</p>
          {canEdit && (
            <button
              onClick={handleCreateNew}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("addLocation")}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <TreeView
            items={locationTree}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddChild={handleAddChild}
            disabled={!canEdit}
          />
        </div>
      )}

      {/* Create Modal */}
      <CreateEditModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setDefaultParentId(null);
        }}
        onSuccess={(name: string) => {
          setIsCreateModalOpen(false);
          setDefaultParentId(null);
          fetchData();
          toast({
            title: t("created"),
            description: name,
          });
        }}
        locations={locations}
        defaultParentId={defaultParentId}
        t={t}
        te={te}
      />

      {/* Edit Modal */}
      <CreateEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedLocation(null);
        }}
        onSuccess={(name: string) => {
          setIsEditModalOpen(false);
          setSelectedLocation(null);
          fetchData();
          toast({
            title: t("updated"),
            description: name,
          });
        }}
        location={selectedLocation}
        locations={locations}
        t={t}
        te={te}
      />

      {/* Delete Confirmation Modal */}
      {selectedLocation && (
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedLocation(null);
          }}
          onSuccess={(deletedName: string) => {
            setIsDeleteModalOpen(false);
            setSelectedLocation(null);
            fetchData();
            toast({
              title: t("deleted"),
              description: deletedName,
            });
          }}
          location={selectedLocation}
          t={t}
          te={te}
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
  location,
  locations,
  defaultParentId,
  t,
  te,
  isRetro = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  location?: Location | null;
  locations: Location[];
  defaultParentId?: string | null;
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro?: boolean;
}) {
  const isEdit = !!location;
  const [formData, setFormData] = useState<LocationCreate>({
    name: "",
    parent_location_id: null,
    description: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IDs to exclude from parent dropdown (current location and its descendants)
  const excludeIds = useMemo(() => {
    if (!location) return [];
    return [location.id];
  }, [location]);

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name,
        parent_location_id: location.parent_location_id,
        description: location.description,
      });
    } else {
      setFormData({
        name: "",
        parent_location_id: defaultParentId || null,
        description: null,
      });
    }
    setError(null);
  }, [location, defaultParentId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && location) {
        const updateData: LocationUpdate = {
          name: formData.name,
          parent_location_id: formData.parent_location_id,
          description: formData.description,
        };
        await locationsApi.update(location.id, updateData);
      } else {
        await locationsApi.create(formData);
      }
      onSuccess(formData.name);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={cn(
          "relative z-10 w-full max-w-md m-4 bg-background shadow-xl",
          isRetro
            ? "border-4 border-border retro-shadow"
            : "border rounded-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(
          "flex items-center justify-between p-4",
          isRetro ? "border-b-4 border-border" : "border-b"
        )}>
          <h2 className={cn(
            isRetro
              ? "text-sm font-bold uppercase retro-heading"
              : "text-lg font-semibold"
          )}>
            {isEdit ? t("editLocation") : t("addLocation")}
          </h2>
          <button onClick={onClose} className={cn(
            "p-1",
            isRetro ? "hover:bg-muted" : "rounded hover:bg-muted"
          )}>
            {isRetro ? <Icon name="X" className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className={cn(
              "p-3",
              isRetro
                ? "border-4 border-border bg-red-100 dark:bg-red-900/20"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
            )}>
              <p className={cn(
                "text-red-600 dark:text-red-400",
                isRetro ? "retro-small uppercase retro-body" : "text-sm"
              )} style={isRetro ? { color: NES_RED } : undefined}>{error}</p>
            </div>
          )}

          <div>
            <label className={cn(
              "block text-foreground mb-2",
              isRetro
                ? "retro-small uppercase font-bold retro-body"
                : "text-sm font-medium"
            )}>
              {t("name")}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder={t("namePlaceholder")}
              className={cn(
                "w-full px-3 py-2 bg-background text-foreground focus:outline-none",
                isRetro
                  ? "border-4 border-border retro-body retro-small"
                  : "border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              )}
              required
            />
          </div>

          <div>
            <label className={cn(
              "block text-foreground mb-2",
              isRetro
                ? "retro-small uppercase font-bold retro-body"
                : "text-sm font-medium"
            )}>
              {t("parentLocation")}
            </label>
            <LocationSelect
              locations={locations}
              value={formData.parent_location_id ?? null}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  parent_location_id: value,
                }))
              }
              excludeIds={excludeIds}
              placeholder={t("selectParent")}
              allowNone={true}
            />
          </div>

          <div>
            <label className={cn(
              "block text-foreground mb-2",
              isRetro
                ? "retro-small uppercase font-bold retro-body"
                : "text-sm font-medium"
            )}>
              {t("description")}
            </label>
            <textarea
              value={formData.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value || null,
                }))
              }
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              className={cn(
                "w-full px-3 py-2 bg-background text-foreground focus:outline-none resize-none",
                isRetro
                  ? "border-4 border-border retro-body retro-small"
                  : "border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              )}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                isRetro
                  ? "px-4 py-2 border-4 border-border bg-muted text-foreground retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  : "px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              )}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                isRetro
                  ? "px-4 py-2 border-4 border-border bg-primary text-white retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
                  : "px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              )}
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
  location,
  t,
  te,
  isRetro = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  location: Location;
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro?: boolean;
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
      await locationsApi.delete(location.id);
      onSuccess(location.name);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={cn(
          "relative z-10 w-full max-w-md m-4 bg-background shadow-xl",
          isRetro
            ? "border-4 border-border retro-shadow"
            : "border rounded-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(
          "flex items-center justify-between p-4",
          isRetro ? "border-b-4 border-border" : "border-b"
        )}>
          <h2 className={cn(
            "text-destructive",
            isRetro
              ? "text-sm font-bold uppercase retro-heading"
              : "text-lg font-semibold"
          )} style={isRetro ? { color: NES_RED } : undefined}>
            {t("deleteConfirmTitle")}
          </h2>
          <button onClick={onClose} className={cn(
            "p-1",
            isRetro ? "hover:bg-muted" : "rounded hover:bg-muted"
          )}>
            {isRetro ? <Icon name="X" className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className={cn(
              "p-3",
              isRetro
                ? "border-4 border-border bg-red-100 dark:bg-red-900/20"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
            )}>
              <p className={cn(
                "text-red-600 dark:text-red-400",
                isRetro ? "retro-small uppercase retro-body" : "text-sm"
              )} style={isRetro ? { color: NES_RED } : undefined}>{error}</p>
            </div>
          )}

          <p className={cn(
            "text-muted-foreground",
            isRetro && "retro-small uppercase retro-body"
          )}>{t("deleteConfirmMessage")}</p>

          <div className={cn(
            "p-3 bg-muted",
            isRetro ? "border-4 border-border" : "rounded-md"
          )}>
            <p className={cn(
              "font-medium",
              isRetro && "retro-small retro-body"
            )}>{location.name}</p>
            {location.description && (
              <p className={cn(
                "text-muted-foreground",
                isRetro ? "retro-small retro-body" : "text-sm"
              )}>{location.description}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                isRetro
                  ? "px-4 py-2 border-4 border-border bg-muted text-foreground retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  : "px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              )}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className={cn(
                isRetro
                  ? "px-4 py-2 border-4 border-border text-white retro-small uppercase font-bold retro-body retro-shadow-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
                  : "px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
              )}
              style={isRetro ? { backgroundColor: NES_RED } : undefined}
            >
              {submitting ? t("deleting") : t("deleteConfirmButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Retro Create/Edit Modal Component
function RetroCreateEditModal({
  isOpen,
  onClose,
  onSuccess,
  location,
  locations,
  defaultParentId,
  t,
  te,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  location?: Location | null;
  locations: Location[];
  defaultParentId?: string | null;
  t: (key: string) => string;
  te: (key: string) => string;
}) {
  const isEdit = !!location;
  const [formData, setFormData] = useState<LocationCreate>({
    name: "",
    parent_location_id: null,
    description: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IDs to exclude from parent dropdown (current location and its descendants)
  const excludeIds = useMemo(() => {
    if (!location) return [];
    return [location.id];
  }, [location]);

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name,
        parent_location_id: location.parent_location_id,
        description: location.description,
      });
    } else {
      setFormData({
        name: "",
        parent_location_id: defaultParentId || null,
        description: null,
      });
    }
    setError(null);
  }, [location, defaultParentId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && location) {
        const updateData: LocationUpdate = {
          name: formData.name,
          parent_location_id: formData.parent_location_id,
          description: formData.description,
        };
        await locationsApi.update(location.id, updateData);
      } else {
        await locationsApi.create(formData);
      }
      onSuccess(formData.name);
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

  return (
    <RetroModal open={isOpen} onClose={onClose}>
      <RetroModal.Header title={isEdit ? t("editLocation") : t("addLocation")} onClose={onClose} />
      <form onSubmit={handleSubmit}>
        <RetroModal.Body>
          {error && <RetroError>{error}</RetroError>}

          <RetroFormGroup>
            <RetroLabel>{t("name")}</RetroLabel>
            <RetroInput
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder={t("namePlaceholder")}
              required
            />
          </RetroFormGroup>

          <RetroFormGroup>
            <RetroLabel>{t("parentLocation")}</RetroLabel>
            <LocationSelect
              locations={locations}
              value={formData.parent_location_id ?? null}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  parent_location_id: value,
                }))
              }
              excludeIds={excludeIds}
              placeholder={t("selectParent")}
              allowNone={true}
            />
          </RetroFormGroup>

          <RetroFormGroup>
            <RetroLabel>{t("description")}</RetroLabel>
            <RetroTextarea
              value={formData.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value || null,
                }))
              }
              placeholder={t("descriptionPlaceholder")}
              rows={3}
            />
          </RetroFormGroup>
        </RetroModal.Body>
        <RetroModal.Footer>
          <RetroButton type="button" variant="secondary" onClick={onClose}>
            {t("cancel")}
          </RetroButton>
          <RetroButton type="submit" variant="primary" disabled={submitting}>
            {submitting ? t("saving") : t("save")}
          </RetroButton>
        </RetroModal.Footer>
      </form>
    </RetroModal>
  );
}

// Retro Delete Confirmation Modal Component
function RetroDeleteConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  location,
  t,
  te,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  location: Location;
  t: (key: string) => string;
  te: (key: string) => string;
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
      await locationsApi.delete(location.id);
      onSuccess(location.name);
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

  return (
    <RetroModal open={isOpen} onClose={onClose}>
      <RetroModal.Header title={t("deleteConfirmTitle")} onClose={onClose} variant="danger" />
      <RetroModal.Body>
        {error && <RetroError>{error}</RetroError>}

        <p className="retro-body text-muted-foreground">{t("deleteConfirmMessage")}</p>

        <div className="retro-card p-3 bg-muted">
          <p className="retro-body font-medium">{location.name}</p>
          {location.description && (
            <p className="retro-body text-muted-foreground text-sm">{location.description}</p>
          )}
        </div>
      </RetroModal.Body>
      <RetroModal.Footer>
        <RetroButton type="button" variant="secondary" onClick={onClose}>
          {t("cancel")}
        </RetroButton>
        <RetroButton type="button" variant="danger" onClick={handleDelete} disabled={submitting}>
          {submitting ? t("deleting") : t("deleteConfirmButton")}
        </RetroButton>
      </RetroModal.Footer>
    </RetroModal>
  );
}
