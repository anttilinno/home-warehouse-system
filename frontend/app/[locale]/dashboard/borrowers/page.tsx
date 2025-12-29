"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icons";
import {
  borrowersApi,
  getTranslatedErrorMessage,
  Borrower,
  BorrowerCreate,
  BorrowerUpdate,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { NES_GREEN, NES_BLUE, NES_RED, NES_YELLOW } from "@/lib/nes-colors";

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
  const router = useRouter();
  const t = useTranslations("borrowers");
  const te = useTranslations("errors");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

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
                &gt; {borrowers.length} REGISTERED BORROWERS
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-white/20 text-white border-2 border-white/50 hover:bg-white/30 transition-colors flex items-center gap-2 retro-small uppercase"
              >
                <Icon name="Plus" className="w-4 h-4" />
                {t("addBorrower")}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {borrowers.length === 0 ? (
          <div className="bg-card border-4 border-border retro-shadow p-12 text-center">
            <Icon name="Contact" className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground retro-body">{t("noBorrowers")}</p>
            {canEdit && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 px-4 py-2 bg-primary text-white border-4 border-border retro-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:retro-shadow-sm transition-all inline-flex items-center gap-2 retro-heading"
              >
                <Icon name="Plus" className="w-4 h-4" />
                {t("addBorrower")}
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
                    {t("email")}
                  </th>
                  <th className="px-4 py-3 text-left retro-small font-bold text-foreground uppercase retro-heading">
                    {t("phone")}
                  </th>
                  <th className="px-4 py-3 text-left retro-small font-bold text-foreground uppercase retro-heading">
                    {t("notes")}
                  </th>
                  <th className="px-4 py-3 text-right retro-small font-bold text-foreground uppercase retro-heading">
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {borrowers.map((borrower, index) => (
                  <tr
                    key={borrower.id}
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      index < borrowers.length - 1 && "border-b-2 border-dashed border-border"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 flex items-center justify-center border-2 border-border text-white text-xs font-bold"
                          style={{ backgroundColor: getAvatarColor(borrower.name), fontFamily: "var(--font-pixel)" }}
                        >
                          {getInitials(borrower.name)}
                        </div>
                        <span className="retro-body text-foreground font-bold">
                          {borrower.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {borrower.email ? (
                        <div className="flex items-center gap-2 retro-body text-foreground">
                          <Icon name="Mail" className="w-4 h-4 text-muted-foreground" />
                          {borrower.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground retro-body">{t("noEmail")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {borrower.phone ? (
                        <div className="flex items-center gap-2 retro-body text-foreground">
                          <Icon name="Phone" className="w-4 h-4 text-muted-foreground" />
                          {borrower.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground retro-body">{t("noPhone")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground retro-body">
                      {borrower.notes || t("noNotes")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(borrower)}
                            title={t("edit")}
                            className="p-2 border-2 border-border hover:bg-muted transition-colors"
                          >
                            <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(borrower)}
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
          t={t}
          te={te}
          isRetro={isRetro}
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
          isRetro={isRetro}
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
            {t("addBorrower")}
          </button>
        )}
      </div>

      {/* Table */}
      {borrowers.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center">
          <Icon name="Contact" className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noBorrowers")}</p>
          {canEdit && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Icon name="Plus" className="w-4 h-4" />
              {t("addBorrower")}
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
                  {t("email")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("phone")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("notes")}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {borrowers.map((borrower) => (
                <tr key={borrower.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="Contact" className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {borrower.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {borrower.email ? (
                      <div className="flex items-center gap-2 text-foreground">
                        <Icon name="Mail" className="w-4 h-4 text-muted-foreground" />
                        {borrower.email}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t("noEmail")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {borrower.phone ? (
                      <div className="flex items-center gap-2 text-foreground">
                        <Icon name="Phone" className="w-4 h-4 text-muted-foreground" />
                        {borrower.phone}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t("noPhone")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {borrower.notes || t("noNotes")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(borrower)}
                          title={t("edit")}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <Icon name="Pencil" className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(borrower)}
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
        t={t}
        te={te}
        isRetro={false}
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
        isRetro={false}
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
  borrower,
  t,
  te,
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  borrower?: Borrower | null;
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro: boolean;
}) {
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
              {isEdit ? t("editBorrower") : t("addBorrower")}
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
                {t("email")}
              </label>
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value || null }))}
                placeholder={t("emailPlaceholder")}
                className="w-full px-3 py-2 border-4 border-border bg-background text-foreground retro-body focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block retro-small font-bold text-foreground mb-2 uppercase retro-heading">
                {t("phone")}
              </label>
              <input
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value || null }))}
                placeholder={t("phonePlaceholder")}
                className="w-full px-3 py-2 border-4 border-border bg-background text-foreground retro-body focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block retro-small font-bold text-foreground mb-2 uppercase retro-heading">
                {t("notes")}
              </label>
              <textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value || null }))}
                placeholder={t("notesPlaceholder")}
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
            {isEdit ? t("editBorrower") : t("addBorrower")}
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
            <label className="block text-sm font-medium text-foreground mb-2">{t("email")}</label>
            <input
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value || null }))}
              placeholder={t("emailPlaceholder")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("phone")}</label>
            <input
              type="tel"
              value={formData.phone || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value || null }))}
              placeholder={t("phonePlaceholder")}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("notes")}</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value || null }))}
              placeholder={t("notesPlaceholder")}
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
  borrower,
  t,
  te,
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  borrower: Borrower;
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
      await borrowersApi.delete(borrower.id);
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
              <p className="retro-heading">{borrower.name}</p>
              {borrower.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 retro-body">
                  <Icon name="Mail" className="w-3 h-3" />
                  {borrower.email}
                </p>
              )}
              {borrower.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 retro-body">
                  <Icon name="Phone" className="w-3 h-3" />
                  {borrower.phone}
                </p>
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
            <p className="font-medium">{borrower.name}</p>
            {borrower.email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Icon name="Mail" className="w-3 h-3" />
                {borrower.email}
              </p>
            )}
            {borrower.phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Icon name="Phone" className="w-3 h-3" />
                {borrower.phone}
              </p>
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
