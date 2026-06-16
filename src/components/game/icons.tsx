export function MascaraIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 96" className={className} aria-hidden>
      <defs>
        <linearGradient id="tubeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1a1a" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
      </defs>
      {/* cap */}
      <rect x="22" y="4" width="20" height="26" rx="3" fill="#000" />
      <rect x="22" y="4" width="20" height="3" rx="1.5" fill="#e5097f" />
      {/* tube */}
      <rect x="17" y="30" width="30" height="60" rx="7" fill="url(#tubeGrad)" />
      <rect x="20" y="34" width="24" height="52" rx="4" fill="#0a0a0a" />
      <text
        x="32"
        y="60"
        textAnchor="middle"
        fill="#fff"
        fontSize="5.5"
        fontFamily="Archivo Black, Helvetica, sans-serif"
        letterSpacing="0.5"
      >
        IT&apos;S A
      </text>
      <text
        x="32"
        y="69"
        textAnchor="middle"
        fill="#e5097f"
        fontSize="5.5"
        fontFamily="Archivo Black, Helvetica, sans-serif"
        letterSpacing="0.5"
      >
        STRETCH
      </text>
    </svg>
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
