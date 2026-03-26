import { useEffect, useRef, useState } from "react";
import { X, Printer, ChevronDown, FileText, Loader2 } from "lucide-react";

const PRIMARY = "#785E9E";

interface KalkulacijaRow {
  rb: number;
  sifra_kalkulacije: number;
  datum_kalkulacije: string;
  naziv_partnera: string;
  broj_racuna: string;
  ukupno_km: number;
  duzi_se_za_iznos: number;
  PDV: number;
  VP: number;
  ZT: number;
  datum_unosa_kalkulacije: string;
}

interface KalkulacijaTotals {
  ukupno_km: number;
  duzi_se_za_iznos: number;
  PDV: number;
  VP: number;
  ZT: number;
}

interface PrintModalKalkulacijaProps {
  open: boolean;
  onClose: () => void;
  rows: KalkulacijaRow[];
  totals: KalkulacijaTotals;
  periodLabel?: string;
  title: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number.isFinite(v) ? v : 0);

const getDateOnly = (s: string) => {
  if (!s) return "";
  const n = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

const displayDate = (s: string) => {
  const d = getDateOnly(s);
  if (!d) return "-";
  return new Date(`${d}T00:00:00`).toLocaleDateString("sr-Latn-RS");
};

function buildReportHTML(
  rows: KalkulacijaRow[],
  totals: KalkulacijaTotals,
  periodLabel: string,
  title: string,
): string {
  const rowsHtml = rows
    .map((row, index) => {
      const bg = index % 2 === 0 ? "#f7f3fc" : "#ffffff";
      return `<tr style="background:${bg}">
        <td>${row.rb}</td>
        <td>${row.sifra_kalkulacije ?? "-"}</td>
        <td>${displayDate(row.datum_kalkulacije)}</td>
        <td>${row.naziv_partnera || "-"}</td>
        <td>${row.broj_racuna || "-"}</td>
        <td class="num">${fmt(Number(row.ukupno_km))}</td>
        <td class="num">${fmt(Number(row.duzi_se_za_iznos))}</td>
        <td class="num">${fmt(Number(row.PDV))}</td>
        <td class="num">${fmt(Number(row.VP))}</td>
        <td class="num">${fmt(Number(row.ZT))}</td>
        <td>${displayDate(row.datum_unosa_kalkulacije)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; padding: 12mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8mm; }
  .header h1 { font-size: 14pt; font-weight: 700; color: ${PRIMARY}; }
  .header .period { font-size: 9pt; color: #555; margin-top: 2px; }
  .header .logo { font-size: 10pt; font-weight: 600; color: #333; text-align: right; }
  .summary { display: flex; gap: 6mm; margin-bottom: 6mm; flex-wrap: wrap; }
  .summary-box { border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; min-width: 120px; }
  .summary-box .label { font-size: 7pt; text-transform: uppercase; color: #888; letter-spacing: .04em; }
  .summary-box .value { font-size: 9pt; font-weight: 700; color: #1a1a1a; }
  table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  thead tr { background: #f5f5f5; }
  th { padding: 4px 5px; text-align: left; font-size: 7.5pt; text-transform: uppercase;
       letter-spacing: .04em; color: #555; border-bottom: 1.5px solid #ccc; white-space: nowrap; }
  td { padding: 3px 5px; border-bottom: 1px solid #000; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { font-weight: 700; border-top: 1.5px solid #aaa; background: #f9f9f9; padding: 4px 5px; }
  .footer { margin-top: 8mm; font-size: 8pt; color: #888; text-align: right; }
  @media print {
    body { padding: 8mm; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${title}</h1>
      <div class="period">Period: ${periodLabel || "–"} &nbsp;|&nbsp; Broj stavki: ${rows.length}</div>
    </div>
    <div class="logo">Izvjestaj<br/><span style="font-weight:400;font-size:8pt;color:#999">${new Date().toLocaleDateString("sr-Latn-RS")}</span></div>
  </div>

  <div class="summary">
    <div class="summary-box"><div class="label">Ukupno KM</div><div class="value">${fmt(totals.ukupno_km)} KM</div></div>
    <div class="summary-box"><div class="label">Duzi se</div><div class="value">${fmt(totals.duzi_se_za_iznos)} KM</div></div>
    <div class="summary-box"><div class="label">PDV</div><div class="value">${fmt(totals.PDV)} KM</div></div>
    <div class="summary-box"><div class="label">VP</div><div class="value">${fmt(totals.VP)} KM</div></div>
    <div class="summary-box"><div class="label">ZT</div><div class="value">${fmt(totals.ZT)} KM</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>RB</th>
        <th>Sifra kalk.</th>
        <th>Datum kalk.</th>
        <th>Partner</th>
        <th>Broj racuna</th>
        <th class="num">Ukupno KM</th>
        <th class="num">Duzi se</th>
        <th class="num">PDV</th>
        <th class="num">VP</th>
        <th class="num">ZT</th>
        <th>Datum unosa</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5">UKUPNO — ${rows.length} stavki</td>
        <td class="num">${fmt(totals.ukupno_km)}</td>
        <td class="num">${fmt(totals.duzi_se_za_iznos)}</td>
        <td class="num">${fmt(totals.PDV)}</td>
        <td class="num">${fmt(totals.VP)}</td>
        <td class="num">${fmt(totals.ZT)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">Generisano: ${new Date().toLocaleString("sr-Latn-RS")}</div>
</body>
</html>`;
}

export function PrintModalKalkulacija({
  open,
  onClose,
  rows,
  totals,
  periodLabel = "",
  title,
}: PrintModalKalkulacijaProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape",
  );
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoadingPrinters(true);

    const API_URL =
      (import.meta as unknown as { env: Record<string, string> }).env
        ?.VITE_API_URL || "http://localhost:3003";

    fetch(`${API_URL}/api/printers`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list: string[] = Array.isArray(data?.printers)
          ? data.printers
          : [];
        setPrinters(list);
        if (list.length > 0) setSelectedPrinter(list[0]);
      })
      .catch(() => {
        setPrinters([]);
      })
      .finally(() => setLoadingPrinters(false));
  }, [open]);

  useEffect(() => {
    if (!open || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    const html = buildReportHTML(rows, totals, periodLabel, title);
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, rows, totals, periodLabel, title]);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    setPrinting(true);

    const styleId = "print-orientation";
    const doc = iframe.contentDocument!;
    let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = styleId;
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = `@page { size: A4 ${orientation}; margin: 10mm; }`;

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => setPrinting(false), 1000);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: "min(96vw, 1100px)", height: "min(92vh, 820px)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-gray-100"
          style={{ background: `${PRIMARY}0d` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${PRIMARY}20` }}
            >
              <FileText size={16} style={{ color: PRIMARY }} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                Preview — {title}
              </h2>
              <p className="text-xs text-gray-500">
                {rows.length} stavki &nbsp;|&nbsp; {periodLabel || "Sve stavke"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(["landscape", "portrait"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                  style={
                    orientation === o
                      ? { background: PRIMARY, color: "#fff" }
                      : { color: "#6b7280" }
                  }
                >
                  {o === "landscape" ? "Horizontalno" : "Vertikalno"}
                </button>
              ))}
            </div>

            <div className="relative">
              {loadingPrinters ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500">
                  <Loader2 size={13} className="animate-spin" />
                  Printeri...
                </div>
              ) : printers.length > 0 ? (
                <div className="relative inline-flex items-center">
                  <Printer
                    size={13}
                    className="absolute left-2.5 text-gray-400 pointer-events-none"
                  />
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="pl-8 pr-7 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 appearance-none cursor-pointer"
                    style={
                      {
                        "--tw-ring-color": `${PRIMARY}40`,
                      } as React.CSSProperties
                    }
                  >
                    {printers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    className="absolute right-2 text-gray-400 pointer-events-none"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
                  <Printer size={13} />
                  Sistemski printer
                </div>
              )}
            </div>

            <button
              onClick={handlePrint}
              disabled={printing}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: PRIMARY, color: "#fff" }}
            >
              {printing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )}
              Štampaj
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-gray-200 p-4 overflow-hidden">
          <iframe
            ref={iframeRef}
            title={`${title} Preview`}
            className="w-full h-full rounded-lg bg-white shadow-md border border-gray-200"
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}
