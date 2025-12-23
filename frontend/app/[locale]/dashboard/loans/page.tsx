"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import {
  loansApi,
  borrowersApi,
  inventoryApi,
  itemsApi,
  locationsApi,
  getTranslatedErrorMessage,
  Loan,
  LoanCreate,
  Borrower,
  Inventory,
  Item,
  Location,
} from "@/lib/api";
import {
  Plus,
  X,
  HandCoins,
  Contact,
  Package,
  MapPin,
  RotateCcw,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";

export default function LoansPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit } = useAuth();
  const router = useRouter();
  const t = useTranslations("loans");
  const te = useTranslations("errors");

  // Data state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Lookup maps
  const borrowerMap = useMemo(
    () => new Map(borrowers.map((b) => [b.id, b])),
    [borrowers]
  );
  const inventoryMap = useMemo(
    () => new Map(inventory.map((i) => [i.id, i])),
    [inventory]
  );
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );
  const locationMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const getBorrowerName = (borrowerId: string) => {
    return borrowerMap.get(borrowerId)?.name || "Unknown";
  };

  const getInventoryDisplay = (inventoryId: string) => {
    const inv = inventoryMap.get(inventoryId);
    if (!inv) return "Unknown";
    const item = itemMap.get(inv.item_id);
    const location = locationMap.get(inv.location_id);
    return `${item?.name || "Unknown Item"} @ ${location?.name || "Unknown Location"}`;
  };

  const getLoanStatus = (loan: Loan): "active" | "returned" | "overdue" => {
    if (loan.returned_at) return "returned";
    if (loan.due_date && new Date(loan.due_date) < new Date()) return "overdue";
    return "active";
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [loansData, borrowersData, inventoryData, itemsData, locationsData] = await Promise.all([
        showActiveOnly ? loansApi.listActive() : loansApi.list(),
        borrowersApi.list(),
        inventoryApi.list(),
        itemsApi.list(),
        locationsApi.list(),
      ]);
      setLoans(loansData);
      setBorrowers(borrowersData);
      setInventory(inventoryData);
      setItems(itemsData);
      setLocations(locationsData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load loans";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [showActiveOnly]);

  const handleReturn = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsReturnModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={cn(
              "px-4 py-2 rounded-lg border transition-colors",
              showActiveOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            {showActiveOnly ? t("showActive") : t("showAll")}
          </button>
          {canEdit && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("addLoan")}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loans.length === 0 ? (
        <div className="bg-card border rounded-lg p-12 text-center">
          <HandCoins className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noLoans")}</p>
          {canEdit && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("addLoan")}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("status")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("inventory")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("borrower")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("quantity")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("loanedAt")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("dueDate")}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loans.map((loan) => {
                const status = getLoanStatus(loan);
                return (
                  <tr key={loan.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <StatusBadge status={status} t={t} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {getInventoryDisplay(loan.inventory_id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-foreground">
                        <Contact className="w-4 h-4 text-muted-foreground" />
                        {getBorrowerName(loan.borrower_id)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {loan.quantity}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(loan.loaned_at)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {loan.due_date ? formatDate(loan.due_date) : t("noDueDate")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && status !== "returned" && (
                        <button
                          onClick={() => handleReturn(loan)}
                          title={t("return")}
                          className="px-3 py-1.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors inline-flex items-center gap-1.5 text-sm"
                        >
                          <RotateCcw className="w-4 h-4" />
                          {t("return")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <CreateLoanModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchData();
        }}
        borrowers={borrowers}
        inventory={inventory}
        items={items}
        locations={locations}
        t={t}
        te={te}
      />

      {/* Return Confirmation Modal */}
      {selectedLoan && (
        <ReturnLoanModal
          isOpen={isReturnModalOpen}
          onClose={() => {
            setIsReturnModalOpen(false);
            setSelectedLoan(null);
          }}
          onSuccess={() => {
            setIsReturnModalOpen(false);
            setSelectedLoan(null);
            fetchData();
          }}
          loan={selectedLoan}
          getBorrowerName={getBorrowerName}
          getInventoryDisplay={getInventoryDisplay}
          t={t}
          te={te}
        />
      )}
    </>
  );
}

// Status Badge Component
function StatusBadge({ status, t }: { status: "active" | "returned" | "overdue"; t: (key: string) => string }) {
  const config = {
    active: {
      icon: Clock,
      className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    },
    returned: {
      icon: CheckCircle,
      className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    },
    overdue: {
      icon: AlertTriangle,
      className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    },
  };

  const { icon: Icon, className } = config[status];

  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1", className)}>
      <Icon className="w-3 h-3" />
      {t(status)}
    </span>
  );
}

// Create Loan Modal Component
function CreateLoanModal({
  isOpen,
  onClose,
  onSuccess,
  borrowers,
  inventory,
  items,
  locations,
  t,
  te,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  borrowers: Borrower[];
  inventory: Inventory[];
  items: Item[];
  locations: Location[];
  t: (key: string) => string;
  te: (key: string) => string;
}) {
  const [formData, setFormData] = useState<LoanCreate>({
    inventory_id: "",
    borrower_id: "",
    quantity: 1,
    due_date: null,
    notes: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  // Lookup maps
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const locationMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const getInventoryDisplay = (inv: Inventory) => {
    const item = itemMap.get(inv.item_id);
    const location = locationMap.get(inv.location_id);
    return `${item?.name || "Unknown"} @ ${location?.name || "Unknown"} (qty: ${inv.quantity})`;
  };

  // Options for searchable selects
  const inventoryOptions: SearchableSelectOption[] = useMemo(
    () =>
      inventory.map((inv) => {
        const item = itemMap.get(inv.item_id);
        const location = locationMap.get(inv.location_id);
        return {
          value: inv.id,
          label: `${item?.name || "Unknown"} @ ${location?.name || "Unknown"} (qty: ${inv.quantity})`,
          searchText: `${item?.sku || ""} ${item?.description || ""} ${location?.zone || ""} ${location?.shelf || ""}`,
        };
      }),
    [inventory, itemMap, locationMap]
  );

  const borrowerOptions: SearchableSelectOption[] = useMemo(
    () =>
      borrowers.map((b) => ({
        value: b.id,
        label: b.name,
        searchText: `${b.email || ""} ${b.phone || ""}`,
      })),
    [borrowers]
  );

  useEffect(() => {
    setFormData({
      inventory_id: inventory.length > 0 ? inventory[0].id : "",
      borrower_id: borrowers.length > 0 ? borrowers[0].id : "",
      quantity: 1,
      due_date: null,
      notes: null,
    });
    setError(null);
    setJobStatus(null);
  }, [isOpen, inventory, borrowers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setJobStatus(t("loanCreating"));

    try {
      const response = await loansApi.create(formData);

      // Poll for job completion
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const status = await loansApi.getJobStatus(response.job_id);

        if (status.status === "finished") {
          setJobStatus(t("loanCreated"));
          await new Promise(resolve => setTimeout(resolve, 500));
          onSuccess();
          return;
        } else if (status.status === "failed") {
          throw new Error(status.error || "Loan creation failed");
        }

        attempts++;
      }

      throw new Error("Loan creation timed out");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getTranslatedErrorMessage(err.message, te)
          : te("UNKNOWN_ERROR");
      setError(errorMessage);
      setJobStatus(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md m-4 bg-background border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t("addLoan")}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {jobStatus && !error && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-600 dark:text-blue-400">{jobStatus}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("inventory")}
            </label>
            <SearchableSelect
              options={inventoryOptions}
              value={formData.inventory_id}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  inventory_id: value,
                }))
              }
              placeholder={t("selectInventory")}
              searchPlaceholder={t("searchInventory")}
              disabled={submitting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("borrower")}
            </label>
            <SearchableSelect
              options={borrowerOptions}
              value={formData.borrower_id}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  borrower_id: value,
                }))
              }
              placeholder={t("selectBorrower")}
              searchPlaceholder={t("searchBorrower")}
              disabled={submitting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("quantity")}
            </label>
            <input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  quantity: parseInt(e.target.value) || 1,
                }))
              }
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("dueDate")}
            </label>
            <input
              type="date"
              value={formData.due_date || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  due_date: e.target.value || null,
                }))
              }
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("notes")}
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  notes: e.target.value || null,
                }))
              }
              placeholder={t("notesPlaceholder")}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              disabled={submitting}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              disabled={submitting}
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

// Return Loan Modal Component
function ReturnLoanModal({
  isOpen,
  onClose,
  onSuccess,
  loan,
  getBorrowerName,
  getInventoryDisplay,
  t,
  te,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loan: Loan;
  getBorrowerName: (id: string) => string;
  getInventoryDisplay: (id: string) => string;
  t: (key: string) => string;
  te: (key: string) => string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    setError(null);
    setNotes("");
  }, [isOpen]);

  const handleReturn = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await loansApi.return(loan.id, { notes: notes || null });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-md m-4 bg-background border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400">
            {t("returnConfirmTitle")}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <p className="text-muted-foreground">{t("returnConfirmMessage")}</p>

          <div className="p-3 bg-muted rounded-md space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{getInventoryDisplay(loan.inventory_id)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Contact className="w-3 h-3" />
              {getBorrowerName(loan.borrower_id)}
            </div>
            <div className="text-sm text-muted-foreground">
              Qty: {loan.quantity}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={2}
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
              type="button"
              onClick={handleReturn}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {submitting ? t("returning") : t("returnConfirmButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
