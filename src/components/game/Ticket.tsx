import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionButton, motionSpring } from "@/components/MotionButton";
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

function downloadTicketPng(data: TicketData, config: GameConfig, issued: string) {
  const dpr = 2;
  const W = 720;
  const H = 1040;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#ed6f7e";
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.setLineDash([]);

  ctx.fillStyle = "#000";
  ctx.font = "900 28px Helvetica, Arial, sans-serif";
  ctx.fillText("SEPHORA", 64, 96);
  ctx.fillStyle = "#888";
  ctx.font = "700 16px Helvetica, Arial, sans-serif";
  ctx.fillText("COLLECTION", W - 64 - ctx.measureText("COLLECTION").width, 96);

  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 124);
  ctx.lineTo(W - 64, 124);
  ctx.stroke();

  ctx.fillStyle = "#999";
  ctx.font = "700 14px Helvetica, Arial, sans-serif";
  ctx.fillText("TICKET GAGNANT", 64, 168);

  ctx.fillStyle = "#000";
  ctx.font = "900 30px Helvetica, Arial, sans-serif";
  const product = (config.targetProductName || "").toUpperCase();
  const maxWidth = W - 128;
  const words = product.split(" ");
  let line = "";
  let y = 210;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, 64, y);
      line = w;
      y += 36;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, 64, y);
    y += 36;
  }

  const boxY = y + 32;
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(64, boxY, W - 128, 180);
  ctx.fillStyle = "#999";
  ctx.font = "700 14px Helvetica, Arial, sans-serif";
  ctx.fillText("CODE", 64 + 24, boxY + 38);
  ctx.fillStyle = "#ed6f7e";
  ctx.font = "900 56px 'Courier New', monospace";
  const codeW = ctx.measureText(data.code).width;
  ctx.fillText(data.code, (W - codeW) / 2, boxY + 120);

  const metaY = boxY + 230;
  ctx.fillStyle = "#aaa";
  ctx.font = "700 12px Helvetica, Arial, sans-serif";
  ctx.fillText("ÉMIS LE", 64, metaY);
  ctx.fillText("À RETIRER", W - 64 - ctx.measureText("À RETIRER").width, metaY);
  ctx.fillStyle = "#000";
  ctx.font = "700 16px Helvetica, Arial, sans-serif";
  ctx.fillText(issued, 64, metaY + 24);
  const place = "En boutique";
  ctx.fillText(place, W - 64 - ctx.measureText(place).width, metaY + 24);

  ctx.fillStyle = "#999";
  ctx.font = "700 12px Helvetica, Arial, sans-serif";
  const footer = "PRÉSENTEZ CE TICKET EN CAISSE";
  ctx.fillText(footer, (W - ctx.measureText(footer).width) / 2, H - 72);

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `ticket-sephora-${data.code}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function Ticket({
  data,
  config,
  onClose,
  onReplay,
  onContinue,
  continueLabel,
  title,
}: {
  data: TicketData;
  config: GameConfig;
  onClose: () => void;
  onReplay: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  title?: string;
}) {
  const issued = useMemo(
    () => new Date(data.issuedAt).toLocaleString("fr-FR"),
    [data.issuedAt],
  );

  const spring = motionSpring;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/90 p-6 backdrop-blur-md"
      >
        <motion.span
          aria-hidden
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: [0, 1.6, 2.2], opacity: [0.7, 0.25, 0] }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute h-[320px] w-[320px] rounded-full"
          style={{ boxShadow: "0 0 0 6px #34d399", filter: "blur(2px)" }}
        />
        <motion.div
          initial={{ y: 14, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 0.04 }}
          className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center"
        >
          <motion.span
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.05 }}
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "#34d399", boxShadow: "0 0 0 6px rgba(52,211,153,0.25)" }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-3xl uppercase leading-tight text-white"
          >
            {title ?? "BRAVO,"}{" "}
            <span style={{ color: "var(--sephora-pink)" }}>
              VOICI VOTRE TICKET !
            </span>
          </motion.h2>

          <motion.div
            id="sephora-ticket"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.12 }}
            className="w-full rounded-2xl border-2 border-dashed bg-white p-5 text-left text-black"
            style={{ borderColor: "var(--sephora-pink)" }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black tracking-[0.3em]">SEPHORA</div>
              <div className="text-[10px] font-bold tracking-widest text-neutral-500">COLLECTION</div>
            </div>
            <div className="my-3 h-px bg-neutral-200" />
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">
              Ticket gagnant
            </div>
            <div className="mt-1 text-lg font-black uppercase leading-tight">
              {config.targetProductName}
            </div>
            <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">Code</div>
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
              Présentez ce ticket en caisse pour récupérer votre cadeau
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-wrap gap-2 print:hidden"
          >
            <MotionButton
              intent="primary"
              size="full"
              className="flex-1 font-black uppercase tracking-widest"
              style={{
                backgroundColor: "var(--sephora-pink)",
                color: "#000",
                boxShadow: "0 10px 24px -10px rgba(237,111,126,0.7)",
              }}
              onClick={() => downloadTicketPng(data, config, issued)}
            >
              Télécharger
            </MotionButton>
            <MotionButton
              intent="secondary"
              size="full"
              className="flex-1 font-black uppercase tracking-widest"
              onClick={() => window.print()}
            >
              Imprimer
            </MotionButton>
          </motion.div>

          <div className="flex w-full flex-wrap items-center justify-center gap-3 print:hidden">
            {onContinue ? (
              <MotionButton
                intent="primary"
                className="font-black uppercase tracking-widest"
                style={{ backgroundColor: "#fff", color: "#000" }}
                onClick={onContinue}
              >
                {continueLabel ?? "Continuer"}
              </MotionButton>
            ) : (
              <MotionButton
                intent="secondary"
                className="font-black uppercase tracking-widest"
                onClick={onReplay}
              >
                Rejouer
              </MotionButton>
            )}
            <MotionButton
              intent="link"
              size="sm"
              className="uppercase tracking-widest text-white/80"
              onClick={onClose}
            >
              Retour à l'accueil
            </MotionButton>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
