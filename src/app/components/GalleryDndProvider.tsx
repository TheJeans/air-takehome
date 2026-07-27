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

// Shared client-state model for the Unsorted <-> board asset drag-and-drop,
// and for reordering boards among themselves. There's no write API, so this
// is purely in-memory and lifted to the lowest common ancestor of the
// Unsorted grid and the boards grid (see page.tsx).
//
// `assetsSourceKey`/`boardsSourceKey` (rather than a one-shot boolean) track
// *what* was last seeded, so a changed server payload (e.g. after
// `router.refresh()`) can reseed instead of latching closed forever after
// the first mount.
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

  // Visual clone shown in <DragOverlay> — kept separate from `state` since
  // it's pure UI, not shared drag-and-drop data. It changes on every drag
  // start/end regardless of which domain is dragging, so keeping it out of
  // `state` keeps the memoized context values below (see assetsValue /
  // boardsValue) from recomputing on every drag frame's start/end too.
  const [activeDrag, setActiveDrag] = useState<{ id: string; kind: DragKind } | null>(null);

  // Reseeds whenever the incoming clip *set* actually changes (compared by
  // id, not by reference) rather than latching closed after the first call —
  // otherwise a revalidated fetch (`router.refresh()`) would never reach the
  // grid once mounted. A same-set re-run (e.g. React strict-mode's double
  // effect) is a no-op so in-progress reordering isn't wiped.
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

  // Same reseed-on-change pattern as seedAssets, for the boards grid.
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

  // Pointer activation waits on a brief press-and-hold (rather than firing on
  // the first few pixels of movement) so a plain click/tap can still be used
  // as a "select" gesture later without racing drag activation — see LOG.md
  // on the react-drag-to-select pointerdown conflict this sets up for.
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

    // The branching (board reorder / asset move / asset reorder / no-op)
    // lives in computeDragEndState — see src/lib/galleryDragEnd.ts — so it's
    // unit-testable without rendering React or dnd-kit. `next === prev`
    // means a no-op, so we bail without a state update in that case.
    setState((prev) => {
      const next = computeDragEndState(prev, activeActor, overActor);
      return next === prev ? prev : { ...prev, ...next };
    });
  }, []);

  // Default dnd-kit announcements only describe sortable index changes —
  // not enough given we also support dropping an asset onto a named board
  // and reordering boards themselves, so this is customized per drag source.
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

  // Split into two context values, each memoized on only the state slice its
  // consumers read. `setState`'s spreads leave untouched slices at the same
  // object reference, so e.g. an asset reorder (which only replaces
  // `unsortedOrder`) leaves `boardsValue` referentially identical and board
  // cards skip re-rendering — a single combined context value would change
  // (and cascade re-renders through `memo()`) on every drag, anywhere.
  const assetsValue = useMemo(
    (): AssetsContextValue => ({
      assetsById: state.assetsById,
      unsortedOrder: state.unsortedOrder,
      assetsSeeded: state.assetsSourceKey !== null,
      seedAssets,
    }),
    [state.assetsById, state.unsortedOrder, state.assetsSourceKey, seedAssets]
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
          // snapCenterToCursor: without it, grabbing a card off-center (by
          // an edge/corner) left the dragged clone offset from the cursor
          // by however far off-center the grab point was.
          // restrictToFirstScrollableAncestor: clamps the drag to the app
          // shell's actual scroll region (the overflow-y-auto content pane
          // in layout.tsx — the page itself doesn't scroll) — without it,
          // dragging near the right/bottom edge fought with dnd-kit's
          // auto-scroll and the page snapped back and forth.
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
