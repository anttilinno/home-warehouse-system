import { Trans } from "@lingui/react/macro";
import { BevelButton, RetroBadge } from "@/components/retro";

// Phase 10b refactor — the PhotoGallery toolbar: the SELECT/DOWNLOAD row plus
// the bulk action bar. Extracted from the gallery body to lift the capability
// gates (canBulk/canDownloadZip) and the bulk-bar visibility guard out of the
// component. Renders nothing when neither the toolbar nor the bulk bar applies.
export function PhotoGalleryToolbar({
  canBulk,
  canDownloadZip,
  selecting,
  selectedCount,
  onToggleSelecting,
  onDownload,
  onBulkCaption,
  onBulkDelete,
  onClearSelection,
}: Readonly<{
  canBulk: boolean;
  canDownloadZip: boolean;
  selecting: boolean;
  selectedCount: number;
  onToggleSelecting: () => void;
  onDownload: () => void;
  onBulkCaption: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}>) {
  const showBulkBar = canBulk && selecting && selectedCount > 0;

  return (
    <>
      {(canBulk || canDownloadZip) && (
        <div className="flex items-center gap-sp-2 bg-bg-panel-2 p-sp-2">
          {canBulk && (
            <BevelButton aria-pressed={selecting} onClick={onToggleSelecting}>
              <Trans>SELECT</Trans>
            </BevelButton>
          )}
          <span className="flex-1" />
          {canDownloadZip && (
            <BevelButton onClick={onDownload}>
              {selectedCount ? (
                <Trans>⤓ DOWNLOAD {selectedCount}</Trans>
              ) : (
                <Trans>⤓ DOWNLOAD ALL</Trans>
              )}
            </BevelButton>
          )}
        </div>
      )}

      {showBulkBar && (
        <div
          data-testid="bulk-action-bar"
          className="flex items-center gap-sp-2 bg-bg-panel-2 p-sp-2"
        >
          <RetroBadge variant="info">
            <Trans>{selectedCount} SELECTED</Trans>
          </RetroBadge>
          <BevelButton onClick={onBulkCaption}>
            <Trans>EDIT CAPTION</Trans>
          </BevelButton>
          <BevelButton variant="danger" onClick={onBulkDelete}>
            <Trans>DELETE</Trans>
          </BevelButton>
          <BevelButton onClick={onClearSelection}>
            <Trans>✕ CLEAR</Trans>
          </BevelButton>
        </div>
      )}
    </>
  );
}
