"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "@/navigation";
import { useSearchParams } from "next/navigation";
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
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { formatDate as formatDateUtil, formatDateTime as formatDateTimeUtil } from "@/lib/date-utils";
import { NES_BLUE } from "@/lib/nes-colors";
import { useThemed, useThemedClasses, type ThemedComponents } from "@/lib/themed";

export default function LoansPage() {
  const { isAuthenticated, isLoading: authLoading, canEdit, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("loans");
  const te = useTranslations("errors");
  const themed = useThemed();
  const classes = useThemedClasses();

  const { PageHeader, Button, Table, EmptyState, LoanStatusBadge } = themed;

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
        subtitle={classes.isRetro ? `${filteredLoans.length} LOANS` : t("subtitle")}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowOverdueOnly(!showOverdueOnly);
                if (!showOverdueOnly) setShowActiveOnly(false);
              }}
              className={cn(
                classes.isRetro
                  ? cn(
                      "retro-btn retro-btn--sm",
                      showOverdueOnly ? "retro-btn--danger" : "retro-btn--secondary"
                    )
                  : cn(
                      "px-4 py-2 rounded-lg border transition-colors",
                      showOverdueOnly
                        ? "bg-destructive text-destructive-foreground border-destructive"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )
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
                classes.isRetro
                  ? cn(
                      "retro-btn retro-btn--sm",
                      showActiveOnly ? "retro-btn--primary" : "retro-btn--secondary"
                    )
                  : cn(
                      "px-4 py-2 rounded-lg border transition-colors",
                      showActiveOnly
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )
              )}
            >
              {showActiveOnly ? t("showActive") : t("showAll")}
            </button>
            {canEdit && (
              <Button
                variant={classes.isRetro ? "secondary" : "primary"}
                icon="Plus"
                onClick={() => setIsCreateModalOpen(true)}
              >
                {t("addLoan")}
              </Button>
            )}
          </div>
        }
      />

      {/* Empty State or Table */}
      {filteredLoans.length === 0 ? (
        <EmptyState
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
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.Th>{t("status")}</Table.Th>
              <Table.Th>{t("inventory")}</Table.Th>
              <Table.Th className={classes.isRetro ? "hidden xl:table-cell" : undefined}>{t("borrower")}</Table.Th>
              <Table.Th className={classes.isRetro ? "hidden 2xl:table-cell" : undefined}>{t("quantity")}</Table.Th>
              <Table.Th className={classes.isRetro ? "hidden 2xl:table-cell" : undefined}>{t("loanedAt")}</Table.Th>
              <Table.Th className={classes.isRetro ? "hidden lg:table-cell" : undefined}>{t("dueDate")}</Table.Th>
              <Table.Th align="right">{t("actions")}</Table.Th>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {filteredLoans.map((loan) => {
              const status = getLoanStatus(loan);
              return (
                <Table.Row key={loan.id}>
                  <Table.Td>
                    <LoanStatusBadge status={status} />
                  </Table.Td>
                  <Table.Td>
                    <div className="flex items-center gap-2">
                      <Icon name="Package" className="w-4 h-4 text-muted-foreground" />
                      <span className={classes.isRetro ? "retro-body retro-small uppercase text-foreground" : "font-medium text-foreground"}>
                        {getInventoryDisplay(loan.inventory_id)}
                      </span>
                    </div>
                  </Table.Td>
                  <Table.Td className={classes.isRetro ? "hidden xl:table-cell" : undefined}>
                    <div className={`flex items-center gap-2 text-foreground ${classes.bodyText}`}>
                      <Icon name="Contact" className="w-4 h-4 text-muted-foreground" />
                      {getBorrowerName(loan.borrower_id)}
                    </div>
                  </Table.Td>
                  <Table.Td className={classes.isRetro ? "hidden 2xl:table-cell" : undefined}>
                    {loan.quantity}
                  </Table.Td>
                  <Table.Td className={classes.isRetro ? "hidden 2xl:table-cell" : undefined} muted>
                    {formatDateTime(loan.loaned_at)}
                  </Table.Td>
                  <Table.Td className={classes.isRetro ? "hidden lg:table-cell" : undefined} muted>
                    {loan.due_date ? formatDate(loan.due_date) : t("noDueDate")}
                  </Table.Td>
                  <Table.Td align="right">
                    {canEdit && status !== "returned" && (
                      <Button
                        variant="success"
                        size="sm"
                        icon="RotateCcw"
                        onClick={() => handleReturn(loan)}
                      >
                        {t("return")}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
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
        themed={themed}
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
          themed={themed}
        />
      )}
    </>
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
  themed,
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
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Input, Textarea, Error: ErrorMessage } = themed;

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
    } catch (e) {
      const err = e as Error;
      const errorMessage = err.message
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
    <Modal open={isOpen} onClose={onClose} size="md">
      <Modal.Header title={t("addLoan")} />
      <Modal.Body>
        <form id="loan-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className={themed.isRetro ? "retro-card p-3" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"}>
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          )}

          {jobStatus && !error && (
            <div
              className={themed.isRetro ? "retro-card p-3" : "p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"}
              style={themed.isRetro ? { borderColor: NES_BLUE } : undefined}
            >
              <p className={themed.isRetro ? "retro-small uppercase font-bold retro-body" : "text-sm text-blue-600 dark:text-blue-400"} style={themed.isRetro ? { color: NES_BLUE } : undefined}>
                {jobStatus}
              </p>
            </div>
          )}

          <FormGroup>
            <Label htmlFor="inventory" required>{t("inventory")}</Label>
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
          </FormGroup>

          <FormGroup>
            <Label htmlFor="borrower" required>{t("borrower")}</Label>
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
          </FormGroup>

          <FormGroup>
            <Label htmlFor="quantity" required>{t("quantity")}</Label>
            <Input
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
          </FormGroup>

          <FormGroup>
            <Label htmlFor="due_date">{t("dueDate")}</Label>
            <Input
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
          </FormGroup>

          <FormGroup>
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea
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
          </FormGroup>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          type="submit"
          form="loan-form"
          loading={submitting}
        >
          {t("save")}
        </Button>
      </Modal.Footer>
    </Modal>
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
  themed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loan: Loan;
  getBorrowerName: (id: string) => string;
  getInventoryDisplay: (id: string) => string;
  t: (key: string) => string;
  te: (key: string) => string;
  themed: ThemedComponents;
}) {
  const { Modal, Button, FormGroup, Label, Textarea, Error: ErrorMessage } = themed;

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
      <Modal.Header title={t("returnConfirmTitle")} variant="success" />
      <Modal.Body>
        {error && (
          <div className={themed.isRetro ? "retro-card p-3 mb-4" : "p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4"}>
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}

        <p className={themed.isRetro ? "retro-body text-muted-foreground mb-4" : "text-muted-foreground mb-4"}>
          {t("returnConfirmMessage")}
        </p>

        <Modal.Preview>
          <div className="flex items-center gap-2">
            <Icon name="Package" className="w-4 h-4 text-muted-foreground" />
            <span className={themed.isRetro ? "retro-heading" : "font-medium"}>{getInventoryDisplay(loan.inventory_id)}</span>
          </div>
          <div className={`flex items-center gap-2 text-muted-foreground mt-2 ${themed.isRetro ? "retro-body" : "text-sm"}`}>
            <Icon name="Contact" className="w-3 h-3" />
            {getBorrowerName(loan.borrower_id)}
          </div>
          <div className={`text-muted-foreground mt-1 ${themed.isRetro ? "retro-body" : "text-sm"}`}>
            Qty: {loan.quantity}
          </div>
        </Modal.Preview>

        <FormGroup className="mt-4">
          <Label htmlFor="return_notes">{t("notes")}</Label>
          <Textarea
            id="return_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={2}
          />
        </FormGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="success"
          onClick={handleReturn}
          loading={submitting}
        >
          {t("returnConfirmButton")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
