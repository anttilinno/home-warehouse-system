import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import {
  RetroDialog,
  RetroTabs,
  StatusPill,
  RetroBadge,
} from "@/components/retro";
import { formatCents } from "@/lib/utils/money";
import type { Repair } from "@/lib/types";
import { repairStatus } from "../repairStatus";
import { RepairPhotoPanel } from "./RepairPhotoPanel";
import { RepairAttachmentPanel } from "./RepairAttachmentPanel";

// Phase 10b Plan 03 — the repair record sub-view (OQ1). A SECOND blue RetroDialog
// opened from a repair row's PHOTOS/FILES action, titled `REPAIR — {description}`,
// with a RetroTabs strip RECORD / PHOTOS / FILES. It nests over the RepairsDrawer
// via the Phase 3 modal stack. The tab lands on whichever action the user clicked.
//
// RECORD = read-only repair summary. PHOTOS = RepairPhotoPanel (reused atoms).
// FILES = RepairAttachmentPanel (link-only). The active folder is the reserved
// blue accent (RetroTabs' TAB_ACTIVE).

export type RepairRecordTab = "record" | "photos" | "files";

export interface RepairRecordDialogProps {
  wsId: string;
  repair: Repair;
  /** The repair's owning item — needed to mint a file_id for attachments. */
  itemId: string;
  /** Which tab to open on (matches the row action the user clicked). */
  initialTab: RepairRecordTab;
  open: boolean;
  onClose: () => void;
}

function formatDate(rfc?: string): string {
  return rfc ? rfc.slice(0, 10) : "—";
}

function RecordSummary({ repair }: Readonly<{ repair: Repair }>) {
  const status = repairStatus(repair);
  return (
    <dl className="flex flex-col gap-sp-2 text-14 text-fg-ink">
      <div className="flex items-baseline justify-between gap-sp-2">
        <span className="font-semibold">{repair.description}</span>
        <StatusPill variant={status.variant}>{status.label}</StatusPill>
      </div>
      <Row label={<Trans>Cost</Trans>}>
        {typeof repair.cost === "number"
          ? formatCents(repair.cost, repair.currency_code)
          : "—"}
      </Row>
      <Row label={<Trans>Repair date</Trans>}>
        {formatDate(repair.repair_date)}
      </Row>
      <Row label={<Trans>Completed</Trans>}>
        {formatDate(repair.completed_at)}
      </Row>
      <Row label={<Trans>Service provider</Trans>}>
        {repair.service_provider || "—"}
      </Row>
      <Row label={<Trans>Warranty claim</Trans>}>
        {repair.is_warranty_claim ? (
          <RetroBadge variant="warn">
            <Trans>⚖ WARRANTY</Trans>
          </RetroBadge>
        ) : (
          "—"
        )}
      </Row>
      {repair.notes && <Row label={<Trans>Notes</Trans>}>{repair.notes}</Row>}
    </dl>
  );
}

function Row({
  label,
  children,
}: Readonly<{
  label: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <div className="flex items-baseline gap-sp-2">
      <dt className="w-[140px] shrink-0 text-12 font-bold uppercase tracking-8 text-fg-muted">
        {label}
      </dt>
      <dd className="flex-1 font-mono text-13">{children}</dd>
    </div>
  );
}

export function RepairRecordDialog({
  wsId,
  repair,
  itemId,
  initialTab,
  open,
  onClose,
}: Readonly<RepairRecordDialogProps>) {
  const [tab, setTab] = useState<RepairRecordTab>(initialTab);

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={<Trans>REPAIR — {repair.description}</Trans>}
      titlebarVariant="blue"
      width="min(640px,94vw)"
    >
      <RetroTabs
        value={tab}
        onChange={(id) => setTab(id as RepairRecordTab)}
        tabs={[
          {
            id: "record",
            label: <Trans>RECORD</Trans>,
            content: <RecordSummary repair={repair} />,
          },
          {
            id: "photos",
            label: <Trans>PHOTOS</Trans>,
            content: <RepairPhotoPanel wsId={wsId} repairId={repair.id} />,
          },
          {
            id: "files",
            label: <Trans>FILES</Trans>,
            content: (
              <RepairAttachmentPanel
                wsId={wsId}
                repairId={repair.id}
                itemId={itemId}
              />
            ),
          },
        ]}
      />
    </RetroDialog>
  );
}
