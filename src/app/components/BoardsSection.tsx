import { fetchBoards } from "../../lib/boards";
import { SortableBoardsGrid } from "./SortableBoardsGrid";

export async function BoardsSection() {
  let boards;
  try {
    boards = (await fetchBoards()).data;
  } catch {
    return (
      <section>
        <h2 className="mb-2 text-lg font-semibold">Boards</h2>
        <p role="alert" className="text-sm text-red-600">
          Couldn&apos;t load boards.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Boards</h2>
      {boards.length === 0 ? (
        <p className="text-sm text-gray-500">No boards found.</p>
      ) : (
        <SortableBoardsGrid initialBoards={boards} />
      )}
    </section>
  );
}
