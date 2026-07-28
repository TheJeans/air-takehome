import { boxesIntersect, type Box } from "@air/react-drag-to-select";

export interface CardRect {
  id: string;
  rect: Box;
}

/**
 * Converts the box `onSelectionChange` hands back into container-relative
 * ("content") coordinates.
 *
 * The library tracks the gesture in container-relative space, then adds the
 * container's *current* viewport rect before calling `onSelectionChange` — so
 * the box arrives in viewport coordinates. Subtracting that same rect puts it
 * back in content space, which is what card rects are cached in: content
 * coordinates don't move when the user scrolls mid-drag, viewport ones do.
 */
export function toContentBox(box: Box, container: { left: number; top: number }): Box {
  return {
    left: box.left - container.left,
    top: box.top - container.top,
    width: box.width,
    height: box.height,
  };
}

/**
 * Ids of every card whose rect intersects the marquee box. Both sides must be
 * in the same frame — container-relative, see toContentBox.
 */
export function idsIntersecting(box: Box, cards: CardRect[]): string[] {
  const hits: string[] = [];
  for (const card of cards) {
    if (boxesIntersect(box, card.rect)) hits.push(card.id);
  }
  return hits;
}

/**
 * Baseline first, then new hits — the order anything reading the selection as a
 * list will see. (The shift-click anchor is set separately, from the first hit.)
 */
export function unionIds(baseline: string[], hits: string[]): string[] {
  const seen = new Set(baseline);
  const out = baseline.slice();
  for (const id of hits) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Set-equality check used to skip state updates while the marquee is moving —
 * onSelectionChange fires every animation frame, but the hit set only changes
 * when the box crosses a card edge. Without this, dragging a marquee across
 * the grid re-renders every card ~60x/sec.
 */
export function sameIds(current: Set<string>, next: string[]): boolean {
  if (current.size !== next.length) return false;
  for (const id of next) {
    if (!current.has(id)) return false;
  }
  return true;
}

interface EdgeScrollOptions {
  /** Distance from an edge, in px, where scrolling kicks in. */
  threshold?: number;
  /** Scroll step at full strength, in px per frame. */
  maxSpeed?: number;
}

/**
 * Pixels to scroll this frame while a marquee is being dragged near an edge:
 * negative up, positive down, 0 in the dead zone. dnd-kit auto-scrolls card
 * drags on its own, but @air/react-drag-to-select has no equivalent, so a
 * marquee would otherwise stop dead at the edge of the viewport.
 *
 * Speed ramps with proximity so a slow approach creeps and parking past the
 * edge runs at full tilt.
 */
export function edgeScrollDelta(
  pointerY: number,
  bounds: { top: number; bottom: number },
  { threshold = 60, maxSpeed = 18 }: EdgeScrollOptions = {}
): number {
  const fromBottom = bounds.bottom - pointerY;
  if (fromBottom < threshold) {
    const strength = Math.min(1, Math.max(0, (threshold - fromBottom) / threshold));
    return Math.round(strength * maxSpeed);
  }
  const fromTop = pointerY - bounds.top;
  if (fromTop < threshold) {
    const strength = Math.min(1, Math.max(0, (threshold - fromTop) / threshold));
    return -Math.round(strength * maxSpeed);
  }
  return 0;
}

/**
 * Inclusive slice of `order` between two ids (shift-click). Returns just
 * `target` if either id is missing — e.g. the anchor was filed onto a board
 * and is no longer in the Unsorted grid.
 */
export function rangeBetween(order: string[], anchor: string, target: string): string[] {
  const start = order.indexOf(anchor);
  const end = order.indexOf(target);
  if (start === -1 || end === -1) return [target];
  return start <= end ? order.slice(start, end + 1) : order.slice(end, start + 1);
}
