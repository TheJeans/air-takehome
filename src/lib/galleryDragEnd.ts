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
 * The assets a drag is actually carrying: the whole marquee/click selection
 * when the grabbed card is part of it, otherwise just the grabbed card.
 * Returned in grid order (not selection order) so a multi-drop preserves what
 * the user sees, and filtered to ids still in Unsorted.
 */
function draggedAssetIds(
  state: DragEndState,
  active: DragEndActor,
  selectedIds?: string[]
): string[] {
  if (selectedIds && selectedIds.length > 1 && selectedIds.includes(active.id)) {
    const set = new Set(selectedIds);
    const ids = state.unsortedOrder.filter((id) => set.has(id));
    if (ids.length > 1) return ids;
  }
  return state.unsortedOrder.includes(active.id) ? [active.id] : [];
}

/**
 * Returns the next state after a drag-and-drop completes. Returns the same
 * `state` reference (not a copy) for every no-op case, so callers can skip
 * a re-render by comparing `next === state`.
 *
 * `selectedIds` carries the current selection so dragging one card of a
 * multi-selection moves the whole set. Boards deliberately ignore it: board
 * reorder stays single-card.
 */
export function computeDragEndState(
  state: DragEndState,
  active: DragEndActor,
  over: DragEndActor | null,
  selectedIds?: string[]
): DragEndState {
  if (!over) return state;
  if (active.id === over.id && active.type === "board") return state;

  if (active.type === "board") {
    // Reorder: boards dragged among themselves. A board dragged over an
    // asset is a no-op, never a cross-list move, boards and assets don't mix.
    if (over.type !== "board") return state;
    const oldIndex = state.boardOrder.indexOf(active.id);
    const newIndex = state.boardOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return state;
    return { ...state, boardOrder: arrayMove(state.boardOrder, oldIndex, newIndex) };
  }

  const dragged = draggedAssetIds(state, active, selectedIds);
  if (dragged.length === 0) return state;

  if (over.type === "board") {
    // Move: asset(s) dropped onto a board card. Multi-drop appends the whole
    // selection in grid order.
    const targetBoardId = over.boardId ?? over.id;
    const set = new Set(dragged);
    return {
      ...state,
      unsortedOrder: state.unsortedOrder.filter((id) => !set.has(id)),
      boardAssetIds: {
        ...state.boardAssetIds,
        [targetBoardId]: [...(state.boardAssetIds[targetBoardId] ?? []), ...dragged],
      },
    };
  }

  if (over.type !== "asset") return state;

  // Reorder within the Unsorted grid.
  if (dragged.length === 1) {
    if (active.id === over.id) return state;
    const oldIndex = state.unsortedOrder.indexOf(active.id);
    const newIndex = state.unsortedOrder.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return state;
    return { ...state, unsortedOrder: arrayMove(state.unsortedOrder, oldIndex, newIndex) };
  }

  // Multi-reorder: the selection moves as one block. Dropping onto a card
  // that's part of the selection is a no-op — there's nowhere to land.
  const set = new Set(dragged);
  if (set.has(over.id)) return state;
  const overIndex = state.unsortedOrder.indexOf(over.id);
  if (overIndex === -1) return state;
  const remaining = state.unsortedOrder.filter((id) => !set.has(id));
  const target = remaining.indexOf(over.id);
  // Dragging up lands the block before the target card, dragging down lands it
  // after — same "push the target aside" feel as single-card arrayMove.
  // Measured from the grabbed card, not `dragged[0]`: with a non-contiguous
  // selection the topmost selected card can sit on the other side of the drop
  // target from the card actually under the pointer.
  const movingUp = overIndex < state.unsortedOrder.indexOf(active.id);
  const insertAt = movingUp ? target : target + 1;
  return {
    ...state,
    unsortedOrder: [...remaining.slice(0, insertAt), ...dragged, ...remaining.slice(insertAt)],
  };
}

/** Stable fingerprint of an id set, used to detect real reseeds vs. re-runs. */
export function idsKey(ids: string[]): string {
  return ids.join(",");
}
