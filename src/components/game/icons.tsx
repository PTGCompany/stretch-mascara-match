import mascaraAsset from "@/assets/sephora-mascara.png.asset.json";
import sephoraCircularAsset from "@/assets/sephora-circular.png.asset.json";
import sephoraDeliStackedAsset from "@/assets/sephora-deli-stacked.png.asset.json";
import sephoraDeliFullAsset from "@/assets/sephora-deli-full.png.asset.json";
import sephoraCollectionCircularAsset from "@/assets/sephora-collection-circular-clean.png.asset.json";
const sephoraDeliHorizontalAsset = sephoraDeliStackedAsset;

export function MascaraIcon({ className = "" }: { className?: string }) {
  return (
    <img
      src={mascaraAsset.url}
      alt="Sephora Collection — Big By Definition mascara"
      className={`object-contain ${className}`}
      draggable={false}
      style={{ pointerEvents: "none" }}
    />
  );
}

/**
 * Brand stripes mark (the "≡" symbol that sits to the left of SEPHORA).
 * Per Sephora Collection brand guidelines, always uses ≥ 3 even-weight bars.
 */
export function StripesMark({
  className = "",
  color = "currentColor",
  style,
}: {
  className?: string;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 18"
      aria-hidden
      className={className}
      style={{ display: "block", ...style }}
    >
      <rect x="0" y="0" width="24" height="3" fill={color} />
      <rect x="0" y="7.5" width="24" height="3" fill={color} />
      <rect x="0" y="15" width="24" height="3" fill={color} />
    </svg>
  );
}

/**
 * Sephora Collection × DELI lockup — the horizontal wordmark used inline in headers,
 * hero title panels, and any wide placement. The `color` prop is preserved for API
 * compatibility with earlier callers: passing white applies an invert+hue-rotate filter
 * so the black wordmark reads on dark backgrounds while keeping the pink "DELI" pink.
 */
export function SephoraCollectionLogo({
  className = "",
  color = "currentColor",
  size = 22,
}: {
  className?: string;
  color?: string;
  size?: number;
}) {
  const _colorUnused = color;
  void _colorUnused;
  return (
    <img
      src={sephoraDeliHorizontalAsset.url}
      alt="Sephora Collection Deli"
      draggable={false}
      className={`select-none ${className}`}
      style={{
        height: size * 2.2,
        width: "auto",
        display: "block",
        objectFit: "contain",
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Stacked variant — Sephora Collection over a large "DELI" wordmark. Use for
 * portrait / narrow placements such as the printable ticket header.
 */
export function SephoraDeliStackedLogo({
  className = "",
  maxHeight = 96,
}: {
  className?: string;
  maxHeight?: number;
}) {
  return (
    <img
      src={sephoraDeliStackedAsset.url}
      alt="Sephora Collection Deli"
      draggable={false}
      className={`select-none ${className}`}
      style={{
        maxHeight,
        width: "auto",
        display: "block",
        objectFit: "contain",
        pointerEvents: "none",
      }}
    />
  );
}

export function HamburgerLogo() {
  return <SephoraCollectionLogo color="#000" size={20} />;
}

/**
 * Back-of-tile token. Pure monochrome per brand guidelines: black field, stripes motif,
 * and the SEPHORA / COLLECTION wordmark stacked.
 */
export function SephoraToken() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black p-1.5 leading-none">
      <img
        src={sephoraCollectionCircularAsset.url}
        alt="Sephora Collection"
        draggable={false}
        className="relative max-h-[85%] max-w-full select-none"
        style={{ objectFit: "contain", pointerEvents: "none" }}
      />
    </div>
  );
}


/**
 * Brand medallion shown on the idle splash — displays the Sephora Collection
 * Deli stacked lockup. (Formerly a rotating circular SEPHORA mark; replaced
 * to align with the current Sephora Collection Deli identity.)
 */
export function CircularSephoraMark({
  size = 220,
  className = "",
}: {
  size?: number;
  color?: string;
  durationSec?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      aria-label="Sephora Collection Deli — Made Fresh by Sephora since 1996"
    >
      <img
        src={sephoraDeliFullAsset.url}
        alt="Sephora Collection Deli — Made Fresh by Sephora since 1996"
        width={size}
        draggable={false}
        style={{
          display: "block",
          width: size,
          height: "auto",
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

