"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Clip } from "../../lib/clips";
import { AssetCard } from "./AssetCard";
import { selectableProps } from "./MarqueeSelectionArea";

// Wraps AssetCard with drag behavior for the Unsorted grid. Kept separate
// from AssetCard so that component stays a plain, presentational card
// (also used for read-only rendering elsewhere).
function SortableAssetCardImpl({
  asset,
  priority,
  eager,
  selected,
  onSelect,
}: {
  asset: Clip;
  priority: boolean;
  eager: boolean;
  selected: boolean;
  onSelect: (id: string, event: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: asset.id, data: { type: "asset" } });

  return (
    <AssetCard
      ref={setNodeRef}
      asset={asset}
      priority={priority}
      eager={eager}
      selected={selected}
      className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Left undefined (not 1) when idle: an inline opacity would outrank the
        // multi-drag fade rule in globals.css.
        opacity: isDragging ? 0.5 : undefined,
      }}
      {...attributes}
      {...listeners}
      // The pointer sensor activates on a 200ms hold, so a plain click still
      // reaches selectableProps' onClick rather than being swallowed by a drag.
      {...selectableProps(asset.id, onSelect)}
    />
  );
}

export const SortableAssetCard = memo(SortableAssetCardImpl);
