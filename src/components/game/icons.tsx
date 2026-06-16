import { Menu } from "lucide-react";

export function MascaraIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 96" className={className} aria-hidden>
      {/* cap */}
      <rect x="22" y="4" width="20" height="28" rx="3" fill="#0a0a0a" />
      <rect x="22" y="4" width="20" height="4" rx="2" fill="#e6005a" />
      {/* tube */}
      <rect x="18" y="32" width="28" height="56" rx="6" fill="#111" />
      <rect x="22" y="38" width="20" height="44" rx="3" fill="#1c1c1c" />
      <text
        x="32"
        y="62"
        textAnchor="middle"
        fill="#fff"
        fontSize="6"
        fontFamily="Helvetica, Arial, sans-serif"
        fontWeight="700"
      >
        IT'S A
      </text>
      <text
        x="32"
        y="70"
        textAnchor="middle"
        fill="#e6005a"
        fontSize="6"
        fontFamily="Helvetica, Arial, sans-serif"
        fontWeight="700"
      >
        STRETCH
      </text>
    </svg>
  );
}

export function HamburgerLogo() {
  return (
    <div className="flex items-center gap-2">
      <Menu className="h-5 w-5" strokeWidth={3} />
      <span className="text-lg font-black tracking-[0.15em]">SEPHORA</span>
    </div>
  );
}
