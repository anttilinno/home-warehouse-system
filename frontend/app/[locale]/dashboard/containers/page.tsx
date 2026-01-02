"use client";

import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
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
import { useThemed, useThemedClasses } from "@/lib/themed";
import type { ThemedComponents } from "@/lib/themed";

export default function ContainersPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const t = useTranslations("containers");
  const te = useTranslations("errors");
  const themed = useThemed();
  const classes = useThemedClasses();

  const { PageHeader, Button, Table, EmptyState } = themed;

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

  const handleEdit = (container: Container) => {
    setSelectedContainer(container);
    setIsEditModalOpen(true);
  };

  const handleDelete = (container: Container) => {
    setSelectedContainer(container);
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
        subtitle={classes.isRetro ? `${containers.length} STORAGE CONTAINERS` : t("subtitle")}
        actions={
          canEdit && (
            <Button
              variant={classes.isRetro ? "secondary" : "primary"}
              icon="Plus"
              onClick={() => setIsCreateModalOpen(true)}
            >
              {t("addContainer")}
            </Button>
          )
        }
      />

      {/* Table */}
      {containers.length === 0 ? (
        <EmptyState
          icon="Box"
          message={t("noContainers")}
          action={
            canEdit
              ? {
                  label: t("addContainer"),
                  onClick: () => setIsCreateModalOpen(true),
                  icon: "Plus",
                }
              : undefined
          }
        />
      ) : (
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.Th>{t("name")}</Table.Th>
              <Table.Th>{t("location")}</Table.Th>
              <Table.Th>{t("capacity")}</Table.Th>
              <Table.Th>{t("shortCode")}</Table.Th>
              {!classes.isRetro && <Table.Th>{t("description")}</Table.Th>}
              <Table.Th align="right">{t("actions")}</Table.Th>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {containers.map((container) => (
              <Table.Row key={container.id}>
                <Table.Td>
                  <div className="flex items-center gap-2">
                    <Icon name="Box" className="w-4 h-4 text-muted-foreground" />
                    <span className={classes.isRetro ? "retro-body text-foreground" : "font-medium text-foreground"}>
                      {container.name}
                    </span>
                  </div>
                </Table.Td>
                <Table.Td>
                  <div className={`flex items-center gap-2 text-foreground ${classes.bodyText}`}>
                    <Icon name="MapPin" className="w-4 h-4 text-muted-foreground" />
                    {container.location_name || getLocationName(container.location_id)}
                  </div>
                </Table.Td>
                <Table.Td muted>
                  {container.capacity || t("noCapacity")}
                </Table.Td>
                <Table.Td>
                  {container.short_code ? (
                    <span className={classes.isRetro
                      ? "px-2 py-1 bg-muted border-2 border-border retro-small font-mono retro-body"
                      : "px-2 py-1 bg-muted rounded text-xs font-mono"
                    }>
                      {container.short_code}
                    </span>
                  ) : (
                    <span className={`text-muted-foreground ${classes.bodyText}`}>{t("noShortCode")}</span>
                  )}
                </Table.Td>
                {!classes.isRetro && (
                  <Table.Td muted>
                    {container.description || t("noDescription")}
                  </Table.Td>
                )}
                <Table.Td align="right">
                  {canEdit && (
                    <div className={classes.isRetro ? "retro-td__actions" : "flex justify-end gap-2"}>
                      <button
                        onClick={() => handleEdit(container)}
                        title={t("edit")}
                        className={classes.isRetro ? "retro-icon-btn" : "p-1.5 rounded hover:bg-muted transition-colors"}
                      >
                        <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(container)}
                        title={t("delete")}
                        className={classes.isRetro ? "retro-icon-btn retro-icon-btn--danger" : "p-1.5 rounded hover:bg-muted transition-colors"}
                      >
                        <Icon name="Trash2" className={`w-4 h-4 ${classes.isRetro ? "" : "text-muted-foreground hover:text-destructive"}`} />
                      </button>
                    </div>
                  )}
                </Table.Td>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
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
        themed={themed}
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
        themed={themed}
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
  container,
  locations,
  t,
  te,
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  container?: Container | null;
  locations: Location[];
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Input, Select, Textarea, Error } = themed;
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
      <Modal.Header title={isEdit ? t("editContainer") : t("addContainer")} />
      <Modal.Body>
        <form id="container-form" onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="location" required>{t("location")}</Label>
            <Select
              id="location"
              value={formData.location_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, location_id: e.target.value }))}
              required
            >
              <option value="" disabled>{t("selectLocation")}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup>
            <Label htmlFor="capacity">{t("capacity")}</Label>
            <Input
              id="capacity"
              type="text"
              value={formData.capacity || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value || null }))}
              placeholder={t("capacityPlaceholder")}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="short_code">{t("shortCode")}</Label>
            <Input
              id="short_code"
              type="text"
              value={formData.short_code || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, short_code: e.target.value || null }))}
              placeholder={t("shortCodePlaceholder")}
              maxLength={8}
              mono
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value || null }))}
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
          form="container-form"
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
  container,
  t,
  te,
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  container: Container;
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
      await containersApi.delete(container.id);
      onSuccess();
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
          <p className={themed.isRetro ? "retro-heading" : "font-medium"}>{container.name}</p>
          {container.location_name && (
            <p className={`text-sm text-muted-foreground flex items-center gap-1 ${themed.isRetro ? "retro-body" : ""}`}>
              <Icon name="MapPin" className="w-3 h-3" />
              {container.location_name}
            </p>
          )}
          {container.description && (
            <p className={`text-sm text-muted-foreground mt-1 ${themed.isRetro ? "retro-body" : ""}`}>
              {container.description}
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
