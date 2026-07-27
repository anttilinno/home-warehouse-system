import { get, set, del } from "idb-keyval";

// Blob side-store for queued capture photos.
//
// The query-cache persister serialises with JSON.stringify, so a File carried
// directly in a paused mutation's variables is restored as `undefined` after a
// reload — the capture still replayed, but its photo was gone with no error.
// The mutation vars now carry only a photo *id* and the bytes live here.
//
// Stored as { name, type, buf } rather than the File itself: IndexedDB's
// structured clone does handle File in real browsers, but round-tripping a
// plain ArrayBuffer plus its two metadata strings relies on nothing beyond the
// oldest part of the spec — and, unlike a File, it survives the jsdom test
// environment, so the reload path is coverable by a unit test instead of only
// in a browser.
//
// Same idb-keyval default store the persister uses; the prefix keeps these rows
// distinguishable from the single "hws-rq-cache" key.
const key = (id: string): string => `hws-capture-photo-${id}`;

interface StoredPhoto {
  name: string;
  type: string;
  buf: ArrayBuffer;
}

export async function putCapturePhoto(id: string, photo: File): Promise<void> {
  await set(key(id), {
    name: photo.name,
    type: photo.type,
    buf: await photo.arrayBuffer(),
  } satisfies StoredPhoto);
}

// Read-only on purpose: the mutation may be retried, so the bytes have to
// survive a failed attempt. Deletion is the caller's job once the write has
// settled for good (see dropCapturePhoto).
export async function getCapturePhoto(id: string): Promise<File | undefined> {
  const stored = await get<StoredPhoto>(key(id));
  if (!stored) return undefined;
  return new File([stored.buf], stored.name, { type: stored.type });
}

export function dropCapturePhoto(id: string): Promise<void> {
  return del(key(id));
}
