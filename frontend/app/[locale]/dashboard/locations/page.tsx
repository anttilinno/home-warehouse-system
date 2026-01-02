"use client";

import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import {
  locationsApi,
  getTranslatedErrorMessage,
  Location,
  LocationCreate,
  LocationUpdate,
} from "@/lib/api";
import { Icon } from "@/components/icons";
import { TreeView } from "@/components/ui/tree-view";
import { LocationSelect } from "@/components/ui/location-select";
import { buildLocationTree, type LocationNode } from "@/lib/location-utils";
import { useToast } from "@/components/ui/use-toast";
import { useThemed, useThemedClasses, type ThemedComponents } from "@/lib/themed";

export default function LocationsPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const t = useTranslations("locations");
  const te = useTranslations("errors");
  const { toast } = useToast();
  const themed = useThemed();
  const classes = useThemedClasses();

  const { PageHeader, Button, EmptyState } = themed;

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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className={`${classes.errorText} mb-4`}>{error}</p>
          <Button variant="primary" onClick={fetchData}>
            {t("tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <PageHeader
        title={t("title")}
        subtitle={classes.isRetro ? `${locations.length} STORAGE LOCATIONS` : t("subtitle")}
        actions={
          canEdit && (
            <Button
              variant={classes.isRetro ? "secondary" : "primary"}
              icon="Plus"
              onClick={handleCreateNew}
            >
              {t("addLocation")}
            </Button>
          )
        }
      />

      {/* Location Tree */}
      {locations.length === 0 ? (
        <EmptyState
          icon="MapPin"
          message={t("noLocations")}
          action={
            canEdit
              ? {
                  label: t("addLocation"),
                  onClick: handleCreateNew,
                  icon: "Plus",
                }
              : undefined
          }
        />
      ) : (
        <div className={classes.isRetro ? "retro-card retro-card--shadow overflow-hidden" : "bg-card border rounded-lg shadow-sm overflow-hidden"}>
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
        themed={themed}
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
        themed={themed}
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
          themed={themed}
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
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  location?: Location | null;
  locations: Location[];
  defaultParentId?: string | null;
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Input, Textarea, Error } = themed;
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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title={isEdit ? t("editLocation") : t("addLocation")} />
      <Modal.Body>
        <form id="location-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className={themed.isRetro ? "retro-card p-3" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"}>
              <Error>{error}</Error>
            </div>
          )}

          <FormGroup>
            <Label htmlFor="name" required>{t("name")}</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("namePlaceholder")}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="parent">{t("parentLocation")}</Label>
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
          </FormGroup>

          <FormGroup>
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
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
          </FormGroup>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          type="submit"
          form="location-form"
          loading={submitting}
        >
          {t("save")}
        </Button>
      </Modal.Footer>
    </Modal>
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
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (name: string) => void;
  location: Location;
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, Error } = themed;
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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
        ? getTranslatedErrorMessage(err.message, te)
        : te("UNKNOWN_ERROR");
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title={t("deleteConfirmTitle")} variant="danger" />
      <Modal.Body>
        {error && (
          <div className={themed.isRetro ? "retro-card p-3 mb-4" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4"}>
            <Error>{error}</Error>
          </div>
        )}

        <p className={themed.isRetro ? "retro-body text-muted-foreground mb-4" : "text-muted-foreground mb-4"}>
          {t("deleteConfirmMessage")}
        </p>

        <Modal.Preview>
          <p className={themed.isRetro ? "retro-heading" : "font-medium"}>{location.name}</p>
          {location.description && (
            <p className={`text-sm text-muted-foreground ${themed.isRetro ? "retro-body" : ""}`}>
              {location.description}
            </p>
          )}
        </Modal.Preview>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          loading={submitting}
        >
          {t("deleteConfirmButton")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
