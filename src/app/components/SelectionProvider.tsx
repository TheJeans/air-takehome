"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { rangeBetween, sameIds } from "../../lib/marquee";

interface SelectionActions {
  /** Replaces the whole selection. No-ops when the id set is unchanged. */
  replace: (ids: string[]) => void;
  toggle: (id: string) => void;
  clear: () => void;
  /** Last id the user clicked directly — the anchor for shift-click ranges. */
  readonly anchorId: string | null;
  setAnchor: (id: string | null) => void;
}

// Two contexts, deliberately: the ids change on every gesture frame, the
// actions never do. Cards are memoized and take both `selected` and `onSelect`
// as props from their grid; because the grid's `onSelect` (useSelectionClick)
// only depends on the stable actions, a selection change re-renders the grid
// plus the cards whose `selected` flipped, not all 700 of them. A single
// combined context would hand the grid a new object every frame, produce a new
// `onSelect`, and defeat React.memo on every card.
const SelectionIdsContext = createContext<Set<string> | null>(null);
const SelectionActionsContext = createContext<SelectionActions | null>(null);

export function useSelectedIds() {
  const ctx = useContext(SelectionIdsContext);
  if (!ctx) {
    throw new Error("useSelectedIds must be used within SelectionProvider");
  }
  return ctx;
}

export function useSelectionActions() {
  const ctx = useContext(SelectionActionsContext);
  if (!ctx) {
    throw new Error("useSelectionActions must be used within SelectionProvider");
  }
  return ctx;
}

/**
 * Click gestures for a selectable grid, mirroring Finder/Air: plain click
 * replaces the selection, cmd/ctrl toggles one card, shift extends from the
 * last clicked card. `order` is the list the shift-range is taken over, so
 * boards extend within boards and assets within assets.
 *
 * The returned callback is referentially stable for the component's lifetime
 * (`order` is read through a ref) so passing it to memoized cards doesn't
 * re-render the whole grid whenever the list or the selection changes.
 */
export function useSelectionClick(order: string[]) {
  const actions = useSelectionActions();
  const orderRef = useRef(order);
  orderRef.current = order;

  return useCallback(
    (id: string, event: React.MouseEvent) => {
      if (event.metaKey || event.ctrlKey) {
        actions.toggle(id);
        actions.setAnchor(id);
        return;
      }
      const anchorId = actions.anchorId;
      if (event.shiftKey && anchorId && orderRef.current.includes(anchorId)) {
        actions.replace(rangeBetween(orderRef.current, anchorId, id));
        return;
      }
      actions.replace([id]);
      actions.setAnchor(id);
    },
    [actions]
  );
}

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // Ref, not state: the anchor only ever gets read inside event handlers, and
  // changing it shouldn't re-render the grid.
  const anchorRef = useRef<string | null>(null);

  const replace = useCallback((ids: string[]) => {
    // Bail on an unchanged set so the marquee's per-frame onSelectionChange
    // doesn't re-render the grids (see sameIds in src/lib/marquee.ts).
    setSelectedIds((prev) => (sameIds(prev, ids) ? prev : new Set(ids)));
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    anchorRef.current = null;
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const setAnchor = useCallback((id: string | null) => {
    anchorRef.current = id;
  }, []);

  // Empty deps: every member is stable, and `anchorId` is a getter over a ref
  // so reading it at event time still sees the current value.
  const actions = useMemo(
    (): SelectionActions => ({
      replace,
      toggle,
      clear,
      get anchorId() {
        return anchorRef.current;
      },
      setAnchor,
    }),
    [replace, toggle, clear, setAnchor]
  );

  return (
    <SelectionActionsContext.Provider value={actions}>
      <SelectionIdsContext.Provider value={selectedIds}>{children}</SelectionIdsContext.Provider>
    </SelectionActionsContext.Provider>
  );
}
