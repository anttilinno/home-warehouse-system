// Ask the browser to make IndexedDB persistent so storage-pressure eviction
// can't silently delete the paused offline-write queue (lost field data).
// Best-effort: unsupported/denied is fine — the queue still works, it's just
// evictable. Fire once at boot.
export async function requestPersistentStorage(): Promise<void> {
  try {
    const granted = await navigator.storage?.persist?.();
    if (granted !== undefined) {
      console.debug(`[offline] persistent storage: ${granted}`);
    }
  } catch {
    // no-op: never block boot on a storage-permission probe
  }
}
