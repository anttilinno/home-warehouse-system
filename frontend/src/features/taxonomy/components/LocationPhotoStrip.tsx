import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, retroToast } from "@/components/retro";
import { locationPhotosApi } from "@/lib/api/locationPhotos";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// The desk-side half of the mobile capture loop: a phone attaches a photo to a
// location it just created, and this is where that photo is actually looked at
// while the location gets named properly. Edit mode only — a location has to
// exist before it can own a photo.

export interface LocationPhotoStripProps {
  locationId: string;
}

export function LocationPhotoStrip({
  locationId,
}: Readonly<LocationPhotoStripProps>) {
  const { t } = useLingui();
  const { currentWorkspaceId } = useWorkspace();
  const wsId = currentWorkspaceId ?? "";
  const qc = useQueryClient();

  const queryKey = ["location-photos", wsId, locationId];
  const { data: photos = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => locationPhotosApi.list(wsId, locationId),
    enabled: Boolean(wsId && locationId),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => locationPhotosApi.del(wsId, photoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      retroToast.success(t`Photo deleted.`);
    },
    onError: () => retroToast.error(t`Couldn't delete this photo.`),
  });
  const removePhoto = remove.mutate;

  if (isLoading || photos.length === 0) return null;

  return (
    <div className="flex flex-col gap-sp-2">
      <span className="text-11 font-bold uppercase tracking-8 text-fg-muted">
        <Trans>Photos</Trans>
      </span>
      <ul className="flex flex-wrap gap-sp-2">
        {photos.map((p) => (
          <li key={p.id} className="flex flex-col gap-sp-1">
            <img
              src={p.url}
              alt={p.caption || p.original_name}
              loading="lazy"
              className="h-[96px] w-[96px] border-2 border-border-ink object-cover"
            />
            <BevelButton
              type="button"
              variant="danger"
              className="!px-[8px] !py-[2px] !text-11"
              aria-label={t`Delete photo ${p.original_name}`}
              disabled={remove.isPending}
              onClick={() => removePhoto(p.id)}
            >
              {"⌫"}
            </BevelButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
