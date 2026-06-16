import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameConfig } from "@/lib/game-config";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export type TicketData = {
  code: string;
  issuedAt: number;
};

export function newTicket(): TicketData {
  return { code: makeCode(), issuedAt: Date.now() };
}

export function Ticket({
  data,
  config,
  onClose,
  onReplay,
}: {
  data: TicketData;
  config: GameConfig;
  onClose: () => void;
  onReplay: () => void;
}) {
  const issued = useMemo(
    () => new Date(data.issuedAt).toLocaleString("fr-FR"),
    [data.issuedAt],
  );

  // auto-trigger print dialog once
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* noop */
      }
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[2.5rem] bg-card/95 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <h2 className="text-2xl font-black leading-tight">
          BRAVO,{" "}
          <span style={{ color: "var(--sephora-pink)" }}>
            VOICI VOTRE TICKET !
          </span>
        </h2>

        {/* printable ticket */}
        <div
          id="sephora-ticket"
          className="w-full rounded-2xl border-2 border-dashed bg-white p-5 text-left text-black"
          style={{ borderColor: "var(--sephora-pink)" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black tracking-[0.3em]">
              SEPHORA
            </div>
            <div className="text-[10px] font-bold tracking-widest text-neutral-500">
              COLLECTION
            </div>
          </div>
          <div className="my-3 h-px bg-neutral-200" />
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">
            Ticket gagnant
          </div>
          <div className="mt-1 text-lg font-black uppercase leading-tight">
            {config.targetProductName}
          </div>
          <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">
              Code
            </div>
            <div
              className="font-mono text-3xl font-black tracking-[0.2em]"
              style={{ color: "var(--sephora-pink)" }}
            >
              {data.code}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
            <div>
              <div className="text-neutral-400">Émis le</div>
              <div className="font-bold text-black">{issued}</div>
            </div>
            <div className="text-right">
              <div className="text-neutral-400">À retirer</div>
              <div className="font-bold text-black">En boutique</div>
            </div>
          </div>
          <div className="mt-4 text-center text-[9px] uppercase tracking-widest text-neutral-400">
            Présentez ce ticket en caisse
          </div>
        </div>

        <div className="flex w-full gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-full px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition-transform active:scale-95"
            style={{ backgroundColor: "var(--sephora-pink)" }}
          >
            Imprimer
          </button>
          <button
            onClick={onReplay}
            className="flex-1 rounded-full border border-foreground/20 px-5 py-3 text-sm font-black uppercase tracking-widest transition-transform active:scale-95"
          >
            Rejouer
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] uppercase tracking-widest text-muted-foreground print:hidden"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
