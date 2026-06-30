import allThatMatters from "@/assets/products/all-that-matters.jpg.asset.json";
import jellySoothe from "@/assets/products/jelly-soothe.jpg.asset.json";
import jellyGlow from "@/assets/products/jelly-glow.jpg.asset.json";
import mochiCleanser from "@/assets/products/mochi-cleanser.jpg.asset.json";
import clearPurify from "@/assets/products/clear-purify.jpg.asset.json";
import stretchMascara from "@/assets/products/stretch-mascara.jpg.asset.json";
import liftFirm from "@/assets/products/lift-firm.jpg.asset.json";
import bseMatte from "@/assets/products/bse-matte.jpg.asset.json";
import blushShimmer from "@/assets/products/blush-shimmer.jpg.asset.json";
import outrageousPlump from "@/assets/products/outrageous-plump.jpg.asset.json";

export type Product = {
  id: string;
  productId: string;
  productName: string;
  productCategory: string;
  imageUrl: string;
  isHeroProduct: boolean;
};

/**
 * Exactly 10 Sephora Collection products. Each becomes one pair on the board.
 */
export const PRODUCTS: Product[] = [
  { id: "p01", productId: "p01", productName: "IT'S A STRETCH", productCategory: "MASCARA", imageUrl: stretchMascara.url, isHeroProduct: true },
  { id: "p02", productId: "p02", productName: "OUTRAGEOUS PLUMP", productCategory: "LIPS", imageUrl: outrageousPlump.url, isHeroProduct: false },
  { id: "p03", productId: "p03", productName: "ALL THAT MATTE(R)S", productCategory: "EYE PALETTE", imageUrl: allThatMatters.url, isHeroProduct: false },
  { id: "p04", productId: "p04", productName: "BEST SKIN EVER MATTE", productCategory: "COMPLEXION", imageUrl: bseMatte.url, isHeroProduct: false },
  { id: "p05", productId: "p05", productName: "BRIGHTENING MOCHI CLEANSER", productCategory: "SKINCARE", imageUrl: mochiCleanser.url, isHeroProduct: false },
  { id: "p06", productId: "p06", productName: "LIFT & FIRM SERUM", productCategory: "SKINCARE", imageUrl: liftFirm.url, isHeroProduct: false },
  { id: "p07", productId: "p07", productName: "JELLY TONER PADS GLOW", productCategory: "SKINCARE", imageUrl: jellyGlow.url, isHeroProduct: false },
  { id: "p08", productId: "p08", productName: "CLEAR & PURIFY TONER", productCategory: "SKINCARE", imageUrl: clearPurify.url, isHeroProduct: false },
  { id: "p09", productId: "p09", productName: "JELLY TONER PADS SOOTHE", productCategory: "SKINCARE", imageUrl: jellySoothe.url, isHeroProduct: false },
  { id: "p10", productId: "p10", productName: "BLUSH SHIMMER", productCategory: "COMPLEXION", imageUrl: blushShimmer.url, isHeroProduct: false },
];

export type BoardCard = {
  id: number;
  productId: string;
  productName: string;
  productCategory: string;
  imageUrl: string;
  isHeroProduct: boolean;
};

/** Build a shuffled board with exactly two cards per product. */
export function buildBoard(totalPairs: number): BoardCard[] {
  const pool = PRODUCTS.slice(0, totalPairs);
  const cards: Omit<BoardCard, "id">[] = [];
  for (const p of pool) {
    for (let i = 0; i < 2; i++) {
      cards.push({
        productId: p.productId,
        productName: p.productName,
        productCategory: p.productCategory,
        imageUrl: p.imageUrl,
        isHeroProduct: p.isHeroProduct,
      });
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((c, idx) => ({ ...c, id: idx }));
}
