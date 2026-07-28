import { fetchAssets } from "../../lib/clips";
import { UnsortedAssetsGrid } from "./UnsortedAssetsGrid";
import { CollapsibleSection } from "./CollapsibleSection";

export async function AssetsSection() {
  let clips;
  let pagination;
  let total;
  try {
    const response = await fetchAssets({ cursor: null });
    clips = response.data.clips;
    total = response.data.total;
    pagination = response.pagination;
  } catch {
    return (
      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Assets</h2>
        <p role="alert" className="text-sm text-red-600">
          Couldn&apos;t load assets.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      {/* Selection state and the marquee live at the page level (page.tsx) so
          one drag can span boards and assets alike. */}
      <CollapsibleSection label={`${total} ASSETS`}>
        {clips.length === 0 ? (
          <p className="text-sm text-gray-500">No assets found.</p>
        ) : (
          <UnsortedAssetsGrid initialAssets={clips} initialPagination={pagination} />
        )}
      </CollapsibleSection>
    </section>
  );
}
