import { describe, expect, it } from "vitest";
import { mergeAssets, type AssetsSlice } from "./mergeAssets";
import type { Clip } from "./clips";

// Only the fields mergeAssets actually touches (id) matter for these tests;
// the rest of Clip is irrelevant plumbing, so it's cast rather than filled in.
function clip(id: string): Clip {
  return { id } as Clip;
}

function baseState(overrides: Partial<AssetsSlice> = {}): AssetsSlice {
  return {
    assetsById: { a1: clip("a1"), a2: clip("a2") },
    unsortedOrder: ["a1", "a2"],
    ...overrides,
  };
}

describe("mergeAssets", () => {
  it("appends a new page onto the existing order", () => {
    const state = baseState();
    const next = mergeAssets(state, [clip("a3"), clip("a4")]);
    expect(next.unsortedOrder).toEqual(["a1", "a2", "a3", "a4"]);
    expect(next.assetsById.a3).toEqual(clip("a3"));
    expect(next.assetsById.a4).toEqual(clip("a4"));
  });

  it("preserves existing entries by reference (no full replace)", () => {
    const state = baseState();
    const next = mergeAssets(state, [clip("a3")]);
    expect(next.assetsById.a1).toBe(state.assetsById.a1);
    expect(next.assetsById.a2).toBe(state.assetsById.a2);
  });

  it("is a no-op (same reference) when the page is empty", () => {
    const state = baseState();
    const next = mergeAssets(state, []);
    expect(next).toBe(state);
  });

  it("skips ids already present, without duplicating them in order", () => {
    const state = baseState();
    const next = mergeAssets(state, [clip("a2"), clip("a3")]);
    expect(next.unsortedOrder).toEqual(["a1", "a2", "a3"]);
  });

  it("is a no-op (same reference) when every id already exists", () => {
    const state = baseState();
    const next = mergeAssets(state, [clip("a1"), clip("a2")]);
    expect(next).toBe(state);
  });

  it("does not mutate the previous assetsById object", () => {
    const state = baseState();
    const prevById = state.assetsById;
    mergeAssets(state, [clip("a3")]);
    expect(state.assetsById).toBe(prevById);
    expect(Object.keys(prevById)).toEqual(["a1", "a2"]);
  });
});
