import { Suspense } from "react";
import { BoardsSection } from "./components/BoardsSection";
import { AssetsSection } from "./components/AssetsSection";
import { BoardsSkeleton, AssetsSkeleton } from "./components/SectionFallback";

export default function Home() {
  return (
    <main>
      <Suspense fallback={<BoardsSkeleton />}>
        <BoardsSection />
      </Suspense>

      <Suspense fallback={<AssetsSkeleton />}>
        <AssetsSection />
      </Suspense>
    </main>
  );
}
