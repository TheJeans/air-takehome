"use client";

import { useEffect } from "react";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import type { Board } from "../../lib/boards";
import { useBoardsDnd } from "./GalleryDndProvider";
import { SortableBoardCard } from "./SortableBoardCard";
import { BoardCard } from "./BoardCard";
import { CardGrid } from "./CardGrid";

const ABOVE_FOLD_COUNT = 6;

// Mirrors UnsortedAssetsGrid: renders from shared drag-and-drop state rather
// than straight from `initialBoards`, since board order changes once
// reordered. `initialBoards` only seeds that state on first mount.
export function SortableBoardsGrid({ initialBoards }: { initialBoards: Board[] }) {
  const { seedBoards, boardOrder, boardsById, boardAssetIds, boardsSeeded } = useBoardsDnd();

  useEffect(() => {
    seedBoards(initialBoards);
  }, [initialBoards, seedBoards]);

  // Before seeding, render straight from the server prop (same ids/order,
  // no visual flash). Cards stay read-only until seeded, so a drag can't
  // start before shared state exists to record its result.
  const ids = boardsSeeded ? boardOrder : initialBoards.map((board) => board.id);
  const lookup = boardsSeeded
    ? boardsById
    : Object.fromEntries(initialBoards.map((board) => [board.id, board]));

  return (
    <SortableContext items={ids} strategy={rectSortingStrategy}>
      <CardGrid>
        {ids.map((id, index) =>
          boardsSeeded ? (
            <SortableBoardCard
              key={id}
              board={lookup[id]}
              priority={index < ABOVE_FOLD_COUNT}
              assetCount={boardAssetIds[id]?.length ?? 0}
            />
          ) : (
            <BoardCard
              key={id}
              board={lookup[id]}
              priority={index < ABOVE_FOLD_COUNT}
              assetCount={boardAssetIds[id]?.length ?? 0}
            />
          )
        )}
      </CardGrid>
    </SortableContext>
  );
}
