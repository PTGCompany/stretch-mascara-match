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

export function HamburgerLogo() {
  return (
    <div className="flex items-baseline gap-2 select-none">
      <span className="wordmark text-[22px] leading-none text-black">
        SEPHORA
      </span>
    </div>
  );
}

export function SephoraToken() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center leading-none">
      <span
        className="wordmark text-[9px] text-white"
        style={{ letterSpacing: "0.28em" }}
      >
        SEPHORA
      </span>
      <span
        className="mt-[2px] text-[6px] font-semibold tracking-[0.4em] text-white/70"
      >
        COLLECTION
      </span>
    </div>
  );
}
