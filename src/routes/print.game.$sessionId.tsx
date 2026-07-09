import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  findSession,
  loadConfig,
  updateSessionPrintStatus,
  type GameConfig,
  type GameSession,
} from "@/lib/game-config";

export const Route = createFileRoute("/print/game/$sessionId")({
  head: () => ({
    meta: [
      { title: "Print — Sephora Collection Reward Ticket" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintTicketPage,
});

function PrintTicketPage() {
  const { sessionId } = useParams({ from: "/print/game/$sessionId" });
  const [session, setSession] = useState<GameSession | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [logoOk, setLogoOk] = useState<boolean>(true);

  useEffect(() => {
    const s = findSession(sessionId);
    const c = loadConfig();
    setSession(s);
    setConfig(c);
    setLogoOk(Boolean(c.sephoraDeliLogoUrl));
    setReady(true);
  }, [sessionId]);

  const buildPdf = async () => {
    const node = document.querySelector<HTMLElement>('[data-testid="print-ticket-body"]');
    if (!node || !session) return null;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");
    const widthMm = 80;
    const heightMm = (canvas.height * widthMm) / canvas.width;
    const pdf = new jsPDF({
      unit: "mm",
      format: [widthMm, heightMm],
      orientation: "portrait",
    });
    pdf.addImage(imgData, "PNG", 0, 0, widthMm, heightMm);
    return pdf;
  };

  useEffect(() => {
    if (!ready || !session || !config) return;
    if (!config.autoPrintEnabled) return;
    const noReward = session.pairsFound <= 0;
    if (noReward && !config.printNoRewardTicketEnabled) return;
    const t = window.setTimeout(() => {
      void doPrint();
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, config]);

  const doPrint = async () => {
    if (!session) return;
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      // Open the PDF in a new tab so the browser's native PDF viewer
      // shows it with a built-in print button.
      const blobUrl = pdf.output("bloburl");
      const win = window.open(blobUrl, "_blank");
      if (!win) {
        // Popup blocked — fall back to same-tab navigation to the PDF.
        window.location.href = blobUrl.toString();
      } else {
        // Trigger print dialog once the PDF viewer has loaded.
        win.addEventListener("load", () => {
          try {
            win.focus();
            win.print();
          } catch {
            /* noop */
          }
        });
      }
      updateSessionPrintStatus(session.id, "PRINTED");
    } catch {
      updateSessionPrintStatus(session.id, "FAILED");
    }
  };

  const doDownloadPdf = async () => {
    if (!session) return;
    try {
      const pdf = await buildPdf();
      if (!pdf) return;
      pdf.save(`sephora-ticket-${session.ticketCode}.pdf`);
      updateSessionPrintStatus(session.id, "PRINTED");
    } catch {
      if (session) updateSessionPrintStatus(session.id, "FAILED");
    }
  };

  if (!ready) {
    return <div className="p-10 text-center text-black">Loading…</div>;
  }

  if (!session || !config) {
    return (
      <div className="p-10 text-center text-black">
        <h1 className="text-lg font-bold">Session not found</h1>
        <p className="mt-2 text-sm">Ticket {sessionId} is not available on this device.</p>
      </div>
    );
  }

  const noReward = session.pairsFound <= 0;
  const dateStr = new Date(session.createdAt).toLocaleString();
  const rewardLabel = noReward ? "NO REWARD" : session.rewardTierLabel ?? "REWARD";
  const rewardMessage = noReward
    ? "TRY AGAIN!"
    : session.rewardTierMessage ?? "";
  const rewardProduct = noReward
    ? "No reward"
    : session.rewardProductName ?? "Gift";

  

  return (
    <div className="min-h-dvh bg-white text-black">
      <style>{`
        @page { size: 80mm auto; margin: 6mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        .ticket-wrap { max-width: 360px; margin: 0 auto; padding: 20px; }
        .ticket { border: 2px solid #000; padding: 18px; font-family: 'Jost', system-ui, -apple-system, Arial, sans-serif; }
        .brand { text-align: center; font-weight: 900; letter-spacing: .32em; font-size: 14px; }
        .brand img { display: block; margin: 0 auto 4px; max-height: 44px; max-width: 80%; object-fit: contain; }
        .brand small { display: block; letter-spacing: .28em; font-weight: 700; margin-top: 4px; font-size: 10px; }
        .stripes { height: 10px; margin: 10px 0; background-image: repeating-linear-gradient(90deg,#000 0 6px,transparent 6px 12px); }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #999; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
        .row .k { color: #555; font-weight: 700; }
        .row .v { font-weight: 900; }
        .tier { margin-top: 12px; padding: 12px; border: 2px solid #ed6f7e; text-align: center; }
        .tier .t { font-size: 11px; letter-spacing: .28em; font-weight: 900; color: #ed6f7e; text-transform: uppercase; }
        .tier .g { font-size: 14px; font-weight: 900; margin-top: 6px; text-transform: uppercase; letter-spacing: .16em; }
        .code { margin-top: 14px; text-align: center; font-family: 'Courier New', monospace; font-size: 18px; letter-spacing: .32em; font-weight: 900; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
        .foot-cta {
          margin-top: 14px;
          text-align: center;
          font-family: Futura, "Futura PT", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 22px;
          line-height: 1.1;
          padding: 10px 6px;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          color: #000;
        }
        @media print { .foot-cta { font-size: 18px; } }
      `}</style>

      <div className="ticket-wrap">
        <div className="ticket" data-testid="print-ticket-body">
          <div className="brand" data-testid="ticket-brand">
            {logoOk && config.sephoraDeliLogoUrl ? (
              <img
                src={config.sephoraDeliLogoUrl}
                alt={config.ticketBrandFallbackText}
                data-testid="ticket-brand-logo"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <span data-testid="ticket-brand-fallback">
                {config.ticketBrandFallbackText}
              </span>
            )}
            <small>MEMORY GAME</small>
          </div>
          <div className="stripes" />
          <div style={{ textAlign: "center", fontSize: 11, letterSpacing: ".24em", fontWeight: 700, textTransform: "uppercase" }}>
            Reward Ticket
          </div>

          <div className="row"><span className="k">Date</span><span className="v">{dateStr}</span></div>
          <div className="row" data-testid="ticket-pairs">
            <span className="k">Pairs found</span>
            <span className="v">{session.pairsFound} / {session.totalPairs}</span>
          </div>
          <div className="row" data-testid="ticket-score">
            <span className="k">Score</span>
            <span className="v">{session.score} pts</span>
          </div>
          <div className="row" data-testid="ticket-reward">
            <span className="k">Reward</span>
            <span className="v">{rewardProduct}</span>
          </div>

          <div className="tier">
            <div className="t">{rewardMessage || rewardLabel}</div>
            {!noReward && session.finalWinLevel && (
              <div className="g">Tier {session.finalWinLevel} / 3</div>
            )}
          </div>

          <div className="code" data-testid="ticket-code">{session.ticketCode}</div>
          <div className="foot-cta" data-testid="ticket-footer">{config.ticketFooterText}</div>
          <div className="stripes" />
        </div>

        <div className="no-print mt-6 flex flex-col items-center gap-3">
          <p className="text-xs text-neutral-600">
            If the print window does not open, use the buttons below.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={doPrint}
              className="rounded-none bg-black px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-white"
            >
              Print
            </button>
            <button
              type="button"
              onClick={doDownloadPdf}
              data-testid="download-pdf"
              className="rounded-none border-2 border-black bg-white px-8 py-3 text-xs font-bold uppercase tracking-[0.28em] text-black"
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
