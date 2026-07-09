import mascaraAsset from "@/assets/sephora-mascara.png.asset.json";
import sephoraCircularAsset from "@/assets/sephora-circular.png.asset.json";
import sephoraDeliStackedAsset from "@/assets/sephora-deli-stacked.gif.asset.json";
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
  const isLight = /^#?(f{3,6}|fff|ffffff)$/i.test(color.replace("#", "")) || color === "white";
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
        filter: isLight ? "invert(1) hue-rotate(180deg)" : "none",
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
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden leading-none">
      {/* signature stripes (≥4) bleeding across the token */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 6px, transparent 6px 14px)",
        }}
      />
      <StripesMark className="relative mb-1.5 h-[10px] w-[22px]" color="#ffffff" />
      <span
        className="wordmark relative text-[10px] text-white"
        style={{ letterSpacing: "0.22em" }}
      >
        SEPHORA
      </span>
      <span
        className="relative mt-[2px] text-[6px] font-semibold text-white/80"
        style={{ letterSpacing: "0.36em" }}
      >
        COLLECTION
      </span>
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
      className={`relative inline-block select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="Sephora Collection Deli"
    >
      <img
        src={sephoraDeliStackedAsset.url}
        alt="Sephora Collection Deli"
        width={size}
        height={size}
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

