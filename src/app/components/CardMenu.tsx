"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

// Small "..." icon, following the inline-SVG pattern used by PlaceholderIcon.
function EllipsisIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4"
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
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
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

  function handleDownload() {
    if (downloadUrl) {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = label;
      link.click();
    } else {
      console.log(`Download stub for "${label}"`);
    }
    setOpen(false);
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
        className={`flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-150 hover:bg-black/80 focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white group-hover:opacity-100 ${
          open ? "opacity-100" : ""
        }`}
      >
        <EllipsisIcon />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`${label} actions`}
          className="absolute right-0 top-8 min-w-36 rounded-2xl bg-white/95 py-1 text-sm shadow-2xl ring-1 ring-black/10"
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
        </div>
      )}
    </div>
  );
});
