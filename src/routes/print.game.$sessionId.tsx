import { createFileRoute, useParams, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  findSession,
  updateSessionPrintStatus,
  type GameConfig,
  type GameSession,
} from "@/lib/game-config";
import { getKioskLaunch, resolveConfig, withLaunchSearch } from "@/lib/kiosk-launch";
import ticketLogoAsset from "@/assets/sephora-ticket-logo-new.png.asset.json";

export const Route = createFileRoute("/print/game/$sessionId")({
  head: () => ({
    meta: [
      { title: "Print — Sephora Collection Reward Ticket" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "View and print your Sephora Collection game reward ticket." },
      { property: "og:title", content: "Print — Sephora Collection Reward Ticket" },
      { property: "og:description", content: "View and print your Sephora Collection game reward ticket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrintTicketPage,
});

const AUTO_HOME_MS = 10_000; // Venue kiosk: return to idle after auto-print (intentional)

/**
 * Guest ticket / browser print / Download PDF width (partner-owned look).
 * Keep 80 mm + bordered art — do not “align” this to the kiosk thermal width.
 * Sitech Industries owns the Star/thermal path; if ticket size or framing changes
 * for guests, they can edit `.ticket-source` freely — check with Sitech Industries
 * only if unsure whether hardware print will still match.
 */
const TICKET_GUEST_WIDTH_MM = 80;
/**
 * Kiosk Star printable width only (?kiosk=true thermal twin). Physical roll is
 * 80 mm; Star prints 72 mm. Unused side margin on the roll is the page edge —
 * do not draw a black border on the thermal twin as a fake frame.
 * Owned by Sitech Industries — do not restyle to match the guest ticket.
 */
const TICKET_THERMAL_WIDTH_MM = 72;

/** Guest `.ticket-source` capture scale (on-screen preview + Download PDF). */
const TICKET_CAPTURE_SCALE = 2;
/**
 * Kiosk thermal capture: CSS ticket is 360 px wide ≈ 72 mm; scale so canvas
 * width ≈ Star 203 DPI × 72 mm (576 px). Agent should not need to downscale.
 */
const TICKET_THERMAL_CAPTURE_SCALE =
  Math.round((TICKET_THERMAL_WIDTH_MM / 25.4) * 203) / 360;

/**
 * Local OptiPlex print agent. Only used when ?kiosk=true.
 * Multipart PNG fields `header` + `body` → Star Graphic Mode on USB.
 * Do not change the port without updating ~/kiosk/bin/print-agent.
 */
const PRINT_AGENT_URL = "http://127.0.0.1:3091/print";
const PRINT_AGENT_TIMEOUT_MS = 15000;

/**
 * Only call site for printing (auto-print and the Print button).
 *
 * ?kiosk=true: capture `.ticket-thermal` header+body → multipart POST to agent.
 *   Never fall back to window.print() on the venue (dialog flash / Save as PDF).
 * Otherwise: window.print() on the guest `.ticket-source` (original behaviour).
 * Do not merge thermal DOM into the guest on-screen preview.
 * Sitech Industries owns the kiosk branch of this function — leave it alone
 * unless changing guest Print behaviour; then double-check with them.
 */
async function printTicket(opts?: { kiosk?: boolean }): Promise<void> {
  const kiosk =
    opts?.kiosk ??
    (typeof window !== "undefined" && getKioskLaunch(window.location.search).kiosk);

  if (!kiosk) {
    window.print();
    return;
  }

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
  // html2canvas clips glyphs when letter-spacing is non-zero — force 0 in clone.
  const thermalCaptureOpts = {
    backgroundColor: "#ffffff" as const,
    scale: TICKET_THERMAL_CAPTURE_SCALE,
    useCORS: true,
    onclone: (_doc: Document, el: HTMLElement) => {
      el.querySelectorAll<HTMLElement>("*").forEach((node) => {
        node.style.letterSpacing = "0";
      });
    },
  };
  const [headerCanvas, bodyCanvas] = await Promise.all([
    html2canvas(headerEl, thermalCaptureOpts),
    html2canvas(bodyEl, thermalCaptureOpts),
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
}

function PrintTicketPage() {
  const { sessionId } = useParams({ from: "/print/game/$sessionId" });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const kiosk = getKioskLaunch(searchStr).kiosk;
  const [session, setSession] = useState<GameSession | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [logoOk, setLogoOk] = useState<boolean>(true);
  const [thermalLogoOk, setThermalLogoOk] = useState<boolean>(true);
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

  const captureGuestTicketCanvas = async () => {
    const node = document.querySelector<HTMLElement>('[data-testid="print-ticket-body"]');
    if (!node) return null;
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: TICKET_CAPTURE_SCALE,
      useCORS: true,
    });
  };

  const buildPdf = async () => {
    if (!session) return null;
    const canvas = await captureGuestTicketCanvas();
    if (!canvas) return null;
    const { jsPDF } = await import("jspdf");
    const imgData = canvas.toDataURL("image/png");
    const widthMm = TICKET_GUEST_WIDTH_MM;
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
      const canvas = await captureGuestTicketCanvas();
      if (!canvas) return;
      setPreviewImg(canvas.toDataURL("image/png"));
      updateSessionPrintStatus(session.id, "PRINTED", kiosk);
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "Failed to build ticket");
      updateSessionPrintStatus(session.id, "FAILED", kiosk);
    } finally {
      setBuilding(false);
    }
  };

  // Auto-generate the preview PNG once the ticket DOM is ready.
  useEffect(() => {
    if (!ready || !session || !config) return;
    if (builtOnceRef.current) return;
    const noReward = session.pairsFound <= 0;
    if (noReward && !config.printNoRewardTicketEnabled) return;
    builtOnceRef.current = true;
    const t = window.setTimeout(() => {
      void generateAndEmbed();
      if (kiosk) {
        // Let thermal fonts/images paint once before capture.
        window.setTimeout(() => setThermalReady(true), 200);
      }
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, config, kiosk]);

  const doDownloadPdf = async () => {
    if (!session) return;
    try {
      const built = await buildPdf();
      if (!built) return;
      built.pdf.save(`sephora-ticket-${session.ticketCode}.pdf`);
      updateSessionPrintStatus(session.id, "PRINTED", kiosk);
    } catch {
      if (session) updateSessionPrintStatus(session.id, "FAILED", kiosk);
    }
  };

  // autoPrintEnabled (forced by ?kiosk=true): print once, then home after AUTO_HOME_MS.
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
          void printTicket({ kiosk });
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

  return (
    <div className="min-h-dvh bg-white text-black">
      <style>{`
        @page { size: ${TICKET_GUEST_WIDTH_MM}mm auto; margin: 6mm; }
        @media print {
          .no-print,
          .ticket-preview-shell,
          .ticket-thermal { display: none !important; }
          body { background: #fff !important; }
          .ticket-source {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: ${TICKET_GUEST_WIDTH_MM}mm !important;
            background: #fff !important;
          }
        }
        /*
          Guest / PDF / window.print ticket — partner-owned visual design.
          Edit freely for Lovable/web. A separate .ticket-thermal twin exists
          for venue Star printers (?kiosk=true only). Layout/CSS changes here do
          NOT update the thermal twin — if paper tickets must match a redesign,
          flag Sitech Industries. Logo: sephora-ticket-logo-new (+ crop rules
          on the thermal side); CDN __l5e game art is installed on the kiosk
          separately when assets change.
        */
        .ticket-source {
          position: absolute;
          left: -10000px;
          top: 0;
          width: 360px;
          background: #fff;
        }
        .ticket-source .ticket { border: 2px solid #000; padding: 18px; font-family: 'Jost', system-ui, -apple-system, Arial, sans-serif; }
        .ticket-source .brand { text-align: center; font-weight: 900; letter-spacing: .32em; font-size: 14px; }
        .ticket-source .brand img { display: block; margin: 0 auto 3px; height: auto; width: 50%; max-width: 160px; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
        .ticket-source .brand small { display: block; letter-spacing: .14em; font-weight: 700; margin-top: 4px; font-size: 9px; }
        .ticket-source .stripes { height: 10px; margin: 10px 0; background-image: repeating-linear-gradient(90deg,#000 0 6px,transparent 6px 12px); }
        .ticket-source .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #999; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
        .ticket-source .row .k { color: #555; font-weight: 700; }
        .ticket-source .row .v { font-weight: 900; }
        .ticket-source .tier { margin-top: 12px; padding: 12px; border: 2px solid #ff808b; text-align: center; }
        .ticket-source .tier .t { font-size: 11px; letter-spacing: .28em; font-weight: 900; color: #ff808b; text-transform: uppercase; }
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
          Kiosk-only twin for Star USB (?kiosk=true only). Guest preview stays
          on .ticket-source — do not restyle that for thermal. All ink #000;
          header = lead + cropped logo + spacer + stripes + REWARD TICKET
          (primed into the head↔cutter gap after each cut); body starts at Date.
          Logo asset has empty pad — crop via aspect-ratio or gap looks huge.
          CSS width 360px ≈ 72 mm. letter-spacing must stay 0 on large type
          (html2canvas clips otherwise); open letterforms via word-spacing /
          spacing ticketCode characters in the DOM instead.
          Tier/code/foot use extra bottom padding so optical centre survives capture.
          Owned by Sitech Industries — do not delete, merge into .ticket-source,
          or “simplify” away. New ticket fields/copy/rows must be mirrored here
          (and often in the header/body split) or the paper ticket will drift;
          check with Sitech Industries if unsure.
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
          overflow: visible;
        }
        .ticket-thermal .th-header {
          box-sizing: border-box;
          padding: 0 16px 10px;
          display: block;
          text-align: center;
          background: #fff;
          overflow: visible;
        }
        /* ~12 mm white above logo for head↔cutter priming */
        .ticket-thermal .th-header-lead {
          height: 60px;
          width: 100%;
          background: #fff;
        }
        /* Crop logo asset empty pad (ink ≈ centre band of 1920×1844) */
        .ticket-thermal .th-header-logo-crop {
          width: 74.25%;
          max-width: 243px;
          margin: 0 auto;
          aspect-ratio: 1920 / 933;
          overflow: hidden;
          position: relative;
          background: #fff;
        }
        .ticket-thermal .th-header-logo-crop img {
          position: absolute;
          left: 0;
          top: 50%;
          width: 100%;
          height: auto;
          max-width: none;
          margin: 0;
          transform: translateY(-50%);
          object-fit: contain;
        }
        /* ~7 mm logo → REWARD TICKET (lives in primed header) */
        .ticket-thermal .th-after-logo {
          height: 35px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding-bottom: 8px;
        }
        .ticket-thermal .th-stripes {
          height: 6px;
          margin: 0;
          background-image: repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 10px);
        }
        .ticket-thermal .th-title {
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          line-height: 1.35;
          margin: 0;
          padding: 4px 0 8px;
          overflow: visible;
        }
        .ticket-thermal .th-body {
          padding: 8px 16px 20px;
          background: #fff;
          overflow: visible;
        }
        .ticket-thermal .th-body > .th-stripes {
          margin: 14px 0 0;
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
          line-height: 1.35;
          overflow: visible;
        }
        .ticket-thermal .th-row .k { font-weight: 400; color: #000; }
        .ticket-thermal .th-row .v { font-weight: 500; color: #000; text-align: right; }
        .ticket-thermal .th-tier {
          margin-top: 14px;
          box-sizing: border-box;
          padding: 8px 12px 18px;
          border: 2px solid #000;
          text-align: center;
          overflow: visible;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .ticket-thermal .th-tier .t {
          font-size: 12px;
          letter-spacing: 0;
          word-spacing: 0.2em;
          font-weight: 500;
          text-transform: uppercase;
          line-height: 1.2;
          overflow: visible;
        }
        .ticket-thermal .th-tier .g {
          display: inline-block;
          font-size: 18px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0;
          word-spacing: 0.15em;
          line-height: 1.2;
          margin-top: 0;
          padding: 0;
          overflow: visible;
        }
        .ticket-thermal .th-code {
          margin-top: 14px;
          box-sizing: border-box;
          text-align: center;
          font-family: 'Courier New', monospace;
          font-size: 18px;
          letter-spacing: 0;
          font-weight: 500;
          line-height: 1.2;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 8px 6px 22px;
          overflow: visible;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ticket-thermal .th-code-text {
          display: inline-block;
          line-height: 1.2;
          padding: 0;
          overflow: visible;
        }
        .ticket-thermal .th-foot {
          margin-top: 14px;
          box-sizing: border-box;
          text-align: center;
          font-family: 'Jost', system-ui, Arial, sans-serif;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0;
          word-spacing: 0.12em;
          font-size: 18px;
          line-height: 1.2;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          padding: 8px 6px 22px;
          overflow: visible;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ticket-thermal .th-foot-text {
          display: inline-block;
          line-height: 1.2;
          padding: 0;
          overflow: visible;
        }
      `}</style>

      {/* Guest / PDF source — partner visual language; see .ticket-source comment */}
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
        Star twin — Sitech Industries. Mounted only with ?kiosk=true.
        Keep field bindings in sync with .ticket-source (Date / pairs / score /
        reward / tier / code / footer). Renaming session/config keys or adding
        rows? Tell Sitech Industries so paper capture stays correct.
      */}
      {kiosk && (
        <div className="ticket-thermal" aria-hidden="true">
          <div className="th-header" data-testid="thermal-ticket-header">
            <div className="th-header-lead" aria-hidden="true" />
            <div className="th-header-logo-crop">
              {thermalLogoOk ? (
                <img
                  src={ticketLogoAsset.url}
                  alt=""
                  onError={() => setThermalLogoOk(false)}
                />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.28em", textTransform: "uppercase", padding: "24px 0" }}>
                  {config.ticketBrandFallbackText}
                </div>
              )}
            </div>
            <div className="th-after-logo" aria-hidden="true">
              <div className="th-stripes" />
            </div>
            <div className="th-title">Reward Ticket</div>
          </div>
          <div className="th-body" data-testid="thermal-ticket-body">
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
            <div className="th-code">
              <span className="th-code-text">
                {session.ticketCode.split("").join(" ")}
              </span>
            </div>
            <div className="th-foot">
              <span className="th-foot-text">{config.ticketFooterText}</span>
            </div>
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
                onClick={() => void printTicket({ kiosk })}
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
