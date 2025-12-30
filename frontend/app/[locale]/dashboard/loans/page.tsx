"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
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
import { Icon } from "@/components/icons";
import {
  Plus,
  X,
  HandCoins,
  Contact,
  Package,
  RotateCcw,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil } from "@/lib/date-utils";
import { NES_GREEN, NES_BLUE, NES_RED } from "@/lib/nes-colors";
import {
  RetroPageHeader,
  RetroButton,
  RetroTable,
  RetroEmptyState,
  RetroModal,
  RetroFormGroup,
  RetroLabel,
  RetroInput,
  RetroTextarea,
  RetroError,
} from "@/components/retro";

export default function LoansPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("loans");
  const te = useTranslations("errors");
  const { theme } = useTheme();
  const isRetro = theme?.startsWith("retro");

  // Get filter from URL
  const urlFilter = searchParams.get("filter");

  // Data state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(urlFilter !== "overdue");
  const [showOverdueOnly, setShowOverdueOnly] = useState(urlFilter === "overdue");

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

  // Filter loans for overdue
  const filteredLoans = useMemo(() => {
    if (!showOverdueOnly) return loans;
    const now = new Date();
    return loans.filter((loan) => {
      if (loan.returned_at) return false;
      if (!loan.due_date) return false;
      return new Date(loan.due_date) < now;
    });
  }, [loans, showOverdueOnly]);

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
    return formatDateUtil(dateString, user?.date_format);
  };

  const formatDateTime = (dateString: string) => {
    return formatDateTimeUtil(dateString, user?.date_format);
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
          {isRetro ? (
            <RetroButton variant="primary" onClick={fetchData}>
              {t("tryAgain")}
            </RetroButton>
          ) : (
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              {t("tryAgain")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Retro theme UI
  if (isRetro) {
    return (
      <>
        {/* Header */}
        <RetroPageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowOverdueOnly(!showOverdueOnly);
                  if (!showOverdueOnly) setShowActiveOnly(false);
                }}
                className={cn(
                  "retro-btn retro-btn--sm",
                  showOverdueOnly
                    ? "retro-btn--danger"
                    : "retro-btn--secondary"
                )}
              >
                {t("overdue")}
              </button>
              <button
                onClick={() => {
                  setShowActiveOnly(!showActiveOnly);
                  if (!showActiveOnly) setShowOverdueOnly(false);
                }}
                className={cn(
                  "retro-btn retro-btn--sm",
                  showActiveOnly
                    ? "retro-btn--primary"
                    : "retro-btn--secondary"
                )}
              >
                {showActiveOnly ? t("showActive") : t("showAll")}
              </button>
              {canEdit && (
                <RetroButton
                  variant="secondary"
                  icon="Plus"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  {t("addLoan")}
                </RetroButton>
              )}
            </div>
          }
        />

        {/* Empty State or Table */}
        {filteredLoans.length === 0 ? (
          <RetroEmptyState
            icon="HandCoins"
            message={t("noLoans")}
            action={
              canEdit
                ? {
                    label: t("addLoan"),
                    onClick: () => setIsCreateModalOpen(true),
                    icon: "Plus",
                  }
                : undefined
            }
          />
        ) : (
          <RetroTable>
            <RetroTable.Head>
              <RetroTable.Row>
                <RetroTable.Th>{t("status")}</RetroTable.Th>
                <RetroTable.Th>{t("inventory")}</RetroTable.Th>
                <RetroTable.Th>{t("borrower")}</RetroTable.Th>
                <RetroTable.Th>{t("quantity")}</RetroTable.Th>
                <RetroTable.Th>{t("loanedAt")}</RetroTable.Th>
                <RetroTable.Th>{t("dueDate")}</RetroTable.Th>
                <RetroTable.Th align="right">{t("actions")}</RetroTable.Th>
              </RetroTable.Row>
            </RetroTable.Head>
            <RetroTable.Body>
              {filteredLoans.map((loan) => {
                const status = getLoanStatus(loan);
                return (
                  <RetroTable.Row key={loan.id}>
                    <RetroTable.Td>
                      <RetroStatusBadge status={status} t={t} />
                    </RetroTable.Td>
                    <RetroTable.Td>
                      <div className="flex items-center gap-2">
                        <Icon name="Package" className="w-4 h-4 text-muted-foreground" />
                        <span className="retro-body retro-small uppercase text-foreground">
                          {getInventoryDisplay(loan.inventory_id)}
                        </span>
                      </div>
                    </RetroTable.Td>
                    <RetroTable.Td>
                      <div className="flex items-center gap-2 retro-body retro-small uppercase text-foreground">
                        <Icon name="Contact" className="w-4 h-4 text-muted-foreground" />
                        {getBorrowerName(loan.borrower_id)}
                      </div>
                    </RetroTable.Td>
                    <RetroTable.Td>
                      {loan.quantity}
                    </RetroTable.Td>
                    <RetroTable.Td muted>
                      {formatDateTime(loan.loaned_at)}
                    </RetroTable.Td>
                    <RetroTable.Td muted>
                      {loan.due_date ? formatDate(loan.due_date) : t("noDueDate")}
                    </RetroTable.Td>
                    <RetroTable.Td align="right">
                      {canEdit && status !== "returned" && (
                        <RetroButton
                          variant="success"
                          size="sm"
                          icon="RotateCcw"
                          onClick={() => handleReturn(loan)}
                        >
                          {t("return")}
                        </RetroButton>
                      )}
                    </RetroTable.Td>
                  </RetroTable.Row>
                );
              })}
            </RetroTable.Body>
          </RetroTable>
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
          isRetro={isRetro}
        />

        {/* Return Modal */}
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
            isRetro={isRetro}
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowOverdueOnly(!showOverdueOnly);
              if (!showOverdueOnly) setShowActiveOnly(false);
            }}
            className={cn(
              "px-4 py-2 rounded-lg border transition-colors",
              showOverdueOnly
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            {t("overdue")}
          </button>
          <button
            onClick={() => {
              setShowActiveOnly(!showActiveOnly);
              if (!showActiveOnly) setShowOverdueOnly(false);
            }}
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
      {filteredLoans.length === 0 ? (
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
              {filteredLoans.map((loan) => {
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
        isRetro={false}
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
          isRetro={false}
        />
      )}
    </>
  );
}

// Retro Status Badge Component
function RetroStatusBadge({ status, t }: { status: "active" | "returned" | "overdue"; t: (key: string) => string }) {
  const config = {
    active: { color: NES_BLUE, icon: "Clock" as const },
    returned: { color: NES_GREEN, icon: "CheckCircle" as const },
    overdue: { color: NES_RED, icon: "AlertTriangle" as const },
  };

  const { color, icon } = config[status];

  return (
    <span
      className="retro-loan-status"
      style={{ backgroundColor: color, color: "white" }}
    >
      <Icon name={icon} className="w-3 h-3" />
      {t(status)}
    </span>
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

  const { icon: StatusIcon, className } = config[status];

  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1", className)}>
      <StatusIcon className="w-3 h-3" />
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
  isRetro,
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
  isRetro: boolean;
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

  // Retro Modal
  if (isRetro) {
    return (
      <RetroModal open={isOpen} onClose={onClose} size="md">
        <RetroModal.Header title={t("addLoan")} />
        <RetroModal.Body>
          <form id="loan-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="retro-card p-3">
                <RetroError>{error}</RetroError>
              </div>
            )}

            {jobStatus && !error && (
              <div className="retro-card p-3" style={{ borderColor: NES_BLUE }}>
                <p className="retro-small uppercase font-bold retro-body" style={{ color: NES_BLUE }}>
                  {jobStatus}
                </p>
              </div>
            )}

            <RetroFormGroup>
              <RetroLabel htmlFor="inventory" required>{t("inventory")}</RetroLabel>
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
            </RetroFormGroup>

            <RetroFormGroup>
              <RetroLabel htmlFor="borrower" required>{t("borrower")}</RetroLabel>
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
            </RetroFormGroup>

            <RetroFormGroup>
              <RetroLabel htmlFor="quantity" required>{t("quantity")}</RetroLabel>
              <RetroInput
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    quantity: parseInt(e.target.value) || 1,
                  }))
                }
                required
                disabled={submitting}
              />
            </RetroFormGroup>

            <RetroFormGroup>
              <RetroLabel htmlFor="due_date">{t("dueDate")}</RetroLabel>
              <RetroInput
                id="due_date"
                type="date"
                value={formData.due_date || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    due_date: e.target.value || null,
                  }))
                }
                disabled={submitting}
              />
            </RetroFormGroup>

            <RetroFormGroup>
              <RetroLabel htmlFor="notes">{t("notes")}</RetroLabel>
              <RetroTextarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    notes: e.target.value || null,
                  }))
                }
                placeholder={t("notesPlaceholder")}
                rows={3}
                disabled={submitting}
              />
            </RetroFormGroup>
          </form>
        </RetroModal.Body>
        <RetroModal.Footer>
          <RetroButton variant="secondary" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </RetroButton>
          <RetroButton
            variant="primary"
            type="submit"
            form="loan-form"
            loading={submitting}
          >
            {t("save")}
          </RetroButton>
        </RetroModal.Footer>
      </RetroModal>
    );
  }

  // Standard Modal
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
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {jobStatus && !error && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-600 dark:text-blue-400">{jobStatus}</p>
            </div>
          )}

          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">
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
            <label className="block mb-2 text-sm font-medium text-foreground">
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
            <label className="block mb-2 text-sm font-medium text-foreground">
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
              className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">
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
              className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">
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
              className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
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
  isRetro,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loan: Loan;
  getBorrowerName: (id: string) => string;
  getInventoryDisplay: (id: string) => string;
  t: (key: string) => string;
  te: (key: string) => string;
  isRetro: boolean;
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

  // Retro Modal
  if (isRetro) {
    return (
      <RetroModal open={isOpen} onClose={onClose} size="md">
        <RetroModal.Header title={t("returnConfirmTitle")} variant="success" />
        <RetroModal.Body>
          {error && (
            <div className="retro-card p-3 mb-4">
              <RetroError>{error}</RetroError>
            </div>
          )}

          <p className="retro-body text-muted-foreground mb-4">{t("returnConfirmMessage")}</p>

          <RetroModal.Preview>
            <div className="flex items-center gap-2">
              <Icon name="Package" className="w-4 h-4 text-muted-foreground" />
              <span className="retro-heading">{getInventoryDisplay(loan.inventory_id)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground mt-2">
              <Icon name="Contact" className="w-3 h-3" />
              {getBorrowerName(loan.borrower_id)}
            </div>
            <div className="text-muted-foreground mt-1">
              Qty: {loan.quantity}
            </div>
          </RetroModal.Preview>

          <RetroFormGroup className="mt-4">
            <RetroLabel htmlFor="return_notes">{t("notes")}</RetroLabel>
            <RetroTextarea
              id="return_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={2}
            />
          </RetroFormGroup>
        </RetroModal.Body>
        <RetroModal.Footer>
          <RetroButton variant="secondary" onClick={onClose}>
            {t("cancel")}
          </RetroButton>
          <RetroButton
            variant="success"
            onClick={handleReturn}
            loading={submitting}
          >
            {t("returnConfirmButton")}
          </RetroButton>
        </RetroModal.Footer>
      </RetroModal>
    );
  }

  // Standard Modal
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
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <p className="text-muted-foreground">{t("returnConfirmMessage")}</p>

          <div className="p-3 bg-muted rounded-md space-y-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{getInventoryDisplay(loan.inventory_id)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Contact className="w-3 h-3" />
              {getBorrowerName(loan.borrower_id)}
            </div>
            <div className="text-muted-foreground text-sm">
              Qty: {loan.quantity}
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium text-foreground">
              {t("notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={2}
              className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
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
