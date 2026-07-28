import { forwardRef, useRef, type ComponentPropsWithoutRef } from "react";
import type { Clip } from "../../lib/clips";
import { FadeInImage } from "./FadeInImage";
import { PlaceholderIcon } from "./PlaceholderIcon";
import { CardMenu, type CardMenuHandle } from "./CardMenu";
import { SelectedAnnouncement, SelectionOverlay, THUMBNAIL_SIZES } from "./cardChrome";

// Returns null (hide the badge) rather than rendering garbage like "NaN:NaN"
// for a malformed/missing duration.
function formatDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface AssetCardProps extends ComponentPropsWithoutRef<"li"> {
  asset: Clip;
  priority?: boolean;
  /** True for the initial server-rendered page only — see UnsortedAssetsGrid. */
  eager?: boolean;
  /** Part of the current marquee/click selection (see SelectionProvider). */
  selected?: boolean;
}

// `role` comes after `{...rest}`. dnd-kit's attributes include role="button",
// which would otherwise override our role="listitem".
export const AssetCard = forwardRef<HTMLLIElement, AssetCardProps>(
  function AssetCard(
    { asset, priority = false, eager = false, selected = false, className, ...rest },
    ref
  ) {
    const title = asset.title ?? asset.importedName ?? "Untitled asset";
    const duration =
      asset.type === "video" && asset.duration != null
        ? formatDuration(asset.duration)
        : null;
    const menuRef = useRef<CardMenuHandle>(null);

    return (
      <li
        ref={ref}
        {...rest}
        role="listitem"
        // Attribute, not just a class: globals.css keys off it to fade the
        // other cards riding along in a multi-asset drag, which needs an
        // ancestor-state selector.
        data-selected={selected || undefined}
        onContextMenu={(event) => {
          event.preventDefault();
          menuRef.current?.open();
        }}
        className={`group relative aspect-[4/3] list-none overflow-hidden rounded-2xl bg-gray-200 ${className ?? ""}`}
      >
        {selected && <SelectedAnnouncement />}
        {asset.assets.image ? (
          // alt="" avoids a screen reader announcing it twice.
          <FadeInImage
            src={asset.assets.image}
            alt=""
            fill
            sizes={THUMBNAIL_SIZES}
            className="object-cover"
            priority={priority}
            // The first page (small, already in the initial payload) is
            // eager to avoid the empty/broken-placeholder flash on load.
            // Pages pulled in later via infinite scroll are real lazy-load
            // candidates — eagering those too would fire hundreds of
            // concurrent image requests as the list grows past 500 assets.
            loading={priority ? undefined : eager ? "eager" : "lazy"}
          />
        ) : (
          <PlaceholderIcon />
        )}
        {duration && (
          <div
            className="absolute bottom-2 right-2 rounded bg-black/80 px-1 text-xs text-white"
            aria-label={`Duration ${duration}`}
          >
            {duration}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex h-16 flex-col justify-end bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5">
          <p className="truncate text-md font-normal text-white px-2 pb-1">{title}</p>
        </div>
        {selected && <SelectionOverlay />}
        <CardMenu ref={menuRef} label={title} downloadUrl={asset.assets.image ?? undefined} />
      </li>
    );
  }
);
