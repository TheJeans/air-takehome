import { arrayMove } from "@dnd-kit/sortable";

// Pure, framework-free reducer for the shared gallery drag-and-drop state.
// Kept out of GalleryDndProvider so the branching (board reorder vs. asset
// move vs. asset reorder, plus the no-op guards) is unit-testable without
// rendering React or dnd-kit.

export interface DragEndState {
  unsortedOrder: string[];
  boardOrder: string[];
  boardAssetIds: Record<string, string[]>;
}

export interface DragEndActor {
  id: string;
  /** Mirrors the `type` dnd-kit's `data.current` carries: "asset" | "board". */
  type?: string;
  /** Only set on board droppables, see SortableBoardCard. */
  boardId?: string;
}

/**
 * Returns the next state after a drag-and-drop completes. Returns the same
 * `state` reference (not a copy) for every no-op case, so callers can skip
 * a re-render by comparing `next === state`.
 */
export function computeDragEndState(
  state: DragEndState,
  active: DragEndActor,
  over: DragEndActor | null
): DragEndState {
  if (!over || active.id === over.id) return state;

  if (active.type === "board") {
    // Reorder: boards dragged among themselves. A board dragged over an
    // asset is a no-op, never a cross-list move, boards and assets don't mix.
    if (over.type !== "board") return state;
    const oldIndex = state.boardOrder.indexOf(active.id);
    const newIndex = state.boardOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return state;
    return { ...state, boardOrder: arrayMove(state.boardOrder, oldIndex, newIndex) };
  }

  if (over.type === "board") {
    // Move: asset dropped onto a board card.
    const targetBoardId = over.boardId ?? over.id;
    if (!state.unsortedOrder.includes(active.id)) return state;
    return {
      ...state,
      unsortedOrder: state.unsortedOrder.filter((id) => id !== active.id),
      boardAssetIds: {
        ...state.boardAssetIds,
        [targetBoardId]: [...(state.boardAssetIds[targetBoardId] ?? []), active.id],
      },
    };
  }

  if (over.type !== "asset") return state;

  // Reorder: dropped over another card within the Unsorted grid.
  const oldIndex = state.unsortedOrder.indexOf(active.id);
  const newIndex = state.unsortedOrder.indexOf(over.id);
  if (oldIndex === -1 || newIndex === -1) return state;
  return { ...state, unsortedOrder: arrayMove(state.unsortedOrder, oldIndex, newIndex) };
}

/** Stable fingerprint of an id set, used to detect real reseeds vs. re-runs. */
export function idsKey(ids: string[]): string {
  return ids.join(",");
}
