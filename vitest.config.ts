import { defineConfig } from "vitest/config";

// Node environment only — this suite covers pure state-transition logic
// (src/lib/galleryDragEnd.ts), not rendered components, so no DOM/jsdom is
// needed. See the scope note at the top of galleryDragEnd.test.ts for why
// pointer-drag simulation isn't covered here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
