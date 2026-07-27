import Image from "next/image";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import type { Clip } from "../../lib/clips";
import { PlaceholderIcon } from "./PlaceholderIcon";

const THUMBNAIL_SIZES = "(min-width: 768px) 16vw, (min-width: 640px) 25vw, 50vw";

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
}

// forwardRef + spread `rest` so drag wrappers (SortableAssetCard) can attach
// dnd-kit's ref/listeners/style directly to this <li> instead of adding a
// wrapping element, which would break the ul > li list semantics. `role`
// is applied *after* `{...rest}` — dnd-kit's `attributes` include
// `role: "button"`, which would otherwise silently win and make every card
// announce as a button instead of a list item.
export const AssetCard = forwardRef<HTMLLIElement, AssetCardProps>(
  function AssetCard({ asset, priority = false, className, ...rest }, ref) {
    const title = asset.title ?? asset.importedName ?? "Untitled asset";
    const duration =
      asset.type === "video" && asset.duration != null
        ? formatDuration(asset.duration)
        : null;

    return (
      <li
        ref={ref}
        {...rest}
        role="listitem"
        className={`relative aspect-[4/3] list-none overflow-hidden rounded-2xl bg-gray-200 ${className ?? ""}`}
      >
        {asset.assets.image ? (
          // alt="" avoids a screen reader announcing it twice.
          <Image
            src={asset.assets.image}
            alt=""
            fill
            sizes={THUMBNAIL_SIZES}
            className="object-cover"
            priority={priority}
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
      </li>
    );
  }
);
