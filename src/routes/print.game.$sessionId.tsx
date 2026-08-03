import { createFileRoute, useParams, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  findSession,
  updateSessionPrintStatus,
  type GameConfig,
  type GameSession,
} from "@/lib/game-config";
import { resolveConfig, withLaunchSearch } from "@/lib/kiosk-launch";
import ticketLogoAsset from "@/assets/sephora-ticket-logo-new.png.asset.json";

export const Route = createFileRoute("/print/game/$sessionId")({
  head: () => ({
    meta: [
      { title: "Print — Sephora Collection Reward Ticket" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintTicketPage,
});

const AUTO_HOME_MS = 10_000; // Venue kiosk: return to idle after auto-print (intentional)

/**
 * Ticket print width in mm for PDF + @page.
 *
 * Physical roll is 80 mm; Star CUPS printable media is 72 mm (X72MM…).
 * Size the ticket to 72 mm — the unused ~4 mm each side on the roll is the
 * “page edge”. Do not draw a black border as a fake page frame. Do not set
 * this to 80 mm or CUPS will scale-to-fit and shrink the art.
 */
const TICKET_WIDTH_MM = 72;

/** html2canvas scale: aim near Star’s native 203 DPI across 72 mm (~576 px). */
const TICKET_CAPTURE_SCALE = 3;

/**
 * Local kiosk print agent (OptiPlex). Prefer POSTing the 72 mm ticket PDF
 * (correct physical size). PNG is a fallback the agent resizes to 72 mm @ 203 DPI.
 * Bound only on 127.0.0.1 — works for remote Lovable and local :3000 (same machine).
 * Do not change the port without updating ~/kiosk/bin/print-agent on the kiosk.
 * Do not POST a raw PNG and expect CUPS to invent mm geometry — that blew metres of paper.
 */
const PRINT_AGENT_URL = "http://127.0.0.1:3091/print";
/** Agent should ACK quickly; allow headroom for upload + queue. */
const PRINT_AGENT_TIMEOUT_MS = 15000;

type PrintTicketPayload = {
  pdfBlob?: Blob | null;
  pngDataUrl?: string | null;
};

/**
 * Only call site for printing a ticket (auto-print and the Print button).
 *
 * Kiosk path: POST ticket PDF (preferred) or PNG to the local CUPS agent —
 * no Chrome print dialog. Fallback window.print() only when the agent is
 * unreachable AND we are not in kiosk mode. Never open the print dialog on
 * the venue kiosk. Do not scatter extra window.print() calls on this page.
 */
async function printTicket(payload?: PrintTicketPayload | string | null): Promise<void> {
  const kiosk =
    typeof window !== "undefined" &&
    /(?:^|[?&])kiosk(?:=true|=1|=)?(?:&|$)/i.test(window.location.search);

  // Back-compat: older call sites passed a PNG data URL string.
  const opts: PrintTicketPayload =
    typeof payload === "string" || payload == null
      ? { pngDataUrl: payload ?? null }
      : payload;

  let body: Blob | null = opts.pdfBlob ?? null;
  let contentType = "application/pdf";

  if (!body && opts.pngDataUrl) {
    body = await (await fetch(opts.pngDataUrl)).blob();
    contentType = "image/png";
  }

  if (!body) {
    const node = document.querySelector<HTMLElement>('[data-testid="print-ticket-body"]');
    if (node) {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: TICKET_CAPTURE_SCALE,
        useCORS: true,
      });
      body = await (await fetch(canvas.toDataURL("image/png"))).blob();
      contentType = "image/png";
    }
  }

  if (!body) {
    if (!kiosk) window.print();
    return;
  }

  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), PRINT_AGENT_TIMEOUT_MS);
    const res = await fetch(PRINT_AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    if (res.ok) return;
    console.error("[printTicket] agent error", res.status, await res.text().catch(() => ""));
    if (!kiosk) window.print();
    return;
  } catch (e) {
    console.error("[printTicket] agent unreachable", e);
    if (!kiosk) window.print();
  }
}

