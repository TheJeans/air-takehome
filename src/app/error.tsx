"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <p role="alert" className="mb-2 text-sm text-red-600">
        Something went wrong loading the gallery.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded border px-3 py-1 text-sm"
      >
        Retry
      </button>
    </main>
  );
}
