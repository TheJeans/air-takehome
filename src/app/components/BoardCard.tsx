import { forwardRef, useRef, type ComponentPropsWithoutRef } from "react";
import type { Board } from "../../lib/boards";
import { FadeInImage } from "./FadeInImage";
import { PlaceholderIcon } from "./PlaceholderIcon";
import { CardMenu, type CardMenuHandle } from "./CardMenu";
import { SelectedAnnouncement, SelectionOverlay, THUMBNAIL_SIZES } from "./cardChrome";

interface BoardCardProps extends ComponentPropsWithoutRef<"li"> {
  board: Board;
  priority?: boolean;
  /** Assets moved here via drag-and-drop this session (client-state only). */
  assetCount?: number;
  /** True while a dragged asset is hovering this board as a drop target. */
  isOver?: boolean;
  /** Part of the current marquee/click selection (see SelectionProvider). */
  selected?: boolean;
}

// `role` comes after `{...rest}`. dnd-kit's attributes include role="button",
// which would otherwise override our role="listitem".
export const BoardCard = forwardRef<HTMLLIElement, BoardCardProps>(
  function BoardCard(
    {
      board,
      priority = false,
      assetCount = 0,
      isOver = false,
      selected = false,
      className,
      ...rest
    },
    ref
  ) {
    const thumbnail = board.thumbnails?.[0];
    const title = board.title || "Untitled board";
    const menuRef = useRef<CardMenuHandle>(null);

    return (
      <li
        ref={ref}
        {...rest}
        role="listitem"
        onContextMenu={(event) => {
          event.preventDefault();
          menuRef.current?.open();
        }}
        className={`group relative aspect-[4/3] list-none overflow-hidden rounded-2xl bg-gray-200 ${
          isOver ? "ring-4 ring-blue-500" : ""
        } ${className ?? ""}`}
      >
        {/* No `data-selected` here, unlike AssetCard: that attribute drives the
            [data-multi-drag] fade in globals.css, and boards never travel with
            an asset drag — a selected board should stay put and fully opaque. */}
        {selected && <SelectedAnnouncement />}
        {thumbnail ? (
          <FadeInImage
            src={thumbnail}
            alt=""
            fill
            sizes={THUMBNAIL_SIZES}
            className="object-cover"
            priority={priority}
            loading={priority ? undefined : "eager"}
          />
        ) : (
          <PlaceholderIcon />
        )}
        {assetCount > 0 && (
          <div
            className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/80 px-1.5 text-xs font-medium text-white"
            aria-label={`${assetCount} asset${assetCount === 1 ? "" : "s"} added to this board`}
          >
            {assetCount}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex h-16 flex-col justify-end bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5">
          <p className="truncate text-lg font-semibold text-white px-2 pb-1">{title}</p>
        </div>
        {selected && <SelectionOverlay />}
        <CardMenu ref={menuRef} label={title} downloadUrl={thumbnail ?? undefined} />
      </li>
    );
  }
);
