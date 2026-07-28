// Bits shared by AssetCard and BoardCard, which are otherwise deliberately
// separate presentational components. Kept here so a visual tweak to the
// selection treatment (or the thumbnail sizes) lands in one place.

/** Matches the grid's 2 / 4 / 6 column breakpoints in CardGrid. */
export const THUMBNAIL_SIZES = "(min-width: 768px) 16vw, (min-width: 640px) 25vw, 50vw";

/**
 * Selection treatment for a card. An overlay rather than a ring on the <li>:
 * the fill image paints over the card's own box, so an inset ring would be
 * hidden underneath it. pointer-events-none keeps it out of the drag/click path.
 */
export function SelectionOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-2xl border-[3px] border-blue-500 bg-blue-500/10"
    />
  );
}

/** Paired with SelectionOverlay, which is aria-hidden. */
export function SelectedAnnouncement() {
  return <span className="sr-only">Selected. </span>;
}
