import { describe, expect, it } from "vitest";
import {
  edgeScrollDelta,
  idsIntersecting,
  rangeBetween,
  sameIds,
  toContentBox,
  unionIds,
  type CardRect,
} from "./marquee";

const card = (id: string, left: number, top: number): CardRect => ({
  id,
  rect: { left, top, width: 100, height: 80 },
});

describe("toContentBox", () => {
  it("subtracts the container origin", () => {
    expect(toContentBox({ left: 110, top: 220, width: 5, height: 6 }, { left: 100, top: 200 })).toEqual(
      { left: 10, top: 20, width: 5, height: 6 }
    );
  });

  it("is scroll-invariant: the same content box after the container scrolls up", () => {
    // Container scrolled 300px, so both the box's viewport top and the
    // container's own top shift by the same amount.
    const before = toContentBox({ left: 40, top: 500, width: 10, height: 10 }, { left: 24, top: 280 });
    const after = toContentBox({ left: 40, top: 200, width: 10, height: 10 }, { left: 24, top: -20 });
    expect(after).toEqual(before);
  });
});

describe("idsIntersecting", () => {
  const cards = [card("a", 0, 0), card("b", 200, 0), card("c", 0, 200)];

  it("returns cards the box overlaps", () => {
    const hits = idsIntersecting({ left: 50, top: 50, width: 200, height: 20 }, cards);
    expect(hits).toEqual(["a", "b"]);
  });

  it("returns nothing for a box in empty space", () => {
    expect(idsIntersecting({ left: 500, top: 500, width: 10, height: 10 }, cards)).toEqual([]);
  });
});

describe("unionIds", () => {
  it("keeps baseline order and appends new hits without duplicates", () => {
    expect(unionIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("sameIds", () => {
  it("ignores ordering", () => {
    expect(sameIds(new Set(["a", "b"]), ["b", "a"])).toBe(true);
  });

  it("detects size and membership changes", () => {
    expect(sameIds(new Set(["a"]), ["a", "b"])).toBe(false);
    expect(sameIds(new Set(["a", "b"]), ["a", "c"])).toBe(false);
  });
});

describe("edgeScrollDelta", () => {
  const bounds = { top: 100, bottom: 900 };

  it("is inert in the middle", () => {
    expect(edgeScrollDelta(500, bounds)).toBe(0);
  });

  it("scrolls down near the bottom edge, faster the closer it gets", () => {
    const near = edgeScrollDelta(860, bounds);
    const nearer = edgeScrollDelta(895, bounds);
    expect(near).toBeGreaterThan(0);
    expect(nearer).toBeGreaterThan(near);
  });

  it("scrolls up near the top edge", () => {
    expect(edgeScrollDelta(110, bounds)).toBeLessThan(0);
  });

  it("caps at maxSpeed past the edge", () => {
    expect(edgeScrollDelta(2000, bounds, { maxSpeed: 18 })).toBe(18);
    expect(edgeScrollDelta(-500, bounds, { maxSpeed: 18 })).toBe(-18);
  });

  it("honours a custom threshold", () => {
    expect(edgeScrollDelta(860, bounds, { threshold: 10 })).toBe(0);
    expect(edgeScrollDelta(860, bounds, { threshold: 100 })).toBeGreaterThan(0);
  });
});

describe("rangeBetween", () => {
  const order = ["a", "b", "c", "d"];

  it("is inclusive and direction-agnostic", () => {
    expect(rangeBetween(order, "b", "d")).toEqual(["b", "c", "d"]);
    expect(rangeBetween(order, "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("falls back to the clicked id when the anchor is gone", () => {
    // e.g. the anchor asset was filed onto a board mid-selection.
    expect(rangeBetween(order, "zz", "c")).toEqual(["c"]);
  });
});
