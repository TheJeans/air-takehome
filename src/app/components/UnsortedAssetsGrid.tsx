"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { fetchAssets, type Clip } from "../../lib/clips";
import { useAssetsDnd } from "./GalleryDndProvider";
import { SortableAssetCard } from "./SortableAssetCard";
import { AssetCard } from "./AssetCard";
import { CardGrid } from "./CardGrid";

const ABOVE_FOLD_COUNT = 6;
// Small so a fetch is likely already in flight (or done) before the
// sentinel is actually visible - avoids a blank gap while the next page
// loads on a fast scroll, without prefetching pages nobody's near yet.
const SENTINEL_ROOT_MARGIN = "600px 0px";

interface Pagination {
  hasMore: boolean;
  cursor: string | null;
}

function LoadingMoreIndicator() {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 py-2" aria-hidden="true">
      <div className="size-2 animate-pulse rounded-full bg-gray-300" />
      <div className="size-2 animate-pulse rounded-full bg-gray-300 [animation-delay:150ms]" />
      <div className="size-2 animate-pulse rounded-full bg-gray-300 [animation-delay:300ms]" />
    </div>
  );
}

// Renders the Unsorted grid from shared drag-and-drop state rather than
// straight from `initialAssets`, since assets move out of this grid once
// dropped on a board. `initialAssets` only seeds that state on first mount.
export function UnsortedAssetsGrid({
  initialAssets,
  initialPagination,
}: {
  initialAssets: Clip[];
  initialPagination: Pagination;
}) {
  const { seedAssets, appendAssets, unsortedOrder, assetsById, assetsSeeded } = useAssetsDnd();

  useEffect(() => {
    seedAssets(initialAssets);
  }, [initialAssets, seedAssets]);

  // Ids from the server-rendered first page only — these get eager image
  // loading to avoid the initial flash. Everything pulled in later via
  // infinite scroll is a real lazy-load candidate (see AssetCard/`eager`).
  // Keyed by id, not index, so a drag reorder can't relabel a paginated
  // card as "eager" just because it moved earlier in the list.
  const eagerIds = useMemo(
    () => new Set(initialAssets.map((clip) => clip.id)),
    [initialAssets]
  );

  // Pagination cursor/hasMore live here (component-local), not in
  // GalleryDndProvider - they're fetch bookkeeping for this grid, not
  // shared drag state. Seeded once from the server's first page.
  const [cursor, setCursor] = useState(initialPagination.cursor);
  const [hasMore, setHasMore] = useState(initialPagination.hasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Ref (not state) so a fast double-fire of the observer can't race past
  // the state update and fire two overlapping fetches.
  const isFetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(() => {
    if (isFetchingRef.current || !hasMore) return;
    isFetchingRef.current = true;
    setIsLoadingMore(true);
    fetchAssets({ cursor })
      .then((response) => {
        appendAssets(response.data.clips);
        setCursor(response.pagination.cursor);
        setHasMore(response.pagination.hasMore);
      })
      .catch(() => {
        // Leave hasMore/cursor as-is so the sentinel stays put; scrolling
        // it back into view (or another intersection) retries the fetch.
      })
      .finally(() => {
        isFetchingRef.current = false;
        setIsLoadingMore(false);
      });
  }, [cursor, hasMore, appendAssets]);

  // IntersectionObserver rather than a scroll listener: it's driven by the
  // compositor instead of firing on every scroll tick, which matters under
  // CPU throttling with hundreds of cards in the DOM.
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: SENTINEL_ROOT_MARGIN }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // Before seeding, render straight from the server prop (same ids/order,
  // no visual flash). Cards stay read-only until seeded, so a drag can't
  // start before shared state exists to record its result.
  const ids = assetsSeeded ? unsortedOrder : initialAssets.map((clip) => clip.id);
  const lookup = assetsSeeded
    ? assetsById
    : Object.fromEntries(initialAssets.map((clip) => [clip.id, clip]));

  if (ids.length === 0) {
    return <p className="text-sm text-gray-500">No unsorted assets remaining.</p>;
  }

  return (
    <>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <CardGrid>
          {ids.map((id, index) =>
            assetsSeeded ? (
              <SortableAssetCard
                key={id}
                asset={lookup[id]}
                priority={index < ABOVE_FOLD_COUNT}
                eager={eagerIds.has(id)}
              />
            ) : (
              <AssetCard
                key={id}
                asset={lookup[id]}
                priority={index < ABOVE_FOLD_COUNT}
                eager={eagerIds.has(id)}
              />
            )
          )}
        </CardGrid>
      </SortableContext>
      {isLoadingMore && <LoadingMoreIndicator />}
      {hasMore && (
        <>
          {/* 1px, non-visual: exists only to give the IntersectionObserver
              something to watch near the bottom of the grid. */}
          <div ref={sentinelRef} aria-hidden="true" className="h-px" />
          <p role="status" aria-live="polite" className="sr-only">
            {isLoadingMore ? "Loading more assets…" : ""}
          </p>
        </>
      )}
    </>
  );
}
