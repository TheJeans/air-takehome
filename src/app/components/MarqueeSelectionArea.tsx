"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelectionContainer } from "@air/react-drag-to-select";
import { useDndMonitor } from "@dnd-kit/core";
import {
  edgeScrollDelta,
  idsIntersecting,
  toContentBox,
  unionIds,
  type CardRect,
} from "../../lib/marquee";
import { useSelectedIds, useSelectionActions } from "./SelectionProvider";

// Cards tag themselves with this so the marquee can find them in the DOM
// instead of every card having to register a ref upward.
export const SELECTABLE_ID_ATTR = "data-select-id";

// Real controls inside the area — the section's collapse toggle, the card
// ellipsis menu. Cards themselves are NOT excluded: dnd-kit's pointer sensor
// only activates after a 200ms hold, so a quick drag off a card isn't a card
// drag and should marquee. useDndMonitor below cancels the marquee if a hold
// does turn into a real drag.
const NON_MARQUEE_SELECTOR = `button, a, [role="menu"]`;

/** Announcements are debounced so a marquee sweep doesn't queue dozens. */
const ANNOUNCE_DELAY_MS = 400;

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NON_MARQUEE_SELECTOR) !== null;
}

function isCardTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${SELECTABLE_ID_ATTR}]`) !== null;
}

/**
 * Props that make a card marquee-findable and click-selectable. Shared by the
 * asset and board cards so a new selectable card type can't ship without the
 * interactive-target guard — CardMenu lives inside the card and only stops
 * pointerdown (for the drag sensor), so its clicks still bubble to the card and
 * would otherwise collapse a multi-selection.
 *
 * Spread *after* dnd-kit's listeners so its handlers don't overwrite onClick.
 */
export function selectableProps(
  id: string,
  onSelect: (id: string, event: React.MouseEvent) => void
) {
  return {
    [SELECTABLE_ID_ATTR]: id,
    onClick: (event: React.MouseEvent) => {
      if (isInteractiveTarget(event.target)) return;
      onSelect(id, event);
    },
  };
}

/**
 * True when a mousedown landed on the scroll container's own scrollbar rather
 * than page content. Those events target the container itself, so without this
 * check dragging the scrollbar reads as "drag on empty space" and both clears
 * the selection and sweeps a box.
 */
function isScrollbarEvent(event: MouseEvent): boolean {
  const el = event.currentTarget;
  if (!(el instanceof HTMLElement) || event.target !== el) return false;
  return event.offsetX > el.clientWidth || event.offsetY > el.clientHeight;
}

/**
 * Nearest scrollable ancestor, which is the region a drag should be allowed to
 * start anywhere in — the app shell's scroll container (layout.tsx), not just
 * the box this component's own div happens to occupy. Walked at runtime rather
 * than hardcoding a selector so a layout change can't silently shrink it.
 */
function scrollParentOf(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }
  return node;
}

/**
 * Card rects in container-relative ("content") coordinates, so they stay valid
 * if the user scrolls mid-gesture. Measured once per gesture rather than every
 * frame — 700+ getBoundingClientRect calls per animation frame is a layout
 * thrash we don't need.
 */
function snapshotCards(root: HTMLElement | null): CardRect[] {
  if (!root) return [];
  const origin = root.getBoundingClientRect();
  return Array.from(root.querySelectorAll<HTMLElement>(`[${SELECTABLE_ID_ATTR}]`)).map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      id: node.getAttribute(SELECTABLE_ID_ATTR) as string,
      rect: {
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      },
    };
  });
}

/**
 * Drag-to-select (marquee) over the cards it wraps, on top of
 * @air/react-drag-to-select. Selection state itself lives in SelectionProvider
 * so cards can read it without this component owning them.
 *
 * Gestures:
 *  - drag (from empty space or straight off a card) -> marquee select
 *  - press-and-hold a card, then drag               -> dnd-kit card drag
 *  - shift/cmd/ctrl + drag                          -> add to the selection
 *  - click empty space, or escape                   -> clear
 */
export function MarqueeSelectionArea({ children }: { children: React.ReactNode }) {
  // State, not a ref: the hook attaches its mouse listeners to whatever
  // `eventsElement` is at render time, so it has to see the real node.
  const [areaEl, setAreaEl] = useState<HTMLDivElement | null>(null);
  // The element mouse events are bound to: the whole scroll region, so drags
  // starting in the gutters or between sections count. The box itself is still
  // drawn inside (and positioned against) areaEl.
  const [eventsEl, setEventsEl] = useState<HTMLElement | null>(null);
  const selectedIds = useSelectedIds();
  const { replace, clear, setAnchor } = useSelectionActions();

  useEffect(() => {
    setEventsEl(scrollParentOf(areaEl));
  }, [areaEl]);

  const rectsRef = useRef<CardRect[]>([]);
  // What was already selected when an additive (modifier-held) drag started.
  const baselineRef = useRef<string[]>([]);
  // Mirror of the selection for use inside the hook's callbacks. Assigned in an
  // effect rather than during render, matching GalleryDndProvider: a render
  // React discards must not leave this holding an uncommitted value.
  const selectedRef = useRef(selectedIds);
  useEffect(() => {
    selectedRef.current = selectedIds;
  }, [selectedIds]);
  // Set when a mousedown lands on the scroll container's scrollbar, so the
  // library's own mousedown handler (which only sees the target) can bail.
  const onScrollbarRef = useRef(false);
  // Set once a card drag actually activates (200ms hold), so the marquee that
  // may have started on the same mousedown stops updating the selection.
  const cardDragActiveRef = useRef(false);
  // Live pointer position + gesture state, for the edge auto-scroll loop below.
  const pointerRef = useRef({ x: 0, y: 0 });
  const marqueeActiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Auto-scrolls the scroll container while a marquee is dragged past an edge.
  // dnd-kit does this for card drags; the selection library doesn't do it at
  // all, so without this the box stops dead at the edge of the viewport.
  const runEdgeScroll = useCallback(() => {
    rafRef.current = null;
    const el = eventsEl;
    if (!el || !marqueeActiveRef.current || cardDragActiveRef.current) return;

    const rect = el.getBoundingClientRect();
    const delta = edgeScrollDelta(pointerRef.current.y, { top: rect.top, bottom: rect.bottom });
    if (delta !== 0) {
      const before = el.scrollTop;
      el.scrollTop += delta;
      if (el.scrollTop !== before) {
        // Scrolling to the bottom trips infinite scroll, so cards can appear
        // mid-gesture — and only a scroll can cause that, which is why this
        // check lives here rather than running every frame. Rects are
        // container-relative and appended rows don't move existing ones, so a
        // re-snapshot only adds entries.
        if (
          areaEl &&
          areaEl.querySelectorAll(`[${SELECTABLE_ID_ATTR}]`).length !== rectsRef.current.length
        ) {
          rectsRef.current = snapshotCards(areaEl);
        }
        // The library only recomputes the box on mousemove. While the pointer
        // parks at the edge there are no real moves, so replay one: the stored
        // start point is container-relative, so the recomputed box (and the
        // selection) grows to cover whatever scrolled into view.
        el.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: pointerRef.current.x,
            clientY: pointerRef.current.y,
            bubbles: true,
            // Must claim a held button: the real mousemove handler below treats
            // `buttons === 0` as "the mouseup went missing" and stops the loop.
            buttons: 1,
          })
        );
      }
    }
    rafRef.current = requestAnimationFrame(runEdgeScroll);
  }, [eventsEl, areaEl]);

  const startEdgeScroll = useCallback(() => {
    marqueeActiveRef.current = true;
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(runEdgeScroll);
  }, [runEdgeScroll]);

  const stopEdgeScroll = useCallback(() => {
    marqueeActiveRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Cleanup for unmounting mid-gesture: onSelectionEnd covers the normal
  // mouseup. The library sets user-select:none on <body> at mousedown and only
  // clears it in its own mouseup handler, so unmounting mid-drag would leave the
  // whole document unselectable — undo it here too.
  useEffect(
    () => () => {
      stopEdgeScroll();
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("-webkit-user-select");
    },
    [stopEdgeScroll]
  );

  const { DragSelection, cancelCurrentSelection } = useSelectionContainer<HTMLElement>({
    eventsElement: eventsEl,
    // Must stay ref-based / pure. The library captures shouldStartSelecting in
    // a useCallback that omits it from the deps, so a closure over state would
    // silently freeze at its first-render value — with no error to notice.
    shouldStartSelecting: (target) => !onScrollbarRef.current && !isInteractiveTarget(target),
    onSelectionStart: (event) => {
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      baselineRef.current = additive ? Array.from(selectedRef.current) : [];
      rectsRef.current = snapshotCards(areaEl);
      // A marquee defines its own anchor (set to the first card it hits, just
      // below); keeping the old one would make the next shift-click extend
      // from a card the user selected two gestures ago.
      if (!additive) setAnchor(null);
      startEdgeScroll();
    },
    onSelectionEnd: stopEdgeScroll,
    onSelectionChange: (box) => {
      // The cardDragActive check isn't just belt-and-braces: the library
      // schedules onSelectionChange and its own box redraw on two separate
      // rAFs, so a frame queued before cancelCurrentSelection() still lands
      // afterwards and would clobber the selection as a card drag begins.
      if (cardDragActiveRef.current || !areaEl) return;
      const hits = idsIntersecting(
        toContentBox(box, areaEl.getBoundingClientRect()),
        rectsRef.current
      );
      if (hits.length > 0) setAnchor(hits[0]);
      replace(unionIds(baselineRef.current, hits));
    },
    selectionProps: {
      style: {
        border: "1px solid rgb(59 130 246)",
        background: "rgba(59, 130, 246, 0.15)",
        borderRadius: 4,
        position: "absolute",
        zIndex: 20,
      },
    },
  });

  // A hold on a card wins over the marquee: dnd-kit's sensor fires onDragStart
  // at 200ms, at which point any box drawn from the same mousedown is dropped
  // and the selection is left alone.
  useDndMonitor({
    onDragStart: ({ active }) => {
      cardDragActiveRef.current = true;
      cancelCurrentSelection();
      // dnd-kit owns auto-scroll from here.
      stopEdgeScroll();
      // Marks a multi-asset drag so the cards left behind in the grid fade out
      // (globals.css). Set imperatively — this is presentation only, and a
      // state update here would re-render every card mid-gesture.
      // Counts `[data-selected]` nodes rather than the raw selection, which can
      // also hold boards: those don't travel with an asset drag, so a board plus
      // one asset is a single-card drag and shouldn't fade anything.
      const travelling = areaEl?.querySelectorAll("[data-selected]").length ?? 0;
      if (travelling > 1 && selectedRef.current.has(String(active.id))) {
        areaEl?.setAttribute("data-multi-drag", "");
      }
    },
    onDragEnd: () => {
      cardDragActiveRef.current = false;
      areaEl?.removeAttribute("data-multi-drag");
    },
    onDragCancel: () => {
      cardDragActiveRef.current = false;
      areaEl?.removeAttribute("data-multi-drag");
    },
  });

  // A mousedown on empty space that never becomes a drag still means
  // "deselect" — the hook's own callbacks only fire once the box passes its
  // area threshold, so this can't be folded into onSelectionStart. Bound to
  // the same element as the marquee (not the wrapper div) so clicking the
  // gutters clears too, and in the capture phase so the scrollbar flag is set
  // before the library's own handler runs. Cards are excluded: their own click
  // handler owns select/toggle/extend.
  useEffect(() => {
    if (!eventsEl) return;
    const onMouseDown = (event: MouseEvent) => {
      onScrollbarRef.current = isScrollbarEvent(event);
      if (onScrollbarRef.current || event.button !== 0) return;
      if (event.shiftKey || event.metaKey || event.ctrlKey) return;
      if (isInteractiveTarget(event.target) || isCardTarget(event.target)) return;
      clear();
    };
    // Pointer position feeds the edge auto-scroll loop, which needs a position
    // even on frames where the pointer isn't moving. On window, not eventsEl,
    // so a drag that wanders outside the scroll region still reports.
    const onMouseMove = (event: MouseEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      // The library's mouseup is on window, so releasing the button outside the
      // browser window never reaches it and the gesture stays "active". Without
      // this the scroll loop would keep running with no button held.
      if (event.buttons === 0) stopEdgeScroll();
    };

    eventsEl.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("blur", stopEdgeScroll);
    return () => {
      eventsEl.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("blur", stopEdgeScroll);
    };
  }, [eventsEl, clear, stopEdgeScroll]);

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // An open CardMenu consumes Escape before this listener (it stops
      // propagation on document), so dismissing a menu no longer wipes the
      // selection. The DOM check is a backstop for any other menu-ish layer
      // that doesn't stop propagation.
      if (document.querySelector('[role="menu"]')) return;
      clear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds.size, clear]);

  // Debounced count, announced from here rather than from a grid: this element
  // is always mounted, so a boards-only selection (or one made while the assets
  // section is collapsed) is still announced. Deliberately kind-agnostic —
  // the selection can hold both boards and assets.
  const [announcedCount, setAnnouncedCount] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncedCount(selectedIds.size), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [selectedIds]);

  return (
    // `relative` so the library's absolutely-positioned selection box is
    // placed against this element — it's also the origin both the box and the
    // cached card rects are measured in (see toContentBox).
    // `data-marquee-area` isn't styled — it's the handle browser-level tests
    // use to find this region without depending on class names.
    <div ref={setAreaEl} data-marquee-area="" className="relative">
      {DragSelection()}
      {children}
      <p role="status" aria-live="polite" className="sr-only">
        {announcedCount > 0 ? `${announcedCount} selected` : ""}
      </p>
    </div>
  );
}
