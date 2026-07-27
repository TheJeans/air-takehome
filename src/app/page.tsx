import { Suspense } from "react";
import { BoardsSection } from "./components/BoardsSection";
import { AssetsSection } from "./components/AssetsSection";
import { BoardsSkeleton, AssetsSkeleton } from "./components/SectionFallback";
import { GalleryDndProvider } from "./components/GalleryDndProvider";

export default function Home() {
  return (
    <main>
      {/* Single DndContext + shared state, lifted above both sections so an
          asset can be dragged out of Unsorted and onto a board. Each section
          keeps its own Suspense boundary/skeleton — the provider itself
          doesn't depend on either fetch, so streaming is unaffected. */}
      <GalleryDndProvider>
        <Suspense fallback={<BoardsSkeleton />}>
          <BoardsSection />
        </Suspense>

        <Suspense fallback={<AssetsSkeleton />}>
          <AssetsSection />
        </Suspense>
      </GalleryDndProvider>
    </main>
  );
}
