"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Board } from "../../lib/boards";
import { BoardCard } from "./BoardCard";

// Wraps BoardCard with drag behavior. useSortable alone covers both jobs a
// board card needs: reordering against the other boards, and acting as a
// drop target for an asset dragged out of Unsorted — dnd-kit's collision
// detection finds this card's rect for both cases, so a separate
// useDroppable isn't needed.
//
// `assetCount` comes in as a plain prop from SortableBoardsGrid rather than
// this component reading `boardAssetIds` off context itself — that would
// re-subscribe every board card to the whole map and re-render all of them
// whenever any single board's count changed, defeating `memo()` below.
function SortableBoardCardImpl({
  board,
  priority,
  assetCount,
}: {
  board: Board;
  priority: boolean;
  assetCount: number;
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

export const SortableBoardCard = memo(SortableBoardCardImpl);