function PrintTicketPage() {
  const { sessionId } = useParams({ from: "/print/game/$sessionId" });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const [session, setSession] = useState<GameSession | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [logoOk, setLogoOk] = useState<boolean>(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const builtOnceRef = useRef(false);
  const autoPrintedRef = useRef(false);
  const homeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const s = findSession(sessionId);
    const c = resolveConfig(searchStr);
    setSession(s);
    setConfig(c);
    setLogoOk(Boolean(c.sephoraDeliLogoUrl));
    setReady(true);
  }, [sessionId, searchStr]);

  const buildPdf = async () => {
    const node = document.querySelector<HTMLElement>('[data-testid="print-ticket-body"]');
    if (!node || !session) return null;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: TICKET_CAPTURE_SCALE,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");
    const widthMm = TICKET_WIDTH_MM;
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
      setPdfBlob(blob);
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

  // Kiosk / autoPrintEnabled (admin or ?kiosk=true): auto printTicket() once,
  // then home after AUTO_HOME_MS. Guests still see the on-screen preview.
  // Do not treat missing Print/Download UI as a bug.
  useEffect(() => {
    if (!config?.autoPrintEnabled) return;
    if (!previewImg && !buildError) return;

    const goHome = () => {
      window.location.assign(withLaunchSearch("/", searchStr));
    };

    let printT: number | undefined;
    if ((pdfBlob || previewImg) && !autoPrintedRef.current) {
      autoPrintedRef.current = true;
      printT = window.setTimeout(() => {
        void printTicket({ pdfBlob, pngDataUrl: previewImg });
      }, 100);
    }

    if (homeTimerRef.current) window.clearTimeout(homeTimerRef.current);
    homeTimerRef.current = window.setTimeout(goHome, AUTO_HOME_MS);

    return () => {
      if (printT) window.clearTimeout(printT);
      if (homeTimerRef.current) {
        window.clearTimeout(homeTimerRef.current);
        homeTimerRef.current = null;
      }
    };
  }, [config?.autoPrintEnabled, pdfBlob, previewImg, buildError, searchStr]);

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
  const autoPrint = config.autoPrintEnabled;

  return (
    <div className="min-h-dvh bg-white text-black">
      <style>{`
        /* Print geometry: 72mm × auto, zero margin — matches Star CUPS; do not add @page margin. */
        @page { size: ${TICKET_WIDTH_MM}mm auto; margin: 0; }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: ${TICKET_WIDTH_MM}mm !important;
          }
          /* Hide on-screen preview chrome when printing. Guests still see it on screen. */
          .no-print,
          .ticket-preview-shell { display: none !important; }
          /* Bring the real ticket DOM into the print flow at exact width (not the scaled preview img). */
          .ticket-source {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: ${TICKET_WIDTH_MM}mm !important;
            background: #fff !important;
          }
        }
        /* Screen: off-flow for html2canvas. Print: rules above override to on-flow ${TICKET_WIDTH_MM}mm. */
        .ticket-source {
          position: absolute;
          left: -10000px;
          top: 0;
          width: 360px;
          background: #fff;
        }
        /* No black border — 72 mm art sits on 80 mm roll with ~4 mm natural side margins. */
        .ticket-source .ticket { border: none; padding: 18px; font-family: 'Jost', system-ui, -apple-system, Arial, sans-serif; }
        .ticket-source .brand { text-align: center; font-weight: 900; letter-spacing: .32em; font-size: 14px; }
        .ticket-source .brand img { display: block; margin: 0 auto 3px; height: auto; width: 50%; max-width: 160px; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
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

      {/*
        On-screen preview only (PNG of the ticket). Kept visible for guests.
        .ticket-preview-shell is display:none in @media print so the printer
        gets .ticket-source at TICKET_WIDTH_MM, not this padded UI shell.
      */}
      <div className="ticket-preview-shell mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 sm:p-6">
        {/* Manual Print/Download only when autoPrint is off — kiosk hides these on purpose */}
        {!autoPrint && (
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-sm font-bold uppercase tracking-[0.28em] text-black">
              Reward ticket · {session.ticketCode}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void printTicket({ pdfBlob, pngDataUrl: previewImg })}
                disabled={!previewImg}
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
        )}

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
