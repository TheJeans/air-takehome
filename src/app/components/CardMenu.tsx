"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// Small "..." icon, following the inline-SVG pattern used by PlaceholderIcon.
function EllipsisIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

interface CardMenuProps {
  /** Name used for stub actions (e.g. "Share a Link" placeholder text). */
  label: string;
  /** URL used by the "Download" stub, if available. */
  downloadUrl?: string;
}

// Imperative handle so the parent card's `onContextMenu` (on the whole
// <li>, not just this small corner button) can open the same menu.
export interface CardMenuHandle {
  open: () => void;
}

// Ellipsis trigger + small dropdown, shared by AssetCard and BoardCard.
// Opens via click on the trigger button OR a right-click (contextmenu)
// anywhere on the card - both paths render the exact same menu.
export const CardMenu = forwardRef<CardMenuHandle, CardMenuProps>(function CardMenu(
  { label, downloadUrl },
  ref
) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  // Positioned via the trigger's rect rather than CSS `absolute`, since the
  // menu is portaled out to <body> to escape the card's overflow-hidden
  // (which clips it — see the rounded thumbnail corners on AssetCard/BoardCard).
  useEffect(() => {
    if (!open) return;
    const button = containerRef.current?.querySelector("button");
    const rect = button?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX - 192 });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // The open menu owns this Escape. Without stopping it here, the
      // selection's own window-level Escape handler (MarqueeSelectionArea)
      // also fires and wipes the selection just for dismissing a menu.
      event.stopPropagation();
    }

    function handleScroll() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function handleShare() {
    const url = downloadUrl ?? window.location.href;
    navigator.clipboard?.writeText(url).catch(() => {
      // Clipboard access can fail (permissions, insecure context, etc.) -
      // this is a stub action, so just no-op.
    });
    setOpen(false);
  }

  async function handleDownload() {
    setOpen(false);
    if (!downloadUrl) {
      console.log(`Download stub for "${label}"`);
      return;
    }
    // `download` on an <a> is ignored for cross-origin URLs (the CDN serving
    // these thumbnails isn't same-origin), so the browser just navigates
    // there instead of saving the file. Fetching the bytes ourselves and
    // downloading a blob: URL works regardless of origin.
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = label;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // CORS or network failure - fall back to just opening it, same as before.
      window.open(downloadUrl, "_blank");
    }
  }

  return (
    // Stop pointerdown from bubbling to dnd-kit's drag listeners on the
    // card, so opening the menu never races the PointerSensor.
    <div
      ref={containerRef}
      className="absolute right-2 top-2 z-10"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-150 hover:bg-black/80 focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white group-hover:opacity-100 ${
          open ? "opacity-100" : ""
        }`}
      >
        <EllipsisIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`${label} actions`}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-50 w-48 overflow-hidden rounded-2xl bg-white/95 py-1 text-sm shadow-2xl ring-1 ring-black/10"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleShare}
              className="block w-full px-3 py-1.5 text-left text-gray-800 hover:bg-gray-100"
            >
              Share a Link
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleDownload}
              className="block w-full px-3 py-1.5 text-left text-gray-800 hover:bg-gray-100"
            >
              Download
            </button>
          </div>,
          document.body
        )}
    </div>
  );
});
