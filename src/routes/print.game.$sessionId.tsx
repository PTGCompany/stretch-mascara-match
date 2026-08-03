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
 * Ticket print width in mm for PDF + @page / thermal capture.
 *
 * Physical roll is 80 mm; Star printable width is 72 mm. Size art to 72 mm —
 * unused ~4 mm each side on the roll is the page edge. Do not draw a black
 * border as a fake frame.
 */
const TICKET_WIDTH_MM = 72;

/** html2canvas scale: aim near Star’s native 203 DPI across 72 mm (~576 px). */
const TICKET_CAPTURE_SCALE = 3;

/**
 * Local kiosk print agent (OptiPlex). Kiosk POSTs multipart thermal PNGs
 * (header + body) for Star Graphic Mode USB — not CUPS/PDF.
 * Do not change the port without updating ~/kiosk/bin/print-agent on the kiosk.
 */
const PRINT_AGENT_URL = "http://127.0.0.1:3091/print";
const PRINT_AGENT_TIMEOUT_MS = 15000;

function isKioskSearch(search: string): boolean {
  return /(?:^|[?&])kiosk(?:=true|=1|=)?(?:&|$)/i.test(search);
}

/**
 * Only call site for printing a ticket (auto-print and the Print button).
 *
 * Kiosk: capture `.ticket-thermal` header+body → multipart POST to Star agent.
 * Non-kiosk: optional PNG/PDF agent (legacy) or window.print().
 * Do not restore CUPS/PDF as the venue primary. Do not merge thermal DOM into
 * the guest on-screen preview.
 */
async function printTicket(opts?: {
  kiosk?: boolean;
  pdfBlob?: Blob | null;
  pngDataUrl?: string | null;
}): Promise<void> {
  const kiosk =
    opts?.kiosk ??
    (typeof window !== "undefined" && isKioskSearch(window.location.search));

  if (kiosk) {
    const headerEl = document.querySelector<HTMLElement>(
      '[data-testid="thermal-ticket-header"]',
    );
    const bodyEl = document.querySelector<HTMLElement>(
      '[data-testid="thermal-ticket-body"]',
    );
    if (!headerEl || !bodyEl) {
      console.error("[printTicket] thermal DOM missing");
      return;
    }
    const { default: html2canvas } = await import("html2canvas");
    const [headerCanvas, bodyCanvas] = await Promise.all([
      html2canvas(headerEl, {
        backgroundColor: "#ffffff",
        scale: TICKET_CAPTURE_SCALE,
        useCORS: true,
      }),
      html2canvas(bodyEl, {
        backgroundColor: "#ffffff",
        scale: TICKET_CAPTURE_SCALE,
        useCORS: true,
      }),
    ]);
    const headerBlob = await (await fetch(headerCanvas.toDataURL("image/png"))).blob();
    const bodyBlob = await (await fetch(bodyCanvas.toDataURL("image/png"))).blob();
    const form = new FormData();
    form.append("header", headerBlob, "header.png");
    form.append("body", bodyBlob, "body.png");
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), PRINT_AGENT_TIMEOUT_MS);
      const res = await fetch(PRINT_AGENT_URL, {
        method: "POST",
        body: form,
        signal: ctrl.signal,
      });
      window.clearTimeout(timer);
      if (res.ok) return;
      console.error("[printTicket] agent error", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("[printTicket] agent unreachable", e);
    }
    return;
  }

  // Non-kiosk: keep browser print / optional agent PNG for lab laptops
  let body: Blob | null = opts?.pdfBlob ?? null;
  let contentType = "application/pdf";
  if (!body && opts?.pngDataUrl) {
    body = await (await fetch(opts.pngDataUrl)).blob();
    contentType = "image/png";
  }
  if (!body) {
    window.print();
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
  } catch {
    /* fall through */
  }
  window.print();
}

