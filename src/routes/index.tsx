import { createFileRoute } from "@tanstack/react-router";
import { GameBoard } from "@/components/game/GameBoard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sephora Collection — It's a Stretch Memory Game" },
      {
        name: "description",
        content:
          "Touchscreen activation: trouvez un maximum de paires de produits Sephora Collection avant la fin du chrono !",
      },
      { property: "og:title", content: "Sephora Collection — Memory Game" },
      {
        property: "og:description",
        content:
          "Plateau 8×8 — 32 paires à retrouver — 6 niveaux de score à débloquer.",
      },
    ],
  }),
  component: GameBoard,
});
