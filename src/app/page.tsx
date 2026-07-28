import { Suspense } from "react";
import { BoardsSection } from "./components/BoardsSection";
import { AssetsSection } from "./components/AssetsSection";
import { BoardsSkeleton, AssetsSkeleton } from "./components/SectionFallback";
import { GalleryDndProvider } from "./components/GalleryDndProvider";
import { SelectionProvider } from "./components/SelectionProvider";
import { MarqueeSelectionArea } from "./components/MarqueeSelectionArea";

export default function Home() {
  return (
    <main>
      {/* Single DndContext + shared state, lifted above both sections so an
          asset can be dragged out of Unsorted and onto a board. Each section
          keeps its own Suspense boundary/skeleton — the provider itself
          doesn't depend on either fetch, so streaming is unaffected. */}
      {/* SelectionProvider sits above GalleryDndProvider so drag-end can read
          the selection and move every selected asset at once. The marquee area
          is inside the DndContext — it needs dnd-kit's drag events to know when
          a card drag should win over a selection box. */}
      <SelectionProvider>
        <GalleryDndProvider>
          <MarqueeSelectionArea>
            <Suspense fallback={<BoardsSkeleton />}>
              <BoardsSection />
            </Suspense>

            <Suspense fallback={<AssetsSkeleton />}>
              <AssetsSection />
            </Suspense>
          </MarqueeSelectionArea>
        </GalleryDndProvider>
      </SelectionProvider>
    </main>
  );
}
