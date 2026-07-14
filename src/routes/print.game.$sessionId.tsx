import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  findSession,
  loadConfig,
  updateSessionPrintStatus,
  type GameConfig,
  type GameSession,
} from "@/lib/game-config";
import ticketLogoAsset from "@/assets/sephora-deli-ticket.png.asset.json";

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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const builtOnceRef = useRef(false);

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
    return { pdf, imgData };
  };

  const generateAndEmbed = async () => {
    if (!session || building) return;
    setBuilding(true);
    setBuildError(null);
    try {
      const built = await buildPdf();
      if (!built) return;
      const { pdf, imgData } = built;
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPreviewImg(imgData);
      updateSessionPrintStatus(session.id, "PRINTED");
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Failed to build PDF");
      updateSessionPrintStatus(session.id, "FAILED");
    } finally {
      setBuilding(false);
    }
  };

  // Auto-generate the PDF once the ticket DOM is ready.
  useEffect(() => {
    if (!ready || !session || !config) return;
    if (builtOnceRef.current) return;
    const noReward = session.pairsFound <= 0;
    if (noReward && !config.printNoRewardTicketEnabled) return;
    builtOnceRef.current = true;
    const t = window.setTimeout(() => {
      void generateAndEmbed();
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, config]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const printEmbedded = () => {
    const frame = iframeRef.current;
    if (frame && frame.contentWindow) {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      } catch {
        /* fall through */
      }
    }
    if (pdfUrl) window.open(pdfUrl, "_blank");
  };

  const doDownloadPdf = async () => {
    if (!session) return;
    try {
      const built = await buildPdf();
      if (!built) return;
      built.pdf.save(`sephora-ticket-${session.ticketCode}.pdf`);
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
        /* Hide the source ticket off-screen — it's only used to rasterize the PDF. */
        .ticket-source {
          position: absolute;
          left: -10000px;
          top: 0;
          width: 360px;
          background: #fff;
        }
        .ticket-source .ticket { border: 2px solid #000; padding: 18px; font-family: 'Jost', system-ui, -apple-system, Arial, sans-serif; }
        .ticket-source .brand { text-align: center; font-weight: 900; letter-spacing: .32em; font-size: 14px; }
        .ticket-source .brand img { display: block; margin: 0 auto 3px; height: auto; width: 38%; max-width: 120px; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
        .ticket-source .brand small { display: block; letter-spacing: .14em; font-weight: 700; margin-top: 4px; font-size: 9px; }
        .ticket-source .stripes { height: 10px; margin: 10px 0; background-image: repeating-linear-gradient(90deg,#000 0 6px,transparent 6px 12px); }
        .ticket-source .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #999; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
        .ticket-source .row .k { color: #555; font-weight: 700; }
        .ticket-source .row .v { font-weight: 900; }
        .ticket-source .tier { margin-top: 12px; padding: 12px; border: 2px solid #ed6f7e; text-align: center; }
        .ticket-source .tier .t { font-size: 11px; letter-spacing: .28em; font-weight: 900; color: #ed6f7e; text-transform: uppercase; }
        .ticket-source .tier .g { font-size: 14px; font-weight: 900; margin-top: 6px; text-transform: uppercase; letter-spacing: .16em; }
        .ticket-source .code { margin-top: 14px; text-align: center; font-family: 'Courier New', monospace; font-size: 18px; letter-spacing: .32em; font-weight: 900; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
        .ticket-source .foot-cta {
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
      `}</style>

      {/* Off-screen source used by html2canvas to build the PDF */}
      <div className="ticket-source" aria-hidden="true">
        <div className="ticket" data-testid="print-ticket-body">
          <div className="brand" data-testid="ticket-brand">
            {logoOk ? (
              <img
                src={ticketLogoAsset.url}
                alt={config.ticketBrandFallbackText}
                data-testid="ticket-brand-logo"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <span data-testid="ticket-brand-fallback">
                {config.ticketBrandFallbackText}
              </span>
            )}
            <small>MADE FRESH BY SEPHORA SINCE</small>
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
      </div>

      {/* Visible PDF viewer */}
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-sm font-bold uppercase tracking-[0.28em] text-black">
            Reward ticket · {session.ticketCode}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={printEmbedded}
              disabled={!pdfUrl}
              data-testid="print-ticket"
              className="rounded-none bg-black px-6 py-3 text-xs font-bold uppercase tracking-[0.28em] text-white disabled:opacity-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={doDownloadPdf}
              data-testid="download-pdf"
              className="rounded-none border-2 border-black bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.28em] text-black"
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="relative min-h-[70dvh] flex-1 border-2 border-black bg-neutral-100 overflow-auto">
          {previewImg ? (
            <div className="flex min-h-full items-center justify-center p-6">
              <img
                src={previewImg}
                alt="Reward ticket preview"
                data-testid="ticket-pdf-frame"
                className="max-h-[80dvh] w-auto max-w-full object-contain shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] bg-white"
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center text-xs uppercase tracking-[0.28em] text-neutral-600">
              {buildError ? (
                <div>
                  <p className="font-bold text-red-600">Failed to build PDF</p>
                  <p className="mt-2 normal-case tracking-normal text-neutral-700">{buildError}</p>
                </div>
              ) : (
                <p>{building ? "Generating ticket…" : "Preparing ticket…"}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
