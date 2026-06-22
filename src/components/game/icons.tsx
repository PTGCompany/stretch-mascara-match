import mascaraAsset from "@/assets/sephora-mascara.png.asset.json";

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
 * Sephora Collection logo — the brand-preferred 2-line lockup on dark backgrounds.
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
  return (
    <div className={`flex items-center gap-3 select-none ${className}`} style={{ color }}>
      <StripesMark className="shrink-0" color={color} style={{ width: size * 0.95, height: size * 0.7 }} />
      <div className="flex flex-col leading-none">
        <span
          className="wordmark"
          style={{ fontSize: size, lineHeight: 1, letterSpacing: "0.18em" }}
        >
          SEPHORA
        </span>
        <span
          className="wordmark"
          style={{ fontSize: size * 0.5, lineHeight: 1, marginTop: size * 0.18, letterSpacing: "0.32em" }}
        >
          COLLECTION
        </span>
      </div>
    </div>
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
 * Circular SEPHORA medallion — wordmark wraps a circle twice (outer + inner arc),
 * slowly rotating clockwise. Pure monochrome, brand-aligned.
 */
export function CircularSephoraMark({
  size = 220,
  color = "#ffffff",
  durationSec = 26,
  className = "",
}: {
  size?: number;
  color?: string;
  durationSec?: number;
  className?: string;
}) {
  const word = "SEPHORA   •   SEPHORA   •   ";
  return (
    <div
      className={`relative inline-block select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="Sephora"
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{
          display: "block",
          animation: `betc-spin ${durationSec}s linear infinite`,
          transformOrigin: "50% 50%",
        }}
      >
        <defs>
          <path
            id="betc-ring-outer"
            d="M 100,100 m -82,0 a 82,82 0 1,1 164,0 a 82,82 0 1,1 -164,0"
          />
          <path
            id="betc-ring-inner"
            d="M 100,100 m -60,0 a 60,60 0 1,1 120,0 a 60,60 0 1,1 -120,0"
          />
        </defs>
        <g
          fill={color}
          style={{
            fontFamily:
              '"Jost", "Futura", "Helvetica Neue", system-ui, sans-serif',
            fontWeight: 700,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
          }}
        >
          <text fontSize="20">
            <textPath href="#betc-ring-outer" startOffset="0">
              {word + word}
            </textPath>
          </text>
          <text fontSize="16">
            <textPath href="#betc-ring-inner" startOffset="50%">
              {word + word}
            </textPath>
          </text>
        </g>
      </svg>
      <style>{`
        @keyframes betc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
