import { CardGrid } from "./CardGrid";

function SkeletonCard() {
  return (
    <li className="aspect-square list-none animate-pulse rounded-2xl bg-gray-200" />
  );
}

// Visually-hidden but still announced to screen readers via role="status".
function StatusAnnouncement({ label }: { label: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      Loading {label}…
    </p>
  );
}

export function BoardsSkeleton() {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Boards</h2>
      <StatusAnnouncement label="boards" />
      <CardGrid aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </CardGrid>
    </section>
  );
}

export function AssetsSkeleton() {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">Assets</h2>
      <StatusAnnouncement label="assets" />
      <CardGrid aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </CardGrid>
    </section>
  );
}
