"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
  const [activeDrag, setActiveDrag] = useState<{ id: string; kind: DragKind } | null>(null);

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const kind: DragKind = event.active.data.current?.type === "board" ? "board" : "asset";
    setActiveDrag({ id: String(event.active.id), kind });
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
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

    // Branching logic lives in computeDragEndState (src/lib/galleryDragEnd.ts)
    // so it's unit-testable without React or dnd-kit. next === prev means no-op.
    setState((prev) => {
      const next = computeDragEndState(prev, activeActor, overActor);
      return next === prev ? prev : { ...prev, ...next };
    });
  }, []);

  // Default dnd-kit announcements only cover sortable index changes, not
  // enough here (asset-onto-board, board reorder), so this is customized.
  const announcements: Announcements = useMemo(
    () => ({
      onDragStart({ active }) {
        if (active.data.current?.type === "board") {
          return `Picked up ${boardTitleFor(state, String(active.id))}.`;
        }
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
          return `${activeTitle} was moved to ${boardTitleFor(state, boardId)}.`;
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
    [state]
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
                  <div aria-hidden="true" className="w-40 cursor-grabbing">
                    <AssetCard asset={state.assetsById[activeDrag.id]} className="shadow-2xl" />
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
