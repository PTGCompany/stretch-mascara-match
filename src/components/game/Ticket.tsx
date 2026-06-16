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

  const spring = { type: "spring" as const, stiffness: 420, damping: 26, mass: 0.7 };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 z-20 flex items-center justify-center rounded-[2.5rem] bg-card/95 p-6 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 14, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 0.04 }}
          className="flex w-full max-w-sm flex-col items-center gap-5 text-center"
        >
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl font-black leading-tight"
          >
            BRAVO,{" "}
            <span style={{ color: "var(--sephora-pink)" }}>
              VOICI VOTRE TICKET !
            </span>
          </motion.h2>

          {/* printable ticket */}
          <motion.div
            id="sephora-ticket"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.12 }}
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
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...spring, delay: 0.22 }}
                className="font-mono text-3xl font-black tracking-[0.2em]"
                style={{ color: "var(--sephora-pink)" }}
              >
                {data.code}
              </motion.div>
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full gap-2 print:hidden"
          >
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.94 }}
              transition={spring}
              onClick={() => window.print()}
              className="flex-1 rounded-full px-5 py-3 text-sm font-black uppercase tracking-widest text-white"
              style={{
                backgroundColor: "var(--sephora-pink)",
                boxShadow: "0 10px 24px -10px rgba(237,111,126,0.7)",
              }}
            >
              Imprimer
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.94 }}
              transition={spring}
              onClick={onReplay}
              className="flex-1 rounded-full border border-foreground/20 px-5 py-3 text-sm font-black uppercase tracking-widest"
            >
              Rejouer
            </motion.button>
          </motion.div>
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.92 }}
            transition={spring}
            onClick={onClose}
            className="text-[10px] uppercase tracking-widest text-muted-foreground print:hidden"
          >
            Fermer
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
