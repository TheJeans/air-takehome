"use client";

import { useEffect } from "react";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import type { Clip } from "../../lib/clips";
import { useAssetsDnd } from "./GalleryDndProvider";
import { SortableAssetCard } from "./SortableAssetCard";
import { AssetCard } from "./AssetCard";
import { CardGrid } from "./CardGrid";

const ABOVE_FOLD_COUNT = 6;

// Renders the Unsorted grid from shared drag-and-drop state rather than
// straight from `initialAssets`, since assets move out of this grid once
// dropped on a board. `initialAssets` only seeds that state on first mount.
export function UnsortedAssetsGrid({ initialAssets }: { initialAssets: Clip[] }) {
  const { seedAssets, unsortedOrder, assetsById, assetsSeeded } = useAssetsDnd();

  useEffect(() => {
    seedAssets(initialAssets);
  }, [initialAssets, seedAssets]);

  // Before the seed effect commits, render straight from the server-fetched
  // prop so there's no empty-grid flash on first paint — same ids/order
  // either way, so the swap-over is a no-op visually. Cards render
  // read-only (plain AssetCard, not SortableAssetCard) until seeded, so a
  // drag can't start before shared state exists to record its result.
  const ids = assetsSeeded ? unsortedOrder : initialAssets.map((clip) => clip.id);
  const lookup = assetsSeeded
    ? assetsById
    : Object.fromEntries(initialAssets.map((clip) => [clip.id, clip]));

  if (ids.length === 0) {
    return <p className="text-sm text-gray-500">No unsorted assets remaining.</p>;
  }

  return (
    <SortableContext items={ids} strategy={rectSortingStrategy}>
      <CardGrid>
        {ids.map((id, index) =>
          assetsSeeded ? (
            <SortableAssetCard
              key={id}
              asset={lookup[id]}
              priority={index < ABOVE_FOLD_COUNT}
            />
          ) : (
            <AssetCard key={id} asset={lookup[id]} priority={index < ABOVE_FOLD_COUNT} />
          )
        )}
      </CardGrid>
    </SortableContext>
  );
}
