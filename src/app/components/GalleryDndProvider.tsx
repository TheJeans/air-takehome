"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, snapCenterToCursor } from "@dnd-kit/modifiers";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Clip } from "../../lib/clips";
import type { Board } from "../../lib/boards";
import { AssetCard } from "./AssetCard";
import { BoardCard } from "./BoardCard";
import { computeDragEndState, idsKey } from "../../lib/galleryDragEnd";
import { mergeAssets } from "../../lib/mergeAssets";
import { useSelectedIds, useSelectionActions } from "./SelectionProvider";

// In-memory only, no write API exists. Lifted here so both the Unsorted
// grid and boards grid can share it (see page.tsx).
// `*SourceKey` tracks what was last seeded (vs. a one-shot bool) so a
// changed server payload can reseed instead of latching shut after mount.
interface GalleryState {
  assetsById: Record<string, Clip>;
  unsortedOrder: string[];
  assetsSourceKey: string | null;
  boardsById: Record<string, Board>;
  boardOrder: string[];
  boardAssetIds: Record<string, string[]>;
  boardsSourceKey: string | null;
}

interface AssetsContextValue {
  assetsById: Record<string, Clip>;
  unsortedOrder: string[];
  assetsSeeded: boolean;
  seedAssets: (clips: Clip[]) => void;
  /** Appends a fetched pagination page onto existing assets (infinite
   *  scroll), rather than replacing the set the way seedAssets does. */
  appendAssets: (clips: Clip[]) => void;
}

interface BoardsContextValue {
  boardsById: Record<string, Board>;
  boardOrder: string[];
  boardAssetIds: Record<string, string[]>;
  boardsSeeded: boolean;
  seedBoards: (boards: Board[]) => void;
}

type DragKind = "asset" | "board";

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "To pick up an item, press space or enter. While dragging an asset, use the arrow keys to move it within the Unsorted grid, or onto a board to file it there. While dragging a board, use the arrow keys to reorder it among the other boards. Press space or enter again to drop, or escape to cancel.",
};

function titleFor(state: GalleryState, id: string): string {
  const asset = state.assetsById[id];
  return asset?.title ?? asset?.importedName ?? "asset";
}

function boardTitleFor(state: GalleryState, id: string): string {
  return state.boardsById[id]?.title || "board";
}

const AssetsDndContext = createContext<AssetsContextValue | null>(null);
const BoardsDndContext = createContext<BoardsContextValue | null>(null);

export function useAssetsDnd() {
  const ctx = useContext(AssetsDndContext);
  if (!ctx) {
    throw new Error("useAssetsDnd must be used within GalleryDndProvider");
  }
  return ctx;
}

export function useBoardsDnd() {
  const ctx = useContext(BoardsDndContext);
  if (!ctx) {
    throw new Error("useBoardsDnd must be used within GalleryDndProvider");
  }
  return ctx;
}

