import Image from "next/image";
import type { Board } from "../../lib/boards";
import { PlaceholderIcon } from "./PlaceholderIcon";

const THUMBNAIL_SIZES = "(min-width: 768px) 16vw, (min-width: 640px) 25vw, 50vw";

export function BoardCard({
  board,
  priority = false,
}: {
  board: Board;
  priority?: boolean;
}) {
  const thumbnail = board.thumbnails?.[0];
  const title = board.title || "Untitled board";

  return (
    <li
      role="listitem"
      className="relative aspect-square list-none overflow-hidden rounded-2xl bg-gray-200"
    >
      {thumbnail ? (
        <Image
          src={thumbnail}
          alt=""
          fill
          sizes={THUMBNAIL_SIZES}
          className="object-cover"
          priority={priority}
        />
      ) : (
        <PlaceholderIcon />
      )}
      <div className="absolute inset-x-0 bottom-0 flex h-16 flex-col justify-end bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5">
        <p className="truncate text-lg font-semibold text-white px-2 pb-1">{title}</p>
      </div>
    </li>
  );
}
