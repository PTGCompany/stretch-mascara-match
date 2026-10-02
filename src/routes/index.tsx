import { createFileRoute } from "@tanstack/react-router";
import { GameBoard } from "@/components/game/GameBoard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sephora Collection — It's a Stretch Memory Game" },
      {
        name: "description",
        content:
          "Touchscreen activation: find as many Sephora Collection product pairs as possible before time runs out!",
      },
      { property: "og:title", content: "Sephora Collection — Memory Game" },
      {
        property: "og:description",
        content:
          "4×5 board — 10 pairs to find — 5 reward tiers to unlock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GameBoard,
});
