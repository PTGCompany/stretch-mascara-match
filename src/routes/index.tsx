import { createFileRoute } from "@tanstack/react-router";
import { GameBoard } from "@/components/game/GameBoard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sephora Collection — It's a Stretch Game" },
      {
        name: "description",
        content:
          "Touchscreen activation game: find the It's a Stretch mascaras hidden among Sephora Collection tokens.",
      },
      { property: "og:title", content: "Sephora Collection — Memory Game" },
      {
        property: "og:description",
        content: "Trouvez les 2 mascaras It's a Stretch en 3 essais !",
      },
    ],
  }),
  component: GameBoard,
});