function PrintTicketPage() {
  const { sessionId } = useParams({ from: "/print/game/$sessionId" });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const kiosk = isKioskSearch(searchStr);
  const [session, setSession] = useState<GameSession | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [logoOk, setLogoOk] = useState<boolean>(true);
  const [thermalLogoOk, setThermalLogoOk] = useState<boolean>(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [thermalReady, setThermalReady] = useState(false);
  const builtOnceRef = useRef(false);
  const autoPrintedRef = useRef(false);
  const homeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const s = findSession(sessionId);
    const c = resolveConfig(searchStr);
    setSession(s);
    setConfig(c);
    setLogoOk(Boolean(c.sephoraDeliLogoUrl));
    setThermalLogoOk(Boolean(ticketLogoAsset.url));
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

  // Auto-generate the preview PDF once the ticket DOM is ready.
  useEffect(() => {
    if (!ready || !session || !config) return;
    if (builtOnceRef.current) return;
    const noReward = session.pairsFound <= 0;
    if (noReward && !config.printNoRewardTicketEnabled) return;
    builtOnceRef.current = true;
    const t = window.setTimeout(() => {
      void generateAndEmbed();
      if (kiosk) {
        // Thermal fonts/images need a paint frame before capture is safe.
        window.setTimeout(() => setThermalReady(true), 200);
      }
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, config, kiosk]);

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

  // Kiosk / autoPrintEnabled: auto print once, then home after AUTO_HOME_MS.
  useEffect(() => {
    if (!config?.autoPrintEnabled) return;
    if (!previewImg && !buildError) return;
    if (kiosk && !thermalReady && !buildError) return;

    const goHome = () => {
      window.location.assign(withLaunchSearch("/", searchStr));
    };

    let printT: number | undefined;
    if (!autoPrintedRef.current && (previewImg || buildError)) {
      autoPrintedRef.current = true;
      if (previewImg) {
        printT = window.setTimeout(() => {
          void printTicket({
            kiosk,
            pdfBlob,
            pngDataUrl: previewImg,
          });
        }, 150);
      }
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
  }, [
    config?.autoPrintEnabled,
    pdfBlob,
    previewImg,
    buildError,
    searchStr,
    kiosk,
    thermalReady,
  ]);

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
  const brandTitle = config.ticketBrandTitle || config.ticketBrandFallbackText;

  return (
    <div className="min-h-dvh bg-white text-black">
      <style>{`
        @page { size: ${TICKET_WIDTH_MM}mm auto; margin: 0; }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: ${TICKET_WIDTH_MM}mm !important;
          }
          .no-print,
          .ticket-preview-shell,
          .ticket-thermal { display: none !important; }
          .ticket-source {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: ${TICKET_WIDTH_MM}mm !important;
            background: #fff !important;
          }
        }
        .ticket-source {
          position: absolute;
          left: -10000px;
          top: 0;
          width: 360px;
          background: #fff;
        }
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

        /*
          Kiosk-only twin for Star USB. Guest preview uses .ticket-source.
          Do not “fix” by swapping the on-screen design to this. All ink #000;
          regular/medium weights — heavy 900 + pink dither poorly at 203 DPI.
          Header padded ~55 mm to sit in the head↔cutter gap after each cut.
        */
        .ticket-thermal {
          position: absolute;
          left: -12000px;
          top: 0;
          width: 360px;
          background: #fff;
          color: #000;
          font-family: 'Jost', system-ui, -apple-system, Arial, sans-serif;
          font-weight: 500;
        }
        .ticket-thermal .th-header {
          box-sizing: border-box;
          min-height: 275px;
          padding: 28px 16px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: #fff;
        }
        .ticket-thermal .th-header img {
          display: block;
          margin: 0 auto 12px;
          width: 55%;
          max-width: 180px;
          height: auto;
          object-fit: contain;
        }
        .ticket-thermal .th-brand {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.28em;
          text-transform: uppercase;
        }
        .ticket-thermal .th-brand-sub {
          margin-top: 8px;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .ticket-thermal .th-body {
          padding: 8px 16px 20px;
          background: #fff;
        }
        .ticket-thermal .th-stripes {
          height: 8px;
          margin: 8px 0 12px;
          background-image: repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 10px);
        }
        .ticket-thermal .th-title {
          text-align: center;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .ticket-thermal .th-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid #000;
          font-size: 13px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .ticket-thermal .th-row .k { font-weight: 400; color: #000; }
        .ticket-thermal .th-row .v { font-weight: 500; color: #000; text-align: right; }
        .ticket-thermal .th-tier {
          margin-top: 14px;
          padding: 12px;
          border: 2px solid #000;
          text-align: center;
        }
        .ticket-thermal .th-tier .t {
          font-size: 12px;
          letter-spacing: 0.22em;
          font-weight: 500;
          text-transform: uppercase;
        }
        .ticket-thermal .th-tier .g {
          font-size: 14px;
          font-weight: 500;
          margin-top: 6px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }
        .ticket-thermal .th-code {
          margin-top: 14px;
          text-align: center;
          font-family: 'Courier New', monospace;
          font-size: 18px;
          letter-spacing: 0.28em;
          font-weight: 500;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 10px 0;
        }
        .ticket-thermal .th-foot {
          margin-top: 14px;
          text-align: center;
          font-family: 'Jost', system-ui, Arial, sans-serif;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 18px;
          line-height: 1.15;
          padding: 10px 6px;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
        }
      `}</style>

      {/* Guest / PDF source — unchanged visual language */}
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

      {/* Kiosk Star thermal twin — header buffered in head↔cutter gap */}
      {kiosk && (
        <div className="ticket-thermal" aria-hidden="true">
          <div className="th-header" data-testid="thermal-ticket-header">
            {thermalLogoOk ? (
              <img
                src={ticketLogoAsset.url}
                alt=""
                onError={() => setThermalLogoOk(false)}
              />
            ) : null}
            <div className="th-brand">{brandTitle}</div>
            <div className="th-brand-sub">{config.ticketBrandFallbackText}</div>
          </div>
          <div className="th-body" data-testid="thermal-ticket-body">
            <div className="th-stripes" />
            <div className="th-title">Reward Ticket</div>
            <div className="th-row"><span className="k">Date</span><span className="v">{dateStr}</span></div>
            <div className="th-row">
              <span className="k">Pairs found</span>
              <span className="v">{session.pairsFound} / {session.totalPairs}</span>
            </div>
            <div className="th-row">
              <span className="k">Score</span>
              <span className="v">{session.score} pts</span>
            </div>
            <div className="th-row">
              <span className="k">Reward</span>
              <span className="v">{rewardProduct}</span>
            </div>
            <div className="th-tier">
              <div className="t">{rewardMessage || rewardLabel}</div>
              {!noReward && session.finalWinLevel && (
                <div className="g">Tier {session.finalWinLevel} / 3</div>
              )}
            </div>
            <div className="th-code">{session.ticketCode}</div>
            <div className="th-foot">{config.ticketFooterText}</div>
            <div className="th-stripes" />
          </div>
        </div>
      )}

      <div className="ticket-preview-shell mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 sm:p-6">
        {!autoPrint && (
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-sm font-bold uppercase tracking-[0.28em] text-black">
              Reward ticket · {session.ticketCode}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void printTicket({
                    kiosk,
                    pdfBlob,
                    pngDataUrl: previewImg,
                  })
                }
                disabled={!previewImg || (kiosk && !thermalReady)}
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
