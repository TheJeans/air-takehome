"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Clip } from "../../lib/clips";
import { AssetCard } from "./AssetCard";

// Wraps AssetCard with drag behavior for the Unsorted grid. Kept separate
// from AssetCard so that component stays a plain, presentational card
// (also used for read-only rendering elsewhere).
function SortableAssetCardImpl({
  asset,
  priority,
}: {
  asset: Clip;
  priority: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: asset.id, data: { type: "asset" } });

  return (
    <AssetCard
      ref={setNodeRef}
      asset={asset}
      priority={priority}
      className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
    />
  );
}

export const SortableAssetCard = memo(SortableAssetCardImpl);
