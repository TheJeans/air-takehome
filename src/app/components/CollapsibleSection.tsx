"use client";

import { useState, type ReactNode } from "react";

// Small chevron: points down when open, right when collapsed.
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3 w-3 shrink-0 transition-transform duration-150 ${
        open ? "" : "-rotate-90"
      }`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CollapsibleSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="mb-2 flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
      >
        {label}
        <ChevronIcon open={open} />
      </button>
      {open ? children : null}
    </>
  );
}
