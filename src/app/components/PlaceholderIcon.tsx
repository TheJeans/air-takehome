// Shown in place of a thumbnail when a board/asset has none (or it failed to load).
export function PlaceholderIcon() {
  return (
    <div className="flex h-full w-full items-center justify-center text-gray-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-8 w-8"
        aria-hidden="true"
      >
        <path d="M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4Zm0 2h16v10H4V7Zm3 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-1 8 3.5-4.5 2.5 3 3.5-4.5L20 17H6Z" />
      </svg>
    </div>
  );
}
