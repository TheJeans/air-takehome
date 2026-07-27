import type { Clip } from "./clips";

// Pure, framework-free reducer for appending a new page of assets onto
// existing gallery state. Kept out of GalleryDndProvider (same rationale as
// galleryDragEnd.ts) so the merge/dedupe logic is unit-testable without
// rendering React, and so pagination never falls back to a full-array
// replace as the list grows into the hundreds.

export interface AssetsSlice {
  assetsById: Record<string, Clip>;
  unsortedOrder: string[];
}

/**
 * Appends `clips` onto `state` without disturbing existing order, ids, or
 * object identity for anything already present. Skips ids already in
 * `assetsById` (defends against an overlapping/duplicate page, e.g. a
 * retried fetch or a cursor that didn't advance). Returns the same `state`
 * reference (not a copy) when there's nothing new to add, so callers can
 * skip a re-render by comparing `next === state`.
 */
export function mergeAssets(state: AssetsSlice, clips: Clip[]): AssetsSlice {
  let nextById: Record<string, Clip> | null = null;
  const newIds: string[] = [];

  for (const clip of clips) {
    if (state.assetsById[clip.id]) continue;
    if (!nextById) nextById = { ...state.assetsById };
    nextById[clip.id] = clip;
    newIds.push(clip.id);
  }

  if (!nextById) return state;

  return {
    assetsById: nextById,
    unsortedOrder: [...state.unsortedOrder, ...newIds],
  };
}
