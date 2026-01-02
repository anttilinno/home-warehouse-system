"use client";

import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import {
  borrowersApi,
  getTranslatedErrorMessage,
  Borrower,
  BorrowerCreate,
  BorrowerUpdate,
} from "@/lib/api";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";
import { useThemed, useThemedClasses } from "@/lib/themed";

// Avatar colors for borrowers
const AVATAR_COLORS = [
  NES_RED,
  NES_BLUE,
  NES_GREEN,
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f97316", // orange
  "#06b6d4", // cyan
  NES_YELLOW,
];

// Get initials from name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Get consistent color based on name
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function BorrowersPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const t = useTranslations("borrowers");
  const te = useTranslations("errors");
  const themed = useThemed();
  const classes = useThemedClasses();

  const { PageHeader, Button, Table, EmptyState } = themed;

  // Data state
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const borrowersData = await borrowersApi.list();
      setBorrowers(borrowersData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load borrowers";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (borrower: Borrower) => {
    setSelectedBorrower(borrower);
    setIsEditModalOpen(true);
  };

  const handleDelete = (borrower: Borrower) => {
    setSelectedBorrower(borrower);
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
        subtitle={classes.isRetro ? `${borrowers.length} REGISTERED BORROWERS` : t("subtitle")}
        actions={
          canEdit && (
            <Button
              variant={classes.isRetro ? "secondary" : "primary"}
              icon="Plus"
              onClick={() => setIsCreateModalOpen(true)}
            >
              {t("addBorrower")}
            </Button>
          )
        }
      />

      {/* Table */}
      {borrowers.length === 0 ? (
        <EmptyState
          icon="Contact"
          message={t("noBorrowers")}
          action={
            canEdit
              ? {
                  label: t("addBorrower"),
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
              <Table.Th>{t("email")}</Table.Th>
              <Table.Th>{t("phone")}</Table.Th>
              <Table.Th>{t("notes")}</Table.Th>
              <Table.Th align="right">{t("actions")}</Table.Th>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {borrowers.map((borrower) => (
              <Table.Row key={borrower.id}>
                <Table.Td>
                  <div className="flex items-center gap-3">
                    {classes.isRetro ? (
                      <div
                        className="w-8 h-8 flex items-center justify-center border-2 border-border text-white text-xs font-bold"
                        style={{ backgroundColor: getAvatarColor(borrower.name), fontFamily: "var(--font-pixel)" }}
                      >
                        {getInitials(borrower.name)}
                      </div>
                    ) : (
                      <Icon name="Contact" className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={classes.isRetro ? "retro-body text-foreground font-bold" : "font-medium text-foreground"}>
                      {borrower.name}
                    </span>
                  </div>
                </Table.Td>
                <Table.Td>
                  {borrower.email ? (
                    <div className={`flex items-center gap-2 text-foreground ${classes.bodyText}`}>
                      <Icon name="Mail" className="w-4 h-4 text-muted-foreground" />
                      {borrower.email}
                    </div>
                  ) : (
                    <span className={`text-muted-foreground ${classes.bodyText}`}>{t("noEmail")}</span>
                  )}
                </Table.Td>
                <Table.Td>
                  {borrower.phone ? (
                    <div className={`flex items-center gap-2 text-foreground ${classes.bodyText}`}>
                      <Icon name="Phone" className="w-4 h-4 text-muted-foreground" />
                      {borrower.phone}
                    </div>
                  ) : (
                    <span className={`text-muted-foreground ${classes.bodyText}`}>{t("noPhone")}</span>
                  )}
                </Table.Td>
                <Table.Td muted>
                  {borrower.notes || t("noNotes")}
                </Table.Td>
                <Table.Td align="right">
                  {canEdit && (
                    <div className={classes.isRetro ? "retro-td__actions" : "flex justify-end gap-2"}>
                      <button
                        onClick={() => handleEdit(borrower)}
                        title={t("edit")}
                        className={classes.isRetro ? "retro-icon-btn" : "p-1.5 rounded hover:bg-muted transition-colors"}
                      >
                        <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(borrower)}
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
        t={t}
        te={te}
        themed={themed}
      />

      <CreateEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedBorrower(null);
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedBorrower(null);
          fetchData();
        }}
        borrower={selectedBorrower}
        t={t}
        te={te}
        themed={themed}
      />

      {selectedBorrower && (
        <DeleteConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedBorrower(null);
          }}
          onSuccess={() => {
            setIsDeleteModalOpen(false);
            setSelectedBorrower(null);
            fetchData();
          }}
          borrower={selectedBorrower}
          t={t}
          te={te}
          themed={themed}
        />
      )}
    </>
  );
}

// Import the ThemedComponents type
import type { ThemedComponents } from "@/lib/themed";

// Create/Edit Modal Component
function CreateEditModal({
  isOpen,
  onClose,
  onSuccess,
  borrower,
  t,
  te,
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  borrower?: Borrower | null;
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Input, Textarea, Error } = themed;
  const isEdit = !!borrower;

  const [formData, setFormData] = useState<BorrowerCreate>({
    name: "",
    email: null,
    phone: null,
    notes: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (borrower) {
      setFormData({
        name: borrower.name,
        email: borrower.email,
        phone: borrower.phone,
        notes: borrower.notes,
      });
    } else {
      setFormData({
        name: "",
        email: null,
        phone: null,
        notes: null,
      });
    }
    setError(null);
  }, [borrower, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (isEdit && borrower) {
        const updateData: BorrowerUpdate = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          notes: formData.notes,
        };
        await borrowersApi.update(borrower.id, updateData);
      } else {
        await borrowersApi.create(formData);
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
      <Modal.Header title={isEdit ? t("editBorrower") : t("addBorrower")} />
      <Modal.Body>
        <form id="borrower-form" onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value || null }))}
              placeholder={t("emailPlaceholder")}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value || null }))}
              placeholder={t("phonePlaceholder")}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value || null }))}
              placeholder={t("notesPlaceholder")}
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
          form="borrower-form"
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
  borrower,
  t,
  te,
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  borrower: Borrower;
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
      await borrowersApi.delete(borrower.id);
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
          <p className={themed.isRetro ? "retro-heading" : "font-medium"}>{borrower.name}</p>
          {borrower.email && (
            <p className={`text-sm text-muted-foreground flex items-center gap-1 ${themed.isRetro ? "retro-body" : ""}`}>
              <Icon name="Mail" className="w-3 h-3" />
              {borrower.email}
            </p>
          )}
          {borrower.phone && (
            <p className={`text-sm text-muted-foreground flex items-center gap-1 ${themed.isRetro ? "retro-body" : ""}`}>
              <Icon name="Phone" className="w-3 h-3" />
              {borrower.phone}
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
