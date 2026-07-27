import { fetchAssets } from "../../lib/clips";
import { UnsortedAssetsGrid } from "./UnsortedAssetsGrid";

export async function AssetsSection() {
  let clips;
  try {
    clips = (await fetchAssets({ cursor: null })).data.clips;
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
      <h2 className="mb-2 text-lg font-semibold">Assets</h2>
      {clips.length === 0 ? (
        <p className="text-sm text-gray-500">No assets found.</p>
      ) : (
        <UnsortedAssetsGrid initialAssets={clips} />
      )}
    </section>
  );
}
