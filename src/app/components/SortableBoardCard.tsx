"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Board } from "../../lib/boards";
import { BoardCard } from "./BoardCard";
import { selectableProps } from "./MarqueeSelectionArea";

// useSortable alone covers both jobs a board card needs: reordering against
// other boards, and acting as a drop target for an asset. No separate
// useDroppable needed.
// `assetCount` comes in as a prop rather than reading `boardAssetIds` off
// context directly, so unrelated board count changes don't re-render this card.
function SortableBoardCardImpl({
  board,
  priority,
  assetCount,
  selected,
  onSelect,
}: {
  board: Board;
  priority: boolean;
  assetCount: number;
  selected: boolean;
  onSelect: (id: string, event: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: board.id, data: { type: "board", boardId: board.id } });

  return (
    <BoardCard
      ref={setNodeRef}
      board={board}
      priority={priority}
      isOver={isOver}
      assetCount={assetCount}
      selected={selected}
      className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
      {...selectableProps(board.id, onSelect)}
    />
  );
}

export const SortableBoardCard = memo(SortableBoardCardImpl);