export function GalleryDndProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GalleryState>({
    assetsById: {},
    unsortedOrder: [],
    assetsSourceKey: null,
    boardsById: {},
    boardOrder: [],
    boardAssetIds: {},
    boardsSourceKey: null,
  });

  // DragOverlay clone, kept out of `state` (pure UI, changes every drag
  // start/end) so it doesn't force assetsValue/boardsValue to recompute.
  // `count` is how many assets this drag is carrying (see handleDragStart).
  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    kind: DragKind;
    count: number;
  } | null>(null);

  const selectedIds = useSelectedIds();
  const selectionActions = useSelectionActions();
  // Read inside drag handlers, which are created once — refs keep them from
  // seeing a snapshot from an earlier render. Assigned in an effect, not during
  // render: a render React throws away must not leave these holding values that
  // were never committed.
  const selectedRef = useRef(selectedIds);
  const stateRef = useRef(state);
  useEffect(() => {
    selectedRef.current = selectedIds;
    stateRef.current = state;
  }, [selectedIds, state]);

  // Selected ids that are still unsorted assets — boards can also be selected,
  // and they don't ride along on an asset drag.
  const selectedAssetIds = useCallback(
    () => stateRef.current.unsortedOrder.filter((id) => selectedRef.current.has(id)),
    []
  );

  // How many assets a drag of `id` is carrying, or null when it's a plain
  // single-card drag. One helper so the overlay badge and the two screen-reader
  // announcements can't disagree about what's being moved.
  const multiAssetCount = useCallback(
    (id: string): number | null => {
      if (!selectedRef.current.has(id)) return null;
      const count = selectedAssetIds().length;
      return count > 1 ? count : null;
    },
    [selectedAssetIds]
  );

  // Reseeds on a real id-set change, not just once, so a revalidated fetch
  // isn't stuck with stale data. Same-set re-runs (e.g. strict-mode) no-op.
  const seedAssets = useCallback((clips: Clip[]) => {
    setState((prev) => {
      const key = idsKey(clips.map((clip) => clip.id));
      if (prev.assetsSourceKey === key) return prev;
      const assetsById: Record<string, Clip> = {};
      const unsortedOrder: string[] = [];
      for (const clip of clips) {
        assetsById[clip.id] = clip;
        unsortedOrder.push(clip.id);
      }
      return { ...prev, assetsById, unsortedOrder, assetsSourceKey: key };
    });
  }, []);

  // Appends a page fetched by infinite scroll. Delegates the actual
  // merge/dedupe to mergeAssets (src/lib/mergeAssets.ts) so it's
  // unit-testable and, critically, an O(new items) append rather than an
  // O(n) rebuild of the whole set on every page as the list grows.
  const appendAssets = useCallback((clips: Clip[]) => {
    setState((prev) => {
      const next = mergeAssets(prev, clips);
      return next === prev ? prev : { ...prev, ...next };
    });
  }, []);

  // Same reseed-on-change pattern as seedAssets.
  const seedBoards = useCallback((boards: Board[]) => {
    setState((prev) => {
      const key = idsKey(boards.map((board) => board.id));
      if (prev.boardsSourceKey === key) return prev;
      const boardsById: Record<string, Board> = {};
      const boardOrder: string[] = [];
      for (const board of boards) {
        boardsById[board.id] = board;
        boardOrder.push(board.id);
      }
      return { ...prev, boardsById, boardOrder, boardsSourceKey: key };
    });
  }, []);

  // Press-and-hold to activate (not on first movement) so a plain click can
  // later work as a select gesture without racing drag activation.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const kind: DragKind = event.active.data.current?.type === "board" ? "board" : "asset";
      const id = String(event.active.id);

      // Grabbing a card outside the current selection makes it the selection —
      // Finder/Air behavior, and it keeps the drag from silently carrying cards
      // the user isn't pointing at.
      let count = 1;
      if (kind === "asset") {
        if (selectedRef.current.has(id)) {
          count = multiAssetCount(id) ?? 1;
        } else {
          selectionActions.replace([id]);
          selectionActions.setAnchor(id);
        }
      }
      setActiveDrag({ id, kind, count });
    },
    [selectionActions, multiAssetCount]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);

      const { active, over } = event;
      const activeActor = { id: String(active.id), type: active.data.current?.type as string | undefined };
      const overActor = over
        ? {
            id: String(over.id),
            type: over.data.current?.type as string | undefined,
            boardId: over.data.current?.boardId as string | undefined,
          }
        : null;

      // The whole selection rides along when the grabbed card is part of it.
      const dragging = activeActor.type === "board" ? undefined : selectedAssetIds();

      // Branching logic lives in computeDragEndState (src/lib/galleryDragEnd.ts)
      // so it's unit-testable without React or dnd-kit. next === prev means no-op.
      setState((prev) => {
        const next = computeDragEndState(prev, activeActor, overActor, dragging);
        return next === prev ? prev : { ...prev, ...next };
      });

      // Assets filed onto a board have left the Unsorted grid, so the
      // selection that pointed at them is stale. A reorder keeps its selection.
      if (overActor?.type === "board" && activeActor.type === "asset") {
        selectionActions.clear();
      }
    },
    [selectionActions, selectedAssetIds]
  );

  // Default dnd-kit announcements only cover sortable index changes, not
  // enough here (asset-onto-board, board reorder), so this is customized.
  const announcements: Announcements = useMemo(
    () => ({
      onDragStart({ active }) {
        if (active.data.current?.type === "board") {
          return `Picked up ${boardTitleFor(state, String(active.id))}.`;
        }
        const count = multiAssetCount(String(active.id));
        if (count) return `Picked up ${count} assets.`;
        return `Picked up ${titleFor(state, String(active.id))}.`;
      },
      onDragOver({ active, over }) {
        if (!over) return undefined;
        if (active.data.current?.type === "board") {
          const index = state.boardOrder.indexOf(String(over.id));
          if (index === -1) return undefined;
          return `${boardTitleFor(state, String(active.id))} is over position ${index + 1} of ${state.boardOrder.length}.`;
        }
        const activeTitle = titleFor(state, String(active.id));
        const boardId = over.data.current?.boardId as string | undefined;
        if (boardId) {
          return `${activeTitle} is over ${boardTitleFor(state, boardId)}.`;
        }
        const index = state.unsortedOrder.indexOf(String(over.id));
        if (index === -1) return undefined;
        return `${activeTitle} is over position ${index + 1} of ${state.unsortedOrder.length}.`;
      },
      onDragEnd({ active, over }) {
        if (active.data.current?.type === "board") {
          const activeTitle = boardTitleFor(state, String(active.id));
          return over ? `${activeTitle} was reordered.` : `${activeTitle} was dropped.`;
        }
        const activeTitle = titleFor(state, String(active.id));
        if (!over) return `${activeTitle} was dropped.`;
        const boardId = over.data.current?.boardId as string | undefined;
        if (boardId) {
          const count = multiAssetCount(String(active.id));
          return `${count ? `${count} assets` : activeTitle} moved to ${boardTitleFor(state, boardId)}.`;
        }
        return `${activeTitle} was reordered.`;
      },
      onDragCancel({ active }) {
        const label =
          active.data.current?.type === "board"
            ? boardTitleFor(state, String(active.id))
            : titleFor(state, String(active.id));
        return `Moving ${label} was cancelled.`;
      },
    }),
    [state, multiAssetCount]
  );

  // Two context values, each memoized on its own state slice, so an asset
  // reorder doesn't change boardsValue's reference and re-render every board.
  const assetsValue = useMemo(
    (): AssetsContextValue => ({
      assetsById: state.assetsById,
      unsortedOrder: state.unsortedOrder,
      assetsSeeded: state.assetsSourceKey !== null,
      seedAssets,
      appendAssets,
    }),
    [state.assetsById, state.unsortedOrder, state.assetsSourceKey, seedAssets, appendAssets]
  );

  const boardsValue = useMemo(
    (): BoardsContextValue => ({
      boardsById: state.boardsById,
      boardOrder: state.boardOrder,
      boardAssetIds: state.boardAssetIds,
      boardsSeeded: state.boardsSourceKey !== null,
      seedBoards,
    }),
    [state.boardsById, state.boardOrder, state.boardAssetIds, state.boardsSourceKey, seedBoards]
  );

  return (
    <AssetsDndContext.Provider value={assetsValue}>
      <BoardsDndContext.Provider value={boardsValue}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          accessibility={{ announcements, screenReaderInstructions }}
          // snapCenterToCursor keeps an off-center grab from drifting from the cursor.
          // restrictToFirstScrollableAncestor clamps to the app shell's actual
          // scroll region (layout.tsx), otherwise edge-drag fought the auto-scroll.
          modifiers={[snapCenterToCursor, restrictToFirstScrollableAncestor]}
        >
          {children}
          {/* Cross-container drags (asset -> board) had no floating clone
              without this: dnd-kit only transforms the item in place within
              its own sortable list, so crossing into a different container
              made the dragged card appear to vanish mid-drag. */}
          <DragOverlay>
            {activeDrag &&
              (activeDrag.kind === "asset" ? (
                state.assetsById[activeDrag.id] && (
                  <div aria-hidden="true" className="relative w-40 cursor-grabbing">
                    {/* Offset stubs behind the card read as "a stack" while
                        multiple assets are in flight. */}
                    {activeDrag.count > 1 && (
                      <>
                        <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-2xl bg-gray-300 shadow-lg" />
                        <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-2xl bg-gray-400 shadow-lg" />
                      </>
                    )}
                    <AssetCard
                      asset={state.assetsById[activeDrag.id]}
                      className="relative shadow-2xl"
                      // The bitmap is already cached, but FadeInImage starts at
                      // opacity-0 — without this the clone fades up over 300ms
                      // every time a drag starts.
                      eager
                    />
                    {activeDrag.count > 1 && (
                      <div className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-blue-600 px-1.5 text-sm font-semibold text-white shadow-lg">
                        {activeDrag.count}
                      </div>
                    )}
                  </div>
                )
              ) : (
                state.boardsById[activeDrag.id] && (
                  <div aria-hidden="true" className="w-40 cursor-grabbing">
                    <BoardCard board={state.boardsById[activeDrag.id]} className="shadow-2xl" />
                  </div>
                )
              ))}
          </DragOverlay>
        </DndContext>
      </BoardsDndContext.Provider>
    </AssetsDndContext.Provider>
  );
}
