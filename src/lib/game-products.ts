export type Product = {
  id: string;
  productId: string;
  productName: string;
  productCategory: string;
  emoji: string;
  isHeroProduct: boolean;
};

/**
 * 32 Sephora Collection products used to build the 32 memory pairs.
 * The hero product is "IT'S A STRETCH" mascara.
 * Emoji visuals act as premium placeholders until real product imagery is wired in.
 */
export const PRODUCTS: Product[] = [
  { id: "p01", productId: "p01", productName: "IT'S A STRETCH", productCategory: "MASCARA", emoji: "💄", isHeroProduct: true },
  { id: "p02", productId: "p02", productName: "BIG BY DEFINITION", productCategory: "MASCARA", emoji: "👁️", isHeroProduct: false },
  { id: "p03", productId: "p03", productName: "LIP STORIES", productCategory: "ROUGE À LÈVRES", emoji: "💋", isHeroProduct: false },
  { id: "p04", productId: "p04", productName: "CREAM LIP STAIN", productCategory: "ROUGE À LÈVRES", emoji: "👄", isHeroProduct: false },
  { id: "p05", productId: "p05", productName: "LIP GLOSS", productCategory: "GLOSS", emoji: "✨", isHeroProduct: false },
  { id: "p06", productId: "p06", productName: "BLUSH ME", productCategory: "BLUSH", emoji: "🌸", isHeroProduct: false },
  { id: "p07", productId: "p07", productName: "COLORFUL EYESHADOW", productCategory: "OMBRE À PAUPIÈRES", emoji: "🎨", isHeroProduct: false },
  { id: "p08", productId: "p08", productName: "SMOKY EYELINER", productCategory: "EYELINER", emoji: "🖤", isHeroProduct: false },
  { id: "p09", productId: "p09", productName: "BROW SHAPER", productCategory: "SOURCILS", emoji: "✏️", isHeroProduct: false },
  { id: "p10", productId: "p10", productName: "HIGHLIGHTER", productCategory: "TEINT", emoji: "💫", isHeroProduct: false },
  { id: "p11", productId: "p11", productName: "MATTE FOUNDATION", productCategory: "FOND DE TEINT", emoji: "🧴", isHeroProduct: false },
  { id: "p12", productId: "p12", productName: "BB CREAM", productCategory: "TEINT", emoji: "🫧", isHeroProduct: false },
  { id: "p13", productId: "p13", productName: "SETTING POWDER", productCategory: "POUDRE", emoji: "🌫️", isHeroProduct: false },
  { id: "p14", productId: "p14", productName: "BRONZER", productCategory: "TEINT", emoji: "🌞", isHeroProduct: false },
  { id: "p15", productId: "p15", productName: "CONTOUR STICK", productCategory: "TEINT", emoji: "🖌️", isHeroProduct: false },
  { id: "p16", productId: "p16", productName: "NAIL POLISH", productCategory: "VERNIS", emoji: "💅", isHeroProduct: false },
  { id: "p17", productId: "p17", productName: "MICELLAR WATER", productCategory: "SOIN", emoji: "💧", isHeroProduct: false },
  { id: "p18", productId: "p18", productName: "FACE MASK", productCategory: "SOIN", emoji: "🧖", isHeroProduct: false },
  { id: "p19", productId: "p19", productName: "EYE PATCH", productCategory: "SOIN", emoji: "👀", isHeroProduct: false },
  { id: "p20", productId: "p20", productName: "MOISTURIZER", productCategory: "SOIN", emoji: "🌿", isHeroProduct: false },
  { id: "p21", productId: "p21", productName: "PERFUME EAU", productCategory: "PARFUM", emoji: "🌹", isHeroProduct: false },
  { id: "p22", productId: "p22", productName: "BODY MIST", productCategory: "PARFUM", emoji: "🌺", isHeroProduct: false },
  { id: "p23", productId: "p23", productName: "BATH BOMB", productCategory: "BAIN", emoji: "🛁", isHeroProduct: false },
  { id: "p24", productId: "p24", productName: "BODY LOTION", productCategory: "CORPS", emoji: "🧴", isHeroProduct: false },
  { id: "p25", productId: "p25", productName: "HAIR SERUM", productCategory: "CHEVEUX", emoji: "💆", isHeroProduct: false },
  { id: "p26", productId: "p26", productName: "DRY SHAMPOO", productCategory: "CHEVEUX", emoji: "🌬️", isHeroProduct: false },
  { id: "p27", productId: "p27", productName: "MAKEUP BRUSH", productCategory: "ACCESSOIRES", emoji: "🖌️", isHeroProduct: false },
  { id: "p28", productId: "p28", productName: "BEAUTY SPONGE", productCategory: "ACCESSOIRES", emoji: "🥚", isHeroProduct: false },
  { id: "p29", productId: "p29", productName: "MIRROR COMPACT", productCategory: "ACCESSOIRES", emoji: "🪞", isHeroProduct: false },
  { id: "p30", productId: "p30", productName: "LASH CURLER", productCategory: "ACCESSOIRES", emoji: "🌀", isHeroProduct: false },
  { id: "p31", productId: "p31", productName: "GLOW DROPS", productCategory: "SOIN", emoji: "💎", isHeroProduct: false },
  { id: "p32", productId: "p32", productName: "VELVET LIPSTICK", productCategory: "ROUGE À LÈVRES", emoji: "🍒", isHeroProduct: false },
];

export type BoardCard = {
  id: number; // grid index 0..63
  productId: string;
  productName: string;
  productCategory: string;
  emoji: string;
  isHeroProduct: boolean;
};

/** Build a shuffled 64-card board from 32 product pairs. */
export function buildBoard(totalPairs: number): BoardCard[] {
  const pool = PRODUCTS.slice(0, totalPairs);
  const cards: Omit<BoardCard, "id">[] = [];
  for (const p of pool) {
    for (let i = 0; i < 2; i++) {
      cards.push({
        productId: p.productId,
        productName: p.productName,
        productCategory: p.productCategory,
        emoji: p.emoji,
        isHeroProduct: p.isHeroProduct,
      });
    }
  }
  // Fisher–Yates shuffle.
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((c, idx) => ({ ...c, id: idx }));
}
